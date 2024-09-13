import { type Matrix4, type Quaternion } from 'three'

import { hexToRgb } from '../utils/color.ts'
import { type Vector } from '../utils/vector.ts'

import {
  type Environment,
  createDefaultEnvironment,
} from './EnvironmentModel.ts'

import {
  createPhytomersFromPositions,
  createLeafOrientation,
} from '../backend/growth.ts'

import {
  type GrowthModel,
  type MeristemState,
  type DifferentiationState,
  createDefaultGrowthModel,
  createDefaultMeristemState,
  createGrowthModelPreset,
} from './GrowthModel.ts'

import {
  Collection,
  type ItemReference,
} from '../utils/Collection.ts'

import {
  mergeScenes
} from '../backend/sceneLib.ts'

export type Leaf = {
  // Size of the leaf
  size: number,

  // Orientation of the leaf, from World to local Leaf frame
  orientation: Quaternion,
}

export type Bud = {
  // Size of the bud
  size: number,

  // Direction in which the bud grows
  direction: Vector,

  // What the bud will become
  differentiation: "dormant" | "leaf" | "shoot",

  // Time (in step index) since creation
  age: number,
}

/**
 * A phytomer is an internode, its end node and one or more leaf/bud
 */
export type Phytomer = {
  // Position of the node and local frame. The internode length is given by the
  // parent. The Z axis gives the direction of the stem at the node.
  // NB: This must only contain a rotation and translation, no scale or any
  // other transform is expected.
  transform: Matrix4,

  // Radius of the phytomer's node. It is not part of transform because
  // changing a node's thickness does not affect other node's thickness
  // (contrary to changing the transform, which affects all children).
  // TODO: Maybe 'transform' should regroup both the Frame and the Thickness
  thickness: number,

  // Leaves attached to the node
  leaves: Leaf[],

  // Buds attached to the node
  buds: Bud[],

  // Reference to the child phytomers
  children: ItemReference<Phytomer>[];

  // Reference to the top-level plant
  plantRef: ItemReference<Plant>;

  // State type in which the meristem was when creating this phytomer's internode 
  differentiation: DifferentiationState;

  // At the tip of the phytomer, there is either a meristem or the next phytomer of the axis.
  meristem: Meristem | null;

  // Defines the color and mechanical properties of the phytomer
  // This list corresponds to the keys of stemColors in GrowthModel
  // TODO: Find a better name than 'type'
  type: keyof GrowthModel['stemColors'],

  /*
  // Reference to the parent phytomer
  parentRef: ItemReference<Phytomer>;
  */
}

export type Meristem = {
  state: MeristemState,
}

/**
 * Plants are top-level objects that references the first shoot/root section.
 */
export type Plant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModelRef: ItemReference<GrowthModel>,

  // World transform to the origin of the plant
  transform: Matrix4,

  // Radius of the base node.
  // TODO: Maybe 'transform' should regroup both the Frame and the Thickness
  thickness: number,

  shoot: ItemReference<Phytomer>,
  // TODO: Add roots
}

export type Scene = {
  environment: Environment,

  growthModels: Collection<GrowthModel>,

  // This is the pool of branches that plants reference as their shoot/root or
  // that branches reference as their children.
  // Branches not referenced directly or indirectly in plants are dead branches
  // and thus should never grow.
  // Although nothing structurally enforces it, the same branch is not supposed
  // to be pointed to more than once.
  //branches: Branch[],

  // Plants are top-level objects that references the first shoot/root section
  plants: Collection<Plant>,

  phytomers: Collection<Phytomer>,
}

////////////////////////////////////////////
// Reference/Collection-free and JSON-ready variant of the Scene that is used for serialization

export type SerializedScene = {
  environment: Environment,

  growthModels: GrowthModel[],

  // Plants are top-level objects that references the first shoot/root section
  plants: SerializedPlant[],
}

export type SerializedPlant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModelIndex: number,

  // Transform of the base node
  transform: Matrix4,

  // Radius of the base node.
  thickness: number,

  shoot: SerializedPhytomer,
}

