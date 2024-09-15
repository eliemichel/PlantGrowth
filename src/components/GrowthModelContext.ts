import { createContext, useContext } from 'react'
import { type GrowthModel } from '../models/GrowthModel.ts'

// Provide the selected growth model and its index, only if one is selected
const GrowthModelContext = createContext<[GrowthModel,number]>(null!);
export default GrowthModelContext;
export const useGrowthModel = () => useContext(GrowthModelContext);
