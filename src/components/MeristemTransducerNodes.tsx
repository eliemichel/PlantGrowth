import { useMemo, useEffect, type ReactNode } from 'react'

import {
	ReactFlow,
	MiniMap,
	Controls,
	Background,
	BackgroundVariant,
	Handle,
	useUpdateNodeInternals,
	Position,
	type NodeProps,
	type ReactFlowProps,
} from '@xyflow/react';
import * as Flow from '@xyflow/react';

import {
	LogLevel,
} from '../models/LogModel.ts'

import {
	type CommonNodeAttributes,
	type InputStateNode,
	type OutputStateNode,
	type Node,
	type Edge,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import './MeristemTransducerNodes.css'

type BaseNodeProps = {
	node: NodeProps<Flow.Node<CommonNodeAttributes>>,
	children: ReactNode,
}

export function BaseNode({ node, children }: BaseNodeProps) {
	const { admonition } = node.data;

	return (
		<div className={node.type + " node"}>
			<header>
				Node
			</header>
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

export function InputStateNode(node: NodeProps<InputStateNode>) {
	const { id, data } = node;
	const updateNodeInternals = useUpdateNodeInternals();

	useEffect(() => {
		updateNodeInternals(id);
	}, [ data.stateTypeCount ])

	return (
		<BaseNode node={node}>
			<div>
				{data.name}
			</div>
			<div className="node-outputs" style={{minHeight: `${data.stateTypeCount * 1}em`}}>
				{Array.from({ length: data.stateTypeCount }).map((_, idx) => (
					<Handle
						key={idx}
						type="target"
						position={Position.Right}
						id={`target-${idx}`}
						style={{ top: `${15 + idx / (data.stateTypeCount - 1) * 70}%` }}
					/>
				))}
			</div>
		</BaseNode>
	)
}

export function OutputStateNode(node: NodeProps<OutputStateNode>) {
	const { data } = node;

	return (
		<BaseNode node={node}>
			<Handle
				type="source"
				position={Position.Left}
			/>
			<div>
				{data.name}
			</div>
		</BaseNode>
	)
}

/**
 * Variant of ReactFlow configured to use MeristemTransducer nodes
 */
export function MeristemTransducerReactFlow(props: ReactFlowProps<Node,Edge>) {
	const { children } = props;

	const nodeTypes = useMemo(() => ({
		"input-state": InputStateNode,
		"output-state": OutputStateNode,
	}), [])

	return (
		<ReactFlow
			className="meristem-transducer-react-flow"
			nodeTypes={nodeTypes}
			colorMode="dark"
			{...props}
		>
			<Controls />
			<MiniMap />
			<Background variant={BackgroundVariant.Dots} gap={12} size={1} />
			{children}
		</ReactFlow>
	)
}
