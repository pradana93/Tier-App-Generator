// @ts-nocheck
import { Canvas } from '@react-three/fiber'
import '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import * as THREE from 'three'
import type { LayerPattern } from '../types'

const SCALE = 100 // mm -> world units
const GAP = 0.12
const CASE_H = 1.1
const PALLET_H = 0.4

// Compute case positions for a single layer
// For 11-case, use 4-4-3 grid. For generic n, use cols/rows grid.
function getCasePositions(
  casesPerLayer: number,
  palletWidth: number,
  palletLength: number,
  rotate90: boolean,
): { x: number; z: number; w: number; d: number }[] {
  const pw = palletWidth / SCALE
  const pl = palletLength / SCALE

  // Special 11-case layout – tuned for 1000x1200
  if (casesPerLayer === 11) {
    const cw = 2.25
    const cd = 2.75
    // 4-4-3 base positions (centered)
    const base: { x: number; z: number }[] = []
    const rowZ = [-3.6, 0, 3.6]
    const rowCols = [4, 4, 3]
    rowZ.forEach((z, ri) => {
      const cols = rowCols[ri]
      const totalW = cols * cw + (cols - 1) * GAP
      const startX = -totalW / 2 + cw / 2
      for (let c = 0; c < cols; c++) {
        const x = startX + c * (cw + GAP)
        base.push({ x, z })
      }
    })
    if (!rotate90) {
      return base.map((p) => ({ x: p.x, z: p.z, w: cw, d: cd }))
    }
    // Alternate: rotate 90deg around center and re-fit
    // (x,z) -> (-z, x) and swap w/d
    // For 10x12 pallet, rotated layout still fits; clamp if needed
    return base.map((p) => {
      const rx = -p.z
      const rz = p.x
      // clamp to stay inside pallet (-pw/2+cw/2 .. pw/2-cw/2)
      const maxX = pw / 2 - cd / 2 - 0.05
      const maxZ = pl / 2 - cw / 2 - 0.05
      return {
        x: Math.max(-maxX, Math.min(maxX, rx)),
        z: Math.max(-maxZ, Math.min(maxZ, rz)),
        w: cd,
        d: cw,
      }
    })
  }

  // Generic grid for other counts
  const cols = Math.ceil(Math.sqrt(casesPerLayer))
  const rows = Math.ceil(casesPerLayer / cols)
  // Estimate case size to fill pallet with gaps
  const cw = (pw - GAP * (cols + 1)) / cols
  const cd = (pl - GAP * (rows + 1)) / rows
  const caseW = Math.min(cw, cd, 2.8)
  const caseD = caseW // square-ish fallback

  const positions: { x: number; z: number; w: number; d: number }[] = []
  for (let i = 0; i < casesPerLayer; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const totalW = cols * caseW + (cols - 1) * GAP
    const totalD = rows * caseD + (rows - 1) * GAP
    const startX = -totalW / 2 + caseW / 2
    const startZ = -totalD / 2 + caseD / 2
    let x = startX + c * (caseW + GAP)
    let z = startZ + r * (caseD + GAP)
    let w = caseW
    let d = caseD
    if (rotate90) {
      const rx = -z
      const rz = x
      x = rx
      z = rz
      w = caseD
      d = caseW
    }
    positions.push({ x, z, w, d })
  }
  return positions
}

function Pallet({ width, length, y = 0 }: { width: number; length: number; y?: number }) {
  const w = width / SCALE
  const d = length / SCALE
  const h = PALLET_H
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.85} />
      </mesh>
      <mesh position={[0, -h / 2 + 0.02, 0]}>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#A67C52" roughness={0.9} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#5C3A1E" />
      </lineSegments>
    </group>
  )
}

