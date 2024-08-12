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
  compileExpression,
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
  mapResult,
} from '../utils/error.tsx'

import './NodeGraph.css';

function OperatorNode({ id, data }: NodeProps<OperatorNode>) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [ data.argCount ])

  return (
    <div className={"operator node" + (data.isOutput ? " output" : "")}>
      <Handle type="target" position={Position.Top} />
      <div>
        {data.operator}
      </div>
      {Array.from({ length: data.argCount }).map((_, idx) => (
        <Handle
          key={idx}
          type="source"
          position={Position.Bottom}
          id={`source-${idx}`}
          style={{ left: `${15 + idx / (data.argCount - 1) * 70}%` }}
        />
      ))}
    </div>
  )
}

function ConstantNode({ data }: NodeProps<ConstantNode>) {
  const { value, setValue } = data;
  return (
    <div className={"constant node" + (data.isOutput ? " output" : "")}>
      <Handle type="target" position={Position.Top} />
      <div className={data.isOutput ? "output" : ""}>
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
  return (
    <div className={"constant node" + (data.isOutput ? " output" : "")}>
      <Handle type="target" position={Position.Top} />
      <div className={data.isOutput ? "output" : ""}>
        {data.label}
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
      })

    }
  }, [ expr, name, path ])

  const onNodesChange = (changes: NodeChange<Node>[]) => dispatch({
    type: 'node-change',
    changes
  });

  const onEdgesChange = (changes: EdgeChange<Edge>[]) => dispatch({
    type: 'edge-change',
    changes
  });

  const onConnect = (params: Connection) => dispatch({
    type: 'connect',
    params
  });

  const nodeTypes = useMemo(() => ({
    operator: OperatorNode,
    constant: ConstantNode,
    accessor: AccessorNode,
  }), [])

  return (
    <div className="nodegraph" style={{ position: 'relative', width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
        <Panel position="top-center">
          Expression: {name} ({formatExpressionPath(path)})
          <button onClick={_ => compileExpression(graphState).then(expression => sceneDispatch({
            type: "set-expression",
            path,
            expression,
          }))}>Submit</button>
        </Panel>
      </ReactFlow>
    </div>
  );
}
