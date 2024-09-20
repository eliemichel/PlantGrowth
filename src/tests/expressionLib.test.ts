import { expect, test } from 'vitest'
import { Ok, assertOk, isErr } from '../utils/error.ts'
import {
	makeConst,
	makeOp,
	makeAcc,
	makeExpr,
	makeExpressionBuilder,
	formatExpressionBuilder,
	evalExpr,
	makeContext,
	type ExecutionContext,
	type ExecutionContextDefinition,
	type EvaluatedValue,
} from '../models/DSL.ts'
import {
	compileExpression,
} from '../backend/expressionLib.ts'

type ContextAndDefinition = {
	context: ExecutionContext,
	definition: ExecutionContextDefinition,
}

function makeContextAndDefinition(
	scope: string,
	attributes: { [key: string]: EvaluatedValue },
): ContextAndDefinition {
	const definition: ExecutionContextDefinition = {
		scope,
		entries: {},
	}
	for (const [ key, value ] of Object.entries(attributes)) {
		const type = typeof value;
		if (type === "number" || type === "string") {
			definition.entries[key] = { type };
		} else {
			throw Error(`Type '${type}' is not supported in execution context attributes.`);
		}
	}
	return {
		context: makeContext(scope, attributes),
		definition,
	}
}

const allContextAndDefs: ContextAndDefinition[] = [
	makeContextAndDefinition("phytomer", { length: 0.1, meristem: 'apical' }),
	makeContextAndDefinition("phytomer", { length: 0.5, meristem: 'apical' }),
	makeContextAndDefinition("phytomer", { length: 1.5, meristem: 'apical' }),
	makeContextAndDefinition("phytomer", { length: 0.1, meristem: 'apical-head' }),
	makeContextAndDefinition("phytomer", { length: 0.5, meristem: 'apical-head' }),
	makeContextAndDefinition("phytomer", { length: 1.5, meristem: 'apical-head' }),
];

const continuousGrowthRateGroundTruth = (context: ExecutionContext) => context.getNumber("length") < 0.3 ? 0.02 : 0.0;

test('Build and evaluate expression using makeOp/etc', () => {

	const expr = makeOp("if",
		makeOp("<", makeAcc("length"), makeConst(0.3)),
		makeConst(0.02),
		makeConst(0.0)
	)

	for (const { context, definition } of allContextAndDefs) {
		const gt = continuousGrowthRateGroundTruth(context);
		expect(evalExpr(expr, context)).toStrictEqual(Ok(gt));

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.error).toBe(undefined);
		if (isErr(maybeCompiledExpr)) continue;
		const compiledExpr = maybeCompiledExpr.result;
		expect(compiledExpr(context)).toStrictEqual(gt);
	}
})

test('Build and evaluate expression using makeExpr', () => {

	const maybeExpr = makeExpr(["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	]);

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const { context, definition } of allContextAndDefs) {
		const gt = continuousGrowthRateGroundTruth(context);
		expect(evalExpr(expr, context)).toStrictEqual(Ok(gt));

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.error).toBe(undefined);
		if (isErr(maybeCompiledExpr)) continue;
		const compiledExpr = maybeCompiledExpr.result;
		expect(compiledExpr(context)).toStrictEqual(gt);
	}
})

test('Build and evaluate expression using makeExpr (string comparison)', () => {

	const maybeExpr = makeExpr(["if",
		["<",
			["get", "length"],
			["if",
				["==",
					["get", "meristem"],
					"apical-head"
				],
				1.0,
				0.0
			]
		],
		0.02,
		0.0,
	]);

	const groundTruth = (context: ExecutionContext) => context.getNumber("length") < (context.getString("meristem") === "apical-head" ? 1.0 : 0.0) ? 0.02 : 0.0;

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const { context, definition } of allContextAndDefs) {
		const gt = groundTruth(context);
		expect(evalExpr(expr, context)).toStrictEqual(Ok(gt));

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.error).toBe(undefined);
		if (isErr(maybeCompiledExpr)) continue;
		const compiledExpr = maybeCompiledExpr.result;
		expect(compiledExpr(context)).toStrictEqual(gt);
	}
})

