import {
	type Transducer,
	type State,
	type Action,
} from '../models/TransducerModel.ts'
import { compileKernel } from '../backend/typejit.ts'

import { type ResultOrError, Ok } from '../utils/error.ts'

export type CompiledTransducer = (state: State) => [ State, Action[] ];
export type CompilationError = string

/**
 * Transform a transducer into a JavaScript closure
 */
export function compileTransducer(
	transducer: Transducer,
): ResultOrError<CompiledTransducer,CompilationError> {
	function makeStateConstant(state: State): string {
		return JSON.stringify(state);
	}

	function makeActionConstant(action: Action): string {
		return JSON.stringify(action);
	}

	const source = [];
	source.push(
		`let actions = [];`,
		`let nextState = { type: state.type, data: { ...state.data } }; // clone state`,
		`switch (state.type) {`,
	)

	for (const [ sourceStateType, arrow ] of Object.entries(transducer.arrows)) {
		source.push(
			`case '${sourceStateType}': {`,
			...arrow.actions.map(action => (
				`    actions.push(${makeActionConstant(action)});`
			)),
			`    nextState = ${makeStateConstant(arrow.targetState)};`,
			`    break;`,
			`}`,
		)
	}

	source.push(
		`}`, // end switch (state.type)
		`return [ nextState, [] ]`
	)

	const kernel = compileKernel<[State, Action[]], [State]>({
		args: [ "state" ],
		source: source.join("\n"),
		closure: {}
	});

	return Ok(kernel.fn);
}
