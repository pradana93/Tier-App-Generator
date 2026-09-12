# Warehouse Pallet Tier Generator

Industrial dark-mode web app for warehouse operators to calculate and visualize how to stack cases on pallets.

- **Stacking profiles CRUD** persisted locally with `sql.js` (SQLite WASM) → IndexedDB
- **3D Engine:** Three.js via `@react-three/fiber` + `@react-three/drei` with `OrbitControls`
- **State:** Zustand wired to `IProfileRepository` (repository pattern)
- **Layout:** Sidebar (profiles) + 3D Canvas + Spec Panel overlay

## Quick Start

```bash
npm install
npm run dev
# build
npm run build
```

## Reference Profile (Seed)

Seeded automatically on first load if DB is empty:

```
SUSUNAN PER PALLET
Per Layer         : 11 Cases
High              : 3 Layer/Alternately
Layer 1-2         : Column
Layer 3           : Alternate
Total             : 33 Cases
Maksimum Tumpukan : 2 Pallet
```

- Pallet 100×120cm, case layout uses 4-4-3 bounded grid; Alternate layer rotates 90°.

## Project Structure

```
src/
  db/
    IProfileRepository.ts       # interface (swap without UI changes)
    LocalSQLiteRepository.ts    # sql.js + IndexedDB persistence
    seed.ts                     # reference profile
  types/index.ts
  store/useAppStore.ts          # Zustand store injected with repo
  components/
    Sidebar.tsx
    ProfileForm.tsx
    SpecPanel.tsx
    PalletVisualizer.tsx
    ErrorBoundary.tsx
```

## Stacking Logic

- `CASE_H=1.1, PALLET_H=0.4, GAP=0.12` (world units; `SCALE=10` for cm→units)
- `getCasePositions(casesPerLayer, palletW, palletL, rotate90)`:
  - 11 → explicit 4-4-3 grid: row Z = [-3.6,0,3.6], cols [4,4,3], case 2.25×2.75
  - Alternate → `(x,z)->(-z,x)` and `w/d` swap, clamped to pallet bounds
  - Generic `n` → `cols=ceil(sqrt(n)), rows=ceil(n/cols)` grid
- `SinglePalletStack` renders `layerPatterns[i]` per layer; `maxPalletStack` renders pallets side-by-side with gap 2.

## Interactive 3D Editing (A & C)

- **Case drag:** `DragControls` axisLock `y` (XZ plane) on each `CaseBoxLight` `src/components/PalletVisualizer.tsx:118`. Snap `0.25`, clamp to `pw/2-w/2`, collision AABB `dx<w-0.15 && dz<d-0.15`, orbit disabled while dragging, `frameloop="demand"` + `invalidate()`. Off-pallet drop (>1.2 outside) → `onRemoveCase` → `casesPerLayer-1`. On drag end → `onLayoutChange(layerIdx, newPositions)` → `App.tsx:32` `updateProfile({customLayouts})`.
- **Pallet resize:** orange handles at `+X` / `+Z` edges `PalletResizeHandles` `src/components/PalletVisualizer.tsx:156`, drag X/Z → `onPalletResize(w,l)` → `App.tsx:45` `updateProfile({palletWidth,palletLength})` 40–200cm clamp.
- **Palette add/remove:** top overlay `+ Add Case` `src/components/PalletVisualizer.tsx:268` → `casesPerLayer+1`, drag-off to remove. `customLayouts` stores per-layer `CasePos[][]` `src/types/index.ts:5`, persisted via `customLayouts TEXT` JSON in `LocalSQLiteRepository.ts:142` (auto-migrated via `PRAGMA table_info`). `src/store/useAppStore.ts:43` migrates mm→cm and handles `customLayouts`.
- **Perf:** `frameloop="demand"`, `dpr` adaptive, `antialias false`, `meshLambert` + shared `BoxGeometry` cache, no shadows/HDR, `AdaptiveDpr`/`AdaptiveEvents` + `PerformanceMonitor`.

## Migrating to Supabase

Swap `LocalSQLiteRepository` with a future `SupabaseRepository` — **zero UI / store changes** required.

### 1. Install Supabase client

```bash
npm install @supabase/supabase-js
```

### 2. Create `src/db/SupabaseRepository.ts`

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { IProfileRepository } from './IProfileRepository'
import type { StackingProfile } from '../types'

export class SupabaseRepository implements IProfileRepository {
  private supabase: SupabaseClient
  constructor() {
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL!,
      import.meta.env.VITE_SUPABASE_ANON_KEY!,
    )
  }
  async init(): Promise<void> { /* Supabase needs no init – ensure table exists */ }
  async getAll(): Promise<StackingProfile[]> {
    const { data, error } = await this.supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    return data.map(row => ({
      id: row.id,
      itemName: row.item_name,
      palletWidth: row.pallet_width,
      palletLength: row.pallet_length,
      casesPerLayer: row.cases_per_layer,
      totalLayersHigh: row.total_layers_high,
      layerPatterns: row.layer_patterns as StackingProfile['layerPatterns'],
      totalCasesPerPallet: row.total_cases_per_pallet,
      maxPalletStack: row.max_pallet_stack,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }))
  }
  async getById(id: string) { /* similar select eq('id', id) */ return null as any }
  async create(profile: StackingProfile) {
    const { error } = await this.supabase.from('profiles').insert({
      id: profile.id,
      item_name: profile.itemName,
      pallet_width: profile.palletWidth,
      pallet_length: profile.palletLength,
      cases_per_layer: profile.casesPerLayer,
      total_layers_high: profile.totalLayersHigh,
      layer_patterns: profile.layerPatterns,
      total_cases_per_pallet: profile.totalCasesPerPallet,
      max_pallet_stack: profile.maxPalletStack,
    })
    if (error) throw error
    return profile
  }
  async update(id: string, patch: Partial<StackingProfile>) { /* .update().eq('id', id) */ return patch as any }
  async delete(id: string) { await this.supabase.from('profiles').delete().eq('id', id) }
  async clear() { await this.supabase.from('profiles').delete().neq('id', '') }
}
```

### 3. Create table in Supabase SQL Editor

```sql
create table public.profiles (
  id text primary key,
  item_name text not null,
  pallet_width integer not null default 100,
  pallet_length integer not null default 120,
  cases_per_layer integer not null,
  total_layers_high integer not null,
  layer_patterns jsonb not null,
  total_cases_per_pallet integer not null,
  max_pallet_stack integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint layer_patterns_length_check check (jsonb_array_length(layer_patterns) = total_layers_high)
);
alter table public.profiles enable row level security;
create policy "Allow all for anon" on public.profiles for all using (true) with check (true);
create index idx_profiles_item_name on public.profiles(item_name);
```

For production, replace the open policy with authenticated RLS as needed.

### 4. Swap instantiation in Zustand store

`src/store/useAppStore.ts:27`

```ts
// before
import { localRepo } from '../db/LocalSQLiteRepository'
export const useAppStore = create<AppState>((set, get) => ({
  repo: localRepo,
// after
import { SupabaseRepository } from '../db/SupabaseRepository'
export const useAppStore = create<AppState>((set, get) => ({
  repo: new SupabaseRepository(),
```

No other files need changes — the store and UI only depend on `IProfileRepository`.

### 5. Environment

Copy `.env.example` → `.env` and fill:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

`.env` is gitignored. Do not commit secrets.

## Validation

- `LayerPatterns.length === TotalLayersHigh` (enforced in repository + form + type helper)
- `TotalCasesPerPallet = CasesPerLayer * TotalLayersHigh`; flagged warning if `MaxPalletStack > 3`

## License

MIT
