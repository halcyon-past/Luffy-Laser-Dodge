import React, { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'

export default function Luffy({ headRotation, isHit }) {
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

useGLTF.preload('/luffy/scene.gltf')
