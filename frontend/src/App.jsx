import React, { useRef, useState, useEffect, Suspense, useCallback } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { useGLTF, Environment, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import kuma from './assets/kuma.png'

const DIFFICULTY_CONFIG = {
  easy: { label: 'Easy', spawnInterval: 1500, laserSpeed: 14, scorePerTick: 8 },
  medium: { label: 'Medium', spawnInterval: 1200, laserSpeed: 20, scorePerTick: 10 },
  hard: { label: 'Hard', spawnInterval: 880, laserSpeed: 26, scorePerTick: 14 }
}

const BEST_SCORES_KEY = 'luffy-laser-dodge-best-scores-by-difficulty'
const LEGACY_BEST_SCORE_KEY = 'luffy-laser-dodge-best-score'
const CAMERA_MODE_KEY = 'luffy-laser-dodge-camera-mode-enabled'
const SITE_TITLE = 'Luffy Laser Dodge'
const BACKEND_OFFER_URL = import.meta.env.VITE_BACKEND_OFFER_URL || 'http://localhost:8000/offer'

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
      targetBone.quaternion.slerp(q, 0.9)
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

function Laser({ id, position, speed, onHit, onPassed, headRotationRef }) {
  const laserRef = useRef()
  const pulseRef = useRef()
  const tipRef = useRef()
  const hasHit = useRef(false)
  const hasPassed = useRef(false)
  const phase = useRef(Math.random() * Math.PI * 2)

  useFrame((state, delta) => {
    if (laserRef.current) {
      laserRef.current.position.z += delta * speed

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

function Lasers({ difficulty, headRotationRef, onHit, onLaserFired }) {
  const [lasers, setLasers] = useState([])
  const timer = useRef()
  const { spawnInterval, laserSpeed } = DIFFICULTY_CONFIG[difficulty]

  useEffect(() => {
    timer.current = setInterval(() => {
      onLaserFired()
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
    }, spawnInterval)
    return () => clearInterval(timer.current)
  }, [onLaserFired, spawnInterval])

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
          speed={laserSpeed}
          onHit={onHit}
          onPassed={handleLaserPassed}
          headRotationRef={headRotationRef}
        />
      ))}
    </group>
  )
}

function isMobile() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return false;
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}

