import { useMemo } from 'react'
import { useScene, getExpressionFromPath } from '../reducers/sceneReducer.tsx'
import { makeExpressionBuilder, formatExpressionBuilder } from '../models/DSL.tsx'
import { type ExpressionPath, formatExpressionPath } from '../models/Path.tsx'
import { mapResult } from '../utils/error.tsx'

import './ExpressionInfo.css'

type ExpressionInfoProps = {
  path: ExpressionPath,
}

export default function ExpressionInfo({
  path
}: ExpressionInfoProps) {
  const scene = useScene();

  // TODO: Move this into a wrapper and deduplicate with NodeGraph component
  const expr = useMemo(() => mapResult(
    getExpressionFromPath(scene, path),
    result => result,
    error => {
      console.error(error);
      return null;
    }
  ), [ scene, path ])

  if (expr === null) {
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
