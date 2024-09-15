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
		positions: new Float32Array(3 * 2 * (phytomerResolution + 1)),
		normals: new Float32Array(3 * 2 * (phytomerResolution + 1)),
		u: new Float32Array(1 * 2 * (phytomerResolution + 1)), // u of UV, the v being position.z
		indices: new Uint32Array(3 * 2 * phytomerResolution),
	}
	const rowStride = phytomerResolution + 1;
	for (let i = 0 ; i <= phytomerResolution ; ++i) {
		const u = i / phytomerResolution;
		const angle = 2 * Math.PI * u;
		const c = Math.cos(angle);
		const s = Math.sin(angle);
		phytomer.positions[3 * i + 0] = c;
		phytomer.positions[3 * i + 1] = u; // we pack 'u' it here because we cannot afford an extra attribute
		phytomer.positions[3 * i + 2] = 0;
		phytomer.positions[3 * (i + rowStride) + 0] = c;
		phytomer.positions[3 * (i + rowStride) + 1] = u;
		phytomer.positions[3 * (i + rowStride) + 2] = 1;

		phytomer.u[i] = u;
		phytomer.u[i + rowStride] = u;

		// TODO: No need for this as it is redundant with positions
		phytomer.normals[3 * i + 0] = c;
		phytomer.normals[3 * i + 1] = s;
		phytomer.normals[3 * i + 2] = 0;
		phytomer.normals[3 * (i + rowStride) + 0] = c;
		phytomer.normals[3 * (i + rowStride) + 1] = s;
		phytomer.normals[3 * (i + rowStride) + 2] = 0;

		if (i === phytomerResolution) continue;

		phytomer.indices[3 * (2 * i + 0) + 0] = i;
		phytomer.indices[3 * (2 * i + 0) + 1] = (i + 1) % rowStride;
		phytomer.indices[3 * (2 * i + 0) + 2] = rowStride + (i + 1) % rowStride;

		phytomer.indices[3 * (2 * i + 1) + 0] = i;
		phytomer.indices[3 * (2 * i + 1) + 1] = rowStride + (i + 1) % rowStride;
		phytomer.indices[3 * (2 * i + 1) + 2] = rowStride + i;
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
