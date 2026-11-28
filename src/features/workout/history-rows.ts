import { maneevejScoringVersion } from '../pose/maneevej-session'

export type HistorySession = {
  id: string
  started_at: string
  total_reps: number
  overall_score: number | null
  ended_at?: string | null
  scoring_version?: string | null
  workout_exercises: {
    id: string
    exercise_id: string
    total_reps: number
    overall_score?: number | null
    evaluation_config_snapshot?: unknown
    exercises: { name: string } | { name: string }[] | null
    rep_evaluations: { rep_number: number; form_score: number; feedback: unknown }[]
  }[]
}

type HistoryRow = { exerciseId: string; exerciseLabel: string; name: string; reps: number; session: HistorySession }
const maneevejGroupId = 'maneevej'
const maneevejGroupName = 'ชุดบริหารมณีเวช'

export function isManeevejSession(session: HistorySession) {
  return session.scoring_version === maneevejScoringVersion || session.scoring_version === 'maneevej-completion-v1'
}

function exerciseMetric(entry: HistorySession['workout_exercises'][number], key: string) {
  const config = entry.evaluation_config_snapshot
  const value = config && typeof config === 'object' && key in config ? config[key as keyof typeof config] : null
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

export function exerciseDurationMs(entry: HistorySession['workout_exercises'][number]) {
  return exerciseMetric(entry, 'duration_ms')
}

export function orderedRoutineExercises(session: HistorySession) {
  return session.workout_exercises.slice().sort((a, b) =>
    (exerciseMetric(a, 'position') ?? Infinity) - (exerciseMetric(b, 'position') ?? Infinity))
}

export function historyDurationMs(session: HistorySession) {
  if (isManeevejSession(session)) {
    const durations = session.workout_exercises.map(exerciseDurationMs)
    return durations.length > 0 && durations.every((duration) => duration !== null)
      ? durations.reduce((sum, duration) => sum + duration, 0) : null
  }
  const duration = session.ended_at ? Date.parse(session.ended_at) - Date.parse(session.started_at) : NaN
  return Number.isFinite(duration) && duration >= 0 ? duration : null
}

export function matchesHistoryExercise(row: HistoryRow, exerciseId: string) {
  return row.exerciseId === exerciseId || (isManeevejSession(row.session) &&
    row.session.workout_exercises.some((entry) => entry.exercise_id === exerciseId))
}

export function historyFilterOptions(rows: HistoryRow[]) {
  const options = new Map<string, string>()
  for (const row of rows) {
    options.set(row.exerciseId, row.exerciseLabel)
    if (isManeevejSession(row.session)) {
      for (const entry of orderedRoutineExercises(row.session)) options.set(entry.exercise_id, exerciseName(entry))
    }
  }
  return options
}

export const historySortOptions = [
  { value: 'recent', label: 'ล่าสุดก่อน' },
  { value: 'oldest', label: 'เก่าสุดก่อน' },
  { value: 'score-high', label: 'คะแนนสูงสุดก่อน' },
  { value: 'score-low', label: 'คะแนนต่ำสุดก่อน' },
] as const

export type HistorySort = typeof historySortOptions[number]['value']

export function parseHistorySort(value: string | null): HistorySort {
  return historySortOptions.find((option) => option.value === value)?.value ?? 'recent'
}

export function orderHistoryRows(rows: HistoryRow[], sort: HistorySort) {
  if (sort === 'recent') return rows
  if (sort === 'oldest') return rows.slice().reverse()
  const direction = sort === 'score-high' ? -1 : 1
  return rows.slice().sort((a, b) => {
    const aScore = a.session.overall_score
    const bScore = b.session.overall_score
    if (aScore === null) return bScore === null ? 0 : 1
    if (bScore === null) return -1
    return (aScore - bScore) * direction
  })
}

const dayFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short' })

export function exerciseName(entry: HistorySession['workout_exercises'][number]) {
  return (Array.isArray(entry.exercises) ? entry.exercises[0] : entry.exercises)?.name ?? 'ท่าออกกำลังกาย'
}

export function buildHistoryRows(newestFirst: HistorySession[]) {
  const rows: HistoryRow[] = []
  const sameDay = new Map<string, HistoryRow[]>()

  for (const session of newestFirst.slice().reverse()) {
    const sessionRows = new Map<string, HistoryRow>()
    if (isManeevejSession(session)) sessionRows.set(maneevejGroupId, {
      exerciseId: maneevejGroupId, exerciseLabel: maneevejGroupName,
      name: maneevejGroupName, reps: session.total_reps, session,
    })
    for (const entry of isManeevejSession(session) ? [] : session.workout_exercises) {
      const previous = sessionRows.get(entry.exercise_id)
      const reps = (previous?.reps ?? 0) + entry.total_reps
      const name = exerciseName(entry)
      sessionRows.set(entry.exercise_id, {
        exerciseId: entry.exercise_id, exerciseLabel: name, name, reps, session,
      })
    }
    if (sessionRows.size === 0) sessionRows.set('unspecified', {
      exerciseId: 'unspecified', exerciseLabel: 'การฝึกที่ไม่ระบุท่า',
      name: 'การฝึกที่ไม่ระบุท่า', reps: session.total_reps, session,
    })

    const day = dayFormat.format(new Date(session.started_at))
    for (const row of sessionRows.values()) {
      const key = `${day}/${row.exerciseId}`
      const matches = sameDay.get(key) ?? []
      matches.push(row)
      sameDay.set(key, matches)
      rows.push(row)
    }
  }

  for (const matches of sameDay.values()) {
    if (matches.length < 2) continue
    matches.forEach((row, index) => { row.name = `${row.name}-${index + 1}` })
  }
  return rows.reverse()
}
