/*
 * Utils for react-flow
 */

import {
	type Node
} from '../models/ExpressionNodeGraphModel.ts'

import {
	type NodeChange,
	type NodeRemoveChange,
} from '@xyflow/react'

export function isNodeRemoveChange(change: NodeChange<Node>): change is NodeRemoveChange {
	return change.type === "remove"
}
