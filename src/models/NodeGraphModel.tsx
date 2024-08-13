import * as Flow from '@xyflow/react';
import { type ResultOrError } from '../utils/error.tsx'
import { type Expression } from '../models/DSL.tsx'

/*
type EdgeId = string
*/
export type NodeId = string;

type CommonNodeAttributes = {
	isOutput: boolean,
	path: string, // formatted path of the expression to which this node belong
}

export type OperatorNode = Flow.Node<CommonNodeAttributes & {
	operator: string,
	argCount: number,
}, 'operator'>;

export type ConstantNode = Flow.Node<CommonNodeAttributes & {
	value: number,
	setValue: (value: number) => void,
}, 'constant'>;

export type AccessorNode = Flow.Node<CommonNodeAttributes & {
	identifier: string,
	setIdentifier: (identifier: string) => void,
}, 'accessor'>;

export type Node = OperatorNode | ConstantNode | AccessorNode;

export function isOperatorNode(node: Node): node is OperatorNode {
	return node.type === 'operator';
}

export function isConstantNode(node: Node): node is ConstantNode {
	return node.type === 'constant';
}

export function isAccessorNode(node: Node): node is AccessorNode {
	return node.type === 'accessor';
}

/*
export type Node = {
	id: NodeId,
	position: { x: number, y: number },
	data: { label: string }
}
*/

export type Edge = Flow.BuiltInEdge;

/*
export type Edge = {
	id: EdgeId,
	source: NodeId,
	target: NodeId
}
*/

export type CompilationError = string;

export type NodeGraphModel = {
	// The node graph model holds a pool of nodes with all nodes ever created
	// so that it retains the positions even when we switch to different
	// expressions.
	nodePool: { [key: NodeId]: Node },

	// Then comes data for the currently edited expression only

	// unique identifier of the expression being edited
	path: string,

	// These nodes also exist in the pool, they are extracted and cached here
	// for faster display
	nodes: Node[],

	edges: Edge[],

	// Expression compiled from the current node graph
	maybeCompiledExpr: ResultOrError<Expression,CompilationError>
}
