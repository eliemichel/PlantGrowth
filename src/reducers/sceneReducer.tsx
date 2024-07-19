import { createReducerContext } from '../utils/createReducerContext.tsx'

export const createInitialScene = () => ({
  instanceCount: 8,

  branches: [
    {
      active: true,
      points: [
        [ 0, 0, 0 ],
        [ -0.02, 0.2, 0.05 ],
      ]
    },
    {
      active: true,
      points: [
        [ 0, 0, 0 ],
        [ 0.05, 0.1, -0.02 ],
        [ 0.03, 0.5, -0.03 ],
      ]
    },
  ],
});

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

function growBranch(branch) {
  const l = branch.points.length;
  if (!branch.active || l === 0) return branch;
  const lastPoint = branch.points[l - 1];
  const newLastPoint = [
    lastPoint[0],
    lastPoint[1] + 0.05,
    lastPoint[2],
  ];

  let replaceLastPoint = true;
  // Disabling for now because our rendering component does not support dynamic changes of the number of vertices
  /*
  if (l > 1) {
    const prevPoint = branch.points[l - 2];
    const dist = distance(newLastPoint, prevPoint);
    const MAX_SEGMENT_LENGTH = 0.2;
    if (dist > MAX_SEGMENT_LENGTH) {
      replaceLastPoint = false;
    }
  }
  */

  return {
    ...branch,
    points: [
      ...(replaceLastPoint ? branch.points.slice(0, l - 1) : branch.points),
      newLastPoint
    ]
  };
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
      return {
        ...state,
        instanceCount: state.instanceCount + 1,
        branches: state.branches.map(growBranch),
      };
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
