import { Canvas } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Suspense, useEffect } from 'react'
import * as THREE from 'three'

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url)

  if (!gltf || !gltf.scene) return null

  return <primitive object={gltf.scene as THREE.Object3D} />
}

export default function ModelViewer({ url }: { url: string }) {
  useEffect(() => {
    return () => {
      try {
        useGLTF.clear(url)
      } catch {}
    }
  }, [url])

  return (
    <div className="h-full w-full">
      <Canvas camera={{ position: [0, 0, 5], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true }}>
        <color attach="background" args={['#1a1a1a']} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <Suspense fallback={null}>
          <Model url={url} />
        </Suspense>
        <OrbitControls />
      </Canvas>
    </div>
  )
}
