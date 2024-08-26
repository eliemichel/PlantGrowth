/*
 * Simulation model updates can have various behaviors, whose backbone is a
 * fixed pipeline while some programmable handlers (a.k.a. kernels) can be
 * provided.
 * This enables us to factorize large portions of the logic, and will
 * eventually be used for parallelization.
 *
 * NB: The term "pipeline" refers to the type of behavior, while "behavior"
 * is a particular instance of it. The term "behavior" used to designate what's
 * now "pipeline", so there should be some wrong naming left to be fixed.
 */

import {
  type SceneModel,
  type Branch,
  type BranchRef,
  type Leaf,
} from '../models/SceneModel.tsx'

import {
  type GrowthModel,
} from '../models/GrowthModel.tsx'

import {
  recomputeMeristemDirection,
} from './growth.tsx'

import {
  type EvalError,
} from '../models/DSL.tsx'

import { Vector, addInPlace, copyVector } from '../utils/vector.tsx'
import { Matrix4, Quaternion } from 'three'

/* ********** Behavior declarations ********** */

// When adding a new behavior pipeline, make sure to:
//  - Add a new Behavior type, with a unique 'type' value
//  - Add this new Behavior type to the 'Behavior' union
//  - Add a new applyFooBehavior handler
//  - Add a case for this handler in the top-level applyBehavior function

// Context in which the behavior is executed, providing some info and event
// callbacks.
export type EvalContext = {
  // Called whenever there is an evaluation error while applying a behavior
  onEvalError: (error: EvalError) => void,
}

export enum BehaviorFlag {
  None = 0,

  // Call handlers even if the branch is inactive
  BypassActive = 1 << 0,
}

// Properties common to all behavior types
type CommonBehaviorAttributes = {
  name: string,
  flags: BehaviorFlag,
}

/**
 * Organogenesis does not move any existing nodes, but it may create new
 * elements in branches or even new branches.
 */
export type OrganogenesisBehavior = CommonBehaviorAttributes & {
  type: 'organogenesis',
  handleBranch: (context: EvalContext, growthModel: GrowthModel, branch: Branch, nextBranchRef: BranchRef) => Branch[],
}

/**
 * Continuous growth only moves existing nodes. It can move internal nodes,
 * which has a recursive effect on all subsequent nodes. This returns for
 * each node a position update expressed in its local growth frame. A node is
 * identified by its branch + node index. The node position is the branch's
 * points of index nodeIndex + 1 because the first points (the anchor) does
 * not count as a node (it already does in the parent branch).
 * TODO: Express the first point differently, as a reference to the parent
 * branch node.
 */
export type GrowthBehavior = CommonBehaviorAttributes & {
  type: 'growth',
  handleNode: (context: EvalContext, growthModel: GrowthModel, branch: Branch, nodeIndex: number) => Vector,
  handleLeaf: (context: EvalContext, growthModel: GrowthModel, branch: Branch, leafIndex: number) => Leaf,
}

/**
 * A behavior that is similar to GrowthBehavior but also enables rotations
 */
export type Growth2Behavior = CommonBehaviorAttributes & {
  type: 'growth2',
  handleNode: (context: EvalContext, growthModel: GrowthModel, branch: Branch, nodeIndex: number) => Matrix4,
  // TODO: handleLeaves
}

/**
 * There are different kinds of simulation model updates
 */
export type Behavior =
  | OrganogenesisBehavior
  | GrowthBehavior
  | Growth2Behavior

/* ********** Behavior implementations ********** */

export type ApplyBehaviorOptions = {
  repeat: number,
  branchFilter?: (branch: Branch) => boolean,
}

export function applyOrganogenesisBehavior(
  scene: SceneModel,
  context: EvalContext,
  behavior: OrganogenesisBehavior,
  options: ApplyBehaviorOptions,
): SceneModel {
  const { handleBranch } = behavior;
  // Map the branch handler on all branches, reduces resulting lists together
  let nextBranches = scene.branches;
  for (let i = 0 ; i < options.repeat ; ++i) {
    // Cannot use this nice functional approach because of the temporary
    // poor man's reference management
    /*
    nextBranches = concatAll(nextBranches.map(b => {
      const growthModel = scene.growthModels[b.growthModelIndex];
      return handleBranch(context, growthModel, b);
    }));
    */
    const branches = nextBranches;
    const newBranches: Branch[] = []; // branches that we append at the end
    nextBranches = branches.map(b => {
      const skipBranch = ((behavior.flags & BehaviorFlag.BypassActive) === 0 && !b.active) || options.branchFilter?.(b) === false;

      if (skipBranch) {
        return b;
      }

      const growthModel = scene.growthModels.items[b.growthModelIndex];
      const nextBranchRef = branches.length + newBranches.length;
      const bb = handleBranch(context, growthModel, b, nextBranchRef);
      // We do not handle removing branches yet
      console.assert(bb.length > 0);
      // Existing branches must not move in the array not to mess up with
      // indices, so the first element returned by handleBranch is pushed
      // now, the other ones (newly created branches) are kept for the end.
      newBranches.push(...bb.slice(1));
      return bb[0];
    })
    nextBranches.push(...newBranches);
    nextBranches = recomputeMeristemDirection(nextBranches);
  }
  return {
    ...scene,
    branches: nextBranches,
  };
}

