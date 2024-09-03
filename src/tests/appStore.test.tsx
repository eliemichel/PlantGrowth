import { expect, test, vi } from 'vitest'
import { produce } from 'immer'
import { Matrix4 } from 'three'
import {
	type AppModel,
	useAppStore,
} from '../stores/appStore.tsx'
import {
	type SceneModel,
	createInitialScene,
	createTestScene,
} from '../models/SceneModel.tsx'
import {
	createDefaultGrowthModel,
} from '../models/GrowthModel.tsx'
import {
	deref,
} from '../utils/Collection.tsx'
import {
	type Vector,
} from '../utils/vector.tsx'
import {
	getPhytomerPosition,
} from '../backend/growth.tsx'
import {
	type ExpressionPath,
	formatExpressionPath,
} from '../models/Path.tsx'
import {
	forEachPathInScene,
} from '../backend/sceneReducer.tsx'
import {
	makeConst,
} from '../models/DSL.tsx'
import behaviors from '../backend/behaviors.tsx'
//import { resetMockRandom } from './setup.tsx'

import { validateAppState } from './validateAppState.ts'

import fs from 'node:fs/promises';

function subscribeWithSelector(
	selector: (state: AppModel) => any,
	listener: (newValue: AppModel, prevValue: AppModel) => void
) {
	const { subscribe } = useAppStore;
	return subscribe((newValue, prevValue) => {
		const newSelected = selector(newValue);
		const prevSelected = selector(prevValue);
		if (newSelected !== prevSelected) {
			listener(newSelected, prevSelected)
		}
	});
}

test('Setting the scene works', () => {
	const { getState } = useAppStore;
	
	const scene = createTestScene(1);

	const onSceneChange = vi.fn();
	const unsub = subscribeWithSelector(state => state.scene, onSceneChange);

	// Change scene
	getState().setScene(scene);

	// Change was notified
	expect(onSceneChange).toHaveBeenCalled();
	unsub();

	// Change is correct
	expect(getState().scene).toBe(scene);
	validateAppState(getState());
})

test('Direct store modification triggers notifications', () => {
	const { getState } = useAppStore;

	const onLogChange = vi.fn();
	const unsub0 = subscribeWithSelector(state => state.logEntries, onLogChange);
	const onSceneChange = vi.fn();
	const unsub1 = subscribeWithSelector(state => state.scene, onSceneChange);
	const onTemperatureChange = vi.fn();
	const unsub2 = subscribeWithSelector(state => state.scene.environment.temperature, onTemperatureChange);

	// Change scene
	useAppStore.setState(produce(getState(), store => { store.scene.environment.temperature = 42 }))

	// Change was notified
	expect(onLogChange).not.toHaveBeenCalled();
	expect(onSceneChange).toHaveBeenCalled();
	expect(onTemperatureChange).toHaveBeenCalled();
	unsub0();
	unsub1();
	unsub2();

	// Change is correct
	expect(getState().scene.environment.temperature).toBe(42);
	validateAppState(getState());
})

test('Setting a growth model updates references', () => {
	const { getState } = useAppStore;

	getState().setScene(createInitialScene());

	// A plant refers to the model that we will change
	const getPlant = () => getState().scene.plants.items[0];
	const getGrowthModels = () => getState().scene.growthModels.items[0];
	expect(getPlant().growthModelRef.index).toBe(0);
	expect(deref(getPlant().growthModelRef)).toBe(getGrowthModels());

	const newGrowthModel = {
		...createDefaultGrowthModel(),
		budDelay: 42,
	};

	const onGrowthModelCollectionChange = vi.fn();
	const unsub1 = subscribeWithSelector(state => state.scene.growthModels, onGrowthModelCollectionChange);
	const onGrowthModelChange = vi.fn();
	const unsub2 = subscribeWithSelector(state => state.scene.growthModels.items[0], onGrowthModelChange);

	// Update growth model
	getState().setGrowthModel(0, newGrowthModel);

	// Direct access works
	expect(getGrowthModels()).toBe(newGrowthModel);

	// Change was notified
	expect(onGrowthModelCollectionChange).toHaveBeenCalled();
	expect(onGrowthModelChange).toHaveBeenCalled();
	unsub1();
	unsub2();

	// Access through plant still works
	expect(getPlant().growthModelRef.index).toBe(0);
	expect(deref(getPlant().growthModelRef)).toBe(getGrowthModels());
	validateAppState(getState());
})

