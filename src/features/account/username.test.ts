import { describe, expect, it } from 'vitest'
import { isInternalAddress, normalizeUsername, usernameLoginAddress } from './username'

describe('username accounts', () => {
  it('normalizes case and surrounding whitespace before deriving the login address', () => {
    const username = normalizeUsername(' Office_Fit_01 ')
    expect(username).toBe('office_fit_01')
    expect(usernameLoginAddress(username!)).toBe('office_fit_01@users.office-reset.invalid')
  })

  it('rejects email addresses, invalid characters and out-of-range usernames', () => {
    for (const value of ['ab', 'x'.repeat(25), 'hello-world', 'a@b.com', 'ฝึกออกกำลังกาย']) {
      expect(normalizeUsername(value)).toBeNull()
    }
  })

  it('recognizes only the reserved internal domain', () => {
    expect(isInternalAddress(' Office_Fit@USERS.OFFICE-RESET.INVALID ')).toBe(true)
    expect(isInternalAddress('name@example.com')).toBe(false)
    expect(isInternalAddress('name@users.office-reset.invalid.example.com')).toBe(false)
  })
})
