import { describe, expect, it } from 'vitest'
import { initialShoulderRaise, measureShoulderRaise, updateShoulderRaise } from './shoulder-raise'

const image = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }))
const pose = (values: (number | null)[]) => values.reduce(
  (state, angle, index) => updateShoulderRaise(state, angle, index * 60),
  initialShoulderRaise,
)

describe('shoulder raise demo', () => {
  it('uses the right shoulder as the vertex and rejects unreliable points', () => {
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    world[14].x = -1
    world[24].y = 1
    expect(measureShoulderRaise(image, world)).toBe(90)
    const obstructed = [...image]
    obstructed[14] = { ...image[14], visibility: 0.2 }
    expect(measureShoulderRaise(obstructed, world)).toBeNull()
    expect(measureShoulderRaise(image, [])).toBeNull()
    world[14].x = 0
    expect(measureShoulderRaise(image, world)).toBeNull()
  })

  it('scores a complete round once and preserves the result while resting', () => {
    expect(pose([10, 10, 10, 60, 85, 88, 90, 55, 10, 10, 10, 10])).toMatchObject({
      reps: 1, lastScore: 100, lastPeak: 90, lastDurationMs: 420,
    })
    expect(pose([10, 10, 10, 80, 80, 80, 10, 10, 10])).toMatchObject({
      reps: 1, lastScore: 78, lastPeak: 80,
    })
  })

  it('drops partial reps, brief spikes and rounds interrupted by missing landmarks', () => {
    expect(pose([10, 10, 10, 60, 85, 60, 10, 10, 10]).reps).toBe(0)
    expect(pose([90, 90, 90, 10, 10, 10]).reps).toBe(0)
    expect(pose([10, 10, 10, 90, 90, 90, null, 10, 10, 10]).reps).toBe(0)
  })

  it('drops an unfinished rep across a long gap between frames', () => {
    const raised = pose([10, 10, 10, 90, 90, 90])
    const resumed = updateShoulderRaise(raised, 10, 1000)
    expect(updateShoulderRaise(resumed, 10, 1120)).toMatchObject({ reps: 0, phase: 'lift' })
  })
})
