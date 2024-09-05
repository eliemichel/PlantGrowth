import { expect, test, vi } from 'vitest'

import {
	type Node,
	type NodeGraphModel,
	isConstantNode,
} from '../models/NodeGraphModel.tsx'

import {
	createNodeGraphFromExpression,
	updateNodeGraphFromExpression,
	compileExpression,
} from '../backend/nodeGraphReducer.tsx'

import {
	type NodeId,
	makeExpr,
} from '../models/DSL.tsx'

import {
	assertOk,
} from '../utils/error.tsx'

function findNodeById(nodeGraph: NodeGraphModel, id: NodeId): Node | undefined {
	for (const node of nodeGraph.nodes) {
		if (node.id === id) {
			return node;
		}
	}
	return undefined
}

test('Can compile graph created from expression', async () => {
	const callbacks = {
		setConstValue: vi.fn(),
		setConstStrValue: vi.fn(),
		setAccessorIdentifier: vi.fn(),
	}

	const expr = assertOk(makeExpr(["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	]));
	const path = "/";

	const nodeGraph = createNodeGraphFromExpression(expr, path, callbacks);

	const newExpr = compileExpression(nodeGraph).result;
	expect(newExpr).toBeDefined();

	expect(newExpr).toStrictEqual(expr);

	expect(callbacks.setConstValue).not.toHaveBeenCalled();
	expect(callbacks.setConstStrValue).not.toHaveBeenCalled();
	expect(callbacks.setAccessorIdentifier).not.toHaveBeenCalled();
})

test('Can compile graph created from expression, with string constant', async () => {
	const callbacks = {
		setConstValue: vi.fn(),
		setConstStrValue: vi.fn(),
		setAccessorIdentifier: vi.fn(),
	}

	const expr = assertOk(makeExpr(["if",
		["==", ["get", "meristem"], "init"],
		0.02,
		0.0,
	]));
	const path = "/";

	const nodeGraph = createNodeGraphFromExpression(expr, path, callbacks);

	const maybeNewExpr = compileExpression(nodeGraph);
	const newExpr = maybeNewExpr.result;
	expect(newExpr).toBeDefined();

	expect(newExpr).toStrictEqual(expr);

	expect(callbacks.setConstValue).not.toHaveBeenCalled();
	expect(callbacks.setConstStrValue).not.toHaveBeenCalled();
	expect(callbacks.setAccessorIdentifier).not.toHaveBeenCalled();
})

test('Updating graph from expression does not reset node position', async () => {
	const callbacks = {
		setConstValue: vi.fn(),
		setConstStrValue: vi.fn(),
		setAccessorIdentifier: vi.fn(),
	}

	const expr = assertOk(makeExpr(["if",
		["<", ["get", "length"], 0.3],
		0.02,
		0.0,
	]));
	const path = "/";

	const nodeGraph = createNodeGraphFromExpression(expr, path, callbacks);

	// Update expression
	expect(expr.type).toBe("operator");
	if (expr.type != "operator") return;
	const subexpr = expr.arguments[1];
	expect(subexpr.type).toBe("constant");
	if (subexpr.type != "constant") return;
	subexpr.value = 0.42;

	// Check that it did not update the node graph
	const node = findNodeById(nodeGraph, subexpr.nodeId);
	expect(node).toBeDefined();
	if (node === undefined) return;
	expect(node.type).toBe("constant");
	if (!isConstantNode(node)) return;
	expect(node.data.value).toBe(0.02);

	// Move a node
	expect(node.position.x).not.toBe(1000);
	node.position.x = 1000;

	// Update node graph
	const newNodeGraph = updateNodeGraphFromExpression(nodeGraph, expr, "/", callbacks);

	// Check update of data
	const newNode = findNodeById(newNodeGraph, subexpr.nodeId);
	expect(newNode).toBeDefined();
	if (newNode === undefined) return;
	expect(newNode.type).toBe("constant");
	if (!isConstantNode(newNode)) return;
	expect(newNode.data.value).toBe(0.42);

	// Check that the node did not move
	expect(newNode.position.x).toBe(1000);
	// Even check that the position object remains the same
	expect(newNode.position).toBe(node.position);

	const newExpr = compileExpression(newNodeGraph).result;
	expect(newExpr).toBeDefined();

	expect(newExpr).toStrictEqual(expr);

	expect(callbacks.setConstValue).not.toHaveBeenCalled();
	expect(callbacks.setConstStrValue).not.toHaveBeenCalled();
	expect(callbacks.setAccessorIdentifier).not.toHaveBeenCalled();
})
