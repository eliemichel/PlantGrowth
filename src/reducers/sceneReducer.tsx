import { createReducerContext } from '../utils/createReducerContext.tsx'
import { concatAll } from '../utils/basics.tsx'
import { Vector } from '../utils/vector.tsx'
import { Matrix4, Vector3 } from 'three'
import { Branch, Leaf, SimulationModel, GrowthModel, Bud, createDefaultGrowthModel } from '../models/SimulationModel.tsx'

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

// Auxiliary functions for growBranch

const epsilon = 1e-8;
const epsilonSq = epsilon * epsilon;

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
function makeGrowthFrame(branchPoints: Vector[]): Matrix4 {
  // TODO: Memoize
  const up = new Vector3(0, 1, 0);
  const amphitonic = new Vector3();
  const epitonic = new Vector3();
  const apical = new Vector3();
  const tip = new Vector3();
  const prev = new Vector3();
  const out = new Matrix4();

  // Apical direction goes along the branch
  const points = branchPoints;
  if (points.length > 1) {
    tip.set(...points[points.length - 1]);
    prev.set(...points[points.length - 2]);
    apical.subVectors(tip, prev);
    if (apical.lengthSq() < epsilonSq) {
      console.log('PROBLEM', points);
    }
    apical.normalize();
  } else {
    apical.copy(up);
    tip.set(0, 0, 0);
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

  console.log({ amphitonic, epitonic, apical });
  out.makeBasis(amphitonic, epitonic, apical);
  out.setPosition(tip);
  return out;
}

function toVector(pt: Vector3): Vector {
  return [ pt.x, pt.y, pt.z ];
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
  // TODO: Memoize
  const X = new Vector3(1, 0, 0);
  const Z = new Vector3(0, 0, 1);

  out.set(0, 0, 1);
  out.applyAxisAngle(X, Math.PI * Math.random() * growthModel.growthDirectionRandomness * 0.5);
  out.applyAxisAngle(Z, 2.0 * Math.PI * Math.random());
  out.multiplyScalar(growthModel.growthSpeed);
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
  } = growthModel;

  const branchCount = randomInt(minBranchCount, maxBranchCount);
  const startSide = randomInt(0, 1);
  
  const directions: BranchingDirection[] = [];
  for (let i = 0 ; i < branchCount ; ++i) {
    let abscissa = 0.0;
    if (development == "sympodial") {
      abscissa = (startSide + i) * Math.PI;
    } else {
      abscissa = Math.random() * 2.0 * Math.PI;
    }

    directions.push({
      abscissa,
      divergence: randomFloat(minDivergence, maxDivergence),
    });
  }
  return directions;
}

/**
 * Create a new branch in a random direction
 */
function createBranch(
  prototype: Branch,
  growthFrame: Matrix4,
  direction: BranchingDirection
): Branch {
  // TODO: Memoize
  const firstPoint = new Vector3();
  const secondPoint = new Vector3();
  const Y = new Vector3(0, 1, 0);
  const Z = new Vector3(0, 0, 1);

  // In growth frame:
  secondPoint.set(0, 0, 1);
  secondPoint.applyAxisAngle(Y, direction.divergence);
  secondPoint.applyAxisAngle(Z, direction.abscissa);
  secondPoint.normalize();
  secondPoint.multiplyScalar(0.1);
  // Convert to world frame:
  secondPoint.applyMatrix4(growthFrame);

  firstPoint.set(0, 0, 0);
  firstPoint.applyMatrix4(growthFrame);

  return {
    ...prototype,
    active: true,
    points: [
      toVector(firstPoint),
      toVector(secondPoint),
    ],
  }
}

/**
 * This returns a list of branches because a given branch may turn into
 * multiple ones.
 *
 * NB: Branches are supposed to have at least 2 points
 */
