import { useMemo, useEffect, ReactNode, useCallback, ChangeEvent } from 'react'
import { useShallow } from 'zustand/react/shallow'
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
import * as Flow from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { isOk } from '../utils/error.ts'

import {
  useAppStore,
} from '../stores/appStore.ts'

import {
  type Node,
  type Edge,
  type CommonNodeAttributes,
  type OperatorNode,
  type ConstantNode,
  type ConstantStringNode,
  type AccessorNode,
} from '../models/ExpressionNodeGraphModel.ts'
import {
  formatExpressionPath,
  parseExpressionPath,
} from '../models/Path.ts'
import {
  makeRandomNodeId,
} from '../models/DSL.ts'
import {
  LogLevel,
} from '../models/LogModel.ts'

import {
  forEachPathInScene,
} from '../backend/sceneLib.ts'

import {
  useExpression,
} from './ExpressionContext.tsx'

import Dropdown, { DropdownItem } from './Dropdown.tsx'

import './NodeGraph.css';

type BaseNodeProps = {
  node: NodeProps<Flow.Node<CommonNodeAttributes>>,
  children: ReactNode,
}

function BaseNode({ node, children }: BaseNodeProps) {
  const { admonition, isOutput } = node.data;

  return (
    <div className={node.type + " node" + (isOutput ? " output" : "")}>
      {children}
      {admonition === null ? null : (
        <div className="node-admonition nodrag">
          <span className="symbol">!</span>
          <div className="message">
            {LogLevel[admonition.level].toUpperCase()}<br/>
            {admonition.message}<br/>
          </div>
        </div>
      )}
    </div>
  )
}

function OperatorNode(node: NodeProps<OperatorNode>) {
  const { id, data } = node;
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    updateNodeInternals(id);
  }, [ data.argCount ])

  return (
    <BaseNode node={node}>
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
    </BaseNode>
  )
}

function ConstantNode(node: NodeProps<ConstantNode>) {
  const { value, setValue } = node.data;
  return (
    <BaseNode node={node}>
      <Handle type="source" position={Position.Top} />
      <div>
        <input
          type="number"
          className="nodrag"
          value={value}
          onChange={e => setValue(parseFloat(e.target.value))}
        />
      </div>
    </BaseNode>
  )
}

function ConstantStringNode(node: NodeProps<ConstantStringNode>) {
  const { value, setValue } = node.data;
  return (
    <BaseNode node={node}>
      <Handle type="source" position={Position.Top} />
      <div>
        <input
          type="text"
          className="nodrag"
          value={value}
          onChange={e => setValue(e.target.value)}
        />
      </div>
    </BaseNode>
  )
}

function AccessorNode(node: NodeProps<AccessorNode>) {
  const { identifier, setIdentifier } = node.data;
  return (
    <BaseNode node={node}>
      <Handle type="source" position={Position.Top} />
      <div>
        <input
          type="text"
          className="nodrag"
          value={identifier}
          onChange={e => setIdentifier(e.target.value)}
        />
      </div>
    </BaseNode>
  )
}

export default function NodeGraph() {
  const nodeTypes = useMemo(() => ({
    "operator": OperatorNode,
    "constant": ConstantNode,
    "constant-string": ConstantStringNode,
    "accessor": AccessorNode,
  }), [])

  const { expr, path } = useExpression();
  const [
    graphState,
    setConstantNodeValue,
    setConstantStringNodeValue,
    setAccessorNodeIdentifier,
    applyNodeChanges,
    applyEdgeChanges,
    connectNodes,
    addNode,
    log,
    setActiveExpression,
    scene,
  ] = useAppStore(useShallow(state => [
    (path !== null && expr !== null) ? state.ensureNodeGraph(path) : null,
    state.setConstantNodeValue,
    state.setConstantStringNodeValue,
    state.setAccessorNodeIdentifier,
    state.applyNodeChanges,
    state.applyEdgeChanges,
    state.connectNodes,
    state.addNode,
    state.log,
    state.setActiveExpression,
    state.scene,
  ]));

  const onSelectPath = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    const maybePath = parseExpressionPath(e.target.value);
    if (isOk(maybePath)) {
      const path = maybePath.result;
      const label = e.target.value;
      setActiveExpression(path, label);
    } else {
      log(LogLevel.Error, `Could not parse path '${e.target.value}': ${maybePath.error}`);
    }
  }, [ setActiveExpression ])

  const pathSelector = useMemo(() => {
    const options = [
      <option value="" key={-1}>Select a path...</option>
    ];
    forEachPathInScene(scene, path => {
      const formattedPath = formatExpressionPath(path);
      options.push(
        <option value={formattedPath} key={formattedPath}>{formattedPath}</option>
      )
    })
    return (
      <select
        value={path === null ? "" : formatExpressionPath(path)}
        onChange={onSelectPath}
      >
        {options}
      </select>
    )
  }, [ scene, path, onSelectPath ])

  if (path === null || expr === null || graphState === null) {
    return <>
      <p><em>Click on "edit fx" to start editing an expression or select in the list below:</em></p>
      {pathSelector}
    </>
  }

  const { nodes, edges } = graphState;

  const onNodesChange = (changes: NodeChange<Node>[]) => applyNodeChanges(path, changes);

  const onEdgesChange = (changes: EdgeChange<Edge>[]) => applyEdgeChanges(path, changes);

  const onConnect = (connection: Connection) => connectNodes(path, connection);

  const common = { isOutput: false, path: formatExpressionPath(path), admonition: null };

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
          Expression: {pathSelector}

          <Dropdown label="Add">
            <DropdownItem>
              <button onClick={() => addNode(path, {
                id: makeRandomNodeId(),
                position: { x: 0, y: 0 },
                type: "operator",
                data: { ...common, operator: "if", argCount: 3 }
              })}>
                Operator: if
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => addNode(path, {
                id: makeRandomNodeId(),
                position: { x: 0, y: 0 },
                type: "operator",
                data: { ...common, operator: "<", argCount: 2 }
              })}>
                Operator: &lt;
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => addNode(path, {
                id: makeRandomNodeId(),
                position: { x: 0, y: 0 },
                type: "operator",
                data: { ...common, operator: "==", argCount: 2 }
              })}>
                Operator: ==
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => {
                const id = makeRandomNodeId();
                const setIdentifier = (identifier: string) => setAccessorNodeIdentifier(path, id, identifier);
                addNode(path, {
                  id,
                  position: { x: 0, y: 0 },
                  type: "accessor",
                  data: { ...common, identifier: "<identifier>", setIdentifier }
                })
              }}>
                Accessor
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => {
                const id = makeRandomNodeId();
                const setValue = (value: number) => setConstantNodeValue(path, id, value)
                addNode(path, {
                  id,
                  position: { x: 0, y: 0 },
                  type: "constant",
                  data: { ...common, value: 0.0, setValue }
                })
              }}>
                Constant
              </button>
            </DropdownItem>
            <DropdownItem>
              <button onClick={() => {
                const id = makeRandomNodeId();
                const setValue = (value: string) => setConstantStringNodeValue(path, id, value)
                addNode(path, {
                  id,
                  position: { x: 0, y: 0 },
                  type: "constant-string",
                  data: { ...common, value: "<string>", setValue }
                })
              }}>
                Constant String
              </button>
            </DropdownItem>
          </Dropdown>

        </Panel>
      </ReactFlow>
    </div>
  );
}
