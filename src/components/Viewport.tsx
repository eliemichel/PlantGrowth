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

import { Leaf, Bud } from '../models/SimulationModel.tsx'
import { Vector } from '../utils/vector.tsx'
import { useScene } from '../reducers/sceneReducer.tsx'
import { useArrayMemo } from '../utils/customHooks.tsx'
import { ViewportState, LineColor, FrameMode } from '../models/ViewportState.tsx'
import {
  makeGrowthFrame,
  getPhytomerPosition,
  getAllPhytomerPositions,
} from '../reducers/growth.tsx'

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
  
  const { branches } = useScene();

  // Extract leaf data from state so that we rebuild vertex data only if these changes
  const allPoints: Vector[][] = useArrayMemo(
    () => branches.map(getAllPhytomerPositions),
    [ branches ]
  );

  const count: number = allPoints.reduce((acc, points) => acc + points.length, 0);

  const transforms = useMemo(() => {
    console.log("Rebuild frame data");

    // Set positions
    const mat = new Matrix4();

    const transforms = new Float32Array(count * 16);

    let instanceIndex = 0;
    for (let branchIndex = 0; branchIndex < branches.length; branchIndex++) {
      const points = allPoints[branchIndex];
      for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {

        const position = points[pointIndex];

        switch (frameMode) {
        case FrameMode.World:
          break;

        case FrameMode.Growth:
          const growthFrame = makeGrowthFrame(points.slice(0, Math.max(pointIndex + 1, 2)));
          mat.copy(growthFrame.matrix);
          break;

        case FrameMode.Phytomer:
          mat.copy(branches[branchIndex].phytomers[pointIndex].transform);
          break;
        }

        mat.setPosition(...position);
        for (let i = 0 ; i < 16 ; ++i) {
          transforms[16 * instanceIndex + i] = mat.elements[i];
        }
        ++instanceIndex;
      }
    }

    return transforms;
  }, [ branches, allPoints, count, frameMode ])

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
  
  const { branches, leafColor } = useScene();

  // Extract leaf data from state so that we rebuild vertex data only if these changes
  const allLeaves: Leaf[][] = useArrayMemo(() => {
    return branches.map(branch => branch.leaves)
  }, [ branches ]);

  const allPoints: Vector[][] = useArrayMemo(
    () => branches.map(getAllPhytomerPositions),
    [ branches ]
  );

  console.assert(allLeaves.length == allPoints.length);

  const count: number = allLeaves.reduce((acc, leaves) => acc + leaves.length, 0);

  // TODO: Avoid rebuilding the whole mesh when only a leaf's position changes
  
  useEffect(() => {
    console.log("Rebuild leaves matrices");

    // Set positions
    const mat = new Matrix4();
    const scale = new Vector3();

    let instanceIndex = 0;
    for (let branchIndex = 0; branchIndex < allLeaves.length; branchIndex++) {
      const leaves = allLeaves[branchIndex];
      const points = allPoints[branchIndex];
      for (let leafIndex = 0; leafIndex < leaves.length; leafIndex++) {
        const leaf = leaves[leafIndex];
        console.assert(leaf.anchor < points.length - 1);
        const anchorPosition = points[leaf.anchor + 1];

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
  }, [ allLeaves, allPoints, count ]);

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
  
  const branches = useScene().branches;

  // Extract bud data from state so that we rebuild vertex data only if these changes
  const allBuds: Bud[][] = useArrayMemo(() => {
    return branches.map(branch => branch.buds)
  }, [ branches ]);

  const allPoints: Vector[][] = useArrayMemo(
    () => branches.map(getAllPhytomerPositions),
    [ branches ]
  );

  console.assert(allBuds.length == allPoints.length);

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
    for (let branchIndex = 0; branchIndex < allBuds.length; branchIndex++) {
      const buds = allBuds[branchIndex];
      const points = allPoints[branchIndex];
      for (let budIndex = 0; budIndex < buds.length; budIndex++) {
        const bud = buds[budIndex];
        const anchorPosition = points[bud.anchor + 1];

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
  }, [ allBuds, allPoints, count ]);

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
  
  const branches = useScene().branches;

  const allPoints: Vector[][] = useArrayMemo(
    () => branches.map(getAllPhytomerPositions),
    [ branches ]
  );

  const count: number = allPoints.reduce((acc, points) => acc + points.length, 0);

  // TODO: Avoid rebuilding the whole mesh when only a bud's position changes
  
  useEffect(() => {
    console.log("Rebuild node matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();

    let instanceIndex = 0;
    for (const points of allPoints) {
      for (const nodePosition of points) {
        position.set(...nodePosition);
        mat.setPosition(position);
        meshRef.current.setMatrixAt(instanceIndex, mat);
        ++instanceIndex;
      }
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ allPoints, count ]);

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
  
  const branches = useScene().branches;

  const allEndPoints: Vector[] = useArrayMemo(() => {
    return branches.map(branch => getPhytomerPosition(branch.phytomers[branch.phytomers.length - 1]))
  }, [ branches ]);

  const count: number = allEndPoints.length;

  // TODO: Avoid rebuilding the whole mesh when only a bud's position changes
  
  useEffect(() => {
    console.log("Rebuild meristem matrices");

    // Set positions
    const mat = new Matrix4();
    const position = new Vector3();

    let instanceIndex = 0;
    for (const point of allEndPoints) {
      position.set(...point);
      mat.setPosition(position);
      meshRef.current.setMatrixAt(instanceIndex, mat);
      ++instanceIndex;
    }
    // Update the instance
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [ allEndPoints, count ]);

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

  const branches = useScene().branches;

  // Extract points from state so that we rebuild vertex data only if these changes
  const branchDrawInfo = useArrayMemo(() => {
    return branches.map(branch => ({
      points: getAllPhytomerPositions(branch),
      selected: lineColor == LineColor.Active ? branch.active : true, // TODO: expose in viewport state
    }))
  }, [ branches, lineColor ]);

  // Rebuild vertex data if the plant model changed
  const [ vertices, colors, indices ] = useMemo(() => {
    console.log("Rebuild vertex data");

    let pointCount = 0;
    for (const branch of branchDrawInfo) {
      pointCount += branch.points.length;
    }

    const vertices = new Float32Array(3 * pointCount);
    const colors = new Float32Array(3 * pointCount);
    const indices = new Uint32Array(pointCount + branchDrawInfo.length);

    let pointOffset = 0;
    let indexOffset = 0;
    for (const branch of branchDrawInfo) {
      for (const pt of branch.points) {
        vertices[3 * pointOffset + 0] = pt[0];
        vertices[3 * pointOffset + 1] = pt[1];
        vertices[3 * pointOffset + 2] = pt[2];
        if (branch.selected) {
          colors[3 * pointOffset + 0] = 1.0;
          colors[3 * pointOffset + 1] = 0.25;
          colors[3 * pointOffset + 2] = 0.0;
        } else {
          colors[3 * pointOffset + 0] = 0.0;
          colors[3 * pointOffset + 1] = 0.5;
          colors[3 * pointOffset + 2] = 1.0;
        }
        indices[indexOffset] = pointOffset;
        ++indexOffset;
        ++pointOffset;
      }
      indices[indexOffset] = 0xffffffff;
      ++indexOffset;
    }

    return [ vertices, colors, indices ];
  }, [ branchDrawInfo ]);

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
    <line_
      geometry={geometry}
    >
      <lineBasicMaterial vertexColors={true} />
    </line_>
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
