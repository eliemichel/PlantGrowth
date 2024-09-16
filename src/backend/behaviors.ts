/**
 * This is a pool of behavior implementations available for simulation.
 *
 * NB: When adding a new behavior, don't forget to add it to the 'behaviors'
 * registry at the end (it is the only variable that gets exported).
 */

import { Vector3, Matrix4 } from 'three'
import { type Vector } from '../utils/vector.ts'
import { toVector } from '../utils/vector3.ts'
import { Collection, deref } from '../utils/Collection.ts'

import {
  type Phytomer,
  type Leaf,
  type Plant,
} from '../models/SceneModel.ts'

import {
  type GrowthModel,
} from '../models/GrowthModel.ts'

import {
  type CreateLeafAction,
  type CreateBudAction,
  type CreateStemAction,
  type ReplaceStemAction,
} from '../models/growthActions.ts'

import {
  evalExpr,
  makeContext,
} from '../models/DSL.ts'

import * as Legacy from './legacyGrowth.ts'

import {
  relativeToWorldDirection,
  epsilonSq,
  makeGrowthFrameFromDirection,
  getPhytomerDirection,
  getPhytomerPosition,
  createLeafOrientation,
} from './growth.ts'

import {
  type Behavior,
  type EvalContext,
  type OrganogenesisMeristemHandlerOutput,
  BehaviorFlag,
} from './behaviorPipelines.ts'

/**
 * Grow a little bit any node of a plant.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growPhytomerKernel(
  context: EvalContext,
  growthModel: GrowthModel,
  phytomer: Phytomer,
  _phytomerIndex: number,
  parentTransform: Matrix4 | null
): Vector {
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

    merismaticGrowth.set(...getPhytomerDirection(phytomer));
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
    differentiation: phytomer.differentiation.type,
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
function growLeafKernel(context: EvalContext, growthModel: GrowthModel, phytomer: Phytomer, leafIndex: number): Leaf {
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
function growNewOrgansKernel(
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
        meristem: out.phytomer.meristem,
      });
      out.phytomer.meristem = null; // moved to new follow up
    }
  }

  const createLeaf = (action: CreateLeafAction) => {
    const direction: Vector =
      action.direction === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(action.direction, phytomer);

    const normal: Vector =
      action.normal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(action.normal, phytomer);

    ensureFollowUpStem();

    out.phytomer.leaves.push({
      size: 0.05,
      orientation: createLeafOrientation({
        normal,
        direction,
      })
    });
  }

  const createBud = (action: CreateBudAction) => {
    const direction: Vector =
      action.direction === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(action.direction, phytomer);

    ensureFollowUpStem();

    out.phytomer.buds.push({
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
    });
  }

  const createStem = (action: CreateStemAction) => {
    const {
      thickness,
      stemType,
      differentiation,
      meristemState,
      direction,
    } = action;

    const worldDirection: Vector =
      direction === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(direction, phytomer);

    // TODO: Memoize
    const unitDirection = new Vector3();

    unitDirection.set(...worldDirection)
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
      thickness,
      type: stemType,
      transform,
      buds: [],
      leaves: [],
      children: [],
      differentiation,
      meristem: { state: meristemState }
    })
  }

  const replaceStem = (action: ReplaceStemAction) => {
    const {
      thickness,
      stemType,
      differentiation,
    } = action;

    // TODO: Avoid creating a new phytomer when the current phytomer has zero
    // length.
    ensureFollowUpStem();

    console.assert(followUpStem !== null)
    if (followUpStem === null) return;

    followUpStem.thickness = thickness;
    followUpStem.type = stemType;
    followUpStem.differentiation = differentiation;
  }

  for (const action of meristemActions) {
    switch (action.type) {
    case 'create-leaf':
      createLeaf(action);
      break;
    case 'create-bud':
      createBud(action);
      break;
    case 'create-stem':
      createStem(action);
      break;
    case 'replace-stem':
      replaceStem(action);
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
    differentiation: phytomer.differentiation.type,
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

/**
 * This behavior does not grow any node, but rather modifies each phytomer's
 * type and thickness.
 */
function secondaryGrowPhytomerKernel(
  _context: EvalContext,
  growthModel: GrowthModel,
  phytomer: Phytomer,
  _phytomerIndex: number,
  _parentTransform: Matrix4 | null
): Phytomer {

  const [ newDifferentiation, actions ] = growthModel.differentiationStateTransition(phytomer.differentiation);

  const nextPhytomer = {
    ...phytomer,
    differentiation: newDifferentiation,
  }

  for (const action of actions) {
    switch (action.type) {
    case "grow-lignin":
      nextPhytomer.type = 'bark';
      break;
    case "grow-thickness":
      nextPhytomer.thickness += action.increment;
      break;
    }
  }

  return nextPhytomer;
}

function secondaryGrowPlantKernel(
  _context: EvalContext,
  _growthModel: GrowthModel,
  plant: Plant,
): Plant {
  return {
    ...plant,
    thickness: deref(plant.shoot)?.thickness ?? plant.thickness,
  };
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
    handlePhytomer: growPhytomerKernel,
    handleLeaf: growLeafKernel,
  },

  organogenesis: {
    name: 'organogenesis',
    flags: BehaviorFlag.None,
    type: 'organogenesis',
    handlePhytomer: growNewOrgansKernel,
  },

  gravity: {
    name: 'gravity',
    flags: BehaviorFlag.None,
    type: 'growth2',
    handlePhytomer: nodeGravityKernel,
  },

  secondaryGrowth: {
    name: 'secondary growth',
    flags: BehaviorFlag.None,
    type: 'map',
    handlePlant: secondaryGrowPlantKernel,
    handlePhytomer: secondaryGrowPhytomerKernel,
    handleLeaf: undefined,
  },
};

export default behaviors;
