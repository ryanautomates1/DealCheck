/**
 * Simple in-memory rate limiter. Use for login callback and import endpoints.
 * Resets after the window (e.g. 1 minute). Not distributed - use Redis etc. in multi-instance deployments.
 */

type Entry = { count: number; resetAt: number }

const store = new Map<string, Entry>()

// Clean old entries periodically
function prune(): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt <= now) store.delete(key)
  }
}

/**
 * Check rate limit. Returns true if allowed, false if rate limited.
 * @param key - Identifier (e.g. IP or IP+path)
 * @param limit - Max requests per window
 * @param windowMs - Window in milliseconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number } {
  if (store.size > 10_000) prune()
  const now = Date.now()
  let entry = store.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    store.set(key, entry)
  }
  entry.count += 1
  const allowed = entry.count <= limit
  const remaining = Math.max(0, limit - entry.count)
  return { allowed, remaining }
}

/**
 * Get client IP from request (supports Vercel/proxies).
 */
export function getClientIdentifier(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp
  return 'unknown'
}
