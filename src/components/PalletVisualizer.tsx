// @ts-nocheck
import { Canvas, useThree } from '@react-three/fiber'
import '@react-three/fiber'
import { OrbitControls, Grid, AdaptiveDpr, AdaptiveEvents, PerformanceMonitor, DragControls } from '@react-three/drei'
import { useMemo, useState, useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { LayerPattern, CasePos } from '../types'

const SCALE = 10 // cm -> world units (100cm -> 10 units)
const GAP = 0.12
const CASE_H = 1.1
const PALLET_H = 0.4

const caseGeometryCache = new Map<string, THREE.BoxGeometry>()
function getCaseGeometry(w: number, d: number) {
  const key = `${w.toFixed(2)}x${d.toFixed(2)}`
  if (!caseGeometryCache.has(key)) {
    caseGeometryCache.set(key, new THREE.BoxGeometry(w - 0.04, CASE_H - 0.04, d - 0.04))
  }
  return caseGeometryCache.get(key)!
}

function getCasePositions(
  casesPerLayer: number,
  palletWidth: number,
  palletLength: number,
  rotate90: boolean,
): CasePos[] {
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
  const positions: CasePos[] = []
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

function snapToGrid(v: number, step: number) {
  return Math.round(v / step) * step
}

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
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#A67C52" roughness={0.95} />
      </mesh>
    </group>
  )
}

// Draggable case – uses DragControls, snaps to grid, checks bounds/collision
function DraggableCase({
  x,
  z,
  y,
  w,
  d,
  color,
  layerIdx,
  caseIdx,
  palletWidth,
  palletLength,
  otherPositions,
  onDragEnd,
  onRemove,
  setDragging,
}: {
  x: number
  z: number
  y: number
  w: number
  d: number
  color: string
  layerIdx: number
  caseIdx: number
  palletWidth: number
  palletLength: number
  otherPositions: CasePos[]
  onDragEnd: (layerIdx: number, caseIdx: number, nx: number, nz: number) => void
  onRemove: (layerIdx: number, caseIdx: number) => void
  setDragging: (v: boolean) => void
}) {
  const geom = getCaseGeometry(w, d)
  const pw = palletWidth / SCALE
  const pd = palletLength / SCALE
  const maxX = pw / 2 - w / 2 - 0.02
  const maxZ = pd / 2 - d / 2 - 0.02

  return (
    <DragControls
      axisLock="y"
      autoTransform
      onDragStart={() => setDragging(true)}
      onDragEnd={(e) => {
        setDragging(false)
        // e.object is the group being dragged
        const obj = (e as any).object as THREE.Object3D
        let nx = obj.position.x
        let nz = obj.position.z
        // snap to 0.25 step for warehouse grid feel
        nx = snapToGrid(nx, 0.25)
        nz = snapToGrid(nz, 0.25)
        // clamp inside pallet
        const clampedX = Math.max(-maxX, Math.min(maxX, nx))
        const clampedZ = Math.max(-maxZ, Math.min(maxZ, nz))
        // check off-pallet drag -> remove (dragged far outside)
        const distFromCenter = Math.sqrt(nx * nx + nz * nz)
        const palletRadius = Math.sqrt(maxX * maxX + maxZ * maxZ) + 1.5
        if (Math.abs(nx) > maxX + 1.2 || Math.abs(nz) > maxZ + 1.2 || distFromCenter > palletRadius) {
          onRemove(layerIdx, caseIdx)
          return
        }
        // collision check vs other cases in same layer
        const collides = otherPositions.some((p, i) => {
          if (i === caseIdx) return false
          const dx = Math.abs(clampedX - p.x)
          const dz = Math.abs(clampedZ - p.z)
          return dx < w - 0.15 && dz < d - 0.15
        })
        if (collides) {
          // revert – DragControls autoTransform will stay at collided pos, but we snap back by telling parent to reset
          // trigger invalidate to re-render at old pos
          obj.position.set(x, y, z)
          return
        }
        // apply snapped clamped
        obj.position.set(clampedX, y, clampedZ)
        onDragEnd(layerIdx, caseIdx, clampedX, clampedZ)
      }}
    >
      <mesh position={[x, y, z]} geometry={geom}>
        <meshLambertMaterial color={color} />
      </mesh>
    </DragControls>
  )
}

