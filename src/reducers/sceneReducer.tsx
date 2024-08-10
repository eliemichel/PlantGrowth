import { createReducerContext } from '../utils/createReducerContext.tsx'
import { Vector, addInPlace, add, copyVector } from '../utils/vector.tsx'
import { Vector3 } from 'three'
import {
  type Branch,
  type Leaf,
  type SimulationModel,
  type GrowthModel,
  type BranchRef,
  type RelativeVector,
  createDefaultGrowthModel,
  createDefaultMeristemState,
} from '../models/SimulationModel.tsx'
import { Environment, createDefaultEnvironment } from '../models/EnvironmentModel.tsx'
import { toVector } from '../utils/vector3.tsx'
import {
  evalExpr,
  makeContext,
} from '../models/DSL.tsx'
import { growBranch } from './legacyGrowth.tsx'
import { makeGrowthFrame } from './growth.tsx'

export function createInitialScene(): SimulationModel {
  return {
    environment: createDefaultEnvironment(),
    leafColor: '#88ff00',
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
        leafColor: '#a349a4',
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
  
  const ctx = makeContext("phytomer", {
    length: cellElongation.length(),
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
    return [0,0,0];
  }
  const rate = maybeRate.result;

  cellElongation.multiplyScalar(rate);

  total.set(0, 0, 0);
  total.add(merismaticGrowth);
  total.add(cellElongation);
  return toVector(total);
}

function growLeaf(growthModel: GrowthModel, branch: Branch, leafIndex: number): Leaf {
  const leaf = branch.leaves[leafIndex];

  const ctx = makeContext("leaf", {
    size: leaf.size,
  });

  const maybeRate = evalExpr(growthModel.leafGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
    return {...leaf};
  }
  const rate = maybeRate.result;

  return {
    ...leaf,
    size: leaf.size * (1.0 + rate),
  }
}

/**
 * Given a relative direction and a branch, resolve into a world direction.
 */
function relativeToWorldDirection(relativeDirection: RelativeVector, branchPoints: Vector[]): Vector {
  // TODO: Memoize
  const directionInGrowthFrame = new Vector3();

  switch (relativeDirection.frame) {
  case 'growth':
    const growthFrame = makeGrowthFrame(branchPoints);
    directionInGrowthFrame.set(...relativeDirection.coords);
    directionInGrowthFrame.applyQuaternion(growthFrame.rotation);
    directionInGrowthFrame.normalize();
    return toVector(directionInGrowthFrame);
  case 'world':
    return relativeDirection.coords;
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

  const createLeaf = (relativeDirection: RelativeVector | undefined, relativeNormal: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branch.points);

    const normal: Vector =
      relativeNormal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeNormal, branch.points);

    nextBranch.leaves.push({
      anchor: meristemAnchor,
      size: 0.05,
      normal,
      direction,
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.points.length - 2) {
      nextBranch.points.push(nextBranch.points[nextBranch.points.length - 1]);
    }
  }

  const createBud = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branch.points);

    nextBranch.buds.push({
      anchor: meristemAnchor,
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
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
      createLeaf(action.direction, action.normal);
      break;
    case 'create-bud':
      createBud(action.direction);
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
