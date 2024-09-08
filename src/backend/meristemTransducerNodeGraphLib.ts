import {
	type MeristemTransducerNodeGraph,
	type CompilationError,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import {
	type MeristemTransducer,
	type MeristemState,
	type MeristemAction,
	type MeristemStateType,
	createDefaultMeristemActions,
	createDefaultMeristemState,
} from '../models/GrowthModel.ts'

import { compileKernel } from '../backend/typejit.ts'

import { type ResultOrError, Ok } from '../utils/error.ts'

export function compileMeristemTransducer(
	_nodeGraph: MeristemTransducerNodeGraph,
	meristemStateTypes: MeristemStateType[],
): ResultOrError<MeristemTransducer,CompilationError> {
	const source = [];
	source.push(
		`let actions = createDefaultMeristemActions();`,
		`let nextState = createDefaultMeristemState();`,
		`switch (state.type) {`,
	)

	for (const type of meristemStateTypes) {
		source.push(
			`case '${type.name}': {`,
			`nextState = state`, // TODO: extract from nodeGraph
			`break;`,
			`}`,
		)
	}

	source.push(
		`}`, // end switch (state.type)
		`return [ nextState, [] ]`
	)

	const kernel = compileKernel<[MeristemState, MeristemAction[]], [MeristemState]>({
		args: [ "state" ],
		source: source.join("\n"),
		closure: {
			createDefaultMeristemActions,
			createDefaultMeristemState,
		}
	});

	return Ok(kernel.fn);
}

export function createMeristemTransducerNodeGraphFromStates(
	growthModelIndex: number,
	_meristemStateTypes: MeristemStateType[]
): MeristemTransducerNodeGraph {
	// TODO: This is a mock value
	return {
		nodes: [
			{
				type: "input-state",
				id: '1234',
				position: { x: 0, y: 0 },
				data: {
					admonition: null,
					label: "current state",
					growthModelIndex,
				}
			},
			{
				type: "output-state",
				id: '4321',
				position: { x: 200, y: 0 },
				data: {
					admonition: null,
					label: "set state",
					growthModelIndex,
					typeName: "init",
				}
			}
		],
		edges: [],
	}
}
