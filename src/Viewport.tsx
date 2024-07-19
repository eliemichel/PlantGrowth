import { useRef, useState, useMemo, createContext, useContext } from 'react'
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber'
import {
  PerspectiveCamera,
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
} from '@react-three/drei'

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


  return (
    <mesh
      {...props}
      ref={meshRef}
      scale={active ? 1.5 : 1}
      onClick={(event) => setActive(!active)}
      onPointerOver={(event) => setHover(true)}
      onPointerOut={(event) => setHover(false)}>
      {/*<boxGeometry args={[1, 1, 1]} />*/}
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={vertices.length / 3} array={vertices} itemSize={3} />
      </bufferGeometry>
      <meshStandardMaterial color={hovered ? 'hotpink' : 'orange'} roughness={0.2} />
    </mesh>
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
      <Environment preset="park" />

      <Grid scale={10} cellSize={0.025} sectionSize={0.125} sectionColor={'#777777'} />

      <Box position={[-1.2, 0, 0]} />
      <Box position={[1.2, 0, 0]} />
      <Box position={[0, 0, 0]} />
    </Canvas>
  )
}
