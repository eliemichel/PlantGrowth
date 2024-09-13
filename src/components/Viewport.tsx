import { useRef, useMemo, createContext, useContext, useEffect, useCallback } from 'react'

import {
  Uint32BufferAttribute,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  BufferGeometry,
  Matrix4,
  Matrix3,
  Vector3,
  DoubleSide,
  InstancedMesh,
  TypedArray,
} from 'three'

import { Canvas, ThreeElements } from '@react-three/fiber'

import {
  PerspectiveCamera,
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
} from '@react-three/drei'

import {
  type Phytomer,
  type Leaf,
  type Bud,
} from '../models/SceneModel.ts'

import {
  LeafType,
} from '../models/GrowthModel.ts'

import { useArrayMemo } from '../utils/customHooks.ts'
import { deref } from '../utils/Collection.ts'

import { ViewportState, LineColor, FrameMode } from '../models/ViewportState.ts'

import {
  makeGrowthFrameFromPhytomer,
  getPhytomerPosition,
} from '../backend/growth.ts'

import { useStore } from '../store'

import PhytomerMaterial from '../three/PhytomerMaterial.ts'
import {} from '../three/reactThreeFiberExtensions.tsx'

import './Viewport.css'

// NB: There is a lot to factorize around here

// TODO: move to utils?
const updateMatrixAttributeData = (out: TypedArray, data: Matrix4[]) => {
  console.assert(out.byteLength === 4 * 16 * data.length)
  const outAsFloat32 = new Float32Array(out.buffer, out.byteOffset);
  data.forEach((mat, idx) => {
    mat.toArray(outAsFloat32, 16 * idx);
  })
};

