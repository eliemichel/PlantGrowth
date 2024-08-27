/**
 * This is a pool of behavior implementations available for simulation.
 *
 * NB: When adding a new behavior, don't forget to add it to the 'behaviors'
 * registry at the end (it is the only variable that gets exported).
 */

import { Vector } from '../utils/vector.tsx'
import { Vector3, Matrix4 } from 'three'
import {
  type Phytomer,
  type Meristem,
  type Leaf,
} from '../models/SceneModel.tsx'
import {
  type GrowthModel,
  type RelativeVector,
  type MeristemState,
} from '../models/GrowthModel.tsx'
import { toVector } from '../utils/vector3.tsx'
import {
  evalExpr,
  makeContext,
} from '../models/DSL.tsx'
import * as Legacy from './legacyGrowth.tsx'
import {
  relativeToWorldDirection,
  epsilonSq,
  createPhytomersFromDirection,
  makeGrowthFrameFromDirection,
  getPhytomerDirection,
  getPhytomerPosition,
  clonePhytomer,
  createLeafOrientation,
} from './growth.tsx'
import {
  type Behavior,
  type EvalContext,
  BehaviorFlag,
} from './behaviorPipelines.tsx'

/**
 * Grow a little bit a node of a plant located below a meristem.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growMeristem(context: EvalContext, growthModel: GrowthModel, meristem: Meristem, parent: Phytomer): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const cellElongation = new Vector3();
  const merismaticGrowth = new Vector3();

  // 1. Merismatic growth
  // Each meristem grows its stem by a fixed amount.

  merismaticGrowth.set(...getPhytomerDirection(parent));
  merismaticGrowth.normalize();

  const merismaticGrowthLength = (() => {
    const ctx = makeContext("meristem", {
      meristem: meristem.state.type,
    });

    const maybeRate = evalExpr(growthModel.merismaticGrowthLength, ctx);
    if (maybeRate.result === undefined) {
      context.onEvalError(maybeRate.error);
      return 0;
    }
    const rate = maybeRate.result;
    if (typeof rate !== 'number') {
      context.onEvalError({
        location: growthModel.merismaticGrowthLength.nodeId,
        message: `Expression should return a number, but returned an expresion of type '${typeof rate}' (value: '${rate}')`,
      });
      return 0;
    }
    return rate;
  })();

  merismaticGrowth.multiplyScalar(merismaticGrowthLength);

  return toVector(merismaticGrowth);
}

/**
 * Grow a little bit any node of a plant.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growPhytomer(context: EvalContext, growthModel: GrowthModel, phytomer: Phytomer, parent: Phytomer): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const cellElongation = new Vector3();
  const merismaticGrowth = new Vector3();

  // 2. Cell elongation.
  // Each phytomer gets scaled (i.e., it grows by an amount relative to its
  // current size). Scaling depends on the flexibility of the phytomer (for now
  // it is binary, namely 0 for inactive branches, constant for active
  // branches)

  prevNode.set(...getPhytomerPosition(parent));
  node.set(...getPhytomerPosition(phytomer));
  cellElongation.subVectors(node, prevNode);
  
  const ctx = makeContext("phytomer", {
    length: cellElongation.length(),
    meristem: phytomer.differentiation,
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    context.onEvalError(maybeRate.error);
    return [0,0,0];
  }
  const rate = maybeRate.result;
  if (typeof rate !== 'number') {
    context.onEvalError({
      location: growthModel.continuousGrowthRate.nodeId,
      message: `Expression should return a number, but returned an expresion of type '${typeof rate}' (value: '${rate}')`,
    });
    return [0,0,0];
  }

  cellElongation.multiplyScalar(rate);

  return toVector(cellElongation);
}

/**
 * Grow a little bit a given leaf, given the growth model's leafGrowthRate
 */
function growLeaf(context: EvalContext, growthModel: GrowthModel, phytomer: Phytomer, leafIndex: number): Leaf {
  const leaf = phytomer.leaves[leafIndex];

  const ctx = makeContext("leaf", {
    size: leaf.size,
  });

  const maybeRate = evalExpr(growthModel.leafGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    context.onEvalError(maybeRate.error);
    return {...leaf};
  }
  const rate = maybeRate.result;
  if (typeof rate !== 'number') {
    context.onEvalError({
      location: growthModel.leafGrowthRate.nodeId,
      message: `Expression should return a number, but returned an expresion of type '${typeof rate}' (value: '${rate}')`,
    });
    return {...leaf};
  }

  return {
    ...leaf,
    size: leaf.size * (1.0 + rate),
  }
}

/**
 * Model of merismatic activity that generates new organs
 */
