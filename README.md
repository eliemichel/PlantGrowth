Plant Growth
============

This is an experimental FSPM (Functional-Structural Plant Model) in JavaScript, more specifically in React + Three.js.

Technical challenges
--------------------

### Huge hierarchy

When seen through the lense of traditional computer graphics and game engines, a plant is a huge hierarchy, where each phytomer is a different node hierarchy. This hierarchy's transforms are sometimes changed everywhere at once, like when the plant grows, which requires efficient hierarchy update from trunk to leaves.
