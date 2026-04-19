import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

function Luffy({ headRotation, isHit }) {
  const { scene } = useGLTF('/luffy/scene.gltf')
  const initialRotation = useRef(null)

  useFrame(() => {
    const targetBone = scene.getObjectByName('head_neck_lower_217') || scene.getObjectByName('head neck lower_217') || scene.getObjectByName('head_neck_upper_216') || scene.getObjectByName('head neck upper_216')
    if (targetBone) {
      if (initialRotation.current === null) {
        // Save the neutral rest pose of the neck
        initialRotation.current = targetBone.quaternion.clone()
      }
      const baseRotation = new THREE.Euler().setFromQuaternion(initialRotation.current)
      // Z-axis rotation rolls the ear to the shoulder, leaning the head out of the center path
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(baseRotation.x, baseRotation.y, baseRotation.z + headRotation))
      targetBone.quaternion.slerp(q, 0.15)
    }
  })

  // Flash red when hit
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh) {
        if (isHit) {
          child.material.color.setHex(0xff0000)
        } else {
          child.material.color.setHex(0xffffff)
        }
      }
    })
  }, [isHit, scene])

  // Position at origin, facing away from camera
  return <primitive object={scene} position={[0, 0, 0]} rotation={[0, Math.PI, 0]} castShadow receiveShadow />
}

function Laser({ position, color, onHit, headRotationRef }) {
  const meshRef = useRef()
  const hasHit = useRef(false)

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.position.z += delta * 20 // Speed of the laser

      // Collision detection plane
      if (!hasHit.current && meshRef.current.position.z > -0.5 && meshRef.current.position.z < 0.5) {
        // If head is completely upright (not dodged), it's a hit!
        if (Math.abs(headRotationRef.current) < 0.5) {
          hasHit.current = true
          onHit()
        }
      }
    }
  })

  return (
    <mesh ref={meshRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[0.08, 0.08, 4]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={5} />
    </mesh>
  )
}

function Lasers({ headRotationRef, onHit }) {
  const [lasers, setLasers] = useState([])
  const timer = useRef()

  useEffect(() => {
    timer.current = setInterval(() => {
      setLasers(prev => {
        // Clear lasers that passed the camera
        const activeLasers = prev.filter(l => l.z < 10)
        return [...activeLasers, {
          id: Date.now(),
          x: 0, 
          // Raised the laser to perfectly align with his head height (face/hat area)
          // instead of his torso, so moving the head actually moves the target out of the way!
          y: 1.7, 
          z: -25 
        }]
      })
    }, 1200)
    return () => clearInterval(timer.current)
  }, [])

  return (
    <group>
      {lasers.map(laser => (
        <Laser 
          key={laser.id} 
          position={[laser.x, laser.y, laser.z]} 
          color="red" 
          onHit={onHit}
          headRotationRef={headRotationRef}
        />
      ))}
    </group>
  )
}

export default function App() {
  const [headRotation, setHeadRotation] = useState(0)
  const [isHit, setIsHit] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  
  const headRotationRef = useRef(0)

  useEffect(() => {
    headRotationRef.current = headRotation
  }, [headRotation])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isGameOver && e.code === 'Space') {
        setIsGameOver(false)
        setIsHit(false)
        setScore(0)
        return
      }
      if (isGameOver) return
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        setHeadRotation(Math.PI / 2.0) 
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        setHeadRotation(-Math.PI / 2.0) 
      }
    }
    const handleKeyUp = (e) => {
      if (['ArrowLeft', 'a', 'A', 'ArrowRight', 'd', 'D'].includes(e.key)) {
        setHeadRotation(0) 
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [isGameOver])

  // Increase score over time if not hit
  useEffect(() => {
    if (isHit || isGameOver) return
    const interval = setInterval(() => {
      setScore(s => s + 10)
    }, 1000)
    return () => clearInterval(interval)
  }, [isHit, isGameOver])

  const handleHit = () => {
    if (isGameOver) return
    setIsHit(true)
    setIsGameOver(true)
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: isHit ? '#400' : '#000', margin: 0, padding: 0, transition: 'background 0.1s', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 20, left: 20, color: 'white', zIndex: 10, fontFamily: 'sans-serif' }}>
        <h1 style={{ margin: '0 0 10px 0' }}>Luffy Laser Dodge</h1>
        <p style={{ margin: '0 0 10px 0' }}>Use Left/Right Arrows or A/D to dodge</p>
        <h2 style={{ color: isHit ? 'red' : '#0f0', margin: '0' }}>Score: {score}</h2>
      </div>

      {isGameOver && (
        <div style={{
          position: 'absolute', 
          top: '50%', 
          left: '50%', 
          transform: 'translate(-50%, -50%)', 
          textAlign: 'center',
          color: 'white', 
          zIndex: 20, 
          fontFamily: 'sans-serif'
        }}>
          <h1 style={{ color: 'red', fontSize: '4rem', margin: '0 0 20px 0' }}>GAME OVER</h1>
          <h2 style={{ fontSize: '2rem', margin: 0 }}>Press Spacebar to Restart</h2>
        </div>
      )}

      <Canvas camera={{ position: [0, 2.0, 2.3], fov: 45 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[0, 10, 5]} intensity={2.5} castShadow />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Luffy headRotation={headRotation} isHit={isHit} />
        </Suspense>

        {!isGameOver && <Lasers headRotationRef={headRotationRef} onHit={handleHit} />}
        
        {/* Adjusted Target to keep the camera close but angled down the path */}
        <OrbitControls makeDefault target={[0, 1.4, -4]} enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
    </div>
  )
}
useGLTF.preload('/luffy/scene.gltf')
