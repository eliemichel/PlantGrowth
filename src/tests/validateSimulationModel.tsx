import { SceneModel } from '../models/SceneModel.tsx'

export function validateSceneModel(model: SceneModel): boolean {
	// TODO: Check that BranchRef are valid
	// TODO: Check that LocalNodeRef are valid
	// TODO: Check that a branch is not shared by multiple plants (is it worth using refs in the end?)
	// TODO: Check that branches' cached growth model index is consistent with their parent plant
	// TODO: Check that references point to the right collection
	return model.phytomers != null;
}
