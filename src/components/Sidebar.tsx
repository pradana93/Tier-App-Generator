import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { ProfileForm } from './ProfileForm'

export function Sidebar() {
  const profiles = useAppStore((s) => s.profiles)
  const selectedId = useAppStore((s) => s.selectedId)
  const select = useAppStore((s) => s.select)
  const deleteProfile = useAppStore((s) => s.deleteProfile)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const editingProfile = editingId ? profiles.find((p) => p.id === editingId) ?? null : null

  return (
    <aside className="w-[320px] shrink-0 bg-[#1a1a1e] border-r border-[#2a2a30] flex flex-col h-full">
      <div className="p-5 border-b border-[#2a2a30]">
        <h1 className="text-xl font-black tracking-tight text-white leading-none">PALLET TIER</h1>
        <p className="text-xs tracking-[0.2em] text-[#f59e0b] font-mono mt-1">GENERATOR</p>
        <button
          onClick={() => setShowCreate(true)}
          className="mt-4 w-full bg-[#f59e0b] hover:bg-[#d97706] text-black font-bold py-2.5 px-4 rounded text-sm tracking-wide transition-colors"
        >
          + Add New Profile
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {profiles.length === 0 && (
          <p className="text-sm text-zinc-500 text-center py-10 font-mono">No profiles yet</p>
        )}
        {profiles.map((p) => (
          <div
            key={p.id}
            onClick={() => select(p.id)}
            className={`group p-3 rounded-lg border cursor-pointer transition-colors ${
              selectedId === p.id
                ? 'bg-[#252529] border-[#f59e0b]/50'
                : 'bg-[#202024] border-[#2a2a30] hover:border-zinc-600'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">{p.itemName}</p>
                <p className="text-xs font-mono text-zinc-400 mt-1">
                  {p.casesPerLayer} × {p.totalLayersHigh} = {p.totalCasesPerPallet} cases
                </p>
                <p className="text-xs font-mono text-zinc-500">
                  {p.palletWidth}×{p.palletLength}mm · Stack {p.maxPalletStack}
                </p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {p.layerPatterns.map((pat, i) => (
                    <span
                      key={i}
                      className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                        pat === 'Column'
                          ? 'bg-sky-900/50 text-sky-300 border border-sky-700'
                          : pat === 'Alternate'
                            ? 'bg-amber-900/50 text-amber-300 border border-amber-700'
                            : 'bg-emerald-900/50 text-emerald-300 border border-emerald-700'
                      }`}
                    >
                      L{i + 1}:{pat.slice(0, 3)}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEditingId(p.id)
                  }}
                  className="text-xs bg-zinc-700 hover:bg-zinc-600 text-white px-2 py-1 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (confirm(`Delete "${p.itemName}"?`)) deleteProfile(p.id)
                  }}
                  className="text-xs bg-red-900/50 hover:bg-red-800 text-red-300 px-2 py-1 rounded border border-red-800"
                >
                  Del
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="p-3 border-t border-[#2a2a30] text-[10px] font-mono text-zinc-600 text-center">
        Local-First · sql.js + IndexedDB
      </div>

      {(showCreate || editingProfile) && (
        <ProfileForm
          initial={editingProfile ?? undefined}
          onClose={() => {
            setShowCreate(false)
            setEditingId(null)
          }}
        />
      )}
    </aside>
  )
}
