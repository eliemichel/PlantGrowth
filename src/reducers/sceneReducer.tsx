import { createReducerContext } from '../utils/createReducerContext.tsx'
import { concatAll } from '../utils/basics.tsx'
import { Vector } from '../utils/vector.tsx'
import { Matrix4, Vector3, Quaternion } from 'three'
import { Branch, Leaf, SimulationModel, GrowthModel, Bud, createDefaultGrowthModel } from '../models/SimulationModel.tsx'

const epsilon = 1e-8;
const epsilonSq = epsilon * epsilon;

export function createInitialScene(): SimulationModel {
  return {
    growthModels: [
      createDefaultGrowthModel(),
      {
        ...createDefaultGrowthModel(),
        maxInternodeLength: 0.5,
        maxNodesPerAxis: 2,
      },
    ],

    branches: [
      {
        growthModelIndex: 0,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ -0.02, 0.2, 0.05 ],
        ],
        leaves: [
          {
            anchor: [ 0.0, 0.5, 0.0 ],
            size: 0.3,
            normal: [ 0.3, 1.0, -0.1 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
          {
            anchor: [ 0.5, 0.2, 0.2 ],
            size: 0.2,
            normal: [ 0.0, 1.0, 1.0 ],
            direction: [ -1.0, 0.0, 0.0 ]
          },
        ],
        buds: [
          {
            anchor: [ 0.0, 0.5, 0.0 ],
            size: 0.3,
            direction: [ 0.3, 1.0, -0.1 ],
            differentiation: "dormant",
            age: 0,
          },
        ],
      },
      {
        growthModelIndex: 1,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ 0.05, 0.1, -0.02 ],
          [ 0.03, 0.5, -0.03 ],
        ],
        leaves: [
          {
            anchor: [ 0.0, 0.2, 0.0 ],
            size: 0.4,
            normal: [ 0.0, 1.0, 0.0 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
        ],
        buds: [],
      },
    ],
  }
}

function createTestScene(sceneIndex: number): SimulationModel {
  switch (sceneIndex) {
    case 0: {
      return {
        growthModels: [
          createDefaultGrowthModel(),
        ],

        branches: [
          {
            growthModelIndex: 0,
            active: true,
            points: [
              [ 0, 0, 0 ],
              [ 0, 0.1, 0 ],
            ],
            leaves: [],
            buds: [],
          },
        ],
      }
    }
    default: {
      return createInitialScene();
    }
  }
};

// Auxiliary types and functions for growBranch

/**
 * A growth frame could be summarized as a single matrix, but for simpler use
 * we store it in redundant forms.
 */
type GrowthFrame = {
  matrix: Matrix4,
  rotation: Quaternion,
  translation: Vector3,
}

/**
 * A branching direction is given locally to a growth frame as an abscissa
 * along the section of a branch and an angle wrt to the main direction.
 */
type BranchingDirection = {
  // From 0 to 2 Pi, a position along the section of the branch, where the
  // origin/end point is the one in the amphitonic direction pointed to by the
  // X axis of the growth frame, turning in the trigonometric way around the
  // apical direction (Z axis), which means it goes up (towards the epitonic
  // Y direction) at the beginning.
  // It can be seen as a precession angle around the main growth direction
  abscissa: number,

  // From 0 to Pi, the angle between the main growth direction and the
  // branching.
  divergence: number,
}

/**
 * Build the local frame at the tip of the branch.
 * 
 * X: Amphitonic direction (orthogonal to the branch and
 *    horizontal, the one such that XYZ is a direct frame).
 * 
 * Y: Epitonic direction (orthogonal to the branch, as close to up as
 *    possible).
 * 
 * Z: Apical growth direction.
 * 
 * Warning: This function uses memoization to save up memory, do not use its
 * first return value after calling makeGrowthFrame a second time.
 */
