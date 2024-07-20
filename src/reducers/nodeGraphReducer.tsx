import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';

import { createReducerContext } from '../utils/createReducerContext.tsx'

import { Node, Edge, NodeGraphModel } from '../models/NodeGraphModel.tsx'

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    nodes: [
      { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
      { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
    ],
    edges: [{ id: 'e1-2', source: '1', target: '2' }],
  }
}

export type NodeGraphAction =
  | { type: 'node-change'; changes: NodeChange<Node>[] }
  | { type: 'edge-change'; changes: EdgeChange<Edge>[] }
  | { type: 'connect'; params: Connection }

export function nodeGraphReducer(nodeGraph: NodeGraphModel, action: NodeGraphAction): NodeGraphModel {
  switch (action.type) {
    case 'node-change': {
      return {
        ...nodeGraph,
        nodes: applyNodeChanges(action.changes, nodeGraph.nodes).map(node => node)
      };
    }
    case 'edge-change': {
      return {
        ...nodeGraph,
        edges: applyEdgeChanges(action.changes, nodeGraph.edges)
      };
    }
    case 'connect': {
      return {
        ...nodeGraph,
        edges: addEdge(action.params, nodeGraph.edges)
      };
    }
    default: {
      throw Error('Unknown node graph action: ' + JSON.stringify(action));
    }
  }
}

export const [
  useNodeGraph,
  useNodeGraphDispatch,
  NodeGraphProvider
] = createReducerContext(nodeGraphReducer, createInitialNodeGraph());
