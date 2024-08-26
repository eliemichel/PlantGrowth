import { expect, test } from 'vitest'
import { Ok, assertOk } from '../utils/error.tsx'
import {
	makeConst,
	makeOp,
	makeAcc,
	makeExpr,
	makeExpressionBuilder,
	formatExpressionBuilder,
	evalExpr,
	makeContext,
	ExecutionContext,
} from '../models/DSL.tsx'

const allContexts: ExecutionContext[] = [
	makeContext("phytomer", { length: 0.1, meristem: 'apical' }),
	makeContext("phytomer", { length: 0.5, meristem: 'apical' }),
	makeContext("phytomer", { length: 1.5, meristem: 'apical' }),
	makeContext("phytomer", { length: 0.1, meristem: 'apical-head' }),
	makeContext("phytomer", { length: 0.5, meristem: 'apical-head' }),
	makeContext("phytomer", { length: 1.5, meristem: 'apical-head' }),
];

const continuousGrowthRateGroundTruth = (ctx: ExecutionContext) => ctx.getNumber("length") < 0.3 ? 0.02 : 0.0;

test('Build and evaluate expression using makeOp/etc', () => {

	const continuousGrowthRateExpr = makeOp("if",
		makeOp("<", makeAcc("length"), makeConst(0.3)),
		makeConst(0.02),
		makeConst(0.0)
	)

	for (const ctx of allContexts) {
		const gt = continuousGrowthRateGroundTruth(ctx);
		expect(evalExpr(continuousGrowthRateExpr, ctx)).toStrictEqual(Ok(gt));
	}
})

test('Build and evaluate expression using makeExpr', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.error).toBe(undefined);
	const continuousGrowthRateExpr = assertOk(maybeContinuousGrowthRateExpr);

	for (const ctx of allContexts) {
		const gt = continuousGrowthRateGroundTruth(ctx);
		expect(evalExpr(continuousGrowthRateExpr, ctx)).toStrictEqual(Ok(gt));
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

	const groundTruth = (ctx: ExecutionContext) => ctx.getNumber("length") < (ctx.getString("meristem") === "apical-head" ? 1.0 : 0.0) ? 0.02 : 0.0;

	expect(maybeExpr.error).toBe(undefined);
	const expr = assertOk(maybeExpr);

	for (const ctx of allContexts) {
		const gt = groundTruth(ctx);
		expect(evalExpr(expr, ctx)).toStrictEqual(Ok(gt));
	}
})

test('Fail to build expression from empty list', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		[], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

test('Fail to build accessor with multiple identifiers', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		["get", "foo", "bar"], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

test('Fail to build accessor with number identifier', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		["get", 42], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

test('Fail to build expression with number operator', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		[42, 24], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

test('Fail to build expression with non-string operator', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		[[], 24], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

/* // TODO: Re-activate once we have proper static typing
test('Fail to build operator expression with string argument', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		"foo", // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})
*/

test('Fail to evaluate expression with invalid accessor', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		["get", "foo"], // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.error).toBe(undefined);
	const continuousGrowthRateExpr = assertOk(maybeContinuousGrowthRateExpr);

	for (const ctx of allContexts) {
		expect(evalExpr(continuousGrowthRateExpr, ctx).result).toBe(undefined);
	}
})

test('Fail to evaluate expression with unknown operator', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["foo", // wrong
		1,
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.error).toBe(undefined);
	const continuousGrowthRateExpr = assertOk(maybeContinuousGrowthRateExpr);

	for (const ctx of allContexts) {
		expect(evalExpr(continuousGrowthRateExpr, ctx).result).toBe(undefined);
	}
})

test('Fail to evaluate expression with invalid argument count', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		// missing argument
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.error).toBe(undefined);
	const continuousGrowthRateExpr = assertOk(maybeContinuousGrowthRateExpr);

	for (const ctx of allContexts) {
		expect(evalExpr(continuousGrowthRateExpr, ctx).result).toBe(undefined);
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
})

test('Formatting expression builder is valid JSON that builds the same expression', () => {

	const builder = ["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	];

	const maybeExpr = makeExpr(builder);
	expect(maybeExpr.error).toBe(undefined);
	//const expr = assertOk(maybeExpr);

	const exprSrc = formatExpressionBuilder(builder);

	const newBuilder = JSON.parse(exprSrc);
	expect(newBuilder).toStrictEqual(builder);

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
	//const expr = assertOk(maybeExpr);

	const exprSrc = formatExpressionBuilder(builder);

	const newBuilder = JSON.parse(exprSrc);
	expect(newBuilder).toStrictEqual(builder);

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
