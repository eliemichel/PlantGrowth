import { type Expression, type ExecutionContext, type ExecutionContextDefinition } from '../models/DSL.ts'
import { ResultOrError, Err, Ok, allResults, isOk, isErr } from '../utils/error.ts'
import { compileKernel } from '../backend/typejit.ts'

// TODO: Move most of DSL.ts in here, then rename it ExpressionModel.ts

// TODO: Add context
type CompiledExpression = (context: ExecutionContext) => number
type CompilationError = string

// Internal function for compileExpression
function compileExpressionSource(
	expr: Expression,
	contextDef: ExecutionContextDefinition,
): ResultOrError<string,CompilationError> {
	switch (expr.type) {

	case "constant":
		return Ok(`${expr.value}`);

	case "constant-string":
		return Ok(`"${expr.value}"`);

	case "accessor": {
		const entry = contextDef.entries[expr.identifier];
		if (entry === undefined) {
			return Err(`Could not find attribute '${expr.identifier}' in context of scope '${contextDef.scope}'.`)
		} else {
			return Ok(`context.get("${expr.identifier}")`);
		}
	}

	case "operator": {
		type OperatorImpl = {
			argCount: number,
			compile: (args: string[]) => string
		}
		const availableOperators: { [key: string]: OperatorImpl } = {
			'<': { argCount: 2, compile: (args: string[]) => `(${args[0]}) < (${args[1]}) ? 1 : 0` },
			'==': { argCount: 2, compile: (args: string[]) => `(${args[0]}) == (${args[1]}) ? 1 : 0` },
			'if': { argCount: 3, compile: (args: string[]) => `(${args[0]}) != 0 ? (${args[1]}) : (${args[2]})` },
		}
		const op = availableOperators[expr.operator];
		if (op === undefined) {
			return Err(`Unknown operator '${expr.operator}'`);
		}
		if (expr.arguments.length != op.argCount) {
			return Err(`Operator '${expr.operator}' requires ${op.argCount} arguments, but ${expr.arguments.length} were provided, in expression ${JSON.stringify(expr)}`);
		}

		const maybeValues = allResults(expr.arguments.map(arg => compileExpressionSource(arg, contextDef)));
		if (isOk(maybeValues)) {
			return Ok(op.compile(maybeValues.result));
		} else {
			return Err(maybeValues.error)
		}
	}
	}
}

export function compileExpression(
	expr: Expression,
	contextDef: ExecutionContextDefinition,
): ResultOrError<CompiledExpression,CompilationError> {

	const maybeSource = compileExpressionSource(expr, contextDef);
	// idk why typescript doesn't understand the type guard here... using 'as' then
	if (isErr(maybeSource)) return Err(maybeSource.error as CompilationError);
	const source = maybeSource.result as string;

	const kernel = compileKernel<number, [ExecutionContext]>({
		args: [ "context" ],
		source: "return " + source,
		closure: {}
	});

	return Ok(kernel.fn);
}
