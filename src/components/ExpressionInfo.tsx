import { useMemo } from 'react'
import { makeExpressionBuilder, formatExpressionBuilder } from '../models/DSL.ts'
import { formatExpressionPath } from '../models/Path.ts'

import { useExpression } from './ExpressionContext.tsx'

import './ExpressionInfo.css'

export default function ExpressionInfo() {
  const { expr, path } = useExpression();

  const exprSrc = useMemo(() => (
    expr !== null
    ? formatExpressionBuilder(makeExpressionBuilder(expr))
    : null
  ), [ expr ])

  if (path === null || exprSrc === null) {
    return <p>Click on "edit fx" to inspect an expression</p>
  }

  return (
    <>
      <h3>Expression: {formatExpressionPath(path)}</h3>
      <pre className="expression-info">
        <samp>
          {exprSrc}
        </samp>
      </pre>
    </>
  );
}
