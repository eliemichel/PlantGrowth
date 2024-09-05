import { expect, test } from 'vitest'
import { Vector3, Matrix4 } from 'three'

import { Vector } from '../utils/vector.ts'
import { Collection } from '../utils/Collection.ts'

import {
	createPhytomersFromPositions,
	getPhytomerPosition,
	relativeToWorldDirection,
	getPhytomersFromPlant,
} from '../backend/growth.ts'

import {
  type RelativeVector,
} from '../models/GrowthModel.ts'

import {
  type Phytomer,
  type Plant,
} from '../models/SceneModel.ts'

import {
	createSceneWithOneBranch,
} from './behaviorPipelines.test.ts'

import customMatchers from './customMatchers.ts'
expect.extend(customMatchers);

test('Phytomer from/to position conversion matches', () => {

	const positions: Vector[] = [
		[ -0.15836200065504882, 0.24527033182786212, -0.07510513951081026 ],
		[ -0.3866173252471148, 0.38731865777052055, -0.2187685872368062 ],
		[ -0.6420273602882245, 0.42546443644552684, -0.3807192583988513 ],
		[ -0.8907110346726348, 0.3879343482736743, -0.5529555173478355 ],
		[ -1.1273470336794469, 0.29287248636556, -0.7199407044300131 ],
		[ -1.3270357613852732, 0.4320996369905107, -0.8501898843111934 ],
		[ -1.4166332763963185, 0.6436530276172571, -0.9025632118304981 ],
		[ -1.4312935226534635, 0.844214924453433, -0.9052712163348196 ],
		[ -1.4098998668195877, 1.0134009622872768, -0.8857242287745223 ],
		[ -1.3764206943964314, 1.1536809208312961, -0.8599680861238512 ],
		[ -1.3430157823827968, 1.271716875222336, -0.8357598281072526 ],
		[ -1.315018476382948, 1.3728328152654115, -0.8162523611086007 ],
		[ -1.2941375759736025, 1.4603744721503373, -0.8022314022800985 ],
		[ -1.2886586019081896, 1.490278559257849, -0.7987198166756899 ],
	];

	const phytomers = createPhytomersFromPositions(positions);

	const newPositions = phytomers.map(getPhytomerPosition);

	expect(newPositions).toStrictEqual(positions);
})

test('Conversion from relative to world direction', () => {
	const X = new Vector3(1.0, 0.0, 0.0);
	const Y = new Vector3(0.0, 0.0, -1.0);
	const Z = new Vector3(0.0, 1.0, 0.0);
	const rotation = new Matrix4();
	rotation.makeRotationZ(Math.PI / 6);
	X.applyMatrix4(rotation);
	Y.applyMatrix4(rotation);
	Z.applyMatrix4(rotation);
	const phytomerTransform = new Matrix4();
	phytomerTransform.makeBasis(X, Y, Z);
	phytomerTransform.setPosition(1.1, 2.2, 3.3);

	const phytomer: Phytomer = {
		transform: phytomerTransform,
		leaves: [],
		buds: [],
		children: [],
		plantRef: { collection: new Collection<Plant>(), index: -1 },
		differentiation: 'init',
		meristem: {
			state: {
				type: 'init',
				data: {},
			}
		}
	};

	{
		const relativeDirection: RelativeVector = {
			frame: "growth",
			coords: [ 0, 0, 1 ],
		};

		const worldDirection = relativeToWorldDirection(relativeDirection, phytomer);

		expect(worldDirection).toBeCloseToVector([ -Math.sqrt(3)/2, 0.5, 0.0 ], 1e-4);
	}

	{
		const relativeDirection: RelativeVector = {
			frame: "growth",
			coords: [ 0, 1, 0 ],
		};

		const worldDirection = relativeToWorldDirection(relativeDirection, phytomer);

		expect(worldDirection).toBeCloseToVector([ 0.5, Math.sqrt(3)/2, 0.0 ], 1e-4);
	}

	{
		const relativeDirection: RelativeVector = {
			frame: "growth",
			coords: [ 1, 0, 0 ],
		};

		const worldDirection = relativeToWorldDirection(relativeDirection, phytomer);

		expect(worldDirection).toBeCloseToVector([ 0, 0, 1 ], 1e-4);
	}
})

test("Can list all phytomers", () => {

	const positions: Vector[] = [
		[ 0, 0, 0 ],
		[ 0, 1, 0 ],
		[ 0, 2, 0 ],
		[ 0, 3, 0 ],
		[ 0, 4, 0 ],
		[ 0, 5, 0 ],
	];

	const scene = createSceneWithOneBranch(positions);

	const phytomers = getPhytomersFromPlant(scene, scene.plants.items[0]);

	expect(phytomers.length).toBe(positions.length - 1);
})
