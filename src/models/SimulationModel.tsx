import { Vector } from '../utils/vector.tsx'

/**
 * Describe the growth behavior of a branch (typically shared across branches
 * of the same depth in a given plant).
 */
export type GrowthModel = {
  // Maximum distance between two nodes
  maxInternodeLength: number,

  // Number of internodes before branching
  maxNodesPerAxis: number,

  // Increment of stem size at each step
  growthSpeed: number,

  // Randomness in the growth direction, from 0 (no randomness) to 2 (arbitrary
  // direction). It is unlikely to need more than 1 (random in the hemisphere
  // around the apical direction)
  growthDirectionRandomness: number,

  // How much the branch gets attracted by the sun and thus steer towards
  // vertical growth. 0 means no attraction, 1 means to always grow vertical.
  // TODO: Make this stochastic?
  // TODO: Make this a function of the ontological age
  growthSunAttraction: number,

  // Growth development mode:
  //  - Monopodial sees the main stem grow forever (indeterminate growth)
  //  - Sympodial stops the main stem upon branching (determinate growth)
  development: "monopodial" | "sympodial",

  // Tells the direction in which new branches grow:
  //  - Epitonic goes as upwards as possible
  //  - Amphitonic goes as horizontal as possible
  //  - Hypotonic goes as downwards as possible
  branchingArrangment: "epitonic" | "amphitonic" | "hypotonic",

  // Number of branches that grow at a given node
  // TODO: Replace with a Distribution object
  minBranchCount: number,
  maxBranchCount: number,

  // Range in which we sample divergence when branching.
  // These are angles in radians between 0 and Pi.
  minDivergence: number,
  maxDivergence: number,

  ///////////////////////////////////////////////////
  // Advanced parameters

  // When there is only 1 child branch, it does not follow the same divergence.
  // We multiply the sampled divergence with this factor.
  singleBranchDivergenceFactor: number,
}

export function createDefaultGrowthModel(): GrowthModel {
  return {
    maxInternodeLength: 0.2,
    maxNodesPerAxis: 6,
    growthSpeed: 0.05,
    growthDirectionRandomness: 0.1,
    growthSunAttraction: 0.1,
    branchingArrangment: "amphitonic",
    development: "sympodial",
    minBranchCount: 1,
    maxBranchCount: 2,
    minDivergence: Math.PI / 4,
    maxDivergence: Math.PI / 2,

    // Advanced parameters
    singleBranchDivergenceFactor: 0.05,
  }
}

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

export type SimulationModel = {
  growthModels: GrowthModel[],

  branches: Branch[],
}

// Validation utils


export function validateDevelopment(raw: string): GrowthModel["development"] {
  switch (raw) {
  case "monopodial":
  case "sympodial":
    return raw;
  default:
    throw Error('Invalid development: ' + raw);
  }
}

export function validateBranchingArrangment(raw: string): GrowthModel["branchingArrangment"] {
  switch (raw) {
  case "epitonic":
  case "amphitonic":
  case "hypotonic":
    return raw;
  default:
    throw Error('Invalid branching arrangment: ' + raw);
  }
}
