import { type AppModel } from '../models/AppModel.tsx'
import { type SimulationModel, createInitialScene } from '../models/SimulationModel.tsx'
import { type NodeGraphModel, createInitialNodeGraph } from '../models/NodeGraphModel.tsx'
import { createReducerContext } from '../utils/createReducerContext.tsx'

function createInitialApp(): AppModel {
  return {
    scene: createInitialScene(),
    nodeGraph: createInitialNodeGraph(),
  }
}

type AppAction =
  | { type: 'set-scene', scene: SimulationModel }
  | { type: 'set-node-graph', nodeGraph: NodeGraphModel }

export function appReducer(state: AppModel, action: AppAction): AppModel {
  switch (action.type) {
  case 'set-scene':
    return {
      ...state,
      scene: action.scene,
    }
  case 'set-node-graph':
    return {
      ...state,
      nodeGraph: action.nodeGraph,
    }
  }
}

export const [
  useApp,
  useAppDispatch,
  AppProvider
] = createReducerContext(appReducer, createInitialApp());
