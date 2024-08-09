import { Vector } from '../utils/vector.tsx'
import { Environment } from './EnvironmentModel.tsx'

/**
 * Meristems are cell division areas, which are responsible for the genesis and
 * (merismatic) growth of all organs. A meristem has a memory, which we model
 * through a state machine.
 */
export type MeristemState = {
  // Main state name, always initialized at 'init' then values depend on the species
  type: string,

  // Additional scalar payload that parameterize the state type
  data: { [key: string]: boolean | number },
}

export function createDefaultMeristemState(): MeristemState {
  return {
    type: 'init',
    data: {},
  }
}

/**
 * When moving from one state to another one, a meristem may trigger
 * zero, one or more organogenesis actions.
 */
type MeristemAction =
  | { type: 'create-leaf' }
  | { type: 'create-stem' }

export function createDefaultMeristemActions(): MeristemAction[] {
  return []
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

  // Time (in simulation steps) before which a bud transforms into its
  // differentiation.
  // TODO: Replace with a Distribution object
  budDelay: number,

  // Length of new stem added under a meristem at each growth step
  merismaticGrowthLength: number,

  // Speed at which a plant growths.
  continuousGrowthRate: number,

  // Speed at which a leaf growth
  leafGrowthRate: number,

  // Meristems have an internal state that drives them. This is the transition
  // function of their state machine. A state transition may emit an action.
  meristemStateTransition: (state: MeristemState) => [ MeristemState, MeristemAction[] ],

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
    budDelay: 10,
    merismaticGrowthLength: 0.1,
    continuousGrowthRate: 0.02,
    leafGrowthRate: 0.05,

    meristemStateTransition: (state: MeristemState) => {
      type ApicalStateData = { age: number };

      let actions = createDefaultMeristemActions();
      let nextState = createDefaultMeristemState();
      switch (state.type) {
      case 'init':
        nextState = { type: 'apical', data: { age: 0 } };
        break;
      case 'apical':
        const { age } = state.data as ApicalStateData;
        if (age % 3 == 0) actions = [{ type: 'create-leaf' }];
        nextState = { type: 'apical', data: { age: age + 1 } };
        break;
      default:
        console.error("Invalid meristem state:", state);
        break;
      }
      return [ nextState, actions ];
    },

    // Advanced parameters
    singleBranchDivergenceFactor: 0.05,
  }
}

// Reference to a node that belong to the same branch
export type LocalNodeRef = number;

export type Leaf = {
  // Node at which the leaf is attached, which necessarily belong to the same
  // branch than the one storing this leaf.
  anchor: LocalNodeRef,

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

  // Positions of the nodes that constitute the branch.
  points: Vector[],

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
  // root: BranchRef,
}

export type SimulationModel = {
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
