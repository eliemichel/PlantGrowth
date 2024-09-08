import { useMemo, useEffect, useCallback, type ReactNode } from 'react'
import { useStore } from '../store'

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

import { LogLevel } from '../models/LogModel.ts'
import { type GrowthModel } from '../models/GrowthModel.ts'

import {
	type CommonNodeAttributes,
	type InputStateNode,
	type OutputStateNode,
	type Node,
	type Edge,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import './MeristemTransducerNodes.css'

// Move to some utility file?
function useGrowthModel(growthModelIndex: number): GrowthModel | undefined {
	const allGrowthModels = useStore(store => store.scene.growthModels.items)
	const growthModel = useMemo(
		() => allGrowthModels[growthModelIndex],
		[ allGrowthModels, growthModelIndex ]
	)
	return growthModel;
}

type BaseNodeProps = {
	node: NodeProps<Flow.Node<CommonNodeAttributes>>,
	children: ReactNode,
}

export function BaseNode({ node, children }: BaseNodeProps) {
	const { admonition, label } = node.data;

	return (
		<div className={node.type + " node"}>
			<header>
				{label}
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
	const { growthModelIndex } = data;
	const growthModel = useGrowthModel(growthModelIndex);

	const updateNodeInternals = useUpdateNodeInternals();
	useEffect(() => {
		updateNodeInternals(id);
	}, [ growthModel?.meristemStateTypes.length ])

	if (growthModel === undefined) {
		return null;
	}

	return (
		<BaseNode node={node}>
			<ul className="node-slots">
				{growthModel.meristemStateTypes.map((type, typeIdx) => (
					<li key={typeIdx}>
						<span>{type.name}</span>
						<Handle
							className="exec-handle"
							type="target"
							position={Position.Right}
							id={`target-${typeIdx}`}
						/>
					</li>
				))}
			</ul>
		</BaseNode>
	)
}

export function OutputStateNode(node: NodeProps<OutputStateNode>) {
	const { id, data } = node;
	const { growthModelIndex, typeName } = data;

	const growthModel = useGrowthModel(growthModelIndex)

	const setOutputStateNodeData = useStore(store => store.setOutputStateNodeData)
	const setTypeName = useCallback((typeName: string) => {
		setOutputStateNodeData(growthModelIndex, id, data => ({ ...data, typeName }))
	}, [ id, setOutputStateNodeData ])

	const type = useMemo(() => {
		if (growthModel === undefined) return;
		for (const type of growthModel.meristemStateTypes) {
			if (type.name === typeName) {
				return type;
			}
		}
	}, [ typeName, growthModel?.meristemStateTypes ])

	const updateNodeInternals = useUpdateNodeInternals();
	useEffect(() => {
		updateNodeInternals(id);
	}, [ type ])

	if (growthModel === undefined) {
		return null;
	}

	const { meristemStateTypes } = growthModel;

	return (
		<BaseNode node={node}>
			<ul className="node-slots">
				<li>
					<Handle
						className="exec-handle"
						type="source"
						position={Position.Left}
					/>
					<select value={typeName} onChange={e => setTypeName(e.target.value)}>
						{meristemStateTypes.map((type, typeIdx) => (
							<option key={typeIdx}>{type.name}</option>
						))}
					</select>
				</li>
				{type === undefined ? (
					<li>
						Warning: '{typeName}' is not a valid type name.
					</li>
				) : (
					type.dataFields.map((field, fieldIdx) => (
						<li key={fieldIdx}>
							{field.name} ({field.type})
							<Handle
								className={`${field.type}-handle`}
								type="source"
								position={Position.Left}
								id={`field-${fieldIdx}`}
							/>
						</li>
					))
				)}
			</ul>
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
