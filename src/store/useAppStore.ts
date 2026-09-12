import { create } from 'zustand'
import type { IProfileRepository } from '../db/IProfileRepository'
import { localRepo } from '../db/LocalSQLiteRepository'
import { seedIfEmpty } from '../db/seed'
import { calcTotalCasesPerPallet, type StackingProfile } from '../types'

interface AppState {
  repo: IProfileRepository
  profiles: StackingProfile[]
  selectedId: string | null
  loading: boolean
  error: string | null
  initialized: boolean

  // selectors
  selectedProfile: () => StackingProfile | null

  // actions
  setRepo: (repo: IProfileRepository) => void
  init: () => Promise<void>
  fetchAll: () => Promise<void>
  select: (id: string | null) => void
  createProfile: (data: Omit<StackingProfile, 'id' | 'createdAt' | 'updatedAt' | 'totalCasesPerPallet'>) => Promise<StackingProfile>
  updateProfile: (id: string, patch: Partial<StackingProfile>) => Promise<void>
  deleteProfile: (id: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  repo: localRepo,
  profiles: [],
  selectedId: null,
  loading: false,
  error: null,
  initialized: false,

  selectedProfile: () => {
    const { profiles, selectedId } = get()
    return profiles.find((p) => p.id === selectedId) ?? null
  },

  setRepo: (repo) => set({ repo }),

  init: async () => {
    const { repo, initialized } = get()
    if (initialized) return
    set({ loading: true, error: null })
    try {
      await repo.init()
      await seedIfEmpty(repo)
      let profiles = await repo.getAll()
      // migrate mm -> cm for existing data (1000/1200 -> 100/120)
      for (const p of profiles) {
        if (p.palletWidth > 500 || p.palletLength > 500) {
          const nw = Math.round(p.palletWidth / 10)
          const nl = Math.round(p.palletLength / 10)
          try {
            await repo.update(p.id, { palletWidth: nw, palletLength: nl })
            p.palletWidth = nw
            p.palletLength = nl
          } catch {
            // ignore
          }
        }
      }
      // re-fetch if migrated to ensure consistency
      if (profiles.some((p) => p.palletWidth > 500 || p.palletLength > 500)) {
        profiles = await repo.getAll()
      }
      set({
        profiles,
        selectedId: profiles[0]?.id ?? null,
        initialized: true,
        loading: false,
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  fetchAll: async () => {
    const { repo } = get()
    set({ loading: true })
    try {
      let profiles = await repo.getAll()
      for (const p of profiles) {
        if (p.palletWidth > 500 || p.palletLength > 500) {
          const nw = Math.round(p.palletWidth / 10)
          const nl = Math.round(p.palletLength / 10)
          try {
            await repo.update(p.id, { palletWidth: nw, palletLength: nl })
            p.palletWidth = nw
            p.palletLength = nl
          } catch {}
        }
      }
      set({ profiles, loading: false })
      // keep selection valid
      const { selectedId } = get()
      if (selectedId && !profiles.find((p) => p.id === selectedId)) {
        set({ selectedId: profiles[0]?.id ?? null })
      }
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
    }
  },

  select: (id) => set({ selectedId: id }),

  createProfile: async (data) => {
    const { repo } = get()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    const profile: StackingProfile = {
      id,
      itemName: data.itemName,
      palletWidth: data.palletWidth,
      palletLength: data.palletLength,
      casesPerLayer: data.casesPerLayer,
      totalLayersHigh: data.totalLayersHigh,
      layerPatterns: data.layerPatterns,
      totalCasesPerPallet: calcTotalCasesPerPallet(data.casesPerLayer, data.totalLayersHigh),
      maxPalletStack: data.maxPalletStack,
      createdAt: now,
      updatedAt: now,
    }
    if (profile.layerPatterns.length !== profile.totalLayersHigh) {
      throw new Error(`LayerPatterns length (${profile.layerPatterns.length}) must equal TotalLayersHigh (${profile.totalLayersHigh})`)
    }
    set({ loading: true })
    try {
      const created = await repo.create(profile)
      set((s) => ({ profiles: [created, ...s.profiles], selectedId: created.id, loading: false }))
      return created
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  updateProfile: async (id, patch) => {
    const { repo } = get()
    set({ loading: true })
    try {
      const updated = await repo.update(id, patch)
      set((s) => ({
        profiles: s.profiles.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }))
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  deleteProfile: async (id) => {
    const { repo } = get()
    set({ loading: true })
    try {
      await repo.delete(id)
      set((s) => {
        const remaining = s.profiles.filter((p) => p.id !== id)
        return {
          profiles: remaining,
          selectedId: s.selectedId === id ? (remaining[0]?.id ?? null) : s.selectedId,
          loading: false,
        }
      })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },
}))
