import { type AppState } from '../store'
import { validateMainSlice } from './validateMainSlice.ts'
import { validateSelectionSlice } from './validateSelectionSlice.ts'

export function validateAppState(state: AppState) {
	validateMainSlice(state);
	validateSelectionSlice(state);
}
