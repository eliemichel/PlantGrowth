import { expect } from 'vitest'

import {
	type Scene,
	type Plant,
	type Phytomer,
} from '../models/SceneModel.ts'

import {
	type GrowthModel,
} from '../models/GrowthModel.ts'

import {
	type ItemReference,
	isValidRef,
	isRefOf,
} from '../utils/Collection.ts'

import { validateCollection } from './validateCollection.ts'

import { validateGrowthModel } from './validateGrowthModel.ts'

/**
 * This function lists all references in a scene that point to a growth model.
 * It also tells whether they are allowed to be invalid.
 * Update this whenever the structure of the scene changes so that tests remain
 * consistent.
 */
function forEachGrowthModelReference(
	scene: Scene,
	handler: (reference: ItemReference<GrowthModel>, mustBeValid: boolean, context: string) => void,
) {
	// Readability helpers
	//const canBeInvalid = false;
	const mustBeValid = true;

	// Each plant references a growth model
	scene.plants.items.forEach((plant, idx) => {
		handler(plant.growthModelRef, mustBeValid, `plants[${idx}].growthModelRef`);
	})
}

/**
 * This function lists all references in a scene that point to a plant.
 * It also tells whether they are allowed to be invalid.
 * Update this whenever the structure of the scene changes so that tests remain
 * consistent.
 */
function forEachPlantReference(
	scene: Scene,
	handler: (reference: ItemReference<Plant>, mustBeValid: boolean, context: string) => void,
) {
	// Readability helpers
	//const canBeInvalid = false;
	const mustBeValid = true;

	// Each phytomer references a plant
	scene.phytomers.items.forEach((phytomer, idx) => {
		handler(phytomer.plantRef, mustBeValid, `phytomers[${idx}].plantRef`);
	})
}

/**
 * This function lists all references in a scene that point to a plant.
 * It also tells whether they are allowed to be invalid.
 * Update this whenever the structure of the scene changes so that tests remain
 * consistent.
 */
function forEachPhytomerReference(
	scene: Scene,
	handler: (reference: ItemReference<Phytomer>, mustBeValid: boolean, context: string) => void,
) {
	// Readability helpers
	//const canBeInvalid = false;
	const mustBeValid = true;

	// Each phytomer references children
	scene.phytomers.items.forEach((phytomer, idx) => {
		phytomer.children.forEach((childRef, childIdx) => {
			handler(childRef, mustBeValid, `phytomers[${idx}].children[${childIdx}]`);
		})
	})

	// Each plant references a shoot
	scene.plants.items.forEach((plant, idx) => {
		handler(plant.shoot, mustBeValid, `plants[${idx}].shoot`);
	})
}

export function validateScene(scene: Scene) {
	// Collections are sound
	validateCollection(scene.growthModels);
	validateCollection(scene.plants);
	validateCollection(scene.phytomers);

	// References to growth models are sound
	forEachGrowthModelReference(scene, (ref, mustBeValid, context) => {
		if (mustBeValid) expect(isValidRef(ref), context).toBe(true);
		expect(isRefOf(ref, scene.growthModels), context).toBe(true);
	})

	// References to plants are sound
	forEachPlantReference(scene, (ref, mustBeValid, context) => {
		if (mustBeValid) expect(isValidRef(ref), context).toBe(true);
		expect(isRefOf(ref, scene.plants), context).toBe(true);
	})

	// References to phytomers are sound
	forEachPhytomerReference(scene, (ref, mustBeValid, context) => {
		if (mustBeValid) expect(isValidRef(ref), context).toBe(true);
		expect(isRefOf(ref, scene.phytomers), context).toBe(true);
	})

	// Check that a phytomer has one and only one parent
	const referencedPhytomerIndices = new Set();
	scene.phytomers.items.forEach((phytomer, idx) => {
		phytomer.children.forEach((childRef, childIdx) => {
			expect(referencedPhytomerIndices.has(childRef.index), `phytomers[${idx}].children[${childIdx}]`).toBe(false);
			referencedPhytomerIndices.add(childRef.index);
		})
	})
	scene.plants.items.forEach((plant, idx) => {
		expect(referencedPhytomerIndices.has(plant.shoot.index), `plant[${idx}].shoot`).toBe(false);
		referencedPhytomerIndices.add(plant.shoot.index);
	})
	expect(referencedPhytomerIndices.size).toBe(scene.phytomers.items.length);

	// Validate growth models
	for (const growthModel of scene.growthModels.items) {
		validateGrowthModel(growthModel);
	}
}
