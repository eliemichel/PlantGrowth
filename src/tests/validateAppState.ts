import { expect } from 'vitest'

import {
	formatExpressionPath,
} from '../models/Path.tsx'

import {
	getExpressionFromPath,
	forEachPathInScene,
} from '../backend/sceneReducer.tsx'

import {
	compileExpression,
} from '../backend/nodeGraphReducer.tsx'

import {
	assertOk,
} from '../utils/error.tsx'

import {
	validateScene,
} from './validateScene.ts'

import {
	type AppState,
} from '../stores/appStore.tsx'

/**
 * Check that each node graph compiles in the appropriate expression.
 */
export function validateAppStateNodeGraphs(state: AppState) {
	const { scene, nodeGraphs } = state;

	forEachPathInScene(scene, path => {
		const formattedPath = formatExpressionPath(path);
		const nodeGraph = nodeGraphs[formattedPath];
		if (nodeGraph === undefined) return;
		console.log("nodeGraph", nodeGraph, "path", path);
		expect(nodeGraph.path).toStrictEqual(formattedPath);

		const maybeExpr = compileExpression(nodeGraph);
		expect(maybeExpr.error).toBe(undefined);
		const expr = assertOk(maybeExpr);

		const maybeExpectedExpr = getExpressionFromPath(scene, path);
		expect(maybeExpectedExpr.error).toBe(undefined);
		const expectedExpr = assertOk(maybeExpectedExpr);

		expect(expr).toStrictEqual(expectedExpr);
	})
}

export function validateAppState(state: AppState) {
	const { scene } = state;
	validateScene(scene);
	validateAppStateNodeGraphs(state);
}
