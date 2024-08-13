import { useAppStore } from '../stores/appStore.tsx'
import { ResultOrError, mapResult, Err, Ok } from '../utils/error.tsx'
import {
  type SimulationModel,
  type GrowthModel,
  createInitialScene,
  createTestScene,
  isExpressionKeyOfGrowthModel,
} from '../models/SimulationModel.tsx'
import { Environment } from '../models/EnvironmentModel.tsx'
import {
  Expression,
} from '../models/DSL.tsx'
import { applyBehavior } from './behaviorPipelines.tsx'
import behaviors from './behaviors.tsx'
import {
  ExpressionPath,
} from '../models/Path.tsx'
import {
  NodeId,
} from '../models/NodeGraphModel.tsx'

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

type SceneAction =
  | { type: 'step-legacy'; stepCount: number }
  | { type: 'step-growth'; stepCount: number }
  | { type: 'step-organogenesis'; stepCount: number }
  | { type: 'step-gravity'; stepCount: number }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'set-growth-model', index: number, model: GrowthModel }
  | { type: 'set-environment', environment: Environment }
  | { type: 'set-expression', path: ExpressionPath, expression: Expression }
  | { type: 'set-constant', path: ExpressionPath, node: NodeId, value: number }
  | { type: 'set-accessor-identifier', path: ExpressionPath, node: NodeId, identifier: string }
  | { type: 'set-active-expression', expr: Expression, path: ExpressionPath, name: string }
  | { type: 'unset-active-expression' }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-legacy': {
      return applyBehavior(state, behaviors.legacy, { repeat: action.stepCount });
    }

    case 'step-growth': {
      return applyBehavior(state, behaviors.growth, { repeat: action.stepCount });
    }

    case 'step-organogenesis': {
      return applyBehavior(state, behaviors.organogenesis, { repeat: action.stepCount });
    }

    case 'step-gravity': {
      return applyBehavior(state, behaviors.gravity, { repeat: action.stepCount });
    }

    case 'set-initial-scene': {
      return createInitialScene();
    }

    case 'set-test-scene': {
      return createTestScene(action.index);
    }

    case 'set-growth-model': {
      return {
        ...state,
        growthModels: state.growthModels.map((model, idx) => idx == action.index ? action.model : model),
      }
    }

    case 'set-environment': {
      return {
        ...state,
        environment: action.environment,
      }
    }

    case 'set-active-expression': {
      const { path, name } = action;
      return {
        ...state,
        selection: {
          ...state.selection,
          activeExpr: { path, name },
        }
      }
    }

    case 'unset-active-expression': {
      return state.selection.activeExpr === null ? state : {
        ...state,
        selection: {
          ...state.selection,
          activeExpr: null,
        }
      }
    }

    case 'set-expression': {
      const { path, expression } = action;

      return mapResult(
        updateExpressionAtPath(state, path, () => expression),
        result => result,
        error => {
          console.error(error);
          return { ...state }
        }
      )
    }

    case 'set-constant': {
      const { path, node, value } = action;

      const updateExpression = (expr: Expression): Expression => {
        switch (expr.type) {
        case "constant": {
          return expr.nodeId == node ? { ...expr, value } : expr
        }
        case "accessor": {
          return expr
        }
        case "operator": {
          return {
            ...expr,
            arguments: expr.arguments.map(updateExpression),
          }
        }
        }
      }

      return mapResult(
        updateExpressionAtPath(state, path, updateExpression),
        result => result,
        error => {
          console.error(error);
          return state;
        }
      )
    }

    case 'set-accessor-identifier': {
      const { path, node, identifier } = action;

      const updateExpression = (expr: Expression): Expression => {
        switch (expr.type) {
        case "constant": {
          return expr
        }
        case "accessor": {
          return expr.nodeId == node ? { ...expr, identifier } : expr
        }
        case "operator": {
          return {
            ...expr,
            arguments: expr.arguments.map(updateExpression),
          }
        }
        }
      }

      return mapResult(
        updateExpressionAtPath(state, path, updateExpression),
        result => result,
        error => {
          console.error(error);
          return state;
        }
      )
    }

    default: {
      throw Error('Unknown scene action: ' + JSON.stringify(action));
    }
  }
}

export function useScene() {
  return useAppStore(state => state.scene)
}

export function useSceneDispatch() {
  const scene = useAppStore(state => state.scene)
  const setScene = useAppStore(state => state.setScene)
  return (action: SceneAction) => setScene(sceneReducer(scene, action))
}
