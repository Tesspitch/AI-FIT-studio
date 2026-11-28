import type { ManeevejExercise, ManeevejFrame } from './maneevej'

type ExerciseId = ManeevejExercise['id']
type Arm = NonNullable<ManeevejFrame['left']>
export type PhaseQuality = { motion: number; control: number }
export type RoundQuality = PhaseQuality & { sequence: number; nextStep: number | null }

const clamp = (value: number) => Math.max(0, Math.min(100, value))
const near = (value: number, target: number, tolerance: number) => clamp(100 * (1 - Math.abs(value - target) / tolerance))
const atLeast = (value: number, target: number, tolerance: number) => near(Math.min(value, target), target, tolerance)
const atMost = (value: number, target: number, tolerance: number) => near(Math.max(value, target), target, tolerance)
const mean = (values: readonly number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

const down = (arm: Arm) => atMost(arm.elevation, 12, 45)
const straight = (arm: Arm) => atMost(arm.flexion, 12, 65)
const folded = (arm: Arm) => near(arm.flexion, 85, 65)
const shoulderLevel = (arm: Arm) => near(arm.height, 0, 0.8)
const high = (arm: Arm, _spread: number, head: number) => mean([
  atLeast(arm.elevation, 155, 60), straight(arm), atLeast(arm.height, head + 0.18, 0.75),
])
const out = (arm: Arm, spread: number) => mean([straight(arm), atLeast(spread, 1.7, 1.2), atLeast(arm.elevation, 100, 55)])
const push = (arm: Arm) => mean([straight(arm), atLeast(arm.forward, 0.9, 0.7), shoulderLevel(arm)])

type MotionTarget = (arm: Arm, spread: number, head: number) => number
const motionTargets: Record<ExerciseId, readonly MotionTarget[]> = {
  sawasdee: [
    (arm) => mean([down(arm), straight(arm)]), high, out, down,
  ],
  'mo-paeng': [
    push,
    (arm, spread) => mean([straight(arm), shoulderLevel(arm), atLeast(spread, 2, 1.4)]),
    (arm) => mean([folded(arm), shoulderLevel(arm)]),
    (arm, spread) => mean([folded(arm), shoulderLevel(arm), atMost(spread, 0.8, 0.8)]),
  ],
  'remove-shirt': [high, out, down],
  backstroke: [
    (arm) => near(arm.direction, 90, 100),
    (arm) => atLeast(arm.elevation, 165, 55),
    (arm) => near(arm.direction, -85, 100),
    down,
  ],
  'release-energy': [high, (arm) => mean([folded(arm), shoulderLevel(arm)]), push],
}

export function measurePhaseQuality(id: ExerciseId, stage: number, pose: ManeevejFrame, side: 'left' | 'right' | null): PhaseQuality | null {
  const target = motionTargets[id][stage - 1]
  if (!target) return null
  if (id === 'backstroke') {
    const arm = side && pose[side]
    return arm ? {
      motion: target(arm, 0, pose.headHeight),
      control: mean([straight(arm), atMost(arm.planeDeviation ?? 0, 12, 50)]),
    } : null
  }
  const { left, right, spread, headHeight } = pose
  if (!left || !right || spread === null) return null
  return {
    motion: mean([target(left, spread, headHeight), target(right, spread, headHeight)]),
    control: mean([near(left.elevation - right.elevation, 0, 55), near(left.height - right.height, 0, 0.8)]),
  }
}

export function measureRoundQuality(exercise: ManeevejExercise, phases: readonly PhaseQuality[], started = false): RoundQuality {
  const completed = phases.length
  const sequence = Math.round(100 * completed / (exercise.steps.length - 1))
  return {
    sequence,
    motion: completed ? Math.round(mean(phases.map(({ motion }) => motion))) : 0,
    control: completed ? Math.round(mean(phases.map(({ control }) => control))) : 0,
    nextStep: completed === 0 && !started ? 0 : completed < exercise.steps.length - 1 ? completed + 1 : null,
  }
}

export function qualityScore({ sequence, motion, control }: RoundQuality) {
  return Math.round((sequence * 0.5 + motion * 0.35 + control * 0.15) * 10) / 10
}

export function phaseQualityValue({ motion, control }: PhaseQuality) {
  return motion * 0.35 + control * 0.15
}

export function roundQualityTip(exercise: ManeevejExercise, quality: RoundQuality) {
  if (quality.nextStep !== null) return `ขั้นต่อไปที่กล้องยังตรวจไม่พบ · ${exercise.steps[quality.nextStep]}`
  if (Math.min(quality.motion, quality.control) >= 90) return 'ตรวจพบขั้นตอนครบและการเคลื่อนไหวใกล้ช่วงเป้าหมาย'
  if (quality.motion <= quality.control) return 'ตรวจพบขั้นตอนครบ · ลองขยับตามมุมและช่วงเคลื่อนไหวในคลิป'
  return exercise.id === 'backstroke'
    ? 'ตรวจพบขั้นตอนครบ · ลองรักษาแนวการหมุนและควบคุมการเหยียดแขน'
    : 'ตรวจพบขั้นตอนครบ · ลองให้แขนสองข้างเคลื่อนพร้อมกันและอยู่ใกล้ระดับเดียวกัน'
}
