import { ViewportState, LineColor } from '../models/ViewportState.tsx'

export function createInitialViewportState(): ViewportState {
  return {
    showLeaves: true,
    showBuds: true,
    showNodes: true,
    showBranches: true,
    lineColor: LineColor.Active,
  }
}
