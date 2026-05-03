import React, { useState, useRef, useEffect } from 'react'
import Laser from './Laser'
import { DIFFICULTY_CONFIG } from '../../config/gameConfig'

export default function Lasers({ difficulty, headRotationRef, onHit, onLaserFired, setCurrentDodge }) {
  const [lasers, setLasers] = useState([])
  const timer = useRef()
  const { spawnInterval, laserSpeed } = DIFFICULTY_CONFIG[difficulty]

  useEffect(() => {
    const activeLaser = lasers.find(l => !l.passedPlayer)
    if (activeLaser) {
      setCurrentDodge(activeLaser.requiredDodge)
    } else {
      setCurrentDodge(null)
    }
  }, [lasers, setCurrentDodge])

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
          z: -25,
          requiredDodge: Math.random() > 0.5 ? 'left' : 'right',
          passedPlayer: false
        }]
      })
    }, spawnInterval)
    return () => clearInterval(timer.current)
  }, [onLaserFired, spawnInterval])

  const handleLaserPassed = (laserId) => {
    setLasers(prev => prev.filter(laser => laser.id !== laserId))
  }

  const handleLaserPassedPlayer = (laserId) => {
    setLasers(prev => prev.map(laser => laser.id === laserId ? { ...laser, passedPlayer: true } : laser))
  }

  return (
    <group>
      {lasers.map(laser => (
        <Laser 
          id={laser.id}
          key={laser.id} 
          position={[laser.x, laser.y, laser.z]} 
          speed={laserSpeed}
          requiredDodge={laser.requiredDodge}
          onHit={onHit}
          onPassed={handleLaserPassed}
          onPassedPlayer={handleLaserPassedPlayer}
          headRotationRef={headRotationRef}
        />
      ))}
    </group>
  )
}
