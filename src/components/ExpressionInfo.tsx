import { useMemo } from 'react'
import { makeExpressionBuilder, formatExpressionBuilder } from '../models/DSL.ts'
import { formatExpressionPath } from '../models/Path.ts'

import { useExpression } from './ExpressionContext.tsx'

import './ExpressionInfo.css'

export default function ExpressionInfo() {
  const { expr, path } = useExpression();

  if (path === null || expr === null) {
    return <p>Click on "edit fx" to inspect an expression</p>
  }

  const exprSrc = useMemo(() => (
    formatExpressionBuilder(makeExpressionBuilder(expr))
  ), [ expr ])

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
