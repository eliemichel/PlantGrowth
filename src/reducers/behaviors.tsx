/**
 * This is a pool of behavior implementations available for simulation.
 *
 * NB: When adding a new behavior, don't forget to add it to the 'behaviors'
 * registry at the end (it is the only variable that gets exported).
 */

import { Vector } from '../utils/vector.tsx'
import { Vector3, Matrix4 } from 'three'
import {
  type Branch,
  type Leaf,
  type GrowthModel,
  type BranchRef,
  type RelativeVector,
} from '../models/SimulationModel.tsx'
import { toVector } from '../utils/vector3.tsx'
import {
  evalExpr,
  makeContext,
} from '../models/DSL.tsx'
import { growBranch } from './legacyGrowth.tsx'
import {
  relativeToWorldDirection,
  epsilonSq,
  createPhytomersFromPositions,
  getPhytomerPosition,
  getAllPhytomerPositions,
  clonePhytomer,
  createLeafOrientation,
} from './growth.tsx'
import { type Behavior } from './behaviorPipelines.tsx'

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

  const branchPoints = getAllPhytomerPositions(branch);

  const isLastNode = nodeIndex == branchPoints.length - 2;
  if (branch.active && isLastNode) {
    prevNode.set(...branchPoints[nodeIndex]);
    node.set(...branchPoints[nodeIndex + 1]);
    merismaticGrowth.subVectors(node, prevNode);
    if (merismaticGrowth.length() < 1e-4 && nodeIndex > 0) {
      prevNode.set(...branchPoints[nodeIndex - 1]);
      node.set(...branchPoints[nodeIndex + 1]);
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

  prevNode.set(...branchPoints[nodeIndex]);
  node.set(...branchPoints[nodeIndex + 1]);
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

/**
 * Grow a little bit a given leaf, given the growth model's leafGrowthRate
 */
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
    phytomers: branch.phytomers.map(clonePhytomer),
    leaves: [...branch.leaves],
    buds: [...branch.buds],
    // TODO: add other members that need to be deeply copied
  };

  const branchPoints = getAllPhytomerPositions(branch);

  const meristemAnchor = branchPoints.length - 2;
  const meristemPosition = branchPoints[branchPoints.length - 1];

  const newBranches: Branch[] = [];

  const createLeaf = (relativeDirection: RelativeVector | undefined, relativeNormal: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branchPoints);

    const normal: Vector =
      relativeNormal === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeNormal, branchPoints);

    nextBranch.leaves.push({
      anchor: meristemAnchor,
      size: 0.05,
      orientation: createLeafOrientation({
        normal,
        direction,
      })
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.phytomers.length - 2) {
      nextBranch.phytomers.push(clonePhytomer(nextBranch.phytomers[nextBranch.phytomers.length - 1]));
    }
  }

  const createBud = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ Math.random() - 0.5, 0.0, Math.random() - 0.5 ]
      : relativeToWorldDirection(relativeDirection, branchPoints);

    nextBranch.buds.push({
      anchor: meristemAnchor,
      size: 0.1,
      direction,
      differentiation: "shoot",
      age: 0,
    });
    // Let the stem grow above the leaf if it was not already the case
    if (meristemAnchor == nextBranch.phytomers.length - 2) {
      nextBranch.phytomers.push(clonePhytomer(nextBranch.phytomers[nextBranch.phytomers.length - 1]));
    }
  }

  const createStem = (relativeDirection: RelativeVector | undefined) => {
    const direction: Vector =
      relativeDirection === undefined
      ? [ 0.0, 1.0, 0.0 ]
      : relativeToWorldDirection(relativeDirection, branchPoints);

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
      phytomers: createPhytomersFromPositions([
        [...meristemPosition],
        toVector(secondPoint),
      ]),
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
      createStem(action.direction);
      break;
    }
  }

  return [ nextBranch, ...newBranches ];
}

/**
 * Apply gravity to a node, called from a growth2 behavior
 */
function nodeGravityKernel(growthModel: GrowthModel, branch: Branch, nodeIndex: number): Matrix4 {
  // TODO: Memoize
  const up = new Vector3( 0, 1, 0 );
  const m = new Matrix4();
  const prevNode = new Vector3();
  const node = new Vector3();
  const diff = new Vector3();
  const rotationAxis = new Vector3();

  prevNode.set(...getPhytomerPosition(branch.phytomers[nodeIndex]));
  node.set(...getPhytomerPosition(branch.phytomers[nodeIndex + 1]));
  diff.subVectors(node, prevNode);
  const phytomerLength = diff.length();
  diff.normalize();

  rotationAxis.crossVectors(up, diff);
  if (rotationAxis.lengthSq() < epsilonSq) {
    rotationAxis.set(Math.random() - 0.5, 0.0, Math.random() - 0.5);
  }
  rotationAxis.normalize();

  const angle = diff.angleTo(up);

  // 1. Gravity
  // WARNING: This is a placeholder expression
  // TODO: how to get the total children mass?
  let deltaAngle = (Math.PI / 2 - angle) * 0.01;

  // 2. Directional growth: the plant may counter gravity if it is still elongating cells
  const ctx = makeContext("phytomer", {
    length: phytomerLength,
  });

  const maybeRate = evalExpr(growthModel.continuousGrowthRate, ctx);
  if (maybeRate.result === undefined) {
    // TODO: logging system
    console.error(maybeRate.error);
  } else {
    const rate = maybeRate.result;
    if (rate > 0) {
      deltaAngle = -angle * 0.02;
    }
  }

  
  m.makeRotationAxis(rotationAxis, deltaAngle);
  return m;
}

const behaviors: { [key: string]: Behavior } = {
  legacy: {
    name: 'legacy',
    type: 'organogenesis',
    handleBranch: growBranch,
  },

  growth: {
    name: 'growth',
    type: 'growth',
    handleNode: growNode,
    handleLeaf: growLeaf,
  },

  organogenesis: {
    name: 'organogenesis',
    type: 'organogenesis',
    handleBranch: growNewOrgans,
  },

  gravity: {
    name: 'gravity',
    type: 'growth2',
    handleNode: nodeGravityKernel,
  },
};

export default behaviors;
