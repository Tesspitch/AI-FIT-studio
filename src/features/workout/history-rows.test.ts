import { describe, expect, it } from 'vitest'
import { buildHistoryRows, historyDurationMs, historyFilterOptions, matchesHistoryExercise, orderHistoryRows, parseHistorySort, type HistorySession } from './history-rows'

function session(id: string, day: number, hour: number, ...exerciseIds: string[]): HistorySession {
  return {
    id,
    started_at: new Date(2026, 10, day, hour).toISOString(),
    total_reps: exerciseIds.length * 5,
    overall_score: null,
    workout_exercises: exerciseIds.map((exerciseId, index) => ({
      id: `${id}-${index}`,
      exercise_id: exerciseId,
      total_reps: 5,
      exercises: { name: exerciseId },
      rep_evaluations: [],
    })),
  }
}

describe('exercise history rows', () => {
  it('keeps a routine grouped and uses active time while filtering by its exercises', () => {
    const completed = session('routine', 26, 15, 'สวัสดี', 'กรรเชียง')
    completed.scoring_version = 'maneevej-completion-v1'
    completed.ended_at = new Date(2026, 10, 26, 15, 10).toISOString()
    completed.workout_exercises[0].evaluation_config_snapshot = { duration_ms: 50000, position: 1 }
    completed.workout_exercises[1].evaluation_config_snapshot = { duration_ms: 54000, position: 2 }
    const rows = buildHistoryRows([completed])
    expect(rows.map(({ name }) => name)).toEqual(['ชุดบริหารมณีเวช'])
    expect(matchesHistoryExercise(rows[0], 'กรรเชียง')).toBe(true)
    expect(matchesHistoryExercise(rows[0], 'ปล่อยพลัง')).toBe(false)
    expect([...historyFilterOptions(rows).keys()]).toEqual(['maneevej', 'สวัสดี', 'กรรเชียง'])
    expect(historyDurationMs(completed)).toBe(104000)
  })
  it('shows one row per visit, numbering repeats on the same day from the earliest', () => {
    const rows = buildHistoryRows([
      session('d', 26, 0, 'ยกแขน'),
      session('c', 25, 23, 'ยกแขน'),
      session('b', 25, 13, 'ยกแขน'),
      session('a', 25, 9, 'ยกแขน'),
    ])

    expect(rows.map(({ name, session: { id } }) => [name, id])).toEqual([
      ['ยกแขน', 'd'], ['ยกแขน-3', 'c'], ['ยกแขน-2', 'b'], ['ยกแขน-1', 'a'],
    ])
  })

  it('keeps different exercises independent and combines repeat entries in one workout', () => {
    const rows = buildHistoryRows([
      session('b', 25, 16, 'ยกแขน', 'ยกแขน', 'หมุนไหล่'),
      session('a', 25, 9),
    ])
    expect(rows.find(({ exerciseId }) => exerciseId === 'ยกแขน')).toMatchObject({ reps: 10, name: 'ยกแขน' })
    expect(rows.map(({ name }) => name)).toContain('หมุนไหล่')
    expect(rows.map(({ name }) => name)).toContain('การฝึกที่ไม่ระบุท่า')
    expect(rows).toHaveLength(3)
  })

  it('sorts scores in either direction and keeps unrated workouts at the end', () => {
    const rows = buildHistoryRows([
      session('unrated', 25, 18, 'ยกแขน'),
      { ...session('new-high', 25, 17, 'ยกแขน'), overall_score: 90 },
      { ...session('zero', 25, 15, 'ยกแขน'), overall_score: 0 },
      { ...session('old-high', 25, 8, 'ยกแขน'), overall_score: 90 },
    ])
    expect(orderHistoryRows(rows, 'score-high').map(({ session }) => session.id))
      .toEqual(['new-high', 'old-high', 'zero', 'unrated'])
    expect(orderHistoryRows(rows, 'score-low').map(({ session }) => session.id))
      .toEqual(['zero', 'new-high', 'old-high', 'unrated'])
    expect(orderHistoryRows(rows, 'oldest').map(({ session }) => session.id))
      .toEqual(['old-high', 'zero', 'new-high', 'unrated'])
    expect(rows[0]).toMatchObject({ exerciseLabel: 'ยกแขน', name: 'ยกแขน-4' })
    expect(parseHistorySort('unknown')).toBe('recent')
  })
})
