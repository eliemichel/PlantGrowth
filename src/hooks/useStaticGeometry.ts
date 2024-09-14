import { createContext, useContext } from 'react'

export type LeafGeometry = {
	positions: Float32Array,
	normals: Float32Array,
}

/**
 * A context that provides the non-mutable geometry buffers
 */
function createStaticGeometryContext() {
	console.log("Create Geometry");

	const phytomerResolution = 8;
	const phytomer = {
		positions: new Float32Array(3 * 2 * phytomerResolution),
		normals: new Float32Array(3 * 2 * phytomerResolution),
		indices: new Uint32Array(3 * 2 * phytomerResolution),
	}
	for (let i = 0 ; i < phytomerResolution ; ++i) {
		const angle = 2 * Math.PI * i / phytomerResolution;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		phytomer.positions[3 * i + 0] = c;
		phytomer.positions[3 * i + 1] = s;
		phytomer.positions[3 * i + 2] = 0;
		phytomer.positions[3 * (i + phytomerResolution) + 0] = c;
		phytomer.positions[3 * (i + phytomerResolution) + 1] = s;
		phytomer.positions[3 * (i + phytomerResolution) + 2] = 1;

		// TODO: No need for this as it is redundant with positions
		phytomer.normals[3 * i + 0] = c;
		phytomer.normals[3 * i + 1] = s;
		phytomer.normals[3 * i + 2] = 0;
		phytomer.normals[3 * (i + phytomerResolution) + 0] = c;
		phytomer.normals[3 * (i + phytomerResolution) + 1] = s;
		phytomer.normals[3 * (i + phytomerResolution) + 2] = 0;

		phytomer.indices[3 * i + 0] = i;
		phytomer.indices[3 * i + 1] = (i + 1) % phytomerResolution;
		phytomer.indices[3 * i + 2] = phytomerResolution + (i + 1) % phytomerResolution;

		phytomer.indices[3 * (i + phytomerResolution) + 0] = i;
		phytomer.indices[3 * (i + phytomerResolution) + 1] = phytomerResolution + (i + 1) % phytomerResolution;
		phytomer.indices[3 * (i + phytomerResolution) + 2] = phytomerResolution + i;
	}

	const leaves: { [key: string]: LeafGeometry } = {
		lanceolate: {
			positions: new Float32Array([
				0.0, 0.0, 0.0,
				0.5, 0.5, 0.0,
				-0.5, 0.5, 0.0,

				-0.5, 0.5, 0.0,
				0.5, 0.5, 0.0,
				0.0, 1.5, -0.3,
			]),
			normals: new Float32Array([
				0.0, 0.0, 1.0,
				0.0, 0.1, 1.0,
				0.0, 0.1, 1.0,

				0.0, 0.1, 1.0,
				0.0, 0.1, 1.0,
				0.0, 0.2, 1.0,
			]),
		},
		needle: {
			positions: new Float32Array([
				0.0, 0.0, 0.0,
				0.05, 0.5, 0.0,
				-0.05, 0.5, 0.0,

				-0.05, 0.5, 0.0,
				0.05, 0.5, 0.0,
				0.0, 1.5, 0.0,
			]),
			normals: new Float32Array([
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,

				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
			]),
		},
	}

	return {
		phytomer,

		leaves,

		frame: {
			positions: new Float32Array([
				0.0, 0.0, 0.0,
				1.0, 0.0, 0.0,
				0.0, 0.0, 0.0,

				0.0, 0.0, 0.0,
				0.0, 1.0, 0.0,
				0.0, 0.0, 0.0,

				0.0, 0.0, 0.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 0.0,
			]),
			colors: new Float32Array([
				1.0, 0.0, 0.0,
				1.0, 0.0, 0.0,
				1.0, 0.0, 0.0,

				0.0, 1.0, 0.0,
				0.0, 1.0, 0.0,
				0.0, 1.0, 0.0,

				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
				0.0, 0.0, 1.0,
			]),
		},
	};
}

const StaticGeometryContext = createContext(createStaticGeometryContext());
const useStaticGeometry = () => useContext(StaticGeometryContext);

export default useStaticGeometry
