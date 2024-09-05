import { type Vector } from '../utils/vector.ts'
import { type KeysOfType } from '../utils/typescript.ts'
import { assertOk } from '../utils/error.ts'
import * as Hash from '../utils/hash.ts'
import { hexToRgb } from '../utils/color.ts'
import { type Expression, makeExpr } from './DSL.ts'
import { type Parameter } from './ExpressionParameter.ts'

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
 * The type 'MeristemState' is very generic; each particular model restricts
 * the possible values to a subset that is a sum of 'MeristemStateType'.
 * For a given value of the 'type' field, the 'data' field is expected to
 * always comply with the same scheme (this affects the way memory gets
 * allocated).
 */
export type MeristemStateType = {
  // expected value of the 'type' field of MeristemState.
  name: string,

  // List of mandatory fields that are expected in the 'data' fields of
  // MeristemState, together with their expected type.
  dataFields: MeristemStateDataFieldType[],
}

export type MeristemStateDataFieldType = {
  name: string,
  type: "boolean" | "number",
}

export function createDefaultMeristemStateType(): MeristemStateType {
  return {
    name: '<new state type>',
    dataFields: [],
  }
}

export function createDefaultMeristemStateDataFieldType(): MeristemStateDataFieldType {
  return {
    name: '<new field>',
    type: 'number',
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

// Step used in GrowthModel['schedule']
export type ScheduleStep = {
  // Behavior to apply
  behavior: string,

  // How many times the behavior should be repeated
  repeat: number,

  // Whether the behavior is currently enabled or muted
  enabled: boolean,

  // UUID for book-keeping
  id: string,
}

export enum LeafType {
  Lanceolate,
  Needle,
}

/**
 * Describe the growth behavior of a branch (typically shared across branches
 * of the same depth in a given plant).
 */
export type GrowthModel = {
  parameters: Parameter[],

  // The schedule is the list of behaviors that define the plant's lifecycle
  // For a 'simulation' kind of growth model, it is typically an alternance of
  // organogenesis, growth and potentially external forces (e.g., gravity/wind).
  // For a 'procedural' kind of growth model, it can take arbitrary forms.
  // Individual steps can be muted (disabled) if needed in the UI
  schedule: ScheduleStep[],

  // Length of new stem added under a meristem at each growth step
  merismaticGrowthLength: Expression, // Context: meristem, Type: number

  // Speed at which a plant growths through cell elongation. This is a phytomer
  // expression.
  continuousGrowthRate: Expression, // Context: phytomer, Type: number

  // Speed at which a leaf growth, given the size of the leaf. This is a leaf
  // expression.
  leafGrowthRate: Expression, // Context: leaf, Type: number

  // List allowed types for the meristem state. There MUST NOT be two entries
  // with the same 'type' field.
  meristemStateTypes: MeristemStateType[],

  // Meristems have an internal state that drives them. This is the transition
  // function of their state machine. A state transition may emit an action,
  // making this in effect what computer science's literature calls a Finite
  // State Transducer (a.k.a. FST).
  meristemStateTransition: (state: MeristemState) => [ MeristemState, MeristemAction[] ],

  // This is temporary, just to play around, but of course the leaf color model
  // will more complex.
  stemColor: Vector,
  leafColor: Vector,
  leafType: LeafType,
}

export function allExpressionKeysOfGrowthModel(): string[] {
  return [
    "merismaticGrowthLength",
    "continuousGrowthRate",
    "leafGrowthRate",
  ]
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
      parameters: [
        {
          name: "maxInternodeLength",
          label: "Max Internode Length",
          description: "Maximum distance between two nodes",
          type: "float",
          value: 0.2,
          defaultValue: 0.2,
          minimum: 0.01,
          maximum: 1.0,
        },
        {
          name: "maxNodesPerAxis",
          label: "Max Nodes Per Axis",
          description: "Number of internodes before branching",
          type: "integer",
          value: 6,
          defaultValue: 6,
          minimum: 1,
          softMaximum: 20,
        },
        {
          name: "growthSpeed",
          label: "Growth Speed",
          description: "Increment of stem size at each step",
          type: "float",
          value: 0.05,
          defaultValue: 0.05,
          minimum: 0.0,
          maximum: 1.0,
        },
        {
          name: "growthDirectionRandomness",
          label: "Growth Direction Randomness",
          description: [
            "Randomness in the growth direction, from 0 (no randomness) to 2 (arbitrary",
            "direction). It is unlikely to need more than 1 (random in the hemisphere",
            "around the apical direction)",
          ].join(" "),
          type: "float",
          value: 0.1,
          defaultValue: 0.1,
          minimum: 0.0,
          maximum: 2.0,
        },
        {
          name: "growthSunAttraction",
          label: "Growth Sun Attraction",
          description: [
            "How much the branch gets attracted by the sun and thus steer towards",
            "vertical growth. 0 means no attraction, 1 means to always grow vertical.",
            "TODO: Make this stochastic?",
            "TODO: Make this a function of the ontological age, or even an expression",
          ].join(" "),
          type: "float",
          value: 0.1,
          defaultValue: 0.1,
          minimum: 0.0,
          maximum: 1.0,
        },
        {
          name: "branchingArrangment",
          label: "Branching Arrangment",
          description: [
            "Growth development mode:",
            " - Monopodial sees the main stem grow forever (indeterminate growth)",
            " - Sympodial stops the main stem upon branching (determinate growth)",
          ].join(" "),
          type: "enum",
          value: 0,
          defaultValue: 0,
          options: [
            { label: "amphitonic", value: 0 },
            { label: "epitonic", value: 1 },
            { label: "hypotonic", value: 2 },
          ]
        },
        {
          name: "development",
          label: "Development",
          description: [
            "Tells the direction in which new branches grow:",
            " - Epitonic goes as upwards as possible",
            " - Amphitonic goes as horizontal as possible",
            " - Hypotonic goes as downwards as possible",
          ].join(" "),
          type: "enum",
          value: 0,
          defaultValue: 0,
          options: [
            { label: "sympodial", value: 0 },
            { label: "monopodial", value: 1 },
          ]
        },
        {
          name: "minBranchCount",
          label: "Minimum Branch Count",
          description: [
            "Number of branches that grow at a given node",
            "TODO: Replace with a Distribution object",
          ].join(" "),
          type: "integer",
          value: 1,
          defaultValue: 1,
          minimum: 0,
          maximum: 10,
          softMaximum: 5,
        },
        {
          name: "maxBranchCount",
          label: "Maximum Branch Count",
          description: [
            "Number of branches that grow at a given node",
            "TODO: Replace with a Distribution object",
          ].join(" "),
          type: "integer",
          value: 2,
          defaultValue: 2,
          minimum: 0,
          maximum: 10,
          softMaximum: 5,
        },
        {
          name: "minDivergence",
          label: "Minimum Branch Divergence",
          description: [
            "Range in which we sample divergence when branching.",
            "These are angles in radians between 0 and Pi.",
          ].join(" "),
          type: "float",
          subtype: "angle",
          value: Math.PI / 4,
          defaultValue: Math.PI / 4,
          minimum: 0,
          maximum: Math.PI,
        },
        {
          name: "maxDivergence",
          label: "Maximum Branch Divergence",
          description: [
            "Range in which we sample divergence when branching.",
            "These are angles in radians between 0 and Pi.",
          ].join(" "),
          type: "float",
          subtype: "angle",
          value: Math.PI / 2,
          defaultValue: Math.PI / 2,
          minimum: 0,
          maximum: Math.PI,
        },
        {
          name: "budDelay",
          label: "Bud Delay",
          description: [
            "Time (in simulation steps) before which a bud transforms into its",
            "differentiation.",
            "TODO: Replace with a Distribution object",
          ].join(" "),
          type: "integer",
          value: 10,
          defaultValue: 10,
          minimum: 0,
          softMaximum: 20,
        },
        {
          name: "singleBranchDivergenceFactor",
          label: "Single Branch Divergence Factor",
          description: [
            "When there is only 1 child branch, it does not follow the same divergence.",
            "We multiply the sampled divergence with this factor.",
          ].join(" "),
          hidden: true,
          type: "float",
          value: 0.05,
          defaultValue: 0.05,
          minimum: 0.0,
          softMaximum: 1.0,
        },

        {
          name: "test",
          label: "Test",
          description: "A test of string parameter",
          type: "string",
          value: "lorem ipsum",
          defaultValue: "lorem ipsum",
        },
      ],

      schedule: [
        { behavior: "legacy", repeat: 1, enabled: true, id: crypto.randomUUID() },
      ],

      merismaticGrowthLength: assertOk(makeExpr([0.0])),
      continuousGrowthRate: assertOk(makeExpr([0.0])),
      leafGrowthRate: assertOk(makeExpr([0.0])),

      meristemStateTypes: [],
      meristemStateTransition: (state: MeristemState) => [ state, [] ],

      stemColor: hexToRgb('#553300'),
      leafColor: hexToRgb('#88ff00'),
      leafType: LeafType.Lanceolate,
    }

  case 1:
    return {
      ...createDefaultGrowthModel(),
      parameters: [],

      schedule: [
        { behavior: "organogenesis", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "growth", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "gravity", repeat: 1, enabled: false, id: crypto.randomUUID() },
      ],

      merismaticGrowthLength: assertOk(makeExpr([0.01])),
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

      meristemStateTypes: [
        {
          name: 'init',
          dataFields: [],
        },
        {
          name: 'apical',
          dataFields: [
            { name: 'age', type: 'number' },
          ],
        }
      ],

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
        return [ nextState, actions ];
      },

      stemColor: hexToRgb('#685c68'),
      leafColor: hexToRgb('#a349a4'),
      leafType: LeafType.Lanceolate,
    }

  case 2:
    return {
      ...createDefaultGrowthModel(),
      parameters: [],

      schedule: [
        { behavior: "organogenesis", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "growth", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "gravity", repeat: 1, enabled: false, id: crypto.randomUUID() },
      ],

      merismaticGrowthLength: assertOk(makeExpr(["if",
        ["==",
          ["get", "meristem"],
          "apical-head"
        ],
        0.01,
        0.0
      ])),
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

      meristemStateTypes: [
        {
          name: 'init',
          dataFields: [],
        },
        {
          name: 'apical-foot',
          dataFields: [
            { name: 'age', type: 'number' },
            { name: 'emittedHead', type: 'boolean' },
          ],
        },
        {
          name: 'apical-head',
          dataFields: [],
        }
      ],

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
                  coords: [ 0, 0, 1 ],
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

      stemColor: hexToRgb('#49a3a4'),
      leafColor: hexToRgb('#49a3a4'),
      leafType: LeafType.Lanceolate,
    }

  case 3:
    return {
      ...createDefaultGrowthModel(),
      parameters: [],

      schedule: [
        { behavior: "organogenesis", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "growth", repeat: 1, enabled: true, id: crypto.randomUUID() },
        { behavior: "gravity", repeat: 1, enabled: false, id: crypto.randomUUID() },
      ],

      merismaticGrowthLength: assertOk(makeExpr(["if",
        ["==",
          ["get", "meristem"],
          "apical-summer"
        ],
        0.01,
        0.0
      ])),
      continuousGrowthRate: assertOk(makeExpr(["if",
        ["<",
          ["get", "length"],
          ["if",
            ["==",
              ["get", "meristem"],
              "apical-summer"
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

      meristemStateTypes: [
        {
          name: 'init',
          dataFields: [],
        },
        {
          name: 'apical-summer',
          dataFields: [
            { name: 'age', type: 'number' },
          ],
        },
        {
          name: 'apical-winter',
          dataFields: [],
        },
        {
          name: 'auxiliary-dormant-summer',
          dataFields: [
            { name: 'age', type: 'number' },
            { name: 'seed', type: 'number' },
          ],
        },
        {
          name: 'auxiliary-dormant-winter',
          dataFields: [
            { name: 'age', type: 'number' },
            { name: 'seed', type: 'number' },
          ],
        },
        {
          name: 'auxiliary-summer',
          dataFields: [
            { name: 'age', type: 'number' },
          ],
        },
        {
          name: 'auxiliary-winter',
          dataFields: [
            { name: 'age', type: 'number' },
          ],
        },
      ],

      meristemStateTransition: (state: MeristemState) => {
        type ApicalStateData = { age: number };
        type AuxiliaryStateData = { age: number, seed: number };


        let actions = createDefaultMeristemActions();
        let nextState = createDefaultMeristemState();
        switch (state.type) {

        case 'init':
          nextState = { type: 'apical-summer', data: { age: 0 } };
          break;

        case 'apical-summer': {
          const { age } = state.data as ApicalStateData;

          if (age % 8 == 7) {
            const angle = Hash.float01("angle", age) * 2 * Math.PI;
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            const angle2 = Math.PI / 4.0 + (Hash.float01("angle2", age) - 0.5) * Math.PI / 16.0;
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
              },
              {
                type: 'create-bud',
                direction: {
                  frame: 'growth',
                  coords: [ x * y2, y * y2, x2 ],
                },
              },
              {
                type: 'create-stem',
                direction: {
                  frame: 'growth',
                  coords: [ x * y2, y * y2, x2 ],
                },
                meristemState: { type: 'auxiliary-dormant-summer', data: { age: age + 1, seed: age } },
              },
            );
          }

          if (age <= 80) {
            nextState = { type: 'apical-summer', data: { age: age + 1 } };
          } else {
            nextState = { type: 'apical-winter', data: { age: age + 1 } };
          }
          break;
        }

        case 'apical-winter':
          for (let i = 0 ; i < 10 ; ++i) {
            const angle = 2 * Math.PI * i / 10;
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            const angle2 = Math.PI / 4.0 + (Hash.float01("angle2", i) - 0.5) * Math.PI / 16.0;
            const x2 = Math.cos(angle2);
            const y2 = Math.sin(angle2);
            actions.push({
              type: 'create-leaf',
              direction: {
                frame: 'growth',
                coords: [ x * y2, y * y2, x2 ],
              },
              normal: {
                frame: 'growth',
                coords: [ 0, 0, 1 ],
              },
            });
          }
          nextState = { type: 'apical-summer', data: { age: 0 } };
          break;

        case 'auxiliary-dormant-summer': {
          const { age } = state.data as AuxiliaryStateData;
          if (age <= 80) {
            nextState = { type: 'auxiliary-dormant-summer', data: { ...state.data, age: age + 1 } };
          } else {
            nextState = { type: 'auxiliary-dormant-winter', data: { ...state.data, age: age + 1 } };
          }
          break;
        }

        case 'auxiliary-dormant-winter': {
          const { seed } = state.data as AuxiliaryStateData;
          const isBranch = Hash.float01("isBranch", seed) < 0.2;
          if (isBranch) {
            nextState = { type: 'apical-summer', data: { age: 0 } };
          } else {
            nextState = { type: 'auxiliary-summer', data: { age: 0 } };
          }
          break;
        }

        case 'auxiliary-summer': {
          const { age } = state.data as AuxiliaryStateData;

          if (age % 8 == 0) {
            const angle = Hash.float01("angle", age) * 2 * Math.PI;
            const x = Math.cos(angle);
            const y = Math.sin(angle);
            const angle2 = Math.PI / 4.0 + (Hash.float01("angle2", age) - 0.5) * Math.PI / 16.0;
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
              },
            );
          }

          if (age <= 80) {
            nextState = { type: 'auxiliary-summer', data: { age: age + 1 } };
          } else {
            nextState = { type: 'auxiliary-winter', data: { age: age + 1 } };
          }
          break;
        }

        case 'auxiliary-winter': {
          nextState = state;
          break;
        }

        default:
          console.error("Invalid meristem state:", state);
          break;
        }
        return [ nextState, actions ];
      },

      stemColor: hexToRgb('#552200'),
      leafColor: hexToRgb('#437429'),
      leafType: LeafType.Needle,
    }

  default:
    return createDefaultGrowthModel();

  }
}
