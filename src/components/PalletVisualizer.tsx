// @ts-nocheck
import { Canvas } from '@react-three/fiber'
import '@react-three/fiber'
import { OrbitControls, Grid, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor } from '@react-three/drei'
import { useMemo, useState } from 'react'
import * as THREE from 'three'
import type { LayerPattern } from '../types'

const SCALE = 10 // cm -> world units (100cm -> 10 units)
const GAP = 0.12
const CASE_H = 1.1
const PALLET_H = 0.4

// Shared geometries/materials for perf – reuse instead of creating per mesh
const caseGeometryCache = new Map<string, THREE.BoxGeometry>()
function getCaseGeometry(w: number, d: number) {
  const key = `${w.toFixed(2)}x${d.toFixed(2)}`
  if (!caseGeometryCache.has(key)) {
    caseGeometryCache.set(key, new THREE.BoxGeometry(w - 0.04, CASE_H - 0.04, d - 0.04))
  }
  return caseGeometryCache.get(key)!
}

// Compute case positions for a single layer
function getCasePositions(
  casesPerLayer: number,
  palletWidth: number,
  palletLength: number,
  rotate90: boolean,
): { x: number; z: number; w: number; d: number }[] {
  const pw = palletWidth / SCALE
  const pl = palletLength / SCALE

  if (casesPerLayer === 11) {
    const cw = 2.25
    const cd = 2.75
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
    return base.map((p) => {
      const rx = -p.z
      const rz = p.x
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

  const cols = Math.ceil(Math.sqrt(casesPerLayer))
  const rows = Math.ceil(casesPerLayer / cols)
  const cw = (pw - GAP * (cols + 1)) / cols
  const cd = (pl - GAP * (rows + 1)) / rows
  const caseW = Math.min(cw, cd, 2.8)
  const caseD = caseW

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

// Optimized pallet – single mesh, no shadows, no edges
function Pallet({ width, length, y = 0 }: { width: number; length: number; y?: number }) {
  const w = width / SCALE
  const d = length / SCALE
  const h = PALLET_H
  return (
    <group position={[0, y, 0]}>
      <mesh position={[0, -h / 2, 0]}>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.9} />
      </mesh>
      {/* subtle top plank – cheap, no extra draw call for edges */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#A67C52" roughness={0.95} />
      </mesh>
    </group>
  )
}

// Cheap per-case mesh – 11 meshes without edges/shadows is still fast enough for 66 cases
// meshLambert is ~2x cheaper than meshStandard
function CaseBoxLight({
  x,
  z,
  y,
  w,
  d,
  color,
}: {
  x: number
  z: number
  y: number
  w: number
  d: number
  color: string
}) {
  const geom = getCaseGeometry(w, d)
  return (
    <mesh position={[x, y, z]} geometry={geom}>
      <meshLambertMaterial color={color} />
    </mesh>
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
  return (
    <group position={[offsetX, 0, 0]}>
      <Pallet width={palletWidth} length={palletLength} y={0} />
      {layerPatterns.map((pattern, layerIdx) => {
        const isAlternate = pattern === 'Alternate'
        const positions = getCasePositions(casesPerLayer, palletWidth, palletLength, isAlternate)
        const y = PALLET_H / 2 + CASE_H / 2 + layerIdx * CASE_H + 0.02
        const shiftX = pattern === 'Interlocked' ? 0.35 : 0
        const colorA = pattern === 'Column' ? '#60a5fa' : pattern === 'Alternate' ? '#fbbf24' : '#34d399'
        const colorB = pattern === 'Column' ? '#3b82f6' : pattern === 'Alternate' ? '#f59e0b' : '#10b981'
        return (
          <group key={layerIdx}>
            {positions.map((p, i) => (
              <CaseBoxLight
                key={`${layerIdx}-${i}`}
                x={p.x + shiftX}
                z={p.z}
                y={y}
                w={p.w}
                d={p.d}
                color={i % 2 === 0 ? colorA : colorB}
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
  onPerfDecline,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  maxPalletStack: number
  onPerfDecline: (dpr: number) => void
}) {
  const pw = palletWidth / SCALE
  const gapBetweenPallets = 2
  const totalWidth = maxPalletStack * pw + (maxPalletStack - 1) * gapBetweenPallets
  const startX = -totalWidth / 2 + pw / 2

  return (
    <>
      <PerformanceMonitor onDecline={() => onPerfDecline(0.6)} onIncline={() => onPerfDecline(1)} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 16, 8]} intensity={0.9} />
      {/* No shadow, no environment HDR – huge perf win */}
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
      {/* Lightweight grid – static, no fade shader */}
      <Grid
        position={[0, -0.21, 0]}
        args={[30, 30]}
        cellSize={1}
        cellThickness={0.4}
        cellColor="#2a2a30"
        sectionSize={5}
        sectionColor="#3a3a44"
        fadeDistance={20}
        fadeStrength={0.6}
        infiniteGrid={false}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        minDistance={6}
        maxDistance={36}
        maxPolarAngle={Math.PI / 2.05}
        target={[0, 2.2, 0]}
      />
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
  const camX = 14 + Math.max(0, maxPalletStack - 1) * 2
  const [dpr, setDpr] = useState(1.2)

  return (
    <div className="w-full h-full bg-[#0a0a0d]">
      <Canvas
        frameloop="demand"
        dpr={dpr}
        camera={{ position: [camX, 10, 15], fov: 42 }}
        gl={{
          antialias: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
          alpha: false,
        }}
        onCreated={({ gl }) => {
          // @ts-ignore
          gl.toneMapping = THREE.NoToneMapping
        }}
        performance={{ min: 0.5 }}
      >
        <color attach="background" args={['#0a0a0d']} />
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Scene
          palletWidth={palletWidth}
          palletLength={palletLength}
          casesPerLayer={casesPerLayer}
          layerPatterns={layerPatterns}
          maxPalletStack={maxPalletStack}
          onPerfDecline={setDpr}
        />
      </Canvas>
    </div>
  )
}
