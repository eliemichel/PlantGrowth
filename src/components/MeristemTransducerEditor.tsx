import { useCallback, useMemo, useEffect } from 'react'
import { useStore } from '../store'
import {
	applyNodeChanges,
	applyEdgeChanges,
	addEdge,
	type OnConnect,
	type OnEdgesChange,
	type OnNodesChange,
} from '@xyflow/react'

import {
	type Node,
	type Edge,
} from '../models/MeristemTransducerNodeGraphModel.ts'

import { MeristemTransducerReactFlow } from './MeristemTransducerNodes.tsx'
import { useGrowthModel } from './GrowthModelSelector.tsx'

/**
 * This is a node-based interface to edit the meristem state transition
 * function of a growth model.
 */
export default function MeristemTransducerEditor() {
	const [ _growthModel, growthModelIdx ]  = useGrowthModel();

	const setMeristemTransducerNodeGraph = useStore(store => store.setMeristemTransducerNodeGraph);
	const ensureMeristemTransducerNodeGraph = useStore(store => store.ensureMeristemTransducerNodeGraph);

	const allNodeGraphs = useStore(store => store.meristemTransducerNodeGraphs)
	const nodeGraph = useMemo(
		() => allNodeGraphs[growthModelIdx],
		[ allNodeGraphs, growthModelIdx ]
	)

	const onNodesChange: OnNodesChange<Node> = useCallback(
		(changes) => setMeristemTransducerNodeGraph(growthModelIdx, graph => ({
			...graph,
			nodes: applyNodeChanges(changes, graph.nodes),
		})),
		[ setMeristemTransducerNodeGraph, growthModelIdx ],
	);
	const onEdgesChange: OnEdgesChange<Edge> = useCallback(
		(changes) => setMeristemTransducerNodeGraph(growthModelIdx, graph => ({
			...graph,
			edges: applyEdgeChanges(changes, graph.edges),
		})),
		[ setMeristemTransducerNodeGraph, growthModelIdx ],
	);
	const onConnect: OnConnect  = useCallback(
		(params) => setMeristemTransducerNodeGraph(growthModelIdx, graph => ({
			...graph,
			edges: addEdge(params, graph.edges),
		})),
		[ setMeristemTransducerNodeGraph, growthModelIdx ],
	);

	useEffect(() => {
		if (nodeGraph === undefined) {
			ensureMeristemTransducerNodeGraph(growthModelIdx);
		}
	}, [ nodeGraph, growthModelIdx ])

	if (nodeGraph === undefined) {
		return null;
	}

	const { nodes, edges } = nodeGraph;

	return (
		<div className="meristem-transducer-editor" style={{ position: 'relative', width: '100%', height: '100%', backgroundColor: 'red' }}>
			<MeristemTransducerReactFlow
				nodes={nodes}
				edges={edges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				onConnect={onConnect}
			/>
		</div>
	)
}
