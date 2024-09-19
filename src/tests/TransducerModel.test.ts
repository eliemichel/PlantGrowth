import { test, expect } from 'vitest'
import {
	type Transducer,
	createInitialTransducer,
} from '../models/TransducerModel.ts'
import { assertOk } from '../utils/error.ts'
import { makeExpr } from '../models/DSL.ts'

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

		arrows: [
			{
				sourceStateFilter: { type: "init" },
				targetState: {
					type: "apical",
					data: { age: 0 },
				},
				actions: [
					{ type: "add-leaf" },
				],
			},
			{
				sourceStateFilter: {
					type: "apical",
					condition: assertOk(makeExpr([ 1 ])),
				},
				targetState: {
					type: "apical",
					data: { age: 0 },
				},
				actions: [],
			},
			{
				sourceStateFilter: { type: "apical" },
				targetState: {
					type: "apical",
					data: { age: 0 },
				},
				actions: [],
			},
		],
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

		arrows: [
			{
				sourceStateFilter: { type: "foo" },
				targetState: {
					type: "foo",
					data: {}, // missing field 'someField' here!
				},
				actions: [],
			},
		],
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

		arrows: [
			{
				sourceStateFilter: { type: "bar" }, // non-existing state type here!
				targetState: {
					type: "foo",
					data: {},
				},
				actions: [],
			},
		],
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

		arrows: [
			{
				sourceStateFilter: { type: "foo" },
				targetState: {
					type: "foo",
					data: {},
				},
				actions: [
					{ type: "non-existing" }, // erroneous!
				],
			},
		],
	};
	
	expect(() => validateTransducer(transducer)).toThrowError(/Action has illegal type/);
})

test("Advanced transducer is valid", () => {
	const transducer = createTestTransducer();
	
	validateTransducer(transducer);
})

