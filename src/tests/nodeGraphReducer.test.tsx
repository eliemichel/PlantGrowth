import { expect, test, vi } from 'vitest'

import {
	isConstantNode,
} from '../models/NodeGraphModel.tsx'

import {
	createNodeGraphFromExpression,
	updateNodeGraphFromExpression,
	compileExpression,
} from '../reducers/nodeGraphReducer.tsx'

import {
	makeExpr,
} from '../models/DSL.tsx'

import {
	assertOk,
} from '../utils/error.tsx'

test('Can compile graph created from expression', async () => {
	const callbacks = {
		setConstValue: vi.fn(),
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
	expect(callbacks.setAccessorIdentifier).not.toHaveBeenCalled();
})

test('Updating graph from expression does not reset node position', async () => {
	const callbacks = {
		setConstValue: vi.fn(),
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
	const node = nodeGraph.nodePool[subexpr.nodeId];
	expect(node).toBeDefined();
	expect(node.type).toBe("constant");
	if (!isConstantNode(node)) return;
	expect(node.data.value).toBe(0.02);

	// Move a node
	expect(node.position.x).not.toBe(1000);
	node.position.x = 1000;

	// Update node graph
	const newNodeGraph = updateNodeGraphFromExpression(nodeGraph, expr, "/", callbacks);

	// Check update of data
	const newNode = newNodeGraph.nodePool[subexpr.nodeId];
	expect(newNode).toBeDefined();
	expect(newNode.type).toBe("constant");
	if (!isConstantNode(newNode)) return;
	expect(newNode.data.value).toBe(0.42);

	// Check that the node did not move
	expect(newNode.position.x).toBe(1000);

	const newExpr = compileExpression(newNodeGraph).result;
	expect(newExpr).toBeDefined();

	expect(newExpr).toStrictEqual(expr);

	expect(callbacks.setConstValue).not.toHaveBeenCalled();
	expect(callbacks.setAccessorIdentifier).not.toHaveBeenCalled();
})
