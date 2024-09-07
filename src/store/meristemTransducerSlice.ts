import { type StateCreator } from 'zustand'
import { produce, type Draft } from 'immer'

import { type MainState } from './mainSlice.ts'
import { compileMeristemTransducer } from '../backend/meristemTransducerNodeGraphLib.ts'

export type MeristemTransducerState = {
	foo: number,
};

export type MeristemTransducerFunctions = {
	test: () => void,
};

export type MeristemTransducerSlice = MeristemTransducerState & MeristemTransducerFunctions;

function createDefaultState(): MeristemTransducerState {
	return {
		foo: 0,
	}
}

type MeristemTransducerSliceCreator = StateCreator<
	MeristemTransducerState & MainState, // what we can get()
	[],
	[],
	MeristemTransducerSlice // what we define in this slice
>

const createMeristemTransducerSlice: MeristemTransducerSliceCreator = (set, get) => {

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
			imset(draft => { ++draft.foo; })
		},

	}
}

export default createMeristemTransducerSlice;