function createGeometryContext() {
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

  type LeafGeometry = {
    positions: Float32Array,
    normals: Float32Array,
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

const GeometryContext = createContext(createGeometryContext());
const useGeometry = () => useContext(GeometryContext);

// TODO: Factorize Frames, Leaves, Buds, Nodes, Meristems, etc.

type InstancedBufferGeometryAttributeDefinition =
  | MutableInstancedBufferGeometryAttributeDefinition
  | ImmutableInstancedBufferGeometryAttributeDefinition

type InstancedBufferGeometryAttributeDefinitionCommon = {
  // Name as used in shaders
  name: string,

  // Number of (float) components
  components: number,
}

// NB: Mutable attributes are always per-instance
type MutableInstancedBufferGeometryAttributeDefinition = InstancedBufferGeometryAttributeDefinitionCommon & {
  mutable: true,

  // Update the 'data' array in place. Use useCallback to make sure that the
  // callback object is rebuilt only when needed because we rely on this to
  // know when to update GPU buffers.
  updateData: (data: Float32Array) => void,
}

type ImmutableInstancedBufferGeometryAttributeDefinition = InstancedBufferGeometryAttributeDefinitionCommon & {
  mutable: false,

  // Immutable attributes have their data directly available
  data: Float32Array,
}

function isMutable(def: InstancedBufferGeometryAttributeDefinition): def is MutableInstancedBufferGeometryAttributeDefinition {
  return def.mutable;
}

function isImmutable(def: InstancedBufferGeometryAttributeDefinition): def is ImmutableInstancedBufferGeometryAttributeDefinition {
  return !def.mutable;
}

/**
 * Custom hook that defines a geometry object and its attributes, making sure
 * to update only what's needed when data changes. For instance, the geometry
 * is rebuilt only if the number of elements changes, otherwise we only update
 * its attribtues.
 * 
 * Important: The attribute definitions should not change, only 'updateData'
 * may be updated. In particular changing the attribute count would mess up
 * with the number of hooks invoked.
 */
function useInstancedBufferGeometry(
  attribtueDefs: InstancedBufferGeometryAttributeDefinition[],
  instanceCount: number,
  context: string,
) {
  const immutableAttributes = useMemo(() => (
    attribtueDefs
    .filter(isImmutable)
    .map(def => ({
      def,
      attr: new InstancedBufferAttribute(def.data, def.components),
    }))
  ), []) // No dependency to 'attribtueDefs' because is not supposed to change

  // Create data and three attribute for mutable attributes
  type MutableInstancedBufferGeometryAttribute = {
    def: MutableInstancedBufferGeometryAttributeDefinition,
    attr: InstancedBufferAttribute
  };
  const mutableAttributes: MutableInstancedBufferGeometryAttribute[] = useMemo(() => (
    attribtueDefs
    .filter(isMutable)
    .map(def => {
      // NB: If we'd have per-vertex attributes, we should split
      // 'mutableAttributes' so that we don't rebuild all per-instance
      // attribtues when vertex count changes and vice versa.
      const count = instanceCount;
      const attrData = new Float32Array(count * def.components);
      const attr = new InstancedBufferAttribute(attrData, def.components);
      return {
        def,
        attr,
      }
    })
  ), [ instanceCount ]); // No dependency to 'attribtueDefs' because is not supposed to change

  // Rebuild geometry only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log(`Rebuild '${context}' buffer geometry`);

    // Create geometry
    const geometry = new InstancedBufferGeometry();
    geometry.instanceCount = instanceCount;

    // Add attributes to geometry
    for (const { def, attr } of immutableAttributes) {
      geometry.setAttribute(def.name, attr);
    }
    for (const { def, attr } of mutableAttributes) {
      geometry.setAttribute(def.name, attr);
    }

    return geometry;

  }, [ instanceCount, immutableAttributes, mutableAttributes ]);

  // NB: It is important to directly look at 'attribtueDefs' rather than the
  // copy of 'def' memoized in 'mutableAttribute' because we need to detect
  // whether updateData changed
  let mutableAttributeIdx = 0;
  for (const def of attribtueDefs) {

    // Only iterate over mutable attributes
    if (isImmutable(def)) continue;

    console.assert(mutableAttributeIdx < mutableAttributes.length);
    const attrAndDef = mutableAttributes[mutableAttributeIdx];
    console.assert(attrAndDef.def.name === def.name);
    const { attr } = attrAndDef;

    ++mutableAttributeIdx;

    // Update attribute data if needed
    useEffect(() => {

      const dataAsFloat32 = new Float32Array(
        attr.array.buffer,
        attr.array.byteOffset,
        attr.count * def.components,
      );
      attr.needsUpdate = true;

      def.updateData(dataAsFloat32);

    }, [ def.updateData, attr ])

  }

  return geometry;
}

type FramesProps = {
  frameMode: FrameMode,
}

function Frames({ frameMode }: FramesProps) {
  const frameGeometry = useGeometry().frame;
  
  const phytomers = useStore(state => state.scene.phytomers);

  // Extract transform data so that we rebuild frame data only if these change
  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  const count: number = phytomers.items.length;

  const updateTransformData = useCallback((transforms: Float32Array) => {
    console.log("Update Frame transform data");

    // Memoized
    const mat = new Matrix4();

    for (let phytomerIndex = 0; phytomerIndex < count; phytomerIndex++) {
      const transform = phytomerTransforms[phytomerIndex];
      const position = getPhytomerPosition({ transform });

      switch (frameMode) {
      case FrameMode.World:
        break;

      case FrameMode.Growth:
        const growthFrame = makeGrowthFrameFromPhytomer({ transform });
        mat.copy(growthFrame.matrix);
        break;

      case FrameMode.Phytomer:
        mat.copy(transform);
        break;
      }

      mat.setPosition(...position);
      for (let i = 0 ; i < 16 ; ++i) {
        transforms[16 * phytomerIndex + i] = mat.elements[i];
      }
    }
  }, [ phytomerTransforms, frameMode ]);

  const geometry = useInstancedBufferGeometry(
    [
      // Immutable attributes
      {
        name: "position",
        mutable: false,
        data: frameGeometry.positions,
        components: 3,
      },
      {
        name: "color",
        mutable: false,
        data: frameGeometry.colors,
        components: 3,
      },
      // Mutable attributes
      {
        name: "transform",
        mutable: true,
        components: 16,
        updateData: updateTransformData,
      },
    ],
    count,
    "Frames",
  )

  const vertexShader = useMemo(() => `
    precision highp float;

    uniform mat4 modelViewMatrix;
    uniform mat4 projectionMatrix;
    uniform float scale;

    attribute vec3 position;
    attribute vec3 color;
    attribute mat4 transform;

    varying vec3 vColor;

    void main() {
      vColor = color;
      gl_Position = projectionMatrix * modelViewMatrix * transform * vec4( position * scale, 1.0 );
    }
  `, [])

  const fragmentShader = useMemo(() => `
    precision highp float;

    varying vec3 vColor;

    void main() {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `, [])

  return (
    <line_ geometry={geometry}>
      <rawShaderMaterial
        uniforms={{ scale: { value: 0.1 } }}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
      />
    </line_>
  )
}

