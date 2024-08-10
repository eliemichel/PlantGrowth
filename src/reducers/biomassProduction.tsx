import { getBranchesFromPlant } from './growth.tsx'
import {
  SimulationModel,
  Plant,
} from '../models/SimulationModel.tsx'

//////////////////
// Eco-Physiology
// TODO: Find a nice way to statically check physical units

/**
 * Compute the Leaf Area Index, that is the cumulated leaf surface divided by
 * the area of their ground shadow.
 * NB: This should take into account overlapping neighbor plants
 * https://greenlab.cirad.fr/GLUVED/html/P1_Prelim/EPhysio/Physio_light_002.html
 * 
 * TODO: Make this depend on a light direction
 */
function computeLeafAreaIndex(model: SimulationModel, plant: Plant): number {
  // Collect all branches of this
  const plantBranches = getBranchesFromPlant(model, plant);

  // TODO: weight leaf area by its dot product with the direction of interest
  const totalLeafArea = plantBranches.reduce((acc, branch) => {
    for (const leaf of branch.leaves) {
      // TODO: Adapt surface formula to leaf type
      acc += leaf.size * leaf.size;
    }
    return acc;
  }, 0);

  // TODO: Use rasterization from the light direction to estimate this.
  const plantShadowArea = 1.0;

  return totalLeafArea / plantShadowArea;
}

function computeDryBiomassWeight(model: SimulationModel, plant: Plant): number {
  // Collect all branches of this
  const plantBranches = getBranchesFromPlant(model, plant);

  // TODO: weight leaf area by its dot product with the direction of interest
  const biomass = plantBranches.reduce((acc, branch) => {
    for (const leaf of branch.leaves) {
      // TODO: Adapt surface formula to leaf type
      acc += leaf.size * leaf.size;
    }
    // TODO: adapt to length and radios
    acc += branch.points.length;
    return acc;
  }, 0);

  return biomass;
}

/**
 * Use the Beer-Lambert law to estimate the amount of light that is captured,
 * given a leaf area index.
 */
function computeLightInterception(lai: number): number {
  // TODO: Move to model
  const extinctionCoefficient = 0.6; // from 0.5 to 0.9
  const canopyReflection = 0.1; // in range (0,1)

  const k = extinctionCoefficient;
  const p = canopyReflection;
  const absorption = (1.0 - p) * (1.0 - Math.exp(-k * lai));
  return absorption;
}

/**
 * Returns the Photosynthetically active radiation (PAR) at a given position in space.
 * TODO: Make this depend on the environment and position.
 */
function computeIrradianceAboveCanopy(): number {
  return 1.0;
}

function computePhotosynthesis(absorbedLight: number): number {
  // TODO: Move to model
  const lightUseEfficiency = 0.8;
  return lightUseEfficiency * absorbedLight;
}

/**
 * https://greenlab.cirad.fr/GLUVED/html/P1_Prelim/EPhysio/Physio_photo_004.html
 */
function computeMaintainanceCost(dryBiomassWeight: number): number {
  // TODO: Move to model
  // Reference maintainance coefficient at 25°C
  const coef25 = 0.015; // in range (0.01,0.02)
  // Evolution of the coef every 10°C
  const q10 = 2.0;

  // TODO: get from environment
  const T = 20; // in Celcius

  const coef = coef25 * Math.pow(q10, (T - 25) / 10.0);
  const maintainanceCost = coef * dryBiomassWeight;
  return maintainanceCost;
}

/**
 * NB: The returned value can be negative in case of deficit of light
 * https://greenlab.cirad.fr/GLUVED/html/P1_Prelim/EPhysio/Physio_photo_002.html
 */
function computeDryMassProduction(photosynthesisEnergy: number, maintainanceCost: number): number {
  // TODO: Plug into integrator
  const deltaTime = 0.1;
  // TODO: Move to model
  // This depends on the chemical composition; it stands for the costs of
  // converting sugars into fats, organic acids, etc.
  // Typical values 0.35 for oil-rich seeds, 0.6 for leaves and stem,
  // up to 0.8 for the root of sugar beet.
  const growthConversionEfficiency = 0.6;

  const Pg = photosynthesisEnergy;
  const Rm = maintainanceCost;
  const Yg = growthConversionEfficiency;
  const deltaBiomass = deltaTime * Yg * (Pg - Rm);
  return deltaBiomass;
}

type BiomassPartitioning = {
  stems: number,
  leaves: number,
  // TODO: Add flowers, fruits, etc.
}

function computeBiomassPartitioning(dryMassProduction: number): BiomassPartitioning {
  // TODO: Move to model
  const leafRatio = 0.3;

  return {
    leaves: leafRatio * dryMassProduction,
    stems: (1.0 - leafRatio) * dryMassProduction,
  }
}

/**
 * This is a sketch of how biomass production works. This works at the scale of
 * a plant.
 */
export function computeBiomassProduction(model: SimulationModel, plant: Plant): BiomassPartitioning {
  const lai = computeLeafAreaIndex(model, plant);
  const par = computeIrradianceAboveCanopy();
  const absorbedLight = par * computeLightInterception(lai);
  const photosynthesisEnergy = computePhotosynthesis(absorbedLight);
  const dryBiomassWeight = computeDryBiomassWeight(model, plant);
  const maintainanceCost = computeMaintainanceCost(dryBiomassWeight);
  const dryMassProduction = computeDryMassProduction(photosynthesisEnergy, maintainanceCost);
  const dryMassPerOrgan = computeBiomassPartitioning(dryMassProduction);
  return dryMassPerOrgan;
}
