import { createReducerContext } from '../utils/createReducerContext.tsx'

type Leaf = {
  anchor: number[],
  size: string,
  normal: number[],
}

type Point = number[]

type Branch = {
  active: bool,
  points: Point[],
  leaves: Leaf[],
}

type SimulationModel = {
  instanceCount: number,
  branches: Branch[],
}

export function createInitialScene(): SimulationModel {
  return {
    instanceCount: 8,

    branches: [
      {
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
          },
          {
            anchor: [ 0.5, 0.2, 0.2 ],
            size: 0.2,
            normal: [ -0.3, 1.0, 0.0 ],
          },
        ],
      },
      {
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
          },
        ],
      },
    ],
  }
}

function subtract(a, b) {
  return [
    a[0] - b[0],
    a[1] - b[1],
    a[2] - b[2],
  ]
}

function dot(a, b) {
  return (
    a[0] * b[0] +
    a[1] * b[1] +
    a[2] * b[2]
  )
}

function distance(a, b) {
  const d = subtract(a, b);
  return Math.sqrt(dot(d, d));
}

// This returns a list of branches because a given branch may turn into
// multiple ones.
function growBranch(branch) {
  const MAX_SEGMENT_LENGTH = 0.2;
  const MAX_BRANCH_SEGMENT_COUNT = 6;

  const l = branch.points.length;
  if (!branch.active || l === 0) return [ branch ];

  const lastPoint = branch.points[l - 1];
  const newLastPoint = [
    lastPoint[0] + 0.05 * (Math.random() - 0.5),
    lastPoint[1] + 0.05,
    lastPoint[2] + 0.05 * (Math.random() - 0.5),
  ];

  // Add a new segment if needed
  let replaceLastPoint = true;
  if (l > 1) {
    const prevPoint = branch.points[l - 2];
    const dist = distance(newLastPoint, prevPoint);
    if (dist > MAX_SEGMENT_LENGTH) {
      replaceLastPoint = false;
    }
  }

  const newPoints = [
    ...(replaceLastPoint ? branch.points.slice(0, l - 1) : branch.points),
    newLastPoint
  ];

  // Split long branches
  let active = true;
  const extraBranches = [];
  if (newPoints.length - 1 > MAX_BRANCH_SEGMENT_COUNT) {
    active = false;

    const lastPoint = newPoints[newPoints.length - 1];

    extraBranches.push({
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
        },
      ],
    });

    extraBranches.push({
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
    },
    ...extraBranches,
  ];
}

export function sceneReducer(state, action) {
  console.log("Scene action:", action);
  switch (action.type) {
    case 'set-instance-count': {
      return {
        ...state,
        instanceCount: action.instanceCount
      };
    }
    case 'step-simulation': {
      let newState = state;
      for (let i = 0 ; i < action.stepCount ; ++i) {
        newState = {
          branches: [].concat(...newState.branches.map(growBranch)),
        };
      }
      return {
        ...state,
        instanceCount: state.instanceCount + 1,
        ...newState,
      };
    }
    case 'test-leaf': {
      const moveLeaf = leaf => ({
        ...leaf,
        anchor: [ leaf.anchor[0], leaf.anchor[1] + 0.05, leaf.anchor[2] ],
      })
      const moveFirstLeaf = branch => ({
        ...branch,
        leaves: branch.leaves.map((l, idx) => idx == 0 ? moveLeaf(l) : l),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstLeaf(b) : b),
      }
    }
  case 'test-branch': {
      const movePoint = pt => [
        pt[0], pt[1], pt[2] + 0.05
      ]
      const moveFirstPoint = branch => ({
        ...branch,
        points: branch.points.map((pt, idx) => idx == 0 ? movePoint(pt) : pt),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstPoint(b) : b),
      }
    }
    default: {
      throw Error('Unknown scene action: ' + action.type);
    }
  }
}

export const [
  useScene,
  useSceneDispatch,
  SceneProvider
] = createReducerContext(sceneReducer, createInitialScene());
