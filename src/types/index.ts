export type LayerPattern = 'Column' | 'Alternate' | 'Interlocked'

export interface StackingProfile {
  id: string
  itemName: string
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  totalLayersHigh: number
  layerPatterns: LayerPattern[]
  totalCasesPerPallet: number
  maxPalletStack: number
  createdAt: string
  updatedAt: string
}

export type NewStackingProfile = Omit<StackingProfile, 'id' | 'createdAt' | 'updatedAt' | 'totalCasesPerPallet'> & {
  id?: string
}

export function calcTotalCasesPerPallet(casesPerLayer: number, totalLayersHigh: number): number {
  return casesPerLayer * totalLayersHigh
}

export function validateProfile(p: Pick<StackingProfile, 'layerPatterns' | 'totalLayersHigh'>): string | null {
  if (p.layerPatterns.length !== p.totalLayersHigh) {
    return `LayerPatterns length (${p.layerPatterns.length}) must equal TotalLayersHigh (${p.totalLayersHigh})`
  }
  return null
}

export const LAYER_PATTERN_OPTIONS: LayerPattern[] = ['Column', 'Alternate', 'Interlocked']
