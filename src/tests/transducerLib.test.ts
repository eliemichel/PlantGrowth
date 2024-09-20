import { test, expect } from 'vitest'
import { isErr, assertOk } from '../utils/error.ts'
import { makeExpr } from '../models/DSL.ts'
import {
	type Transducer,
	createInitialTransducer,
} from '../models/TransducerModel.ts'

import {
	type CompiledTransducer,
	compileTransducer,
} from '../backend/transducerLib.ts'

import validateTransducer, {
	buildAndValidateStateDefinitionLut,
	buildAndValidateActionDefinitionLut,
	buildState,
	validateState,
	validateAction,
} from './validateTransducer.ts'

import { createTestTransducer } from './TransducerModel.test.ts'

//---------------------------------------------------------

function validateCompiledTransducer(
	compiled: CompiledTransducer,
	transducer: Transducer,
	context?: string,
) {
	const stateDefinitionLut = buildAndValidateStateDefinitionLut(transducer.states);
	const actionDefinitionLut = buildAndValidateActionDefinitionLut(transducer.actions);

	// Check that the compiled transducer can handle all states
	for (const stateDef of transducer.states) {
		const state = buildState(stateDef);
		// TODO: cover all subcases for a given state type

		// Invoke compiled transducer
		const out = compiled(state);

		// Check the type returned by the compiled transducer
		expect(out instanceof Array).toBe(true);
		expect(out.length).toBe(2);
		const [ newState, emittedActions ] = out;

		// Check the returned value
		validateState(newState, stateDefinitionLut, context);

		for (const action of emittedActions) {
			validateAction(action, actionDefinitionLut, context);
		}
	}

}

//---------------------------------------------------------

test("Default transducer can be compiled", () => {
	const transducer = createInitialTransducer();

	const maybeCompiled = compileTransducer(transducer);
	expect(maybeCompiled.error).toBe(undefined);
	if (isErr(maybeCompiled)) return;
	const compiled = maybeCompiled.result;

	validateCompiledTransducer(compiled, transducer);
	validateTransducer(transducer);
})

test("Advanced transducer can be compiled", () => {
	const transducer = createTestTransducer();

	const maybeCompiled = compileTransducer(transducer);
	expect(maybeCompiled.error).toBe(undefined);
	if (isErr(maybeCompiled)) return;
	const compiled = maybeCompiled.result;

	console.log(compiled.toString());

	validateCompiledTransducer(compiled, transducer);
	validateTransducer(transducer);

	{
		const state = {
			type: "apical",
			data: { age: 15 },
		}
		const [ newState, actions ] = compiled(state);
		expect(newState.type).toBe("apical");
		//expect(newState.data.age).toBe(16); // TODO: support expressions in target state
		expect(actions.length).toBe(1);
		expect(actions[0].type).toBe("add-leaf");
	}
	{
		const state = {
			type: "apical",
			data: { age: 12 },
		}
		const [ newState, actions ] = compiled(state);
		expect(newState.type).toBe("apical");
		//expect(newState.data.age).toBe(13); // TODO: support expressions in target state
		expect(actions.length).toBe(0);
	}
})

test("Compilation error when using a non existing data field in arrow source condition", () => {
	const transducer = {
		states: [
			{
				name: "init",
				dataFields: [],
			},
		],

		actions: [],

		arrows: [
			{
				sourceStateFilter: {
					type: "init",
					condition: assertOk(makeExpr([ "==", [ "get", "WRONG" ], 15 ])),
				},
				targetState: {
					type: "init",
					data: {},
				},
				actions: [],
			},
			{
				sourceStateFilter: { type: "init" },
				targetState: {
					type: "init",
					data: {},
				},
				actions: [],
			},
		],
	};

	// TODO: Shouldn't the presence of 'WRONG' be checked in here as well?
	validateTransducer(transducer);

	const maybeCompiled = compileTransducer(transducer);
	expect(maybeCompiled.result).toBe(undefined);
	expect(maybeCompiled.error).toContain("Could not find attribute 'WRONG'");
})
