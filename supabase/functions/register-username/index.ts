const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
}

function reply(status: number, code: string) {
  return Response.json({ code }, { status, headers: cors })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (request.method !== 'POST') return reply(405, 'method_not_allowed')

  try {
    const payload = await request.json().catch(() => null)
    const username = typeof payload?.username === 'string' ? payload.username.trim() : ''
    const password = typeof payload?.password === 'string' ? payload.password : ''
    if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || password.length < 8 ||
      new TextEncoder().encode(password).length > 72) {
      return reply(400, 'invalid_credentials')
    }

    const name = username.toLowerCase()
    const url = Deno.env.get('SUPABASE_URL')
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !secret) return reply(503, 'signup_unavailable')
    const headers = { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }

    const forwarded = request.headers.get('x-forwarded-for')
    const address = forwarded?.split(',').at(-1)?.trim() || 'unknown'
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${secret}|${address}`))
    const clientBucket = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
    const limit = await fetch(`${url}/rest/v1/rpc/consume_username_signup_attempt`, {
      method: 'POST', headers, body: JSON.stringify({ client_bucket: clientBucket }),
    })
    if (!limit.ok) return reply(503, 'signup_unavailable')
    if (await limit.json() !== true) return reply(429, 'signup_rate_limited')

    const created = await fetch(`${url}/auth/v1/admin/users`, {
      method: 'POST', headers,
      body: JSON.stringify({
        email: `${name}@users.office-reset.invalid`,
        email_confirm: true,
        password,
        app_metadata: { office_reset_username: name },
      }),
    })
    if (created.ok) return reply(201, 'created')
    const error = await created.json().catch(() => null)
    if (['email_exists', 'user_already_exists'].includes(error?.code ?? error?.error_code)) {
      return reply(409, 'username_taken')
    }
    if (created.status === 429) return reply(429, 'signup_rate_limited')
    return reply(created.status >= 500 ? 503 : 400, 'signup_failed')
  } catch {
    return reply(503, 'signup_unavailable')
  }
})