/**
 * TODO: Find a way to signal the Viewport that only positions moved, but
 * the structure remains the same. Modying scene in place is not an option
 * because React uses double dipspatching in dev mode to ensure
 * idempotence of action handling.
 * edit: see applyGrowth2Behavior for a WIP version of that
 */
export function applyGrowthBehavior(
  scene: SceneModel,
  context: EvalContext,
  behavior: GrowthBehavior,
  options: ApplyBehaviorOptions,
): SceneModel {
  // TODO: Memoize
  const translation = new Matrix4();

  const { handleNode, handleLeaf } = behavior;

  let branches = scene.branches;

  for (let i = 0 ; i < options.repeat ; ++i) {

    // Allocate memory to store growth vectors for each node
    const pointUpdates: Vector[][] = branches.map(b => b.phytomers.map(_ => [ 0, 0, 0 ]));

    // Grow from origin to tip so that we accumulate transform
    for (const plant of scene.plants.items) {
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
        const skipBranch = ((behavior.flags & BehaviorFlag.BypassActive) === 0 && !branch.active) || options.branchFilter?.(branch) === false;

        const newOffset: Vector = [ ...accumulatedOffset ];
        if (!skipBranch) {
          const update = pointUpdates[branchRef];
          const growthModel = scene.growthModels.items[branch.growthModelIndex];

          copyVector(update[0], newOffset);
          for (let nodeIndex = 0 ; nodeIndex < branch.phytomers.length - 1 ; ++nodeIndex) {
            // Estimate node movement
            const deltaNodePosition = handleNode(context, growthModel, branch, nodeIndex);

            // Add to the accumulated offset that gets applied to this node
            // and all of its children.
            addInPlace(newOffset, deltaNodePosition);

            // Apply accumulated offset
            copyVector(update[nodeIndex + 1], newOffset);
          }
        }

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
      const growthModel = scene.growthModels.items[branch.growthModelIndex];
      return {
        ...branch,
        phytomers: branch.phytomers.map((ph, phIndex) => {
          const nextTransform = new Matrix4();
          translation.makeTranslation(...update[phIndex]);
          nextTransform.multiplyMatrices(translation, ph.transform);
          return { transform: nextTransform }
        }),
        leaves: branch.leaves.map((_, leafIndex) => handleLeaf(context, growthModel, branch, leafIndex)),
      }
    });

    branches = recomputeMeristemDirection(nextBranches);
  }

  // Although we modify in place, create new objects to trigger re-render
  return {
    ...scene,
    branches,
  }
}

/**
 * This is a new version of the growth behavior, meant to support rotations
 * NB: This behavior's logic is complicated due to the fact that phytomer and
 * leaf transforms are stored as world-to-node while the logic is easier
 * expressed in a parent-node-to-node way. We pay this price once here, so that
 * we do not need it anywhere else.
 */