test('Fail to build expression from empty list', () => {

	const expr = makeExpr(["if",
		[], // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

test('Fail to build accessor with multiple identifiers', () => {

	const expr = makeExpr(["if",
		["get", "foo", "bar"], // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

test('Fail to build accessor with number identifier', () => {

	const expr = makeExpr(["if",
		["get", 42], // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

test('Fail to build expression with number operator', () => {

	const expr = makeExpr(["if",
		[42, 24], // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

test('Fail to build expression with non-string operator', () => {

	const expr = makeExpr(["if",
		[[], 24], // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

/* // TODO: Re-activate once we have proper static typing
test('Fail to build operator expression with string argument', () => {

	const expr = makeExpr(["if",
		"foo", // wrong
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})
*/

test('Fail to evaluate invalid constant', () => {

	const expr = makeExpr(["if",
		// @ts-expect-error We put a wrong value on purpose to check for runtime typing
		new Date(), // wrong type
		0.02,
		0.0,
	]);

	expect(expr.result).toBe(undefined);
})

test('Fail to evaluate expression with invalid accessor', () => {

	const maybeExpr = makeExpr(["if",
		["get", "foo"], // wrong
		0.02,
		0.0,
	]);

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const { context, definition } of allContextAndDefs) {
		expect(evalExpr(expr, context).result).toBe(undefined);

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.result).toBe(undefined);
	}
})

test('Fail to evaluate expression with unknown operator', () => {

	const maybeExpr = makeExpr(["foo", // wrong
		1,
		0.02,
		0.0,
	]);

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const { context, definition } of allContextAndDefs) {
		expect(evalExpr(expr, context).result).toBe(undefined);

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.result).toBe(undefined);
	}
})

test('Fail to evaluate expression with invalid argument count', () => {

	const maybeExpr = makeExpr(["if",
		// missing argument
		0.02,
		0.0,
	]);

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const { context, definition } of allContextAndDefs) {
		expect(evalExpr(expr, context).result).toBe(undefined);

		const maybeCompiledExpr = compileExpression(expr, definition);
		expect(maybeCompiledExpr.result).toBe(undefined);
	}
})

test('Converting from builder to expression then back to builder is identity', () => {

	const builder = ["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	];

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	const newBuilder = makeExpressionBuilder(expr);

	expect(newBuilder).toStrictEqual(builder);

	const { definition } = allContextAndDefs[0];
	const maybeCompiledExpr = compileExpression(expr, definition);
	expect(maybeCompiledExpr.error).toBe(undefined);
})

test('Converting from builder to expression then back to builder is identity (string constant)', () => {

	const builder = ["if",
		["==",
			["get", "meristem"],
			"apical-head"
		],
		0.01,
		0
	];

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	const newBuilder = makeExpressionBuilder(expr);

	expect(newBuilder).toStrictEqual(builder);

	const { definition } = allContextAndDefs[0];
	const maybeCompiledExpr = compileExpression(expr, definition);
	expect(maybeCompiledExpr.error).toBe(undefined);
})

test('Formatting expression builder is valid JSON that builds the same expression', () => {

	const builder = ["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	];

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	const exprSrc = formatExpressionBuilder(builder);

	const newBuilder = JSON.parse(exprSrc);
	expect(newBuilder).toStrictEqual(builder);

	const { definition } = allContextAndDefs[0];
	const maybeCompiledExpr = compileExpression(expr, definition);
	expect(maybeCompiledExpr.error).toBe(undefined);

	// TODO: Enable once we can match node ids
	/*
	const maybeNewExpr = makeExpr(newBuilder);
	expect(maybeNewExpr.error).toBe(undefined);
	const newExpr = assertOk(maybeNewExpr);

	expect(newExpr).toStrictEqual(expr);
	*/
})

test('Formatting expression builder is valid JSON that builds the same expression (string constant)', () => {

	const builder = ["if",
		["==",
			["get", "meristem"],
			"apical-head"
		],
		0.01,
		0
	];

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	const exprSrc = formatExpressionBuilder(builder);

	const newBuilder = JSON.parse(exprSrc);
	expect(newBuilder).toStrictEqual(builder);

	const { definition } = allContextAndDefs[0];
	const maybeCompiledExpr = compileExpression(expr, definition);
	expect(maybeCompiledExpr.error).toBe(undefined);

	// TODO: Enable once we can match node ids
	/*
	const maybeNewExpr = makeExpr(newBuilder);
	expect(maybeNewExpr.error).toBe(undefined);
	const newExpr = assertOk(maybeNewExpr);

	expect(newExpr).toStrictEqual(expr);
	*/
})

test('Formatting expression builder looks good', () => {

	const builder = ["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	];

	const expectedExprSrc = [
		`["if",`,
		`  ["<",`,
		`    ["get", "length"],`,
		`    0.3`,
		`  ],`,
		`  0.02,`,
		`  0`,
		`]`,
	].join('\n')

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);

	const exprSrc = formatExpressionBuilder(builder);

	expect(exprSrc).toStrictEqual(expectedExprSrc);
})

test('Formatting expression builder looks good (string constant)', () => {

	const builder = ["if",
		["==",
			["get", "meristem"],
			"apical-head"
		],
		0.01,
		0
	];

	const expectedExprSrc = [
		`["if",`,
		`  ["==",`,
		`    ["get", "meristem"],`,
		`    "apical-head"`,
		`  ],`,
		`  0.01,`,
		`  0`,
		`]`,
	].join('\n')

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);

	const exprSrc = formatExpressionBuilder(builder);

	expect(exprSrc).toStrictEqual(expectedExprSrc);
})

test('Formatting expression builder looks good (single constant)', () => {

	const builder = [0.01];

	const expectedExprSrc = "[0.01]"

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);

	const exprSrc = formatExpressionBuilder(builder);

	expect(exprSrc).toStrictEqual(expectedExprSrc);
})

test('Transducer source state filter expression can be compiled', () => {
	const expr = assertOk(makeExpr([ "==", [ "get", "age" ], 15 ]));
	const contextDef: ExecutionContextDefinition = {
		scope: "transducer",
		entries: {
			age: { type: "number" },
		}
	}

	const maybeCompiledExpr = compileExpression(expr, contextDef);
	expect(maybeCompiledExpr.error).toBe(undefined);
	const compiledExpr = assertOk(maybeCompiledExpr);
	expect(compiledExpr(makeContext("transducer", { age: 12 }))).toBe(0);
	expect(compiledExpr(makeContext("transducer", { age: 15 }))).toBe(1);
})