test('Iterating over expressions preserves integrity', () => {
	const { getState } = useAppStore;
	getState().setScene(createTestScene(0));

	// Clear all admonitions
	forEachPathInScene(getState().scene, _path => {});

	// Check integrity again
	validateAppState(getState());
})

test('Clearing node admonitions preserves integrity', () => {
	const { getState } = useAppStore;
	getState().setScene(createTestScene(0));

	// Apply growth
	const path: ExpressionPath = {
		domain: "model",
		index: 0,
		field: "merismaticGrowthLength",
	}
	const formattedPath = formatExpressionPath(path);
	// We did not try to edit this expression yet
	expect(getState().nodeGraphs[formattedPath]).toBe(undefined);
	getState().clearAllNodeAdmonitions(path);
	// Clearing admonitions does not count as trying to edit
	expect(getState().nodeGraphs[formattedPath]).toBe(undefined);

	// Check integrity
	validateAppState(getState());

	// Clear all admonitions
	forEachPathInScene(getState().scene, path => getState().clearAllNodeAdmonitions(path));

	// Check integrity again
	validateAppState(getState());
})

test('Growing using individual behavior preserves integrity', () => {
	const { getState } = useAppStore;
	getState().setScene(createTestScene(0));

	// Apply growth
	const behavior = behaviors.gravity;
	getState().applyBehavior(behavior, 100);

	// Check integrity
	validateAppState(getState());
})

test('Growing using schedule preserves integrity', () => {
	const { getState } = useAppStore;
	getState().setScene(createTestScene(0));

	// Apply growth
	getState().applyGrowthSchedule(100);

	// Check integrity
	validateAppState(getState());
})

test('Setting expression updates associated model', () => {
	const { getState } = useAppStore;
	getState().setScene(createTestScene(0));

	const onGrowthModelCollectionChange = vi.fn();
	const unsub1 = subscribeWithSelector(state => state.scene.growthModels, onGrowthModelCollectionChange);
	const onGrowthModelChange = vi.fn();
	const unsub2 = subscribeWithSelector(state => state.scene.growthModels.items[0], onGrowthModelChange);

	// Set model
	const path: ExpressionPath = {
		domain: "model",
		index: 0,
		field: "continuousGrowthRate",
	}
	getState().setExpression(path, makeConst(42));

	// Change was notified
	expect(onGrowthModelCollectionChange).toHaveBeenCalled();
	expect(onGrowthModelChange).toHaveBeenCalled();
	unsub1();
	unsub2();

	// Check integrity
	validateAppState(getState());
})

///////////////////////////////
// Check backward compatibility before refactoring

type OldSceneModel = {
	branches: {
		phytomers: {
			transform: {
				elements: number[]
			}
		}[]
	}[],
}

function validateSceneAgainstOldScene(scene: SceneModel, expectedScene: OldSceneModel) {
	const expectedPhytomerCount = expectedScene.branches.reduce((acc: number, branch) => acc + branch.phytomers.length - 1, 0);
	expect(scene.phytomers.items.length).toBe(expectedPhytomerCount);

	const expectedPhytomerPositions: Vector[] = [];
	for (const branch of expectedScene.branches) {
		for (const phytomer of branch.phytomers.slice(1)) {
			const transform = new Matrix4();
			transform.elements = phytomer.transform.elements;
			expectedPhytomerPositions.push(getPhytomerPosition({ transform }));
		}
	}
	expect(scene.phytomers.mapToArray(item => getPhytomerPosition(item))).toStrictEqual(expectedPhytomerPositions);

	// TODO: Add more checks (leafs, buds, etc.)
}

;
`
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
`

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

	//const jsonified = JSON.parse(JSON.stringify(getState().scene))
	//expect(jsonified).toStrictEqual(expectedScene);
	validateSceneAgainstOldScene(getState().scene, expectedScene)

	// Check idempotence
	/*
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
	*/
})

;
`
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

	//const jsonified = JSON.parse(JSON.stringify(getState().scene))
	//expect(jsonified).toStrictEqual(expectedScene);
	validateSceneAgainstOldScene(getState().scene, expectedScene)

	// Check idempotence
	/*
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
	*/
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

	//const jsonified = JSON.parse(JSON.stringify(getState().scene))
	//expect(jsonified).toStrictEqual(expectedScene);
	validateSceneAgainstOldScene(getState().scene, expectedScene)

	// Check idempotence
	/*
	resetMockRandom();
	getState().setScene(createScene());
	getState().applyGrowthSchedule(100);
	expect(JSON.parse(JSON.stringify(getState().scene))).toStrictEqual(expectedScene);
	*/
})
`
