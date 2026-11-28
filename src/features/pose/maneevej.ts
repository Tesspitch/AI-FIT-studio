import { canDrawLandmark } from './quality'
import { measurePhaseQuality, phaseQualityValue, type PhaseQuality } from './maneevej-scoring'

export const maneevejSetUrl = '/studio?routine=maneevej'

export const maneevejExercises = [
  {
    id: 'sawasdee', name: 'ท่าสวัสดี', view: 'ด้านหน้า',
    steps: ['ประนมมือไว้หน้ากลางอก', 'เหยียดแขนลง', 'ยกมือเหนือศีรษะ', 'แยกมือออก', 'ลดแขนกลับข้างลำตัว'],
  },
  {
    id: 'mo-paeng', name: 'ท่าโม่แป้ง', view: 'เฉียงด้านหน้า',
    steps: ['งอศอก วางมือไว้ด้านหน้าใกล้ระดับไหล่', 'ดันมือไปด้านหน้า', 'กางแขนออก', 'งอศอกดึงกลับ', 'กลับสู่ท่าเริ่ม'],
  },
  {
    id: 'remove-shirt', name: 'ท่าถอดเสื้อ', view: 'เฉียงด้านหน้า',
    steps: ['งอศอกยกมือไว้หน้าลำตัว', 'ชูมือทั้งสองเหนือศีรษะ', 'แยกมือแล้ววาดแขนลง', 'ลดแขนกลับข้างลำตัว'],
  },
  {
    id: 'backstroke', name: 'ท่ากรรเชียง', view: 'ด้านข้างฝั่งแขนที่ฝึก',
    steps: ['ปล่อยแขนข้างที่ฝึกไว้ข้างลำตัว', 'ยกแขนไปด้านหน้า', 'วาดแขนผ่านเหนือศีรษะ', 'วาดแขนไปด้านหลัง', 'ลดแขนกลับข้างลำตัว'],
  },
  {
    id: 'release-energy', name: 'ท่าปล่อยพลัง', view: 'เฉียงด้านหน้า',
    steps: ['ปล่อยแขนไว้ข้างลำตัว', 'ยกมือเหนือศีรษะ', 'งอศอกลดมือมาที่ระดับไหล่', 'ดันมือทั้งสองไปด้านหน้า'],
  },
] as const

export type ManeevejExercise = (typeof maneevejExercises)[number]
type ExerciseId = ManeevejExercise['id']
type Side = 'left' | 'right'
type Point = { x: number; y: number; z: number }
type Arm = { elevation: number; flexion: number; height: number; forward: number; direction: number; planeDeviation?: number }
export type ManeevejFrame = { left: Arm | null; right: Arm | null; spread: number | null; headHeight: number }

const radiansToDegrees = 180 / Math.PI
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 })
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Point, b: Point): Point => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x })
const length = (point: Point) => Math.hypot(point.x, point.y, point.z)
const angle = (a: Point, b: Point) => Math.atan2(length(cross(a, b)), dot(a, b)) * radiansToDegrees

function unit(point: Point) {
  const magnitude = length(point)
  return magnitude > 1e-6 ? { x: point.x / magnitude, y: point.y / magnitude, z: point.z / magnitude } : null
}

