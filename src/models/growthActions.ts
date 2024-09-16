/**
 * This file defines types for all the possible primary and secondary actions
 * that can occur in a growth process modeled by behavior.ts.
 */

import { type Vector } from '../utils/vector.ts'
import {
  type GrowthModel,
  type MeristemState,
  type DifferentiationState,
} from './GrowthModel.ts'

/**
 * A vector expressed as a frame + coordinates within that frame
 * 
 * The 'world' frame is the fixed global frame?
 * 
 * The 'growth' frame is the local frame of the phytomer. Z axis gives the
 * apical direction, Y axis is the epitonic direction (as upwards as possible),
 * X axis is the horizontal (amphitonic) direction such that XYZ is a valid
 * direct frame.
 */
export type RelativeVector = {
  frame: "growth" | "world",
  coords: Vector,
}

/**
 * When moving from one state to another one, a meristem may trigger
 * zero, one or more organogenesis actions.
 */
export type MeristemAction =
  | CreateLeafAction
  | CreateBudAction
  | CreateStemAction
  | ReplaceStemAction

/**
 * Add a new leaf at the meristem position.
 * This stops the current phytomer and starts a new one after the leaf, using
 * the same meristem.
 */
export type CreateLeafAction = {
  type: 'create-leaf',

  // Direction towards which the tip of the leaf points
  direction?: RelativeVector,

  // Direction towards which the leaf normal must point as much as possible,
  // while respecting the direction constraint.
  normal?: RelativeVector,
}

/**
 * Add a new bud at the meristem position.
 * This stops the current phytomer and starts a new one after the bud, using
 * the same meristem.
 */
export type CreateBudAction = {
  type: 'create-bud',

  // Direction towards which the tip of the bud points
  direction?: RelativeVector,
}

/**
 * Add a new stem with its own new meristem at the meristem position.
 * This stops the current phytomer and starts 2 new one, namely one with the
 * same meristem.in the continuity of the current phytomer and one for the new
 * stem. The continuation stem inherits stem differentiation, so if this needs
 * to change one may combine this action with the 'replace-stem' one.
 */
export type CreateStemAction = {
  type: 'create-stem',

  // Thickness of the new stem
  thickness: number,

  // Type/color of the new stem
  stemType: keyof GrowthModel['stemColors'],

  // Differentiation state of the new stem
  differentiation: DifferentiationState,

  // Meristem state of the new stem
  meristemState: MeristemState,

  // Direction in which the new stem points
  direction?: RelativeVector,
}

/**
 * Change the stem differentiation state. Since the meristem cannot change
 * existing stem cells, when the current phytomer has non-zero length this
 * stops the current phytomer and starts a new one with the new differentiation
 * state.
 */
export type ReplaceStemAction = {
  type: 'replace-stem',

  // New thickness of the current stem
  thickness: number,

  // New type/color of the current stem
  stemType: keyof GrowthModel['stemColors'],

  // New differentiation state of the current stem
  differentiation: DifferentiationState,
}

export function createDefaultMeristemActions(): MeristemAction[] {
  return []
}

/**
 * When moving from one state to another one as the result of secondary growth,
 * a phytomer may trigger zero, one or more growth actions.
 */
export type SecondaryGrowthAction =
  // Turn the stem into a more rigid one, and make bark appear
  | { type: 'grow-lignin' }
  // Increase the phytomer's thickness by the provided amount
  | { type: 'grow-thickness', increment: number }

export function createDefaultSecondaryGrowthActions(): SecondaryGrowthAction[] {
  return []
}
