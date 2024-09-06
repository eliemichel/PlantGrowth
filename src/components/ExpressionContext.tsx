import { type ReactNode, useContext, createContext, useMemo } from 'react'

import { useStore } from '../store'

import {
	type Expression,
} from '../models/DSL.ts'

import {
	type ExpressionPath,
} from '../models/Path.ts'

import {
	mapResult,
} from '../utils/error.ts'

import {
	getExpressionFromPath,
} from '../backend/sceneLib.ts'

type ExpressionContextData = {
	expr: Expression | null,
	path: ExpressionPath | null,
}

function createInitialExpressionContextData(): ExpressionContextData {
	return {
		expr: null,
		path: null,
	}
}

const ExpressionContext = createContext(createInitialExpressionContextData());
export const useExpression = () => useContext(ExpressionContext);

type ExpressionProviderProps = {
	path: ExpressionPath | null,
	children: ReactNode,
}

/**
 * Provide an expression given an expression path. The path may be null, and
 * the expression as well (either because the path is null or because it is
 * invalid).
 */
export function ExpressionProvider({
	path = null,
	children,
}: ExpressionProviderProps) {
	const scene = useStore(state => state.scene);

	const expr = useMemo(() => (
		path === null ? null : mapResult(
			getExpressionFromPath(scene, path),
			result => result,
			error => {
				console.error(error);
				return null;
			}
		)
	), [ scene, path ])

	return (
		<ExpressionContext.Provider value={{ expr, path }}>
			{children}
		</ExpressionContext.Provider>
	)

}
