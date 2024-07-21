import { createReducerContext } from '../utils/createReducerContext.tsx'
import { concatAll } from '../utils/basics.tsx'
import { Vector } from '../utils/vector.tsx'
import { Matrix4, Vector3 } from 'three'
import { Branch, Leaf, SimulationModel, GrowthModel, Bud, createDefaultGrowthModel } from '../models/SimulationModel.tsx'

export function createInitialScene(): SimulationModel {
  return {
    growthModels: [
      createDefaultGrowthModel(),
      {
        ...createDefaultGrowthModel(),
        maxInternodeLength: 0.5,
        maxNodesPerAxis: 2,
      },
    ],

    branches: [
      {
        growthModelIndex: 0,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ -0.02, 0.2, 0.05 ],
        ],
        leaves: [
          {
            anchor: [ 0.0, 0.5, 0.0 ],
            size: 0.3,
            normal: [ 0.3, 1.0, -0.1 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
          {
            anchor: [ 0.5, 0.2, 0.2 ],
            size: 0.2,
            normal: [ 0.0, 1.0, 1.0 ],
            direction: [ -1.0, 0.0, 0.0 ]
          },
        ],
        buds: [
          {
            anchor: [ 0.0, 0.5, 0.0 ],
            size: 0.3,
            direction: [ 0.3, 1.0, -0.1 ],
          },
        ],
      },
      {
        growthModelIndex: 1,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ 0.05, 0.1, -0.02 ],
          [ 0.03, 0.5, -0.03 ],
        ],
        leaves: [
          {
            anchor: [ 0.0, 0.2, 0.0 ],
            size: 0.4,
            normal: [ 0.0, 1.0, 0.0 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
        ],
        buds: [],
      },
    ],
  }
}

function createTestScene(sceneIndex: number): SimulationModel {
  switch (sceneIndex) {
    case 0: {
      return {
        growthModels: [
          createDefaultGrowthModel(),
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
          },
        ],
      }
    }
    default: {
      return createInitialScene();
    }
  }
};

// Auxiliary functions for growBranch

const epsilon = 1e-8;
const epsilonSq = epsilon * epsilon;

/**
 * Build the local frame at the tip of the branch.
 * 
 * X: Amphitonic direction (orthogonal to the branch and
 *    horizontal, the one such that XYZ is a direct frame).
 * 
 * Y: Epitonic direction (orthogonal to the branch, as close to up as
 *    possible).
 * 
 * Z: Apical growth direction.
 * 
 * Warning: This function uses memoization to save up memory, do not use its
 * first return value after calling makeGrowthFrame a second time.
 */
function makeGrowthFrame(branchPoints: Vector): Matrix4 {
  // TODO: Memoize
  const up = new Vector3(0, 1, 0);
  const amphitonic = new Vector3();
  const epitonic = new Vector3();
  const apical = new Vector3();
  const tip = new Vector3();
  const prev = new Vector3();
  const out = new Matrix4();

  // Apical direction goes along the branch
  const points = branchPoints;
  if (points.length > 1) {
    tip.set(...points[points.length - 1]);
    prev.set(...points[points.length - 2]);
    apical.subVectors(tip, prev);
    if (apical.lengthSq() < epsilonSq) {
      console.log('PROBLEM', points);
    }
    apical.normalize();
  } else {
    apical.copy(up);
    tip.set(0, 0, 0);
  }

  // Amphitonic direction is horizontal
  amphitonic.crossVectors(up, apical);
  if (amphitonic.lengthSq() < epsilonSq) {
    amphitonic.set(1,0,0); // TODO: hash tip position to get some randomness
  } else {
    amphitonic.normalize();
  }

  // Epitonic direction goes upward so we may need to flip
  epitonic.crossVectors(apical, amphitonic);
  epitonic.normalize();
  if (epitonic.dot(up) < 0.0) {
    epitonic.multiplyScalar(-1);
    amphitonic.multiplyScalar(-1);
  }

  console.log({ amphitonic, epitonic, apical });
  out.makeBasis(amphitonic, epitonic, apical);
  out.setPosition(tip);
  return out;
}

function toVector(pt: Vector3): Vector {
  return [ pt.x, pt.y, pt.z ];
}

/**
 * This returns a list of branches because a given branch may turn into
 * multiple ones.
 */
