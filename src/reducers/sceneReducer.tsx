export const createInitialScene = () => ({
  instanceCount: 8,
});

export function sceneReducer(state, action) {
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
