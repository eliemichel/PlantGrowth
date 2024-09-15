import { useEffect, useMemo } from 'react'
import {
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Uint32BufferAttribute,
} from 'three'

import useFreezer from './useFreezer.ts'

type AttributeDefinition =
  | MutableAttributeDefinition
  | ImmutableAttributeDefinition

type AttributeDefinitionCommon = {
  // Name as used in shaders
  name: string,

  // Number of (float) components
  components: number,

  // An attribute provides either 1 value per vertex or 1 value per instance
  perInstance?: boolean,
}

// NB: Mutable attributes are always per-instance
type MutableAttributeDefinition = AttributeDefinitionCommon & {
  mutable: true,

  // Update the 'data' array in place. Use useCallback to make sure that the
  // callback object is rebuilt only when needed because we rely on this to
  // know when to update GPU buffers.
  updateData: (data: Float32Array) => void,
}

type ImmutableAttributeDefinition = AttributeDefinitionCommon & {
  mutable: false,

  // Immutable attributes have their data directly available
  data: Float32Array,
}

// Special cases for the index attribute
type IndexAttributeDefinition =
  | MutableIndexAttributeDefinition
  | ImmutableIndexAttributeDefinition

type MutableIndexAttributeDefinition = {
  mutable: true,
  updateIndexData: (data: Uint32Array) => void,
}

type ImmutableIndexAttributeDefinition = {
  mutable: false,
  indexData: Uint32Array,
}

type Attribute<Def extends AttributeDefinition> = {
  def: Def,
  attr: InstancedBufferAttribute
};

type MutableAttribute = Attribute<MutableAttributeDefinition>;

function isMutable(def: AttributeDefinition): def is MutableAttributeDefinition {
  return def.mutable;
}

function isImmutable(def: AttributeDefinition): def is ImmutableAttributeDefinition {
  return !def.mutable;
}

function isPerInstance(def: AttributeDefinition): def is AttributeDefinition & { perInstance: true } {
  return def.perInstance === true;
}

function isPerVertex(def: AttributeDefinition): def is AttributeDefinition & { perInstance: false } {
  return def.perInstance !== true;
}

// TODO: How to factorize all the Index things with the rest?
function isMutableIndex(def: IndexAttributeDefinition): def is MutableIndexAttributeDefinition {
  return def.mutable;
}

/**
 * Create the attribute that matches a definition, for a known element count
 * (either vertices or instances).
 */
function allocateAttribute<Def extends AttributeDefinition>(def: Def, count: number): Attribute<Def> {
  const attrData = new Float32Array(count * def.components);
  // TODO: Should we use Float32BufferAttribute in case of per-vertex attribute?
  const attr = new InstancedBufferAttribute(attrData, def.components);
  return {
    def,
    attr,
  }
}

/**
 * Custom hook that defines a geometry object and its attributes, making sure
 * to update only what's needed when data changes. For instance, the geometry
 * is rebuilt only if the number of elements changes, otherwise we only update
 * its attributes.
 * 
 * The geometry is indexed if indexCount is defined. The vertex count is not
 * needed when position is an immutable attribute.
 * 
 * Important: The attribute definitions should not change, only 'updateData'
 * may be updated. In particular changing the attribute count would mess up
 * with the number of hooks invoked.
 *
 * TODO: There might be a way to express this whole mechanism through
 * three-fiber's declarative JSX.
 */
