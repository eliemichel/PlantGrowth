import { test } from 'vitest'

import { validateScene } from './validateScene.ts'

import {
	createInitialScene,
	createTestScene,
} from '../models/SceneModel.ts'

test("Scene presets are valid", () => {
	validateScene(createInitialScene())
	validateScene(createTestScene(0))
	validateScene(createTestScene(1))
	validateScene(createTestScene(2))
})
