import React from 'react'

export default function PauseMenu({
  togglePause,
  soundEnabled,
  setSoundEnabled,
  cameraModeEnabled,
  setCameraModeEnabled,
  backToMainMenu
}) {
  return (
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
  )
}
