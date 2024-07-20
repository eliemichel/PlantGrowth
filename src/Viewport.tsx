import { useRef, useState, useMemo, createContext, useContext, useEffect } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber'
import {
  PerspectiveCamera,
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
} from '@react-three/drei'

import { useScene } from './reducers/sceneReducer.tsx'

import './Viewport.css'

function createGeometryContext() {
  console.log("Create Geometry");
  return {
    triangle: new Float32Array([
      0.0, 0.0, 0.0,
      1.0, 0.0, 0.0,
      0.0, 1.0, 0.0,
    ]),
  };
}

const GeometryContext = createContext(createGeometryContext());
const useGeometry = () => useContext(GeometryContext);

function Box(props: ThreeElements['mesh']) {
  const meshRef = useRef<THREE.Mesh>(null!)
  const [hovered, setHover] = useState(false)
  const [active, setActive] = useState(false)
  console.log("Create Box");
  const vertices = useGeometry().triangle;
  //useFrame((state, delta) => (meshRef.current.rotation.x += delta))

  const count = useScene().instanceCount;

  useEffect(() => {
    console.log("Mounting effect");

    // Set positions
    const temp = new Object3D();
    for (let i = 0; i < count; i++) {
      temp.position.set(0.1 * (Math.random() - 0.5), 0.2 * i, 0.1 * (Math.random() - 0.5))
      temp.updateMatrix()
      meshRef.current.setMatrixAt(i, temp.matrix)
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true

    return () => {
      console.log("Unmounting effect");
    }
  }, [count]);

  return (
    <instancedMesh
      args={[null, null, count]}
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}>
      <boxGeometry args={[0.1, 0.2, 0.1]} />
      {/*<bufferGeometry>
        <bufferAttribute attach="attributes-position" count={vertices.length / 3} array={vertices} itemSize={3} />
      </bufferGeometry>*/}
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} roughness={0.2} />
    </instancedMesh>
  )
}

function Tree(props: ThreeElements['mesh']) {
  const meshRef = useRef<THREE.Mesh>(null!)
  console.log("Create Tree");

  const branches = useScene().branches;

  // Rebuild vertex data if the plant model changed
  const [ vertices, indices ] = useMemo(() => {
    console.log("Rebuilding vertex data");

    let pointCount = 0;
    for (const b of branches) {
      pointCount += b.points.length;
    }

    const vertices = new Float32Array(3 * pointCount);
    const indices = new Uint32Array(pointCount + branches.length);

    let pointOffset = 0;
    let indexOffset = 0;
    for (const b of branches) {
      for (const pt of b.points) {
        vertices[3 * pointOffset + 0] = pt[0];
        vertices[3 * pointOffset + 1] = pt[1];
        vertices[3 * pointOffset + 2] = pt[2];
        indices[indexOffset] = pointOffset;
        ++indexOffset;
        ++pointOffset;
      }
      indices[indexOffset] = 0xffffffff;
      ++indexOffset;
    }

    console.log("indices", indices);

    return [ vertices, indices ];
  }, [ branches ]);

  const geoRef = useRef<BufferAttribute>(null)
  const positionsRef = useRef<BufferAttribute>(null)
  const indicesRef = useRef<BufferAttribute>(null)

  // Rebuild geometry only if the number of vertices or indices changed.
  const geometry = useMemo(() => {

    console.log("Rebuild Geo Buffers", vertices.length);

    const positionAttr = new BufferAttribute(vertices, 3);
    positionsRef.current = positionAttr;

    const indexAttr = new BufferAttribute(indices, 1);
    indicesRef.current = indexAttr;

    const geometry = new BufferGeometry();
    geoRef.current = geometry;

    geometry.setAttribute('position', positionAttr);
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
    <line
      {...props}
      ref={meshRef}
      geometry={geometry}
    >
      <lineBasicMaterial color='red' />
    </line>
  )
}

export default function Viewport() {
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
      <Tree />
    </Canvas>
  )
}
