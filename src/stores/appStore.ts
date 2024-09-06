import { create } from 'zustand'
import { type Draft, produce } from 'immer'

import {
	type Connection,
	type NodeChange,
	type EdgeChange,
	applyNodeChanges,
	applyEdgeChanges,
	addEdge,
} from '@xyflow/react';

import {
	type Scene,
	type Phytomer,
	createInitialScene,
} from '../models/SceneModel.ts'

import {
	type GrowthModel,
	isExpressionKeyOfGrowthModel,
	allExpressionKeysOfGrowthModel,
} from '../models/GrowthModel.ts'

import {
	type SelectionModel,
	createDefaultSelection,
} from '../models/SelectionModel.ts'

import {
	type NodeGraphModel,
	type Node,
	type Edge,
	createInitialNodeGraph,
	isConstantNode,
	isConstantStringNode,
	isAccessorNode,
} from '../models/ExpressionNodeGraphModel.ts'
import {
	type MeristemTransducerNodeGraph,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import {
	type Environment
} from '../models/EnvironmentModel.ts'

import {
	type LogEntry,
	LogLevel,
} from '../models/LogModel.ts'

import {
	type NodeId,
	type Expression,
	type EvalError,
} from '../models/DSL.ts'

import {
	type ExpressionPath,
	type FormattedPath,
	formatExpressionPath,
} from '../models/Path.ts'

import {
	forEachPathInScene
} from '../backend/sceneLib.ts'

import {
	type ResultOrError,
	Ok,
	Err,
	isOk,
} from '../utils/error.ts'

import groupBy from '../utils/groupBy.ts'

import {
	updateNodeGraphFromExpression,
	compileExpression,
	removeEdgesByTarget,
} from '../backend/expressionNodeGraphLib.ts'

import {
	applyBehavior,
	type Behavior,
} from '../backend/behaviorPipelines.ts'

import behaviors from '../backend/behaviors.ts'

// Data storage for the whole application
export type AppState = {
	scene: Scene,

	nodeGraphs: { [key: FormattedPath]: NodeGraphModel },

	meristemTransducerNodeGraphs: { [key: FormattedPath]: MeristemTransducerNodeGraph },

	selection: SelectionModel,

	logEntries: LogEntry[],
}

// Suite of functions that only query the model (read-only)
// NB: Querying does not tie re-rendering to the returned value (unlike, e.g., useMemo)
type AppQueryFunctions = {
	getExpression: (path: ExpressionPath) => ResultOrError<Expression,string>,

	// Get the node graph associated to a path, create it if needed
	// NB: This is not so read-only...
	ensureNodeGraph: (path: ExpressionPath) => NodeGraphModel,
}

// Suite of functions that modify the model
type AppActionFunctions = {
	setScene: (scene: Scene) => void,

	setNodeGraph: (path: ExpressionPath, nodeGraph: NodeGraphModel) => void,

	setExpression: (path: ExpressionPath, expression: Expression) => void,

	setEnvironment: (environment: Environment) => void,

	setGrowthModel: (index: number, growthModel: GrowthModel) => void,

	setActiveExpression: (path: ExpressionPath, name: string) => void,
	setActiveGrowthModel: (growthModelIndex: number) => void,

	// Update both expression node and graph node (there may only exist one of these)
	setConstantNodeValue: (path: ExpressionPath, nodeId: NodeId, value: number) => void,
	setConstantStringNodeValue: (path: ExpressionPath, nodeId: NodeId, value: string) => void,
	setAccessorNodeIdentifier: (path: ExpressionPath, nodeId: NodeId, identifier: string) => void,
	setNodeAdmonition: (path: ExpressionPath, nodeId: NodeId, admonition: LogEntry) => void,
	clearAllNodeAdmonitions: (path: ExpressionPath) => void,

	// Node graph manipulation, connecting to @xyflow/react
	applyNodeChanges: (path: ExpressionPath, changes: NodeChange<Node>[]) => void,
	applyEdgeChanges: (path: ExpressionPath, changes: EdgeChange<Edge>[]) => void,
	connectNodes: (path: ExpressionPath, connection: Connection) => void,
	addNode: (path: ExpressionPath, node: Node) => void,

	// Scene manipulation
	// Apply an individual behavior
	applyBehavior: (behavior: Behavior, stepCount: number) => void,
	// Apply behaviors as planned in each plant's growth model's schedule
	applyGrowthSchedule: (stepCount: number) => void,

	log: (level: LogLevel, message: string) => void,
}

// Main store type
export type AppModel = AppState & AppQueryFunctions & AppActionFunctions;

function createDefaultState(): AppState {
	return {

		scene: createInitialScene(),

		nodeGraphs: {},

		meristemTransducerNodeGraphs: {},

  		selection: createDefaultSelection(),

		logEntries: [],

	}
}

export const useAppStore = create<AppModel>()((set, get) => {

	// We first define some private utility functions:

	// Utility to log errors
	function logError(message: string) {
		get().log(LogLevel.Error, message);
	}

	// Typed immer set
	function imset(receipe: (draft: Draft<AppModel>) => void) {
		set(produce(receipe))
	}

	// Types for updateExpressionAtPathAdvanced
	type ExpressionAndNodeGraph = {
		expression: Expression,
		nodeGraph?: NodeGraphModel,
	}
	type MaybeExpressionAndNodeGraph = {
		expression?: Expression,
		nodeGraph?: NodeGraphModel,
	}

	/**
	 * Utility function to update both an expression and its associated node
	 * graph.
	 */
	function updateExpressionAtPathAdvanced(
		path: ExpressionPath,
		receipe: (data: ExpressionAndNodeGraph) => MaybeExpressionAndNodeGraph,
	) {
		switch (path.domain) {

		case "model": {
			const { index, field } = path;

			if (!isExpressionKeyOfGrowthModel(field)) {
				return logError(`Field is not an expression: 'growthModel.${field}'`);
			}

			const formattedPath = formatExpressionPath(path);

			const draft = receipe({
				expression: get().scene.growthModels.items[index][field],
				nodeGraph: get().nodeGraphs[formattedPath],
			});

			imset(state => {
				if (draft.expression !== undefined) {
					// NB: Do NOT update collections this way:
					//state.scene.growthModels.items[index][field] = draft.expression;
					// Use 'transform' instead:
					state.scene.growthModels = state.scene.growthModels.transform((growthModel, itemIndex) => (
						itemIndex === index ? { ...growthModel, [field]: draft.expression } : growthModel
					));
				}
				if (draft.nodeGraph !== undefined) {
					state.nodeGraphs[formattedPath] = draft.nodeGraph;
				}
			})
		}

		}
	}

	/**
	 * Equivalent of updateExpressionAtPathAdvanced with an easier API, to be
	 * used when the update of the expression and the update of the node graph
	 * are independent.
	 */
	function updateExpressionAtPath(
		path: ExpressionPath,
		updateExpression: (expression: Expression) => Expression,
		updateNodeGraph: (nodeGraph: NodeGraphModel) => NodeGraphModel,
	) {
		updateExpressionAtPathAdvanced(path, ({ expression, nodeGraph }) => ({
			expression: updateExpression(expression),
			nodeGraph: nodeGraph !== undefined ? updateNodeGraph(nodeGraph) : undefined,
		}))
	}

	/**
	 * Locate the path of the graph that contains a given node.
	 * NB: Try to avoid using this as much as possible, as it is a costly
	 * operation (there is no acceleration structure).
	 * /!\ Duplication with forEachPath
	 */
	function findPathFromNode(nodeId: NodeId): ResultOrError<ExpressionPath,string> {
		const containsTargetNode = (expr: Expression): boolean => {
			switch (expr.type) {
			case "constant": {
				return expr.nodeId == nodeId
			}
			case "constant-string": {
				return expr.nodeId == nodeId
			}
			case "accessor": {
				return expr.nodeId == nodeId
			}
			case "operator": {
				for (const subexpr of expr.arguments) {
					if (containsTargetNode(subexpr)) return true;
				}
				return false;
			}
			}
		}

		const { growthModels } = get().scene;
		for (let index = 0 ; index < growthModels.items.length ; ++index) {
			for (const field of allExpressionKeysOfGrowthModel()) {
				const path: ExpressionPath = {
					domain: "model",
					index,
					field,
				}
				let found = false;
				updateExpressionAtPathAdvanced(path, ({ expression }) => {
					if (containsTargetNode(expression)) found = true;
					return {} // no update
				})
				if (found) return Ok(path);
			}
		}
		return Err(`Could not find node with id '${nodeId}'`)
	}

	// Now that utility functions are defined, we build the public store functions:

	return {
		// Data

		...createDefaultState(),

		// Queries

		getExpression: (path: ExpressionPath) => {
			switch (path.domain) {

			case "model": {
				const { index, field } = path;

				if (!isExpressionKeyOfGrowthModel(field)) {
					return Err(`Field is not an expression: 'growthModel.${field}'`);
				}

				return Ok(get().scene.growthModels.items[index][field]);
			}

			}
		},

		ensureNodeGraph: (path: ExpressionPath) => {
			const formattedPath = formatExpressionPath(path);
			const nodeGraph = get().nodeGraphs[formattedPath];
			if (nodeGraph !== undefined) {
				return nodeGraph;
			} else {
				let newNodeGraph = createInitialNodeGraph();

				// Init from expression, if there is an expression
				const maybeExpression = get().getExpression(path);
				if (isOk(maybeExpression)) {
					const expression = maybeExpression.result;

					const callbacks = {
						setConstValue: (node: NodeId, value: number) => {
							get().setConstantNodeValue(path, node, value)
						},
						setConstStrValue: (node: NodeId, value: string) => {
							get().setConstantStringNodeValue(path, node, value)
						},
						setAccessorIdentifier: (node: NodeId, identifier: string) => {
							get().setAccessorNodeIdentifier(path, node, identifier)
						},
					}
					newNodeGraph = updateNodeGraphFromExpression(newNodeGraph, expression, formattedPath, callbacks);
				} else {
					logError(maybeExpression.error)
				}

				get().setNodeGraph(path, newNodeGraph);
				return newNodeGraph;
			}
		},

		// Actions

		setScene: (scene: Scene) => {
			set({
				scene,
				nodeGraphs: {}, // reset all node graphs
			})
		},

		setNodeGraph: (path: ExpressionPath, nodeGraph: NodeGraphModel) => imset(
			state => { state.nodeGraphs[formatExpressionPath(path)] = nodeGraph }
		),

		setExpression: (path: ExpressionPath, expression: Expression) => {
			updateExpressionAtPath(
				path,
				() => expression,
				nodeGraph => {
					const callbacks = {
						setConstValue: (node: NodeId, value: number) => {
							get().setConstantNodeValue(path, node, value)
						},
						setConstStrValue: (node: NodeId, value: string) => {
							get().setConstantStringNodeValue(path, node, value)
						},
						setAccessorIdentifier: (node: NodeId, identifier: string) => {
							get().setAccessorNodeIdentifier(path, node, identifier)
						},
					}
					return updateNodeGraphFromExpression(nodeGraph, expression, formatExpressionPath(path), callbacks);
				}
			)
		},

		setEnvironment: (environment: Environment) => {
			imset(state => { state.scene.environment = environment })
		},

		setGrowthModel: (index: number, growthModel: GrowthModel) => {
			// NB: Do NOT update collections this way:
			//imset(state => { state.scene.growthModels.items[index] = growthModel })
			// Use 'transform' instead:
			imset(state => {
				state.scene.growthModels = state.scene.growthModels.transform((item, itemIndex) => (
					itemIndex === index ? growthModel : item
				))
			});
		},

		setActiveExpression: (path: ExpressionPath, name: string) => {
			imset(state => { state.selection.activeExpr = { path, name } })
		},

		setActiveGrowthModel: (growthModelIndex: number) => {
			imset(state => { state.selection.activeGrowthModelIndex = growthModelIndex })
		},

		setConstantNodeValue: (path: ExpressionPath, nodeId: NodeId, value: number) => {
			const updateExpression = (expr: Expression): Expression => {
				switch (expr.type) {
				case "constant": {
					return expr.nodeId == nodeId ? { ...expr, value } : expr
				}
				case "constant-string": {
					return expr
				}
				case "accessor": {
					return expr
				}
				case "operator": {
					return {
						...expr,
						arguments: expr.arguments.map(updateExpression),
					}
				}
				}
			}

			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const newNodes = nodeGraph.nodes.map(node => (
					node.id === nodeId && isConstantNode(node)
					? { ...node, data: { ...node.data, value } }
					: node
				))
				return { ...nodeGraph, nodes: newNodes }
			}

			updateExpressionAtPath(
				path,
				updateExpression,
				updateNodeGraph,
			)

		},

		setConstantStringNodeValue: (path: ExpressionPath, nodeId: NodeId, value: string) => {
			const updateExpression = (expr: Expression): Expression => {
				switch (expr.type) {
				case "constant": {
					return expr
				}
				case "constant-string": {
					return expr.nodeId == nodeId ? { ...expr, value } : expr
				}
				case "accessor": {
					return expr
				}
				case "operator": {
					return {
						...expr,
						arguments: expr.arguments.map(updateExpression),
					}
				}
				}
			}

			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const newNodes = nodeGraph.nodes.map(node => (
					node.id === nodeId && isConstantStringNode(node)
					? { ...node, data: { ...node.data, value } }
					: node
				))
				return { ...nodeGraph, nodes: newNodes }
			}

			updateExpressionAtPath(
				path,
				updateExpression,
				updateNodeGraph,
			)

		},

		setAccessorNodeIdentifier: (path: ExpressionPath, nodeId: NodeId, identifier: string) => {
			const updateExpression = (expr: Expression): Expression => {
				switch (expr.type) {
				case "constant": {
					return expr
				}
				case "constant-string": {
					return expr
				}
				case "accessor": {
					return expr.nodeId == nodeId ? { ...expr, identifier } : expr
				}
				case "operator": {
					return {
						...expr,
						arguments: expr.arguments.map(updateExpression),
					}
				}
				}
			}

			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const newNodes = nodeGraph.nodes.map(node => (
					node.id === nodeId && isAccessorNode(node)
					? { ...node, data: { ...node.data, identifier: identifier } }
					: node
				))
				return { ...nodeGraph, nodes: newNodes }
			}

			updateExpressionAtPath(
				path,
				updateExpression,
				updateNodeGraph,
			)

		},

		setNodeAdmonition: (path: ExpressionPath, nodeId: NodeId, admonition: LogEntry) => {
			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const newNodes = nodeGraph.nodes.map(node => produce(node, draft => {
					if (draft.id === nodeId) {
						draft.data.admonition = admonition;
					}
				}))
				return { ...nodeGraph, nodes: newNodes }
			}

			updateExpressionAtPath(
				path,
				expr => expr,
				updateNodeGraph,
			)

		},

		clearAllNodeAdmonitions: (path: ExpressionPath) => {
			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const newNodes = nodeGraph.nodes.map(node => produce(node, draft => {
					draft.data.admonition = null;
				}))
				return { ...nodeGraph, nodes: newNodes }
			}

			updateExpressionAtPath(
				path,
				expr => expr,
				updateNodeGraph,
			)

		},

		applyNodeChanges: (path: ExpressionPath, changes: NodeChange<Node>[]) => {
			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				return {
					...nodeGraph,
					nodes: applyNodeChanges(changes, nodeGraph.nodes).map(node => node),
				}
			}

			updateExpressionAtPath(
				path,
				expr => expr,
				updateNodeGraph,
			)

			// NB: No need to update the compiled expression here because node's
			// setValue handles are able to directly modify the source expression.
		},

		applyEdgeChanges: (path: ExpressionPath, changes: EdgeChange<Edge>[]) => {
			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				return {
					...nodeGraph,
					edges: applyEdgeChanges(changes, nodeGraph.edges)
				}
			}

			updateExpressionAtPathAdvanced(path, ({ nodeGraph }) => {
				if (nodeGraph === undefined) {
					logError("Internal error: applyEdgeChanges called on an empty ndoe graph.");
					return {};
				}

				const maybeCompiledExpr = compileExpression(nodeGraph);

				return {
					expression: maybeCompiledExpr.result,
					nodeGraph: {
						...updateNodeGraph(nodeGraph),
						maybeCompiledExpr,
					},
				}
			})
		},

		connectNodes: (path: ExpressionPath, connection: Connection) => {
			const updateNodeGraph = (nodeGraph: NodeGraphModel) => {
				const {
					target,
					targetHandle,
				} = connection;

				const nextEdges = removeEdgesByTarget(target, targetHandle, nodeGraph.edges);

				return {
					...nodeGraph,
					edges: addEdge(connection, nextEdges)
				}
			}

			updateExpressionAtPathAdvanced(path, ({ nodeGraph }) => {
				if (nodeGraph === undefined) {
					logError("Internal error: connectNodes called on an empty ndoe graph.");
					return {};
				}

				const maybeCompiledExpr = compileExpression(nodeGraph);

				return {
					expression: maybeCompiledExpr.result,
					nodeGraph: {
						...updateNodeGraph(nodeGraph),
						maybeCompiledExpr,
					}
				}
			})
		},

		addNode: (path: ExpressionPath, node: Node) => {
			updateExpressionAtPath(
				path,
				expr => expr,
				nodeGraph => ({
					...nodeGraph,
					nodes: [ ...nodeGraph.nodes, node ],
				}),
			)
		},

		applyBehavior: (behavior: Behavior, stepCount: number) => {
			const {
				log,
				scene,
				clearAllNodeAdmonitions,
				setNodeAdmonition,
			} = get();

			log(LogLevel.Info, `Applying behavior: '${behavior.name}'`)

			forEachPathInScene(scene, clearAllNodeAdmonitions);

			const context = {
				onEvalError: (error: EvalError) => {
					logError(error.message);
					const lastEntry = get().logEntries[get().logEntries.length - 1];
					const maybePath = findPathFromNode(error.location);
					if (isOk(maybePath)) {
						setNodeAdmonition(maybePath.result, error.location, lastEntry)
					} else {
						logError(maybePath.error);
					}
				}
			}

			set(state => ({
				scene: applyBehavior(state.scene, context, behavior, { repeat: stepCount })
			}))
		},

		applyGrowthSchedule: (stepCount: number) => {
			const {
				log,
				scene,
				clearAllNodeAdmonitions,
				setNodeAdmonition,
			} = get();

			log(LogLevel.Info, `Applying growth schedule`)

			forEachPathInScene(scene, clearAllNodeAdmonitions);

			const context = {
				onEvalError: (error: EvalError) => {
					logError(error.message);
					const lastEntry = get().logEntries[get().logEntries.length - 1];
					const maybePath = findPathFromNode(error.location);
					if (isOk(maybePath)) {
						setNodeAdmonition(maybePath.result, error.location, lastEntry)
					} else {
						logError(maybePath.error);
					}
				}
			}

			let nextScene = get().scene;
			const entries = Array.from(groupBy(
				nextScene.plants.items.map((_, idx) => idx),
				plantIndex => nextScene.plants.items[plantIndex].growthModelRef.index
			))

			for (let i = 0 ; i < stepCount ; ++i) {
				for (const [ growthModelIndex, plantIndices ] of entries) {
					const growthModel = nextScene.growthModels.items[growthModelIndex];

					for (const step of growthModel.schedule) {
						const { behavior, repeat, enabled } = step;
						if (!enabled) continue;

						nextScene = applyBehavior(
							nextScene,
							context,
							behaviors[behavior],
							{
								repeat,
								phytomerFilter: (phytomer: Phytomer) => plantIndices.includes(phytomer.plantRef.index),
							},
						)
						nextScene = {...nextScene};
					}
				}
			}

			set({ scene: nextScene })
		},

		log: (level: LogLevel, message: string) => {
			if (level === LogLevel.Error) {
				console.error(message);
			} else if (level === LogLevel.Warning) {
				console.warn(message);
			}
			imset(state => {
				state.logEntries.push({
					time: new Date(),
					level,
					message,
				})
			})
		},
	}
})