function LeavesOfAllTypes(props: ThreeElements['instancedMesh']) {
  const growthModels = useStore(state => state.scene.growthModels);

  const allLeafTypes = useMemo(
    () => Array.from(new Set(
      growthModels.mapToArray(m => m.leafType)
    )).sort(),
    [ growthModels ]
  )

  return allLeafTypes.map(leafType => (
    <Leaves key={leafType} leafType={leafType} {...props} />
  ))
}

type LeavesProps = ThreeElements['instancedMesh'] & {
  leafType: LeafType,
}

function Leaves(props: LeavesProps) {
  const { leafType } = props;

  const meshRef = useRef<InstancedMesh>(null!)

  const key = LeafType[leafType].toLowerCase();
  const instanceGeometry = useGeometry().leaves[key];
  if (instanceGeometry === undefined) {
    console.error(`Leaf type '${key}' has no associated geometry`);
    return null;
  }
  
  const phytomers = useStore(state => state.scene.phytomers);
  const plants = useStore(state => state.scene.plants);
  const growthModels = useStore(state => state.scene.growthModels);

  const defaultColor = [ 0, 0, 0 ];
  const plantColors = useMemo(
    () => plants.mapToArray(plant => deref(plant.growthModelRef)?.leafColor ?? defaultColor),
    [ plants, growthModels ]
  )

  const plantHasSelectedLeafType = useMemo(
    () => plants.mapToArray(plant => deref(plant.growthModelRef)?.leafType === leafType),
    [ leafType, plants, growthModels ]
  )

  // Extract leaf data from state so that we rebuild vertex data only if these changes
  const allLeaves: Leaf[][] = useArrayMemo(() => {
    return phytomers.mapToArray(ph => plantHasSelectedLeafType[ph.plantRef.index] ? ph.leaves : [])
  }, [ phytomers ]);

  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  const phytomerThicknesses: number[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.thickness),
    [ phytomers ]
  );

  console.assert(allLeaves.length == phytomers.items.length);

  const count: number = allLeaves.reduce((acc, leaves) => acc + leaves.length, 0);

  const colorAttrRef = useRef<InstancedBufferAttribute>(null!);

  // Rebuild geometry and array buffers only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log("Rebuild Leaves Geo Buffers");

    // Attribute that may later get updated
    // TODO: Find a way to pass this as an int attribute?
    const colorAttr = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
    colorAttrRef.current = colorAttr;

    const geometry = new InstancedBufferGeometry();
    geometry.instanceCount = count;
    geometry.setAttribute('position', new Float32BufferAttribute(instanceGeometry.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(instanceGeometry.normals, 3));
    geometry.setAttribute('color', colorAttr);

    return geometry;

  }, [ count, instanceGeometry ]);

  // Update color data if needed
  // TODO: This is close to what is in ThickTree, deduplicate?
  useEffect(() => {

    const colorAttr = colorAttrRef.current;
    if (colorAttr) {
      const dataAsFloat32 = new Float32Array(colorAttr.array.buffer, colorAttr.array.byteOffset);
      colorAttr.needsUpdate = true;

      console.assert(colorAttr.count === count);
      console.assert(dataAsFloat32.length === 3 * count);

      let leafIdx = 0;
      for (const phytomer of phytomers.items) {
        if (!plantHasSelectedLeafType[phytomer.plantRef.index]) continue;
        const [ r, g, b ] = plantColors[phytomer.plantRef.index];
        for (const _leaf of phytomer.leaves) {
          dataAsFloat32[3 * leafIdx + 0] = r;
          dataAsFloat32[3 * leafIdx + 1] = g;
          dataAsFloat32[3 * leafIdx + 2] = b;
          ++leafIdx;
        }
      }
      console.assert(leafIdx === count);
    }

  }, [ count, phytomers, plants, geometry, plantColors ]);

  // TODO: Avoid rebuilding the whole mesh when only a leaf's position changes
  
  useEffect(() => {
    console.log("Rebuild leaf matrices, count =", count);

    // Set positions
    const mat = new Matrix4();
    const worldToNode = new Matrix4();
    const nodeToWorldDirection = new Matrix3();
    const scale = new Vector3();
    const position = new Vector3();
    const offset = new Vector3();
    const leafDirection = new Vector3();

    let instanceIndex = 0;
    for (let phytomerIndex = 0; phytomerIndex < allLeaves.length; phytomerIndex++) {
      const leaves = allLeaves[phytomerIndex];
      const transform = phytomerTransforms[phytomerIndex];
      const thickness = phytomerThicknesses[phytomerIndex];
      const anchorPosition = getPhytomerPosition({ transform });
      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
        const leaf = leaves[leafIndex];

        // Offset so that the leaf is not within the stem
        leafDirection.set(0, 1, 0); // local to leaf frame
        leafDirection.applyQuaternion(leaf.orientation); // world
        const nodeToWorld = transform;
        worldToNode.copy(nodeToWorld);
        worldToNode.invert();
        leafDirection.applyMatrix4(worldToNode); // local to phytomer frame
        offset.set(leafDirection.x, leafDirection.y, 0); // project to normal plane
        offset.normalize();
        offset.multiplyScalar(thickness);
        nodeToWorldDirection.setFromMatrix4(nodeToWorld);
        offset.applyMatrix3(nodeToWorldDirection); // to world (direction only)

        // Build final matrix
        position.set(...anchorPosition);
        position.add(offset);
        mat.makeRotationFromQuaternion(leaf.orientation);
        mat.setPosition(position);
        scale.set(leaf.size, leaf.size, leaf.size);
        mat.scale(scale);
        meshRef.current.setMatrixAt(instanceIndex, mat);
        ++instanceIndex;
      }
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ allLeaves, phytomerTransforms, phytomerThicknesses, count ]);

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      {...props}
      geometry={geometry}
      ref={meshRef}
    >
      <meshStandardMaterial vertexColors={true} roughness={0.8} side={DoubleSide} />
    </instancedMesh>
  )
}

