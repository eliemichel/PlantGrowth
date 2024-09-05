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

import { Matrix4, Quaternion } from 'three'

import {
  type Scene,
  type Leaf,
  type Phytomer,
} from '../models/SceneModel.ts'

import {
  type GrowthModel,
} from '../models/GrowthModel.ts'

import {
  type EvalError,
} from '../models/DSL.ts'

import {
  getParentTransform,
} from '../backend/growth.ts'

import { Vector, addInPlace, copyVector } from '../utils/vector.ts'
import { Collection, ItemReference, isValidRef } from '../utils/Collection.ts'

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
 * Informatino returned by the 'handleMeristem' kernel provided by an
 * organogenesis behavior.
 */
export type OrganogenesisMeristemHandlerOutput = {
  // New value of the parent phytomer
  phytomer: Phytomer,

  // Newly create phytomers (typically children of the parent phytomer)
  newPhytomers: null | Collection<Phytomer>,
}

/**
 * Organogenesis does not move any existing nodes, but it may create new
 * elements in branches or even new branches.
 * NB: Only phytomers that have a valid meristem are processed, unless BypassActive flag is on
 */
export type OrganogenesisBehavior = CommonBehaviorAttributes & {
  type: 'organogenesis',
  handlePhytomer: (
    context: EvalContext,
    growthModel: GrowthModel,
    phytomer: Phytomer,
    phytomerIndex: number,
    parentTransform: Matrix4 | null,
  ) => OrganogenesisMeristemHandlerOutput,
}

/**
 * Continuous growth only moves existing nodes. It can move internal nodes,
 * which has a recursive effect on all subsequent nodes. This returns for
 * each node a position update expressed in its local growth frame. A node is
 * identified by its branch + node index. The node position is the branch's
 * points of index nodeIndex + 1 because the first points (the anchor) does
 * not count as a node (it already does in the parent branch).
 */
export type GrowthBehavior = CommonBehaviorAttributes & {
  type: 'growth',
  handlePhytomer: (
    context: EvalContext,
    growthModel: GrowthModel,
    phytomer: Phytomer,
    phytomerIndex: number,
    parentTransform: Matrix4 | null,
  ) => Vector,
  handleLeaf: (
    context: EvalContext,
    growthModel: GrowthModel,
    phytomer: Phytomer,
    leafIndex: number,
  ) => Leaf,
}

/**
 * A behavior that is similar to GrowthBehavior but also enables rotations
 */
export type Growth2Behavior = CommonBehaviorAttributes & {
  type: 'growth2',
  handlePhytomer: (
    context: EvalContext,
    growthModel: GrowthModel,
    phytomer: Phytomer,
    phytomerIndex: number,
    parentTransform: Matrix4 | null,
  ) => Matrix4,
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
  phytomerFilter?: (phytomer: Phytomer) => boolean,
}

