import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';

import {
  isNodeRemoveChange
} from '../utils/flow.tsx'

import { createReducerContext } from '../utils/createReducerContext.tsx'
import {
  type ResultOrError,
  Err,
  Ok,
  isErr,
  isOk,
  allResults,
} from '../utils/error.tsx'

import { makeArray } from '../utils/basics.tsx'

import {
  type NodeId,
  type Node,
  type Edge,
  type NodeGraphModel,
  type CompilationError,
  isConstantNode,
  isAccessorNode,
} from '../models/NodeGraphModel.tsx'

import {
  type Expression,
  makeConst,
  makeAcc,
  makeOp,
} from '../models/DSL.tsx'

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    nodePool: {},
    path: '/',
    nodes: [],
    edges: [],
    maybeCompiledExpr: Err("No graph"),
  }
}

/**
 * Create node pool
 */
export function createNodePool(nodes: Node[]): NodeGraphModel['nodePool'] {
  const nodePool: NodeGraphModel['nodePool'] = {};
  for (const n of nodes) {
    nodePool[n.id] = n;
  }
  return nodePool;
}

/**
 * Callbacks that nodes use to edit the underlying model
 */
type NodeCallbacks = {
  setConstValue: (node: NodeId, value: number) => void,
  setAccessorIdentifier: (node: NodeId, identifier: string) => void,
}

/**
 * Auxiliary function for both createNodeGraphFromExpression and updateNodeGraphFromExpression
 */
export function createNodesAndEdgesFromExpression(expr: Expression, path: string, callbacks: NodeCallbacks): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function processSubExpr(subexpr: Expression, x: number, y: number, isOutput: boolean) {
    const common = {
      isOutput,
      path,
    }

    switch (subexpr.type) {

    case "constant": {
      const data = {
        ...common,
        value: subexpr.value,
        setValue: (value: number) => callbacks.setConstValue(subexpr.nodeId, value),
      };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "constant", data });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    }

    case "accessor": {
      const data = {
        ...common,
        identifier: subexpr.identifier,
        setIdentifier: (identifier: string) => callbacks.setAccessorIdentifier(subexpr.nodeId, identifier),
      };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "accessor", data });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    }

    case "operator": {
      const data = { ...common, operator: subexpr.operator, argCount: subexpr.arguments.length };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "operator", data });

      const childY = y + 100;
      let width = 0;
      let height = 2;
      subexpr.arguments.map((arg, argIdx) => {
        const childX = x + width * 200;
        const child = processSubExpr(arg, childX, childY, false /* isOutput */);
        width += child.width;
        height = Math.max(1 + child.height, height);
        edges.push({
          id: subexpr.nodeId + '-' + child.nodeId,
          source: child.nodeId,
          target: subexpr.nodeId,
          targetHandle: `target-${argIdx}`
        });
      });

      return { nodeId: subexpr.nodeId, width, height };
    }

    }
  }

  processSubExpr(expr, 0, 0, true /* isOutput */);

  return { nodes, edges };
}

/**
 * Create a new graph model from scratch, given an expression
 * NB: You most probably want to use `updateNodeGraphFromExpression` to retain node positions
 */
export function createNodeGraphFromExpression(expr: Expression, path: string, callbacks: NodeCallbacks): NodeGraphModel {
  const { nodes, edges } = createNodesAndEdgesFromExpression(expr, path, callbacks);
  return {
    nodePool: createNodePool(nodes),
    path, nodes, edges,
    maybeCompiledExpr: Err("Need update"),
  };
}

/**
 * Update the current graph from an expression, trying to reuse existing nodes
 * as much as possible.
 */
export function updateNodeGraphFromExpression(nodeGraph: NodeGraphModel, expr: Expression, path: string, callbacks: NodeCallbacks): NodeGraphModel {
  const nodePool = {
    ...nodeGraph.nodePool,
    ...createNodePool(nodeGraph.nodes),
  }
  const { nodes, edges } = createNodesAndEdgesFromExpression(expr, path, callbacks);

  const consolidatedNodeIds = new Set();

  // Reuse existing nodes from the pool if id matches
  const consolidatedNodes: Node[] = [];
  for (const n of nodes) {
    const existingNode: Node = nodePool[n.id];
    if (existingNode !== undefined) {
      consolidatedNodes.push({
        ...n,
        position: {...existingNode.position},
        selected: existingNode.selected,
        width: existingNode.width,
        height: existingNode.height,
        initialWidth: existingNode.initialWidth,
        initialHeight: existingNode.initialHeight,
      });
    } else {
      consolidatedNodes.push(n);
    }
    consolidatedNodeIds.add(n.id);
  }

  // Also keep nodes that are associated to this path
  for (const n of Object.values(nodePool)) {
    if (n.data.path == path && !consolidatedNodeIds.has(n.id)) {
      consolidatedNodes.push(n);
      consolidatedNodeIds.add(n.id);
    }
  }

  return {
    ...nodeGraph,
    nodePool: {
      ...nodePool,
      ...createNodePool(consolidatedNodes),
    },
    nodes: consolidatedNodes,
    edges,
    path,
  };
}

/**
 * Try recompiling expression from graph
 */
function updateCompiledExpr(nodeGraph: NodeGraphModel, setExpr: (expr: Expression) => void): NodeGraphModel {
  const maybeCompiledExpr = compileExpression(nodeGraph);

  if (isOk(maybeCompiledExpr)) {
    setExpr(maybeCompiledExpr.result)
  }

  return {
    ...nodeGraph,
    maybeCompiledExpr,
  }
}

