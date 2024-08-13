import { useMemo, useEffect } from 'react'
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  NodeChange,
  EdgeChange,
  Panel,
  Handle,
  Position,
  NodeProps,
  useUpdateNodeInternals,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  useNodeGraph,
  useNodeGraphDispatch,
} from '../reducers/nodeGraphReducer.tsx'
import {
  useScene,
  useSceneDispatch,
  getExpressionFromPath,
} from '../reducers/sceneReducer.tsx'
import {
  type NodeId,
  type Node,
  type Edge,
  type OperatorNode,
  type ConstantNode,
  type AccessorNode,
} from '../models/NodeGraphModel.tsx'
import {
  type ExpressionPath,
  formatExpressionPath,
} from '../models/Path.tsx'
import {
  type Expression,
  makeRandomNodeId
} from '../models/DSL.tsx'
import {
  mapResult,
} from '../utils/error.tsx'

import Dropdown, { DropdownItem } from './Dropdown.tsx'

import './NodeGraph.css';

function OperatorNode({ id, data }: NodeProps<OperatorNode>) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [ data.argCount ])

  return (
    <div className={"operator node" + (data.isOutput ? " output" : "")}>
      <Handle type="source" position={Position.Top} />
      <div>
        {data.operator}
      </div>
      {Array.from({ length: data.argCount }).map((_, idx) => (
        <Handle
          key={idx}
          type="target"
          position={Position.Bottom}
          id={`target-${idx}`}
          style={{ left: `${15 + idx / (data.argCount - 1) * 70}%` }}
        />
      ))}
    </div>
  )
}

function ConstantNode({ data }: NodeProps<ConstantNode>) {
  const { value, setValue, isOutput } = data;
  return (
    <div className={"constant node" + (isOutput ? " output" : "")}>
      <Handle type="source" position={Position.Top} />
      <div>
        <input
          type="number"
          className="nodrag"
          value={value}
          onChange={e => setValue(parseFloat(e.target.value))}
        />
      </div>
    </div>
  )
}

function AccessorNode({ data }: NodeProps<AccessorNode>) {
  const { identifier, setIdentifier, isOutput } = data;
  return (
    <div className={"accessor node" + (isOutput ? " output" : "")}>
      <Handle type="source" position={Position.Top} />
      <div>
        <input
          type="text"
          className="nodrag"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
        />
      </div>
    </div>
  )
}

type NodeGraphProps = {
  name: string,
  path: ExpressionPath,
}

export default function NodeGraph({
  name,
  path,
}: NodeGraphProps) {
  const graphState = useNodeGraph();
  const dispatch = useNodeGraphDispatch();
  const scene = useScene();
  const sceneDispatch = useSceneDispatch();
  const { nodes, edges } = graphState;

  // TODO: Move this into a wrapper object that is only responsible for getting
  // the expression and unsetting active if expression is null.
  const expr = useMemo(() => mapResult(
    getExpressionFromPath(scene, path),
    result => result,
    error => {
      console.error(error);
      return null;
    }
  ), [ scene, path ])

  // When the model-side expression gets updated, we rebuild the node-graph-side expression
  useEffect(() => {
    if (expr === null) {

      sceneDispatch({
        type: 'unset-active-expression'
      })

    } else {

      dispatch({
        type: 'sync-expression',
        expr,
        exprName: name,
        exprPath: formatExpressionPath(path),
        setConstValue: (node: NodeId, value: number) => {
          sceneDispatch({
            type: 'set-constant',
            path,
            node,
            value,
          })
        },
        setAccessorIdentifier: (node: NodeId, identifier: string) => {
          sceneDispatch({
            type: 'set-accessor-identifier',
            path,
            node,
            identifier,
          })
        },
      })

    }
  }, [ expr, name, path ])

  const setExpr = (expression: Expression) => sceneDispatch({
    type: "set-expression",
    path,
    expression,
  })

  const onNodesChange = (changes: NodeChange<Node>[]) => dispatch({
    type: 'node-change',
    changes
  });

  const onEdgesChange = (changes: EdgeChange<Edge>[]) => dispatch({
    type: 'edge-change',
    changes,
    setExpr,
  });

  const onConnect = (params: Connection) => dispatch({
    type: 'connect',
    params,
    setExpr,
  });

  const nodeTypes = useMemo(() => ({
    operator: OperatorNode,
    constant: ConstantNode,
    accessor: AccessorNode,
  }), [])

  const common = { isOutput: false, path: formatExpressionPath(path) };

  return (
    <div className="nodegraph" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        colorMode="dark"
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Panel position="top-center">
          Expression: {formatExpressionPath(path)}

          <Dropdown label="Add">
            <DropdownItem>
              <button onClick={() => dispatch({
                type: 'add-node',
                node: {
                  id: makeRandomNodeId(),
                  position: { x: 0, y: 0 },
                  type: "operator",
                  data: { ...common, operator: "if", argCount: 3 }
                },
              })}>
                Operator: if
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => dispatch({
                type: 'add-node',
                node: {
                  id: makeRandomNodeId(),
                  position: { x: 0, y: 0 },
                  type: "operator",
                  data: { ...common, operator: "<", argCount: 2 }
                },
              })}>
                Operator: &lt;
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => {
                const id = makeRandomNodeId();
                const setIdentifier = (identifier: string) => dispatch({
                  type: 'set-accessor',
                  node: id,
                  identifier,
                })
                dispatch({
                  type: 'add-node',
                  node: {
                    id,
                    position: { x: 0, y: 0 },
                    type: "accessor",
                    data: { ...common, identifier: "<identifier>", setIdentifier }
                  },
                })
              }}>
                Accessor
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => {
                const id = makeRandomNodeId();
                const setValue = (value: number) => dispatch({
                  type: 'set-constant',
                  node: id,
                  value,
                })
                dispatch({
                  type: 'add-node',
                  node: {
                    id,
                    position: { x: 0, y: 0 },
                    type: "constant",
                    data: { ...common, value: 0.0, setValue }
                  },
                })
              }}>
                Constant
              </button>
            </DropdownItem>
          </Dropdown>

        </Panel>
      </ReactFlow>
    </div>
  );
}