export default function App() {
  const [hasStarted, setHasStarted] = useState(false)
  const [difficulty, setDifficulty] = useState('medium')
  const [runDifficulty, setRunDifficulty] = useState('medium')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cameraModeEnabled, setCameraModeEnabled] = useState(true)
  const [bestScores, setBestScores] = useState({ easy: 0, medium: 0, hard: 0 })
  const [isPaused, setIsPaused] = useState(false)
  const [headRotation, setHeadRotation] = useState(0)
  const [isHit, setIsHit] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [webcamStatus, setWebcamStatus] = useState('idle')
  
  const headRotationRef = useRef(0)
  const dodgeResetTimerRef = useRef(null)
  const audioCtxRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const dataChannelRef = useRef(null)
  const localStreamRef = useRef(null)
  const previewVideoRef = useRef(null)
  const gameStateRef = useRef({ hasStarted: false, isPaused: false, isGameOver: false })

  const difficultySettings = DIFFICULTY_CONFIG[runDifficulty]
  const selectedLevelBestScore = bestScores[difficulty] || 0
  const runLevelBestScore = bestScores[runDifficulty] || 0

  useEffect(() => {
    headRotationRef.current = headRotation
  }, [headRotation])

  useEffect(() => {
    gameStateRef.current = { hasStarted, isPaused, isGameOver }
  }, [hasStarted, isPaused, isGameOver])

  useEffect(() => {
    const rawBestScores = localStorage.getItem(BEST_SCORES_KEY)
    if (rawBestScores) {
      try {
        const parsedBestScores = JSON.parse(rawBestScores)
        setBestScores(prev => ({
          ...prev,
          easy: Number.isFinite(parsedBestScores?.easy) ? parsedBestScores.easy : prev.easy,
          medium: Number.isFinite(parsedBestScores?.medium) ? parsedBestScores.medium : prev.medium,
          hard: Number.isFinite(parsedBestScores?.hard) ? parsedBestScores.hard : prev.hard
        }))
      } catch {
        // Fall back to legacy single-score migration below.
      }
    } else {
      const rawLegacyScore = localStorage.getItem(LEGACY_BEST_SCORE_KEY)
      const parsedLegacyScore = Number(rawLegacyScore)
      if (Number.isFinite(parsedLegacyScore) && parsedLegacyScore > 0) {
        setBestScores(prev => ({ ...prev, medium: parsedLegacyScore }))
      }
    }

    const rawCameraMode = localStorage.getItem(CAMERA_MODE_KEY)
    if (rawCameraMode === 'false') {
      setCameraModeEnabled(false)
    }

    return () => {
      if (dodgeResetTimerRef.current) {
        clearTimeout(dodgeResetTimerRef.current)
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(bestScores))
  }, [bestScores])

  useEffect(() => {
    localStorage.setItem(CAMERA_MODE_KEY, String(cameraModeEnabled))
  }, [cameraModeEnabled])

  const stopHeadTracking = useCallback((nextStatus = 'idle') => {
    if (dataChannelRef.current) {
      dataChannelRef.current.close()
      dataChannelRef.current = null
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null
    }

    setWebcamStatus(nextStatus)
    setHeadRotation(0)
  }, [])

  useEffect(() => {
    if (!hasStarted) {
      stopHeadTracking('idle')
      return
    }

    if (!cameraModeEnabled) {
      stopHeadTracking('disabled')
      return
    }

    let isCancelled = false

    const setupHeadTracking = async () => {
      try {
        setWebcamStatus('connecting')

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 },
            frameRate: { ideal: 24, max: 30 },
            facingMode: 'user'
          },
          audio: false
        })

        if (isCancelled) {
          stream.getTracks().forEach(track => track.stop())
          return
        }

        localStreamRef.current = stream

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream
        }

        const pc = new RTCPeerConnection()
        peerConnectionRef.current = pc

        const dataChannel = pc.createDataChannel('head-tilt', {
          ordered: false,
          maxRetransmits: 0,
        })
        dataChannelRef.current = dataChannel

        dataChannel.onopen = () => {
          setWebcamStatus('connected')
        }

        dataChannel.onclose = () => {
          setWebcamStatus('idle')
        }

        dataChannel.onmessage = (event) => {
          const currentState = gameStateRef.current
          if (!currentState.hasStarted || currentState.isPaused || currentState.isGameOver) return

          try {
            const payload = JSON.parse(event.data)
            if (payload?.type !== 'head_tilt') return

            if (dodgeResetTimerRef.current) {
              clearTimeout(dodgeResetTimerRef.current)
              dodgeResetTimerRef.current = null
            }

            if (typeof payload.lean === 'number') {
              const maxTilt = Math.PI / 2.0
              const scaledTilt = THREE.MathUtils.clamp(payload.lean * -4.8, -1, 1) * maxTilt
              setHeadRotation(scaledTilt)
            } else if (payload.direction === 'left') {
              setHeadRotation(-Math.PI / 2.0)
            } else if (payload.direction === 'right') {
              setHeadRotation(Math.PI / 2.0)
            } else {
              setHeadRotation(0)
            }
          } catch {
            // Ignore malformed data-channel payloads.
          }
        }

        stream.getVideoTracks().forEach(track => pc.addTrack(track, stream))

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') {
            resolve()
            return
          }

          const onIceGatheringStateChange = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange)
              resolve()
            }
          }

          pc.addEventListener('icegatheringstatechange', onIceGatheringStateChange)

          // Fallback: resolve even if ICE gathering stalls.
          setTimeout(() => {
            pc.removeEventListener('icegatheringstatechange', onIceGatheringStateChange)
            resolve()
          }, 1200)
        })

        const response = await fetch(BACKEND_OFFER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp: pc.localDescription?.sdp ?? offer.sdp,
            type: pc.localDescription?.type ?? offer.type
          })
        })

        if (!response.ok) {
          throw new Error(`Backend offer failed: ${response.status}`)
        }

        const answer = await response.json()
        if (!isCancelled) {
          await pc.setRemoteDescription(answer)
          setWebcamStatus('connecting')
        }
      } catch {
        if (!isCancelled) {
          stopHeadTracking('error')
        }
      }
    }

    setupHeadTracking()

    return () => {
      isCancelled = true
      stopHeadTracking('idle')
    }
  }, [cameraModeEnabled, hasStarted, stopHeadTracking])

  const ensureAudioContext = useCallback(async () => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return null

    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContextClass()
    }

    if (audioCtxRef.current.state === 'suspended') {
      await audioCtxRef.current.resume()
    }

    return audioCtxRef.current
  }, [])

  const playLaserSfx = useCallback(async () => {
    if (!soundEnabled) return
    const ctx = await ensureAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const filter = ctx.createBiquadFilter()

    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(900, now)
    osc.frequency.exponentialRampToValueAtTime(560, now + 0.09)

    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(1800, now)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.04, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1)

    osc.connect(filter)
    filter.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.11)
  }, [ensureAudioContext, soundEnabled])

  const playHitSfx = useCallback(async () => {
    if (!soundEnabled) return
    const ctx = await ensureAudioContext()
    if (!ctx) return

    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = 'triangle'
    osc.frequency.setValueAtTime(260, now)
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.25)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(now)
    osc.stop(now + 0.28)
  }, [ensureAudioContext, soundEnabled])

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
    setIsPaused(false)
    setIsHit(false)
    setScore(0)
    setHeadRotation(0)
    setRunDifficulty(difficulty)
  }

  const backToMainMenu = () => {
    if (dodgeResetTimerRef.current) {
      clearTimeout(dodgeResetTimerRef.current)
      dodgeResetTimerRef.current = null
    }

    setHasStarted(false)
    setIsGameOver(false)
    setIsPaused(false)
    setIsHit(false)
    setScore(0)
    setHeadRotation(0)
    setRunDifficulty(difficulty)
  }

  const startGame = () => {
    ensureAudioContext()
    setHasStarted(true)
    setIsGameOver(false)
    setIsPaused(false)
    setIsHit(false)
    setScore(0)
    setHeadRotation(0)
    setRunDifficulty(difficulty)
  }

  const togglePause = () => {
    if (!hasStarted || isGameOver) return
    setIsPaused(prev => !prev)
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

      if (e.code === 'KeyP') {
        togglePause()
        return
      }

      if (isPaused) return
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
  }, [hasStarted, isGameOver, isPaused])

  // Increase score over time if not hit
  useEffect(() => {
    if (!hasStarted || isPaused || isHit || isGameOver) return
    const interval = setInterval(() => {
      setScore(s => s + difficultySettings.scorePerTick)
    }, 1000)
    return () => clearInterval(interval)
  }, [difficultySettings.scorePerTick, hasStarted, isPaused, isHit, isGameOver])

  useEffect(() => {
    if (!hasStarted || isGameOver) return
    setBestScores(prev => {
      const currentBest = prev[runDifficulty] || 0
      if (score <= currentBest) return prev
      return { ...prev, [runDifficulty]: score }
    })
  }, [hasStarted, isGameOver, runDifficulty, score])

  const handleHit = () => {
    if (!hasStarted || isGameOver) return
    playHitSfx()
    setIsHit(true)
    setIsGameOver(true)
  }

  const handleTouchDodge = (rotation, event) => {
    if (!hasStarted || isPaused || isGameOver) return
    if (event.cancelable) {
      event.preventDefault()
    }
    triggerDodge(rotation)
  }

  return (
    <div className={`game-root ${isHit ? 'hit' : ''}`}>
      <img className="kuma-shooter" src={kuma} alt="Kuma aiming from the ridge" />

      {hasStarted && (
        <div className="hud-panel">
          <div className="brand-row">
            <img className="brand-logo" src="/logo_nobg.png" alt="Luffy Laser Dodge logo" />
            <h1 className="hud-title">{SITE_TITLE}</h1>
          </div>
          <p className="hud-copy">
            {isMobile() ? 'Tap left/right to dodge' : 'Use Left/Right Arrows, A/D, or tap screen halves to dodge'}
          </p>

          <p className={`hud-webcam webcam-${webcamStatus}`}>Camera Mode: {cameraModeEnabled ? webcamStatus : 'disabled'}</p>
          <h2 className={`hud-score ${isHit ? 'is-hit' : ''}`}>Score: {score}</h2>
          <p className="hud-best">Best ({DIFFICULTY_CONFIG[runDifficulty].label}): {runLevelBestScore}</p>
          <button type="button" className="pause-btn" onClick={togglePause}>{isPaused ? 'Resume' : 'Pause'}</button>
        </div>
      )}

      {hasStarted && cameraModeEnabled && (
        <div className="webcam-preview-wrap">
          <video
            ref={previewVideoRef}
            className="webcam-preview"
            autoPlay
            muted
            playsInline
          />
        </div>
      )}

      {!hasStarted && (
        <div className="start-menu">
          <div className="start-card">
            <img className="menu-logo" src="/logo_nobg.png" alt="Luffy Laser Dodge logo" />
            <p className="menu-tag">3D reflex challenge</p>
            <h1 className="menu-title">{SITE_TITLE}</h1>
            <p className="menu-copy">Dodge Kuma's laser barrage and survive as long as possible.</p>

            <div className="menu-options">
              <div className="option-group">
                <p className="option-label">Difficulty</p>
                <div className="option-buttons">
                  {Object.entries(DIFFICULTY_CONFIG).map(([key, value]) => (
                    <button
                      key={key}
                      type="button"
                      className={`option-btn ${difficulty === key ? 'active' : ''}`}
                      onClick={() => setDifficulty(key)}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="option-group">
                <p className="option-label">Sound Effects</p>
                <button
                  type="button"
                  className={`option-btn sound-toggle ${soundEnabled ? 'active' : ''}`}
                  onClick={() => setSoundEnabled(prev => !prev)}
                >
                  {soundEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <div className="option-group">
                <p className="option-label">Camera Mode</p>
                <button
                  type="button"
                  className={`option-btn sound-toggle ${cameraModeEnabled ? 'active' : ''}`}
                  onClick={() => setCameraModeEnabled(prev => !prev)}
                >
                  {cameraModeEnabled ? 'On' : 'Off'}
                </button>
              </div>

              <p className="menu-best">High Score ({DIFFICULTY_CONFIG[difficulty].label}): {selectedLevelBestScore}</p>
            </div>

            <button type="button" className="start-btn" onClick={startGame}>Start Game</button>
            <p className="menu-hint">Press Space or Enter to start</p>
            <p className="menu-credits">
              Created by Aritro Saha •{' '}
              <a href="https://aritro.cloud" target="_blank" rel="noreferrer">aritro.cloud</a>
            </p>
          </div>
        </div>
      )}

      {!isGameOver && !isPaused && hasStarted && (
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

      {hasStarted && !isGameOver && isPaused && (
        <div className="pause-overlay" onClick={togglePause} onTouchStart={togglePause}>
          <div
            className="pause-panel"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <h2 className="pause-title">Paused</h2>
            <p className="pause-copy">Adjust your sound settings and resume when ready.</p>

            <div className="option-group">
              <p className="option-label">Sound Effects</p>
              <button
                type="button"
                className={`option-btn sound-toggle ${soundEnabled ? 'active' : ''}`}
                onClick={() => setSoundEnabled(prev => !prev)}
              >
                {soundEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="option-group">
              <p className="option-label">Camera Mode</p>
              <button
                type="button"
                className={`option-btn sound-toggle ${cameraModeEnabled ? 'active' : ''}`}
                onClick={() => setCameraModeEnabled(prev => !prev)}
              >
                {cameraModeEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="menu-actions">
              <button type="button" className="start-btn" onClick={togglePause}>Resume Game</button>
              <button type="button" className="secondary-btn" onClick={backToMainMenu}>Back to Main Menu</button>
            </div>
          </div>
        </div>
      )}

      {hasStarted && isGameOver && (
        <div className="game-over-wrap" onClick={restartGame} onTouchStart={restartGame}>
          <div
            className="game-over-panel"
            onClick={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
          >
            <h1 className="game-over-title">GAME OVER</h1>
            <h2 className="game-over-subtitle">Change difficulty or press Space to restart</h2>

            <div className="option-group game-over-options">
              <p className="option-label">Difficulty</p>
              <div className="option-buttons">
                {Object.entries(DIFFICULTY_CONFIG).map(([key, value]) => (
                  <button
                    key={key}
                    type="button"
                    className={`option-btn ${difficulty === key ? 'active' : ''}`}
                    onClick={() => setDifficulty(key)}
                  >
                    {value.label}
                  </button>
                ))}
              </div>

              <p className="option-label">Camera Mode</p>
              <button
                type="button"
                className={`option-btn sound-toggle ${cameraModeEnabled ? 'active' : ''}`}
                onClick={() => setCameraModeEnabled(prev => !prev)}
              >
                {cameraModeEnabled ? 'On' : 'Off'}
              </button>

              <p className="menu-best">High Score ({DIFFICULTY_CONFIG[difficulty].label}): {selectedLevelBestScore}</p>
            </div>

            <div className="menu-actions">
              <button type="button" className="start-btn" onClick={restartGame}>Restart</button>
              <button type="button" className="secondary-btn" onClick={backToMainMenu}>Back to Main Menu</button>
            </div>
          </div>
        </div>
      )}

      <Canvas camera={{ position: [0, 2.0, 2.3], fov: 45 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[0, 10, 5]} intensity={2.5} castShadow />
        
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Luffy headRotation={headRotation} isHit={isHit} />
        </Suspense>

        {hasStarted && !isGameOver && !isPaused && (
          <Lasers
            difficulty={difficulty}
            headRotationRef={headRotationRef}
            onHit={handleHit}
            onLaserFired={playLaserSfx}
          />
        )}
        
        {/* Adjusted Target to keep the camera close but angled down the path */}
        <OrbitControls makeDefault target={[0, 1.4, -4]} enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
    </div>
  )
}
useGLTF.preload('/luffy/scene.gltf')