function CaseBox({
  x,
  z,
  y,
  w,
  d,
  pattern,
  idx,
}: {
  x: number
  z: number
  y: number
  w: number
  d: number
  pattern: LayerPattern
  idx: number
}) {
  const colors: Record<LayerPattern, string> = {
    Column: idx % 2 === 0 ? '#60a5fa' : '#3b82f6',
    Alternate: idx % 2 === 0 ? '#fbbf24' : '#f59e0b',
    Interlocked: idx % 2 === 0 ? '#34d399' : '#10b981',
  }
  const edge =
    pattern === 'Column' ? '#1e40af' : pattern === 'Alternate' ? '#92400e' : '#065f46'
  return (
    <group position={[x, y, z]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w - 0.04, CASE_H - 0.04, d - 0.04]} />
        <meshStandardMaterial color={colors[pattern]} roughness={0.55} metalness={0.08} />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w - 0.04, CASE_H - 0.04, d - 0.04)]} />
        <lineBasicMaterial color={edge} />
      </lineSegments>
    </group>
  )
}

function SinglePalletStack({
  palletWidth,
  palletLength,
  casesPerLayer,
  layerPatterns,
  offsetX = 0,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  offsetX?: number
}) {
  // Multi-pallet view: side-by-side via offsetX (Step 8)
  return (
    <group position={[offsetX, 0, 0]}>
      <Pallet width={palletWidth} length={palletLength} y={0} />
      {layerPatterns.map((pattern, layerIdx) => {
        const isAlternate = pattern === 'Alternate'
        // For Alternate, rotate layout 90deg relative to base. For Column, keep identical.
        // Interlocked: slight offset
        const positions = getCasePositions(casesPerLayer, palletWidth, palletLength, isAlternate)
        const y = PALLET_H / 2 + CASE_H / 2 + layerIdx * CASE_H + 0.02
        // Interlocked: shift every other row slightly
        const shiftX = pattern === 'Interlocked' ? 0.35 : 0
        return (
          <group key={layerIdx}>
            {positions.map((p, i) => (
              <CaseBox
                key={`${layerIdx}-${i}`}
                x={p.x + shiftX}
                z={p.z}
                y={y}
                w={p.w}
                d={p.d}
                pattern={pattern}
                idx={i}
              />
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Scene({
  palletWidth,
  palletLength,
  casesPerLayer,
  layerPatterns,
  maxPalletStack,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  maxPalletStack: number
}) {
  const pw = palletWidth / SCALE
  const gapBetweenPallets = 2 // world units between pallet groups
  const totalWidth = maxPalletStack * pw + (maxPalletStack - 1) * gapBetweenPallets
  const startX = -totalWidth / 2 + pw / 2

  return (
    <>
      <ambientLight intensity={0.72} />
      <directionalLight position={[12, 20, 10]} intensity={1.15} castShadow shadow-mapSize={2048} />
      <directionalLight position={[-10, 14, -8]} intensity={0.35} />
      {Array.from({ length: maxPalletStack }).map((_, i) => (
        <SinglePalletStack
          key={i}
          palletWidth={palletWidth}
          palletLength={palletLength}
          casesPerLayer={casesPerLayer}
          layerPatterns={layerPatterns}
          offsetX={startX + i * (pw + gapBetweenPallets)}
        />
      ))}
      <Grid
        position={[0, -0.21, 0]}
        args={[40, 40]}
        cellSize={1}
        cellThickness={0.55}
        cellColor="#2a2a30"
        sectionSize={5}
        sectionColor="#3a3a44"
        fadeDistance={35}
        fadeStrength={1}
      />
      <OrbitControls enableDamping dampingFactor={0.06} minDistance={6} maxDistance={42} maxPolarAngle={Math.PI / 2.05} target={[0, 2.2, 0]} />
      <Environment preset="warehouse" />
    </>
  )
}

export function PalletVisualizer({
  palletWidth,
  palletLength,
  casesPerLayer,
  layerPatterns,
  maxPalletStack = 1,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  maxPalletStack?: number
}) {
  // Camera adapts to stack width
  const camX = 14 + Math.max(0, maxPalletStack - 1) * 2
  return (
    <div className="w-full h-full bg-[#0a0a0d]">
      <Canvas shadows camera={{ position: [camX, 10, 15], fov: 42 }} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}>
        <color attach="background" args={['#0a0a0d']} />
        <Scene
          palletWidth={palletWidth}
          palletLength={palletLength}
          casesPerLayer={casesPerLayer}
          layerPatterns={layerPatterns}
          maxPalletStack={maxPalletStack}
        />
      </Canvas>
    </div>
  )
}
