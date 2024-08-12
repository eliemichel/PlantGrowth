import { createReducerContext } from '../utils/createReducerContext.tsx'
import { ResultOrError, mapResult, Err, Ok } from '../utils/error.tsx'
import {
  type SimulationModel,
  type GrowthModel,
  createDefaultGrowthModel,
  createDefaultMeristemState,
  createDefaultSelection,
  isExpressionKeyOfGrowthModel,
} from '../models/SimulationModel.tsx'
import { Environment, createDefaultEnvironment } from '../models/EnvironmentModel.tsx'
import {
  Expression,
} from '../models/DSL.tsx'
import {
  createPhytomersFromPositions,
  createLeafOrientation,
} from './growth.tsx'
import { applyBehavior } from './behaviorPipelines.tsx'
import behaviors from './behaviors.tsx'
import {
  ExpressionPath,
} from '../models/Path.tsx'
import {
  NodeId,
} from '../models/NodeGraphModel.tsx'

export function createInitialScene(): SimulationModel {
  return {
    environment: createDefaultEnvironment(),
    selection: createDefaultSelection(),
    leafColor: '#88ff00',
    growthModels: [
      createDefaultGrowthModel(),
      {
        ...createDefaultGrowthModel(),
        maxInternodeLength: 0.5,
        maxNodesPerAxis: 2,
      },
    ],

    plants: [
      {
        shoot: 0,
      },
      {
        shoot: 1,
      },
    ],

    branches: [
      {
        growthModelIndex: 0,
        active: true,
        phytomers: createPhytomersFromPositions([
          [ 0, 0, 0 ],
          [ 0.05, 0.1, -0.02 ],
          [ 0.03, 0.5, -0.03 ],
        ]),
        leaves: [
          {
            anchor: 0,
            size: 0.3,
            orientation: createLeafOrientation({
              normal: [ 0.3, 1.0, -0.1 ],
              direction: [ 1.0, 0.0, 1.0 ]
            })
          },
          {
            anchor: 1,
            size: 0.2,
            orientation: createLeafOrientation({
              normal: [ 0.0, 1.0, 1.0 ],
              direction: [ -1.0, 0.0, 0.0 ]
            })
          },
        ],
        buds: [
          {
            anchor: 1,
            size: 0.3,
            direction: [ 0.3, 1.0, -0.1 ],
            differentiation: "dormant",
            age: 0,
          },
        ],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
      {
        growthModelIndex: 1,
        active: true,
        phytomers: createPhytomersFromPositions([
          [ 0, 0, 0 ],
          [ -0.02, 0.2, 0.05 ],
        ]),
        leaves: [
          {
            anchor: 0,
            size: 0.4,
            orientation: createLeafOrientation({
              normal: [ 0.0, 1.0, 0.0 ],
              direction: [ 1.0, 0.0, 1.0 ]
            })
          },
        ],
        buds: [],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
    ],
  }
}

function createTestScene(sceneIndex: number): SimulationModel {
  switch (sceneIndex) {
    case 0: {
      return {
        leafColor: '#a349a4',
        environment: createDefaultEnvironment(),
        selection: createDefaultSelection(),
        growthModels: [
          createDefaultGrowthModel(),
        ],

        plants: [
          {
            shoot: 0,
          },
        ],

        branches: [
          {
            growthModelIndex: 0,
            active: true,
            phytomers: createPhytomersFromPositions([
              [ 0, 0, 0 ],
              [ 0, 0.1, 0 ],
            ]),
            leaves: [],
            buds: [],
            children: [],
            meristemState: createDefaultMeristemState(),
          },
        ],
      }
    }
    default: {
      return createInitialScene();
    }
  }
};

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

/**
 * TODO: Move selection related stuff in some dedicated place
 */
function updateSelectionCache(state: SimulationModel): SimulationModel {
  const oldActivePrev = state.selection.activeExpr;
  const activeExpr = (() => {

    if (oldActivePrev === null) return null;

    return mapResult(
      getExpressionFromPath(state, oldActivePrev.path),
      expr => ({
        ...oldActivePrev,
        expr
      }),
      error => { console.error(error); return null},
    );

  })();

  return {
    ...state,
    selection: { activeExpr },
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
  | { type: 'set-active-expression', expr: Expression, path: ExpressionPath, name: string }

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
      return updateSelectionCache({
        ...state,
        growthModels: state.growthModels.map((model, idx) => idx == action.index ? action.model : model),
      })
    }

    case 'set-environment': {
      return {
        ...state,
        environment: action.environment,
      }
    }

    case 'set-active-expression': {
      const { expr, path, name } = action;
      return {
        ...state,
        selection: {
          ...state.selection,
          activeExpr: { expr, path, name },
        }
      }
    }

    case 'set-expression': {
      const { path, expression } = action;

      return mapResult(
        updateExpressionAtPath(state, path, () => expression),
        result => updateSelectionCache(result),
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
          return expr.nodeId == node ? { ...expr, value } : { ...expr }
        }
        case "accessor": {
          return { ...expr }
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
        result => updateSelectionCache(result),
        error => {
          console.error(error);
          return { ...state }
        }
      )
    }

    default: {
      throw Error('Unknown scene action: ' + JSON.stringify(action));
    }
  }
}

export const [
  useScene,
  useSceneDispatch,
  SceneProvider
] = createReducerContext(sceneReducer, createInitialScene());
