import { createReducerContext } from '../utils/createReducerContext.tsx'
import { concatAll } from '../utils/basics.tsx'
import { Vector, distance } from '../utils/vector.tsx'
import { Branch, Leaf, SimulationModel, GrowthModel, Bud } from '../models/SimulationModel.tsx'

export function createInitialScene(): SimulationModel {
  return {
    growthModels: [
      {
        maxInternodeLength: 0.2,
        maxNodesPerAxis: 6,
      },
      {
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

// This returns a list of branches because a given branch may turn into
// multiple ones.
function growBranch(model: SimulationModel, branch: Branch): Branch[] {
  const growthModel = model.growthModels[branch.growthModelIndex];
  
  const l = branch.points.length;
  if (!branch.active || l === 0) return [ branch ];

  // Primary growth: the tip of the stem grows vertically + some randomness
  const lastPoint = branch.points[l - 1];
  const newLastPoint: Vector = [
    lastPoint[0] + 0.05 * (Math.random() - 0.5),
    lastPoint[1] + 0.05,
    lastPoint[2] + 0.05 * (Math.random() - 0.5),
  ];

  // Add a new segment if needed
  let replaceLastPoint = true;
  let newBuds: Bud[] = [];
  if (l > 1) {
    const prevPoint = branch.points[l - 2];
    const dist = distance(newLastPoint, prevPoint);
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
    newLastPoint
  ];

  // Branching: split long branches
  let active = true;
  const extraBranches: Branch[] = [];
  if (newPoints.length - 1 > growthModel.maxNodesPerAxis) {
    active = false;

    const lastPoint = newPoints[newPoints.length - 1];

    extraBranches.push({
      ...branch,
      active: true,
      points: [
        lastPoint,
        lastPoint,
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

    extraBranches.push({
      ...branch,
      active: true,
      points: [
        lastPoint,
        lastPoint,
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
