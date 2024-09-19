import { Expression } from '../models/DSL.ts'
import { ResultOrError, Err } from '../utils/error.ts'

// TODO: Move most of DSL.ts in here, then rename it ExpressionModel.ts

// TODO: Add context
type CompiledExpression = () => number
type CompilationError = string

export function compileExpression(
	_expr: Expression,
): ResultOrError<CompiledExpression,CompilationError> {
	return Err("Not implemented");
}
