import { createReducerContext } from '../utils/createReducerContext.tsx'
import { Vector, addInPlace, add, copyVector } from '../utils/vector.tsx'
import { Matrix4, Vector3, Quaternion } from 'three'
import {
  Branch,
  Leaf,
  SimulationModel,
  GrowthModel,
  Bud,
  createDefaultGrowthModel,
  BranchRef,
  LocalNodeRef,
  Plant,
  createDefaultMeristemState,
} from '../models/SimulationModel.tsx'
import { Environment, createDefaultEnvironment } from '../models/EnvironmentModel.tsx'
import { randomInt, randomFloat } from '../utils/random.tsx'
import { toVector, applyLerpDirection } from '../utils/vector3.tsx'

const epsilon = 1e-8;
const epsilonSq = epsilon * epsilon;

export function createInitialScene(): SimulationModel {
  return {
    environment: createDefaultEnvironment(),
    growthModels: [
      createDefaultGrowthModel(),
      {
        ...createDefaultGrowthModel(),
        maxInternodeLength: 0.5,
        maxNodesPerAxis: 2,
      },
    ],

    plants: [
      {
        shoot: 0,
      },
      {
        shoot: 1,
      },
    ],

    branches: [
      {
        growthModelIndex: 0,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ 0.05, 0.1, -0.02 ],
          [ 0.03, 0.5, -0.03 ],
        ],
        leaves: [
          {
            anchor: 0,
            size: 0.3,
            normal: [ 0.3, 1.0, -0.1 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
          {
            anchor: 1,
            size: 0.2,
            normal: [ 0.0, 1.0, 1.0 ],
            direction: [ -1.0, 0.0, 0.0 ]
          },
        ],
        buds: [
          {
            anchor: 1,
            size: 0.3,
            direction: [ 0.3, 1.0, -0.1 ],
            differentiation: "dormant",
            age: 0,
          },
        ],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
      {
        growthModelIndex: 1,
        active: true,
        points: [
          [ 0, 0, 0 ],
          [ -0.02, 0.2, 0.05 ],
        ],
        leaves: [
          {
            anchor: 0,
            size: 0.4,
            normal: [ 0.0, 1.0, 0.0 ],
            direction: [ 1.0, 0.0, 1.0 ]
          },
        ],
        buds: [],
        children: [],
        meristemState: createDefaultMeristemState(),
      },
    ],
  }
}

function createTestScene(sceneIndex: number): SimulationModel {
  switch (sceneIndex) {
    case 0: {
      return {
        environment: createDefaultEnvironment(),
        growthModels: [
          createDefaultGrowthModel(),
        ],

        plants: [
          {
            shoot: 0,
          },
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
            children: [],
            meristemState: createDefaultMeristemState(),
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
 * Build the local frame at the tip of the branch, using the last and
 * second-to-last points of the provided list.
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
  nodeRef: LocalNodeRef,
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
    anchor: nodeRef,
    direction: toVector(direction),
    age: 0,
  }
}

/**
 * Generate a new branch from a bud
 */
function createBranch(
  parent: Branch,
  bud: Bud
): Branch {
  // TODO: Memoize
  const secondPoint = new Vector3();
  const direction = new Vector3();

  const firstPoint = parent.points[bud.anchor + 1];
  secondPoint.set(...firstPoint);
  direction.set(...bud.direction)
  direction.multiplyScalar(0.1); // TODO: unhardcode
  secondPoint.add(direction);

  return {
    ...parent,
    active: true,
    points: [
      [...firstPoint],
      toVector(secondPoint),
    ],
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
function growBranch(
  growthModel: GrowthModel,
  branch: Branch,
  nextBranchRef: BranchRef,
): Branch[] {
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
  const nextChildren = [...branch.children];

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
        newNodeRef = branch.points.length - 2;
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
      normal: [ 0.0, 1.0, 0.0 ],
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
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

  const newPoints = nextActive ? nextPoints : branch.points;
  console.assert(newPoints.length >= 2);

  return [
    {
      ...branch,
      active: nextActive,
      points: newPoints,
      buds: nextBuds,
      leaves: [...branch.leaves, ...newLeaves],
      children: nextChildren,
    },
    ...newBranches,
  ];
}

/**
 * Retrieve all the branches that belong to a given plant.
 */
export function getBranchesFromPlant(model: SimulationModel, plant: Plant): Branch[] {
  const plantBranches: Branch[] = [];
  const fifo: BranchRef[] = [ plant.shoot ];

  let next;
  while ((next = fifo.shift()) !== undefined) {
    const branchRef = next;
    console.assert(branchRef >= 0 && branchRef < model.branches.length);
    const branch = model.branches[branchRef];

    plantBranches.push(branch);

    for (const childRef of branch.children) {
      fifo.push(childRef);
    }
  }

  return plantBranches;
}

/**
 * Grow a little bit any node of a plant.
 * 
 * NB: For now, this returns a delta in world space. Ultimately, it should
 * return a new transform relative to the local frame, so that we can handle
 * torsion and rotation, e.g., to apply gravity.
 */
function growNode(growthModel: GrowthModel, branch: Branch, nodeIndex: number): Vector {
  // TODO: Memoize
  const prevNode = new Vector3();
  const node = new Vector3();
  const cellElongation = new Vector3();
  const merismaticGrowth = new Vector3();
  const total = new Vector3();

  // 1. Merismatic growth
  // Each meristem grows its stem by a fixed amount.

  const isLastNode = nodeIndex == branch.points.length - 2;
  if (branch.active && isLastNode) {
    console.log(`Node #${nodeIndex} is last.`)
    prevNode.set(...branch.points[nodeIndex]);
    node.set(...branch.points[nodeIndex + 1]);
    merismaticGrowth.subVectors(node, prevNode);
    if (merismaticGrowth.length() < 1e-4 && nodeIndex > 0) {
      prevNode.set(...branch.points[nodeIndex - 1]);
      node.set(...branch.points[nodeIndex + 1]);
      merismaticGrowth.subVectors(node, prevNode);
    }
    merismaticGrowth.normalize();
    merismaticGrowth.multiplyScalar(growthModel.merismaticGrowthLength);
  } else {
    merismaticGrowth.set(0, 0, 0);
  }

  // 2. Cell elongation.
  // Each phytomer gets scaled (i.e., it grows by an amount relative to its
  // current size). Scaling depends on the flexibility of the phytomer (for now
  // it is binary, namely 0 for inactive branches, constant for active
  // branches)

  prevNode.set(...branch.points[nodeIndex]);
  node.set(...branch.points[nodeIndex + 1]);
  cellElongation.subVectors(node, prevNode);
  cellElongation.multiplyScalar(growthModel.continuousGrowthRate);

  total.set(0, 0, 0);
  total.add(merismaticGrowth);
  total.add(cellElongation);
  console.log(`Node #${nodeIndex}: merismaticGrowth = ${toVector(merismaticGrowth)}, cellElongation = ${toVector(cellElongation)}.`)
  return toVector(total);
}

function growLeaf(growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf {
  const leaf = branch.leaves[leafIndex];
  return {
    ...leaf,
    size: leaf.size * (1.0 + growthModel.leafGrowthRate(leaf.size)),
  }
}

/**
 * Model of merismatic activity that generates new organs
 */
function growNewOrgans(
  growthModel: GrowthModel,
  branch: Branch,
  _nextBranchRef: BranchRef,
): Branch[] {

  const [ nextMeristemState, meristemActions ] = growthModel.meristemStateTransition(branch.meristemState);

  const nextBranch = {
    ...branch,
    meristemState: nextMeristemState,
    points: [...branch.points],
    leaves: [...branch.leaves],
    buds: [...branch.buds],
    // TODO: add other members that need to be deeply copied
  };

  const meristemAnchor = branch.points.length - 2;
  const meristemPosition = branch.points[branch.points.length - 1];

  const newBranches: Branch[] = [];

  const createLeaf = () => {
    nextBranch.leaves.push({
      anchor: meristemAnchor,
      size: 0.05,
      normal: [ 0.0, 1.0, 0.0 ],
      direction: [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ],
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.points.length - 2) {
      nextBranch.points.push(nextBranch.points[nextBranch.points.length - 1]);
    }
  }

  const createBranch = (direction: Vector) => {
    // TODO: Memoize
    const secondPoint = new Vector3();
    const unitDirection = new Vector3();

    secondPoint.set(...meristemPosition);
    unitDirection.set(...direction)
    unitDirection.normalize();
    unitDirection.multiplyScalar(0.1); // TODO: unhardcode
    secondPoint.add(unitDirection);

    newBranches.push({
      ...nextBranch,
      active: true,
      points: [
        [...meristemPosition],
        toVector(secondPoint),
      ],
      buds: [],
      leaves: [],
      children: [],
    });
  }

  for (const action of meristemActions) {
    switch (action.type) {
    case 'create-leaf':
      createLeaf();
      break;
    case 'create-stem':
      const up: Vector = [ 0.0, 1.0, 0.0 ];
      createBranch(up);
      break;
    }
  }

  return [ nextBranch, ...newBranches ];
}

/**
 * There are different kinds of simulation model updates
 */
type Behavior =
  // Organogenesis does not move any existing nodes, but it may create new
  // elements in branches or even new branches.
  | {
    type: 'organogenesis',
    handleBranch: (growthModel: GrowthModel, branch: Branch, nextBranchRef: BranchRef) => Branch[],
  }
  // Continuous growth only moves existing nodes. It can move internal nodes,
  // which has a recursive effect on all subsequent nodes. This returns for
  // each node a position update expressed in its local growth frame. A node is
  // identified by its branch + node index. The node position is the branch's
  // points of index nodeIndex + 1 because the first points (the anchor) does
  // not count as a node (it already does in the parent branch).
  // TODO: Express the first point differently, as a reference to the parent
  // branch node.
  | {
    type: 'growth',
    handleNode: (growthModel: GrowthModel, branch: Branch, nodeIndex: number) => Vector,
    handleLeaf: (growthModel: GrowthModel, branch: Branch, leafIndex: number) => Leaf,
  }

/**
 * For a given behavior type, the application of the behavior to the model is
 * always the same. This factorizes implementation common accross multiple
 * behaviors. For instance, growth and gravity are both behavior that do not
 * add elements but can transform all the nodes. On the other hand, some
 * behavior only add new elements.
 * Ideally this function is rarely modified and new phenomenon are added only
 * by creating new behaviors of existing types.
 */
function applyBehavior(
  state: SimulationModel,
  behavior: Behavior,
  /* options */ { repeat = 1 }: { repeat: number }
): SimulationModel {
  console.log("state", {...state});
  switch (behavior.type) {

    case "organogenesis": {
      const { handleBranch } = behavior;
      // Map the branch handler on all branches, reduces resulting lists together
      let nextBranches = state.branches;
      for (let i = 0 ; i < repeat ; ++i) {
        // Cannot use this nice functional approach because of the temporary
        // poor man's reference management
        /*
        nextBranches = concatAll(nextBranches.map(b => {
          const growthModel = state.growthModels[b.growthModelIndex];
          return handleBranch(growthModel, b);
        }));
        */
        const branches = nextBranches;
        const newBranches: Branch[] = []; // branches that we append at the end
        nextBranches = branches.map(b => {
          const growthModel = state.growthModels[b.growthModelIndex];
          const nextBranchRef = branches.length + newBranches.length;
          const bb = handleBranch(growthModel, b, nextBranchRef);
          // We do not handle removing branches yet
          console.assert(bb.length > 0);
          // Existing branches must not move in the array not to mess up with
          // indices, so the first element returned by handleBranch is pushed
          // now, the other ones (newly created branches) are kept for the end.
          newBranches.push(...bb.slice(1));
          return bb[0];
        })
        nextBranches.push(...newBranches);
      }
      return {
        ...state,
        branches: nextBranches,
      }; 
    }

    // TODO: Find a way to signal the Viewport that only positions moved, but
    // the structure remains the same. Modying state in place is not an option
    // because React uses double dipspatching in dev mode to ensure
    // idempotence of action handling.
    case "growth": {
      const { handleNode, handleLeaf } = behavior;

      let branches = state.branches;

      for (let i = 0 ; i < repeat ; ++i) {

        // Allocate memory to store growth vectors for each node
        const pointUpdates: Vector[][] = branches.map(b => b.points.map(_ => [ 0, 0, 0 ]));

        // Grow from origin to tip so that we accumulate transform
        for (const plant of state.plants) {
          // branches to be handled, sorted
          const fifo: { branchRef: BranchRef, accumulatedOffset: Vector }[] = [];

          fifo.push({
            branchRef: plant.shoot,
            accumulatedOffset: [ 0, 0, 0 ],
          });

          let next;
          while ((next = fifo.shift()) !== undefined) {
            const { branchRef, accumulatedOffset } = next;
            console.assert(branchRef >= 0 && branchRef < branches.length);
            const branch = branches[branchRef];
            const update = pointUpdates[branchRef];
            const growthModel = state.growthModels[branch.growthModelIndex];

            const newOffset: Vector = [ ...accumulatedOffset ];
            copyVector(update[0], newOffset);

            for (let nodeIndex = 0 ; nodeIndex < branch.points.length - 1 ; ++nodeIndex) {
              // Estimate node movement
              const deltaNodePosition = handleNode(growthModel, branch, nodeIndex);

              // Add to the accumulated offset that gets applied to this node
              // and all of its children.
              addInPlace(newOffset, deltaNodePosition);

              // Apply accumulated offset
              copyVector(update[nodeIndex + 1], newOffset);
            }

            // We grow leaves directly
            branch.leaves = branch.leaves.map((_, idx) => handleLeaf(growthModel, branch, idx));

            for (const childRef of branch.children) {
              fifo.push({
                branchRef: childRef,
                accumulatedOffset: [...newOffset],
              });
            }
          }
        }

        console.log("updates", pointUpdates);

        // Apply updates all at once
        const nextBranches = branches.map((branch, branchIndex) => {
          const update = pointUpdates[branchIndex];
          const growthModel = state.growthModels[branch.growthModelIndex];
          return {
            ...branch,
            points: branch.points.map((point, pointIndex) => add(point, update[pointIndex])),
            leaves: branch.leaves.map((_, leafIndex) => handleLeaf(growthModel, branch, leafIndex)),
          }
        });

        branches = nextBranches;
      }

      // Although we modify in place, create new objects to trigger re-render
      return {
        ...state,
        branches,
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
    type: 'growth',
    handleNode: growNode,
    handleLeaf: growLeaf,
  },

  organogenesis: {
    type: 'organogenesis',
    handleBranch: growNewOrgans,
  },
}

type SceneAction =
  | { type: 'step-simulation'; stepCount: number }
  | { type: 'step-growth'; stepCount: number }
  | { type: 'step-organogenesis'; stepCount: number }
  | { type: 'set-initial-scene' }
  | { type: 'set-test-scene', index: number }
  | { type: 'set-growth-model', index: number, model: GrowthModel }
  | { type: 'set-environment', environment: Environment }

export function sceneReducer(state: SimulationModel, action: SceneAction): SimulationModel {
  console.log("Scene action:", action);
  switch (action.type) {

    case 'step-simulation': {
      return applyBehavior(state, behaviors.legacy, { repeat: action.stepCount });
    }

    case 'step-growth': {
      return applyBehavior(state, behaviors.continuousGrowth, { repeat: action.stepCount });
    }

  case 'step-organogenesis': {
      return applyBehavior(state, behaviors.organogenesis, { repeat: action.stepCount });
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

    case 'set-environment': {
      return {
        ...state,
        environment: action.environment,
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
