import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';

import { createReducerContext } from '../utils/createReducerContext.tsx'

import { Node, Edge, NodeGraphModel, isConstantNode } from '../models/NodeGraphModel.tsx'
import { Expression } from '../models/DSL.tsx'

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    name: '???',
    nodes: [
      { id: '1', position: { x: 0, y: 0 }, data: { label: '1' } },
      { id: '2', position: { x: 0, y: 100 }, data: { label: '2' } },
    ],
    edges: [{ id: 'e1-2', source: '1', target: '2' }],
  }
}

function createNodeGraphFromExpression(expr: Expression, name: string): NodeGraphModel {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function processSubExpr(subexpr: Expression, x: number, y: number) {
    switch (subexpr.type) {
    case "constant":
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "constant", data: { value: subexpr.value } });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    case "accessor":
      nodes.push({ id: subexpr.nodeId, position: { x, y }, data: { label: subexpr.identifier } });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    case "operator":
      const data = { operator: subexpr.operator, argCount: subexpr.arguments.length };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "operator", data });

      const childY = y + 100;
      let width = 0;
      let height = 2;
      subexpr.arguments.map((arg, argIdx) => {
        const childX = x + width * 200;
        const child = processSubExpr(arg, childX, childY);
        width += child.width;
        height = Math.max(1 + child.height, height);
        edges.push({
          id: subexpr.nodeId + '-' + child.nodeId,
          target: child.nodeId,
          source: subexpr.nodeId,
          sourceHandle: `source-${argIdx}`
        });
      });

      return { nodeId: subexpr.nodeId, width, height };
    }
  }

  processSubExpr(expr, 0, 0);

  return { name, nodes, edges };
}

export type NodeGraphAction =
  | { type: 'node-change'; changes: NodeChange<Node>[] }
  | { type: 'edge-change'; changes: EdgeChange<Edge>[] }
  | { type: 'connect'; params: Connection }

  // Entierly rebuild the model given an expression tree
  | { type: 'load-expression'; expr: Expression, exprName: string }

  // Update a constant node
  | { type: 'set-constant', node: string, value: number }

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
    case 'load-expression': {
      return createNodeGraphFromExpression(action.expr, action.exprName);
    }
    case 'set-constant': {
      return {
        ...nodeGraph,
        nodes: nodeGraph.nodes.map(node => (
          node.id == action.node && isConstantNode(node)
          ? { ...node, data: { ...node.data, value: action.value } }
          : node
        ))
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
