import React from 'react'

export default function Loader({ cameraModeEnabled, webcamStatus }) {
  return (
    <div className="loader-overlay" style={{
      position: 'absolute', inset: 0, zIndex: 20, 
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.85)', color: '#fff'
    }}>
      <div className="loading-spinner"></div>
      <h2 style={{marginTop: '20px', fontFamily: 'Georgia, serif', color: '#ffca3a', textShadow: '0 0 10px rgba(255, 202, 58, 0.5)'}}>
        Game Loading...
      </h2>
      <p style={{marginTop: '10px', opacity: 0.8}}>
        {cameraModeEnabled && webcamStatus !== 'connected' ? 'Initializing AI Tracking Models...' : 'Loading 3D Assets...'}
      </p>
    </div>
  )
}
