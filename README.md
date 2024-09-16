Plant Growth
============

This is an experimental FSPM (Functional-Structural Plant Model) in JavaScript, more specifically in React + Three.js.

Technical challenges
--------------------

### Huge hierarchy

When seen through the lense of traditional computer graphics and game engines, a plant is a huge hierarchy, where each phytomer is a different node hierarchy. This hierarchy's transforms are sometimes changed everywhere at once, like when the plant grows, which requires efficient hierarchy update from trunk to leaves.

### Immutable Graph Structure

The redux/zustand-style state management based on immutable structures is very powerful, but representing DAGs in this context is challenging due to the need for references. We developped the Collection data structure to help with this.

### Domain Specific Languages

Various parts of a plant's behavior are defined as **expressions** that can define many different ways of connecting e.g., a growth rate, to a meristem's state and environment. The evolution of meristem and phytomer's differentiation state are also governed by generic user-provided logic defined as **transducers**.

In both cases, we need multiple representations of the same object. Let us consider expressions:

 - An expression can be **compiled** into a lower-level built-in language (e.g., JavaScript, GLSL, or even WASM?), or directly **evaluated**, although this is slower.

 - An expression can be **edited** through various **delegates**. A typical one is a node-based interface. Another example is the array-based syntax inspired by MapBox. In both cases, the delegate representation has **more degrees of freedom** than the dry expression object (for intance, nodes have spatial locations in a node graph, although it does not impact the end expression).

The edition makes it hard to figure out where the source of truth stand, expecially if multiple delegates may modify the same expression. And even if there is a single delegate, we ideally avoid having the UI element serve truth to the underlying model. In practice, the actions provided by the store ensure to jointly edit the expression and its node graph delegate.

This is fine, but a proper solution (needed to have multiple delegates) would be to have the UI send diffs rather than setting a whole new state. All of the the raw expression, the node graph and the array-based representation would be able to consume and emit such diffs. This is partly the case already with the way editing node values only update the relevant node in the raw expression tree.

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
