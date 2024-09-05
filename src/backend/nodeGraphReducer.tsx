// NB: There is no longer a nodeGraphReducer, this only holds utility functions
// related to operations on node graphs.

import {
  type ResultOrError,
  Err,
  Ok,
  isErr,
  allResults,
} from '../utils/error.tsx'

import { makeArray } from '../utils/basics.tsx'

import {
  type Node,
  type Edge,
  type NodeGraphModel,
  type CompilationError,
} from '../models/NodeGraphModel.tsx'

import {
  type NodeId,
  type Expression,
  makeConst,
  makeConstStr,
  makeAcc,
  makeOp,
} from '../models/DSL.tsx'

/**
 * Callbacks that nodes use to edit the underlying model
 */
type NodeCallbacks = {
  setConstValue: (node: NodeId, value: number) => void,
  setConstStrValue: (node: NodeId, value: string) => void,
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
      admonition: null,
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

  case "constant-string": {
      const data = {
        ...common,
        value: subexpr.value,
        setValue: (value: string) => callbacks.setConstStrValue(subexpr.nodeId, value),
      };
      nodes.push({ id: subexpr.nodeId, position: { x, y }, type: "constant-string", data });
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
    nodes, edges,
    maybeCompiledExpr: Err("Need update"),
  };
}

/**
 * Update the current graph from an expression, trying to reuse existing nodes
 * as much as possible.
 */
export function updateNodeGraphFromExpression(nodeGraph: NodeGraphModel, expr: Expression, path: string, callbacks: NodeCallbacks): NodeGraphModel {
  const existingNodes: { [key: NodeId]: Node } = {};
  for (const n of nodeGraph.nodes) {
    existingNodes[n.id] = n;
  }

  const { nodes, edges } = createNodesAndEdgesFromExpression(expr, path, callbacks);

  // From the existing node,we reuse only some UI-related properties (e.g., its position)
  const mergeNodes = (newNode: Node, existingNode: Node | undefined): Node => existingNode === undefined ? newNode : ({
    ...newNode,
    position: existingNode.position,
    selected: existingNode.selected,
    width: existingNode.width,
    height: existingNode.height,
    initialWidth: existingNode.initialWidth,
    initialHeight: existingNode.initialHeight,
  })

  // Reuse existing nodes from the pool if id matches
  const consolidatedNodes = nodes.map(n => mergeNodes(n, existingNodes[n.id]));

  return {
    ...nodeGraph,
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
    case "constant-string":
      return Ok({ ...makeConstStr(node.data.value), nodeId: node.id });
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

export function removeEdgesByTarget(target: string, targetHandle: string | null, edges: Edge[]): Edge[] {
  return edges.filter(e => e.target != target || e.targetHandle != targetHandle)
}
