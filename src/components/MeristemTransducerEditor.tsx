import { useMemo, useCallback, useState } from 'react'
import { MeristemTransducerReactFlow } from './MeristemTransducerNodes.tsx'
import { type Node, type Edge } from '../models/MeristemTransducerNodeGraph.ts'
import { applyNodeChanges, applyEdgeChanges, addEdge, type OnConnect, type OnEdgesChange, type OnNodesChange } from '@xyflow/react'

/**
 * This is a node-based interface to edit the meristem state transition
 * function of a growth model.
 */
export default function MeristemTransducerEditor() {
	const debugNodes: Node[] = useMemo(() => [
		{
			type: "input-state",
			id: '1234',
			position: { x: 0, y: 0 },
			data: {
				admonition: null,
				name: "current state",
				stateTypeCount: 5,
			}
		},
		{
			type: "output-state",
			id: '4321',
			position: { x: 200, y: 0 },
			data: {
				admonition: null,
				name: "set state",
			}
		}
	], [])
	const debugEdges: Edge[] = useMemo(() => [], [])

	const [ nodes, setNodes ] = useState<Node[]>(debugNodes);
	const [ edges, setEdges ] = useState<Edge[]>(debugEdges);
	const onNodesChange: OnNodesChange<Node> = useCallback(
		(changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
		[setNodes],
	);
	const onEdgesChange: OnEdgesChange<Edge> = useCallback(
		(changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
		[setEdges],
	);
	const onConnect: OnConnect  = useCallback(
		(params) => setEdges((eds) => addEdge(params, eds)),
		[ setEdges ],
	);

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
