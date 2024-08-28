import { type Vector } from './vector.tsx'

export function hexToRgb(hex: string): Vector {
	var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	return result ? [
		parseInt(result[1], 16),
		parseInt(result[2], 16),
		parseInt(result[3], 16),
	] : [ 0, 0, 0 ];
}
