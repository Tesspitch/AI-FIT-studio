import { describe, expect, it } from 'vitest'
import { assessPose, canDrawLandmark } from './quality'

const landmark = { x: 0.5, y: 0.5, visibility: 0.95 }

describe('pose quality', () => {
  it('distinguishes missing pose, incomplete framing and usable landmarks', () => {
    expect(assessPose([])).toBe('missing')
    const landmarks = Array.from({ length: 33 }, () => ({ ...landmark }))
    expect(assessPose(landmarks)).toBe('ready')
    landmarks[28] = { ...landmark, y: 1.2 }
    expect(assessPose(landmarks)).toBe('adjust')
  })

  it('filters unreliable points but tolerates unpublished confidence fields', () => {
    expect(canDrawLandmark({ x: 0.5, y: 0.5, presence: 0.2 })).toBe(false)
    expect(canDrawLandmark({ x: 0.5, y: 0.5, visibility: 0.2 })).toBe(false)
    expect(canDrawLandmark({ x: 0.5, y: 0.5 })).toBe(true)
    expect(canDrawLandmark({ x: Number.NaN, y: 0.5 })).toBe(false)
  })
})
