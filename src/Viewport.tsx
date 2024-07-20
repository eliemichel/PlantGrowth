import { useRef, useState, useMemo, createContext, useContext, useEffect } from 'react'
import { BufferAttribute, BufferGeometry, Object3D, Matrix4, Vector3, DoubleSide } from 'three'
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
import { useArrayMemo } from './utils/customHooks.tsx'

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
  };
}

const GeometryContext = createContext(createGeometryContext());
const useGeometry = () => useContext(GeometryContext);

function Leaves(props: ThreeElements['mesh']) {
  const meshRef = useRef<THREE.Mesh>(null!)

  const { positions, normals } = useGeometry().leaf;
  
  const branches = useScene().branches;

  // Extract leaf data from state so that we rebuild vertex data only if these changes
  const leaves = useArrayMemo(() => {
    return [].concat(...branches.map(branch => branch.leaves))
  }, [ branches ]);

  const count = leaves.length;

  // TODO: Avoid rebuilding the whole mesh when only a leaf's position changes
  
  useEffect(() => {
    console.log("Rebuild leaves matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();
    const target = new Vector3();
    const scale = new Vector3();
    const up = new Vector3(0, 1, 0);
    for (let i = 0; i < count; i++) {
      const leaf = leaves[i];
      position.set(...leaf.anchor);
      target.set(
        leaf.anchor[0] + leaf.normal[0],
        leaf.anchor[1] + leaf.normal[1],
        leaf.anchor[2] + leaf.normal[2],
      );
      mat.lookAt(
        position,
        target,
        up
      );
      mat.setPosition(position);
      scale.set(-leaf.size, -leaf.size, -leaf.size);
      mat.scale(scale);
      meshRef.current.setMatrixAt(i, mat);
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ leaves ]);

  return (
    <instancedMesh
      args={[null, null, count]}
      {...props}
      ref={meshRef}
    >
      {/*<boxGeometry args={[0.1, 0.1, 0.01]} />*/}
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-normal" count={normals.length / 3} array={normals} itemSize={3} />
      </bufferGeometry>
      <meshStandardMaterial color='#88ff00' roughness={0.8} side={DoubleSide} />
    </instancedMesh>
  )
}

function Tree(props: ThreeElements['mesh']) {
  const meshRef = useRef<THREE.Mesh>(null!)
  console.log("Create Tree");

  const branches = useScene().branches;

  // Extract points from state so that we rebuild vertex data only if these changes
  const branchePoints = useArrayMemo(() => {
    return [].concat(...branches.map(branch => branch.points))
  }, [ branches ]);

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

    return [ vertices, indices ];
  }, [ branchePoints ]);

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
      <lineBasicMaterial color='#ff4400' />
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
      <Leaves />
    </Canvas>
  )
}
