Naming
------

 - Something called "Model" comes with a reducer that provides advanced update logic and defautl values.
 - Something called "State" is a simple data container; its defautl value is defined in the same file and there is no reducer (it is meant to be used with `useState`.
 - Something called neither "Model" nor "State" is just different, but it still defines data structures if it lives in this directory/

Frames
------

Multiple coordinate systems are needed to describe a plant:

 - The **World** frame is the simplest one, it is the fixed global frame.
 - The **Phytomer** frame is the Frenet/Darbout frame that parameterize a branch at a given node (a.k.a. phytomer). The branch model stores a transform matrix for each phytomer, which converts coordinates local to the phytomer into world coordinates.
 - The **Growth** frame is built on the fly. Its Z direction goes along the branch (apical). The Y direction is the epitonic direction, i.e., the most vertical orthogonal to the apical Z direction (or a random one if Z is perfectly up). The X direction is one of the two horizontal (amphitonic) directions such that XYZ is a valid direct frame.
