// NB: There is no longer a sceneReducer, this only holds utility functions
// related to operations on scenes.

import { ResultOrError, Err, Ok } from '../utils/error.ts'

import {
  type Scene,
} from '../models/SceneModel.ts'

import {
  isExpressionKeyOfGrowthModel,
  allExpressionKeysOfGrowthModel,
} from '../models/GrowthModel.ts'

import {
  type Expression,
} from '../models/DSL.ts'

import {
  type ExpressionPath,
} from '../models/Path.tsx'

// TODO: How to avoid re-rendering upon any change of 'state' that is not pointed to by 'path'?
export function getExpressionFromPath(state: Scene, path: ExpressionPath): ResultOrError<Expression,string> {
  switch (path.domain) {

  case "model": {
    const label = path.field;

    if (!isExpressionKeyOfGrowthModel(label)) {
      return Err(`Field is not an expression: 'growthModel.${label}'`);
    }

    const len = state.growthModels.items.length;
    if (path.index < 0 || path.index >= len) {
      return Err(`Growth model index is out of range: #${path.index} (out of ${len} growth model${len > 1 ? 's' : ''})`);
    }
    
    return Ok(state.growthModels.items[path.index][label])
  }

  }
}

/**
 * Iterate over all possible paths. Stop iteration if callback returns true
 * NB: Try to avoid using this as much as possible, it is usually a costly
 * operation.
 */
export function forEachPathInScene(scene: Scene, callback: (path: ExpressionPath) => void) {
  const { growthModels } = scene;
  for (let index = 0 ; index < growthModels.items.length ; ++index) {
    for (const field of allExpressionKeysOfGrowthModel()) {
      callback({
        domain: "model",
        index,
        field,
      })
    }
  }
}
