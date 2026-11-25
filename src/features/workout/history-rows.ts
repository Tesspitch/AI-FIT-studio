export type HistorySession = {
  id: string
  started_at: string
  total_reps: number
  overall_score: number | null
  workout_exercises: {
    id: string
    exercise_id: string
    total_reps: number
    exercises: { name: string } | { name: string }[] | null
    rep_evaluations: { rep_number: number; form_score: number; feedback: unknown }[]
  }[]
}

type HistoryRow = { exerciseId: string; name: string; reps: number; session: HistorySession }

const dayFormat = new Intl.DateTimeFormat('en-CA', { dateStyle: 'short' })

export function exerciseName(entry: HistorySession['workout_exercises'][number]) {
  return (Array.isArray(entry.exercises) ? entry.exercises[0] : entry.exercises)?.name ?? 'ท่าออกกำลังกาย'
}

export function buildHistoryRows(newestFirst: HistorySession[]) {
  const rows: HistoryRow[] = []
  const sameDay = new Map<string, HistoryRow[]>()

  for (const session of newestFirst.slice().reverse()) {
    const sessionRows = new Map<string, HistoryRow>()
    for (const entry of session.workout_exercises) {
      const previous = sessionRows.get(entry.exercise_id)
      const reps = (previous?.reps ?? 0) + entry.total_reps
      sessionRows.set(entry.exercise_id, {
        exerciseId: entry.exercise_id, name: exerciseName(entry), reps, session,
      })
    }
    if (sessionRows.size === 0) sessionRows.set('unspecified', {
      exerciseId: 'unspecified', name: 'การฝึกที่ไม่ระบุท่า', reps: session.total_reps, session,
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
