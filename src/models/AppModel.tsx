import { type NodeGraphModel } from './NodeGraphModel.tsx'
import { type SimulationModel } from './SimulationModel.tsx'

export type AppModel = {
	scene: SimulationModel,
	nodeGraph: NodeGraphModel,
}
