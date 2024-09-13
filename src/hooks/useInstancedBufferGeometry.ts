import { useEffect, useMemo } from 'react'
import {
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
} from 'three'

import useFreezer from './useFreezer.ts'

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

  // An attribute provides either 1 value per vertex or 1 value per instance
  isInstanceAttribute?: boolean,

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
export default function useInstancedBufferGeometry(
  attribtueDefs: InstancedBufferGeometryAttributeDefinition[],
  instanceCount: number,
  context: string,
) {
  // We do not directly depend on 'attribtueDefs' because is not supposed to
  // change, except for the updateData callbacks.
  const initialAttribtueDefs = useFreezer(attribtueDefs);

  const immutableAttributes = useMemo(() => (
    initialAttribtueDefs
    .filter(isImmutable)
    .map(def => ({
      def,
      attr: (
        def.isInstanceAttribute
        ? new InstancedBufferAttribute(def.data, def.components)
        : new Float32BufferAttribute(def.data, def.components)
      ),
    }))
  ), [ initialAttribtueDefs ]);

  // Create data and three attribute for mutable attributes
  type MutableInstancedBufferGeometryAttribute = {
    def: MutableInstancedBufferGeometryAttributeDefinition,
    attr: InstancedBufferAttribute
  };
  const mutableAttributes: MutableInstancedBufferGeometryAttribute[] = useMemo(() => (
    initialAttribtueDefs
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
  ), [ initialAttribtueDefs, instanceCount ]);

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

  }, [ instanceCount, immutableAttributes, mutableAttributes, context ]);

  // NB: It is important to directly look at 'attribtueDefs' rather than the
  // copy of 'def' memoized in 'initialAttribtueDefs' because we need to detect
  // whether updateData changed. However, the loop itself must be on the
  // memoised defs to statically ensure that useEffect hooks are always
  // called, and in the same order.
  const attrCount = initialAttribtueDefs.length;
  let mutableAttrIdx = 0;
  for (let attrIdx = 0 ; attrIdx < attrCount ; ++attrIdx) {

    const def = initialAttribtueDefs[attrIdx];
    const newDef = attribtueDefs[attrIdx];

    if (!isMutable(def)) continue;

    // If this fails, it means the order of attributeDefs changed compared to
    // previous call.
    console.assert(isMutable(newDef));
    console.assert(newDef.name === def.name);

    // NB: In order to ensure statically that despite being in a loop the
    // useEffect hooks are always called in the same order we accoutn for the
    // case were updateData is undefined.
    const updateData = isMutable(newDef) ? newDef.updateData : null;

    const { attr } = mutableAttributes[mutableAttrIdx];

    ++mutableAttrIdx;

    // Update attribute data if needed
    // We deactivate the rule stating that useEffect must not be called in a
    // loop because we know for sure that our loop is static here.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {

      if (updateData === null) return;

      const dataAsFloat32 = new Float32Array(
        attr.array.buffer,
        attr.array.byteOffset,
        attr.count * def.components,
      );
      attr.needsUpdate = true;

      updateData(dataAsFloat32);

    }, [ updateData, def, attr ])

  }

  return geometry;
}
