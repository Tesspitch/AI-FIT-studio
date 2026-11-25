import { canDrawLandmark } from './quality'

type Point3D = { x: number; y: number; z: number }
type Phase = 'rest' | 'lift' | 'lower'

export const shoulderRaiseDemo = {
  id: 'demo-right-shoulder-raise',
  name: 'กางแขนขวาถึงระดับไหล่',
  restAngle: 25,
  liftAngle: 75,
  targetAngle: 90,
  scoreRange: 45,
  stableMs: 120,
  maxFrameGapMs: 250,
}

type ShoulderRaiseState = {
  phase: Phase
  angle: number | null
  peak: number
  stableSince: number | null
  movementStartedAt: number | null
  timestamp: number | null
  reps: number
  lastPeak: number | null
  lastScore: number | null
  lastDurationMs: number | null
}

export const initialShoulderRaise: ShoulderRaiseState = {
  phase: 'rest', angle: null, peak: 0, stableSince: null, movementStartedAt: null, timestamp: null,
  reps: 0, lastPeak: null, lastScore: null, lastDurationMs: null,
}

export function measureShoulderRaise(
  image: readonly Parameters<typeof canDrawLandmark>[0][],
  world: readonly Point3D[],
) {
  const rightJoints = [12, 14, 24] as const
  if (!rightJoints.every((index) => canDrawLandmark(image[index]))) return null
  const [shoulder, elbow, hip] = rightJoints.map((index) => world[index])
  if (!shoulder || !elbow || !hip) return null

  const arm = [elbow.x - shoulder.x, elbow.y - shoulder.y, elbow.z - shoulder.z] as const
  const trunk = [hip.x - shoulder.x, hip.y - shoulder.y, hip.z - shoulder.z] as const
  const lengthProduct = Math.hypot(...arm) * Math.hypot(...trunk)
  if (!Number.isFinite(lengthProduct) || lengthProduct < 1e-6) return null
  const dot = arm[0] * trunk[0] + arm[1] * trunk[1] + arm[2] * trunk[2]
  return Math.acos(Math.max(-1, Math.min(1, dot / lengthProduct))) * 180 / Math.PI
}

export function updateShoulderRaise(previous: ShoulderRaiseState, angle: number | null, timestamp: number): ShoulderRaiseState {
  const { restAngle, liftAngle, targetAngle, scoreRange, stableMs, maxFrameGapMs } = shoulderRaiseDemo
  const state = { ...previous, timestamp, angle }
  if (angle === null || (previous.timestamp !== null && timestamp - previous.timestamp > maxFrameGapMs)) {
    state.phase = 'rest'
    state.peak = 0
    state.stableSince = null
    state.movementStartedAt = null
  }
  if (angle === null) return state

  if (state.phase === 'lift') {
    state.movementStartedAt = angle > restAngle ? (state.movementStartedAt ?? timestamp) : null
    state.peak = angle >= liftAngle ? Math.max(state.peak, angle) : 0
  } else if (state.phase === 'lower') {
    state.peak = Math.max(state.peak, angle)
  }

  const atThreshold = state.phase === 'lift' ? angle >= liftAngle : angle <= restAngle
  state.stableSince = atThreshold ? (state.stableSince ?? timestamp) : null
  if (state.stableSince === null || timestamp - state.stableSince < stableMs) return state
  state.stableSince = null

  switch (state.phase) {
    case 'rest':
      state.phase = 'lift'
      break
    case 'lift':
      state.phase = 'lower'
      break
    case 'lower':
      state.reps += 1
      state.lastPeak = Math.round(state.peak)
      state.lastScore = Math.round(100 * Math.max(0, 1 - Math.abs(state.peak - targetAngle) / scoreRange))
      state.lastDurationMs = Math.max(1, Math.round(timestamp - (state.movementStartedAt ?? timestamp)))
      state.movementStartedAt = null
      state.peak = 0
      state.phase = 'lift'
      break
  }
  return state
}
