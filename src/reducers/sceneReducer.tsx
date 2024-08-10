import { createReducerContext } from '../utils/createReducerContext.tsx'
import { Vector } from '../utils/vector.tsx'
import { Vector3, Matrix4 } from 'three'
import {
  type Branch,
  type Leaf,
  type SimulationModel,
  type GrowthModel,
  type BranchRef,
  type RelativeVector,
  createDefaultGrowthModel,
  createDefaultMeristemState,
} from '../models/SimulationModel.tsx'
import { Environment, createDefaultEnvironment } from '../models/EnvironmentModel.tsx'
import { toVector } from '../utils/vector3.tsx'
import {
  evalExpr,
  makeContext,
} from '../models/DSL.tsx'
import { growBranch } from './legacyGrowth.tsx'
import { relativeToWorldDirection, epsilonSq } from './growth.tsx'
import { applyBehavior, type Behavior } from './behaviors.tsx'

export function createInitialScene(): SimulationModel {
  return {
    environment: createDefaultEnvironment(),
    leafColor: '#88ff00',
    growthModels: [
      createDefaultGrowthModel(),
      {
        ...createDefaultGrowthModel(),
        maxInternodeLength: 0.5,
        maxNodesPerAxis: 2,
      },
    ],

    plants: [
      {
        shoot: 0,
      },
      {
        shoot: 1,
      },
    ],

    branches: [
      {
        growthModelIndex: 0,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ 0.05, 0.1, -0.02 ],
          [ 0.03, 0.5, -0.03 ],
        ],
        leaves: [
          {
            anchor: 0,
            size: 0.3,
            normal: [ 0.3, 1.0, -0.1 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
          {
            anchor: 1,
            size: 0.2,
            normal: [ 0.0, 1.0, 1.0 ],
            direction: [ -1.0, 0.0, 0.0 ]
          },
        ],
        buds: [
          {
            anchor: 1,
            size: 0.3,
            direction: [ 0.3, 1.0, -0.1 ],
            differentiation: "dormant",
            age: 0,
          },
        ],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
      {
        growthModelIndex: 1,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ -0.02, 0.2, 0.05 ],
        ],
        leaves: [
          {
            anchor: 0,
            size: 0.4,
            normal: [ 0.0, 1.0, 0.0 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
        ],
        buds: [],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
    ],
  }
}

function createTestScene(sceneIndex: number): SimulationModel {
  switch (sceneIndex) {
    case 0: {
      return {
        leafColor: '#a349a4',
        environment: createDefaultEnvironment(),
        growthModels: [
          createDefaultGrowthModel(),
        ],

        plants: [
          {
            shoot: 0,
          },
        ],

        branches: [
          {
            growthModelIndex: 0,
            active: true,
            points: [
              [ 0, 0, 0 ],
              [ 0, 0.1, 0 ],
            ],
            leaves: [],
            buds: [],
            children: [],
            meristemState: createDefaultMeristemState(),
          },
        ],
      }
    }
    default: {
      return createInitialScene();
    }
  }
};

// Auxiliary types and functions for growBranch

/**
 * Grow a little bit any node of a plant.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growNode(growthModel: GrowthModel, branch: Branch, nodeIndex: number): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const cellElongation = new Vector3();
  const merismaticGrowth = new Vector3();
  const total = new Vector3();

  // 1. Merismatic growth
  // Each meristem grows its stem by a fixed amount.

  const isLastNode = nodeIndex == branch.points.length - 2;
  if (branch.active && isLastNode) {
    prevNode.set(...branch.points[nodeIndex]);
    node.set(...branch.points[nodeIndex + 1]);
    merismaticGrowth.subVectors(node, prevNode);
    if (merismaticGrowth.length() < 1e-4 && nodeIndex > 0) {
      prevNode.set(...branch.points[nodeIndex - 1]);
      node.set(...branch.points[nodeIndex + 1]);
      merismaticGrowth.subVectors(node, prevNode);
    }
    merismaticGrowth.normalize();
    merismaticGrowth.multiplyScalar(growthModel.merismaticGrowthLength);
  } else {
    merismaticGrowth.set(0, 0, 0);
  }

  // 2. Cell elongation.
  // Each phytomer gets scaled (i.e., it grows by an amount relative to its
  // current size). Scaling depends on the flexibility of the phytomer (for now
  // it is binary, namely 0 for inactive branches, constant for active
  // branches)

  prevNode.set(...branch.points[nodeIndex]);
  node.set(...branch.points[nodeIndex + 1]);
  cellElongation.subVectors(node, prevNode);
  
  const ctx = makeContext("phytomer", {
    length: cellElongation.length(),
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
    return [0,0,0];
  }
  const rate = maybeRate.result;

  cellElongation.multiplyScalar(rate);

  total.set(0, 0, 0);
  total.add(merismaticGrowth);
  total.add(cellElongation);
  return toVector(total);
}

/**
 * Grow a little bit a given leaf, given the growth model's leafGrowthRate
 */
function growLeaf(growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf {
  const leaf = branch.leaves[leafIndex];

  const ctx = makeContext("leaf", {
    size: leaf.size,
  });

  const maybeRate = evalExpr(growthModel.leafGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
    return {...leaf};
  }
  const rate = maybeRate.result;

  return {
    ...leaf,
    size: leaf.size * (1.0 + rate),
  }
}

/**
 * Model of merismatic activity that generates new organs
 */
function growNewOrgans(
  growthModel: GrowthModel,
  branch: Branch,
  _nextBranchRef: BranchRef,
): Branch[] {

  const [ nextMeristemState, meristemActions ] = growthModel.meristemStateTransition(branch.meristemState);

  const nextBranch = {
    ...branch,
    meristemState: nextMeristemState,
    points: [...branch.points],
    leaves: [...branch.leaves],
    buds: [...branch.buds],
    // TODO: add other members that need to be deeply copied
  };

  const meristemAnchor = branch.points.length - 2;
  const meristemPosition = branch.points[branch.points.length - 1];

  const newBranches: Branch[] = [];

  const createLeaf = (relativeDirection: RelativeVector | undefined, relativeNormal: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branch.points);

    const normal: Vector =
      relativeNormal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeNormal, branch.points);

    nextBranch.leaves.push({
      anchor: meristemAnchor,
      size: 0.05,
      normal,
      direction,
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.points.length - 2) {
      nextBranch.points.push(nextBranch.points[nextBranch.points.length - 1]);
    }
  }

  const createBud = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branch.points);

    nextBranch.buds.push({
      anchor: meristemAnchor,
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.points.length - 2) {
      nextBranch.points.push(nextBranch.points[nextBranch.points.length - 1]);
    }
  }

  const createStem = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeDirection, branch.points);

    // TODO: Memoize
    const secondPoint = new Vector3();
    const unitDirection = new Vector3();

    secondPoint.set(...meristemPosition);
    unitDirection.set(...direction)
    unitDirection.normalize();
    unitDirection.multiplyScalar(0.1); // TODO: unhardcode
    secondPoint.add(unitDirection);

    newBranches.push({
      ...nextBranch,
      active: true,
      points: [
        [...meristemPosition],
        toVector(secondPoint),
      ],
      buds: [],
      leaves: [],
      children: [],
    });
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
      createStem(action.direction);
      break;
    }
  }

  return [ nextBranch, ...newBranches ];
}

