import { useRef, useMemo, createContext, useContext, useEffect } from 'react'
import { Uint32BufferAttribute, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, BufferGeometry, Matrix4, Vector3, DoubleSide, InstancedMesh } from 'three'
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
} from '../models/SceneModel.tsx'
import { Vector } from '../utils/vector.tsx'
import { useArrayMemo } from '../utils/customHooks.tsx'
import { ViewportState, LineColor, FrameMode } from '../models/ViewportState.tsx'
import {
  makeGrowthFrameFromPhytomer,
  getPhytomerPosition,
} from '../backend/growth.tsx'
import { useAppStore } from '../stores/appStore.tsx'
import { useShallow } from 'zustand/react/shallow'

// Apply line_ fix
import {} from '../utils/fixes.tsx'

import './Viewport.css'

function createGeometryContext() {
  console.log("Create Geometry");
  return {
    leaf: {
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

function Leaves(props: ThreeElements['instancedMesh']) {
  const meshRef = useRef<InstancedMesh>(null!)

  const { positions, normals } = useGeometry().leaf;
  
  const [ phytomers, leafColor ] = useAppStore(useShallow(state => [ state.scene.phytomers, state.scene.leafColor ]));

  // Extract leaf data from state so that we rebuild vertex data only if these changes
  const allLeaves: Leaf[][] = useArrayMemo(() => {
    return phytomers.mapToArray(ph => ph.leaves)
  }, [ phytomers ]);

  const phytomerTransforms: Matrix4[] = useArrayMemo(
    () => phytomers.mapToArray(ph => ph.transform),
    [ phytomers ]
  );

  console.assert(allLeaves.length == phytomers.items.length);

  const count: number = allLeaves.reduce((acc, leaves) => acc + leaves.length, 0);

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
      ref={meshRef}
    >
      {/*<boxGeometry args={[0.1, 0.1, 0.01]} />*/}
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-normal" count={normals.length / 3} array={normals} itemSize={3} />
      </bufferGeometry>
      <meshStandardMaterial color={leafColor} roughness={0.8} side={DoubleSide} />
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
      {viewportState.showLeaves ? <Leaves /> : null}
      {viewportState.showBuds ? <Buds /> : null}
      {viewportState.showNodes ? <Nodes /> : null}
      {viewportState.showMeristems ? <Meristems /> : null}
      {viewportState.showFrames ? <Frames frameMode={viewportState.frameMode} /> : null}
    </Canvas>
  )
}