export function measureManeevej(image: readonly Parameters<typeof canDrawLandmark>[0][], world: readonly Point[]): ManeevejFrame | null {
  const [leftShoulder, rightShoulder, leftHip, rightHip] = [11, 12, 23, 24].map((index) => world[index])
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null
  const shoulders = midpoint(leftShoulder, rightShoulder)
  const across = subtract(leftShoulder, rightShoulder)
  const width = length(across)
  const up = unit(subtract(shoulders, midpoint(leftHip, rightHip)))
  if (!up || !Number.isFinite(width) || width < 1e-6) return null
  const forward = unit(cross(across, up))
  if (!forward) return null
  const down = { x: -up.x, y: -up.y, z: -up.z }

  function measureArm(shoulder: number, elbow: number, wrist: number, hip: number) {
    if (![shoulder, elbow, wrist, hip].every((index) => canDrawLandmark(image[index]) && world[index])) return null
    const upper = subtract(world[elbow], world[shoulder])
    const forearm = subtract(world[wrist], world[elbow])
    const upperUnit = unit(upper)
    if (!upperUnit || !unit(forearm)) return null
    const hand = subtract(world[wrist], world[shoulder])
    return {
      elevation: angle(upper, down),
      flexion: angle(upper, forearm),
      height: dot(hand, up!) / width,
      forward: dot(hand, forward!) / width,
      direction: Math.atan2(dot(upper, forward!), dot(upper, down)) * radiansToDegrees,
      planeDeviation: Math.acos(Math.min(1, Math.hypot(dot(upperUnit, forward!), dot(upperUnit, down)))) * radiansToDegrees,
    }
  }

  const left = measureArm(11, 13, 15, 23)
  const right = measureArm(12, 14, 16, 24)
  if (!left && !right) return null
  const estimatedHead = canDrawLandmark(image[0]) && world[0] ? dot(subtract(world[0], shoulders), up) / width : NaN
  const headHeight = Number.isFinite(estimatedHead) ? estimatedHead : 0.56
  return { left, right, headHeight, spread: left && right ? length(subtract(world[15], world[16])) / width : null }
}

type Bilateral = (left: Arm, right: Arm, spread: number, headHeight: number) => boolean
const both = (left: Arm, right: Arm, check: (arm: Arm) => boolean) => check(left) && check(right)
const atRest = (arm: Arm) => arm.elevation <= 30 && arm.height < -0.35
const armsDown: Bilateral = (left, right) => both(left, right, atRest)
const overhead: Bilateral = (left, right, _spread, head) =>
  both(left, right, (arm) => arm.elevation >= 130 && arm.flexion <= 40 && arm.height >= Math.max(0.48, head - 0.08))
const splitHigh: Bilateral = (left, right, spread) => spread >= 1.35 &&
  both(left, right, (arm) => arm.elevation >= 80 && arm.height >= 0.12)
const bentAtShoulder: Bilateral = (left, right) =>
  both(left, right, (arm) => arm.flexion >= 55 && Math.abs(arm.height) <= 0.45 && arm.forward >= 0.12)
const push: Bilateral = (left, right) =>
  both(left, right, (arm) => arm.flexion <= 38 && arm.forward >= 0.63 && Math.abs(arm.height) <= 0.45)
const rules: Record<Exclude<ExerciseId, 'backstroke'>, readonly Bilateral[]> = {
  sawasdee: [
    (left, right, spread) => spread <= 0.58 && both(left, right, (arm) => arm.flexion >= 55 && arm.height >= -0.58 && arm.height <= 0.25 && arm.forward >= 0.12),
    (left, right, spread) => spread <= 1 && both(left, right, (arm) => atRest(arm) && arm.flexion <= 35),
    overhead, splitHigh, armsDown,
  ],
  'mo-paeng': [
    bentAtShoulder, push,
    (left, right, spread) => spread >= 1.65 && both(left, right, (arm) => arm.flexion <= 45 && Math.abs(arm.height) <= 0.45),
    (left, right, spread) => spread >= 1.05 && both(left, right, (arm) => arm.flexion >= 55 && Math.abs(arm.height) <= 0.5),
    (left, right, spread, head) => spread < 1.05 && bentAtShoulder(left, right, spread, head),
  ],
  'remove-shirt': [
    (left, right, spread) => spread <= 1.05 && both(left, right, (arm) => arm.flexion >= 55 && arm.height >= -0.55 && arm.height <= 0.25 && arm.forward >= 0.1),
    (left, right, spread, head) => Math.abs(left.height - right.height) <= 0.35 && overhead(left, right, spread, head),
    splitHigh, armsDown,
  ],
  'release-energy': [
    armsDown, overhead,
    (left, right) => both(left, right, (arm) => arm.flexion >= 55 && Math.abs(arm.height) <= 0.4 && arm.elevation >= 55),
    push,
  ],
}

