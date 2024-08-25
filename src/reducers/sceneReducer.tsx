// NB: There is no longer a sceneReducer, this only holds utility functions
// related to operations on scenes.

import { ResultOrError, Err, Ok } from '../utils/error.tsx'
import {
  type SimulationModel,
  type GrowthModel,
  isExpressionKeyOfGrowthModel,
} from '../models/SimulationModel.tsx'
import {
  Expression,
} from '../models/DSL.tsx'
import {
  ExpressionPath,
} from '../models/Path.tsx'

// TODO: How to avoid re-rendering upon any change of 'state' that is not pointed to by 'path'?
export function getExpressionFromPath(state: SimulationModel, path: ExpressionPath): ResultOrError<Expression,string> {
  switch (path.domain) {

  case "model": {
    const label = path.field;

    if (!isExpressionKeyOfGrowthModel(label)) {
      return Err(`Field is not an expression: 'growthModel.${label}'`);
    }
    
    return Ok(state.growthModels[path.index][label])
  }

  }
}

/**
 * @param update callback receives the current expression and must return the
 * new expression that replaces it.
 */
export function updateExpressionAtPath(
  state: SimulationModel,
  path: ExpressionPath,
  update: (expr: Expression) => Expression
): ResultOrError<SimulationModel,string> {
  switch (path.domain) {

  case "model": {
    const label = path.field;

    if (!isExpressionKeyOfGrowthModel(label)) {
      return Err(`Field is not an expression: 'growthModel.${label}'`);
    }

    const updateModel = (model: GrowthModel) => ({
      ...model,
      [label]: update(model[label]),
    });
    
    return Ok({
      ...state,
      growthModels: state.growthModels.map((model, idx) => idx == path.index ? updateModel(model) : model),
    })
  }

  }
}
