import type { StackingProfile } from '../types'

/**
 * Repository Pattern – abstract interface for profile persistence.
 * UI and Zustand store depend only on this interface.
 * Swap LocalSQLiteRepository <-> SupabaseRepository with zero UI changes.
 */
export interface IProfileRepository {
  init(): Promise<void>
  getAll(): Promise<StackingProfile[]>
  getById(id: string): Promise<StackingProfile | null>
  create(profile: StackingProfile): Promise<StackingProfile>
  update(id: string, patch: Partial<StackingProfile>): Promise<StackingProfile>
  delete(id: string): Promise<void>
  clear(): Promise<void>
}
