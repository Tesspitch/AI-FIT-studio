import { supabase } from '../../lib/supabase'
import type { RoundResult } from '../pose/maneevej-session'

export type ManeevejWorkout = { id: string; startedAt: number; endedAt: number; rounds: RoundResult[] }

export async function saveManeevejRoutine(workout: ManeevejWorkout) {
  if (!supabase) throw new Error('Supabase is unavailable')
  const { data, error } = await supabase.rpc('save_maneevej_routine_v2', {
    p_session_id: workout.id,
    p_started_at: new Date(workout.startedAt).toISOString(),
    p_ended_at: new Date(workout.endedAt).toISOString(),
    p_rounds: workout.rounds.map(({ elapsedMs, score, quality }) => ({
      elapsed_ms: Math.round(elapsedMs), score, completed: quality?.sequence === 100,
    })),
  })
  if (error) throw error
  if (data !== workout.id) throw new Error('Unexpected saved workout ID')
}
