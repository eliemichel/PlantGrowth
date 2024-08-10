/*
 * This is a library of functions used by growth logic.
 */

import { Vector } from '../utils/vector.tsx'

import { Vector3, Matrix4, Quaternion } from 'three'

import {
  type Branch,
  type BranchRef,
  type Plant,
  type SimulationModel,
} from '../models/SimulationModel.tsx'

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
