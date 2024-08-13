import { create } from 'zustand'
import { type SimulationModel, createInitialScene } from '../models/SimulationModel.tsx'
import { type NodeGraphModel, createInitialNodeGraph } from '../models/NodeGraphModel.tsx'

interface AppModel {

	// Data

	scene: SimulationModel,

	nodeGraph: NodeGraphModel,

	// Actions

	setScene: (scene: SimulationModel) => void,

	setNodeGraph: (nodeGraph: NodeGraphModel) => void,
}

export const useAppStore = create<AppModel>()(set => ({
	// Data

	scene: createInitialScene(),
	nodeGraph: createInitialNodeGraph(),

	// Actions

	setScene: (scene: SimulationModel) => set({ scene }),
	setNodeGraph: (nodeGraph: NodeGraphModel) => set({ nodeGraph }),
}))
