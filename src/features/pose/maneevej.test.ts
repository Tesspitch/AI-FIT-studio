import { describe, expect, it } from 'vitest'
import { createManeevejTracker, maneevejExercises, measureManeevej, updateManeevej, type ManeevejFrame } from './maneevej'
import { measureRoundQuality, qualityScore } from './maneevej-scoring'

function frame(elevation: number, flexion: number, height: number, forward: number, spread: number,
  direction = 0): ManeevejFrame {
  const arm = { elevation, flexion, height, forward, direction }
  return { left: arm, right: arm, spread, headHeight: 0.56 }
}

const rest = frame(12, 10, -1, 0, 0.95)
const overhead = frame(161, 15, 0.95, 0.18, 0.35)
const openHigh = frame(120, 20, 0.65, 0, 1.6)
const chest = frame(35, 95, -0.25, 0.4, 0.32)
const shoulder = frame(80, 85, 0.05, 0.36, 0.65)
const push = frame(88, 15, 0, 0.96, 0.72)
const open = frame(89, 18, 0, 0.03, 2.6)
const drawBack = frame(78, 95, 0, 0.21, 1.5)
const armCircle = (degrees: number, forward: number, side: 'left' | 'right'): ManeevejFrame => ({
  ...rest, [side]: { elevation: Math.abs(degrees), flexion: 15, height: 0, forward, direction: degrees },
})

const movements: ManeevejFrame[][] = [
  [chest, rest, overhead, openHigh, rest],
  [shoulder, push, open, drawBack, shoulder],
  [chest, overhead, openHigh, rest],
  [rest, armCircle(75, 0.8, 'right'), armCircle(158, 0.2, 'right'), armCircle(-83, -0.4, 'right'), rest],
  [rest, overhead, frame(78, 90, 0.05, 0.35, 1.45), push],
]

describe('Maneevej tracking', () => {
  it.each(maneevejExercises.map((exercise, index) => [exercise.id, movements[index]] as const))(
    'counts a complete ordered sequence once for %s', (id, sequence) => {
      const tracker = createManeevejTracker()
      let time = 0
      for (const pose of [...sequence, sequence.at(-1)!]) {
        updateManeevej(id, tracker, pose, time)
        updateManeevej(id, tracker, pose, time + 110)
        time += 150
      }
      expect(tracker.reps).toBe(1)
      const exercise = maneevejExercises.find((exercise) => exercise.id === id)!
      expect(measureRoundQuality(exercise, tracker.bestPhases).sequence).toBe(100)
    },
  )

  it('distinguishes two completed rounds by motion and symmetry', () => {
    const exercise = maneevejExercises[0]
    function assess(sequence: ManeevejFrame[]) {
      const tracker = createManeevejTracker()
      sequence.forEach((frame, index) => {
        updateManeevej(exercise.id, tracker, frame, index * 150)
        updateManeevej(exercise.id, tracker, frame, index * 150 + 110)
      })
      return measureRoundQuality(exercise, tracker.bestPhases)
    }
    const ideal = assess([chest, rest, overhead, openHigh, rest])
    const shallow = frame(134, 35, 0.55, 0.18, 0.35)
    shallow.right = overhead.right
    const imperfect = assess([chest, rest, shallow, openHigh, rest])
    expect(imperfect.sequence).toBe(100)
    expect(imperfect.motion).toBeLessThan(ideal.motion)
    expect(imperfect.control).toBeLessThan(ideal.control)
    expect(qualityScore(imperfect)).toBeLessThan(qualityScore(ideal))
    const partial = assess([chest, rest, overhead])
    expect(partial).toMatchObject({ sequence: 50, nextStep: 3 })
    expect(qualityScore(partial)).toBeGreaterThan(0)
  })

  it('drops a partial sequence when landmarks go missing', () => {
    const id = maneevejExercises[0].id
    const tracker = createManeevejTracker()
    updateManeevej(id, tracker, chest, 0)
    updateManeevej(id, tracker, chest, 110)
    updateManeevej(id, tracker, null, 150)
    for (const [index, pose] of [rest, overhead, openHigh, rest].entries()) {
      updateManeevej(id, tracker, pose, 200 + index * 150)
      updateManeevej(id, tracker, pose, 310 + index * 150)
    }
    expect(tracker.reps).toBe(0)
  })

  it('rejects a pose with missing landmarks', () => {
    expect(measureManeevej([], [])).toBeNull()
  })

  it('treats motion toward the camera as forward for a front-facing user', () => {
    const world = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }))
    const image = world.map(() => ({ x: 0.5, y: 0.5, visibility: 1 }))
    Object.assign(world[0], { y: -1.3, z: -0.16 })
    Object.assign(world[11], { x: 0.25, y: -1 })
    Object.assign(world[12], { x: -0.25, y: -1 })
    Object.assign(world[13], { x: 0.25, y: -1, z: -0.25 })
    Object.assign(world[14], { x: -0.25, y: -1, z: -0.25 })
    Object.assign(world[15], { x: 0.25, y: -1, z: -0.5 })
    Object.assign(world[16], { x: -0.25, y: -1, z: -0.5 })
    Object.assign(world[23], { x: 0.2 })
    Object.assign(world[24], { x: -0.2 })
    const pose = measureManeevej(image, world)
    expect(pose?.right?.forward).toBeCloseTo(1)
    expect(pose?.right?.elevation).toBeCloseTo(90)
    expect(pose?.right?.flexion).toBeCloseTo(0)
    expect(pose?.right?.direction).toBeCloseTo(90)
  })
})
