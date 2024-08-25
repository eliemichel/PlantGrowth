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
	type SceneModel,
	createInitialScene,
	createTestScene,
} from '../models/SceneModel.tsx'

import {
	type GrowthModel,
	isExpressionKeyOfGrowthModel,
} from '../models/GrowthModel.tsx'

import {
	type SelectionModel,
	createDefaultSelection,
} from '../models/SelectionModel.tsx'

import {
	type NodeGraphModel,
	type NodeId,
	type Node,
	type Edge,
	createInitialNodeGraph,
	isConstantNode,
	isAccessorNode,
} from '../models/NodeGraphModel.tsx'

import {
	type Environment
} from '../models/EnvironmentModel.tsx'

import {
	type Expression,
} from '../models/DSL.tsx'

import {
	type ExpressionPath,
	type FormattedPath,
	formatExpressionPath,
} from '../models/Path.tsx'

import {
	type ResultOrError,
	Ok,
	Err,
	isOk,
} from '../utils/error.tsx'

import {
	updateNodeGraphFromExpression,
	compileExpression,
	removeEdgesByTarget,
} from '../backend/nodeGraphReducer.tsx'

import {
	applyBehavior,
	type Behavior,
} from '../backend/behaviorPipelines.tsx'

export enum LogLevel {
	Debug,
	Info,
	Warning,
	Error,
}

type LogEntry = {
	time: Date,
	level: LogLevel,
	message: string,
}

// Data storage for the whole application
type AppState = {
	scene: SceneModel,

	nodeGraphs: { [key: FormattedPath]: NodeGraphModel },

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
	setScene: (scene: SceneModel) => void,

	setNodeGraph: (path: ExpressionPath, nodeGraph: NodeGraphModel) => void,

	setExpression: (path: ExpressionPath, expression: Expression) => void,

	setEnvironment: (environment: Environment) => void,

	setGrowthModel: (index: number, growthModel: GrowthModel) => void,

	setActiveExpression: (path: ExpressionPath, name: string) => void,

	// Update both expression node and graph node (there may only exist one of these)
	setConstantNodeValue: (path: ExpressionPath, nodeId: NodeId, value: number) => void,
	setAccessorNodeIdentifier: (path: ExpressionPath, nodeId: NodeId, identifier: string) => void,

	// Node graph manipulation, connecting to @xyflow/react
	applyNodeChanges: (path: ExpressionPath, changes: NodeChange<Node>[]) => void,
	applyEdgeChanges: (path: ExpressionPath, changes: EdgeChange<Edge>[]) => void,
	connectNodes: (path: ExpressionPath, connection: Connection) => void,
	addNode: (path: ExpressionPath, node: Node) => void,

	// Scene manipulation
	setInitialScene: () => void,
	setTestScene: (index: number) => void,
	applyBehavior: (behavior: Behavior, stepCount: number) => void,

	log: (level: LogLevel, message: string) => void,
}

// Main store type
type AppModel = AppState & AppQueryFunctions & AppActionFunctions;

function createDefaultState(): AppState {
	return {

		scene: createInitialScene(),

		nodeGraphs: {},

  		selection: createDefaultSelection(),

		logEntries: [],

	}
}

export const useAppStore = create<AppModel>()((set, get) => {

	// We first define some private utility functions:

	function logError(message: string) {
		get().log(LogLevel.Error, message);
	}

	// Typed immer set
	function imset(receipe: (draft: Draft<AppModel>) => void) {
		set(produce(receipe))
	}

	interface ExpressionUpdater {
		getExpression: () => Expression,
		setExpression: (expression: Expression) => void,
		getNodeGraph: () => NodeGraphModel,
		setNodeGraph: (nodeGraph: NodeGraphModel) => void,
	}

	function updateExpressionAtPathAdvanced(
		path: ExpressionPath,
		receipe: (updater: ExpressionUpdater) => void,
	) {
		switch (path.domain) {

		case "model": {
			const { index, field } = path;

			if (!isExpressionKeyOfGrowthModel(field)) {
				return logError(`Field is not an expression: 'growthModel.${field}'`);
			}

			const formattedPath = formatExpressionPath(path);

			receipe({
				getExpression: () => get().scene.growthModels[index][field],
				setExpression: (expression: Expression) => imset(
					state => { state.scene.growthModels[index][field] = expression }
				),
				getNodeGraph: () => get().nodeGraphs[formattedPath] ?? createInitialNodeGraph(),
				setNodeGraph: (nodeGraph: NodeGraphModel) => imset(
					state => { state.nodeGraphs[formattedPath] = nodeGraph }
				),
			})
		}

		}
	}

	function updateExpressionAtPath(
		path: ExpressionPath,
		updateExpression: (expression: Expression) => Expression,
		updateNodeGraph: (nodeGraph: NodeGraphModel) => NodeGraphModel,
	) {
		updateExpressionAtPathAdvanced(path, updater => {
			updater.setExpression(updateExpression(updater.getExpression()));
			updater.setNodeGraph(updateNodeGraph(updater.getNodeGraph()));
		})
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

				return Ok(get().scene.growthModels[index][field]);
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

		setScene: (scene: SceneModel) => set({ scene }),

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
			imset(state => { state.scene.growthModels[index] = growthModel })
		},

		setActiveExpression: (path: ExpressionPath, name: string) => {
			imset(state => { state.selection.activeExpr = { path, name } })
		},

		setConstantNodeValue: (path: ExpressionPath, nodeId: NodeId, value: number) => {
			const updateExpression = (expr: Expression): Expression => {
				switch (expr.type) {
				case "constant": {
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

		setAccessorNodeIdentifier: (path: ExpressionPath, nodeId: NodeId, identifier: string) => {
			const updateExpression = (expr: Expression): Expression => {
				switch (expr.type) {
				case "constant": {
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

			updateExpressionAtPathAdvanced(path, updater => {
				const nodeGraph = updater.getNodeGraph();

				const maybeCompiledExpr = compileExpression(nodeGraph);

				if (isOk(maybeCompiledExpr)) {
					updater.setExpression(maybeCompiledExpr.result)
				}

				updater.setNodeGraph({
					...updateNodeGraph(nodeGraph),
					maybeCompiledExpr,
				});
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

			updateExpressionAtPathAdvanced(path, updater => {
				const nodeGraph = updater.getNodeGraph();

				const maybeCompiledExpr = compileExpression(nodeGraph);

				if (isOk(maybeCompiledExpr)) {
					updater.setExpression(maybeCompiledExpr.result)
				}

				updater.setNodeGraph({
					...updateNodeGraph(nodeGraph),
					maybeCompiledExpr,
				});
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

		setInitialScene: () => {
			set({ scene: createInitialScene() })
		},

		setTestScene: (index: number) => {
			set({ scene: createTestScene(index) })
		},

		applyBehavior: (behavior: Behavior, stepCount: number) => {
			get().log(LogLevel.Info, `Applying behavior: '${behavior.name}'`)
			set(state => ({
				scene: applyBehavior(state.scene, behavior, { repeat: stepCount })
			}))
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
