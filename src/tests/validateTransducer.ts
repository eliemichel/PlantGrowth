import { expect } from 'vitest'
import {
	type Transducer,
	type State,
	type StateType,
	type StateDefinition,
	type StateDataFieldDefinition,
	type StateFilter,
	type Action,
	type ActionType,
	type ActionDefinition,
} from '../models/TransducerModel.ts'

import {
	type StateDefinitionLut,
	type ActionDefinitionLut,
} from '../backend/transducerLib.ts'

export function buildAndValidateStateDefinitionLut(
	stateDefinitions: StateDefinition[],
): StateDefinitionLut {
	const stateDefinitionLut: StateDefinitionLut = {};
	// Check for duplicate types
	for (const type of stateDefinitions) {
		expect(type.name in stateDefinitionLut).toBe(false)
		stateDefinitionLut[type.name] = type.dataFields;
	}
	return stateDefinitionLut;
}

export function buildAndValidateActionDefinitionLut(
	actionDefinitions: ActionDefinition[],
): ActionDefinitionLut {
	const stateDefinitionLut = new Set<ActionType>();
	// Check for duplicate types
	for (const type of actionDefinitions) {
		expect(stateDefinitionLut.has(type.name)).toBe(false)
		stateDefinitionLut.add(type.name);
	}
	return stateDefinitionLut;
}

export function buildState(stateDef: StateDefinition): State {
	const state: State = {
		type: stateDef.name,
		data: {}
	}
	for (const entry of stateDef.dataFields) {
		state.data[entry.name] = (() => {
			switch (entry.type) {
			case 'number':
				return 0;
			case 'boolean':
				return true;
			}
		})();
	}
	return state;
}

export function validateStateType(
	stateType: StateType,
	stateDefinitionLut: StateDefinitionLut,
	context?: string,
) {
	// Check returned meristem
	expect(
		stateType in stateDefinitionLut,
		[
			`State has illegal type '${stateType}'; expected one of`,
			`[${Object.keys(stateDefinitionLut).join(", ")}]`,
			`(in transducer ${context})`,
		].join(' ')
	).toBe(true);
}

export function validateState(
	state: State,
	stateDefinitionLut: StateDefinitionLut,
	context?: string,
) {
	// Check returned meristem
	validateStateType(state.type, stateDefinitionLut, context);
	const remainingFields = new Set<string>();
	const fieldTypeLut: { [key: string]: StateDataFieldDefinition['type'] } = {};
	for (const entry of stateDefinitionLut[state.type]) {
		remainingFields.add(entry.name);
		fieldTypeLut[entry.name] = entry.type;
	}
	for (const [ key, value ] of Object.entries(state.data)) {
		expect(remainingFields.delete(key), `Unexpected data field '${key}' in state of type ${state.type}`).toBe(true);
		expect(typeof value).toBe(fieldTypeLut[key]);
	}
	// Check that all expected fields were found
	expect(
		remainingFields.size,
		[
			`Missing fields in state of type '${state.type}':`,
			`[${Array.from(remainingFields).join(', ')}]`,
			`(in transducer ${context})`,
		].join(' ')
	).toBe(0);
}

export function validateAction(
	action: Action,
	actionDefinitionLut: ActionDefinitionLut,
	context?: string,
) {
	// Check returned meristem
	expect(
		actionDefinitionLut.has(action.type),
		[
			`Action has illegal type '${action.type}'; expected one of`,
			`[${Array.from(actionDefinitionLut).join(", ")}]`,
			`(in transducer ${context})`,
		].join(' ')
	).toBe(true);
}

export function validateStateFilter(
	stateFilter: StateFilter,
	stateDefinitionLut: StateDefinitionLut,
	context?: string,
) {
	const { type, condition } = stateFilter;
	validateStateType(type, stateDefinitionLut, `${context}, state filter`);
	if (condition) {
		// TODO: validate condition
	}
}

export default function validateTransducer(
	transducer: Transducer,
	context?: string,
) {
	const stateDefinitionLut = buildAndValidateStateDefinitionLut(transducer.states);
	const actionDefinitionLut = buildAndValidateActionDefinitionLut(transducer.actions);

	// TODO: check coverage of arrows
	let arrowIdx = 0;
	for (const arrow of transducer.arrows) {
		validateStateFilter(arrow.sourceStateFilter, stateDefinitionLut, `${context}, arrow #${arrowIdx})`)
		validateState(arrow.targetState, stateDefinitionLut, `${context}, arrow #${arrowIdx}`);
		
		arrow.actions.forEach((action, actionIdx) => {
			validateAction(action, actionDefinitionLut, `${context}, arrow #${arrowIdx}, action #${actionIdx}`);
		})
		++arrowIdx;
	}

	expect(transducer).toBeDefined();
}
