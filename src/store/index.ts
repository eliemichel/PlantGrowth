import { create } from 'zustand'

import mainSlice, { type MainState, type MainSlice } from './mainSlice.ts'
import selectionSlice, { type SelectionState, type SelectionSlice } from './selectionSlice.ts'

// Data storage for the whole application
export type AppState = SelectionState & MainState;

// Main store type
export type AppModel = SelectionSlice & MainSlice;

export const useStore = create<AppModel>()((...a) => ({
	...selectionSlice(...a),
	...mainSlice(...a),
}))
