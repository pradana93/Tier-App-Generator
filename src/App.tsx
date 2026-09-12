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
      <div className="min-h-screen bg-[#0f0f12] flex items-center justify-center font-mono text-zinc-400">
        Loading warehouse DB...
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0f0f12] flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar placeholder for 3D status */}
        <div className="h-12 border-b border-[#2a2a30] bg-[#151519] flex items-center px-6 justify-between">
          <p className="text-sm font-mono text-zinc-400">
            {selectedProfile ? `${selectedProfile.itemName} — 3D preview upcoming` : 'No profile selected'}
          </p>
          {selectedProfile && (
            <span className="text-xs font-mono bg-[#252529] border border-[#333] px-2.5 py-1 rounded text-zinc-300">
              {selectedProfile.totalCasesPerPallet * selectedProfile.maxPalletStack} cases in stack
              {selectedProfile.maxPalletStack > 3 && <span className="text-red-400 ml-2">⚠ Safety limit</span>}
            </span>
          )}
        </div>

        <div className="flex-1 flex min-h-0">
          <div className="flex-1 relative bg-[#0a0a0d]">
            {selectedProfile ? (
              <PalletVisualizer
                palletWidth={selectedProfile.palletWidth}
                palletLength={selectedProfile.palletLength}
                casesPerLayer={selectedProfile.casesPerLayer}
                layerPatterns={selectedProfile.layerPatterns}
                maxPalletStack={selectedProfile.maxPalletStack}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-mono text-zinc-600">No profile selected</div>
            )}
          </div>

          {/* Spec Panel side */}
          <div className="w-[340px] border-l border-[#2a2a30] bg-[#121214] p-4 overflow-y-auto">
            {selectedProfile ? (
              <SpecPanel profile={selectedProfile} />
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
