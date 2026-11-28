import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (request: Request) => Promise<Response>
let handler: Handler

beforeEach(async () => {
  vi.stubGlobal('Deno', {
    env: { get: (name: string) => name === 'SUPABASE_URL' ? 'https://test.invalid' : 'fixture-key' },
    serve: (callback: Handler) => { handler = callback },
  })
  await import('./index')
})

afterEach(() => vi.unstubAllGlobals())

function signup(username: string) {
  return handler(new Request('https://app.invalid', {
    method: 'POST', body: JSON.stringify({ username, password: 'fixture-password' }),
  }))
}

describe('register-username function', () => {
  it('rejects an invalid name before sending server-side requests', async () => {
    const request = vi.fn()
    vi.stubGlobal('fetch', request)
    expect((await signup('aa@example.com')).status).toBe(400)
    expect(request).not.toHaveBeenCalled()
  })

  it('provisions a normalized account with the reserved address and trusted metadata', async () => {
    const request = vi.fn()
      .mockResolvedValueOnce(Response.json(true))
      .mockResolvedValueOnce(Response.json({ id: 'fixture-user' }))
    vi.stubGlobal('fetch', request)
    expect((await signup(' Office_Fit ')).status).toBe(201)
    expect(request.mock.calls[1][0]).toBe('https://test.invalid/auth/v1/admin/users')
    expect(JSON.parse(request.mock.calls[1][1].body)).toMatchObject({
      email: 'office_fit@users.office-reset.invalid',
      email_confirm: true,
      app_metadata: { office_reset_username: 'office_fit' },
    })
  })

  it('stops before provisioning when the limit is reached', async () => {
    const request = vi.fn().mockResolvedValueOnce(Response.json(false))
    vi.stubGlobal('fetch', request)
    expect((await signup('office_fit')).status).toBe(429)
    expect(request).toHaveBeenCalledTimes(1)
  })
})
