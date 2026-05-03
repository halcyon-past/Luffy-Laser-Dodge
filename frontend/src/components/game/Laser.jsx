import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function Laser({ id, position, speed, requiredDodge, onHit, onPassed, onPassedPlayer, headRotationRef }) {
  const laserRef = useRef()
  const pulseRef = useRef()
  const tipRef = useRef()
  const hasHit = useRef(false)
  const hasPassed = useRef(false)
  const hasPassedPlayer = useRef(false)
  const phase = useRef(Math.random() * Math.PI * 2)

  useFrame((state, delta) => {
    if (laserRef.current) {
      laserRef.current.position.z += delta * speed

      // Collision detection plane
      if (!hasHit.current && laserRef.current.position.z > -0.5 && laserRef.current.position.z < 0.5) {
        const rotation = headRotationRef.current
        let isSafe = false
        
        // Check if player moved in the required dodge direction
        if (requiredDodge === 'left' && rotation < -0.5) {
          isSafe = true
        } else if (requiredDodge === 'right' && rotation > 0.5) {
          isSafe = true
        }

        if (!isSafe) {
          hasHit.current = true
          let reason = "You got blasted!"
          if (Math.abs(rotation) < 0.3) {
            reason = "You didn't dodge in time!"
          } else {
            reason = "You dodged the wrong way!"
          }
          onHit(reason)
        }
      }

      if (!hasPassedPlayer.current && laserRef.current.position.z > 0.5) {
        hasPassedPlayer.current = true
        if (onPassedPlayer) onPassedPlayer(id)
      }

      if (!hasPassed.current && laserRef.current.position.z > 12) {
        hasPassed.current = true
        onPassed(id)
      }

      const pulse = 1 + Math.sin(state.clock.elapsedTime * 24 + phase.current) * 0.18
      if (pulseRef.current) {
        pulseRef.current.scale.set(pulse, 1, pulse)
      }
      if (tipRef.current) {
        tipRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 30 + phase.current) * 0.12)
      }
    }
  })

  return (
    <group ref={laserRef} position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[0.026, 0.026, 4, 14, 1, true]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh>
        <cylinderGeometry args={[0.07, 0.07, 4, 18, 1, true]} />
        <meshBasicMaterial
          color={requiredDodge === 'left' ? '#ffb84d' : '#9fefff'}
          transparent
          opacity={0.42}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={pulseRef}>
        <cylinderGeometry args={[0.12, 0.12, 4, 20, 1, true]} />
        <meshBasicMaterial
          color={requiredDodge === 'left' ? '#ff9900' : '#4ab7ff'}
          transparent
          opacity={0.18}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={tipRef} position={[0, 2.05, 0]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshBasicMaterial
          color={requiredDodge === 'left' ? '#ffdd99' : '#d7f7ff'}
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight color={requiredDodge === 'left' ? '#ffaa00' : '#78d7ff'} intensity={2.8} distance={2.8} decay={2} />
    </group>
  )
}
