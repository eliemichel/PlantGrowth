import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';

import { createReducerContext } from '../utils/createReducerContext.tsx'

export const createInitialNodeGraph = () => ({
  nodes: [
    { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
    { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
  ],
  edges: [{ id: 'e1-2', source: '1', target: '2' }],
});

export function nodeGraphReducer(nodeGraph, action) {
  switch (action.type) {
    case 'node-change': {
      return {
        ...nodeGraph,
        nodes: applyNodeChanges(action.changes, nodeGraph.nodes)
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
      throw Error('Unknown node graph action: ' + action.type);
    }
  }
}

export const [
  useNodeGraph,
  useNodeGraphDispatch,
  NodeGraphProvider
] = createReducerContext(nodeGraphReducer, createInitialNodeGraph());