export type SerializedPhytomer = {
  // Position of the node and local frame. The internode length is given by the parent
  transform: Matrix4;

  // Radius of the phytomer's node.
  thickness: number,

  // Leaves attached to the node
  leaves: Leaf[],

  // Buds attached to the node
  buds: Bud[],

  // Reference to the child phytomers
  children: SerializedPhytomer[];

  // Reference to the child phytomers
  meristem: Meristem | null;

  // State type in which the meristem was when creating this phytomer's internode 
  differentiation: DifferentiationState;

  // Defines the color and mechanical properties of the phytomer
  type: keyof GrowthModel['stemColors'],
}

////////////////////////////////////////////
// Deserialization

export function deserializeScene(serializedScene: SerializedScene): Scene {
  const {
    environment,
  } = serializedScene;

  const mockPhytomerRef = new Collection<Phytomer>().createRef(-1);

  const growthModels = new Collection<GrowthModel>(serializedScene.growthModels);

  const plants = new Collection<Plant>(serializedScene.plants.map(serializedPlant => ({
    growthModelRef: growthModels.createRef(serializedPlant.growthModelIndex),
    transform: serializedPlant.transform,
    thickness: serializedPlant.thickness,
    shoot: mockPhytomerRef,
  })));

  const phytomers = new Collection<Phytomer>();

  function addPhytomerHierarchy(serializedPhytomer: SerializedPhytomer, plantRef: ItemReference<Plant>) {
    const {
      transform,
      thickness,
      leaves,
      buds,
      children,
      differentiation,
      meristem,
      type,
    } = serializedPhytomer;

    const newPhytomer: Phytomer = {
      transform,
      thickness,
      leaves,
      buds,
      children: [],
      differentiation,
      plantRef,
      meristem,
      type,
    }
    phytomers.append(newPhytomer);
    const newPhytomerRef = phytomers.createRef(phytomers.items.length - 1);

    for (const serializedChild of children) {
      newPhytomer.children.push(addPhytomerHierarchy(serializedChild, plantRef));
    }

    return newPhytomerRef
  }

  serializedScene.plants.map((serializedPlant, plantIndex) => {
    plants.items[plantIndex].shoot = addPhytomerHierarchy(serializedPlant.shoot, plants.createRef(plantIndex));
  })

  return {
    environment,
    growthModels,
    plants,
    phytomers,
  }
}

////////////////////////////////////////////
// Init functions

export function createInitialScene(): Scene {
  const phytomerTransforms0 = createPhytomersFromPositions([
    [ 0, 0, 0 ],
    [ 0.05, 0.1, -0.02 ],
    [ 0.03, 0.5, -0.03 ],
  ])

  const phytomerTransforms1 = createPhytomersFromPositions([
    [ 0, 0, 0 ],
    [ -0.02, 0.2, 0.05 ],
  ])

  const defaultGrowthModel = createDefaultGrowthModel();

  return deserializeScene({
    environment: createDefaultEnvironment(),

    growthModels: [
      defaultGrowthModel,
      {
        ...defaultGrowthModel,
        parameters: defaultGrowthModel.parameters.map(param => (
          param.name === "maxInternodeLength" && param.type === "float" ? { ...param, value: 0.5 }
          : param.name === "maxNodesPerAxis" && param.type === "integer" ? { ...param, value: 2 }
          : param
        )),
        stemColors: { ... defaultGrowthModel.stemColors, shoot: hexToRgb('#1a3306') },
      },
    ],

    plants: [
      {
        growthModelIndex: 0,
        transform: phytomerTransforms0[0].transform,
        thickness: 0.008,
        shoot: {
          transform: phytomerTransforms0[1].transform,
          thickness: 0.008,
          leaves: [
            {
              size: 0.3,
              orientation: createLeafOrientation({
                normal: [ 0.3, 1.0, -0.1 ],
                direction: [ 1.0, 0.0, 1.0 ]
              })
            },
          ],
          buds: [],
          differentiation: { type: "init", data: {} },
          meristem: null,
          type: "bark",
          children: [
            {
              transform: phytomerTransforms0[2].transform,
              thickness: 0.005,
              leaves: [
                {
                  size: 0.2,
                  orientation: createLeafOrientation({
                    normal: [ 0.0, 1.0, 1.0 ],
                    direction: [ -1.0, 0.0, 0.0 ]
                  })
                },
              ],
              buds: [
                {
                  size: 0.3,
                  direction: [ 0.3, 1.0, -0.1 ],
                  differentiation: "dormant",
                  age: 0,
                }
              ],
              differentiation: { type: "init", data: {} },
              children: [],
              meristem: {
                state: createDefaultMeristemState(),
              },
              type: "shoot",
            },
          ],
        }
      },

      {
        growthModelIndex: 1,
        transform: phytomerTransforms1[0].transform,
        thickness: 0.005,
        shoot: {
          transform: phytomerTransforms1[1].transform,
          thickness: 0.005,
          leaves: [
            {
              size: 0.4,
              orientation: createLeafOrientation({
                normal: [ 0.0, 1.0, 0.0 ],
                direction: [ 1.0, 0.0, 1.0 ]
              })
            },
          ],
          buds: [],
          differentiation: { type: "init", data: {} },
          children: [],
          meristem: {
            state: createDefaultMeristemState(),
          },
          type: "shoot",
        }
      },
    ],
  })
}

