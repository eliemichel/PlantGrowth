import { Vector } from '../utils/vector.tsx'

export type Leaf = {
  // Position of the node at which the leaf is attached
  anchor: Vector,

  // Size of the leaf
  size: number,

  // Direction in which the leaf grows
  direction: Vector,

  // Direction in which the leaf area is oriented (e.g., direction of the sun)
  // In case normal is not orthogonal to direction, direction takes over and
  // the leaf gets oriented as close as possible to the prescribed normal.
  normal: Vector,
}

export type Bud = {
  // Position of the node at which the bud is attached
  anchor: Vector,

  // Size of the bud
  size: number,

  // Direction in which the bud grows
  direction: Vector,
}

/**
 * This represents an axis of nodes.
 */
export type Branch = {
  // Index within the growthModels array in the parent simulation model.
  growthModelIndex: number,

  // A branch is active if it still grows, i.e., it is a leaf axis with no children.
  active: boolean,

  // Positions of the nodes that constitute the branch.
  points: Vector[],

  // Leaves attached to nodes of the branch.
  leaves: Leaf[],

  // Buds attached to nodes of the branch.
  buds: Bud[],
}

/**
 * Describe the growth behavior of a branch (typically shared across branches
 * of the same depth in a given plant).
 */
export type GrowthModel = {
  // Maximum distance between two nodes
  maxInternodeLength: number,

  // Number of internodes before branching
  maxNodesPerAxis: number,
}

export type SimulationModel = {
  growthModels: GrowthModel[],

  branches: Branch[],
}
