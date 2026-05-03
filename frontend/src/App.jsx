import React, { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, OrbitControls, useProgress, useGLTF } from '@react-three/drei'

import { DIFFICULTY_CONFIG, BEST_SCORES_KEY, LEGACY_BEST_SCORE_KEY, CAMERA_MODE_KEY } from './config/gameConfig'
import { useAudio } from './hooks/useAudio'
import { useHeadTracking } from './hooks/useHeadTracking'

import Luffy from './components/game/Luffy'
import Lasers from './components/game/Lasers'
import Loader from './components/ui/Loader'
import HUD from './components/ui/HUD'
import Menu from './components/ui/Menu'
import PauseMenu from './components/ui/PauseMenu'
import GameOver from './components/ui/GameOver'

import kuma from './assets/kuma.png'

export default function App() {
  const [hasStarted, setHasStarted] = useState(false)
  const [difficulty, setDifficulty] = useState('medium')
  const [runDifficulty, setRunDifficulty] = useState('medium')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [cameraModeEnabled, setCameraModeEnabled] = useState(true)
  const [bestScores, setBestScores] = useState({ easy: 0, medium: 0, hard: 0 })
  const [isPaused, setIsPaused] = useState(false)
  const [isHit, setIsHit] = useState(false)
  const [isGameOver, setIsGameOver] = useState(false)
  const [gameOverReason, setGameOverReason] = useState('')
  const [score, setScore] = useState(0)
  const [currentDodge, setCurrentDodge] = useState(null)
  
  const { active: assetsLoading } = useProgress()
  
  const { ensureAudioContext, playLaserSfx, playHitSfx } = useAudio(soundEnabled)

  const { webcamStatus, headRotation, setHeadRotation, previewVideoRef } = useHeadTracking({
    cameraModeEnabled,
    gameState: { hasStarted, isPaused, isGameOver }
  })
  
  const isReady = !assetsLoading && (cameraModeEnabled ? webcamStatus === 'connected' || webcamStatus === 'disabled' || webcamStatus === 'error' : true)
  const showLoader = hasStarted && !isReady

  const headRotationRef = useRef(0)
  const dodgeResetTimerRef = useRef(null)

  const difficultySettings = DIFFICULTY_CONFIG[runDifficulty]
  const selectedLevelBestScore = bestScores[difficulty] || 0
  const runLevelBestScore = bestScores[runDifficulty] || 0

  useEffect(() => {
    headRotationRef.current = headRotation
  }, [headRotation])

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
        // Fall back
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
    }
  }, [])

  useEffect(() => {
    localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(bestScores))
  }, [bestScores])

  useEffect(() => {
    localStorage.setItem(CAMERA_MODE_KEY, String(cameraModeEnabled))
  }, [cameraModeEnabled])

  const triggerDodge = (rotation) => {
    setHeadRotation(rotation)
    if (dodgeResetTimerRef.current) clearTimeout(dodgeResetTimerRef.current)
    dodgeResetTimerRef.current = setTimeout(() => {
      setHeadRotation(0)
      dodgeResetTimerRef.current = null
    }, 450)
  }

  const restartGame = () => {
    if (dodgeResetTimerRef.current) clearTimeout(dodgeResetTimerRef.current)
    setIsGameOver(false)
    setIsPaused(false)
    setIsHit(false)
    setGameOverReason('')
    setScore(0)
    setHeadRotation(0)
    setRunDifficulty(difficulty)
  }

  const backToMainMenu = () => {
    if (dodgeResetTimerRef.current) clearTimeout(dodgeResetTimerRef.current)
    setHasStarted(false)
    setIsGameOver(false)
    setIsPaused(false)
    setIsHit(false)
    setGameOverReason('')
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
    setGameOverReason('')
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
      if (!hasStarted && (e.code === 'Space' || e.code === 'Enter')) { startGame(); return; }
      if (isGameOver && e.code === 'Space') { restartGame(); return; }
      if (!hasStarted || isGameOver) return

      if (e.code === 'KeyP') { if (isReady) togglePause(); return; }

      if (isPaused || !isReady || e.repeat) return
      
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') triggerDodge(-Math.PI / 2.0)
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') triggerDodge(Math.PI / 2.0)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasStarted, isGameOver, isPaused, isReady])

  useEffect(() => {
    if (!hasStarted || isPaused || isHit || isGameOver || !isReady) return
    const interval = setInterval(() => setScore(s => s + difficultySettings.scorePerTick), 1000)
    return () => clearInterval(interval)
  }, [difficultySettings.scorePerTick, hasStarted, isPaused, isHit, isGameOver, isReady])

  useEffect(() => {
    if (!hasStarted || isGameOver) return
    setBestScores(prev => {
      const currentBest = prev[runDifficulty] || 0
      if (score <= currentBest) return prev
      return { ...prev, [runDifficulty]: score }
    })
  }, [hasStarted, isGameOver, runDifficulty, score])

  const handleHit = (reason = "You got hit!") => {
    if (!hasStarted || isGameOver) return
    playHitSfx()
    setIsHit(true)
    setIsGameOver(true)
    setGameOverReason(reason)
  }

  const handleTouchDodge = (rotation, event) => {
    if (!hasStarted || isPaused || isGameOver) return
    if (event.cancelable) event.preventDefault()
    triggerDodge(rotation)
  }

  return (
    <div className={`game-root ${isHit ? 'hit' : ''}`}>
      <img className="kuma-shooter" src={kuma} alt="Kuma aiming from the ridge" />

      {showLoader && <Loader cameraModeEnabled={cameraModeEnabled} webcamStatus={webcamStatus} />}

      {hasStarted && isReady && !isGameOver && !isPaused && currentDodge && (
        <div className={`dodge-prompt ${currentDodge}`}>
          {currentDodge === 'left' ? '← DODGE LEFT ' : ' DODGE RIGHT →'}
        </div>
      )}

      {hasStarted && (
        <HUD score={score} isHit={isHit} runDifficulty={runDifficulty} runLevelBestScore={runLevelBestScore} cameraModeEnabled={cameraModeEnabled} webcamStatus={webcamStatus} isReady={isReady} isPaused={isPaused} togglePause={togglePause} />
      )}

      {hasStarted && cameraModeEnabled && (
        <div className="webcam-preview-wrap">
          <video ref={previewVideoRef} className="webcam-preview" autoPlay muted playsInline />
        </div>
      )}

      {!hasStarted && (
        <Menu difficulty={difficulty} setDifficulty={setDifficulty} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} cameraModeEnabled={cameraModeEnabled} setCameraModeEnabled={setCameraModeEnabled} selectedLevelBestScore={selectedLevelBestScore} startGame={startGame} />
      )}

      {!isGameOver && !isPaused && hasStarted && isReady && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', touchAction: 'none' }}>
          <div style={{ flex: 1 }} onTouchStart={(event) => handleTouchDodge(-Math.PI / 2.0, event)} />
          <div style={{ flex: 1 }} onTouchStart={(event) => handleTouchDodge(Math.PI / 2.0, event)} />
        </div>
      )}

      {hasStarted && !isGameOver && isPaused && (
        <PauseMenu togglePause={togglePause} soundEnabled={soundEnabled} setSoundEnabled={setSoundEnabled} cameraModeEnabled={cameraModeEnabled} setCameraModeEnabled={setCameraModeEnabled} backToMainMenu={backToMainMenu} />
      )}

      {hasStarted && isGameOver && (
        <GameOver restartGame={restartGame} gameOverReason={gameOverReason} difficulty={difficulty} setDifficulty={setDifficulty} cameraModeEnabled={cameraModeEnabled} setCameraModeEnabled={setCameraModeEnabled} selectedLevelBestScore={selectedLevelBestScore} backToMainMenu={backToMainMenu} />
      )}

      <Canvas camera={{ position: [0, 2.0, 2.3], fov: 45 }}>
        <ambientLight intensity={2} />
        <directionalLight position={[0, 10, 5]} intensity={2.5} castShadow />
        <Suspense fallback={null}>
          <Environment preset="city" />
          <Luffy headRotation={headRotation} isHit={isHit} />
        </Suspense>
        {hasStarted && isReady && !isGameOver && !isPaused && (
          <Lasers difficulty={runDifficulty} headRotationRef={headRotationRef} onHit={handleHit} onLaserFired={playLaserSfx} setCurrentDodge={setCurrentDodge} />
        )}
        <OrbitControls makeDefault target={[0, 1.4, -4]} enablePan={false} enableZoom={false} enableRotate={false} />
      </Canvas>
    </div>
  )
}
useGLTF.preload('/luffy/scene.gltf')
