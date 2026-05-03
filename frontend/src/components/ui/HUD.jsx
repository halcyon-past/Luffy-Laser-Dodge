import React from 'react'
import { DIFFICULTY_CONFIG, SITE_TITLE } from '../../config/gameConfig'
import { isMobile } from '../../utils/device'

export default function HUD({ 
  score, 
  isHit, 
  runDifficulty, 
  runLevelBestScore, 
  cameraModeEnabled, 
  webcamStatus, 
  isReady, 
  isPaused, 
  togglePause 
}) {
  return (
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
      {isReady && <button type="button" className="pause-btn" onClick={togglePause}>{isPaused ? 'Resume' : 'Pause'}</button>}
    </div>
  )
}
