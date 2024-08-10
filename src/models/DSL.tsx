import { ResultOrError, Ok, Err, allResults } from '../utils/error.tsx'

/**
 * This describes the Domain Specific Language that is used to describe
 * programmable stages of the growth model.
 * These stages are programmed by the end user through the node graph.
 */

/**
 * An expression is a closure that evaluates into a scalar value given an
 * execution context. Expresion nodes have node IDs to recognize them after an
 * edit and tie them to the node graph view.
 */
export type Expression =
	// A constant value
	| { type: "constant", nodeId: string, value: number }

	// An accessor gets a value from the execution context, for instance the
	// "size" accessor returns the leaf size if the execution context is a leaf
	// context.
	| { type: "accessor", nodeId: string, identifier: string }

	// An operator combine one or more sub-expressions
	| { type: "operator", nodeId: string, operator: string, arguments: Expression[] }

/*
 * Utility functions to build expressions
 */

export function makeRandomNodeId(): string {
	const length = 16;
	let result = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const charactersLength = characters.length;
    let counter = 0;
    while (counter < length) {
      result += characters.charAt(Math.floor(Math.random() * charactersLength));
      counter += 1;
    }
    return result;
}

export function makeConst(value: number): Expression {
	return {
		type: "constant",
		nodeId: makeRandomNodeId(),
		value,
	}
}

export function makeAcc(identifier: string): Expression {
	return {
		type: "accessor",
		nodeId: makeRandomNodeId(),
		identifier,
	}
}

export function makeOp(operator: string, ...args: Expression[]): Expression {
	return {
		type: "operator",
		nodeId: makeRandomNodeId(),
		operator,
		arguments: args,
	}
}

/**
 * Input type of makeExpr
 */
type ExpressionBuilder = (number | string | ExpressionBuilder)[]

type ParseError = string

/**
 * Another way to build expressions, inspired by MapBox expression system
 */
export function makeExpr(root: ExpressionBuilder): ResultOrError<Expression,ParseError> {
	if (root.length == 0) {
		return Err(`An expression builder cannot be an empty array`);
	}
	const first = root[0];
	if (typeof first === 'number') {
		if (root.length != 1) {
			return Err(`Number literal must have exactly 1 element, in expression builder ${JSON.stringify(root)}`);
		}
		return Ok(makeConst(first));
	} else if (first === 'get') {
		if (root.length != 2) {
			return Err(`Accessor expression builder must have exactly 1 element after 'get', in expression builder ${JSON.stringify(root)}`);
		}
		const identifier = root[1];
		if (typeof identifier !== 'string') {
			return Err(`Accessor expression builder must have a string identifier as second element, but '${JSON.stringify(root[1])}' was found`);
		}
		return Ok(makeAcc(identifier));
	} else {
		if (typeof first !== 'string') {
			return Err(`Operator expression builder must have a string operator as first element, but '${JSON.stringify(first)}' was found`);
		}
		const args = allResults(root.slice(1).map(subtree => {
			if (subtree instanceof Array) {
				return makeExpr(subtree as ExpressionBuilder);
			} else if (typeof subtree === 'number') {
				return Ok(makeConst(subtree));
			} else {
				return Err(`Operator arguments must be literal scalar values or sub expression builders, but '${JSON.stringify(subtree)}' was found`);
			}
		}))
		if (args.result === undefined) {
			return Err(args.error);
		} else {
			return Ok(makeOp(first, ...args.result));
		}
	}
}

/*
 * Evaluation of expressions
 */

export type ExecutionContext = {
	scope: "phytomer" | "leaf",
	get: (identifier: string) => number
}

export function makeContext(scope: "phytomer" | "leaf", attributes: { [key: string]: number }): ExecutionContext {
	return {
		scope,
		get: identifier => {
			const value = attributes[identifier];
			console.assert(value !== undefined);
			return value;
		},
	}
}

type EvalError = string

export function evalExpr(expr: Expression, context: ExecutionContext): ResultOrError<number,EvalError> {
	switch (expr.type) {
	case "constant":
		return Ok(expr.value);
	case "accessor":
		const value = context.get(expr.identifier);
		if (value === undefined) {
			return Err(`Could not find attribute '${expr.identifier}' in context of scope '${context.scope}'.`)
		} else {
			return Ok(value);
		}
	case "operator":
		type OperatorImpl = {
			argCount: number,
			implementation: (args: number[]) => number
		}
		const availableOperators: { [key: string]: OperatorImpl } = {
			'<': { argCount: 2, implementation: (args: number[]) => args[0] < args[1] ? 1 : 0 },
			'if': { argCount: 3, implementation: (args: number[]) => args[0] != 0 ? args[1] : args[2] },
		}
		const op = availableOperators[expr.operator];
		if (op === undefined) {
			return Err(`Unknown operator '${expr.operator}'`);
		}
		if (expr.arguments.length != op.argCount) {
			return Err(`Operator '${expr.operator}' requires ${op.argCount} arguments, but ${expr.arguments.length} were provided, in expression ${JSON.stringify(expr)}`);
		}

		const values = allResults(expr.arguments.map(arg => evalExpr(arg, context)));
		if (values.result === undefined) {
			return Err(values.error)
		} else {
			return Ok(op.implementation(values.result));
		}
	}
}
