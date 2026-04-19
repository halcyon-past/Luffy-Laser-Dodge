import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import kuma from './assets/kuma.png'

function Luffy({ headRotation, isHit }) {
  const { scene } = useGLTF('/luffy/scene.gltf')
  const initialRotation = useRef(null)
  const armPoseTargets = useRef([])

  useEffect(() => {
    const poseConfigs = [
      {
        names: ['arm *side* shoulder 2.L_224', 'arm *side* shoulder 1.L_245'],
        euler: new THREE.Euler(0.12, 0, 1.2)
      },
      {
        names: ['arm *side* shoulder 2.R_252', 'arm *side* shoulder 1.R_273'],
        euler: new THREE.Euler(0.12, 0, -1.2)
      },
      {
        names: ['arm *side* elbow.L_220'],
        euler: new THREE.Euler(0, 0, 0.22)
      },
      {
        names: ['arm *side* elbow.R_248'],
        euler: new THREE.Euler(0, 0, -0.22)
      }
    ]

    armPoseTargets.current = poseConfigs
      .map(({ names, euler }) => {
        const bone = names.map(name => scene.getObjectByName(name)).find(Boolean)
        if (!bone) return null

        const base = bone.quaternion.clone()
        const offset = new THREE.Quaternion().setFromEuler(euler)
        const target = base.clone().multiply(offset)

        return { bone, target }
      })
      .filter(Boolean)
  }, [scene])

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

    // Keep both arms in a relaxed down pose instead of the default T-pose.
    armPoseTargets.current.forEach(({ bone, target }) => {
      bone.quaternion.slerp(target, 0.12)
    })
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

function Laser({ id, position, onHit, onPassed, headRotationRef }) {
  const laserRef = useRef()
  const pulseRef = useRef()
  const tipRef = useRef()
  const hasHit = useRef(false)
  const hasPassed = useRef(false)
  const phase = useRef(Math.random() * Math.PI * 2)

  useFrame((state, delta) => {
    if (laserRef.current) {
      laserRef.current.position.z += delta * 20 // Speed of the laser

      // Collision detection plane
      if (!hasHit.current && laserRef.current.position.z > -0.5 && laserRef.current.position.z < 0.5) {
        // If head is completely upright (not dodged), it's a hit!
        if (Math.abs(headRotationRef.current) < 0.5) {
          hasHit.current = true
          onHit()
        }
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
          color="#9fefff"
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
          color="#4ab7ff"
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
          color="#d7f7ff"
          transparent
          opacity={0.85}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <pointLight color="#78d7ff" intensity={2.8} distance={2.8} decay={2} />
    </group>
  )
}

function Lasers({ headRotationRef, onHit }) {
  const [lasers, setLasers] = useState([])
  const timer = useRef()

  useEffect(() => {
    timer.current = setInterval(() => {
      setLasers(prev => {
        return [...prev, {
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

  const handleLaserPassed = (laserId) => {
    setLasers(prev => prev.filter(laser => laser.id !== laserId))
  }

  return (
    <group>
      {lasers.map(laser => (
        <Laser 
          id={laser.id}
          key={laser.id} 
          position={[laser.x, laser.y, laser.z]} 
          onHit={onHit}
          onPassed={handleLaserPassed}
          headRotationRef={headRotationRef}
        />
      ))}
    </group>
  )
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false)
  const [headRotation, setHeadRotation] = useState(0)
  const [isHit, setIsHit] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  
  const headRotationRef = useRef(0)
  const dodgeResetTimerRef = useRef(null)

  useEffect(() => {
    headRotationRef.current = headRotation
  }, [headRotation])

  useEffect(() => {
    return () => {
      if (dodgeResetTimerRef.current) {
        clearTimeout(dodgeResetTimerRef.current)
      }
    }
  }, [])

  const triggerDodge = (rotation) => {
    setHeadRotation(rotation)

    if (dodgeResetTimerRef.current) {
      clearTimeout(dodgeResetTimerRef.current)
    }

    // Auto-center after a single dodge window, even if the key is held.
    dodgeResetTimerRef.current = setTimeout(() => {
      setHeadRotation(0)
      dodgeResetTimerRef.current = null
    }, 450)
  }

  const restartGame = () => {
    if (dodgeResetTimerRef.current) {
      clearTimeout(dodgeResetTimerRef.current)
      dodgeResetTimerRef.current = null
    }

    setIsGameOver(false)
    setIsHit(false)
    setScore(0)
    setHeadRotation(0)
  }

  const startGame = () => {
    setHasStarted(true)
    setIsGameOver(false)
    setIsHit(false)
    setScore(0)
    setHeadRotation(0)
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!hasStarted && (e.code === 'Space' || e.code === 'Enter')) {
        startGame()
        return
      }

      if (isGameOver && e.code === 'Space') {
        restartGame()
        return
      }
      if (!hasStarted) return
      if (isGameOver) return
      if (e.repeat) return
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        triggerDodge(-Math.PI / 2.0)
      } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        triggerDodge(Math.PI / 2.0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [hasStarted, isGameOver])

  // Increase score over time if not hit
  useEffect(() => {
    if (!hasStarted || isHit || isGameOver) return
    const interval = setInterval(() => {
      setScore(s => s + 10)
    }, 1000)
    return () => clearInterval(interval)
  }, [hasStarted, isHit, isGameOver])

  const handleHit = () => {
    if (!hasStarted || isGameOver) return
    setIsHit(true)
    setIsGameOver(true)
  }

  const handleScreenRestart = () => {
    if (!isGameOver) return
    restartGame()
  }

  const handleTouchDodge = (rotation, event) => {
    if (!hasStarted || isGameOver) return
    if (event.cancelable) {
      event.preventDefault()
    }
    triggerDodge(rotation)
  }

  return (
    <div
      className={`game-root ${isHit ? 'hit' : ''}`}
      onClick={handleScreenRestart}
      onTouchStart={handleScreenRestart}
    >
      <img className="kuma-shooter" src={kuma} alt="Kuma aiming from the ridge" />

      {hasStarted && (
        <div className="hud-panel">
          <h1 className="hud-title">Luffy Laser Dodge</h1>
          <p className="hud-copy">Use Left/Right Arrows, A/D, or tap screen halves to dodge</p>
          <h2 className={`hud-score ${isHit ? 'is-hit' : ''}`}>Score: {score}</h2>
        </div>
      )}

      {!hasStarted && (
        <div className="start-menu">
          <div className="start-card">
            <p className="menu-tag">3D reflex challenge</p>
            <h1 className="menu-title">Luffy Laser Dodge</h1>
            <p className="menu-copy">Dodge Kuma's laser barrage and survive as long as possible.</p>
            <button type="button" className="start-btn" onClick={startGame}>Start Game</button>
            <p className="menu-hint">Press Space or Enter to start</p>
            <p className="menu-credits">
              Created by Aritro Saha •{' '}
              <a href="https://aritro.cloud" target="_blank" rel="noreferrer">aritro.cloud</a>
            </p>
          </div>
        </div>
      )}

      {!isGameOver && hasStarted && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 8,
            display: 'flex',
            touchAction: 'none'
          }}
        >
          <div
            style={{ flex: 1 }}
            onTouchStart={(event) => handleTouchDodge(-Math.PI / 2.0, event)}
          />
          <div
            style={{ flex: 1 }}
            onTouchStart={(event) => handleTouchDodge(Math.PI / 2.0, event)}
          />
        </div>
      )}

      {hasStarted && isGameOver && (
        <div className="game-over-panel">
          <h1 className="game-over-title">GAME OVER</h1>
          <h2 className="game-over-subtitle">Press Spacebar or Click/Tap to Restart</h2>
        </div>
      )}

      <Canvas camera={{ position: [0, 2.0, 2.3], fov: 45 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[0, 10, 5]} intensity={2.5} castShadow />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Luffy headRotation={headRotation} isHit={isHit} />
        </Suspense>

        {hasStarted && !isGameOver && <Lasers headRotationRef={headRotationRef} onHit={handleHit} />}
        
        {/* Adjusted Target to keep the camera close but angled down the path */}
        <OrbitControls makeDefault target={[0, 1.4, -4]} enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
    </div>
  )
}
useGLTF.preload('/luffy/scene.gltf')