/**
 * Get the id of the output node, and make sure that there is one and only one
 * such output node.
 */
function getOutputNodeId(graphState: NodeGraphModel): ResultOrError<string,CompilationError> {
  let outputNodeId: string | null = null;
  for (const node of graphState.nodes) {
    if (node.data.isOutput) {
      if (outputNodeId !== null) {
        return Err("Multiple output nodes found.")
      } else {
        outputNodeId = node.id;
      }
    }
  }
  if (outputNodeId === null) {
    return Err("No output node found.")
  } else {
    return Ok(outputNodeId)
  }
}

/**
 * Try to turn the current state of the graph into a valid expression
 */
export function compileExpression(graphState: NodeGraphModel): ResultOrError<Expression,CompilationError> {
  const idToNode: { [key: string]: Node } = {};
  for (const node of graphState.nodes) {
    idToNode[node.id] = node;
  }

  function makeTargetKey(target: string, targetHandle: string | null | undefined): string {
    return targetHandle ? `${target}__${targetHandle}` : target
  }

  const targetKeyToEdge: { [key: string]: Edge } = {};
  for (const edge of graphState.edges) {
    const targetKey = makeTargetKey(edge.target, edge.targetHandle);
    targetKeyToEdge[targetKey] = edge;
  }

  function compileNode(nodeId: string): ResultOrError<Expression,CompilationError> {
    const node = idToNode[nodeId];
    if (node === undefined) {
      return Err(`Invalid node id: '${nodeId}'`);
    }
    switch (node.type) {
    case "constant":
      return Ok({ ...makeConst(node.data.value), nodeId: node.id });
    case "accessor":
      return Ok({ ...makeAcc(node.data.identifier), nodeId: node.id });
    case "operator":
      const { operator, argCount } = node.data;
      const maybeArgs = allResults(makeArray(argCount, argIdx => {
        const targetKey = makeTargetKey(node.id, `target-${argIdx}`);
        const edge = targetKeyToEdge[targetKey];
        if (edge === undefined) {
          return Err(`Missing connection at input #${argIdx} of node '${node.id}'`)
        }
        return compileNode(edge.source);
      }));
      if (isErr(maybeArgs)) return maybeArgs;
      else return Ok({ ...makeOp(operator, ...maybeArgs.result), nodeId: node.id });
    default:
      return Err(`Unknown node type: '${JSON.stringify(node)}'`)
    }
  }

  const maybeOutputNodeId = getOutputNodeId(graphState);
  if (isErr(maybeOutputNodeId)) return maybeOutputNodeId;
  const outputNodeId = maybeOutputNodeId.result;

  return compileNode(outputNodeId);
}

function removeEdgesByTarget(target: string, targetHandle: string | null, edges: Edge[]): Edge[] {
  return edges.filter(e => e.target != target || e.targetHandle != targetHandle)
}

export type NodeGraphAction =
  | { type: 'node-change'; changes: NodeChange<Node>[] }
  | { type: 'edge-change'; changes: EdgeChange<Edge>[]; setExpr: (expr: Expression) => void }
  | { type: 'connect'; params: Connection; setExpr: (expr: Expression) => void, }

  // Entierly rebuild the model given an expression tree
  | { type: 'sync-expression'; expr: Expression, exprPath: string, setConstValue: (node: NodeId, value: number) => void, setAccessorIdentifier: (node: NodeId, identifier: string) => void }

  // Update a constant node
  | { type: 'set-constant', node: string, value: number }

  // Update an accessor node
  | { type: 'set-accessor', node: string, identifier: string }

  | { type: 'add-node', node: Node }

export function nodeGraphReducer(nodeGraph: NodeGraphModel, action: NodeGraphAction): NodeGraphModel {
  switch (action.type) {
    case 'node-change': {
      const removedIds = (
        action
        .changes
        .filter(isNodeRemoveChange)
        .map(change => change.id)
      );

      // NB: No need to update the compiled expression here because node's
      // setValue handles are able to directly modify the source expression.
      return {
        ...nodeGraph,
        nodes: applyNodeChanges(action.changes, nodeGraph.nodes).map(node => node),
        nodePool: Object.fromEntries(Object.entries(nodeGraph.nodePool).filter(([id, _node]) => !removedIds.includes(id))),
      };
    }
    case 'edge-change': {
      console.log("edge-change", action.changes)

      return updateCompiledExpr({
        ...nodeGraph,
        edges: applyEdgeChanges(action.changes, nodeGraph.edges)
      }, action.setExpr);
    }
    case 'connect': {
      const {
        target,
        targetHandle,
      } = action.params;

      const nextEdges = removeEdgesByTarget(target, targetHandle, nodeGraph.edges);

      return updateCompiledExpr({
        ...nodeGraph,
        edges: addEdge(action.params, nextEdges)
      }, action.setExpr);
    }
    case 'add-node': {
      return {
        ...nodeGraph,
        nodes: [ ...nodeGraph.nodes, action.node ],
      };
    }
    case 'sync-expression': {
      const callbacks = {
        setConstValue: action.setConstValue,
        setAccessorIdentifier: action.setAccessorIdentifier,
      }
      return {
        ...updateNodeGraphFromExpression(nodeGraph, action.expr, action.exprPath, callbacks),
      }
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
    case 'set-accessor': {
      return {
        ...nodeGraph,
        nodes: nodeGraph.nodes.map(node => (
          node.id == action.node && isAccessorNode(node)
          ? { ...node, data: { ...node.data, identifier: action.identifier } }
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