function growNewOrgans(
  _context: EvalContext,
  growthModel: GrowthModel,
  meristem: Meristem,
  parent: Phytomer,
  nextPhytomerIndex: number,
): [Meristem, Phytomer[]] {

  const [ nextMeristemState, meristemActions ] = growthModel.meristemStateTransition(meristem.state);

  const nextMeristem = {
    ...meristem,
    state: nextMeristemState,
  };

  const nextParent = {
    ...parent,
    buds: [...parent.buds],
    leaves: [...parent.leaves],
    children: [...parent.children],
  };

  const meristemPosition = getPhytomerPosition(parent);

  const newPhytomers: Phytomer[] = [];

  // When adding at least one of a leaf, bud or stem, we build a new phytomer to follow up on growing
  let hasFollowUpStem = false;
  const ensureFollowUpStem = () => {
    if (hasFollowUpStem) return;
    hasFollowUpStem = true;

    const newPhytomerIndex = nextPhytomerIndex + newPhytomers.length;
    nextMeristem.parentRef.index = newPhytomerIndex; // TODO: do NOT modify index directly
    parent.children.push({ ...nextMeristem.parentRef }) // TODO: do NOT create reference directly
    newPhytomers.push({
      ...parent,
      buds: [],
      leaves: [],
      children: [],
    });
  }

  const createLeaf = (relativeDirection: RelativeVector | undefined, relativeNormal: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, parent);

    const normal: Vector =
      relativeNormal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeNormal, parent);

    nextParent.leaves.push({
      size: 0.05,
      orientation: createLeafOrientation({
        normal,
        direction,
      })
    });
    ensureFollowUpStem();
  }

  const createBud = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, parent);

    nextParent.buds.push({
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
    });
    ensureFollowUpStem();
  }

  const createStem = (meristemState: MeristemState, relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeDirection, parent);

    // TODO: Memoize
    const unitDirection = new Vector3();

    unitDirection.set(...direction)
    unitDirection.normalize();
    const newMeristemDirection = toVector(unitDirection);

    ensureFollowUpStem();

    { // New branching stem
      const newPhytomerIndex = nextPhytomerIndex + newPhytomers.length;
      parent.children.push({
        collection: meristem.parentRef.collection,
        index: newPhytomerIndex,
      }) // TODO: do NOT create reference directly

      const growthFrame = makeGrowthFrameFromDirection(
        meristemPosition,
        newMeristemDirection,
      );
      const transform = new Matrix4;
      transform.copy(growthFrame.matrix)

      newPhytomers.push({
        ...parent,
        transform,
        buds: [],
        leaves: [],
        children: [],
      });
    }
  }

  for (const action of meristemActions) {
    switch (action.type) {
    case 'create-leaf':
      createLeaf(action.direction, action.normal);
      break;
    case 'create-bud':
      createBud(action.direction);
      break;
    case 'create-stem':
      createStem(action.meristemState, action.direction);
      break;
    }
  }

  return [ nextMeristem, newPhytomers ];
}

/**
 * Apply gravity to a node, called from a growth2 behavior
 */
function nodeGravityKernel(context: EvalContext, growthModel: GrowthModel, phytomer: Phytomer, parent: Phytomer): Matrix4 {
  // TODO: Memoize
  const up = new Vector3( 0, 1, 0 );
  const m = new Matrix4();
  const prevNode = new Vector3();
  const node = new Vector3();
  const diff = new Vector3();
  const rotationAxis = new Vector3();

  prevNode.set(...getPhytomerPosition(parent));
  node.set(...getPhytomerPosition(phytomer));
  diff.subVectors(node, prevNode);
  const phytomerLength = diff.length();
  diff.normalize();

  rotationAxis.crossVectors(up, diff);
  if (rotationAxis.lengthSq() < epsilonSq) {
    rotationAxis.set(Math.random() - 0.5, 0.0, Math.random() - 0.5);
  }
  rotationAxis.normalize();

  const angle = diff.angleTo(up);

  // 1. Gravity
  // WARNING: This is a placeholder expression
  // TODO: how to get the total children mass?
  let deltaAngle = (Math.PI / 2 - angle) * 0.01;

  // 2. Directional growth: the plant may counter gravity if it is still elongating cells
  const ctx = makeContext("phytomer", {
    length: phytomerLength,
    meristem: phytomer.differentiation,
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    context.onEvalError(maybeRate.error);
  } else {
    const rate = maybeRate.result;
    if (typeof rate !== 'number') {
      context.onEvalError({
        location: growthModel.leafGrowthRate.nodeId,
        message: `Expression should return a number, but returned an expresion of type '${typeof rate}' (value: '${rate}')`,
      });
    } else {
      if (rate > 0) {
        deltaAngle = -angle * 0.02;
      }
    }
  }

  
  m.makeRotationAxis(rotationAxis, deltaAngle);
  return m;
}

const behaviors: { [key: string]: Behavior } = {
  legacy: {
    name: 'legacy',
    flags: BehaviorFlag.BypassActive,
    type: 'organogenesis',
    handlePhytomer: Legacy.growPhytomer,
  },

  growth: {
    name: 'growth',
    flags: BehaviorFlag.None,
    type: 'growth',
    handlePhytomer: growPhytomer,
    handleLeaf: growLeaf,
  },

  organogenesis: {
    name: 'organogenesis',
    flags: BehaviorFlag.None,
    type: 'organogenesis',
    handlePhytomer: growNewOrgans,
  },

  gravity: {
    name: 'gravity',
    flags: BehaviorFlag.None,
    type: 'growth2',
    handlePhytomer: nodeGravityKernel,
  },
};

export default behaviors;