const circleRules: readonly ((arm: Arm) => boolean)[] = [
  (arm) => arm.elevation <= 28,
  (arm) => arm.direction >= 45 && arm.direction <= 135,
  (arm) => arm.elevation >= 140,
  (arm) => arm.direction <= -35 && arm.direction >= -135,
  (arm) => arm.elevation <= 28,
]

export function createManeevejTracker() {
  return { stage: 0, reps: 0, left: 0, right: 0, stableSince: null as number | null,
    timestamp: null as number | null, side: null as Side | null, candidate: null as Side | null, tracking: false,
    phases: [] as PhaseQuality[], bestPhases: [] as PhaseQuality[] }
}

export type ManeevejTracker = ReturnType<typeof createManeevejTracker>

export function updateManeevej(id: ExerciseId, tracker: ManeevejTracker, pose: ManeevejFrame | null, timestamp: number) {
  const isCircle = id === 'backstroke'
  const usable = Boolean(pose && (isCircle
    ? (tracker.side ? pose[tracker.side] : pose.left || pose.right)
    : pose.left && pose.right && pose.spread !== null))
  if (!usable || (tracker.timestamp !== null && timestamp - tracker.timestamp > 250)) {
    tracker.stage = 0
    tracker.stableSince = null
    tracker.side = null
    tracker.candidate = null
    tracker.phases = []
  }
  tracker.timestamp = timestamp
  tracker.tracking = usable
  if (!pose || !usable) return

  function preserveBest() {
    if (tracker.phases.length > tracker.bestPhases.length ||
      (tracker.phases.length === tracker.bestPhases.length &&
        tracker.phases.reduce((sum, phase) => sum + phaseQualityValue(phase), 0) >
        tracker.bestPhases.reduce((sum, phase) => sum + phaseQualityValue(phase), 0))) {
      tracker.bestPhases = tracker.phases.slice()
    }
  }

  const previousStage = tracker.stage - 1
  const lastQuality = tracker.phases.at(-1)
  if (previousStage > 0 && lastQuality) {
    const arm = tracker.side && pose[tracker.side]
    const staysInPreviousStage = isCircle ? arm && circleRules[previousStage](arm)
      : rules[id][previousStage](pose.left!, pose.right!, pose.spread!, pose.headHeight)
    const refined = staysInPreviousStage ? measurePhaseQuality(id, previousStage, pose, tracker.side) : null
    if (refined && phaseQualityValue(refined) > phaseQualityValue(lastQuality)) {
      tracker.phases[tracker.phases.length - 1] = refined
      preserveBest()
    }
  }

  let side = tracker.side
  let matches: boolean
  const steps = isCircle ? circleRules.length : rules[id].length
  if (isCircle) {
    const test = circleRules[tracker.stage]
    const leftMatches = Boolean(pose.left && test(pose.left))
    const rightMatches = Boolean(pose.right && test(pose.right))
    if (tracker.stage === 1 && !side) side = leftMatches ? 'left' : rightMatches ? 'right' : null
    matches = side ? (side === 'left' ? leftMatches : rightMatches) : leftMatches || rightMatches
    if (tracker.stage === 1 && !side) matches = false
  } else {
    matches = rules[id][tracker.stage](pose.left!, pose.right!, pose.spread!, pose.headHeight)
  }

  if (!matches || side !== tracker.candidate) tracker.stableSince = null
  tracker.candidate = side
  if (!matches) return
  tracker.stableSince ??= timestamp
  if (timestamp - tracker.stableSince < 90) return
  tracker.stableSince = null
  tracker.side = side
  const quality = measurePhaseQuality(id, tracker.stage, pose, side)
  if (quality) {
    tracker.phases.push(quality)
    preserveBest()
  }
  tracker.stage += 1
  if (tracker.stage < steps) return
  tracker.reps += 1
  if (side) tracker[side] += 1
  tracker.stage = 0
  tracker.side = null
  tracker.candidate = null
  tracker.phases = []
}
