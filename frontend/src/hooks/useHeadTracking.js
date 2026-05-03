import { useRef, useState, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { FaceDetector, FilesetResolver } from '@mediapipe/tasks-vision'

export function useHeadTracking({ cameraModeEnabled, gameState }) {
  const [webcamStatus, setWebcamStatus] = useState('idle')
  const [headRotation, setHeadRotation] = useState(0)

  const localStreamRef = useRef(null)
  const previewVideoRef = useRef(null)
  const faceDetectorRef = useRef(null)
  const animationFrameRef = useRef(null)
  const baselineOffsetRef = useRef(null)
  const prevRelativeOffsetRef = useRef(0)
  const lastDirectionRef = useRef('center')
  const lastSentOffsetRef = useRef(0)

  const stopHeadTracking = useCallback((nextStatus = 'idle') => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop())
      localStreamRef.current = null
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null
    }

    if (faceDetectorRef.current) {
      faceDetectorRef.current.close()
      faceDetectorRef.current = null
    }

    baselineOffsetRef.current = null
    prevRelativeOffsetRef.current = 0
    lastDirectionRef.current = 'center'
    lastSentOffsetRef.current = 0

    setWebcamStatus(nextStatus)
    setHeadRotation(0)
  }, [])

  useEffect(() => {
    if (!gameState.hasStarted) {
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
            width: { ideal: 480 },
            height: { ideal: 360 },
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
          previewVideoRef.current.onloadedmetadata = () => {
            previewVideoRef.current.play()
          }
        }

        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        )
        const faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU"
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5
        })

        if (isCancelled) {
          faceDetector.close()
          return
        }
        
        faceDetectorRef.current = faceDetector
        setWebcamStatus('connected')

        let lastVideoTime = -1

        const processFrame = () => {
          if (isCancelled) return

          // Read latest gameState via ref so we don't have dependency cycles in the frame loop.
          // Wait, 'gameState' here is passed in as a dependency to the hook but the loop is captured.
          // Let's just use the properties directly, but note that `gameState` from props might be stale.
          // We will rely on previewVideoRef and faceDetectorRef.
          if (previewVideoRef.current && faceDetectorRef.current) {
            let startTimeMs = performance.now()
            if (previewVideoRef.current.currentTime !== lastVideoTime) {
              lastVideoTime = previewVideoRef.current.currentTime
              
              const results = faceDetectorRef.current.detectForVideo(previewVideoRef.current, startTimeMs)
              
              if (results.detections && results.detections.length > 0) {
                // Get largest face
                const bestDetection = results.detections.reduce((prev, current) => {
                  return (prev.boundingBox.width * prev.boundingBox.height > current.boundingBox.width * current.boundingBox.height) ? prev : current
                })

                const faceCenterX = bestDetection.boundingBox.originX / previewVideoRef.current.videoWidth + (bestDetection.boundingBox.width / previewVideoRef.current.videoWidth) / 2.0
                const rawOffset = (faceCenterX - 0.5) * 2.0

                if (baselineOffsetRef.current === null) {
                  baselineOffsetRef.current = rawOffset
                }

                const relativeOffset = rawOffset - baselineOffsetRef.current
                const smoothedOffset = (0.5 * prevRelativeOffsetRef.current) + (0.5 * relativeOffset)
                prevRelativeOffsetRef.current = smoothedOffset

                const threshold = 0.12
                const hysteresis = 0.03
                let direction = 'center'

                if (smoothedOffset > (threshold + hysteresis)) {
                  direction = 'right'
                } else if (smoothedOffset < -(threshold + hysteresis)) {
                  direction = 'left'
                }

                if (Math.abs(smoothedOffset) < threshold) {
                  baselineOffsetRef.current = (0.99 * baselineOffsetRef.current) + (0.01 * rawOffset)
                }

                if (direction !== lastDirectionRef.current || Math.abs(smoothedOffset - lastSentOffsetRef.current) > 0.05) {
                  lastDirectionRef.current = direction
                  lastSentOffsetRef.current = smoothedOffset
                  
                  const maxTilt = Math.PI / 2.0
                  const scaledTilt = THREE.MathUtils.clamp(-smoothedOffset * 4.0, -1, 1) * maxTilt
                  setHeadRotation(scaledTilt)
                }
              } else {
                prevRelativeOffsetRef.current *= 0.8
                if (Math.abs(prevRelativeOffsetRef.current) < 0.05) {
                  setHeadRotation(0)
                  lastDirectionRef.current = 'center'
                }
              }
            }
          }
          animationFrameRef.current = requestAnimationFrame(processFrame)
        }
        
        processFrame()

      } catch (err) {
        console.error(err)
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
  }, [cameraModeEnabled, gameState.hasStarted, stopHeadTracking])

  return {
    webcamStatus,
    headRotation,
    setHeadRotation,
    previewVideoRef,
    stopHeadTracking
  }
}
