import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
  type NodeChange,
  type EdgeChange,
} from '@xyflow/react';

import { createReducerContext } from '../utils/createReducerContext.tsx'
import {
  type ResultOrError,
  Err,
  Ok,
  isErr,
  allResults,
} from '../utils/error.tsx'

import { makeArray } from '../utils/basics.tsx'

import {
  type NodeId,
  type Node,
  type Edge,
  type NodeGraphModel,
  type CompilationError,
  isConstantNode
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
    name: 'Click on "edit fx" to edit an expression.',
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
}

/**
 * Auxiliary function for both createNodeGraphFromExpression and updateNodeGraphFromExpression
 */
export function createNodesAndEdgesFromExpression(expr: Expression, callbacks: NodeCallbacks): { nodes: Node[], edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function processSubExpr(subexpr: Expression, x: number, y: number, isOutput: boolean) {
    switch (subexpr.type) {

    case "constant": {
      const data = {
        isOutput,
        value: subexpr.value,
        setValue: (value: number) => callbacks.setConstValue(subexpr.nodeId, value),
      };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "constant", data });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    }

    case "accessor": {
      const data = { label: subexpr.identifier, isOutput };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "accessor", data });
      return { nodeId: subexpr.nodeId, width: 1, height: 1 };
    }

    case "operator": {
      const data = { operator: subexpr.operator, argCount: subexpr.arguments.length, isOutput };
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
 * Try recompiling expression from graph
 */
function updateCompiledExpr(nodeGraph: NodeGraphModel): NodeGraphModel {
  return {
    ...nodeGraph,
    maybeCompiledExpr: compileExpression(nodeGraph),
  }
}

/**
 * Create a new graph model from scratch, given an expression
 * NB: You most probably want to use `updateNodeGraphFromExpression` to retain node positions
 */
export function createNodeGraphFromExpression(expr: Expression, name: string, path: string, callbacks: NodeCallbacks): NodeGraphModel {
  const { nodes, edges } = createNodesAndEdgesFromExpression(expr, callbacks);
  return {
    nodePool: createNodePool(nodes),
    name, path, nodes, edges,
    maybeCompiledExpr: Err("Need update"),
  };
}

/**
 * Update the current graph from an expression, trying to reuse existing nodes
 * as much as possible.
 */
export function updateNodeGraphFromExpression(nodeGraph: NodeGraphModel, expr: Expression, callbacks: NodeCallbacks): NodeGraphModel {
  const nodePool = {
    ...nodeGraph.nodePool,
    ...createNodePool(nodeGraph.nodes),
  }
  const { nodes, edges } = createNodesAndEdgesFromExpression(expr, callbacks);

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
  }

  return {
    ...nodeGraph,
    nodePool: {
      ...nodePool,
      ...createNodePool(consolidatedNodes),
    },
    nodes: consolidatedNodes,
    edges,
  };
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
      return Ok({ ...makeAcc(node.data.label), nodeId: node.id });
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
  | { type: 'edge-change'; changes: EdgeChange<Edge>[] }
  | { type: 'connect'; params: Connection }

  // Entierly rebuild the model given an expression tree
  | { type: 'sync-expression'; expr: Expression, exprName: string, exprPath: string, setConstValue: (node: NodeId, value: number) => void }

  // Update a constant node
  | { type: 'set-constant', node: string, value: number }

  | { type: 'add-node', node: Node }

export function nodeGraphReducer(nodeGraph: NodeGraphModel, action: NodeGraphAction): NodeGraphModel {
  switch (action.type) {
    case 'node-change': {
      // NB: No need to update the compiled expression here because node's
      // setValue handles are able to directly modify the source expression.
      return {
        ...nodeGraph,
        nodes: applyNodeChanges(action.changes, nodeGraph.nodes).map(node => node)
      };
    }
    case 'edge-change': {
      console.log("edge-change", action.changes)

      action.changes.map(params => {
        const { type } = params;
        if (type == "remove") {
          console.log("removing edge with id", params.id);
        }
      })

      return updateCompiledExpr({
        ...nodeGraph,
        edges: applyEdgeChanges(action.changes, nodeGraph.edges)
      });
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
      });
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
      }
      return {
        ...updateNodeGraphFromExpression(nodeGraph, action.expr, callbacks),
        name: action.exprName,
        path: action.exprPath,
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
