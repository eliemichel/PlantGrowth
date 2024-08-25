import { type Vector } from '../utils/vector.tsx'
import { type KeysOfType } from '../utils/typescript.tsx'
import { assertOk } from '../utils/error.tsx'
import { type Expression, makeExpr } from './DSL.tsx'
import * as Hash from '../utils/hash.tsx'

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
 * A vector expressed as a frame + coordinates within that frame
 * 
 * The 'world' frame is the fixed global frame?
 * 
 * The 'growth' frame is the local frame of the phytomer. Z axis gives the
 * apical direction, Y axis is the epitonic direction (as upwards as possible),
 * X axis is the horizontal (amphitonic) direction such that XYZ is a valid
 * direct frame.
 */
export type RelativeVector = {
  frame: "growth" | "world",
  coords: Vector,
}

/**
 * When moving from one state to another one, a meristem may trigger
 * zero, one or more organogenesis actions.
 */
type MeristemAction =
  | { type: 'create-leaf', direction?: RelativeVector, normal?: RelativeVector }
  | { type: 'create-bud', direction?: RelativeVector }
  | { type: 'create-stem', meristemState: MeristemState, direction?: RelativeVector }

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

  // Speed at which a plant growths through cell elongation. This is a phytomer expression.
  continuousGrowthRate: Expression,

  // Speed at which a leaf growth, given the size of the leaf. This is a leaf expression
  leafGrowthRate: Expression,

  // Meristems have an internal state that drives them. This is the transition
  // function of their state machine. A state transition may emit an action.
  meristemStateTransition: (state: MeristemState) => [ MeristemState, MeristemAction[] ],

  ///////////////////////////////////////////////////
  // Advanced parameters

  // When there is only 1 child branch, it does not follow the same divergence.
  // We multiply the sampled divergence with this factor.
  singleBranchDivergenceFactor: number,
}

export function allExpressionKeysOfGrowthModel(): string[] {
  return ["continuousGrowthRate", "leafGrowthRate"]
}

/**
 * Type guard that lists all keys of type 'GrowthModel' that have type 'Expression'
 */
export function isExpressionKeyOfGrowthModel(key: string): key is KeysOfType<GrowthModel,Expression> {
  return allExpressionKeysOfGrowthModel().includes(key)
}


export function createDefaultGrowthModel(): GrowthModel {
  return createGrowthModelPreset(0);
}

export function createGrowthModelPreset(index: number): GrowthModel {
  switch(index) {
  case 0:
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
      merismaticGrowthLength: 0.01,
      continuousGrowthRate: assertOk(makeExpr(["if",
        ["<", ["get", "length"], 0.3],
        0.02,
        0.0,
      ])),
      leafGrowthRate: assertOk(makeExpr(["if",
        ["<", ["get", "size"], 0.2],
        0.05,
        0.0,
      ])),

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
          if (age % 8 == 0) {
            const side = (age / 8) % 2 == 0 ? 1 : -1;
            actions = [
              {
                type: 'create-leaf',
                direction: {
                  frame: 'growth',
                  coords: [ side, 1, 0 ],
                },
                normal: {
                  frame: 'growth',
                  coords: [ 0, 2, 1 ],
                },
              },
              {
                type: 'create-bud',
                direction: {
                  frame: 'growth',
                  coords: [ -side, 0, 0 ],
                },
              }
            ];
          }
          nextState = { type: 'apical', data: { age: age + 1 } };
          break;
        default:
          console.error("Invalid meristem state:", state);
          break;
        }
        console.log("meristemStateTransition", state, "->", nextState, actions)
        return [ nextState, actions ];
      },

      // Advanced parameters
      singleBranchDivergenceFactor: 0.05,
    }

  case 1:
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
      merismaticGrowthLength: 0.0,
      continuousGrowthRate: assertOk(makeExpr(["if",
        ["<",
          ["get", "length"],
          ["if",
            ["==",
              ["get", "meristem"],
              "apical-head"
            ],
            1.0,
            0.0
          ]
        ],
        0.02,
        0.0,
      ])),
      leafGrowthRate: assertOk(makeExpr(["if",
        ["<", ["get", "size"], 0.2],
        0.05,
        0.0,
      ])),

      meristemStateTransition: (state: MeristemState) => {
        type ApicalStateData = { age: number, emittedHead: boolean };


        let actions = createDefaultMeristemActions();
        let nextState = createDefaultMeristemState();
        switch (state.type) {
        case 'init':
          nextState = { type: 'apical-foot', data: { age: 0, emittedHead: false } };
          break;
        case 'apical-foot':
          const { age, emittedHead } = state.data as ApicalStateData;

          if (!emittedHead) {
            actions.push(
              {
                type: 'create-stem',
                direction: {
                  frame: 'growth',
                  coords: [ 0, 1, 0 ],
                },
                meristemState: { type: 'apical-head', data: {} },
              },
            );
          }

          if (age % 8 == 0) {
            const angle = Hash.float01("foo", age) * 2 * Math.PI;
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            const angle2 = Math.PI / 4.0 + (Hash.float01("bar", age) - 0.5) * Math.PI / 16.0;
            const x2 = Math.cos(angle2);
            const y2 = Math.sin(angle2);
            actions.push(
              {
                type: 'create-leaf',
                direction: {
                  frame: 'growth',
                  coords: [ x * y2, y * y2, x2 ],
                },
                normal: {
                  frame: 'growth',
                  coords: [ 0, 0, 1 ],
                },
              }
            );
          }

          nextState = { type: 'apical-foot', data: { age: age + 1, emittedHead: true } };
          break;
        case 'apical-head':
          nextState = { type: 'apical-head', data: state.data };
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

  default:
    return createDefaultGrowthModel();

  }
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
