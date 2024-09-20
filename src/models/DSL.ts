import { ResultOrError, Ok, Err, allResults } from '../utils/error.ts'
import { randomString } from '../utils/random.ts'

/**
 * This describes the Domain Specific Language that is used to describe
 * programmable stages of the growth model.
 * These stages are programmed by the end user through the node graph.
 */

export type NodeId = string;

/**
 * An expression is a closure that evaluates into a scalar value given an
 * execution context. Expresion nodes have node IDs to recognize them after an
 * edit and tie them to the node graph view.
 * TODO: template with return type and context scope
 */
export type Expression =
	// A constant value (number)
	| { type: "constant", nodeId: NodeId, value: number }

	// A constant value (string)
	| { type: "constant-string", nodeId: NodeId, value: string }

	// An accessor gets a value from the execution context, for instance the
	// "size" accessor returns the leaf size if the execution context is a leaf
	// context.
	| { type: "accessor", nodeId: NodeId, identifier: string }

	// An operator combine one or more sub-expressions
	| { type: "operator", nodeId: NodeId, operator: string, arguments: Expression[] }

/*
 * Utility functions to build expressions
 */

export function makeRandomNodeId(): NodeId {
	return randomString(16);
}

export function makeConst(value: number): Expression {
	return {
		type: "constant",
		nodeId: makeRandomNodeId(),
		value,
	}
}

export function makeConstStr(value: string): Expression {
	return {
		type: "constant-string",
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
			} else if (typeof subtree === 'string') {
				return Ok(makeConstStr(subtree));
			} else {
				return Err(`Operator arguments must be literal scalar/string values or sub expression builders, but '${JSON.stringify(subtree)}' was found`);
			}
		}))
		if (args.result === undefined) {
			return Err(args.error);
		} else {
			return Ok(makeOp(first, ...args.result));
		}
	}
}

/**
 * This is the inverse of makeExpr
 */
export function makeExpressionBuilder(expr: Expression): ExpressionBuilder {
	// Use '3.14' rather than '[ 3.14 ]' in subexpressions (but not in the root)
	function simplify(expr: ExpressionBuilder): ExpressionBuilder | number | string {
		if (expr.length === 1 && (typeof expr[0] === 'number' || typeof expr[0] === 'string')) {
			return expr[0];
		} else {
			return expr;
		}
	}

	switch (expr.type) {
	case "constant":
		return [ expr.value ];
	case "constant-string":
		return [ expr.value ];
	case "accessor":
		return [ "get", expr.identifier ];
	case "operator":
		return [ expr.operator, ...expr.arguments.map(makeExpressionBuilder).map(simplify) ]
	}
}

/**
 * Pretty print expression builder
 */
export function formatExpressionBuilder(builder: ExpressionBuilder) {
	function nextToken(text: string, offset: number) {
		const tokensOfInterest = [ "[", ",", "]" ]
		const token = {
			value: "",
			position: -1,
		}
		for (const tk of tokensOfInterest) {
			const idx = text.indexOf(tk, offset);
			if (idx > -1 && (token.position == -1 || idx < token.position)) {
				token.value = tk;
				token.position = idx;
			}
		}
		return token;
	}

	const raw = JSON.stringify(builder);
	const formatted = [];
	let offset = 0;
	let indentLevel = 0;
	let inAccessor = false;
	let inConstant = false;
	const indentCharacters = "  ";
	for (;;) {
		const token = nextToken(raw, offset);
		const nextOffset = token.position + 1;

		if (token.position == -1) {
			formatted.push(raw.substring(offset))
			break;
		}

		switch (token.value) {
		case "[":
			formatted.push(raw.substring(offset, nextOffset));
			inConstant = true; // maybe in constant, until we meet a comma
			indentLevel += 1;
			break;
		case "]":
			indentLevel -= 1;
			formatted.push(raw.substring(offset, nextOffset - 1));
			if (!inAccessor && !inConstant) {
				formatted.push("\n" + indentCharacters.repeat(indentLevel))
			}
			formatted.push("]")
			inAccessor = false;
			inConstant = false;
			break;
		case ",": {
			const str = raw.substring(offset, nextOffset);
			formatted.push(str);

			// Don't split after get because there is only 1 argument and no nesting for sure
			if (str.endsWith('"get",')) {
				inAccessor = true;
			}
			inConstant = false;

			if (!inAccessor) {
				formatted.push("\n" + indentCharacters.repeat(indentLevel))
			} else {
				formatted.push(" ")
			}
			break;
		}
		}

		offset = nextOffset;
	}
	console.assert(indentLevel === 0);
	console.assert(!inAccessor);
	console.assert(!inConstant);

	return formatted.join("")
}