function Buds(props: ThreeElements['instancedMesh']) {
  const meshRef = useRef<InstancedMesh>(null!)
  
  const phytomers = useStore(state => state.scene.phytomers);

  // Extract bud data from state so that we rebuild vertex data only if these changes
  const allBuds: Bud[][] = useArrayMemo(() => {
    return phytomers.mapToArray(ph => ph.buds)
  }, [ phytomers ]);

  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  console.assert(allBuds.length == phytomers.items.length);

  const count: number = allBuds.reduce((acc, buds) => acc + buds.length, 0);

  // TODO: Avoid rebuilding the whole mesh when only a bud's position changes
  
  useEffect(() => {
    console.log("Rebuild buds matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();
    const target = new Vector3();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);

    const switchYZAxes = new Matrix4();
    switchYZAxes.makeRotationX(Math.PI / 2.0);

    const moveAlongY = new Matrix4();
    moveAlongY.setPosition(0, 0.1, 0);

    let instanceIndex = 0;
    for (let phytomerIndex = 0; phytomerIndex < allBuds.length; phytomerIndex++) {
      const buds = allBuds[phytomerIndex];
      const anchorPosition = getPhytomerPosition({ transform: phytomerTransforms[phytomerIndex] });
      for (let budIndex = 0; budIndex < buds.length; budIndex++) {
        const bud = buds[budIndex];

        position.set(...anchorPosition);
        target.set(
          anchorPosition[0] + bud.direction[0],
          anchorPosition[1] + bud.direction[1],
          anchorPosition[2] + bud.direction[2],
        );
        mat.lookAt(
          position,
          target,
          up
        );
        mat.setPosition(position);
        scale.set(-bud.size, -bud.size, -bud.size);
        mat.scale(scale);
        mat.multiply(switchYZAxes);
        mat.multiply(moveAlongY);
        meshRef.current.setMatrixAt(instanceIndex, mat);
        ++instanceIndex;
      }
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ allBuds, phytomerTransforms, count ]);

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      {...props}
      ref={meshRef}
    >
      <capsuleGeometry args={[ 0.05, 0.1, 4, 8 ]} />
      <meshStandardMaterial color='#ff8800' roughness={0.8} side={DoubleSide} />
    </instancedMesh>
  )
}