export default function useInstancedBufferGeometry(
  attributeDefs: AttributeDefinition[],
  indexDef: IndexAttributeDefinition | null,
  counts: {
    instanceCount: number,
    vertexCount?: number,
    indexCount?: number,
  },
  context: string,
) {
  // We do not directly depend on 'attributeDefs' because is not supposed to
  // change, except for the updateData callbacks.
  const initialAttribtueDefs = useFreezer(attributeDefs);
  const initialIndexDef = useFreezer(indexDef);
  const {
    instanceCount,
    indexCount,
    vertexCount,
  } = counts;

  const immutableAttributes = useMemo(() => (
    initialAttribtueDefs
    .filter(isImmutable)
    .map(def => ({
      def,
      attr: (
        def.perInstance
        ? new InstancedBufferAttribute(def.data, def.components)
        : new Float32BufferAttribute(def.data, def.components)
      ),
    }))
  ), [ initialAttribtueDefs ]);

  // Create data and three attribute for mutable attributes
  const mutableInstanceAttributes: MutableAttribute[] = useMemo(() => (
    initialAttribtueDefs
    .filter(isMutable)
    .filter(isPerInstance)
    .map(def => allocateAttribute(def, instanceCount))
  ), [ initialAttribtueDefs, instanceCount ]);

  const mutableVertexAttributes: MutableAttribute[] = useMemo(() => (
    initialAttribtueDefs
    .filter(isMutable)
    .filter(isPerVertex)
    .map(def => allocateAttribute(def, vertexCount ?? 0))
  ), [ initialAttribtueDefs, vertexCount ]);

  // TODO: Use index data right away if index attribute is immutable
  const indexAttribute = useMemo(() => {
    if (initialIndexDef === null) return null;
    if (isMutableIndex(initialIndexDef)) {
      if (indexCount === undefined) {
        console.warn("Index data is mutable, but no index count was given. This is probably an error.");
        return null;
      } else {
        return new Uint32BufferAttribute(new Uint32Array(indexCount), 1);
      }
    } else {
      return new Uint32BufferAttribute(initialIndexDef.indexData, 1);
    }
  }, [ indexCount, initialIndexDef ])

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
    for (const { def, attr } of mutableInstanceAttributes) {
      geometry.setAttribute(def.name, attr);
    }
    for (const { def, attr } of mutableVertexAttributes) {
      geometry.setAttribute(def.name, attr);
    }

    if (indexAttribute !== null) {
      geometry.setIndex(indexAttribute);
      geometry.setDrawRange(0, indexAttribute.count);
    }

    return geometry;

  }, [ instanceCount, immutableAttributes, mutableInstanceAttributes, mutableVertexAttributes, indexAttribute, context ]);

  // NB: It is important to directly look at 'attributeDefs' rather than the
  // copy of 'def' memoized in 'initialAttribtueDefs' because we need to detect
  // whether updateData changed. However, the loop itself must be on the
  // memoised defs to statically ensure that useEffect hooks are always
  // called, and in the same order.
  const attrCount = initialAttribtueDefs.length;
  let mutableInstanceAttrIdx = 0;
  let mutableVertexAttrIdx = 0;
  for (let attrIdx = 0 ; attrIdx < attrCount ; ++attrIdx) {

    const def = initialAttribtueDefs[attrIdx];
    const newDef = attributeDefs[attrIdx];

    if (!isMutable(def)) continue;

    // If this fails, it means the order of attributeDefs changed compared to
    // previous call.
    console.assert(isMutable(newDef));
    console.assert(newDef.name === def.name);
    console.assert(isPerInstance(newDef) == isPerInstance(def));

    // NB: In order to ensure statically that despite being in a loop the
    // useEffect hooks are always called in the same order we accoutn for the
    // case were updateData is undefined.
    const updateData = isMutable(newDef) ? newDef.updateData : null;

    const { attr, def: attrDef } = (
      isPerInstance(def)
      ? mutableInstanceAttributes[mutableInstanceAttrIdx]
      : mutableVertexAttributes[mutableVertexAttrIdx]
    );

    // Sanity check
    console.assert(isPerInstance(attrDef) == isPerInstance(def));

    if (isPerInstance(def)) ++mutableInstanceAttrIdx;
    else ++mutableVertexAttrIdx;

    // Debug info
    const description = (
      isPerInstance(def)
      ? `${instanceCount} instances`
      : `${vertexCount} vertices`
    );

    // Update attribute data if needed
    // We deactivate the rule stating that useEffect must not be called in a
    // loop because we know for sure that our loop is static here.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {

      if (updateData === null) return;

      console.log(`UPDATING data for attr ${context}.${def.name} (${description})`);

      const dataAsFloat32 = new Float32Array(
        attr.array.buffer,
        attr.array.byteOffset,
        attr.count * def.components,
      );
      attr.needsUpdate = true;

      updateData(dataAsFloat32);

    }, [ updateData, def, attr, context, description ])

  }

  // Same for index attribute
  const updateIndexData = (
    indexDef !== null && isMutableIndex(indexDef)
    ? indexDef.updateIndexData
    : null
  )

  useEffect(() => {

    if (updateIndexData === null || indexAttribute === null) return;

    console.log(`UPDATING index data for ${context}`);

    const dataAsUint32 = new Uint32Array(
      indexAttribute.array.buffer,
      indexAttribute.array.byteOffset,
      indexAttribute.count,
    );
    indexAttribute.needsUpdate = true;

    updateIndexData(dataAsUint32);

  }, [ indexCount, indexAttribute, updateIndexData, context ])

  return geometry;
}
