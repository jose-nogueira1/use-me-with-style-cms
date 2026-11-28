import type { Endpoint, PayloadRequest } from 'payload'
import { sendContactAutoReplyEmail, sendContactFormEmail } from '../lib/email'
import type { EmailLang } from '../lib/email'

// Help page "send us an email" form (JOS-64 follow-up, added 2026-07-24).
// Same rate-limit shape as orderLookup.ts -- an unauthenticated public
// endpoint needs its own abuse guard since Payload's normal access control
// doesn't apply here.
const WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS = 5
const attempts = new Map<string, { count: number; resetAt: number }>()

type ContactBody = { name?: string; email?: string; phone?: string; orderNumber?: string; message?: string; lang?: string; topic?: string; article?: string }

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

    if (!body || ['name', 'email', 'phone', 'orderNumber', 'message', 'topic', 'article'].some(key => {
      const value = (body as Record<string, unknown>)[key]
      return value !== undefined && typeof value !== 'string'
    })) return Response.json({ error: 'Invalid request fields.' }, { status: 400 })

    let name = body?.name?.trim().slice(0, 200)
    const email = body?.email?.trim().slice(0, 254)
    const phone = body?.phone?.trim().slice(0, 40)
    const orderNumber = body?.orderNumber?.trim().replace(/^#/, '').toUpperCase().slice(0, 40)
    let message = body?.message?.trim().slice(0, 5000)
    // Storefront UI language (Help page, see api.ts's submitContactMessage
    // and Help.tsx's handleContactSubmit) -- only decides the language of
    // the auto-reply below, never the internal team notification (that one
    // stays PT-only on purpose, see sendContactFormEmail's own comment).
    // Falls back to 'pt' for any older frontend build that doesn't send it
    // yet, same default every other email in lib/email.ts uses.
    const lang: EmailLang = body?.lang === 'en' ? 'en' : 'pt'

    const topic = body?.topic ?? 'support'
    if (!['support', 'returns', 'legal'].includes(topic)) {
      return Response.json({ error: 'Invalid contact topic.' }, { status: 400 })
    }
    if (topic === 'returns') {
      if (!orderNumber || !email || !body.article || !message) {
        return Response.json({ error: 'Order, email, article and reason are required.' }, { status: 400 })
      }
      const matches = await req.payload.find({
        collection: 'orders', where: { orderNumber: { equals: orderNumber } },
        limit: 1, depth: 0, overrideAccess: true,
      })
      const order = matches.docs[0]
      const index = Number(body.article)
      const item = order?.items?.[index]
      if (!order || order.customerEmail.trim().toLowerCase() !== email.toLowerCase() ||
          !/^\d+$/.test(body.article) || !item) {
        return Response.json({ error: 'Check the order email and selected article.' }, { status: 400 })
      }
      name = order.customerName
      message = [
        'Artigo: ' + item.productName,
        'Quantidade encomendada: ' + item.qty,
        'Tamanho: ' + (item.size || '—'),
        'Cor: ' + (item.color || '—'),
        'Mercado: ' + order.market,
        'Estado: ' + order.status,
        'Motivo: ' + message,
      ].join('\n')
    }

    if (!name || !email || !message || !EMAIL_RE.test(email)) {
      return Response.json({ error: 'Missing or invalid fields.' }, { status: 400 })
    }

    try {
      await sendContactFormEmail(req.payload, { name, email, phone, orderNumber, message, topic: topic as 'support' | 'returns' | 'legal' })
    } catch (err) {
      req.payload.logger.error(
        { err: err instanceof Error ? err.message : String(err) },
        '[contact:send-failed]',
      )
      return Response.json({ error: 'Could not send your message. Please email the selected department directly.' }, { status: 502 })
    }

    // Customer-facing "we got it" acknowledgement -- sent only after the
    // internal notification above has actually succeeded (no point
    // reassuring the customer their message arrived if it didn't).
    // sendContactAutoReplyEmail never throws (see its own try/catch), so
    // this can't turn a successful submission into an error response.
    await sendContactAutoReplyEmail(req.payload, { to: email, name, lang, orderNumber, message, topic: topic as 'support' | 'returns' | 'legal' })

    return Response.json({ ok: true })
  },
}
