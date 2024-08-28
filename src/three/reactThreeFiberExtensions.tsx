// Fix described in https://github.com/pmndrs/react-three-fiber/discussions/1387

import { Line } from 'three'
import { ReactThreeFiber, extend } from '@react-three/fiber'

import LeafMaterial from './LeafMaterial.ts'
import PhytomerMaterial from './PhytomerMaterial.ts'

// 1. Extend react three fiber
extend({
  Line_: Line,
  LeafMaterial,
  PhytomerMaterial,
})

// 2. Extend associated type
declare global {
  namespace JSX {
    interface IntrinsicElements {
      line_: ReactThreeFiber.Object3DNode<Line, typeof Line>,
      leafMaterial: ReactThreeFiber.Object3DNode<LeafMaterial, typeof LeafMaterial>,
      phytomerMaterial: ReactThreeFiber.Object3DNode<PhytomerMaterial, typeof PhytomerMaterial>,
    }
  }
}