function Nodes(props: ThreeElements['instancedMesh']) {
  const meshRef = useRef<InstancedMesh>(null!)
  
  const phytomers = useStore(state => state.scene.phytomers);

  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  const count: number = phytomers.items.length;

  // TODO: Avoid rebuilding the whole mesh when only a bud's position changes
  
  useEffect(() => {
    console.log("Rebuild node matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();

    phytomerTransforms.forEach((transform, phytomerIndex) => {
      position.set(...getPhytomerPosition({ transform }));
      mat.setPosition(position);
      meshRef.current.setMatrixAt(phytomerIndex, mat);
    });

    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ phytomerTransforms, count ]);

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      {...props}
      ref={meshRef}
    >
      <sphereGeometry args={[ 0.005, 16, 8 ]} />
      <meshStandardMaterial color='#dd8800' roughness={0.8} side={DoubleSide} />
    </instancedMesh>
  )
}

function Meristems(props: ThreeElements['instancedMesh']) {
  const meshRef = useRef<InstancedMesh>(null!)
  
  const phytomers = useStore(state => state.scene.phytomers);

  const phytomersWithMeristem: Phytomer[] = useMemo(
    () => phytomers.items.filter(ph => ph.meristem !== null),
    [ phytomers ]
  );

  const meristemTransforms: Matrix4[] = useArrayMemo(
    () => phytomersWithMeristem.map(ph => ph.transform),
    [ phytomersWithMeristem ]
  );

  const count: number = meristemTransforms.length;

  // TODO: Avoid rebuilding the whole mesh when only a bud's position changes
  
  useEffect(() => {
    console.log("Rebuild meristem matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();

    meristemTransforms.forEach((transform, meristemIndex) => {
      position.set(...getPhytomerPosition({ transform }));
      mat.setPosition(position);
      meshRef.current.setMatrixAt(meristemIndex, mat);
    });

    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ meristemTransforms, count ]);

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      {...props}
      ref={meshRef}
    >
      <boxGeometry args={[ 0.02, 0.002, 0.02 ]} />
      <meshStandardMaterial color='#8844ff' roughness={0.8} side={DoubleSide} />
    </instancedMesh>
  )
}

type TreeProps = {
  lineColor: LineColor,
}

