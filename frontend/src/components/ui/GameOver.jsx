import React from 'react'
import { DIFFICULTY_CONFIG } from '../../config/gameConfig'

export default function GameOver({
  restartGame,
  gameOverReason,
  difficulty,
  setDifficulty,
  cameraModeEnabled,
  setCameraModeEnabled,
  selectedLevelBestScore,
  backToMainMenu
}) {
  return (
    <div className="game-over-wrap" onClick={restartGame} onTouchStart={restartGame}>
      <div
        className="game-over-panel"
        onClick={(event) => event.stopPropagation()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <h1 className="game-over-title">GAME OVER</h1>
        <h2 className="game-over-reason">{gameOverReason}</h2>
        <h3 className="game-over-subtitle">Change difficulty or press Space to restart</h3>

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
  )
}
