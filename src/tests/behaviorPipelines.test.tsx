import { expect, test, vi } from 'vitest'
import { Vector3, Matrix4, Quaternion } from 'three'
import { Vector } from '../utils/vector.tsx'
import { Collection } from '../utils/Collection.tsx'
import {
	type SceneModel,
	type Branch,
	type Leaf,
	createInitialScene,
} from '../models/SceneModel.tsx'
import {
	type GrowthModel,
	createDefaultMeristemState,
} from '../models/GrowthModel.tsx'
import {
	createPhytomersFromPositions,
	getPhytomerPosition,
} from '../backend/growth.tsx'
import {
	type GrowthBehavior,
	type Growth2Behavior,
	type EvalContext,
	BehaviorFlag,
	applyGrowthBehavior,
	applyGrowth2Behavior,
} from '../backend/behaviorPipelines.tsx'

import customMatchers from './customMatchers.tsx'
expect.extend(customMatchers);

function createSceneWithOneBranch(positions: Vector[]): SceneModel {
	const initialScene = createInitialScene();
	return {
		...initialScene,
		plants: new Collection([
			{ growthModelRef: initialScene.growthModels.createRef(0), shoot: 0 },
		]),
		branches: [{
			phytomers: createPhytomersFromPositions(positions),
			growthModelIndex: 0,
			active: true,
			leaves: [],
			buds: [],
			children: [],
			meristemState: createDefaultMeristemState(),
		}],
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
		name: "offset",
		flags: BehaviorFlag.None,
		type: "growth",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, _nodeIndex: number): Vector => {
			return [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

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
		name: "offset",
		flags: BehaviorFlag.None,
		type: "growth",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Vector => {
			return nodeIndex == 2 ? [ 0, 0, 1 ] : [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(expectedPositions);
})

test('Growth behavior calls error callback', () => {

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
		name: "offset",
		flags: BehaviorFlag.None,
		type: "growth",
		handleNode: (context: EvalContext, _growthModel: GrowthModel, _branch: Branch, _nodeIndex: number): Vector => {
			context.onEvalError({ location: '', message: '' });
			return [ 0, 0, 0 ]
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).toHaveBeenCalled();

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(positions);
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
		name: "rotate",
		flags: BehaviorFlag.None,
		type: "growth2",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, _nodeIndex: number): Matrix4 => {
			return new Matrix4();
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 1 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

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
		name: "rotate",
		flags: BehaviorFlag.None,
		type: "growth2",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (nodeIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

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
		name: "rotate",
		flags: BehaviorFlag.None,
		type: "growth2",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (nodeIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 2 });
	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toBeCloseToVectorArray(expectedPositions, 6);

	const newLeafOrientation = newScene.branches[0].leaves[0].orientation;

	expect(newLeafOrientation).toBeCloseToQuaternion(expectedOrientation, 6);
})

test('Inactive branches are ignored', () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const expectedPositions = positions;

	const scene = createSceneWithOneBranch(positions);
	scene.branches[0].active = false;

	const offsetBehavior: GrowthBehavior = {
		name: "offset",
		flags: BehaviorFlag.None,
		type: "growth",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Vector => {
			return nodeIndex == 2 ? [ 0, 0, 1 ] : [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(expectedPositions);
})

test('Can bypass active', () => {

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
	scene.branches[0].active = false;

	const offsetBehavior: GrowthBehavior = {
		name: "offset",
		flags: BehaviorFlag.BypassActive,
		type: "growth",
		handleNode: (_context: EvalContext, _growthModel: GrowthModel, _branch: Branch, nodeIndex: number): Vector => {
			return nodeIndex == 2 ? [ 0, 0, 1 ] : [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf => {
			return branch.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.branches.length).toStrictEqual(1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = newScene.branches[0].phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(expectedPositions);
})
