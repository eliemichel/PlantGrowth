import { type Vector } from '../utils/vector.tsx'
import { type Environment, createDefaultEnvironment } from './EnvironmentModel.tsx'
import { type Matrix4, type Quaternion } from 'three'

import {
  createPhytomersFromPositions,
  createLeafOrientation,
  createPhytomersAndMeristemsFromBranches,
} from '../backend/growth.tsx'

import {
  type GrowthModel,
  type MeristemState,
  createDefaultGrowthModel,
  createDefaultMeristemState,
  createGrowthModelPreset,
} from './GrowthModel.tsx'

import {
  Collection,
  type ItemReference,
} from '../utils/Collection.tsx'

// Reference to a node that belongs to the same branch
export type LocalNodeRef = number;

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

// Index within model.branches
// NB: You'll have fun when starting to remove branches... make sure to
// decrement all refs that were higher.
export type BranchRef = number;

// Index within scene.phytomers.
// Do NOT manually create/modify such a ref, but rather use createPhytomerRef
// as this enables keeping track of all refs and make sure to update their raw
// internal index whenever there is a deletion/insertion.
export type PhytomerRef = {
  index: number;
}

/**
 * A phytomer is an internode, its end node and one or more leaf/bud
 */
export type Phytomer = {
  // Position of the node and local frame. The internode length is given by the parent
  transform: Matrix4;

  // Leaves attached to the node
  leaves: Leaf[],

  // Buds attached to the node
  buds: Bud[],

  // Reference to the child phytomers
  children: ItemReference<Phytomer>[];

  // Reference to the top-level plant
  plantRef: ItemReference<Plant>;

  // State type in which the meristem was when creating this phytomer's internode 
  differentiation: string;

  /*
  // Reference to the parent phytomer
  parentRef: ItemReference<Phytomer>;
  */
}

export type Meristem = {
  state: MeristemState,

  parentRef: ItemReference<Phytomer>,
}

/**
 * This represents an axis of nodes.
 */
export type Branch = {
  // Meristems: they can differentiate into stems, leaves or flowers
  // A meristem has an internal state, e.g., to remember its last growth direction.
  // A meristem can have multiple layers that follow different differentiation programs.
  // Meristems are born with a specific type: root, shoot, flower, etc.
  // Each active branch ends with a meristem.
  // Inactive branches still have a meristem state to remember about their cell differentiation.
  meristemState: MeristemState,

  // A branch is active if it still grows
  active: boolean,

  // Positions/orientation of the nodes that constitute the branch, in world space.
  phytomers: { transform: Matrix4 }[],

  // Leaves attached to nodes of the branch.
  leaves: Leaf[],

  // Buds attached to nodes of the branch.
  buds: Bud[],

  // Children of this branch, identified by an index within the pool of
  // branches that the simulation model holds.
  // TODO: Should we keep the hierarchy separate from the geometry?
  children: BranchRef[],

  // Cached from parent plant
  growthModelIndex: number,
}

/**
 * Plants are top-level objects that references the first shoot/root section.
 */
export type Plant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModelRef: ItemReference<GrowthModel>,

  shoot: ItemReference<Phytomer>,
  // root: BranchRef, // TODO: Add roots
}

export type SceneModel = {
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

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex, at the very least per-plant.
  leafColor: string,

  phytomers: Collection<Phytomer>,
  
  meristems: Collection<Meristem>,
}

////////////////////////////////////////////
// Reference/Collection-free and JSON-ready variant of the Scene that is used for serialization

export type SerializedScene = {
  environment: Environment,

  growthModels: GrowthModel[],

  // Plants are top-level objects that references the first shoot/root section
  plants: SerializedPlant[],

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex, at the very least per-plant.
  leafColor: string,
}

export type SerializedPlant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModelIndex: number,

  shoot: SerializedPhytomer,
}

export type SerializedPhytomer = {
  // Position of the node and local frame. The internode length is given by the parent
  transform: Matrix4;

  // Leaves attached to the node
  leaves: Leaf[],

  // Buds attached to the node
  buds: Bud[],

  // Reference to the child phytomers
  children: SerializedPhytomer[];

  // Reference to the child phytomers
  meristems: SerializedMeristem[];

  // State type in which the meristem was when creating this phytomer's internode 
  differentiation: string;
}

export type SerializedMeristem = {
  state: MeristemState;
}

////////////////////////////////////////////
// Deserialization

