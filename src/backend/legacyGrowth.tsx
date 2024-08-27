import {
  makeGrowthFrameFromPhytomer,
  makeGrowthFrameFromDirection,
  createPhytomersFromDirection,
  createPhytomersFromPositions,
  getPhytomerPosition,
  createLeafOrientation,
  type GrowthFrame,
} from './growth.tsx'

import {
  type Phytomer,
  type Bud,
  type Leaf,
  type LocalNodeRef,
} from '../models/SceneModel.tsx'

import {
  type GrowthModel,
} from '../models/GrowthModel.tsx'

import {
  type EvalContext,
} from './behaviorPipelines.tsx'

import { Vector } from '../utils/vector.tsx'
import { toVector, applyLerpDirection } from '../utils/vector3.tsx'
import { randomInt, randomFloat } from '../utils/random.tsx'

import { Vector3, Matrix4 } from 'three'

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
    direction: toVector(direction),
    age: 0,
  }
}

/**
 * Generate a new branch from a bud
 */
function createBranch(
  parent: Phytomer,
  bud: Bud
): Phytomer {
  const growthFrame = makeGrowthFrameFromDirection(
    getPhytomerPosition(parent),
    bud.direction,
  )
  const transform = new Matrix4();
  transform.copy(growthFrame.matrix)
  
  return {
    ...parent,
    transform,
    buds: [],
    leaves: [],
    children: [],
  }
}

/**
 * This returns a list of branches because a given branch may turn into
 * multiple ones.
 *
 * NB: Branches are supposed to have at least 2 points
 * 
 * @param nextBranchRef is the ref to the first new branch that this function
 * may create (by returning more than one branch). Other new branches are
 * contiguous.
 * This should eventually get dropped in favor of a more appropriate ref
 * manager that handles paralelism and all.
 */
export function growPhytomer(
  _context: EvalContext,
  _growthModel: GrowthModel,
  phytomer: Phytomer,
  _nextPhytomerIndex: number,
): Phytomer[] {
  return [ phytomer ];
  // TODO
  `
  // TODO: Memoize
  const newLastPoint = new Vector3();
  const prevPoint = new Vector3();
  const up = new Vector3(0, 1, 0);

  const isLastPhytomer = phytomer.children.length === 0;

  // Prepare lists for new elements
  // "next" stands for what will replace the previous value, "new" for what
  // will be appended.
  let newNode: { position: Vector, growthFrame: GrowthFrame } | null = null;
  let newBuds: Bud[] = [];
  let newLeaves: Leaf[] = [];
  let nextPoints: Vector[] = [];
  let nextActive = branch.active;
  const newBranches: Branch[] = [];
  const nextChildren = [...branch.children];

  if (branch.active) {

    //////////////////////////////////////
    // 1. Primary growth
    // The tip of the stem grows along its direction + some randomness

    const growthFrame = makeGrowthFrameFromPhytomer(branch.phytomers[branch.phytomers.length - 1]);
    // Random direction in growth frame:
    randomGrowthDirection(newLastPoint, growthModel);
    // Convert to world frame:
    newLastPoint.applyQuaternion(growthFrame.rotation);
    // Sun attraction (lerp in world space)
    applyLerpDirection(newLastPoint, up, growthModel.growthSunAttraction);
    // Offset
    newLastPoint.add(growthFrame.translation);

    const lastPoint = branchPoints[l - 1];

    // Add a new node if the growing phytomer (a.k.a., branch segment) reached
    // its target size.

    prevPoint.set(...branchPoints[l - 2]);
    const dist = newLastPoint.distanceTo(prevPoint);
    if (dist > growthModel.maxInternodeLength) {
      newNode = { position: lastPoint, growthFrame };
      // Append the new point to the list of branch points
      // NB: This 'nextPoints' array may be ignored if branching occurs and the
      // current branch stops growing (sympodial development)
      nextPoints = [ ...branchPoints, toVector(newLastPoint) ];
    } else {
      // Replace the last point
      nextPoints = [ ...branchPoints.slice(0, l - 1), toVector(newLastPoint) ];
    }

  }

  if (newNode !== null) {

    // Warning: This may be changed if nextActive turns to off
    let newNodeRef = nextPoints.length - 2;

    //////////////////////////////////////
    // 2. Branching
    // This may only occur when adding a new node
    // Start new branches from the new node

    if (nextPoints.length - 1 > growthModel.maxNodesPerAxis) {
      const branchingDirections = sampleBranchingDirections(growthModel);

      if (growthModel.development === "sympodial" && branchingDirections.length > 0) {
        // Stop the current branch
        nextActive = false;
        newNodeRef = branchPoints.length - 2;
      }

      for (const dir of branchingDirections) {
        newBuds.push(createBranchBud(newNodeRef, newNode.growthFrame, dir));
      }

      // TODO: Steer the primary branch away from the new branches when
      // development is monopodial
    }

    // Mark the new node with a bud and a leaf
    newBuds.push({
      anchor: newNodeRef,
      size: 0.1,
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
      differentiation: "dormant",
      age: 0,
    });
    newLeaves.push({
      anchor: newNodeRef,
      size: 0.2,
      orientation: createLeafOrientation({
        normal: [ 0.0, 1.0, 0.0 ],
        direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
      })
    });
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
      const newBranchRef = nextBranchRef + newBranches.length;
      newBranches.push(createBranch(branch, bud));
      nextChildren.push(newBranchRef);
    } else {
      nextBuds.push(bud);
    }
  }

  const nextPhytomers = nextActive ? createPhytomersFromPositions(nextPoints) : branch.phytomers;
  console.assert(nextPhytomers.length >= 2);

  return [
    {
      ...branch,
      active: nextActive,
      phytomers: nextPhytomers,
      buds: nextBuds,
      leaves: [...branch.leaves, ...newLeaves],
      children: nextChildren,
    },
    ...newBranches,
  ];
  `
}
