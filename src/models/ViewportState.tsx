
// Types for Viewport props
// TODO: Replace with a more generic branch => color function
export enum LineColor {
  Uniform,
  Active,
}

export enum FrameMode {
  World,
  Growth,
  Phytomer,
}

export type ViewportState = {
	showLeaves: boolean,
	showBuds: boolean,
	showBranches: boolean,
	showNodes: boolean,
	showMeristems: boolean,
	showFrames: boolean,

	frameMode: FrameMode,

	lineColor: LineColor,
}

export function createInitialViewportState(): ViewportState {
  return {
    showLeaves: true,
    showBuds: true,
    showNodes: true,
    showBranches: true,
    showMeristems: true,
    showFrames: false,

    frameMode: FrameMode.Phytomer,

    lineColor: LineColor.Active,
  }
}
