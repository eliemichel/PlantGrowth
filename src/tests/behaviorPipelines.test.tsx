import { expect, test, vi } from 'vitest'
import { Vector3, Matrix4, Quaternion } from 'three'
import { Vector } from '../utils/vector.tsx'
import {
	type SceneModel,
	type Leaf,
	type Phytomer,
	type SerializedPhytomer,
	deserializeScene,
} from '../models/SceneModel.tsx'
import {
	createDefaultEnvironment,
} from '../models/EnvironmentModel.tsx'
import {
	type GrowthModel,
	createDefaultGrowthModel,
	createDefaultMeristemState,
} from '../models/GrowthModel.tsx'
import {
	createPhytomersFromPositions,
	getPhytomerPosition,
} from '../backend/growth.tsx'
import {
	type GrowthBehavior,
	type Growth2Behavior,
	type OrganogenesisBehavior,
	type OrganogenesisMeristemHandlerOutput,
	type EvalContext,
	BehaviorFlag,
	applyGrowthBehavior,
	applyGrowth2Behavior,
	applyOrganogenesisBehavior,
} from '../backend/behaviorPipelines.tsx'

import customMatchers from './customMatchers.tsx'
expect.extend(customMatchers);

export function createSceneWithOneBranch(positions: Vector[]): SceneModel {
	const allTransforms = createPhytomersFromPositions(positions);

	function createPhytomerHyerarchy(transformIndex: number) {
		const { transform } = allTransforms[transformIndex];
		const phytomer: SerializedPhytomer = {
			transform,
			leaves: [],
			buds: [],
			children: [],
			meristem: null,
			differentiation: "",
		}
		if (transformIndex === allTransforms.length - 1) {
			phytomer.meristem = { state: createDefaultMeristemState() };
		} else {
			phytomer.children.push(createPhytomerHyerarchy(transformIndex + 1))
		}
		return phytomer;
	}

	return deserializeScene({
		environment: createDefaultEnvironment(),
		growthModels: [
			createDefaultGrowthModel(),
		],
		plants: [
			{
				growthModelIndex: 0,
				transform: allTransforms[0].transform,
				shoot: createPhytomerHyerarchy(1),
			},
		],
	})
}

function getLastPhytomer(scene: SceneModel): Phytomer {
	return scene.phytomers.items[scene.phytomers.items.length - 1];
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
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer): Vector => {
			return [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, phytomer: Phytomer, leafIndex: number): Leaf => {
			return phytomer.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer, phytomerIndex: number): Vector => {
			return phytomerIndex == 2 ? [ 0, 0, 1 ] : [ 0, 0, 0 ];
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, phytomer: Phytomer, leafIndex: number): Leaf => {
			return phytomer.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
		handlePhytomer: (context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer, _phytomerIndex: number): Vector => {
			context.onEvalError({ location: '', message: '' });
			return [ 0, 0, 0 ]
		},
		handleLeaf: (_context: EvalContext, _growthModel: GrowthModel, phytomer: Phytomer, leafIndex: number): Leaf => {
			return phytomer.leaves[leafIndex];
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowthBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer, _phytomerIndex: number): Matrix4 => {
			return new Matrix4();
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 1 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer, phytomerIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (phytomerIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
	getLastPhytomer(scene).leaves.push({
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
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, _phytomer: Phytomer, phytomerIndex: number): Matrix4 => {
			const tr = new Matrix4();
			if (phytomerIndex == 2) {
				tr.makeRotationX(Math.PI / 4);
			}
			return tr;
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyGrowth2Behavior(scene, context, rotateBehavior, { repeat: 2 });
	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

	expect(newPositions).toBeCloseToVectorArray(expectedPositions, 6);

	const newLeafOrientation = getLastPhytomer(newScene).leaves[0].orientation;

	expect(newLeafOrientation).toBeCloseToQuaternion(expectedOrientation, 6);
})

test('Inactive phytomers are ignored', () => {

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
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 2, 5+4, 6 ], // latest one is affected
	];

	const scene = createSceneWithOneBranch(positions);

	const offsetBehavior: OrganogenesisBehavior = {
		name: "organogenesis",
		flags: BehaviorFlag.None,
		type: "organogenesis",
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, phytomer: Phytomer, _phytomerIndex: number): OrganogenesisMeristemHandlerOutput => {
			const position = getPhytomerPosition(phytomer);
			const newTransform = new Matrix4();
			newTransform.copy(phytomer.transform)
			newTransform.setPosition(
				position[0] + 1,
				position[1] + 2,
				position[2] + 3,
			)
			return {
				phytomer: {
					...phytomer,
					transform: newTransform,
				},
				newPhytomers: null,
			}
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyOrganogenesisBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

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
		[ 2, 1+4, 6 ],
		[ 2, 2+4, 6 ],
		[ 2, 3+4, 6 ],
		[ 2, 4+4, 6 ],
		[ 2, 5+4, 6 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const offsetBehavior: OrganogenesisBehavior = {
		name: "organogenesis",
		flags: BehaviorFlag.BypassActive,
		type: "organogenesis",
		handlePhytomer: (_context: EvalContext, _growthModel: GrowthModel, phytomer: Phytomer, _phytomerIndex: number): OrganogenesisMeristemHandlerOutput => {
			const position = getPhytomerPosition(phytomer);
			const newTransform = new Matrix4();
			newTransform.copy(phytomer.transform)
			newTransform.setPosition(
				position[0] + 1,
				position[1] + 2,
				position[2] + 3,
			)
			return {
				phytomer: {
					...phytomer,
					transform: newTransform,
				},
				newPhytomers: null,
			}
		},
	}

	const context = {
		onEvalError: vi.fn(),
	}

	const newScene = applyOrganogenesisBehavior(scene, context, offsetBehavior, { repeat: 2 });

	expect(newScene.plants.items.length).toStrictEqual(1);
	expect(newScene.phytomers.items.length).toStrictEqual(positions.length - 1);
	expect(context.onEvalError).not.toHaveBeenCalled();

	const newPositions = [
		getPhytomerPosition(newScene.plants.items[0]),
		...newScene.phytomers.mapToArray(getPhytomerPosition)
	];

	expect(newPositions).toStrictEqual(expectedPositions);
})
