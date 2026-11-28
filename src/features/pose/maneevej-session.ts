import { maneevejExercises } from './maneevej'
import { qualityScore, type RoundQuality } from './maneevej-scoring'

export const roundsPerExercise = 2
export const totalRounds = maneevejExercises.length * roundsPerExercise

export const maneevejScoringVersion = 'maneevej-quality-v2'
export type RoundResult = { left: number; right: number; score: number | null; elapsedMs: number; quality?: RoundQuality | null }
export type RecordedRound = RoundResult & { roundIndex: number }

export function getRoundScore(quality: RoundQuality, visibleMs: number, durationMs: number) {
  if (quality.sequence !== 100 && visibleMs < durationMs / 2) return null
  return qualityScore(quality)
}

function averageScore(values: (number | null)[]) {
  const scored = values.filter((score) => score !== null)
  return scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length * 10) / 10 : null
}

export function summarizeManeevej(rounds: (RoundResult & { roundIndex?: number })[]) {
  const recorded = rounds.map((round, index) => ({ ...round, roundIndex: round.roundIndex ?? index }))
  const exercises = maneevejExercises.map(({ id, name }, index) => {
    const results = recorded.filter(({ roundIndex }) => Math.floor(roundIndex / roundsPerExercise) === index)
    return {
      id, name, rounds: results, score: averageScore(results.map(({ score }) => score)),
      durationMs: results.reduce((sum, round) => sum + round.elapsedMs, 0),
    }
  })
  return {
    exercises,
    score: averageScore(exercises.map(({ score }) => score)),
    durationMs: exercises.reduce((sum, exercise) => sum + exercise.durationMs, 0),
  }
}
type Session = {
  phase: 'ready' | 'active' | 'rest' | 'done'
  roundIndex: number
  rounds: RecordedRound[]
  restUntil: number | null
  testOnly: boolean
}
type Action =
  | { type: 'start'; roundIndex: number }
  | { type: 'rest-ended'; roundIndex: number; now: number }
  | { type: 'finish'; roundIndex: number; finishedAt: number; result: RoundResult; early?: boolean }
  | { type: 'skip-exercise'; roundIndex: number; result?: RoundResult }
  | { type: 'skip-rest'; roundIndex: number }
  | { type: 'restart' }

export const initialSession: Session = { phase: 'ready', roundIndex: 0, rounds: [], restUntil: null, testOnly: false }

export function getRestSeconds(completedRounds: number) {
  if (completedRounds <= 0 || completedRounds >= totalRounds) return 0
  return completedRounds % roundsPerExercise === 0 ? 30 : 15
}

export function getRoundSeconds(clipSeconds: number | null) {
  return clipSeconds !== null && Number.isFinite(clipSeconds) && clipSeconds > 0 ? clipSeconds + 2 : 25
}

export function routineReducer(state: Session, action: Action): Session {
  if (action.type === 'restart') return initialSession
  if (action.roundIndex !== state.roundIndex) return state
  if (action.type === 'start') {
    return state.phase === 'ready' ? { ...state, phase: 'active', restUntil: null } : state
  }
  if (action.type === 'rest-ended') {
    return state.phase === 'rest' && state.restUntil !== null && action.now >= state.restUntil
      ? { ...state, phase: 'active', restUntil: null }
      : state
  }
  if (action.type === 'skip-rest') {
    return state.phase === 'rest' ? { ...state, phase: 'active', restUntil: null, testOnly: true } : state
  }
  if (action.type === 'skip-exercise') {
    if (state.phase !== 'active') return state
    const roundIndex = (Math.floor(state.roundIndex / roundsPerExercise) + 1) * roundsPerExercise
    const rounds = action.result ? [...state.rounds, { ...action.result, roundIndex: state.roundIndex }] : state.rounds
    return { ...state, rounds, roundIndex, phase: roundIndex === totalRounds ? 'done' : 'active', testOnly: true }
  }
  if (state.phase !== 'active') return state
  const roundIndex = state.roundIndex + 1
  const rounds = [...state.rounds, { ...action.result, roundIndex: state.roundIndex }]
  const restSeconds = action.early ? 0 : getRestSeconds(roundIndex)
  return {
    ...state,
    phase: roundIndex === totalRounds ? 'done' : restSeconds > 0 ? 'rest' : 'active',
    roundIndex,
    rounds,
    restUntil: restSeconds ? action.finishedAt + restSeconds * 1000 : null,
    testOnly: state.testOnly || Boolean(action.early),
  }
}

export function formatRoutineTime(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000)
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
}
