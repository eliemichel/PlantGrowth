import { type Vector } from '../utils/vector.tsx'
import { type Environment, createDefaultEnvironment } from './EnvironmentModel.tsx'
import { type Matrix4, type Quaternion } from 'three'

import {
  createPhytomersFromPositions,
  createLeafOrientation,
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
  // Node at which the leaf is attached, which necessarily belong to the same
  // branch than the one storing this leaf.
  anchor: LocalNodeRef,

  // Size of the leaf
  size: number,

  // Orientation of the leaf, from World to local Leaf frame
  orientation: Quaternion,
}

export type Bud = {
  // Node at which the bud is attached, which necessarily belong to the same
  // branch than the one storing this bud.
  anchor: LocalNodeRef,

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

  /*
  // Reference to the parent phytomer
  parent: ItemReference<Phytomer>;

  // Reference to the child phytomers
  children: ItemReference<Phytomer>[];
  */
}

export type Meristem = {
  state: MeristemState,

  parent: ItemReference<Phytomer>,
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
  phytomers: Phytomer[],

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

export type LegacyPlant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModelRef: ItemReference<GrowthModel>,

  shoot: BranchRef,
  // root: BranchRef, // TODO: Add roots
}
export type Plant = LegacyPlant;

/**
 * Plants are top-level objects that references the first shoot/root section.
 */
export type NewPlant = {  
  // Index within the growthModels array in the parent simulation model.
  growthModel: ItemReference<GrowthModel>,

  shoot: ItemReference<Phytomer>,
  // root: BranchRef, // TODO: Add roots
}

export type LegacySceneModel = {
  environment: Environment,

  growthModels: Collection<GrowthModel>,

  // This is the pool of branches that plants reference as their shoot/root or
  // that branches reference as their children.
  // Branches not referenced directly or indirectly in plants are dead branches
  // and thus should never grow.
  // Although nothing structurally enforces it, the same branch is not supposed
  // to be pointed to more than once.
  branches: Branch[],

  // Plants are top-level objects that references the first shoot/root section
  plants: LegacyPlant[],

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex, at the very least per-plant.
  leafColor: string,
}
export type SceneModel = LegacySceneModel;

export type NewSceneModel = {
  environment: Environment,

  growthModels: Collection<GrowthModel>,

  // Plants are top-level objects that references the first shoot/root section
  plants: NewPlant[],

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex, at the very least per-plant.
  leafColor: string,

  // New version
  phytomers: Collection<Phytomer>,
  
  meristems: Collection<Meristem>,
}

export function createInitialScene(): SceneModel {
  const growthModels = new Collection([
    createDefaultGrowthModel(),
    {
      ...createDefaultGrowthModel(),
      maxInternodeLength: 0.5,
      maxNodesPerAxis: 2,
    },
  ]);

  return {
    environment: createDefaultEnvironment(),
    leafColor: '#88ff00',
    growthModels,

    plants: [
      {
        shoot: 0,
        growthModelRef: growthModels.createRef(0),
      },
      {
        shoot: 1,
        growthModelRef: growthModels.createRef(1),
      },
    ],

    branches: [
      {
        active: true,
        growthModelIndex: 0,
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
        active: true,
        growthModelIndex: 1,
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

    //phytomers: new Collection<Phytomer>(),
    //meristems: new Collection<Meristem>(),
  }
}

export function createTestScene(sceneIndex: number): SceneModel {
  switch (sceneIndex) {
    case 0: {
      const growthModels = new Collection([
        createGrowthModelPreset(1),
      ]);
      return {
        leafColor: '#a349a4',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: [
          {
            shoot: 0,
            growthModelRef: growthModels.createRef(0),
          },
        ],

        branches: [
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
        ],

        //phytomers: new Collection<Phytomer>(),
        //meristems: new Collection<Meristem>(),
      }
    }

    case 1: {
      const growthModels = new Collection([
        createGrowthModelPreset(2),
      ]);
      return {
        leafColor: '#49a3a4',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: [
          {
            shoot: 0,
            growthModelRef: growthModels.createRef(0),
          },
        ],

        branches: [
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
        ],

        //phytomers: new Collection<Phytomer>(),
        //meristems: new Collection<Meristem>(),
      }
    }

    case 2: {
      const growthModels = new Collection([
        createGrowthModelPreset(3),
      ]);
      return {
        leafColor: '#f37429',
        environment: createDefaultEnvironment(),
        growthModels,

        plants: [
          {
            shoot: 0,
            growthModelRef: growthModels.createRef(0),
          },
        ],

        branches: [
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
        ],

        //phytomers: new Collection<Phytomer>(),
        //meristems: new Collection<Meristem>(),
      }
    }

    default: {
      return createInitialScene();
    }
  }
};
