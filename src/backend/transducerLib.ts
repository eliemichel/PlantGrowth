import {
	type Transducer,
	type State,
	type Action,
} from '../models/TransducerModel.ts'
import { compileKernel } from '../backend/typejit.ts'
import { Expression } from '../models/DSL.ts'
import { compileExpression } from './expressionLib.ts'

import { type ResultOrError, Ok, isErr } from '../utils/error.ts'
import groupBy from '../utils/groupBy.ts'

// TODO: add a 'warnings' field to CompiledTransducer
export type CompiledTransducer = (state: State) => [ State, Action[] ];
export type CompilationError = string

function compileConditionSource(
	condition: Expression,
): ResultOrError<string,CompilationError> {
	const maybeFn = compileExpression(condition);
	if (isErr(maybeFn)) return maybeFn;
	const fn = maybeFn.result;
	return Ok(fn.toString());
}

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

	// Group by source type, which corresponds to swicth cases
	const groupedArrows = groupBy(transducer.arrows, a => a.sourceStateFilter.type);
	for (const [sourceStateType, arrowGroup] of groupedArrows) {
		source.push(`case '${sourceStateType}':`)
		let isFirst = true;
		let catchedAll = false; // turns true once a catch all case has been encountered
		for (const arrow of arrowGroup) {
			if (catchedAll) {
				// TODO return warning in CompiledTransducer
				console.warn(`Unreachable arrow, from type '${sourceStateType}'`);
			}

			const maybeElse = isFirst ? '' : 'else ';
			isFirst = false;
			let maybeIf = '';
			const condition = arrow.sourceStateFilter.condition;
			if (condition !== undefined) {
				const maybeCondition = compileConditionSource(condition);
				if (isErr(maybeCondition)) return maybeCondition;
				maybeIf = `if (${maybeCondition.result}) `;
			} else {
				catchedAll = true; // no more case after this one
			}
			source.push(
				`    ${maybeElse}${maybeIf}{`,
				...arrow.actions.map(action => (
					`        actions.push(${makeActionConstant(action)});`
				)),
				`        nextState = ${makeStateConstant(arrow.targetState)};`,
				`    }`,
			)
		}
		if (!catchedAll) {
			const maybeElse = isFirst ? '' : 'else ';
			source.push(
				`    ${maybeElse}{`,
				`        throw Error("Unhandled state in transducer: " + JSON.stringify(state));`,
				`    }`,
			)
		}
		source.push(`    break;`)
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