/*
 * Evaluation of expressions
 */

// TODO: better static typing
type EvaluatedValue =
	| number
	| string

// TODO: Rename into "ExpressionContext"?
export type ExecutionContext = {
	scope: "phytomer" | "leaf" | "meristem",
	get: (identifier: string) => EvaluatedValue,
	getNumber: (identifier: string) => number,
	getString: (identifier: string) => string,
}

export type ExecutionContextDefinition = {
	scope: string,
	entries: { [key: string]: ExecutionContextDefinitionEntry }
}

export type ExecutionContextDefinitionEntry = {
	type: "number" | "string"
}

export function makeContext(scope: "phytomer" | "leaf" | "meristem", attributes: { [key: string]: EvaluatedValue }): ExecutionContext {
	return {
		scope,
		get: identifier => {
			const value = attributes[identifier];
			console.assert(value !== undefined);
			return value;
		},
		getNumber: identifier => {
			const value = attributes[identifier];
			console.assert(typeof value === 'number');
			return +value;
		},
		getString: identifier => {
			const value = attributes[identifier];
			console.assert(typeof value === 'string');
			return ''+value;
		},
	}
}

export type EvalError = {
	message: string,
	location: NodeId,
}

export function evalExpr(expr: Expression, context: ExecutionContext): ResultOrError<EvaluatedValue,EvalError> {
	function EvalErr(message: string): ResultOrError<number,EvalError> {
		return Err({
			message,
			location: expr.nodeId,
		})
	}

	switch (expr.type) {

	case "constant":
		return Ok(expr.value);

	case "constant-string":
		return Ok(expr.value);

	case "accessor": {
		const value = context.get(expr.identifier);
		if (value === undefined) {
			return EvalErr(`Could not find attribute '${expr.identifier}' in context of scope '${context.scope}'.`)
		} else {
			return Ok(value);
		}
	}

	case "operator": {
		type OperatorImpl = {
			argCount: number,
			implementation: (args: EvaluatedValue[]) => EvaluatedValue
		}
		const availableOperators: { [key: string]: OperatorImpl } = {
			'<': { argCount: 2, implementation: (args: EvaluatedValue[]) => args[0] < args[1] ? 1 : 0 },
			'==': { argCount: 2, implementation: (args: EvaluatedValue[]) => args[0] == args[1] ? 1 : 0 },
			'if': { argCount: 3, implementation: (args: EvaluatedValue[]) => args[0] != 0 ? args[1] : args[2] },
		}
		const op = availableOperators[expr.operator];
		if (op === undefined) {
			return EvalErr(`Unknown operator '${expr.operator}'`);
		}
		if (expr.arguments.length != op.argCount) {
			return EvalErr(`Operator '${expr.operator}' requires ${op.argCount} arguments, but ${expr.arguments.length} were provided, in expression ${JSON.stringify(expr)}`);
		}

		const values = allResults(expr.arguments.map(arg => evalExpr(arg, context)));
		if (values.result === undefined) {
			return Err(values.error)
		} else {
			return Ok(op.implementation(values.result));
		}
	}

	/* v8 ignore next 2 */
	}
}
