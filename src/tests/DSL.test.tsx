import { expect, test } from 'vitest'
import { Ok, assertOk } from '../utils/error.tsx'
import {
	makeConst,
	makeOp,
	makeAcc,
	makeExpr,
	evalExpr,
	makeContext,
	ExecutionContext,
} from '../models/DSL.tsx'

const allContexts: ExecutionContext[] = [
	makeContext("phytomer", { length: 0.1 }),
	makeContext("phytomer", { length: 0.5 }),
];

const continuousGrowthRateGroundTruth = (ctx: ExecutionContext) => ctx.get("length") < 0.3 ? 0.02 : 0.0;

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

test('Fail to build operator expression with string argument', () => {

	const maybeContinuousGrowthRateExpr = makeExpr(["if",
		"foo", // wrong
		0.02,
		0.0,
	]);

	expect(maybeContinuousGrowthRateExpr.result).toBe(undefined);
})

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
