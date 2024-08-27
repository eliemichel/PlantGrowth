// ---------------- Structures ----------------

/**
 * Index within Collection<T>['items']
 * 
 * Do NOT manually create/modify such a ref, but rather use createRef as this
 * enables keeping track of all refs and make sure to update their raw internal
 * index whenever there is a deletion/insertion.
 * 
 * NB: ItemReference is not a class in order to keep it lightweight (no call to
 * "new") -> is that really worth it?
 */
export type ItemReference<T> = {
  // Collection that the item refers to
  collection: Collection<T>,

  // Current index of the element that is referenced.
  // The special value "-1" is used to represent an invalid reference.
  index: number,
}

/**
 * A collection is an array with a smart reference mechanism.
 */
export class Collection<T> {
  // The actual data
  items: T[] = [];

  // Pool of references
  references: Set<ItemReference<T>> = new Set<ItemReference<T>>();

  // ---------------- Methods ----------------

  constructor(items?: T[]) {
    if (items !== undefined) {
      this.items = items;
    }
  }

  /**
   * Create an ItemReference from the current index of an item.
   * This smart ref gets automatically updated in case of insertion/deletion.
   * If the provided index does not correspond to an existing item, this returns
   * an invalid reference (i.e., ref.index is -1).
   * Pass a negative index to refer to elements wrt. the end of the collection
   * 
   * IMPORTANT: Call releaseRef whenever you are done with it to avoid
   * accumulating many index objects.
   */
  createRef(index: number) {
    if (index < 0) index += this.items.length; // allow negative indexing from the end
    const isValid = Number.isInteger(index) && index >= 0 && index < this.items.length;
    const ref: ItemReference<T> = {
      collection: this,
      index: isValid ? index : -1,
    };
    if (isValid) {
      this.references.add(ref);
    }
    return ref;
  };

  /**
   * Use this to create an invalid reference (rather than calling createRef
   * because this would create a reference to the latest item).
   */
  createInvalidRef() {
    return {
      collection: this,
      index: -1,
    };
  };

  /**
   * Syntactic sugar to access item by reference.
   * NB: This assumes that the index is valid
   */
  at(ref: ItemReference<T>) {
    //return isValidRef(ref) ? this.items[ref.index] : undefined;
    return this.items[ref.index];
  }

  /**
   * Add one or more new items at the end of the collection
   */
  append(...newItems: T[]) {
    this.items.push(...newItems);
  }

  /**
   * Remove an item by index
   */
  removeAt(removedIndex: number) {
    console.assert(Number.isInteger(removedIndex));

    // Update items
    this.items = this.items.filter((_, index) => index !== removedIndex)

    // Update references
    const toDelete: ItemReference<T>[] = [];
    for (const ref of this.references) {
      if (ref.index === removedIndex) {
        ref.index = -1;
        toDelete.push(ref)
      } else if (ref.index > removedIndex) {
        --ref.index;
      }
    }

    for (const ref of toDelete) {
      this.references.delete(ref);
    }

  }

  /**
   * Insert an item before one with a given index. If the index is the
   * collection's length, this is equivalent to append.
   */
  insertBefore(index: number, item: T) {
    console.assert(Number.isInteger(index));

    if (index == this.items.length) {
      return this.append(item);
    }

    if (index < 0 || index > this.items.length) {
      return;
    }

    // Update items
    this.items = [
      ...this.items.slice(0, index),
      item,
      ...this.items.slice(index),
    ]

    // Update references
    for (const ref of this.references) {
      if (ref.index >= index) {
        ++ref.index;
      }
    }

  }

  /**
   * Create a new collection where items are transformed from this using 'fn'
   */
  map<U>(fn: (item: T, index: number) => U): Collection<U> {
    return new Collection(this.items.map(fn));
  }

  /**
   * This is a bit like map except that it also update all references in place
   * and leaves the previous collection empty
   * NB: This only works if the target type remains the same
   */
  transform(fn: (item: T, index: number) => T): Collection<U> {
    const transformed = new Collection(this.items.map(fn));
    
    for (const ref of this.references) {
      ref.collection = transformed;
    }
    transformed.references = this.references;

    // Clear
    this.items.length = 0;
    this.references = new Set();

    return transformed;
  }

  /**
   * Create a new array where items are transformed from this using 'fn'
   */
  mapToArray<U>(fn: (item: T, index: number) => U): U[] {
    return this.items.map(fn);
  }

  /**
   * Merge a collection at the end of this, updating all indices of the merged
   * collection. The merged collection must no longer be used and is thus
   * emptied.
   */
  merge(other: Collection<T>) {
    // Merge items
    const indexOffset = this.items.length;
    this.items.push(...other.items);
    other.items.length = 0; // clear

    // Merge references
    for (const ref of other.references) {
      ref.collection = this;
      ref.index += indexOffset;
      this.references.add(ref);
    }
    other.references.clear();
  }
}

export function isValidRef<T>(reference: ItemReference<T>) {
  return reference.index !== -1;
}

/**
 * Dereference a reference, i.e., access the underlying value
 */
export function deref<T>(reference: ItemReference<T>): T | undefined {
  return (
    reference.index !== -1
    ? reference.collection.at(reference)
    : undefined
  )
}

/**
 * Call this when you will no longer use the reference. This turns the
 * reference into an invalid one.
 */
export function releaseRef<T>(reference: ItemReference<T>) {
  if (reference.index !== -1) {
    reference.collection.references.delete(reference);
    reference.index = -1;
  }
}