function PalletResizeHandles({
  palletWidth,
  palletLength,
  onResize,
  setDragging,
}: {
  palletWidth: number
  palletLength: number
  onResize: (w: number, l: number) => void
  setDragging: (v: boolean) => void
}) {
  const pw = palletWidth / SCALE
  const pd = palletLength / SCALE
  const handleSize = 0.35
  // X handle at +X edge, Z handle at +Z edge
  return (
    <>
      {/* Width handle – drag along X */}
      <DragControls axisLock="y" autoTransform={false} onDragStart={() => setDragging(true)} onDrag={(lm) => {
        const m = lm as unknown as THREE.Matrix4
        const pos = new THREE.Vector3().setFromMatrixPosition(m)
        // pos.x is new handle X, pallet width = pos.x*2*SCALE
        let newPw = pos.x * 2
        newPw = Math.max(4, Math.min(18, newPw)) // clamp 40cm..180cm
        onResize(Math.round(newPw * SCALE), palletLength)
      }} onDragEnd={() => setDragging(false)}>
        <mesh position={[pw / 2 + 0.25, 0.25, 0]}>
          <boxGeometry args={[handleSize, 0.6, 1.2]} />
          <meshStandardMaterial color="#f59e0b" emissive="#92400e" emissiveIntensity={0.4} />
        </mesh>
      </DragControls>
      {/* Length handle – drag along Z */}
      <DragControls axisLock="y" autoTransform={false} onDragStart={() => setDragging(true)} onDrag={(lm) => {
        const m = lm as unknown as THREE.Matrix4
        const pos = new THREE.Vector3().setFromMatrixPosition(m)
        let newPd = pos.z * 2
        newPd = Math.max(4, Math.min(18, newPd))
        onResize(palletWidth, Math.round(newPd * SCALE))
      }} onDragEnd={() => setDragging(false)}>
        <mesh position={[0, 0.25, pd / 2 + 0.25]}>
          <boxGeometry args={[1.2, 0.6, handleSize]} />
          <meshStandardMaterial color="#f59e0b" emissive="#92400e" emissiveIntensity={0.4} />
        </mesh>
      </DragControls>
    </>
  )
}

