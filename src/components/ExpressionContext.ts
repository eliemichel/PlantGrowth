import { useContext, createContext } from 'react'

import { type Expression } from '../models/DSL.ts'
import { type ExpressionPath } from '../models/Path.ts'

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
export default ExpressionContext;
export const useExpression = () => useContext(ExpressionContext);