export function createTestScene(sceneIndex: number): Scene {
  switch (sceneIndex) {
    case 0: {
      const phytomerTransforms = createPhytomersFromPositions([
        [ 0, 0, 0 ],
        [ 0, 0.1, 0 ],
      ])

      return deserializeScene({
        environment: createDefaultEnvironment(),
        growthModels: [
          createGrowthModelPreset(1),
        ],

        plants: [
          {
            growthModelIndex: 0,
            transform: phytomerTransforms[0].transform,
            thickness: 0.005,
            shoot: {
              transform: phytomerTransforms[1].transform,
              thickness: 0.005,
              leaves: [],
              buds: [],
              children: [],
              meristem: { state: createDefaultMeristemState() },
              differentiation: { type: "init", data: {} },
              type: "shoot",
            }
          }
        ]
      })
    }

    case 1: {
      const phytomerTransforms = createPhytomersFromPositions([
        [ 0, 0, 0 ],
        [ 0, 0.001, 0 ],
      ])

      return deserializeScene({
        environment: createDefaultEnvironment(),
        growthModels: [
          createGrowthModelPreset(2),
        ],

        plants: [
          {
            growthModelIndex: 0,
            transform: phytomerTransforms[0].transform,
            thickness: 0.005,
            shoot: {
              transform: phytomerTransforms[1].transform,
              thickness: 0.005,
              leaves: [],
              buds: [],
              children: [],
              meristem: { state: createDefaultMeristemState() },
              differentiation: { type: "init", data: {} },
              type: "shoot",
            }
          }
        ]
      })
    }

    case 2: {
      const phytomerTransforms = createPhytomersFromPositions([
        [ 0, 0, 0 ],
        [ 0, 0.001, 0 ],
      ])

      return deserializeScene({
        environment: createDefaultEnvironment(),
        growthModels: [
          createGrowthModelPreset(3),
        ],

        plants: [
          {
            growthModelIndex: 0,
            transform: phytomerTransforms[0].transform,
            thickness: 0.005,
            shoot: {
              transform: phytomerTransforms[1].transform,
              thickness: 0.005,
              leaves: [],
              buds: [],
              children: [],
              meristem: { state: createDefaultMeristemState() },
              differentiation: { type: "young", data: { age: 0 } },
              type: "shoot",
            }
          }
        ]
      })
    }

    case 3: {
      const scene1 = createTestScene(1);
      const scene2 = createTestScene(2);
      const scene3 = mergeScenes(scene1, scene2);

      const secondPlant = scene3.plants.items[1];
      secondPlant.transform.setPosition(1, 0, 0);
      scene3.phytomers.at(secondPlant.shoot).transform.setPosition(1, 0.01, 0);

      return scene3;
    }

    default: {
      return createInitialScene();
    }
  }
}
