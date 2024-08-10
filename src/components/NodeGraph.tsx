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

import { useNodeGraph, useNodeGraphDispatch } from '../reducers/nodeGraphReducer.tsx'
import {
  type Node,
  type Edge,
  type OperatorNode,
  type ConstantNode,
} from '../models/NodeGraphModel.tsx'

import './NodeGraph.css';

function OperatorNode({ id, data }: NodeProps<OperatorNode>) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [ data.argCount ])

  return (
    <div className="operator node">
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

function ConstantNode({ id, data }: NodeProps<ConstantNode>) {
  const dispatch = useNodeGraphDispatch();

  return (
    <div className="constant node">
      <Handle type="target" position={Position.Top} />
      <div>
        <input
          type="number"
          className="nodrag"
          value={data.value}
          onChange={e => dispatch({
            type: 'set-constant',
            node: id,
            value: parseFloat(e.target.value),
          })}
        />
      </div>
    </div>
  )
}

export default function NodeGraph() {
  const graphState = useNodeGraph();
  const dispatch = useNodeGraphDispatch();
  const { name, nodes, edges } = graphState;

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
        <Panel position="top-center">Expression: {name}</Panel>
      </ReactFlow>
    </div>
  );
}
