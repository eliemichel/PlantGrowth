
export type Vector = [number, number, number]

export type Leaf = {
  anchor: Vector,
  size: number,
  normal: Vector,
}

export type Branch = {
  active: boolean,
  points: Vector[],
  leaves: Leaf[],
}

export type SimulationModel = {
  instanceCount: number,
  branches: Branch[],
}
