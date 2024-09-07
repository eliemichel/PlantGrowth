/**
 * This defines all types related to node graphs that represent Meristem State
 * Transition Functions (a.k.a. Meristem Transducer).
 */

import * as Flow from '@xyflow/react';
import { type LogEntry } from './LogModel.ts'

export type CommonNodeAttributes = {
	admonition: null | LogEntry,
}

export type InputStateNode = Flow.Node<CommonNodeAttributes & {
	name: string,
	stateTypeCount: number,
}, 'input-state'>;

export type OutputStateNode = Flow.Node<CommonNodeAttributes & {
	name: string,
}, 'output-state'>;

export type Node =
	| InputStateNode
	| OutputStateNode

export function isInputStateNode(node: Node): node is InputStateNode {
	return node.type === 'input-state';
}

export function isOutputStateNode(node: Node): node is OutputStateNode {
	return node.type === 'output-state';
}

export type Edge = Flow.BuiltInEdge;

export type CompilationError = string;

export type MeristemTransducerNodeGraph = {
	nodes: Node[],
	edges: Edge[],
}

export function createInitialMeristemTransducerNodeGraph(): MeristemTransducerNodeGraph {
  return {
    nodes: [],
    edges: [],
  }
}