function Tree({ lineColor }: TreeProps) {
  console.log("Create Tree");

  const phytomers = useStore(state => state.scene.phytomers);
  const plants = useStore(state => state.scene.plants);

  // Extract points from state so that we rebuild vertex data only if these changes
  const phytomerDrawInfo = useArrayMemo(() => {
    return phytomers.mapToArray(ph => ({
      transform: ph.transform,
      children: ph.children,
      selected: lineColor == LineColor.Active ? ph.meristem !== null : true, // TODO: expose in viewport state
    }))
  }, [ phytomers, lineColor ]);

  // Rebuild vertex data if the plant model changed
  const [ vertices, colors, indices ] = useMemo(() => {
    console.log("Rebuild vertex data");

    let pointCount = phytomerDrawInfo.length + plants.items.length;

    const vertices = new Float32Array(3 * pointCount);
    const colors = new Float32Array(3 * pointCount);
    const indices = new Uint32Array(2 * phytomerDrawInfo.length);

    const setPointAttributes = (pointIndex: number, transform: Matrix4, selected: boolean) => {
      const pt = getPhytomerPosition({ transform });
      vertices[3 * pointIndex + 0] = pt[0];
      vertices[3 * pointIndex + 1] = pt[1];
      vertices[3 * pointIndex + 2] = pt[2];
      if (selected) {
        colors[3 * pointIndex + 0] = 1.0;
        colors[3 * pointIndex + 1] = 0.25;
        colors[3 * pointIndex + 2] = 0.0;
      } else {
        colors[3 * pointIndex + 0] = 0.0;
        colors[3 * pointIndex + 1] = 0.5;
        colors[3 * pointIndex + 2] = 1.0;
      }
    }

    //const reset = 0xffffffff
    let indexOffset = 0;
    phytomerDrawInfo.forEach((info, pointIndex) => {
      const { transform, selected, children } = info;
      setPointAttributes(pointIndex, transform, selected);

      for (const childRef of children) {
        indices[indexOffset] = pointIndex;
        ++indexOffset;
        indices[indexOffset] = childRef.index;
        ++indexOffset;
      }
    })

    // Add plant shoots
    let pointOffset = phytomerDrawInfo.length;
    for (const plant of plants.items) {
      const { transform, shoot } = plant;
      setPointAttributes(pointOffset, transform, false);

      indices[indexOffset] = pointOffset;
      ++indexOffset;
      indices[indexOffset] = shoot.index;
      ++indexOffset;

      ++pointOffset;
    }

    console.assert(indexOffset === indices.length)

    return [ vertices, colors, indices ];
  }, [ phytomerDrawInfo, plants ]);

  // Create ref to pass indices and vertices to the geometry memo without
  // having them trigger updates when they change.
  type DataRef = { vertices: Float32Array, colors: Float32Array, indices: Uint32Array };
  const dataRef = useRef<DataRef>({ vertices, colors, indices })
  dataRef.current = { vertices, colors, indices };

  // References used for Three data update without triggering any React thing.
  const geoRef = useRef<BufferGeometry>(null!)
  const positionsRef = useRef<Float32BufferAttribute>(null!)
  const colorsRef = useRef<Float32BufferAttribute>(null!)
  const indicesRef = useRef<Uint32BufferAttribute>(null!)

  // Rebuild geometry only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log("Rebuild Geo Buffers", vertices.length);

    const positionAttr = new Float32BufferAttribute(dataRef.current.vertices, 3);
    positionsRef.current = positionAttr;

    const colorAttr = new Float32BufferAttribute(dataRef.current.colors, 3);
    colorsRef.current = colorAttr;

    const indexAttr = new Uint32BufferAttribute(dataRef.current.indices, 1);
    indicesRef.current = indexAttr;

    const geometry = new BufferGeometry();
    geoRef.current = geometry;

    geometry.setAttribute('position', positionAttr);
    geometry.setAttribute('color', colorAttr);
    geometry.setIndex(indexAttr);

    geometry.setDrawRange(0, indices.length);

    return geometry;

  }, [ indices.length, vertices.length ]);

  // Update vertex data if needed
  useEffect(() => {

    if (positionsRef.current) {
      positionsRef.current.array = vertices;
      positionsRef.current.needsUpdate = true;
    }

  }, [ vertices ]);

  // Update color data if needed
  useEffect(() => {

    if (colorsRef.current) {
      colorsRef.current.array = colors;
      colorsRef.current.needsUpdate = true;
    }

  }, [ colors ]);

  // Update index data if needed
  useEffect(() => {

    if (indicesRef.current) {
      indicesRef.current.array = indices;
      indicesRef.current.needsUpdate = true;
    }

  }, [ indices ]);

  // Update geometry bounds if needed
  useEffect(() => {

    if (geoRef.current) {
      geoRef.current.computeBoundingBox();
      geoRef.current.computeBoundingSphere();
    }

  }, [ vertices, indices ]);

  return (
    <lineSegments
      geometry={geometry}
    >
      <lineBasicMaterial vertexColors={true} />
    </lineSegments>
  )
}

