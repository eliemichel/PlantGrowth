import { expect } from 'vitest'

import {
	type GrowthModel,
	type MeristemStateDataFieldType,
	type MeristemStateType,
	type MeristemState,
	type Transducer,
} from '../models/GrowthModel.ts'

export function buildStateTypeLut(stateTypes: MeristemStateType[]) {
	const stateTypeLut: { [key: string]: MeristemStateDataFieldType[] } = {};
	// Check for duplicate types
	for (const type of stateTypes) {
		expect(type.name in stateTypeLut).toBe(false)
		stateTypeLut[type.name] = type.dataFields;
	}
	return stateTypeLut;
}

export function validateState(
	state: MeristemState,
	stateTypeLut: { [key: string]: MeristemStateDataFieldType[] },
	context: string,
) {
	// Check returned meristem
	expect(state.type in stateTypeLut, `State has illegal type '${state.type}'; expected one of [${Object.keys(stateTypeLut).join(", ")}] (in transducer ${context})`).toBe(true);
	const remainingFields = new Set<string>();
	const fieldTypeLut: { [key: string]: MeristemStateDataFieldType['type'] } = {};
	for (const entry of stateTypeLut[state.type]) {
		remainingFields.add(entry.name);
		fieldTypeLut[entry.name] = entry.type;
	}
	for (const [ key, value ] of Object.entries(state.data)) {
		expect(remainingFields.delete(key)).toBe(true);
		expect(typeof value).toBe(fieldTypeLut[key]);
	}
	// Check that all expected fields were found
	expect(remainingFields.size, `Missing fields in state of type '${state.type}': [${Array.from(remainingFields).join(', ')}] (in transducer ${context})`).toBe(0);
}

// NB: This is not templated over MersitemState because DifferentiationState is
// just an alias to the same type.
export function validateTransducer<Action>(
	stateTypes: MeristemStateType[],
	transducer: Transducer<MeristemState,Action>,
	context: string,
) {
	const stateTypeLut = buildStateTypeLut(stateTypes);

	// Check that a state with this type can be handled
	// NB: This is not a static analysis that fully covers all state
	// transition branchings
	for (const type of stateTypes) {
		// Create mock meristem state
		const state: MeristemState = {
			type: type.name,
			data: {}
		}
		for (const entry of type.dataFields) {
			state.data[entry.name] = (() => {
				switch (entry.type) {
				case 'number':
					return 0;
				case 'boolean':
					return true;
				}
			})();
		}

		// Run transition
		const [ newState, _actions ] = transducer(state);

		// Check returned meristem
		validateState(newState, stateTypeLut, context);
	}
}

export function validateGrowthModel(growthModel: GrowthModel) {
	validateTransducer(
		growthModel.meristemStateTypes,
		growthModel.meristemStateTransition,
		"meristemTransducer"
	);

	validateTransducer(
		growthModel.differentiationStateTypes,
		growthModel.differentiationStateTransition,
		"differentiationTransducer"
	);
}
