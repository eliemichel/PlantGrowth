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

function growBranch(branch) {
  const l = branch.points.length;
  if (!branch.active || l === 0) return branch;
  const lastPoint = branch.points[l - 1];
  const newLastPoint = [
    lastPoint[0],
    lastPoint[1] + 1.05,
    lastPoint[2],
  ];
  return {
    ...branch,
    points: [
      ...branch.points.slice(0, l - 1),
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