function ThickTree() {
  const instanceGeometry = useGeometry().phytomer;

  const phytomers = useStore(state => state.scene.phytomers);
  const plants = useStore(state => state.scene.plants);
  const growthModels = useStore(state => state.scene.growthModels);
  const count: number = phytomers.items.length;

  // NB: Here we compute *combined* transforms, which embeds both the
  // translation/rotation stored in 'transform' and the scale stored in
  // 'thickness'. This precomputation is needed to avoid exceeding the maximum
  // number of vertex attributes (another workaround would be to store all
  // attribtues in a texture).
  const scale = new Matrix4();
  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(phytomer => {
      const m = new Matrix4();
      const s = phytomer.thickness;
      scale.makeScale(s, s, s);
      m.multiplyMatrices(
        phytomer.transform,
        scale
      );
      return m;
    }),
    [ phytomers ]
  );

  const phytomerParentTransforms: Matrix4[] = useMemo(() => {
    const transforms = phytomers.items.map(() => new Matrix4());
    for (const phytomer of phytomers.items) {
      for (const childRef of phytomer.children) {
        const s = phytomer.thickness;
        scale.makeScale(s, s, s);
        transforms[childRef.index].multiplyMatrices(
          phytomer.transform,
          scale
        );
      }
    }
    for (const plant of plants.items) {
      const s = plant.thickness;
      scale.makeScale(s, s, s);
      transforms[plant.shoot.index].multiplyMatrices(
        plant.transform,
        scale
      );
    }
    return transforms;
  }, [ phytomers, plants ]);

  const defaultColors = {
    shoot: [ 0, 0, 0 ],
    bark: [ 0, 0, 0 ],
    root: [ 0, 0, 0 ],
  }
  const plantColors = useMemo(
    () => plants.mapToArray(plant => deref(plant.growthModelRef)?.stemColors ?? defaultColors),
    [ plants, growthModels ]
  )

  // Reference to instance attributes
  const transformBeginAttrRef = useRef<InstancedBufferAttribute>(null!);
  const transformEndAttrRef = useRef<InstancedBufferAttribute>(null!);
  const colorAttrRef = useRef<InstancedBufferAttribute>(null!);

  // Rebuild geometry and array buffers only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log("Rebuild ThickTree Geo Buffers");

    // Attribute that may later get updated
    const transformBeginAttr = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
    transformBeginAttrRef.current = transformBeginAttr;

    const transformEndAttr = new InstancedBufferAttribute(new Float32Array(count * 16), 16);
    transformEndAttrRef.current = transformEndAttr;

    // TODO: Find a way to pass this as an int attribute?
    const colorAttr = new InstancedBufferAttribute(new Float32Array(count * 3), 3);
    colorAttrRef.current = colorAttr;

    const geometry = new InstancedBufferGeometry();
    geometry.instanceCount = count;
    geometry.setAttribute('position', new Float32BufferAttribute(instanceGeometry.positions, 3));
    geometry.setAttribute('normal', new Float32BufferAttribute(instanceGeometry.normals, 3));
    geometry.setAttribute('transformBegin', transformBeginAttr);
    geometry.setAttribute('transformEnd', transformEndAttr);
    geometry.setAttribute('color', colorAttr);
    geometry.setIndex(new Uint32BufferAttribute(instanceGeometry.indices, 1));

    return geometry;

  }, [ count, instanceGeometry ]);

  // Update transformBegin data if needed
  useEffect(() => {

    const transformBeginAttr = transformBeginAttrRef.current;
    if (transformBeginAttr) {
      updateMatrixAttributeData(transformBeginAttr.array, phytomerParentTransforms);
      transformBeginAttr.needsUpdate = true;
    }

  }, [ phytomerParentTransforms, geometry ]);

  // Update transformEnd data if needed
  useEffect(() => {

    const transformEndAttr = transformEndAttrRef.current;
    if (transformEndAttr) {
      updateMatrixAttributeData(transformEndAttr.array, phytomerTransforms);
      transformEndAttr.needsUpdate = true;
    }

  }, [ phytomerTransforms, geometry ]);

  // Update color data if needed
  useEffect(() => {

    const colorAttr = colorAttrRef.current;
    if (colorAttr) {
      const dataAsFloat32 = new Float32Array(colorAttr.array.buffer, colorAttr.array.byteOffset);
      colorAttr.needsUpdate = true;

      console.assert(colorAttr.count === phytomers.items.length);
      console.assert(dataAsFloat32.length === 3 * phytomers.items.length);

      phytomers.items.forEach((phytomer, idx) => {
        const [ r, g, b ] = plantColors[phytomer.plantRef.index][phytomer.type];
        dataAsFloat32[3 * idx + 0] = r;
        dataAsFloat32[3 * idx + 1] = g;
        dataAsFloat32[3 * idx + 2] = b;
      })
    }

  }, [ phytomers, plants, geometry, plantColors ]);

  return (
    <instancedMesh
      args={[undefined, undefined, count]}
      geometry={geometry}
    >
      <phytomerMaterial key={PhytomerMaterial.key} vertexColors={true} roughness={0.8} />
    </instancedMesh>
  )
}

