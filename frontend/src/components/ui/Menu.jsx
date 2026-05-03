import React from 'react'
import { DIFFICULTY_CONFIG, SITE_TITLE } from '../../config/gameConfig'

export default function Menu({
  difficulty,
  setDifficulty,
  soundEnabled,
  setSoundEnabled,
  cameraModeEnabled,
  setCameraModeEnabled,
  selectedLevelBestScore,
  startGame
}) {
  return (
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
  )
}