export function applyGrowth2Behavior(
  scene: SceneModel,
  context: EvalContext,
  behavior: Growth2Behavior,
  options: ApplyBehaviorOptions,
): SceneModel {
    // TODO: Memoize
  const invWorldFromPrevNode = new Matrix4();
  const prevNodeFromNode = new Matrix4();
  const newWorldFromNode = new Matrix4();
  const newPrevNodeFromNode = new Matrix4();

  const { handleNode } = behavior;

  let branches = scene.branches;

  for (let i = 0 ; i < options.repeat ; ++i) {

    // Allocate memory to store the next transform of each phytomer
    const allNextTransforms: Matrix4[][] = branches.map(b => b.phytomers.map(_ => new Matrix4()));

    // Grow from origin to tip so that we accumulate transform
    for (const plant of scene.plants.items) {
      // branches to be handled, sorted
      const fifo: { branchRef: BranchRef, accumulatedTransform: Matrix4 }[] = [];

      const accumulatedTransform = new Matrix4();
      accumulatedTransform.copy(branches[plant.shoot].phytomers[0].transform);

      fifo.push({
        branchRef: plant.shoot,
        accumulatedTransform,
      });

      let next;
      while ((next = fifo.shift()) !== undefined) {
        const { branchRef, accumulatedTransform } = next;
        console.assert(branchRef >= 0 && branchRef < branches.length);
        const branch = branches[branchRef];
        const skipBranch = ((behavior.flags & BehaviorFlag.BypassActive) === 0 && !branch.active) || options.branchFilter?.(branch) === false;

        const newWorldFromPrevNode = new Matrix4();
        newWorldFromPrevNode.copy(accumulatedTransform);
        if (skipBranch) {
          const worldFromPrevNode = branch.phytomers[0].transform;
          const worldFromNode = branch.phytomers[branch.phytomers.length - 1].transform;

          invWorldFromPrevNode.copy(worldFromPrevNode);
          invWorldFromPrevNode.invert();

          prevNodeFromNode.multiplyMatrices(invWorldFromPrevNode, worldFromNode);
          newWorldFromNode.multiplyMatrices(newWorldFromPrevNode, prevNodeFromNode);

          newWorldFromPrevNode.copy(newWorldFromNode);
        } else {
          const nextTransforms = allNextTransforms[branchRef];
          const growthModel = scene.growthModels.items[branch.growthModelIndex];

          console.assert(branch.phytomers.length > 1);


          nextTransforms[0].copy(newWorldFromPrevNode);

          for (let nodeIndex = 0 ; nodeIndex < branch.phytomers.length - 1 ; ++nodeIndex) {
            // Estimate node transform
            const deltaNodeMatrix = handleNode(context, growthModel, branch, nodeIndex);

            const worldFromPrevNode = branch.phytomers[nodeIndex].transform;
            const worldFromNode = branch.phytomers[nodeIndex + 1].transform;

            invWorldFromPrevNode.copy(worldFromPrevNode);
            invWorldFromPrevNode.invert();

            prevNodeFromNode.multiplyMatrices(invWorldFromPrevNode, worldFromNode);
            newPrevNodeFromNode.multiplyMatrices(deltaNodeMatrix, prevNodeFromNode);
            newWorldFromNode.multiplyMatrices(newWorldFromPrevNode, newPrevNodeFromNode);
            nextTransforms[nodeIndex + 1].copy(newWorldFromNode);

            newWorldFromPrevNode.copy(newWorldFromNode);

            // world = worldFromNode * node
            // world = worldFromPrevNode * prevNodeFromNode * node
            // so worldFromNode = worldFromPrevNode * prevNodeFromNode
            // with prevNodeFromNode = inv(worldFromPrevNode) * worldFromNode
            // nodeFromPrevNode = inv(worldFromNode) * worldFromPrevNode
          }
        }

        for (const childRef of branch.children) {
          fifo.push({
            branchRef: childRef,
            accumulatedTransform: newWorldFromPrevNode,
          });
        }
      }
    }

    // Apply updates all at once
    const nextBranches = branches.map((branch, branchIndex) => {
      const nextTransforms = allNextTransforms[branchIndex];
      return {
        ...branch,

        // Update phytomers
        phytomers: branch.phytomers.map((_, phIndex) => {
          const transform = new Matrix4();
          transform.copy(nextTransforms[phIndex]);
          return { transform };
        }),

        // Rotate leaves to follow their anchor's transform
        leaves: branch.leaves.map(leaf => {
          // TODO: memoize
          const worldFromLeaf = new Matrix4();
          const newWorldFromLeaf = new Matrix4();
          const invWorldFromNode = new Matrix4();
          const nodeFromLeaf = new Matrix4();

          const phIndex = leaf.anchor + 1;
          const ph = branch.phytomers[phIndex];

          // Previous and new transform of the phytomer the leaf is anchored to
          const worldFromNode = ph.transform;
          const newWorldFromNode = nextTransforms[phIndex];

          invWorldFromNode.copy(worldFromNode);
          invWorldFromNode.invert();

          worldFromLeaf.makeRotationFromQuaternion(leaf.orientation);
          nodeFromLeaf.multiplyMatrices(invWorldFromNode, worldFromLeaf);
          newWorldFromLeaf.multiplyMatrices(newWorldFromNode, nodeFromLeaf);

          const orientation = new Quaternion();
          orientation.setFromRotationMatrix(newWorldFromLeaf);
          orientation.normalize();

          return {
            ...leaf,
            orientation,
          }
        }),
      }
    });

    // TODO: Instead of calling recomputeMeristemDirection, we should transform
    // meristem direction like we do for leaves.
    branches = recomputeMeristemDirection(nextBranches);
  }

  // Although we modify in place, create new objects to trigger re-render
  return {
    ...scene,
    branches,
  }
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
export function applyBehavior(
  scene: SceneModel,
  context: EvalContext,
  behavior: Behavior,
  options: ApplyBehaviorOptions,
): SceneModel {
  switch (behavior.type) {

    case "organogenesis":
      return applyOrganogenesisBehavior(scene, context, behavior, options);

    case "growth":
      return applyGrowthBehavior(scene, context, behavior, options);

    case "growth2":
      return applyGrowth2Behavior(scene, context, behavior, options);

    default:
      throw Error("Unhandled behavior type: " + JSON.stringify(behavior));

  }
}
