import { describe, expect, it } from 'vitest'
import { buildHistoryRows, type HistorySession } from './history-rows'

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
})
