import { test, expect } from 'vitest'
import {
	type Transducer,
	createInitialTransducer,
} from '../models/TransducerModel.ts'

import validateTransducer from './validateTransducer.ts'

//-----------------------------------------------------------

export function createTestTransducer(): Transducer {
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

//-----------------------------------------------------------

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

test("Advanced transducer is valid", () => {
	const transducer = createTestTransducer();
	
	validateTransducer(transducer);
})

