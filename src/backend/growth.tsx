/*
 * This is a library of functions used by growth logic.
 */

import { Vector, subtract, distance } from '../utils/vector.tsx'
import { toVector } from '../utils/vector3.tsx'
import { ItemReference, isValidRef } from '../utils/Collection.tsx'

import { Vector3, Matrix4, Quaternion } from 'three'

import {
  type Plant,
  type SceneModel,
  type Phytomer,
} from '../models/SceneModel.tsx'

import {
  type RelativeVector,
} from '../models/GrowthModel.tsx'

export const epsilon = 1e-8;
export const epsilonSq = epsilon * epsilon;

/**
 * A growth frame could be summarized as a single matrix, but for simpler use
 * we store it in redundant forms.
 */
export type GrowthFrame = {
  matrix: Matrix4,
  rotation: Quaternion,
  translation: Vector3,
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
export const makeGrowthFrameFromDirection = (() => {
  // Memoized variables
  const up = new Vector3(0, 1, 0);
  const amphitonic = new Vector3();
  const epitonic = new Vector3();
  const apical = new Vector3();
  const out: GrowthFrame = {
    matrix: new Matrix4(),
    rotation: new Quaternion(),
    translation: new Vector3(),
  };

  return (origin: Vector, apicalDrection: Vector): GrowthFrame => {
    // Apical direction goes along the branch
    apical.set(...apicalDrection);
    if (apical.lengthSq() < epsilonSq) {
      console.error('PROBLEM', apicalDrection);
      apical.set(0, 1, 0);
    }
    apical.normalize();

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

    out.translation.set(...origin);
    out.matrix.makeBasis(amphitonic, epitonic, apical);
    out.matrix.setPosition(out.translation);
    out.rotation.setFromRotationMatrix(out.matrix);
    return out;
  }
})();

/**
 * Only the transform field of the Phytomer type is needed, so you may mock it up
 */
export function makeGrowthFrameFromPhytomer(phytomer: { transform: Matrix4 }) {
  return makeGrowthFrameFromDirection(
    getPhytomerPosition(phytomer),
    getPhytomerDirection(phytomer),
  );
}

/**
 * Retrieve all the branches that belong to a given plant.
 */
export function getPhytomersFromPlant(model: SceneModel, plant: Plant): Phytomer[] {
  const plantPhytomers: Phytomer[] = [];
  const fifo: ItemReference<Phytomer>[] = [ plant.shoot ];

  let next;
  while ((next = fifo.shift()) !== undefined) {
    const ref = next;
    console.assert(isValidRef(ref));
    const phytomer = model.phytomers.items[ref.index];

    plantPhytomers.push(phytomer);

    for (const childRef of phytomer.children) {
      fifo.push(childRef);
    }
  }

  return plantPhytomers;
}


/**
 * Given a relative direction and a phytomer, resolve into a world direction.
 */
export function relativeToWorldDirection(relativeDirection: RelativeVector, phytomer: Phytomer): Vector {
  // TODO: Memoize
  const directionInGrowthFrame = new Vector3();

  switch (relativeDirection.frame) {
  case 'growth':
    const growthFrame = makeGrowthFrameFromPhytomer(phytomer);
    directionInGrowthFrame.set(...relativeDirection.coords);
    directionInGrowthFrame.applyQuaternion(growthFrame.rotation);
    directionInGrowthFrame.normalize();
    return toVector(directionInGrowthFrame);
  case 'world':
    return relativeDirection.coords;
  }
}

/**
 * Get the position in world space of a phytomer
 * (Only the transform field is needed)
 */
export function getPhytomerPosition(phytomer: { transform: Matrix4 }): Vector {
  const { elements } = phytomer.transform;
  return [
    elements[12],
    elements[13],
    elements[14],
  ]
}

/**
 * Get the apical direction in world space of a phytomer
 * (Only the transform field is needed)
 */
export function getPhytomerDirection(phytomer: { transform: Matrix4 }): Vector {
  const { elements } = phytomer.transform;
  return [
    elements[8],
    elements[9],
    elements[10],
  ]
}

// TODO: remove this Transition function
function createPhytomerFromTransform(plantRef: ItemReference<Plant>, x: { transform: Matrix4 }): Phytomer {
  return { transform: x.transform, children: [], leaves: [], buds: [], differentiation: "", plantRef, meristem: null }
}

/**
 * Utility function that creates a list of phytomers from their position.
 * Frames are more or less the growth frame, flipped to ensure continuity of
 * the orientation.
 * NB: This should only be used in presets, not in behavior's logic
 */
export function createPhytomersFromPositions(positions: Vector[]): { transform: Matrix4 }[] {
  // TODO: memoize
  const X = new Vector3();
  const Y = new Vector3();
  const Z = new Vector3();
  const pX = new Vector3();
  const pY = new Vector3();
  const pZ = new Vector3();
  const flipMatrix = new Matrix4();
  flipMatrix.makeRotationZ(Math.PI);

  const phytomers = [];
  for (let pointIndex = 0 ; pointIndex < positions.length ; ++pointIndex) {
    const lastIdx = Math.max(pointIndex, 1);
    const growthFrame = makeGrowthFrameFromDirection(
      positions[lastIdx],
      subtract(positions[lastIdx], positions[lastIdx - 1]),
    );
    const transform = new Matrix4();
    transform.copy(growthFrame.matrix);
    transform.setPosition(...positions[pointIndex]);

    // Ensure continuity
    if (phytomers.length > 0) {
      const prevTransform = phytomers[phytomers.length - 1].transform;
      transform.extractBasis(X, Y, Z);
      prevTransform.extractBasis(pX, pY, pZ);
      const energy = X.dot(pX) + Y.dot(pY);
      if (energy < 0.0) {
        transform.multiply(flipMatrix);
      }
    }

    phytomers.push({ transform })
  }

  return phytomers;
}

/**
 * Utility function that creates single-phytomer chain from its position and
 * growth direction.
 */
export function createPhytomersFromDirection(plantRef: ItemReference<Plant>, position: Vector, direction: Vector): Phytomer[] {
  const growthFrame = makeGrowthFrameFromDirection(position, direction);
  
  const transform = new Matrix4();
  transform.copy(growthFrame.matrix);
  transform.setPosition(...position);

  return [
    createPhytomerFromTransform(plantRef, { transform }),
    createPhytomerFromTransform(plantRef, { transform }),
  ]
}

/**
 * Create a deep copy of a phytomer
 */
export function clonePhytomer(phytomer: Phytomer): { transform: Matrix4 } {
  const transform = new Matrix4();
  transform.copy(phytomer.transform);
  return { transform };
}


/**
 * @param direction
 * Direction in which the leaf grows
 *
 * @param normal
 * Direction in which the leaf area is oriented (e.g., direction of the sun)
 * In case normal is not orthogonal to direction, direction takes over and
 * the leaf gets oriented as close as possible to the prescribed normal.
 */
export function createLeafOrientation({ direction, normal }: { direction: Vector, normal: Vector }): Quaternion {
  // TODO: Memoize
  const directionV = new Vector3();
  const targetNormal = new Vector3();
  const normalV = new Vector3();
  const side = new Vector3();
  const mat = new Matrix4();

  directionV.set(...direction);
  directionV.normalize();
  targetNormal.set(...normal);

  side.crossVectors(directionV, targetNormal);
  side.normalize();
  normalV.crossVectors(side, directionV);
  normalV.normalize();

  mat.makeBasis(side, directionV, normalV);

  const quat = new Quaternion();
  quat.setFromRotationMatrix(mat);
  return quat;
}

// TODO: This is very inefficient, update once we have a reference to a phytomer's parent
export function getParentTransform(scene: SceneModel, phytomer: Phytomer) {
  for (const plant of scene.plants.items) {
    if (scene.phytomers.at(plant.shoot) === phytomer) {
      return plant.transform;
    }
  }
  for (const other of scene.phytomers.items) {
    for (const childRef of other.children) {
      if (scene.phytomers.at(childRef) === phytomer) {
        return other.transform;
      }
    }
  }
  return null;
}

// TODO: This is very inefficient, update once we have a reference to a phytomer's parent
export function computePhytomerLength(scene: SceneModel, phytomer: Phytomer) {
  const transform = getParentTransform(scene, phytomer);
  if (transform === null) return 0.0; // phytomer has no parent
  const parentPosition = getPhytomerPosition({ transform });
  const position = getPhytomerPosition(phytomer);
  return distance(position, parentPosition)
}
