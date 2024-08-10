type NodeId = string
type EdgeId = string

export type Node = {
	id: NodeId,
	position: { x: number, y: number },
	data: { label: string }
}

export type Edge = {
	id: EdgeId,
	source: NodeId,
	target: NodeId
}

export type NodeGraphModel = {
	name: string,
	nodes: Node[],
	edges: Edge[],
}
