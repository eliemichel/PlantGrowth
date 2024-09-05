import * as Flow from '@xyflow/react';
import { type LogEntry } from './LogModel.ts'

export type CommonNodeAttributes = {
	isOutput: boolean,
	path: string, // formatted path of the expression to which this node belong
	admonition: null | LogEntry,
}

export type OperatorNode = Flow.Node<CommonNodeAttributes & {
	operator: string,
	argCount: number,
}, 'operator'>;

export type ConstantNode = Flow.Node<CommonNodeAttributes & {
	value: number,
	setValue: (value: number) => void,
}, 'constant'>;

export type ConstantStringNode = Flow.Node<CommonNodeAttributes & {
	value: string,
	setValue: (value: string) => void,
}, 'constant-string'>;

export type AccessorNode = Flow.Node<CommonNodeAttributes & {
	identifier: string,
	setIdentifier: (identifier: string) => void,
}, 'accessor'>;

export type Node = OperatorNode | ConstantNode | ConstantStringNode | AccessorNode;

export function isOperatorNode(node: Node): node is OperatorNode {
	return node.type === 'operator';
}

export function isConstantNode(node: Node): node is ConstantNode {
	return node.type === 'constant';
}

export function isConstantStringNode(node: Node): node is ConstantStringNode {
	return node.type === 'constant-string';
}

export function isAccessorNode(node: Node): node is AccessorNode {
	return node.type === 'accessor';
}

export type Edge = Flow.BuiltInEdge;

export type CompilationError = string;

export type NodeGraphModel = {
	nodes: Node[],
	edges: Edge[],
}

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    nodes: [],
    edges: [],
  }
}
