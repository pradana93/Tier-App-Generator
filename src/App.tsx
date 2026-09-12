import { useEffect } from 'react'
import { PalletVisualizer } from './components/PalletVisualizer'
import { Sidebar } from './components/Sidebar'
import { SpecPanel } from './components/SpecPanel'
import { useAppStore } from './store/useAppStore'

function App() {
  const init = useAppStore((s) => s.init)
  const initialized = useAppStore((s) => s.initialized)
  const loading = useAppStore((s) => s.loading)
  const error = useAppStore((s) => s.error)
  const selectedProfile = useAppStore((s) => s.selectedProfile)()

  useEffect(() => {
    init()
  }, [init])

  if (!initialized && loading) {
    return (
      <div className="min-h-screen bg-[#0f0f12] flex flex-col items-center justify-center font-mono gap-3">
        <div className="w-8 h-8 border-2 border-[#2a2a30] border-t-[#f59e0b] rounded-full animate-spin" />
        <p className="text-zinc-400 text-sm">Loading warehouse DB...</p>
        <p className="text-zinc-600 text-xs">Initializing sql.js + IndexedDB</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f12] flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-[#2a2a30] bg-[#151519] flex items-center px-6 justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shrink-0" />
            <p className="text-sm font-mono text-zinc-300 truncate">
              {selectedProfile ? selectedProfile.itemName : 'No profile selected'}
            </p>
            <span className="hidden md:inline text-xs font-mono text-zinc-600">· Industrial Tier Generator</span>
          </div>
          {selectedProfile && (
            <span className="text-xs font-mono bg-[#252529] border border-[#333] px-2.5 py-1 rounded text-zinc-300 shrink-0">
              {selectedProfile.totalCasesPerPallet * selectedProfile.maxPalletStack} cases in stack
              {selectedProfile.maxPalletStack > 3 && <span className="text-red-400 ml-2">⚠ Safety</span>}
            </span>
          )}
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative bg-[#0a0a0d]">
            {selectedProfile ? (
              <>
                <PalletVisualizer
                  palletWidth={selectedProfile.palletWidth}
                  palletLength={selectedProfile.palletLength}
                  casesPerLayer={selectedProfile.casesPerLayer}
                  layerPatterns={selectedProfile.layerPatterns}
                  maxPalletStack={selectedProfile.maxPalletStack}
                />
                {/* Spec Panel overlay – matches reference image in monospace */}
                <div className="absolute bottom-4 left-4 max-w-[360px] z-10">
                  <SpecPanel profile={selectedProfile} />
                </div>
                {selectedProfile.maxPalletStack > 3 && (
                  <div className="absolute top-4 left-4 bg-red-950/80 border border-red-700 text-red-200 text-xs font-mono px-3 py-2 rounded">
                    ⚠ Safety: stack height {selectedProfile.maxPalletStack} exceeds recommended limit (3)
                  </div>
                )}
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center font-mono text-zinc-600">No profile selected</div>
            )}
          </div>

          {/* Spec Panel side (persistent) + metrics */}
          <div className="w-[340px] border-l border-[#2a2a30] bg-[#121214] p-4 overflow-y-auto">
            {selectedProfile ? (
              <>
                <SpecPanel profile={selectedProfile} />
                <div className="mt-4 bg-[#1e1e22] border border-[#333] rounded-lg p-3 font-mono text-xs">
                  <div className="text-zinc-400">Footprint Height</div>
                  <div className="text-white text-lg font-bold">
                    {(selectedProfile.totalLayersHigh * 1.1 + 0.4).toFixed(1)} units
                  </div>
                  <div className="text-zinc-500 mt-1 text-[10px]">Pallet 0.4 + {selectedProfile.totalLayersHigh}×1.1 case height</div>
                  <div className="mt-2 pt-2 border-t border-[#333] text-zinc-400">
                    Total in Stack:{' '}
                    <span className="text-[#f59e0b] font-bold">
                      {selectedProfile.totalCasesPerPallet * selectedProfile.maxPalletStack} Cases
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm font-mono text-zinc-600">Select a profile to view spec</p>
            )}
            {error && <div className="mt-4 p-3 bg-red-950/40 border border-red-800 text-red-300 text-xs font-mono rounded">{error}</div>}
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
