import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export type Exercise = {
  id: string
  name: string
  description: string | null
  camera_view: string | null
  reference_video_key: string | null
}

export function useExercises() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [status, setStatus] = useState<'pending' | 'loading' | 'ready' | 'error'>(supabase ? 'loading' : 'pending')

  useEffect(() => {
    if (!supabase) return
    const controller = new AbortController()
    async function load() {
      try {
        const { data, error } = await supabase!
          .from('exercises')
          .select('id, name, description, camera_view, reference_video_key')
          .eq('is_active', true)
          .order('name')
          .abortSignal(controller.signal)
        if (controller.signal.aborted) return
        if (error) throw error
        setExercises(data)
        setStatus('ready')
      } catch {
        if (!controller.signal.aborted) setStatus('error')
      }
    }
    void load()
    return () => controller.abort()
  }, [])

  return { exercises, status }
}
