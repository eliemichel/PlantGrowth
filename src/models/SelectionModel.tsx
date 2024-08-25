import { ExpressionPath } from './Path.tsx'

/**
 * This stores any information related to selection in the UI.
 * NB: This may move to its own file
 */
export type SelectionModel = {
  // Link to the expression currently edited in the node graph
  activeExpr: null | {
    path: ExpressionPath,
    name: string,
  }
}

export function createDefaultSelection(): SelectionModel {
  return {
    activeExpr: null,
  }
}
