
// Types for Viewport props
// TODO: Replace with a more generic branch => color function
export enum LineColor {
  Uniform,
  Active,
}

export type ViewportState = {
	showLeaves: boolean,
	showBuds: boolean,
	showBranches: boolean,
	showNodes: boolean,
	showMeristems: boolean,
	
	lineColor: LineColor,
}