function growBranch(model: SimulationModel, branch: Branch): Branch[] {
  // TODO: Memoize
  const newLastPoint = new Vector3();
  const prevPoint = new Vector3();

  const growthModel = model.growthModels[branch.growthModelIndex];
  
  if (!branch.active) return [ branch ];

  const l = branch.points.length;
  if (l < 2) {
    throw Error("Branches are supposed to have at least 2 points.")
  }

  // Prepare lists for new elements
  let newNode: { position: Vector } | null = null;
  let newBuds: Bud[] = [];
  let newLeaves: Leaf[] = [];
  let newPoints: Vector[] = [];
  let newActive = true;
  const newBranches: Branch[] = [];

  //////////////////////////////////////
  // 1. Primary growth
  // The tip of the stem grows along its direction + some randomness

  const growthFrame = makeGrowthFrame(branch.points);
  // Random direction in growth frame:
  randomGrowthDirection(newLastPoint, growthModel);
  // Convert to world frame:
  newLastPoint.applyMatrix4(growthFrame);

  const lastPoint = branch.points[l - 1];

  // Add a new node if the growing phytomer (a.k.a., branch segment) reached
  // its target size.
  
  prevPoint.set(...branch.points[l - 2]);
  const dist = newLastPoint.distanceTo(prevPoint);
  if (dist > growthModel.maxInternodeLength) {
    newNode = { position: lastPoint };
    // Append the new point to the list of branch points
    // NB: This 'newPoints' array may be ignored if branching occurs and the
    // current branch stops growing (sympodial development)
    newPoints = [ ...branch.points, toVector(newLastPoint) ];
  } else {
    // Replace the last point
    newPoints = [ ...branch.points.slice(0, l - 1), toVector(newLastPoint) ];
  }

  if (newNode !== null) {

    // Mark the new node with a bud
    newBuds.push({
      anchor: newNode.position,
      size: 0.05,
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
    });

    //////////////////////////////////////
    // 2. Branching
    // This may only occur when adding a new node
    // Start new branches from the new node

    if (newPoints.length - 1 > growthModel.maxNodesPerAxis) {
      const branchingDirections = sampleBranchingDirections(growthModel);
      for (const dir of branchingDirections) {
        newBranches.push(createBranch(branch, growthFrame, dir));
      }

      if (growthModel.development === "sympodial" && branchingDirections.length > 0) {
        // Stop the current branch
        newActive = false;
      }

      newLeaves.push({
        anchor: newNode.position,
        size: 0.05,
        normal: [ 0.0, 1.0, 0.0 ],
        direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
      });
    }
  }

  return [
    {
      ...branch,
      active: newActive,
      points: newActive ? newPoints : branch.points,
      buds: [...branch.buds, ...newBuds],
      leaves: [...branch.leaves, ...newLeaves],
    },
    ...newBranches,
  ];
}

type SceneAction =
  | { type: 'step-simulation'; stepCount: number }
  | { type: 'test-leaf' }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'test-branch' }
  | { type: 'set-growth-model', index: number, model: GrowthModel }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-simulation': {
      let newBranches = state.branches;
      for (let i = 0 ; i < action.stepCount ; ++i) {
        newBranches = concatAll(newBranches.map(b => growBranch(state, b)));
      }
      return {
        ...state,
        branches: newBranches,
      };
    }

    case 'set-initial-scene': {
      return createInitialScene();
    }

    case 'set-test-scene': {
      return createTestScene(action.index);
    }

    case 'test-leaf': {
      const moveLeaf: ((leaf: Leaf) => Leaf) = leaf => ({
        ...leaf,
        anchor: [ leaf.anchor[0], leaf.anchor[1] + 0.05, leaf.anchor[2] ],
      })
      const moveFirstLeaf: ((branch: Branch) => Branch) = branch => ({
        ...branch,
        leaves: branch.leaves.map((l, idx) => idx == 0 ? moveLeaf(l) : l),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstLeaf(b) : b),
      }
    }

    case 'test-branch': {
      const movePoint: ((pt: Vector) => Vector) = pt => [
        pt[0], pt[1], pt[2] + 0.05
      ]
      const moveFirstPoint: ((branch: Branch) => Branch) = branch => ({
        ...branch,
        points: branch.points.map((pt, idx) => idx == 0 ? movePoint(pt) : pt),
      })
      return {
        ...state,
        branches: state.branches.map((b, idx) => idx == 0 ? moveFirstPoint(b) : b),
      }
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
