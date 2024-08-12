import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';

import { createReducerContext } from '../utils/createReducerContext.tsx'
import {
  ResultOrError,
  Err,
  Ok,
  isErr,
  allResults,
} from '../utils/error.tsx'

import { makeArray } from '../utils/basics.tsx'

import { Node, Edge, NodeGraphModel, isConstantNode } from '../models/NodeGraphModel.tsx'
import {
  type Expression,
  makeConst,
  makeAcc,
  makeOp,
} from '../models/DSL.tsx'

export function createInitialNodeGraph(): NodeGraphModel {
  return {
    name: 'Click on "edit fx" to edit an expression.',
    path: '/',
    nodes: [],
    edges: [],
  }
}

function createNodeGraphFromExpression(expr: Expression, name: string, path: string): NodeGraphModel {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function processSubExpr(subexpr: Expression, x: number, y: number, isOutput: boolean) {
    switch (subexpr.type) {

    case "constant": {
      const data = { value: subexpr.value, isOutput };
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
          target: child.nodeId,
          source: subexpr.nodeId,
          sourceHandle: `source-${argIdx}`
        });
      });

      return { nodeId: subexpr.nodeId, width, height };
    }

    }
  }

  processSubExpr(expr, 0, 0, true /* isOutput */);

  return { name, path, nodes, edges };
}

type CompilationError = string;

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
export function compileExpression(graphState: NodeGraphModel): Promise<Expression> {
  const idToNode: { [key: string]: Node } = {};
  for (const node of graphState.nodes) {
    idToNode[node.id] = node;
  }

  function makeSourceKey(source: string, sourceHandle: string | null | undefined): string {
    return sourceHandle ? `${source}__${sourceHandle}` : source
  }

  const sourceKeyToEdge: { [key: string]: Edge } = {};
  for (const edge of graphState.edges) {
    const sourceKey = makeSourceKey(edge.source, edge.sourceHandle);
    sourceKeyToEdge[sourceKey] = edge;
  }

  function compileNode(nodeId: string): ResultOrError<Expression,CompilationError> {
    const node = idToNode[nodeId];
    if (node === undefined) {
      return Err(`Invalid node id: '${nodeId}'`);
    }
    switch (node.type) {
    case "constant":
      return Ok(makeConst(node.data.value));
    case "accessor":
      return Ok(makeAcc(node.data.label));
    case "operator":
      const { operator, argCount } = node.data;
      const maybeArgs = allResults(makeArray(argCount, argIdx => {
        const sourceKey = makeSourceKey(node.id, `source-${argIdx}`);
        const edge = sourceKeyToEdge[sourceKey];
        if (edge === undefined) {
          return Err(`Missing connection at input #${argIdx} of node '${node.id}'`)
        }
        return compileNode(edge.target);
      }));
      if (isErr(maybeArgs)) return maybeArgs;
      else return Ok(makeOp(operator, ...maybeArgs.result));
    default:
      return Err(`Unknown node type: '${JSON.stringify(node)}'`)
    }
  }

  return new Promise((resolve, reject) => {
    const maybeOutputNodeId = getOutputNodeId(graphState);
    if (isErr(maybeOutputNodeId)) return reject(maybeOutputNodeId.error);
    const outputNodeId = maybeOutputNodeId.result;

    const maybeExpr = compileNode(outputNodeId);
    if (isErr(maybeExpr)) return reject(maybeExpr.error);
    else resolve(maybeExpr.result);
  })
}

export type NodeGraphAction =
  | { type: 'node-change'; changes: NodeChange<Node>[] }
  | { type: 'edge-change'; changes: EdgeChange<Edge>[] }
  | { type: 'connect'; params: Connection }

  // Entierly rebuild the model given an expression tree
  | { type: 'load-expression'; expr: Expression, exprName: string, exprPath: string }

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
      return createNodeGraphFromExpression(action.expr, action.exprName, action.exprPath);
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
