import type { Endpoint, PayloadRequest } from 'payload'
import { sendContactFormEmail } from '../lib/email'

// Help page "send us an email" form (JOS-64 follow-up, added 2026-07-24).
// Same rate-limit shape as orderLookup.ts -- an unauthenticated public
// endpoint needs its own abuse guard since Payload's normal access control
// doesn't apply here.
const WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

type ContactBody = { name?: string; email?: string; message?: string }

function clientKey(req: PayloadRequest): string {
  return (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()
}

function isRateLimited(req: PayloadRequest): boolean {
  const now = Date.now()
  if (attempts.size > 10_000) {
    for (const [storedKey, entry] of attempts) {
      if (entry.resetAt <= now) attempts.delete(storedKey)
    }
  }
  const key = clientKey(req)
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > MAX_ATTEMPTS
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const contactEndpoint: Endpoint = {
  path: '/contact',
  method: 'post',
  handler: async (req) => {
    if (isRateLimited(req)) {
      req.payload.logger.warn({ event: 'contact_form_rate_limited' })
      return Response.json({ error: 'Too many messages sent. Please try again later.' }, { status: 429 })
    }

    let body: ContactBody
    try {
      body = (await req.json?.()) as ContactBody
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const name = body?.name?.trim().slice(0, 200)
    const email = body?.email?.trim().slice(0, 254)
    const message = body?.message?.trim().slice(0, 5000)

    if (!name || !email || !message || !EMAIL_RE.test(email)) {
      return Response.json({ error: 'Missing or invalid fields.' }, { status: 400 })
    }

    try {
      await sendContactFormEmail(req.payload, { name, email, message })
    } catch (err) {
      req.payload.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        '[contact:send-failed]',
      )
      return Response.json({ error: 'Could not send your message. Please try WhatsApp instead.' }, { status: 502 })
    }

    return Response.json({ ok: true })
  },
}