const makeGrowthFrame: ((branchPoints: Vector[]) => GrowthFrame) = (() => {
  // Memoized variables
  const up = new Vector3(0, 1, 0);
  const amphitonic = new Vector3();
  const epitonic = new Vector3();
  const apical = new Vector3();
  const prev = new Vector3();
  const out: GrowthFrame = {
    matrix: new Matrix4(),
    rotation: new Quaternion(),
    translation: new Vector3(),
  };

  return branchPoints => {
    // Apical direction goes along the branch
    const points = branchPoints;
    if (points.length > 1) {
      out.translation.set(...points[points.length - 1]);
      prev.set(...points[points.length - 2]);
      apical.subVectors(out.translation, prev);
      if (apical.lengthSq() < epsilonSq) {
        console.log('PROBLEM', points);
      }
      apical.normalize();
    } else {
      apical.copy(up);
      out.translation.set(0, 0, 0);
    }

    // Amphitonic direction is horizontal
    amphitonic.crossVectors(up, apical);
    if (amphitonic.lengthSq() < epsilonSq) {
      amphitonic.set(1,0,0); // TODO: hash tip position to get some randomness
    } else {
      amphitonic.normalize();
    }

    // Epitonic direction goes upward so we may need to flip
    epitonic.crossVectors(apical, amphitonic);
    epitonic.normalize();
    if (epitonic.dot(up) < 0.0) {
      epitonic.multiplyScalar(-1);
      amphitonic.multiplyScalar(-1);
    }

    out.matrix.makeBasis(amphitonic, epitonic, apical);
    out.matrix.setPosition(out.translation);
    out.rotation.setFromRotationMatrix(out.matrix);
    return out;
  }
})();

function toVector(pt: Vector3): Vector {
  return [ pt.x, pt.y, pt.z ];
}

/**
 * This modifies a in place. The length of a remains unchanged, and its
 * direction is interpolated, with it being the original direction of a if
 * factor is 0 and the direction of b if factor is 1.
 * NB: b is assumed to be a unit vector.
 */
function applyLerpDirection(a: Vector3, b: Vector3, factor: number) {
  // TODO: Memoize
  const q = new Quaternion();
  q.identity();
  const identity = new Quaternion();
  const ua = new Vector3();

  ua.copy(a);
  ua.normalize();

  q.setFromUnitVectors(ua, b);
  q.slerp(identity, 1.0 - factor);
  a.applyQuaternion(q);
}

/**
 * Sample an integer number between a and b, bounds included.
 */
function randomInt(min: number, max: number): number {
  if (max < min) {
    throw Error(`Minimum (${min}) must not be higher than maximum (${max})`);
  }
  return min + Math.floor(Math.random() * (max - min + 1));
}

/**
 * Sample a float number between a (inclusive) and b (exclusive).
 */
function randomFloat(min: number, max: number): number {
  if (max < min) {
    throw Error(`Minimum (${min}) must not be higher than maximum (${max})`);
  }
  return min + Math.random() * (max - min);
}

/**
 * Draw a random growth direction, expressed in local growth frame.
 */
function randomGrowthDirection(out: Vector3, growthModel: GrowthModel) {
  const {
    growthDirectionRandomness,
    growthSpeed,
  } = growthModel;

  // TODO: Memoize
  const X = new Vector3(1, 0, 0);
  const Z = new Vector3(0, 0, 1);

  out.set(0, 0, 1);
  out.applyAxisAngle(X, Math.PI * Math.random() * growthDirectionRandomness * 0.5);
  out.applyAxisAngle(Z, 2.0 * Math.PI * Math.random());

  out.multiplyScalar(growthSpeed);
}

/**
 * Sample branching directions for a branching node, complying with a given
 * growth model.
 */
function sampleBranchingDirections(growthModel: GrowthModel): BranchingDirection[] {
  const {
    development,
    minBranchCount,
    maxBranchCount,
    minDivergence,
    maxDivergence,
    branchingArrangment,
    singleBranchDivergenceFactor,
  } = growthModel;

  const branchCount = randomInt(minBranchCount, maxBranchCount);
  const startSide = randomInt(0, 1);
  
  const directions: BranchingDirection[] = [];
  for (let i = 0 ; i < branchCount ; ++i) {

    let abscissa = 0.0;
    switch (branchingArrangment) {
      case "amphitonic": {
        abscissa = (startSide + i) * Math.PI;
        break;
      }
      // TODO: epitonic and hypotonic
      default: {
        abscissa = Math.random() * 2.0 * Math.PI;
        break;
      }
    }

    let divergence = randomFloat(minDivergence, maxDivergence);
    if (branchCount == 1 && development == "sympodial") {
      // When there is a single branch after branching, it is a special case
      // where the child branch takes over its parent.
      divergence *= singleBranchDivergenceFactor;
    }

    directions.push({
      abscissa,
      divergence,
    });
  }
  return directions;
}

/**
 * Create a new bud that will turn into a branch equivalent to calling
 * createBranch()
 */
