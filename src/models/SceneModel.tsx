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
} from './GrowthModel.tsx'

// Reference to a node that belong to the same branch
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

/**
 * A branch is made of multiple nodes, a.k.a. phytomers
 */
export type Phytomer = {
  transform: Matrix4;
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
  meristemState: MeristemState,

  // Index within the growthModels array in the parent simulation model.
  growthModelIndex: number,

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
}

/**
 * Plants are top-level objects that references the first shoot/root section.
 */
export type Plant = {
  shoot: BranchRef,
  // root: BranchRef, // TODO: Add roots
}

export type SceneModel = {
  environment: Environment,

  growthModels: GrowthModel[],

  // This is the pool of branches that plants reference as their shoot/root or
  // that branches reference as their children.
  // Branches not referenced directly or indirectly in plants are dead branches
  // and thus should never grow.
  // Although nothing structurally enforces it, the same branch is not supposed
  // to be pointed to more than once.
  branches: Branch[],

  // Plants are top-level objects that references the first shoot/root section
  plants: Plant[],

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex, at the very least per-plant.
  leafColor: string,
}

export function createInitialScene(): SceneModel {
  return {
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

export function createTestScene(sceneIndex: number): SceneModel {
  switch (sceneIndex) {
    case 0: {
      return {
        leafColor: '#a349a4',
        environment: createDefaultEnvironment(),
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
