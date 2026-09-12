import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import type { LayerPattern, StackingProfile } from '../types'
import { LAYER_PATTERN_OPTIONS } from '../types'

interface Props {
  initial?: StackingProfile
  onClose: () => void
}

export function ProfileForm({ initial, onClose }: Props) {
  const createProfile = useAppStore((s) => s.createProfile)
  const updateProfile = useAppStore((s) => s.updateProfile)
  const isEdit = !!initial

  const [itemName, setItemName] = useState(initial?.itemName ?? '')
  const [palletWidth, setPalletWidth] = useState(initial?.palletWidth ?? 100)
  const [palletLength, setPalletLength] = useState(initial?.palletLength ?? 120)
  const [casesPerLayer, setCasesPerLayer] = useState(initial?.casesPerLayer ?? 11)
  const [totalLayersHigh, setTotalLayersHigh] = useState(initial?.totalLayersHigh ?? 3)
  const [maxPalletStack, setMaxPalletStack] = useState(initial?.maxPalletStack ?? 2)
  const [layerPatterns, setLayerPatterns] = useState<LayerPattern[]>(
    initial?.layerPatterns ?? ['Column', 'Column', 'Alternate'],
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // keep layerPatterns length in sync with totalLayersHigh
  function handleLayersChange(n: number) {
    setTotalLayersHigh(n)
    setLayerPatterns((prev) => {
      if (prev.length === n) return prev
      if (prev.length < n) {
        return [...prev, ...Array(n - prev.length).fill('Column' as LayerPattern)]
      }
      return prev.slice(0, n)
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!itemName.trim()) return setError('ItemName is required')
    if (layerPatterns.length !== totalLayersHigh) {
      return setError(`LayerPatterns must have ${totalLayersHigh} entries`)
    }
    setSaving(true)
    try {
      if (isEdit && initial) {
        await updateProfile(initial.id, {
          itemName: itemName.trim(),
          palletWidth,
          palletLength,
          casesPerLayer,
          totalLayersHigh,
          layerPatterns,
          maxPalletStack,
          totalCasesPerPallet: casesPerLayer * totalLayersHigh,
        })
      } else {
        await createProfile({
          itemName: itemName.trim(),
          palletWidth,
          palletLength,
          casesPerLayer,
          totalLayersHigh,
          layerPatterns,
          maxPalletStack,
        })
      }
      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-[#1c1c1f] border border-[#2a2a30] rounded-xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        <div className="p-6 border-b border-[#2a2a30] flex justify-between items-center">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Profile' : 'New Stacking Profile'}</h2>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-950/50 border border-red-800 text-red-300 text-sm p-3 rounded font-mono">{error}</div>
          )}

          <label className="block">
            <span className="text-xs font-mono tracking-widest text-zinc-400">ITEM NAME</span>
            <input
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Sample Item — 11 Cases / Layer"
              className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white placeholder-zinc-600 focus:border-[#f59e0b] focus:outline-none"
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-mono tracking-widest text-zinc-400">PALLET WIDTH (cm)</span>
              <input
                type="number"
                value={palletWidth}
                onChange={(e) => setPalletWidth(Number(e.target.value))}
                className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white focus:border-[#f59e0b] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-mono tracking-widest text-zinc-400">PALLET LENGTH (cm)</span>
              <input
                type="number"
                value={palletLength}
                onChange={(e) => setPalletLength(Number(e.target.value))}
                className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white focus:border-[#f59e0b] focus:outline-none"
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="text-xs font-mono tracking-widest text-zinc-400">CASES / LAYER</span>
              <input
                type="number"
                min={1}
                value={casesPerLayer}
                onChange={(e) => setCasesPerLayer(Number(e.target.value))}
                className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white focus:border-[#f59e0b] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-mono tracking-widest text-zinc-400">LAYERS HIGH</span>
              <input
                type="number"
                min={1}
                max={20}
                value={totalLayersHigh}
                onChange={(e) => handleLayersChange(Number(e.target.value))}
                className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white focus:border-[#f59e0b] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-xs font-mono tracking-widest text-zinc-400">MAX STACK</span>
              <input
                type="number"
                min={1}
                max={10}
                value={maxPalletStack}
                onChange={(e) => setMaxPalletStack(Number(e.target.value))}
                className="mt-1 w-full bg-[#252529] border border-[#333] rounded px-3 py-2.5 text-white focus:border-[#f59e0b] focus:outline-none"
              />
            </label>
          </div>

          <div>
            <span className="text-xs font-mono tracking-widest text-zinc-400">LAYER PATTERNS</span>
            <p className="text-[10px] font-mono text-zinc-500 mt-1">Must equal TotalLayersHigh ({totalLayersHigh})</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {layerPatterns.map((pat, idx) => (
                <label key={idx} className="flex items-center gap-2 bg-[#252529] border border-[#333] rounded px-3 py-2">
                  <span className="text-xs font-mono text-zinc-400 w-12">L {idx + 1}</span>
                  <select
                    value={pat}
                    onChange={(e) => {
                      const v = e.target.value as LayerPattern
                      setLayerPatterns((prev) => prev.map((p, i) => (i === idx ? v : p)))
                    }}
                    className="flex-1 bg-[#1a1a1e] border border-[#333] rounded px-2 py-1.5 text-sm text-white"
                  >
                    {LAYER_PATTERN_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-[#252529] border border-[#333] rounded p-3 font-mono text-xs text-zinc-400">
            <div>Total per Pallet: <span className="text-white font-bold">{casesPerLayer * totalLayersHigh} Cases</span></div>
            <div>Total in Stack: <span className="text-[#f59e0b] font-bold">{casesPerLayer * totalLayersHigh * maxPalletStack} Cases</span></div>
          </div>
        </div>

        <div className="p-6 border-t border-[#2a2a30] flex gap-3 justify-end">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded border border-[#333] text-zinc-300 hover:bg-[#252529] text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 rounded bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold text-sm disabled:opacity-50"
          >
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}
