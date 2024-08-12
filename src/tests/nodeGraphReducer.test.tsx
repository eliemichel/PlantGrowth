import { expect, test } from 'vitest'

import {
	createNodeGraphFromExpression,
	compileExpression,
} from '../reducers/nodeGraphReducer.tsx'

import {
	makeExpr,
} from '../models/DSL.tsx'

import {
	assertOk,
} from '../utils/error.tsx'

test('Can compile graph created from expression', async () => {
	const expr = assertOk(makeExpr(["if",
      ["<", ["get", "length"], 0.3],
      0.02,
      0.0,
    ]));
	const name = "Test";
	const path = "/";

	const nodeGraph = createNodeGraphFromExpression(expr, name, path);

	const newExpr = await compileExpression(nodeGraph);

	expect(newExpr).toStrictEqual(expr);
})
