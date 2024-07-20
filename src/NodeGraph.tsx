import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useNodeGraph, useNodeGraphDispatch } from './reducers/nodeGraphReducer.tsx'
import { Node, Edge } from './models/NodeGraphModel.tsx'

import './NodeGraph.css';

export default function NodeGraph() {
  const graphState = useNodeGraph();
  const dispatch = useNodeGraphDispatch();
  const { nodes, edges } = graphState;

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

  return (
    <div className="nodegraph" style={{ width: '100%', height: '100vh' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
      >
        <Controls />
        <MiniMap />
        <Background variant={BackgroundVariant.Dots} gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
