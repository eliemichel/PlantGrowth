/*
 * This is a library of functions used by growth logic.
 */

import { Vector } from '../utils/vector.tsx'
import { toVector } from '../utils/vector3.tsx'

import { Vector3, Matrix4, Quaternion } from 'three'

import {
  type Branch,
  type BranchRef,
  type Plant,
  type SimulationModel,
  type Phytomer,
} from '../models/SimulationModel.tsx'

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
export const makeGrowthFrame: ((branchPoints: Vector[]) => GrowthFrame) = (() => {
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
        console.error('PROBLEM', points);
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
 * Given a relative direction and a branch, resolve into a world direction.
 */
export function relativeToWorldDirection(relativeDirection: RelativeVector, branchPoints: Vector[]): Vector {
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

export function getPhytomerPosition(phytomer: Phytomer): Vector {
  const { elements } = phytomer.transform;
  return [
    elements[12],
    elements[13],
    elements[14],
  ]
}

/**
 * This is a function meant to be used temporarily for migration from the old
 * point-based branch description to the new phytomer-based one.
 * NB: Try not to use this in new code.
 */
export function getAllPhytomerPositions(branch: Branch): Vector[] {
  return branch.phytomers.map(getPhytomerPosition);
}

/**
 * Utility function that creates a list of phytomers from their position.
 * Frames are more or less the growth frame, flipped to ensure continuity of
 * the orientation.
 */
export function createPhytomersFromPositions(positions: Vector[]): Phytomer[] {
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
    const growthFrame = makeGrowthFrame(positions.slice(0, Math.max(pointIndex + 1, 2)));
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
 * Create a deep copy of a phytomer
 */
export function clonePhytomer(phytomer: Phytomer): Phytomer {
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
