import {
	type Transducer,
	type ActionDefinition,
	type StateDefinition,
	type TransducerArrow,
	type State,
	type StateDataFieldDefinition,
	type Action,
	type ActionType,
} from '../models/TransducerModel.ts'
import { compileKernel } from '../backend/typejit.ts'
import { type Expression, type ExecutionContextDefinition } from '../models/DSL.ts'
import { compileExpression } from './expressionLib.ts'

import { type ResultOrError, Ok, isErr } from '../utils/error.ts'
import groupBy from '../utils/groupBy.ts'

export type StateDefinitionLut = { [key: string]: StateDataFieldDefinition[] };

export function buildStateDefinitionLut(
	stateDefinitions: StateDefinition[],
): StateDefinitionLut {
	const stateDefinitionLut: StateDefinitionLut = {};
	for (const type of stateDefinitions) {
		stateDefinitionLut[type.name] = type.dataFields;
	}
	return stateDefinitionLut;
}

export type ActionDefinitionLut = Set<ActionType>;

export function buildActionDefinitionLut(
	actionDefinitions: ActionDefinition[],
): ActionDefinitionLut {
	const stateDefinitionLut = new Set<ActionType>();
	for (const type of actionDefinitions) {
		stateDefinitionLut.add(type.name);
	}
	return stateDefinitionLut;
}

// TODO: add a 'warnings' field to CompiledTransducer
export type CompiledTransducer = (state: State) => [ State, Action[] ];
export type CompilationError = string

function compileConditionSource(
	condition: Expression,
	contextDef: ExecutionContextDefinition,
): ResultOrError<string,CompilationError> {
	
	const maybeFn = compileExpression(condition, contextDef);
	if (isErr(maybeFn)) return maybeFn;
	const source = maybeFn.result.toString();
	return Ok(source.substring("(context) => {return ".length, source.length - "}".length)); // a bit hacky...
}

function makeArrowContextDefinition(
	arrow: TransducerArrow,
	stateDefinitionLut: StateDefinitionLut,
): ExecutionContextDefinition {
	const contextDef: ExecutionContextDefinition = {
		scope: "transducer", // TODO: is this the right scope?
		entries: {},
	}

	const stateDataFields = stateDefinitionLut[arrow.sourceStateFilter.type];

	for (const { name, type } of stateDataFields) {
		const conversionLut: { [key: string]: "string" | "number" } = {
			number: "number",
			boolean: "number",
			string: "string",
		}
		contextDef.entries[name] = { type: conversionLut[type] }
	}
	return contextDef;
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

	const stateDefinitionLut = buildStateDefinitionLut(transducer.states);

	const source = [];
	source.push(
		`const context = {`,
		`    scope: "transducer",`,
		`    get: identifier => state.data[identifier],`,
		`}`,
		``,
		``,
		``,
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
				const contextDef = makeArrowContextDefinition(arrow, stateDefinitionLut);
				const maybeCondition = compileConditionSource(condition, contextDef);
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
		`return [ nextState, actions ]`
	)

	const kernel = compileKernel<[State, Action[]], [State]>({
		args: [ "state" ],
		source: source.join("\n"),
		closure: {}
	});

	return Ok(kernel.fn);
}
