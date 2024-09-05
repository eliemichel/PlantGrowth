import { useRef, useMemo, createContext, useContext, useEffect } from 'react'

import {
  Uint32BufferAttribute,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  BufferGeometry,
  Matrix4,
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

import { useAppStore } from '../stores/appStore.ts'

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

type FramesProps = {
  frameMode: FrameMode,
}

function Frames({ frameMode }: FramesProps) {
  const { positions, colors } = useGeometry().frame;
  
  const phytomers = useAppStore(state => state.scene.phytomers);

  // Extract transform data so that we rebuild frame data only if these change
  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  const count: number = phytomers.items.length;

  const transforms = useMemo(() => {
    console.log("Rebuild frame data");

    // Memoized
    const mat = new Matrix4();

    const transforms = new Float32Array(count * 16);

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

    return transforms;
  }, [ phytomerTransforms, frameMode ])

  const baseAttributes = useMemo(() => ({
    position: new Float32BufferAttribute(positions, 3),
    color: new Float32BufferAttribute(colors, 3),
  }), [])

  type DataRef = { transforms: Float32Array };
  const dataRef = useRef<DataRef>({ transforms })
  dataRef.current = { transforms };

  const transformsRef = useRef<InstancedBufferAttribute>(null!);

  // Rebuild geometry only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log("Rebuild Frame Geo Buffers");

    const transformAttr = new InstancedBufferAttribute(dataRef.current.transforms, 16);
    transformsRef.current = transformAttr;

    const geometry = new InstancedBufferGeometry();
    
    geometry.instanceCount = count;
    geometry.setAttribute('position', baseAttributes.position);
    geometry.setAttribute('color', baseAttributes.color);
    geometry.setAttribute('transform', transformAttr);

    return geometry;

  }, [ count, baseAttributes ]);

  // Update transform data if needed
  useEffect(() => {

    if (transformsRef.current) {
      if (transformsRef.current.count == count) {
        transformsRef.current.array = transforms;
        transformsRef.current.needsUpdate = true;
      } else {
        console.error("count mismatch!", transformsRef.current.count, "!=", count)
      }
    }

  }, [ transforms ]);

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
  const growthModels = useAppStore(state => state.scene.growthModels);

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
  
  const phytomers = useAppStore(state => state.scene.phytomers);
  const plants = useAppStore(state => state.scene.plants);
  const growthModels = useAppStore(state => state.scene.growthModels);

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
    const scale = new Vector3();

    let instanceIndex = 0;
    for (let phytomerIndex = 0; phytomerIndex < allLeaves.length; phytomerIndex++) {
      const leaves = allLeaves[phytomerIndex];
      const anchorPosition = getPhytomerPosition({ transform: phytomerTransforms[phytomerIndex] });
      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
        const leaf = leaves[leafIndex];
        
        mat.makeRotationFromQuaternion(leaf.orientation);
        mat.setPosition(...anchorPosition);
        scale.set(leaf.size, leaf.size, leaf.size);
        mat.scale(scale);
        meshRef.current.setMatrixAt(instanceIndex, mat);
        ++instanceIndex;
      }
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ allLeaves, phytomerTransforms, count ]);

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
  
  const phytomers = useAppStore(state => state.scene.phytomers);

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
  
  const phytomers = useAppStore(state => state.scene.phytomers);

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
  
  const phytomers = useAppStore(state => state.scene.phytomers);

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

  const phytomers = useAppStore(state => state.scene.phytomers);
  const plants = useAppStore(state => state.scene.plants);

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

  const phytomers = useAppStore(state => state.scene.phytomers);
  const plants = useAppStore(state => state.scene.plants);
  const growthModels = useAppStore(state => state.scene.growthModels);
  const count: number = phytomers.items.length;

  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  const phytomerParentTransforms: Matrix4[] = useMemo(() => {
    const identity = new Matrix4();
    const transforms = phytomers.items.map(() => identity);
    for (const phytomer of phytomers.items) {
      for (const childRef of phytomer.children) {
        transforms[childRef.index] = phytomer.transform;
      }
    }
    for (const plant of plants.items) {
      transforms[plant.shoot.index] = plant.transform;
    }
    return transforms;
  }, [ phytomers, plants ]);

  const defaultColor = [ 0, 0, 0 ];
  const plantColors = useMemo(
    () => plants.mapToArray(plant => deref(plant.growthModelRef)?.stemColor ?? defaultColor),
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
        const [ r, g, b ] = plantColors[phytomer.plantRef.index];
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
      <phytomerMaterial key={PhytomerMaterial.key} vertexColors={true} roughness={0.9} />
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
