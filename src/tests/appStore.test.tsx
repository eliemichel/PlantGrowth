import { expect, test } from 'vitest'
test('Mock', () => {
	expect(true).toBe(true)
});

`
import {
	useAppStore,
} from '../stores/appStore.tsx'
import {
	createInitialScene,
	createTestScene,
} from '../models/SceneModel.tsx'
import { resetMockRandom } from './setup.tsx'

import fs from 'node:fs/promises';

test('Setting the scene works', () => {
	const { getState } = useAppStore;

	const scene = createTestScene(1);

	getState().setScene(scene);

	expect(getState().scene).toBe(scene);
})

test('Growing initial scene works', async () => {
	const { getState } = useAppStore;
	const createScene = () => createInitialScene();

	getState().setScene(createScene());

	getState().applyGrowthSchedule(100);

	const groundTruthPath = "src/tests/data/appStore.001.expected.json";
	// Uncomment to record ground truth
	/*
	await fs.writeFile(
		groundTruthPath,
		JSON.stringify(getState().scene, null, 2),
		{ encoding: 'utf8' },
	)
	//*/

	const expectedScene = JSON.parse(await fs.readFile(
		groundTruthPath,
		{ encoding: 'utf8' },
	));

	const jsonified = JSON.parse(JSON.stringify(getState().scene))

	expect(jsonified).toStrictEqual(expectedScene);

	// Check idempotence
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
})

test('Growing preset scene #0 works', async () => {
	const { getState } = useAppStore;
	const createScene = () => createTestScene(0);

	getState().setScene(createScene());

	getState().applyGrowthSchedule(100);

	const groundTruthPath = "src/tests/data/appStore.002.expected.json";
	// Uncomment to record ground truth
	/*
	await fs.writeFile(
		groundTruthPath,
		JSON.stringify(getState().scene, null, 2),
		{ encoding: 'utf8' },
	)
	//*/

	const expectedScene = JSON.parse(await fs.readFile(
		groundTruthPath,
		{ encoding: 'utf8' },
	));

	const jsonified = JSON.parse(JSON.stringify(getState().scene))

	expect(jsonified).toStrictEqual(expectedScene);

	// Check idempotence
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
})

test('Growing preset scene #1 works', async () => {
	const { getState } = useAppStore;
	const createScene = () => createTestScene(1);

	getState().setScene(createScene());

	getState().applyGrowthSchedule(100);

	const groundTruthPath = "src/tests/data/appStore.003.expected.json";
	// Uncomment to record ground truth
	/*
	await fs.writeFile(
		groundTruthPath,
		JSON.stringify(getState().scene, null, 2),
		{ encoding: 'utf8' },
	)
	//*/

	const expectedScene = JSON.parse(await fs.readFile(
		groundTruthPath,
		{ encoding: 'utf8' },
	));

	const jsonified = JSON.parse(JSON.stringify(getState().scene))

	expect(jsonified).toStrictEqual(expectedScene);

	// Check idempotence
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
})

test('Growing preset scene #2 works', async () => {
	const { getState } = useAppStore;
	const createScene = () => createTestScene(2);

	getState().setScene(createScene());

	getState().applyGrowthSchedule(100);

	const groundTruthPath = "src/tests/data/appStore.004.expected.json";
	// Uncomment to record ground truth
	/*
	await fs.writeFile(
		groundTruthPath,
		JSON.stringify(getState().scene, null, 2),
		{ encoding: 'utf8' },
	)
	//*/

	const expectedScene = JSON.parse(await fs.readFile(
		groundTruthPath,
		{ encoding: 'utf8' },
	));

	const jsonified = JSON.parse(JSON.stringify(getState().scene))

	expect(jsonified).toStrictEqual(expectedScene);

	// Check idempotence
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
})
`
