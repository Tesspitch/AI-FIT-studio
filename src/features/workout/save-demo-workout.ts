import { supabase } from '../../lib/supabase'

type WorkoutRep = { score: number; peak_angle: number; duration_ms: number }

export type DemoWorkout = {
  id: string
  startedAt: number
  reps: WorkoutRep[]
}

export type CompletedDemoWorkout = DemoWorkout & { endedAt: number }

export async function saveDemoWorkout(workout: CompletedDemoWorkout) {
  if (!supabase) throw new Error('Supabase is unavailable')
  const { data, error } = await supabase.rpc('save_shoulder_raise_demo', {
    session_id: workout.id,
    started_at: new Date(workout.startedAt).toISOString(),
    ended_at: new Date(workout.endedAt).toISOString(),
    reps: workout.reps,
  })
  if (error) throw error
  if (data !== workout.id) throw new Error('Unexpected saved workout ID')
  return workout.id
}
