import { useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './NodeGraph.css';

export default function NodeGraph({
  graphState,
  dispatchGraphAction
}) {
  const { nodes, edges } = graphState;

  const onNodesChange = changes => dispatchGraphAction({
    type: 'node-change',
    changes
  });

  const onEdgesChange = changes => dispatchGraphAction({
    type: 'edge-change',
    changes
  });

  const onConnect = params => dispatchGraphAction({
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
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}
