import type { StackingProfile } from '../types'

function formatLayerPatterns(p: StackingProfile): string[] {
  // Group consecutive same patterns like "Layer 1-2 : Column"
  const lines: string[] = []
  let i = 0
  while (i < p.layerPatterns.length) {
    const pat = p.layerPatterns[i]
    let j = i
    while (j < p.layerPatterns.length && p.layerPatterns[j] === pat) j++
    if (j - i === 1) {
      lines.push(`Layer ${i + 1}         : ${pat}`)
    } else {
      lines.push(`Layer ${i + 1}-${j}       : ${pat}`)
    }
    i = j
  }
  return lines
}

export function SpecPanel({ profile }: { profile: StackingProfile }) {
  const totalStack = profile.totalCasesPerPallet * profile.maxPalletStack
  const layerLines = formatLayerPatterns(profile)
  // Determine High label: if all Column then Column else Alternately etc. For ref mimic: "3 Layer/Alternately"
  const hasAlternate = profile.layerPatterns.includes('Alternate')
  const hasInterlocked = profile.layerPatterns.includes('Interlocked')
  let highSuffix = 'Column'
  if (hasAlternate && hasInterlocked) highSuffix = 'Mixed'
  else if (hasAlternate) highSuffix = 'Alternately'
  else if (hasInterlocked) highSuffix = 'Interlocked'

  return (
    <div className="bg-[#1a1a1e] border border-[#2a2a30] rounded-lg p-4 font-mono text-[11px] leading-[1.7] tracking-wide shadow-xl">
      <div className="text-[#f59e0b] font-bold text-xs tracking-[0.15em] mb-2">SUSUNAN PER PALLET</div>
      <div className="space-y-0.5 text-zinc-300">
        <div>
          Per Layer <span className="text-zinc-500">:</span> <span className="text-white font-bold">{profile.casesPerLayer} Cases</span>
        </div>
        <div>
          High <span className="text-zinc-500">:</span> <span className="text-white">{profile.totalLayersHigh} Layer/{highSuffix}</span>
        </div>
        {layerLines.map((ln, idx) => (
          <div key={idx} className="text-zinc-300">
            {ln}
          </div>
        ))}
        <div>
          Total <span className="text-zinc-500">:</span> <span className="text-white font-bold">{profile.totalCasesPerPallet} Cases</span>
        </div>
        <div>
          Maksimum Tumpukan <span className="text-zinc-500">:</span> <span className="text-white font-bold">{profile.maxPalletStack} Pallet</span>
        </div>
        <div className="pt-2 mt-2 border-t border-[#2a2a30] text-zinc-500">
          Total in Stack: <span className="text-[#f59e0b] font-bold">{totalStack} Cases</span>
          {profile.maxPalletStack > 3 && <span className="ml-2 text-red-400">⚠ exceeds safety (max 3)</span>}
        </div>
        <div className="text-[10px] text-zinc-600">Pallet {profile.palletWidth}×{profile.palletLength}mm</div>
      </div>
    </div>
  )
}
