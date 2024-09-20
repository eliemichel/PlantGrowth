import { test, expect } from 'vitest'
import { isErr } from '../utils/error.ts'
import {
	type Transducer,
	createInitialTransducer,
} from '../models/TransducerModel.ts'

import {
	type CompiledTransducer,
	compileTransducer,
} from '../backend/transducerLib.ts'

import validateTransducer, {
	buildStateDefinitionLut,
	buildActionDefinitionLut,
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
	const stateDefinitionLut = buildStateDefinitionLut(transducer.states);
	const actionDefinitionLut = buildActionDefinitionLut(transducer.actions);

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
})
