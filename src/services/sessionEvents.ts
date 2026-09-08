export const ACADEMY_SESSION_EXPIRED_EVENT = 'ifarm-academy-session-expired'

export function isSessionExpiredStatus(status: number): boolean {
  return status === 401
}

export function notifySessionExpired(): void {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof Event === 'undefined') return
  globalThis.dispatchEvent(new Event(ACADEMY_SESSION_EXPIRED_EVENT))
}
