// NB: There is no longer a sceneReducer, this only holds utility functions
// related to operations on scenes.

import { ResultOrError, Err, Ok } from '../utils/error.tsx'
import {
  type SceneModel,
} from '../models/SceneModel.tsx'
import {
  isExpressionKeyOfGrowthModel,
} from '../models/GrowthModel.tsx'
import {
  Expression,
} from '../models/DSL.tsx'
import {
  ExpressionPath,
} from '../models/Path.tsx'

// TODO: How to avoid re-rendering upon any change of 'state' that is not pointed to by 'path'?
export function getExpressionFromPath(state: SceneModel, path: ExpressionPath): ResultOrError<Expression,string> {
  switch (path.domain) {

  case "model": {
    const label = path.field;

    if (!isExpressionKeyOfGrowthModel(label)) {
      return Err(`Field is not an expression: 'growthModel.${label}'`);
    }
    
    return Ok(state.growthModels.items[path.index][label])
  }

  }
}
