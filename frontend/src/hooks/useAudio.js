import { useRef, useCallback, useEffect } from 'react'

export function useAudio(soundEnabled) {
  const audioCtxRef = useRef(null)

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close()
      }
    }
  }, [])

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

  return { ensureAudioContext, playLaserSfx, playHitSfx }
}
