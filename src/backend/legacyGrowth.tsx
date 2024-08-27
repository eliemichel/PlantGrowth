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
  type OrganogenesisMeristemHandlerOutput,
} from './behaviorPipelines.tsx'

import { Vector } from '../utils/vector.tsx'
import { toVector, applyLerpDirection } from '../utils/vector3.tsx'
import { randomInt, randomFloat } from '../utils/random.tsx'
import { Collection } from '../utils/Collection.tsx'

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
  growthModel: GrowthModel,
  phytomer: Phytomer,
  _phytomerIndex: number,
  parentTransform: Matrix4 | null,
): OrganogenesisMeristemHandlerOutput {
  // TODO: Memoize
  const newLastPoint = new Vector3();
  const prevPoint = new Vector3();
  const direction = new Vector3();
  const up = new Vector3(0, 1, 0);

  if (parentTransform === null) {
    return { phytomer, newPhytomers: null }
  }

  const meristem = phytomer.meristem;

  // Hack: We hide custom attributes in meristem state
  type LegacyState = { nodeCountSinceLastBranch: number }
  const legacyState = {
    nodeCountSinceLastBranch: (meristem?.state.data.legacy_nodeCountSinceLastBranch ?? 0) as number,
  }

  const nextMeristem = meristem === null ? null : {
    ...meristem,
    state: {
      ...meristem.state,
      data: {
        ...meristem.state.data,
        legacy_nodeCountSinceLastBranch: legacyState.nodeCountSinceLastBranch,
      }
    }
  };

  const out: OrganogenesisMeristemHandlerOutput = {
    phytomer: {
      ...phytomer,
      children: [...phytomer.children],
      meristem: nextMeristem,
    },
    newPhytomers: null
  };

  let newBuds: Bud[] = [];

  // Add a new phytomer to the output and reference it in the main phytomer's children
  const tipRef = { value: out.phytomer };
  const createPhytomer = (newPhytomer: Phytomer): Phytomer => {
    if (out.newPhytomers === null) out.newPhytomers = new Collection<Phytomer>();
    out.newPhytomers.append(newPhytomer);
    tipRef.value.children.push(out.newPhytomers.createRef(-1));
    return newPhytomer;
  }

  // When adding at least one of a leaf, bud or stem, we build a new phytomer to follow up on growing
  const followUpStemRef: { value: Phytomer | null } = { value: null };
  const ensureFollowUpStem = () => {
    if (followUpStemRef.value === null) {
      followUpStemRef.value = createPhytomer({
        ...phytomer,
        buds: [],
        leaves: [],
        children: [],
        differentiation: meristem !== null ? meristem.state.type : "",
        meristem: out.phytomer.meristem,
      });
      if (out.phytomer.meristem !== null) {
        const { data } = out.phytomer.meristem.state;
        data.legacy_nodeCountSinceLastBranch = (data.legacy_nodeCountSinceLastBranch as number) + 1;
      }
      out.phytomer.meristem = null; // moved to new follow up
      tipRef.value = followUpStemRef.value;
    }
  }

  if (meristem !== null) {

    //////////////////////////////////////
    // 1. Primary growth
    // The tip of the stem grows along its direction + some randomness

    const growthFrame = makeGrowthFrameFromPhytomer(phytomer);
    // Random direction in growth frame:
    randomGrowthDirection(newLastPoint, growthModel);
    // Convert to world frame:
    newLastPoint.applyQuaternion(growthFrame.rotation);
    // Sun attraction (lerp in world space)
    applyLerpDirection(newLastPoint, up, 0.1);
    // Offset
    newLastPoint.add(growthFrame.translation);

    // Add a new node if the growing phytomer (a.k.a., branch segment) reached
    // its target size.
    prevPoint.set(...getPhytomerPosition({ transform: parentTransform }));
    const dist = newLastPoint.distanceTo(prevPoint);

    if (dist > growthModel.maxInternodeLength) {
      const nextTransform = new Matrix4();
      prevPoint.set(...getPhytomerPosition(phytomer));
      direction.subVectors(newLastPoint, prevPoint);
      nextTransform.copy(makeGrowthFrameFromDirection(
        toVector(prevPoint),
        toVector(direction),
      ).matrix);
      nextTransform.setPosition(newLastPoint);

      ensureFollowUpStem();
      (followUpStemRef.value as Phytomer).transform = nextTransform;
    } else {
      // Replace the last point
      const nextTransform = new Matrix4();
      if (dist > 0.0001) {
        direction.subVectors(newLastPoint, prevPoint);
        nextTransform.copy(makeGrowthFrameFromDirection(
          toVector(prevPoint),
          toVector(direction),
        ).matrix);
      } else {
        nextTransform.copy(phytomer.transform);
      }
      nextTransform.setPosition(newLastPoint);

      out.phytomer.transform = nextTransform;
    }

    if (followUpStemRef.value !== null) {
      //////////////////////////////////////
      // 2. Branching
      // This may only occur when adding a new node
      // Start new branches from the new node

      const { nodeCountSinceLastBranch } = legacyState;

      if (nodeCountSinceLastBranch > growthModel.maxNodesPerAxis) {
        const branchingDirections = sampleBranchingDirections(growthModel);

        if (growthModel.development === "sympodial" && branchingDirections.length > 0) {
          // Stop the current branch
          tipRef.value.meristem = null;
        }

        newBuds.push(
          ...branchingDirections.map(dir => createBranchBud(growthFrame, dir)),
        );
      }

      // Mark the new node with a bud and a leaf
      newBuds.push({
        size: 0.1,
        direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
        differentiation: "dormant",
        age: 0,
      });
      out.phytomer.leaves = [
        ...out.phytomer.leaves,
        {
          size: 0.2,
          orientation: createLeafOrientation({
            normal: [ 0.0, 1.0, 0.0 ],
            direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
          })
        }
      ];
    }
  }

  //////////////////////////////////////
  // 3. Bud ageing
  // Increment bud age, leading to new shoot/leaves
  // TODO: Find a way not to rebuild render buffers if only age changes (switch
  // to struct of arrays?)

  const agedBuds = phytomer.buds.map(b => ({ ...b, age: b.age + 1 }));
  let allBuds = [...agedBuds, ...newBuds];

  let nextBuds = [];
  for (const bud of allBuds) {
    if (bud.differentiation === "shoot" && bud.age >= growthModel.budDelay) {

      const growthFrame = makeGrowthFrameFromDirection(
        getPhytomerPosition(phytomer),
        bud.direction,
      )
      const transform = new Matrix4();
      transform.copy(growthFrame.matrix)

      createPhytomer({
        ...phytomer,
        transform,
        buds: [],
        leaves: [],
        children: [],
        differentiation: bud.differentiation,
        meristem: {
          state: {
            type: "legacy",
            data: {
              legacy_nodeCountSinceLastBranch: 0,
            }
          }
        }
      });

    } else {
      nextBuds.push(bud);
    }
  }
  out.phytomer.buds = nextBuds;

  return out;
}
