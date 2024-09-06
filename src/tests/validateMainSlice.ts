import { expect } from 'vitest'

import {
	formatExpressionPath,
} from '../models/Path.ts'

import {
	getExpressionFromPath,
	forEachPathInScene,
} from '../backend/sceneLib.ts'

import {
	compileExpression,
} from '../backend/expressionNodeGraphLib.ts'

import {
	assertOk,
} from '../utils/error.ts'

import {
	type MainState,
} from '../store/mainSlice.ts'

import {
	validateScene,
} from './validateScene.ts'

/**
 * Check that each node graph compiles in the appropriate expression.
 */
export function validateAllNodeGraphs(state: MainState) {
	const { scene, nodeGraphs } = state;

	forEachPathInScene(scene, path => {
		const formattedPath = formatExpressionPath(path);
		const nodeGraph = nodeGraphs[formattedPath];
		if (nodeGraph === undefined) return;

		const maybeExpr = compileExpression(nodeGraph);
		expect(maybeExpr.error).toBe(undefined);
		const expr = assertOk(maybeExpr);

		const maybeExpectedExpr = getExpressionFromPath(scene, path);
		expect(maybeExpectedExpr.error).toBe(undefined);
		const expectedExpr = assertOk(maybeExpectedExpr);

		expect(expr).toStrictEqual(expectedExpr);
	})
}

export function validateMainSlice(state: MainState) {
	const { scene } = state;
	validateScene(scene);
	validateAllNodeGraphs(state);
}
