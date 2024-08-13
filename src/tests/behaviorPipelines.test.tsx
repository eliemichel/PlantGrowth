import { expect, test } from 'vitest'
import { Vector3, Matrix4, Quaternion } from 'three'
import { Vector } from '../utils/vector.tsx'
import {
	type SimulationModel,
	type GrowthModel,
	type Branch,
	type Leaf,
	createDefaultMeristemState,
	createInitialScene,
} from '../models/SimulationModel.tsx'
import {
	createPhytomersFromPositions,
	getPhytomerPosition,
} from '../reducers/growth.tsx'
import {
	type GrowthBehavior,
	type Growth2Behavior,
	applyGrowthBehavior,
	applyGrowth2Behavior,
} from '../reducers/behaviorPipelines.tsx'

import customMatchers from './customMatchers.tsx'
expect.extend(customMatchers);

function createSceneWithOneBranch(positions: Vector[]): SimulationModel {
	return {
		...createInitialScene(),
		branches: [{
			phytomers: createPhytomersFromPositions(positions),
			growthModelIndex: 0,
			active: true,
			leaves: [],
			buds: [],
			children: [],
			meristemState: createDefaultMeristemState(),
		}],
		plants: [ { shoot: 0 } ]
	}
}

test('Growth behavior with identity handlers is identity', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const offsetBehavior: GrowthBehavior = {
		type: "growth",
		handleNode: (_growthModel: GrowthModel, _branch: Branch, _nodeIndex: number): Vector => {
			return [ 0, 0, 0 ];
		},
		handleLeaf: (_growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const newScene = applyGrowthBehavior(scene, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(positions);
})

test('Growth behavior moves all children', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const expectedPositions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 2 ],
		[ 0, 4, 2 ],
		[ 0, 5, 2 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const offsetBehavior: GrowthBehavior = {
		type: "growth",
		handleNode: (_growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Vector => {
			return nodeIndex == 2 ? [ 0, 0, 1 ] : [ 0, 0, 0 ];
		},
		handleLeaf: (_growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const newScene = applyGrowthBehavior(scene, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(expectedPositions);
})

test('Growth2 behavior with identity handlers is identity', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const rotateBehavior: Growth2Behavior = {
		type: "growth2",
		handleNode: (_growthModel: GrowthModel, _branch: Branch, _nodeIndex: number): Matrix4 => {
			return new Matrix4();
		},
	}

	const newScene = applyGrowth2Behavior(scene, rotateBehavior, { repeat: 1 });

	expect(newScene.branches.length).toStrictEqual(1);

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(positions);
})

test('Growth2 behavior rotates all children', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const expectedPositions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 2, 1 ],
		[ 0, 2, 2 ],
		[ 0, 2, 3 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const rotateBehavior: Growth2Behavior = {
		type: "growth2",
		handleNode: (_growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (nodeIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const newScene = applyGrowth2Behavior(scene, rotateBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toBeCloseToVectorArray(expectedPositions, 6);
})

test('Growth2 behavior rotates leaves', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const expectedPositions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 2, 1 ],
		[ 0, 2, 2 ],
		[ 0, 2, 3 ],
	];

	const scene = createSceneWithOneBranch(positions);
	scene.branches[0].leaves.push({
      anchor: positions.length - 2, // last phytomer
      size: 0.05,
      orientation: new Quaternion(),
    });

    const expectedOrientation = new Quaternion();
    const X = new Vector3(1, 0, 0);
    expectedOrientation.setFromAxisAngle(X, Math.PI / 2);

	const rotateBehavior: Growth2Behavior = {
		type: "growth2",
		handleNode: (_growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (nodeIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const newScene = applyGrowth2Behavior(scene, rotateBehavior, { repeat: 2 });
	expect(newScene.branches.length).toStrictEqual(1);

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toBeCloseToVectorArray(expectedPositions, 6);

	const newLeafOrientation = newScene.branches[0].leaves[0].orientation;

	expect(newLeafOrientation).toBeCloseToQuaternion(expectedOrientation, 6);
})