function growBranch(model: SimulationModel, branch: Branch): Branch[] {
  // TODO: Memoize
  const newLastPoint = new Vector3();
  const prevPoint = new Vector3();

  const growthModel = model.growthModels[branch.growthModelIndex];
  
  const l = branch.points.length;
  if (!branch.active || l === 0) return [ branch ];

  // Primary growth: the tip of the stem grows vertically + some randomness

  const growthFrame = makeGrowthFrame(branch.points);
  // In growth frame:
  newLastPoint.set(
    0.005 * (Math.random() - 0.5),
    0.005 * (Math.random() - 0.5),
    0.05,
  );
  // Convert to world frame:
  newLastPoint.applyMatrix4(growthFrame);

  const lastPoint = branch.points[l - 1];

  // Add a new segment if needed
  let replaceLastPoint = true;
  let newBuds: Bud[] = [];
  if (l > 1) {
    prevPoint.set(...branch.points[l - 2]);
    const dist = newLastPoint.distanceTo(prevPoint);
    if (dist > growthModel.maxInternodeLength) {
      replaceLastPoint = false;
      newBuds.push({
        anchor: lastPoint,
        size: 0.05,
        direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
      });
    }
  }

  const newPoints = [
    ...(replaceLastPoint ? branch.points.slice(0, l - 1) : branch.points),
    toVector(newLastPoint)
  ];

  // Branching: split long branches
  let active = true;
  const extraBranches: Branch[] = [];
  if (newPoints.length - 1 > growthModel.maxNodesPerAxis) {
    active = false;

    const newGrowthFrame = makeGrowthFrame(newPoints);
    // In growth frame:
    newLastPoint.set(
      Math.random() - 0.5,
      Math.random() - 0.5,
      0.1,
    );
    newLastPoint.normalize();
    newLastPoint.multiplyScalar(0.1);
    // Convert to world frame:
    newLastPoint.applyMatrix4(newGrowthFrame);

    const lastPoint = newPoints[newPoints.length - 1];

    extraBranches.push({
      ...branch,
      active: true,
      points: [
        lastPoint,
        toVector(newLastPoint),
      ],
      leaves: [
        {
          anchor: lastPoint,
          size: 0.05,
          normal: [ 0.0, 1.0, 0.0 ],
          direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
        },
      ],
    });

    // In growth frame:
    newLastPoint.set(
      Math.random() - 0.5,
      Math.random() - 0.5,
      0.1,
    );
    newLastPoint.normalize();
    newLastPoint.multiplyScalar(0.1);
    // Convert to world frame:
    newLastPoint.applyMatrix4(newGrowthFrame);

    extraBranches.push({
      ...branch,
      active: true,
      points: [
        lastPoint,
        toVector(newLastPoint),
      ],
      leaves: [],
    });
  }

  return [
    {
      ...branch,
      active,
      points: newPoints,
      buds: [...branch.buds, ...newBuds],
    },
    ...extraBranches,
  ];
}

type SceneAction =
  | { type: 'step-simulation'; stepCount: number }
  | { type: 'test-leaf' }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'test-branch' }
  | { type: 'set-growth-model', index: number, model: GrowthModel }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-simulation': {
      let newBranches = state.branches;
      for (let i = 0 ; i < action.stepCount ; ++i) {
        newBranches = concatAll(newBranches.map(b => growBranch(state, b)));
      }
      return {
        ...state,
        branches: newBranches,
      };
    }

    case 'set-initial-scene': {
      return createInitialScene();
    }

    case 'set-test-scene': {
      return createTestScene(action.index);
    }

    case 'test-leaf': {
      const moveLeaf: ((leaf: Leaf) => Leaf) = leaf => ({
        ...leaf,
        anchor: [ leaf.anchor[0], leaf.anchor[1] + 0.05, leaf.anchor[2] ],
      })
      const moveFirstLeaf: ((branch: Branch) => Branch) = branch => ({
        ...branch,
        leaves: branch.leaves.map((l, idx) => idx == 0 ? moveLeaf(l) : l),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstLeaf(b) : b),
      }
    }

    case 'test-branch': {
      const movePoint: ((pt: Vector) => Vector) = pt => [
        pt[0], pt[1], pt[2] + 0.05
      ]
      const moveFirstPoint: ((branch: Branch) => Branch) = branch => ({
        ...branch,
        points: branch.points.map((pt, idx) => idx == 0 ? movePoint(pt) : pt),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstPoint(b) : b),
      }
    }

    case 'set-growth-model': {
      return {
        ...state,
        growthModels: state.growthModels.map((model, idx) => idx == action.index ? action.model : model),
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
