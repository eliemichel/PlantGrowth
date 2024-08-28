/**
 * This is a pool of behavior implementations available for simulation.
 *
 * NB: When adding a new behavior, don't forget to add it to the 'behaviors'
 * registry at the end (it is the only variable that gets exported).
 */

import { Vector3, Matrix4 } from 'three'
import { Vector } from '../utils/vector.tsx'
import { toVector } from '../utils/vector3.tsx'
import { Collection } from '../utils/Collection.tsx'
import {
  type Phytomer,
  type Leaf,
} from '../models/SceneModel.tsx'
import {
  type GrowthModel,
  type RelativeVector,
  type MeristemState,
} from '../models/GrowthModel.tsx'
import {
  evalExpr,
  makeContext,
} from '../models/DSL.tsx'
import * as Legacy from './legacyGrowth.tsx'
import {
  relativeToWorldDirection,
  epsilonSq,
  makeGrowthFrameFromDirection,
  getPhytomerDirection,
  getPhytomerPosition,
  createLeafOrientation,
} from './growth.tsx'
import {
  type Behavior,
  type EvalContext,
  type OrganogenesisMeristemHandlerOutput,
  BehaviorFlag,
} from './behaviorPipelines.tsx'

/**
 * Grow a little bit any node of a plant.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growPhytomer(context: EvalContext, growthModel: GrowthModel, phytomer: Phytomer, _phytomerIndex: number, parentTransform: Matrix4 | null): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const cellElongation = new Vector3();
  const merismaticGrowth = new Vector3();
  const total = new Vector3();

  if (parentTransform === null) {
    return [0,0,0];
  }

  const meristem = phytomer.meristem;
  if (meristem !== null) {
    // 1. Merismatic growth
    // Each meristem grows its stem by a fixed amount.

    merismaticGrowth.set(...getPhytomerDirection({ transform: parentTransform }));
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
  } else {
    merismaticGrowth.set(0, 0, 0);
  }

  // 2. Cell elongation.
  // Each phytomer gets scaled (i.e., it grows by an amount relative to its
  // current size). Scaling depends on the flexibility of the phytomer (for now
  // it is binary, namely 0 for inactive branches, constant for active
  // branches)

  prevNode.set(...getPhytomerPosition({ transform: parentTransform }));
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

  total.addVectors(merismaticGrowth, cellElongation);
  return toVector(total);
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
  phytomer: Phytomer,
): OrganogenesisMeristemHandlerOutput {
  const { meristem } = phytomer;
  if (meristem === null) return { phytomer, newPhytomers: null };

  const [ nextMeristemState, meristemActions ] = growthModel.meristemStateTransition(meristem.state);

  const nextMeristem = {
    ...meristem,
    state: nextMeristemState,
  };

  const out: OrganogenesisMeristemHandlerOutput = {
    phytomer: {
      ...phytomer,
      buds: [...phytomer.buds],
      leaves: [...phytomer.leaves],
      children: [...phytomer.children],
      meristem: nextMeristem,
    },
    newPhytomers: null,
  };

  const meristemPosition = getPhytomerPosition(phytomer);

  // Add a new phytomer to the output and reference it in the main phytomer's children
  const createPhytomer = (newPhytomer: Phytomer): Phytomer => {
    if (out.newPhytomers === null) out.newPhytomers = new Collection<Phytomer>();
    out.newPhytomers.append(newPhytomer);
    out.phytomer.children.push(out.newPhytomers.createRef(-1));
    return newPhytomer;
  }

  // When adding at least one of a leaf, bud or stem, we build a new phytomer to follow up on growing
  let followUpStem: null | Phytomer = null;
  const ensureFollowUpStem = () => {
    if (followUpStem === null) {
      followUpStem = createPhytomer({
        ...phytomer,
        buds: [],
        leaves: [],
        children: [],
        differentiation: meristem.state.type,
        meristem: out.phytomer.meristem,
      });
      out.phytomer.meristem = null; // moved to new follow up
    }
  }

  const createLeaf = (relativeDirection: RelativeVector | undefined, relativeNormal: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, phytomer);

    const normal: Vector =
      relativeNormal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeNormal, phytomer);

    ensureFollowUpStem();

    out.phytomer.leaves.push({
      size: 0.05,
      orientation: createLeafOrientation({
        normal,
        direction,
      })
    });
  }

  const createBud = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, phytomer);

    ensureFollowUpStem();

    out.phytomer.buds.push({
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
    });
  }

  const createStem = (meristemState: MeristemState, relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeDirection, phytomer);

    // TODO: Memoize
    const unitDirection = new Vector3();

    unitDirection.set(...direction)
    unitDirection.normalize();
    const newMeristemDirection = toVector(unitDirection);

    const growthFrame = makeGrowthFrameFromDirection(
      meristemPosition,
      newMeristemDirection,
    );
    const transform = new Matrix4;
    transform.copy(growthFrame.matrix)

    ensureFollowUpStem();

    createPhytomer({
      ...phytomer,
      transform,
      buds: [],
      leaves: [],
      children: [],
      differentiation: meristem.state.type,
      meristem: { state: meristemState }
    })
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

  return out
}

/**
 * Apply gravity to a node, called from a growth2 behavior
 */
function nodeGravityKernel(
  context: EvalContext,
  growthModel: GrowthModel,
  phytomer: Phytomer,
  _phytomerIndex: number,
  parentTransform: Matrix4 | null,
): Matrix4 {
  // TODO: Memoize
  const localUp = new Vector3();
  const prevNode = new Vector3();
  const node = new Vector3();
  const diff = new Vector3();
  const rotationAxis = new Vector3();
  //const invWorldFromPrevNode = new Matrix4();

  const m = new Matrix4();
  if (parentTransform === null) {
    return m;
  }

  //invWorldFromPrevNode.copy(parentTransform);
  //invWorldFromPrevNode.invert();
  localUp.set(0, 1, 0)
  //localUp.applyMatrix4(invWorldFromPrevNode);

  prevNode.set(...getPhytomerPosition({ transform: parentTransform }));
  node.set(...getPhytomerPosition(phytomer));
  diff.subVectors(node, prevNode);
  const phytomerLength = diff.length();
  diff.normalize();

  rotationAxis.crossVectors(localUp, diff);
  if (rotationAxis.lengthSq() < epsilonSq) {
    rotationAxis.set(Math.random() - 0.5, 0.0, Math.random() - 0.5);
  }
  rotationAxis.normalize();

  const angle = diff.angleTo(localUp);

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
