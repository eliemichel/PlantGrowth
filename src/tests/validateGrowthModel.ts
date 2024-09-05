import { expect } from 'vitest'

import {
	type GrowthModel,
	type MeristemStateDataFieldType,
	type MeristemState,
} from '../models/GrowthModel.tsx'

export function validateGrowthModel(growthModel: GrowthModel) {
	const meristemStateTypeLut: { [key: string]: MeristemStateDataFieldType[] } = {};
	// Check for duplicate types
	for (const type of growthModel.meristemStateTypes) {
		expect(type.name in meristemStateTypeLut).toBe(false)
		meristemStateTypeLut[type.name] = type.dataFields;
	}

	// Check that a meristem state with this type can be handled
	// NB: This is not a static analyusis that fully covers all state
	// transition branchings
	for (const type of growthModel.meristemStateTypes) {
		// Create mock meristem state
		const meristemState: MeristemState = {
			type: type.name,
			data: {}
		}
		for (const entry of type.dataFields) {
			meristemState.data[entry.name] = (() => {
				switch (entry.type) {
				case 'number':
					return 0;
				case 'boolean':
					return true;
				}
			})();
		}

		// Run transition
		const [ newMeristemState, _actions ] = growthModel.meristemStateTransition(meristemState);

		// Check returned meristem
		expect(newMeristemState.type in meristemStateTypeLut).toBe(true);
		const remainingFields = new Set<string>();
		const fieldTypeLut: { [key: string]: MeristemStateDataFieldType['type'] } = {};
		for (const entry of meristemStateTypeLut[newMeristemState.type]) {
			remainingFields.add(entry.name);
			fieldTypeLut[entry.name] = entry.type;
		}
		for (const [ key, value ] of Object.entries(newMeristemState.data)) {
			expect(remainingFields.delete(key)).toBe(true);
			expect(typeof value).toBe(fieldTypeLut[key]);
		}
		// Check that all expected fields were found
		expect(remainingFields.size, `Missing fields in state of type '${newMeristemState.type}': [${Array.from(remainingFields).join(', ')}]`).toBe(0);
	}
}