function createBranchBud(
  growthFrame: GrowthFrame,
  branchingDirection: BranchingDirection
): Bud {
  // TODO: Memoize
  const direction = new Vector3();
  const Y = new Vector3(0, 1, 0);
  const Z = new Vector3(0, 0, 1);

  // In growth frame:
  direction.set(0, 0, 1);
  direction.applyAxisAngle(Y, branchingDirection.divergence);
  direction.applyAxisAngle(Z, branchingDirection.abscissa);
  // Convert to world frame:
  direction.applyQuaternion(growthFrame.rotation);

  return {
    differentiation: "shoot",
    size: 0.3,
    anchor: toVector(growthFrame.translation),
    direction: toVector(direction),
    age: 0,
  }
}

/**
 * Generate a new branch from a bud
 */
function createBranch(
  prototype: Branch,
  bud: Bud
): Branch {
  // TODO: Memoize
  const secondPoint = new Vector3();
  const direction = new Vector3();

  secondPoint.set(...bud.anchor);
  direction.set(...bud.direction)
  direction.multiplyScalar(0.1); // TODO: unhardcode
  secondPoint.add(direction);

  return {
    ...prototype,
    active: true,
    points: [
      [...bud.anchor],
      toVector(secondPoint),
    ],
    buds: [],
    leaves: [],
  }
}

/**
 * This returns a list of branches because a given branch may turn into
 * multiple ones.
 *
 * NB: Branches are supposed to have at least 2 points
 */
function growBranch(growthModel: GrowthModel, branch: Branch): Branch[] {
  // TODO: Memoize
  const newLastPoint = new Vector3();
  const prevPoint = new Vector3();
  const up = new Vector3(0, 1, 0);

  const l = branch.points.length;
  if (l < 2) {
    throw Error("Branches are supposed to have at least 2 points.")
  }
  
  // Prepare lists for new elements
  // "next" stands for what will replace the previous value, "new" for what
  // will be appended.
  let newNode: { position: Vector, growthFrame: GrowthFrame } | null = null;
  let newBuds: Bud[] = [];
  let newLeaves: Leaf[] = [];
  let nextPoints: Vector[] = [];
  let nextActive = branch.active;
  const newBranches: Branch[] = [];

  if (branch.active) {

    //////////////////////////////////////
    // 1. Primary growth
    // The tip of the stem grows along its direction + some randomness

    const growthFrame = makeGrowthFrame(branch.points);
    // Random direction in growth frame:
    randomGrowthDirection(newLastPoint, growthModel);
    // Convert to world frame:
    newLastPoint.applyQuaternion(growthFrame.rotation);
    // Sun attraction (lerp in world space)
    applyLerpDirection(newLastPoint, up, growthModel.growthSunAttraction);
    // Offset
    newLastPoint.add(growthFrame.translation);

    const lastPoint = branch.points[l - 1];

    // Add a new node if the growing phytomer (a.k.a., branch segment) reached
    // its target size.
    
    prevPoint.set(...branch.points[l - 2]);
    const dist = newLastPoint.distanceTo(prevPoint);
    if (dist > growthModel.maxInternodeLength) {
      newNode = { position: lastPoint, growthFrame };
      // Append the new point to the list of branch points
      // NB: This 'nextPoints' array may be ignored if branching occurs and the
      // current branch stops growing (sympodial development)
      nextPoints = [ ...branch.points, toVector(newLastPoint) ];
    } else {
      // Replace the last point
      nextPoints = [ ...branch.points.slice(0, l - 1), toVector(newLastPoint) ];
    }

  }

  if (newNode !== null) {

    // Mark the new node with a bud and a leaf
    newBuds.push({
      anchor: newNode.position,
      size: 0.1,
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
      differentiation: "dormant",
      age: 0,
    });
    newLeaves.push({
      anchor: newNode.position,
      size: 0.2,
      normal: [ 0.0, 1.0, 0.0 ],
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
    });

    //////////////////////////////////////
    // 2. Branching
    // This may only occur when adding a new node
    // Start new branches from the new node

    if (nextPoints.length - 1 > growthModel.maxNodesPerAxis) {
      const branchingDirections = sampleBranchingDirections(growthModel);
      for (const dir of branchingDirections) {
        newBuds.push(createBranchBud(newNode.growthFrame, dir));
      }

      if (growthModel.development === "sympodial" && branchingDirections.length > 0) {
        // Stop the current branch
        nextActive = false;
      }

      // TODO: Steer the primary branch away from the new branches when
      // development is monopodial
    }
  }

  //////////////////////////////////////
  // 3. Bud ageing
  // Increment bud age, leading to new shoot/leaves
  // TODO: Find a way not to rebuild render buffers if only age changes (switch
  // to struct of arrays?)

  const agedBuds = branch.buds.map(b => ({ ...b, age: b.age + 1 }));
  let allBuds = [...agedBuds, ...newBuds];

  let nextBuds = [];
  for (const bud of allBuds) {
    if (bud.differentiation === "shoot" && bud.age >= growthModel.budDelay) {
      newBranches.push(createBranch(branch, bud));
    } else {
      nextBuds.push(bud);
    }
  }

  const newPoints = nextActive ? nextPoints : branch.points;
  console.assert(newPoints.length >= 2);

  return [
    {
      ...branch,
      active: nextActive,
      points: newPoints,
      buds: nextBuds,
      leaves: [...branch.leaves, ...newLeaves],
    },
    ...newBranches,
  ];
}

