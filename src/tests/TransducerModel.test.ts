import { test, expect } from 'vitest'
import {
	type Transducer,
	type State,
	type StateType,
	type StateDefinition,
	type StateDataFieldDefinition,
	type Action,
	type ActionType,
	type ActionDefinition,
	createInitialTransducer,
} from '../models/TransducerModel.ts'

export function buildStateDefinitionLut(stateDefinitions: StateDefinition[]) {
	const stateDefinitionLut: { [key: string]: StateDataFieldDefinition[] } = {};
	// Check for duplicate types
	for (const type of stateDefinitions) {
		expect(type.name in stateDefinitionLut).toBe(false)
		stateDefinitionLut[type.name] = type.dataFields;
	}
	return stateDefinitionLut;
}

export function buildActionDefinitionLut(actionDefinitions: ActionDefinition[]) {
	const stateDefinitionLut = new Set<ActionType>();
	// Check for duplicate types
	for (const type of actionDefinitions) {
		expect(stateDefinitionLut.has(type.name)).toBe(false)
		stateDefinitionLut.add(type.name);
	}
	return stateDefinitionLut;
}

function validateStateType(
	stateType: StateType,
	stateDefinitionLut: { [key: string]: StateDataFieldDefinition[] },
	context: string,
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

function validateState(
	state: State,
	stateDefinitionLut: { [key: string]: StateDataFieldDefinition[] },
	context: string,
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
		expect(remainingFields.delete(key)).toBe(true);
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

function validateAction(
	action: Action,
	actionDefinitionLut: Set<ActionType>,
	context: string,
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

function validateTransducer(
	transducer: Transducer,
	context?: string,
) {
	const stateDefinitionLut = buildStateDefinitionLut(transducer.states);
	const actionDefinitionLut = buildActionDefinitionLut(transducer.actions);

	let arrowIdx = 0;
	for (const [ sourceState, arrow ] of Object.entries(transducer.arrows)) {
		validateStateType(sourceState, stateDefinitionLut, `${context}, arrow #${arrowIdx}, source state)`);
		validateState(arrow.targetState, stateDefinitionLut, `${context}, arrow #${arrowIdx}, target state`);
		
		arrow.actions.forEach((action, actionIdx) => {
			validateAction(action, actionDefinitionLut, `${context}, arrow #${arrowIdx}, action #${actionIdx}`);
		})
		++arrowIdx;
	}

	expect(transducer).toBeDefined();
}

test("Default transducer is valid", () => {
	const transducer = createInitialTransducer();

	validateTransducer(transducer);
})

test("Missing data field in an arrow's target state is invalid", () => {
	const transducer: Transducer = {
		states: [
			{
				name: "foo",
				dataFields: [
					{ name: "someField", type: "number" },
				],
			},
		],

		actions: [],

		arrows: {
			"foo": {
				targetState: {
					type: "foo",
					data: {}, // missing field 'someField' here!
				},
				actions: [],
			},
		},
	};
	
	expect(() => validateTransducer(transducer)).toThrowError(/Missing field/);
})

test("Non-existing state type in an arrow's source is invalid", () => {
	const transducer: Transducer = {
		states: [
			{
				name: "foo",
				dataFields: [],
			},
		],

		actions: [],

		arrows: {
			"bar": { // non-existing missing field 'someField' here!
				targetState: {
					type: "foo",
					data: {},
				},
				actions: [],
			},
		},
	};
	
	expect(() => validateTransducer(transducer)).toThrowError(/State has illegal type/);
})

test("Emitting state with an invalid type is invalid", () => {
	const transducer: Transducer = {
		states: [
			{
				name: "foo",
				dataFields: [],
			},
		],

		actions: [],

		arrows: {
			"foo": {
				targetState: {
					type: "foo",
					data: {},
				},
				actions: [
					{ type: "non-existing" }, // erroneous!
				],
			},
		},
	};
	
	expect(() => validateTransducer(transducer)).toThrowError(/Action has illegal type/);
})

function createTestTransducer(): Transducer {
	return {
		states: [
			{
				name: "init",
				dataFields: [],
			},
			{
				name: "apical",
				dataFields: [
					{ name: "age", type: "number" },
				],
			},
		],

		actions: [
			{ name: "add-leaf" },
		],

		arrows: {
			"init": {
				targetState: {
					type: "apical",
					data: { age: 0 },
				},
				actions: [
					{ type: "add-leaf" },
				],
			},

			"apical": {
				targetState: {
					type: "apical",
					data: { age: 0 },
				},
				actions: [],
			},
		},
	};
}

test("Advanced transducer is valid", () => {
	const transducer = createTestTransducer();
	
	validateTransducer(transducer);
})

