import type { StackingProfile } from '../types'

export const REFERENCE_PROFILE: Omit<StackingProfile, 'createdAt' | 'updatedAt'> = {
  id: '00000000-0000-4000-a000-000000000001',
  itemName: 'Sample Item — 11 Cases / Layer',
  palletWidth: 100,
  palletLength: 120,
  casesPerLayer: 11,
  totalLayersHigh: 3,
  layerPatterns: ['Column', 'Column', 'Alternate'],
  totalCasesPerPallet: 33,
  maxPalletStack: 2,
}

export async function seedIfEmpty(repo: import('./IProfileRepository').IProfileRepository): Promise<void> {
  const existing = await repo.getAll()
  if (existing.length > 0) return
  const now = new Date().toISOString()
  const profile: StackingProfile = {
    ...REFERENCE_PROFILE,
    createdAt: now,
    updatedAt: now,
  }
  await repo.create(profile)
}