function SinglePalletStack({
  palletWidth,
  palletLength,
  casesPerLayer,
  layerPatterns,
  customLayouts,
  offsetX = 0,
  onLayoutChange,
  onPalletResize,
  setDragging,
  onRemoveCase,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  customLayouts?: CasePos[][] | null
  offsetX?: number
  onLayoutChange: (layerIdx: number, newPositions: CasePos[]) => void
  onPalletResize: (w: number, l: number) => void
  setDragging: (v: boolean) => void
  onRemoveCase: (layerIdx: number, caseIdx: number) => void
}) {
  return (
    <group position={[offsetX, 0, 0]}>
      <Pallet width={palletWidth} length={palletLength} y={0} />
      <PalletResizeHandles palletWidth={palletWidth} palletLength={palletLength} onResize={onPalletResize} setDragging={setDragging} />
      {layerPatterns.map((pattern, layerIdx) => {
        const isAlternate = pattern === 'Alternate'
        const basePositions = customLayouts?.[layerIdx] ?? getCasePositions(casesPerLayer, palletWidth, palletLength, isAlternate)
        // ensure length matches casesPerLayer – if custom has different length, fallback
        const positions = basePositions.length === casesPerLayer ? basePositions : getCasePositions(casesPerLayer, palletWidth, palletLength, isAlternate)
        const y = PALLET_H / 2 + CASE_H / 2 + layerIdx * CASE_H + 0.02
        const shiftX = pattern === 'Interlocked' ? 0.35 : 0
        const colorA = pattern === 'Column' ? '#60a5fa' : pattern === 'Alternate' ? '#fbbf24' : '#34d399'
        const colorB = pattern === 'Column' ? '#3b82f6' : pattern === 'Alternate' ? '#f59e0b' : '#10b981'
        return (
          <group key={layerIdx}>
            {positions.map((p, i) => (
              <DraggableCase
                key={`${layerIdx}-${i}`}
                x={p.x + shiftX}
                z={p.z}
                y={y}
                w={p.w}
                d={p.d}
                color={i % 2 === 0 ? colorA : colorB}
                layerIdx={layerIdx}
                caseIdx={i}
                palletWidth={palletWidth}
                palletLength={palletLength}
                otherPositions={positions}
                setDragging={setDragging}
                onRemove={onRemoveCase}
                onDragEnd={(li, ci, nx, nz) => {
                  const next = positions.map((pp, idx) => (idx === ci ? { ...pp, x: nx - shiftX, z: nz } : pp))
                  onLayoutChange(li, next)
                }}
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
  customLayouts,
  maxPalletStack,
  onPerfDecline,
  onLayoutChange,
  onPalletResize,
  onRemoveCase,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  customLayouts?: CasePos[][] | null
  maxPalletStack: number
  onPerfDecline: (dpr: number) => void
  onLayoutChange: (layerIdx: number, newPositions: CasePos[]) => void
  onPalletResize: (w: number, l: number) => void
  onRemoveCase: (layerIdx: number, caseIdx: number) => void
}) {
  const pw = palletWidth / SCALE
  const gapBetweenPallets = 2
  const totalWidth = maxPalletStack * pw + (maxPalletStack - 1) * gapBetweenPallets
  const startX = -totalWidth / 2 + pw / 2
  const [dragging, setDragging] = useState(false)

  return (
    <>
      <PerformanceMonitor onDecline={() => onPerfDecline(0.6)} onIncline={() => onPerfDecline(1)} />
      <ambientLight intensity={0.85} />
      <directionalLight position={[10, 16, 8]} intensity={0.9} />
      {Array.from({ length: maxPalletStack }).map((_, i) => (
        <SinglePalletStack
          key={i}
          palletWidth={palletWidth}
          palletLength={palletLength}
          casesPerLayer={casesPerLayer}
          layerPatterns={layerPatterns}
          customLayouts={customLayouts}
          offsetX={startX + i * (pw + gapBetweenPallets)}
          onLayoutChange={onLayoutChange}
          onPalletResize={onPalletResize}
          setDragging={setDragging}
          onRemoveCase={onRemoveCase}
        />
      ))}
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
        enabled={!dragging}
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
  customLayouts,
  maxPalletStack = 1,
  onLayoutChange,
  onPalletResize,
  onAddCase,
  onRemoveCase,
}: {
  palletWidth: number
  palletLength: number
  casesPerLayer: number
  layerPatterns: LayerPattern[]
  customLayouts?: CasePos[][] | null
  maxPalletStack?: number
  onLayoutChange?: (layerIdx: number, newPositions: CasePos[]) => void
  onPalletResize?: (w: number, l: number) => void
  onAddCase?: () => void
  onRemoveCase?: (layerIdx: number, caseIdx: number) => void
}) {
  const camX = 14 + Math.max(0, maxPalletStack - 1) * 2
  const [dpr, setDpr] = useState(1.2)

  return (
    <div className="w-full h-full bg-[#0a0a0d] relative">
      {/* Palette overlay – HTML drag triggers */}
      {(onAddCase || onRemoveCase) && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          <button
            onClick={onAddCase}
            className="bg-[#1a1a1e] border border-[#2a2a30] hover:border-[#f59e0b] text-white text-xs font-mono px-3 py-2 rounded-lg flex items-center gap-2"
          >
            <span className="w-3 h-3 bg-[#60a5fa] border border-sky-700 rounded-sm" /> + Add Case (drag to add)
          </button>
          <div className="bg-[#1a1a1e] border border-[#2a2a30] text-zinc-500 text-xs font-mono px-3 py-2 rounded-lg">Drag case off pallet to remove • Drag orange handles to resize pallet</div>
        </div>
      )}
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
          customLayouts={customLayouts}
          maxPalletStack={maxPalletStack}
          onPerfDecline={setDpr}
          onLayoutChange={onLayoutChange ?? (() => {})}
          onPalletResize={onPalletResize ?? (() => {})}
          onRemoveCase={onRemoveCase ?? (() => {})}
        />
      </Canvas>
    </div>
  )
}
