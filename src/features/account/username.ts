export const usernamePattern = '[a-zA-Z0-9_]{3,24}'
const usernameRegex = new RegExp(`^${usernamePattern}$`)
const internalDomain = '@users.office-reset.invalid'

export function normalizeUsername(value: string) {
  const username = value.trim().toLowerCase()
  return usernameRegex.test(value.trim()) ? username : null
}

export function usernameLoginAddress(username: string) {
  return `${username}${internalDomain}`
}

export function isInternalAddress(email: string) {
  return email.trim().toLowerCase().endsWith(internalDomain)
}