/**
 * Apply gravity to a node, called from a growth2 behavior
 */
function nodeGravityKernel(growthModel: GrowthModel, branch: Branch, nodeIndex: number): Matrix4 {
  // TODO: Memoize
  const up = new Vector3( 0, 1, 0 );
  const m = new Matrix4();
  const prevNode = new Vector3();
  const node = new Vector3();
  const diff = new Vector3();
  const rotationAxis = new Vector3();

  prevNode.set(...branch.points[nodeIndex]);
  node.set(...branch.points[nodeIndex + 1]);
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
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
  } else {
    const rate = maybeRate.result;
    if (rate > 0) {
      deltaAngle = -angle * 0.02;
    }
  }

  
  m.makeRotationAxis(rotationAxis, deltaAngle);
  return m;
}

const behaviors: { [key: string]: Behavior } = {
  legacy: {
    type: 'organogenesis',
    handleBranch: growBranch,
  },

  growth: {
    type: 'growth',
    handleNode: growNode,
    handleLeaf: growLeaf,
  },

  organogenesis: {
    type: 'organogenesis',
    handleBranch: growNewOrgans,
  },

  gravity: {
    type: 'growth2',
    handleNode: nodeGravityKernel,
  },
}

type SceneAction =
  | { type: 'step-legacy'; stepCount: number }
  | { type: 'step-growth'; stepCount: number }
  | { type: 'step-organogenesis'; stepCount: number }
  | { type: 'step-gravity'; stepCount: number }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'set-growth-model', index: number, model: GrowthModel }
  | { type: 'set-environment', environment: Environment }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-legacy': {
      return applyBehavior(state, behaviors.legacy, { repeat: action.stepCount });
    }

    case 'step-growth': {
      return applyBehavior(state, behaviors.growth, { repeat: action.stepCount });
    }

    case 'step-organogenesis': {
      return applyBehavior(state, behaviors.organogenesis, { repeat: action.stepCount });
    }

    case 'step-gravity': {
      return applyBehavior(state, behaviors.gravity, { repeat: action.stepCount });
    }

    case 'set-initial-scene': {
      return createInitialScene();
    }

    case 'set-test-scene': {
      return createTestScene(action.index);
    }

    case 'set-growth-model': {
      return {
        ...state,
        growthModels: state.growthModels.map((model, idx) => idx == action.index ? action.model : model),
      }
    }

    case 'set-environment': {
      return {
        ...state,
        environment: action.environment,
      }
    }

    default: {
      throw Error('Unknown scene action: ' + JSON.stringify(action));
    }
  }
}

export const [
  useScene,
  useSceneDispatch,
  SceneProvider
] = createReducerContext(sceneReducer, createInitialScene());