function growNode(growthModel: GrowthModel, branch: Branch, nodeIndex: number): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const diff = new Vector3();

  prevNode.set(...branch.points[nodeIndex]);
  node.set(...branch.points[nodeIndex + 1]);
  diff.subVectors(node, prevNode);
  diff.multiplyScalar(1.0 + growthModel.continuousGrowthRate);
  node.addVectors(prevNode, diff);
  return toVector(node);
}

/**
 * There are different kinds of simulation model updates
 */
type Behavior =
  // Organogenesis does not move any existing nodes, but it may create new
  // elements in branches or even new branches.
  | { type: 'organogenesis', handleBranch: (growthModel: GrowthModel, branch: Branch) => Branch[] }
  // Continuous growth only moves existing nodes. It can move internal nodes,
  // which has a recursive effect on all subsequent nodes. This returns for
  // each node a position update expressed in its local growth frame. A node is
  // identified by its branch + node index. The node position is the branch's
  // points of index nodeIndex + 1 because the first points (the anchor) does
  // not count as a node (it already does in the parent branch).
  // TODO: Express the first point differently, as a reference to the parent
  // branch node.
  | { type: 'continuous-growth', handleNode: (growthModel: GrowthModel, branch: Branch, nodeIndex: number) => Vector }

function applyBehavior(
  state: SimulationModel,
  behavior: Behavior,
  /* options */ { repeat = 1 }: { repeat: number }
): SimulationModel {
  switch (behavior.type) {

    case "organogenesis": {
      const { handleBranch } = behavior;
      // Map the branch handler on all branches, reduces resulting lists together
      let newBranches = state.branches;
      for (let i = 0 ; i < repeat ; ++i) {
        newBranches = concatAll(newBranches.map(b => {
          const growthModel = state.growthModels[b.growthModelIndex];
          return handleBranch(growthModel, b);
        }));
      }
      return {
        ...state,
        branches: newBranches,
      }; 
    }

    case "continuous-growth": {
      const { handleNode } = behavior;
      let newBranches = state.branches;
      for (let i = 0 ; i < repeat ; ++i) {
        newBranches = newBranches.map(branch => {
          const growthModel = state.growthModels[branch.growthModelIndex];
          // TODO: actual behavior
          return {
            ...branch,
            points: branch.points.map(
              (pt, idx) => idx === 0 ? pt : handleNode(growthModel, branch, idx - 1)
            ),
          };
        });
      }
      return {
        ...state,
        branches: newBranches,
      }
    }

    default: {
      throw Error("Unhandled behavior type: " + JSON.stringify(behavior));
    }

  }
}

const behaviors: { [key: string]: Behavior } = {
  legacy: {
    type: 'organogenesis',
    handleBranch: growBranch,
  },

  continuousGrowth: {
    type: 'continuous-growth',
    handleNode: growNode,
  }
}

type SceneAction =
  | { type: 'step-simulation'; stepCount: number }
  | { type: 'step-continuous-growth'; stepCount: number }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'set-growth-model', index: number, model: GrowthModel }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-simulation': {
      return applyBehavior(state, behaviors.legacy, { repeat: action.stepCount });
    }

  case 'step-continuous-growth': {
      return applyBehavior(state, behaviors.continuousGrowth, { repeat: action.stepCount });
    }

    case 'set-initial-scene': {
      return createInitialScene();
    }

    case 'set-test-scene': {
      return createTestScene(action.index);
    }

    case 'set-growth-model': {
      return {
        ...state,
        growthModels: state.growthModels.map((model, idx) => idx == action.index ? action.model : model),
      }
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
