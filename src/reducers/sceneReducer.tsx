import { createReducerContext } from '../utils/createReducerContext.tsx'

export const createInitialScene = () => ({
  instanceCount: 8,
});

export function sceneReducer(state, action) {
  console.log("Scene action:", action);
  switch (action.type) {
    case 'set-instance-count': {
      return {
        ...state,
        instanceCount: action.instanceCount
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
