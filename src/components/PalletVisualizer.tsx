// @ts-nocheck
import { Canvas } from '@react-three/fiber'
import '@react-three/fiber'
import { OrbitControls, Grid, Environment } from '@react-three/drei'
import * as THREE from 'three'

function Pallet({ width, length }: { width: number; length: number }) {
  // Pallet: brown wood, 1.5 height, centered at origin, top at y=0
  const w = width / 100 // scale mm -> world units (1000 -> 10)
  const d = length / 100 // 1200 -> 12
  const h = 0.4 // pallet height
  return (
    <group>
      <mesh position={[0, -h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[w, h, d]} />
        <meshStandardMaterial color="#8B5A2B" roughness={0.85} />
      </mesh>
      {/* planks visual stripes */}
      <mesh position={[0, -h / 2 + 0.02, 0]}>
        <boxGeometry args={[w * 0.98, 0.02, d * 0.98]} />
        <meshStandardMaterial color="#A67C52" roughness={0.9} />
      </mesh>
      {/* edges */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
        <lineBasicMaterial color="#5C3A1E" />
      </lineSegments>
    </group>
  )
}

function Scene({ palletWidth, palletLength }: { palletWidth: number; palletLength: number }) {
  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight position={[10, 18, 10]} intensity={1.1} castShadow shadow-mapSize={2048} />
      <directionalLight position={[-8, 12, -8]} intensity={0.4} />
      <Pallet width={palletWidth} length={palletLength} />
      <Grid position={[0, -0.21, 0]} args={[30, 30]} cellSize={1} cellThickness={0.6} cellColor="#2a2a30" sectionSize={5} sectionColor="#3a3a44" fadeDistance={30} fadeStrength={1} />
      <OrbitControls enableDamping dampingFactor={0.05} minDistance={6} maxDistance={35} maxPolarAngle={Math.PI / 2.05} target={[0, 2, 0]} />
      <Environment preset="warehouse" />
    </>
  )
}

export function PalletVisualizer({
  palletWidth,
  palletLength,
}: {
  palletWidth: number
  palletLength: number
}) {
  return (
    <div className="w-full h-full bg-[#0a0a0d]">
      <Canvas shadows camera={{ position: [14, 9, 14], fov: 45 }} gl={{ antialias: true }}>
        <color attach="background" args={['#0a0a0d']} />
        <Scene palletWidth={palletWidth} palletLength={palletLength} />
      </Canvas>
    </div>
  )
}