export function deserializeScene(serializedScene: SerializedScene): SceneModel {
  const {
    environment,
    leafColor,
  } = serializedScene;

  const mockPhytomerRef = new Collection<Phytomer>().createRef(-1);

  const growthModels = new Collection<GrowthModel>(serializedScene.growthModels);

  const plants = new Collection<Plant>(serializedScene.plants.map(serializedPlant => ({
    growthModelRef: growthModels.createRef(serializedPlant.growthModelIndex),
    shoot: mockPhytomerRef,
  })));

  const phytomers = new Collection<Phytomer>();
  const meristems = new Collection<Meristem>();

  function addPhytomerHierarchy(serializedPhytomer: SerializedPhytomer, plantRef: ItemReference<Plant>) {
    const {
      transform,
      leaves,
      buds,
      children,
      differentiation,
    } = serializedPhytomer;

    const newPhytomer: Phytomer = {
      transform,
      leaves,
      buds,
      children: [],
      differentiation,
      plantRef,
    }
    phytomers.append(newPhytomer);
    const newPhytomerRef = phytomers.createRef(phytomers.items.length - 1);

    for (const serializedChild of children) {
      newPhytomer.children.push(addPhytomerHierarchy(serializedChild, plantRef));
    }

    for (const serializedMeristem of serializedPhytomer.meristems) {
      meristems.append({
        state: serializedMeristem.state,
        parentRef: newPhytomerRef,
      });
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
    leafColor,
    phytomers,
    meristems,
  }
}

////////////////////////////////////////////
// Init functions

export function createInitialScene(): SceneModel {
  const phytomerTransforms0 = createPhytomersFromPositions([
    [ 0, 0, 0 ],
    [ 0.05, 0.1, -0.02 ],
    [ 0.03, 0.5, -0.03 ],
  ])

  const phytomerTransforms1 = createPhytomersFromPositions([
    [ 0, 0, 0 ],
    [ -0.02, 0.2, 0.05 ],
  ])

  return deserializeScene({
    environment: createDefaultEnvironment(),
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
        growthModelIndex: 0,
        shoot: {
          transform: phytomerTransforms0[1].transform,
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
          differentiation: "",
          meristems: [],
          children: [
            {
              transform: phytomerTransforms0[2].transform,
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
              differentiation: "",
              children: [],
              meristems: [
                {
                  state: createDefaultMeristemState(),
                },
              ],
            },
          ],
        }
      },

      {
        growthModelIndex: 1,
        shoot: {
          transform: phytomerTransforms1[1].transform,
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
          differentiation: "",
          children: [],
          meristems: [
            {
              state: createDefaultMeristemState(),
            },
          ],
        }
      },
    ],
  })
}

export function createTestScene(sceneIndex: number): SceneModel {
  switch (sceneIndex) {
    case 0: {
      const growthModels = new Collection([
        createGrowthModelPreset(1),
      ]);

      const { phytomers, meristems } = createPhytomersAndMeristemsFromBranches([
        {
          active: true,
          growthModelIndex: 0,
          phytomers: createPhytomersFromPositions([
            [ 0, 0, 0 ],
            [ 0, 0.1, 0 ],
          ]),
          leaves: [],
          buds: [],
          children: [],
          meristemState: createDefaultMeristemState(),
        },
      ]);

      return {
        leafColor: '#a349a4',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: new Collection([
          {
            shoot: phytomers.createRef(0),
            growthModelRef: growthModels.createRef(0),
          },
        ]),

        phytomers,
        meristems,
      }
    }

    case 1: {
      const growthModels = new Collection([
        createGrowthModelPreset(2),
      ]);

      const { phytomers, meristems } = createPhytomersAndMeristemsFromBranches([
        {
          active: true,
          growthModelIndex: 0,
          phytomers: createPhytomersFromPositions([
            [ 0, 0, 0 ],
            [ 0, 0.001, 0 ],
          ]),
          leaves: [],
          buds: [],
          children: [],
          meristemState: createDefaultMeristemState(),
        },
      ]);

      return {
        leafColor: '#49a3a4',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: new Collection([
          {
            shoot: phytomers.createRef(0),
            growthModelRef: growthModels.createRef(0),
          },
        ]),

        phytomers,
        meristems,
      }
    }

    case 2: {
      const growthModels = new Collection([
        createGrowthModelPreset(3),
      ]);

      const { phytomers, meristems } = createPhytomersAndMeristemsFromBranches([
        {
          active: true,
          growthModelIndex: 0,
          phytomers: createPhytomersFromPositions([
            [ 0, 0, 0 ],
            [ 0, 0.001, 0 ],
          ]),
          leaves: [],
          buds: [],
          children: [],
          meristemState: createDefaultMeristemState(),
        },
      ]);

      return {
        leafColor: '#f37429',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: new Collection([
          {
            shoot: phytomers.createRef(0),
            growthModelRef: growthModels.createRef(0),
          },
        ]),

        phytomers,
        meristems,
      }
    }

    default: {
      return createInitialScene();
    }
  }
};
