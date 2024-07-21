
export type Vector = [number, number, number]

export type Leaf = {
  anchor: Vector,
  size: number,
  normal: Vector,
}

/**
 * This represents an internode rather than a whole branch.
 */
export type Branch = {
  // Index within the growthModels array in the parent simulation model.
  growthModelIndex: number,

  active: boolean,
  points: Vector[],
  leaves: Leaf[],
}

export type GrowthModel = {
  maxInternodeLength: number,

  // Number of internodes before branching
  maxNodesPerAxis: number,
}

export type SimulationModel = {
  growthModels: GrowthModel[],

  branches: Branch[],
}
