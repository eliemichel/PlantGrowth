// Fix described in https://github.com/pmndrs/react-three-fiber/discussions/1387

import { Line } from 'three'
import { ReactThreeFiber, extend } from '@react-three/fiber'

extend({ Line_: Line })

declare global {
  namespace JSX {
    interface IntrinsicElements {
      line_: ReactThreeFiber.Object3DNode<Line, typeof Line>
    }
  }
}
