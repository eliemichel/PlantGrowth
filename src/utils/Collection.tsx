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
   * an invalid reference (i.e., index is -1).
   * 
   * IMPORTANT: Call releaseRef whenever you are done with it to avoid
   * accumulating many index objects.
   */
  createRef(index: number) {
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
   * Add a new item at the end of the collection
   */
  append(item: T) {
    this.items.push(item);
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
