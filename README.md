Plant Growth
============

This is an experimental FSPM (Functional-Structural Plant Model) in JavaScript, more specifically in React + Three.js.

Technical challenges
--------------------

### Huge hierarchy

When seen through the lense of traditional computer graphics and game engines, a plant is a huge hierarchy, where each phytomer is a different node hierarchy. This hierarchy's transforms are sometimes changed everywhere at once, like when the plant grows, which requires efficient hierarchy update from trunk to leaves.

Tech Stack
----------

In order to hack on this codebase, you'll likely need to have a look at the documentation of the following libraries:

 - [`zustand`](https://github.com/pmndrs/zustand) (state manegement)
 - [`immer`](https://immerjs.github.io/immer/) (immutable data structure update)
 - [`xyflow/react`](https://reactflow.dev/) (node graph)

TODO
----

- Store transform relative to parent rather than to World to avoid numerical issues
- After starting for a while without any state management library, we are transitionning progressively to [`zustand`](https://github.com/pmndrs/zustand)