type ViewportProps = {
  viewportState: ViewportState,
}

export default function Viewport({
  viewportState,
}: ViewportProps) {
  console.log("Create Viewport");
  return (
    <Canvas id="canvas">
      <PerspectiveCamera makeDefault position={[3, 2, 5]} fov={80} />
      <OrbitControls makeDefault />
      <GizmoHelper
        alignment="top-right" // widget alignment within scene
        margin={[80, 80]} // widget margins (X, Y)
      >
        <GizmoViewport axisColors={['red', 'green', 'blue']} labelColor="black" />
      </GizmoHelper>

      {/*
      <ambientLight intensity={Math.PI / 2} />
      <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} decay={0} intensity={Math.PI} />
      <pointLight position={[-10, -10, -10]} decay={0} intensity={Math.PI} />
      */}
      <Environment preset="park" background={true} backgroundBlurriness={0.15} />

      <Grid scale={10} cellSize={0.025} sectionSize={0.125} sectionColor={'#777777'} />

      {/*<Box position={[0, 0, 0]} />*/}
      {viewportState.showBranches ? <Tree lineColor={viewportState.lineColor} /> : null}
      {viewportState.showLeaves ? <LeavesOfAllTypes /> : null}
      {viewportState.showBuds ? <Buds /> : null}
      {viewportState.showNodes ? <Nodes /> : null}
      {viewportState.showMeristems ? <Meristems /> : null}
      {viewportState.showFrames ? <Frames frameMode={viewportState.frameMode} /> : null}
      {viewportState.showThickness ? <ThickTree /> : null}
    </Canvas>
  )
}
