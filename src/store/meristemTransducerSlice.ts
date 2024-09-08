import { type StateCreator } from 'zustand'
import { produce, type Draft } from 'immer'

import { type MainSlice } from './mainSlice.ts'

import {
	type OutputStateNode,
	type MeristemTransducerNodeGraph,
	isOutputStateNode,
	createInitialMeristemTransducerNodeGraph,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import {
	createMeristemTransducerNodeGraphFromStates,
	compileMeristemTransducer,
} from '../backend/meristemTransducerNodeGraphLib.ts'

import { LogLevel } from '../models/LogModel.ts'

export type MeristemTransducerState = {

	meristemTransducerNodeGraphs: { [growthModelIndex: number]: MeristemTransducerNodeGraph },

};

export type MeristemTransducerFunctions = {

	test: () => void,

	/**
	 * This returns the transducer node graph that corresponds to a growth
	 * model, and creates it if needed from the list of meristem states.
	 * /!\ Because this modifies the growthModel collection, it MUST NOT be
	 * called from a children of a GrowthModelSelector component.
	 */
	ensureMeristemTransducerNodeGraph: (growthModelIndex: number) => MeristemTransducerNodeGraph,

	/**
	 * Update the transducer node graph currently associated to a growth model.
	 * This calls ensureMeristemTransducerNodeGraph() so that the graph passed
	 * to the 'update' callback is always defined.
	 */
	setMeristemTransducerNodeGraph: (
		growthModelIndex: number,
		update: (currentNodeGraph: MeristemTransducerNodeGraph) => MeristemTransducerNodeGraph
	) => void,

	/**
	 * Update a given node of a transducer node graph.
	 */
	setOutputStateNodeData: (
		growthModelIndex: number,
		nodeId: string,
		update: (currentNodeData: OutputStateNode['data']) => OutputStateNode['data'],
	) => void,

};

export type MeristemTransducerSlice = MeristemTransducerState & MeristemTransducerFunctions;

function createDefaultState(): MeristemTransducerState {
	return {
		meristemTransducerNodeGraphs: {},
	}
}

type MeristemTransducerSliceCreator = StateCreator<
	MeristemTransducerSlice & MainSlice, // what we can get()
	[],
	[],
	MeristemTransducerSlice // what we define in this slice
>

const createMeristemTransducerSlice: MeristemTransducerSliceCreator = (set, get) => {

	// Utility to log errors
	function logError(message: string) {
		get().log(LogLevel.Error, message);
	}

	// Typed immer set
	function imset(receipe: (draft: Draft<MeristemTransducerState>) => void) {
		set(produce(receipe))
	}

	return {

		...createDefaultState(),

		test: () => {
			const growthModel = get().scene.growthModels.items[0];
			const nodeGraph = Object.values(get().meristemTransducerNodeGraphs)[0];
			const maybeTransducer = compileMeristemTransducer(nodeGraph, growthModel.meristemStateTypes);
			console.log(maybeTransducer);
		},

		// Results depends on growthModelIndex and meristemTransducerNodeGraphs
		ensureMeristemTransducerNodeGraph: (growthModelIndex: number) => {
			const growthModel = get().scene.growthModels.items[growthModelIndex];
			if (growthModel === undefined) {
				logError(`Trying to get meristem transducer for the non existing growth model #${growthModelIndex}!`);
				const newNodeGraph = createInitialMeristemTransducerNodeGraph();
				imset(store => { store.meristemTransducerNodeGraphs[growthModelIndex] = newNodeGraph });
				return newNodeGraph;
			}
			const nodeGraph = get().meristemTransducerNodeGraphs[growthModelIndex];
			if (nodeGraph === undefined) {
				const newNodeGraph = createMeristemTransducerNodeGraphFromStates(growthModelIndex, growthModel.meristemStateTypes);
				imset(store => { store.meristemTransducerNodeGraphs[growthModelIndex] = newNodeGraph });
				return newNodeGraph;
			}
			return nodeGraph;
		},

		setMeristemTransducerNodeGraph: (growthModelIndex: number, update: (currentNodeGraph: MeristemTransducerNodeGraph) => MeristemTransducerNodeGraph) => {
			const currentNodeGraph = get().ensureMeristemTransducerNodeGraph(growthModelIndex);
			imset(store => { store.meristemTransducerNodeGraphs[growthModelIndex] = update(currentNodeGraph) });
		},

		setOutputStateNodeData: (
			growthModelIndex: number,
			nodeId: string,
			update: (currentNodeData: OutputStateNode['data']) => OutputStateNode['data'],
		) => {
			get().setMeristemTransducerNodeGraph(growthModelIndex, produce(currentNodeGraph => {
				currentNodeGraph.nodes = currentNodeGraph.nodes.map(node => (
					node.id === nodeId && isOutputStateNode(node)
					? { ...node, data: update(node.data) }
					: node
				))
			}))
		},

	}
}

export default createMeristemTransducerSlice;
