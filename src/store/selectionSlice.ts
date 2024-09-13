import { type StateCreator } from 'zustand'
import { produce, type Draft } from 'immer'

import { type SelectionModel, createDefaultSelection } from '../models/SelectionModel.ts'
import { type ExpressionPath } from '../models/Path.ts'

export type SelectionState = {
	selection: SelectionModel,
};

export type SelectionFunctions = {
	setActiveExpression: (path: ExpressionPath, name: string) => void,
	setActiveGrowthModel: (growthModelIndex: number) => void,
};

export type SelectionSlice = SelectionState & SelectionFunctions;

function createDefaultState(): SelectionState {
	return {
		selection: createDefaultSelection(),
	}
}

type SelectionSliceCreator = StateCreator<
	SelectionState, // what we can get()
	[],
	[],
	SelectionSlice // what we define in this slice
>

const createSelectionSlice: SelectionSliceCreator = (set) => {

	// Typed immer set
	function imset(receipe: (draft: Draft<SelectionSlice>) => void) {
		set(produce(receipe))
	}

	return {

		...createDefaultState(),
		
		setActiveExpression: (path: ExpressionPath, name: string) => {
			imset(state => { state.selection.activeExpr = { path, name } })
		},

		setActiveGrowthModel: (growthModelIndex: number) => {
			imset(state => { state.selection.activeGrowthModelIndex = growthModelIndex })
		},

	}
}

export default createSelectionSlice;
