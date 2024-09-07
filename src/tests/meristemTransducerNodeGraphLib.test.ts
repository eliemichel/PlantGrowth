import { expect, test } from 'vitest'
import { assertOk } from '../utils/error.ts'
import { compileMeristemTransducer } from '../backend/meristemTransducerNodeGraphLib.ts'

import {
	type GrowthModel,
	type MeristemStateType,
	createDefaultGrowthModel,
} from '../models/GrowthModel.ts'

import {
	type MeristemTransducerNodeGraph,
	createInitialMeristemTransducerNodeGraph,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import { validateGrowthModel } from './validateGrowthModel.ts'


test("Check that compileMeristemTransducer returns a valid transducer", () => {
	const nodeGraph: MeristemTransducerNodeGraph = createInitialMeristemTransducerNodeGraph();

	const meristemStateTypes: MeristemStateType[] = [
		{
			name: 'init2',
			dataFields: [],
		},
		{
			name: 'apical',
			dataFields: [],
		},
	];

	const maybeTransducer = compileMeristemTransducer(nodeGraph, meristemStateTypes)
	expect(maybeTransducer.error).toBe(undefined);
	const transducer = assertOk(maybeTransducer);

	const growthModel: GrowthModel = {
		...createDefaultGrowthModel(),
		meristemStateTypes,
		meristemStateTransition: transducer,
	}
	validateGrowthModel(growthModel);
})
