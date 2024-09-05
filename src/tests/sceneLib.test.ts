import { expect, test } from 'vitest'

import { Vector } from '../utils/vector.ts'
import { assertOk } from '../utils/error.ts'

import {
	getExpressionFromPath,
} from '../backend/sceneLib.ts'

import {
	parseExpressionPath,
} from '../models/Path.ts'

import {
	createSceneWithOneBranch,
} from './behaviorPipelines.test.ts'

test('Getting an expression from path', async () => {
	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const maybePath = parseExpressionPath("/model/0/continuousGrowthRate");
	expect(maybePath.result).toBeDefined();
	const path = assertOk(maybePath);

	const maybeExpression = getExpressionFromPath(scene, path);

	expect(maybeExpression.result).toBeDefined();
})

test('Fail to get expression from path with invalid index', async () => {
	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const maybePath = parseExpressionPath("/model/42/continuousGrowthRate");
	expect(maybePath.result).toBeDefined();
	const path = assertOk(maybePath);

	const maybeExpression = getExpressionFromPath(scene, path);
	expect(maybeExpression.error).toBeDefined();
})

test('Fail to get expression from path with invalid field', async () => {
	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const maybePath = parseExpressionPath("/model/0/foo");
	expect(maybePath.result).toBeDefined();
	const path = assertOk(maybePath);

	const maybeExpression = getExpressionFromPath(scene, path);
	expect(maybeExpression.error).toBeDefined();
})
