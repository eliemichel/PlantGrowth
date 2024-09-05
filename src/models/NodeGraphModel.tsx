import * as Flow from '@xyflow/react';
import { type ResultOrError, Err } from '../utils/error.tsx'
import { type Expression } from '../models/DSL.tsx'
import { type LogEntry } from './LogModel.tsx'

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
	// These nodes also exist in the pool, they are extracted and cached here
	// for faster display
	nodes: Node[],

	edges: Edge[],

	// Expression compiled from the current node graph
	maybeCompiledExpr: ResultOrError<Expression,CompilationError> // TODO: remove?
}

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    nodes: [],
    edges: [],
    maybeCompiledExpr: Err("No graph"),
  }
}