export function applyOrganogenesisBehavior(
  scene: Scene,
  context: EvalContext,
  behavior: OrganogenesisBehavior,
  options: ApplyBehaviorOptions,
): Scene {
  const { handlePhytomer } = behavior;
  // Map the branch handler on all branches, reduces resulting lists together
  let nextPhytomers = scene.phytomers;
  for (let i = 0 ; i < options.repeat ; ++i) {
    // Cannot use this nice functional approach because of the temporary
    // poor man's reference management
    // TODO: Restore this now that we do have a proper reference system
    /*
    nextBranches = concatAll(nextBranches.map(b => {
      const growthModel = scene.growthModels[b.growthModelIndex];
      return handleBranch(context, growthModel, b);
    }));
    */
    const phytomers = nextPhytomers;

    const newPhytomerChunks: Collection<Phytomer>[] = []; // phytomers that we append at the end
    let newPhytomerCount = 0;

    nextPhytomers = phytomers.transform((ph, phIndex) => {

      const skipPhytomer = ((behavior.flags & BehaviorFlag.BypassActive) === 0 && ph.meristem === null) || options.phytomerFilter?.(ph) === false;

      if (skipPhytomer) {
        return ph;
      }

      const plant = scene.plants.at(ph.plantRef);
      const growthModel = scene.growthModels.at(plant.growthModelRef);
      const out = handlePhytomer(context, growthModel, ph, phIndex, getParentTransform(scene, ph));
      // Existing phytomers must not move in the array not to mess up with
      // indices, so the first element returned by handleBranch is pushed
      // now, the other ones (newly created phytomers) are kept for the end.
      if (out.newPhytomers !== null) {
        newPhytomerChunks.push(out.newPhytomers);
        newPhytomerCount += out.newPhytomers.items.length;
      }
      return out.phytomer;
    })
    // TODO: Replace by a more generic 'append()'
    for (const chunk of newPhytomerChunks) {
      nextPhytomers.merge(chunk);
    }
  }
  return {
    ...scene,
    phytomers: nextPhytomers,
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
  scene: Scene,
  context: EvalContext,
  behavior: GrowthBehavior,
  options: ApplyBehaviorOptions,
): Scene {
  // TODO: Memoize
  const translation = new Matrix4();

  const { handlePhytomer, handleLeaf } = behavior;

  let phytomers = scene.phytomers;

  for (let i = 0 ; i < options.repeat ; ++i) {

    // Allocate memory to store growth vectors for each node
    const update: Vector[] = phytomers.mapToArray(_ => [ 0, 0, 0 ]);

    // Grow from origin to tip so that we accumulate transform
    for (const plant of scene.plants.items) {
      // branches to be handled, sorted
      const fifo: {
        phytomerRef: ItemReference<Phytomer>,
        accumulatedOffset: Vector,
        parentTransform: Matrix4,
      }[] = [];

      fifo.push({
        phytomerRef: plant.shoot,
        accumulatedOffset: [ 0, 0, 0 ],
        parentTransform: plant.transform,
      });

      let next;
      while ((next = fifo.shift()) !== undefined) {
        const { phytomerRef, accumulatedOffset, parentTransform } = next;
        console.assert(isValidRef(phytomerRef));
        const phytomer = phytomers.items[phytomerRef.index];
        const skipPhytomer = options.phytomerFilter?.(phytomer) === false;

        const newOffset: Vector = [ ...accumulatedOffset ];
        if (!skipPhytomer) {
          const plant = scene.plants.at(phytomer.plantRef);
          const growthModel = scene.growthModels.at(plant.growthModelRef);

          // Estimate node movement
          const deltaNodePosition = handlePhytomer(context, growthModel, phytomer, phytomerRef.index, parentTransform);

          // Add to the accumulated offset that gets applied to this node
          // and all of its children.
          addInPlace(newOffset, deltaNodePosition);

          // Apply accumulated offset
          copyVector(update[phytomerRef.index], newOffset);
        }

        for (const childRef of phytomer.children) {
          fifo.push({
            phytomerRef: childRef,
            accumulatedOffset: [...newOffset],
            parentTransform: phytomer.transform,
          });
        }
      }
    }

    // Apply updates all at once
    const nextPhytomers = phytomers.transform((phytomer, phytomerIndex) => {
      const plant = scene.plants.at(phytomer.plantRef);
      const growthModel = scene.growthModels.at(plant.growthModelRef);
      const nextTransform = new Matrix4();
      translation.makeTranslation(...update[phytomerIndex]);
      nextTransform.multiplyMatrices(translation, phytomer.transform);
      return {
        ...phytomer,
        transform: nextTransform,
        leaves: phytomer.leaves.map((_, leafIndex) => handleLeaf(context, growthModel, phytomer, leafIndex)),
      }
    });

    phytomers = nextPhytomers;
  }

  // Although we modify in place, create new objects to trigger re-render
  return {
    ...scene,
    phytomers,
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
  scene: Scene,
  context: EvalContext,
  behavior: Growth2Behavior,
  options: ApplyBehaviorOptions,
): Scene {
    // TODO: Memoize
  const invWorldFromPrevNode = new Matrix4();
  const prevNodeFromNode = new Matrix4();
  const newWorldFromNode = new Matrix4();
  const newPrevNodeFromNode = new Matrix4();

  const { handlePhytomer } = behavior;

  let phytomers = scene.phytomers;

  for (let i = 0 ; i < options.repeat ; ++i) {

    // Allocate memory to store the next transform of each phytomer
    const nextTransforms: Matrix4[] = phytomers.mapToArray(_ => new Matrix4());

    // Grow from origin to tip so that we accumulate transform
    for (const plant of scene.plants.items) {
      // phytomers to be handled, sorted
      const fifo: {
        phytomerRef: ItemReference<Phytomer>,
        worldFromPrevNode: Matrix4,
        newWorldFromPrevNode: Matrix4,
      }[] = [];

      const plantTransform = plant.transform;

      fifo.push({
        phytomerRef: plant.shoot,
        worldFromPrevNode: plantTransform,
        newWorldFromPrevNode: plantTransform,
      });

      let next;
      while ((next = fifo.shift()) !== undefined) {
        const { phytomerRef, worldFromPrevNode, newWorldFromPrevNode } = next;
        console.assert(isValidRef(phytomerRef));
        const phytomer = phytomers.items[phytomerRef.index];
        const skipPhytomer = options.phytomerFilter?.(phytomer) === false;

        const plant = scene.plants.at(phytomer.plantRef);
        const growthModel = scene.growthModels.at(plant.growthModelRef);

        // Estimate node transform

        const worldFromNode = phytomer.transform;

        invWorldFromPrevNode.copy(worldFromPrevNode);
        invWorldFromPrevNode.invert();

        prevNodeFromNode.multiplyMatrices(invWorldFromPrevNode, worldFromNode);


        if (skipPhytomer) {
          newPrevNodeFromNode.copy(prevNodeFromNode);
        } else {
          const deltaNodeMatrix = handlePhytomer(context, growthModel, phytomer, phytomerRef.index, worldFromPrevNode);
          newPrevNodeFromNode.multiplyMatrices(deltaNodeMatrix, prevNodeFromNode);
        }


        newWorldFromNode.multiplyMatrices(newWorldFromPrevNode, newPrevNodeFromNode);
        nextTransforms[phytomerRef.index].copy(newWorldFromNode);

        // world = worldFromNode * node
        // world = worldFromPrevNode * prevNodeFromNode * node
        // so worldFromNode = worldFromPrevNode * prevNodeFromNode
        // with prevNodeFromNode = inv(worldFromPrevNode) * worldFromNode
        // nodeFromPrevNode = inv(worldFromNode) * worldFromPrevNode

        for (const childRef of phytomer.children) {
          fifo.push({
            phytomerRef: childRef,
            worldFromPrevNode: worldFromNode,
            newWorldFromPrevNode: newWorldFromNode,
          });
        }
      }
    }

    // Apply updates all at once
    const nextPhytomers = phytomers.transform((phytomer, phytomerIndex) => {
      const transform = new Matrix4();
      transform.copy(nextTransforms[phytomerIndex]);
      return {
        ...phytomer,
        transform,

        // Rotate leaves to follow their anchor's transform
        leaves: phytomer.leaves.map(leaf => {
          // TODO: memoize
          const worldFromLeaf = new Matrix4();
          const newWorldFromLeaf = new Matrix4();
          const invWorldFromNode = new Matrix4();
          const nodeFromLeaf = new Matrix4();

          // Previous and new transform of the phytomer the leaf is anchored to
          const worldFromNode = phytomer.transform;
          const newWorldFromNode = nextTransforms[phytomerIndex];

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

    phytomers = nextPhytomers;
  }

  // Although we modify in place, create new objects to trigger re-render
  return {
    ...scene,
    phytomers,
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
  scene: Scene,
  context: EvalContext,
  behavior: Behavior,
  options: ApplyBehaviorOptions,
): Scene {
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
