import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

export const supabase = url && key ? createClient(url, key) : null

export async function isGoogleSignInEnabled() {
  if (!url || !key) return false
  const endpoint = new URL(`${url.replace(/\/$/, '')}/auth/v1/settings`)
  const response = await fetch(endpoint, {
    headers: { apikey: key },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) throw new Error('Unable to read auth settings')
  const settings: { external?: { google?: boolean } } = await response.json()
  return settings.external?.google === true
}

export function referenceVideoUrl(key: string | null) {
  const base = import.meta.env.VITE_REFERENCE_VIDEO_BASE_URL?.trim()
  if (!key || !base) return null
  try {
    const root = new URL(base)
    if (!['https:', 'http:'].includes(root.protocol)) return null
    root.pathname = root.pathname.replace(/\/?$/, '/')
    if (key.split('/').some((segment) => !segment || segment === '.' || segment === '..')) return null
    return new URL(key.split('/').map(encodeURIComponent).join('/'), root).href
  } catch {
    return null
  }
}
