import * as Flow from '@xyflow/react';

/*
type NodeId = string
type EdgeId = string
*/

export type OperatorNode = Flow.Node<{
	operator: string,
	argCount: number,
}, 'operator'>;

export type ConstantNode = Flow.Node<{
	value: number
}, 'constant'>;

export type Node = Flow.BuiltInNode | OperatorNode | ConstantNode;

export function isOperatorNode(node: Node): node is OperatorNode {
	return node.type === 'operator';
}

export function isConstantNode(node: Node): node is ConstantNode {
	return node.type === 'constant';
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

export type NodeGraphModel = {
	// human label of the expression being edited
	name: string,

	// unique identifier of the expression being edited
	path: string,

	nodes: Node[],
	edges: Edge[],
}
