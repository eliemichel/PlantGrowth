import { Vector3, Matrix4 } from 'three'

import {
  makeGrowthFrameFromPhytomer,
  makeGrowthFrameFromDirection,
  getPhytomerPosition,
  createLeafOrientation,
  type GrowthFrame,
} from './growth.ts'

import {
  type Phytomer,
  type Bud,
} from '../models/SceneModel.ts'

import {
  type GrowthModel,
} from '../models/GrowthModel.ts'

import {
  type EvalContext,
  type OrganogenesisMeristemHandlerOutput,
} from './behaviorPipelines.ts'

import { toVector, applyLerpDirection } from '../utils/vector3.ts'
import { randomInt, randomFloat } from '../utils/random.ts'
import { Collection } from '../utils/Collection.ts'
import { type ResultOrError, Ok, Err, isErr } from '../utils/error.ts'
import { isKeyOfObject } from '../utils/typescript.ts'

export type LegacyGrowthModel = {
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

  ///////////////////////////////////////////////////
  // Advanced parameters

  // When there is only 1 child branch, it does not follow the same divergence.
  // We multiply the sampled divergence with this factor.
  singleBranchDivergenceFactor: number,
}

/**
 * Extract parameters that this model's logic expects from public parameters.
 * This checks types.
 */
function getParameters(growthModel: GrowthModel): ResultOrError<LegacyGrowthModel,string> {
  const legacyGrowthModel: LegacyGrowthModel = {
    maxInternodeLength: 0.0,
    maxNodesPerAxis: 0.0,
    growthSpeed: 0.0,
    growthDirectionRandomness: 0.0,
    growthSunAttraction: 0.0,
    development: "monopodial",
    branchingArrangment: "epitonic",
    minBranchCount: 0.0,
    maxBranchCount: 0.0,
    minDivergence: 0.0,
    maxDivergence: 0.0,
    budDelay: 0.0,
    singleBranchDivergenceFactor: 0.0,
  }

  const remainingFields = new Set<string>(Object.keys(legacyGrowthModel));

  for (const param of growthModel.parameters) {
    const { name, value, type } = param;
    if (isKeyOfObject(name, legacyGrowthModel)) {
      if (type === "enum" && typeof legacyGrowthModel[name] === "string") {
        let found = false;
        for (const opt of param.options) {
          if (value === opt.value) {
            // @ts-ignore
            legacyGrowthModel[name] = opt.label;
            remainingFields.delete(name);
            found = true;
            break;
          }
        }
        if (!found) {
          return Err(`Parameter '${name}' has value '${value}' that is not a possible option.`);
        }
      } else if (typeof value === typeof legacyGrowthModel[name]) {
        // @ts-ignore
        legacyGrowthModel[name] = value;
        remainingFields.delete(name);
      } else {
        return Err(`Parameter '${name}' has type '${type}' but type '${typeof legacyGrowthModel[name]}' was expected.`);
      }
    }
  }

  const missing = remainingFields.values().next().value;
  if (missing !== undefined) {
    return Err(`Missing parameter: '${missing}'`);
  } else {
    return Ok(legacyGrowthModel);
  }
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
 * Draw a random growth direction, expressed in local growth frame.
 */
function randomGrowthDirection(out: Vector3, growthModel: LegacyGrowthModel) {
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
function sampleBranchingDirections(growthModel: LegacyGrowthModel): BranchingDirection[] {
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

  // TODO: Find a way to avoid type checking in each invocation of growPhytomer
  const maybeParameters = getParameters(growthModel);
  if (isErr(maybeParameters)) {
    console.error(maybeParameters.error);
    return { phytomer, newPhytomers: null }
  }
  const parameters = maybeParameters.result;

  const meristem = phytomer.meristem;

  // Hack: We hide custom attributes in meristem state
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
        differentiation: (
          meristem !== null
          ? { type: meristem.state.type, data: { ...meristem.state.data } }
          : { type: "", data: {} }
        ),
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
    randomGrowthDirection(newLastPoint, parameters);
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

    if (dist > parameters.maxInternodeLength) {
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

      if (nodeCountSinceLastBranch > parameters.maxNodesPerAxis) {
        const branchingDirections = sampleBranchingDirections(parameters);

        if (parameters.development === "sympodial" && branchingDirections.length > 0) {
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
    if (bud.differentiation === "shoot" && bud.age >= parameters.budDelay) {

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
        differentiation: { type: bud.differentiation, data: {} },
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
