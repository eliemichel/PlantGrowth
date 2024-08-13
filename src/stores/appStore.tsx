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
	type SimulationModel,
	createInitialScene,
	isExpressionKeyOfGrowthModel,
} from '../models/SimulationModel.tsx'

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
	updateNodeGraphFromExpression,
	compileExpression,
	removeEdgesByTarget,
} from '../reducers/nodeGraphReducer.tsx'

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

enum LogLevel {
	Debug,
	Info,
	Warning,
	Error,
}

interface LogEntry {
	level: LogLevel,
	message: string,
}

interface AppModel {

	// Data

	scene: SimulationModel,

	nodeGraphs: { [key: FormattedPath]: NodeGraphModel },

	log: LogEntry[],

	// Queries

	getExpression: (path: ExpressionPath) => ResultOrError<Expression,string>,

	// Get the node graph associated to a path, create it if needed
	ensureNodeGraph: (path: ExpressionPath) => NodeGraphModel,

	// Actions

	setScene: (scene: SimulationModel) => void,

	setNodeGraph: (path: ExpressionPath, nodeGraph: NodeGraphModel) => void,

	setExpression: (path: ExpressionPath, expression: Expression) => void,

	// Update both expression node and graph node (there may only exist one of these)
	setConstantNodeValue: (path: ExpressionPath, nodeId: NodeId, value: number) => void,
	setAccessorNodeIdentifier: (path: ExpressionPath, nodeId: NodeId, identifier: string) => void,

	// Node graph manipulation, connecting to @xyflow/react
	applyNodeChanges: (path: ExpressionPath, changes: NodeChange<Node>[]) => void,
	applyEdgeChanges: (path: ExpressionPath, changes: EdgeChange<Edge>[]) => void,
	connectNodes: (path: ExpressionPath, connection: Connection) => void,
	addNode: (path: ExpressionPath, node: Node) => void,

	logError: (message: string) => void,
}

export const useAppStore = create<AppModel>()((set, get) => {

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
				return get().logError(`Field is not an expression: 'growthModel.${field}'`);
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

	return {
		// Data

		scene: createInitialScene(),

		nodeGraphs: {},

		log: [],

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
					get().logError(maybeExpression.error)
				}

				get().setNodeGraph(path, newNodeGraph);
				return newNodeGraph;
			}
		},

		// Actions

		setScene: (scene: SimulationModel) => set({ scene }),

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

		logError: (message: string) => {
			console.error(message);
			imset(state => {
				state.log.push({
					level: LogLevel.Error,
					message,
				})
			})
		}
	}
})
