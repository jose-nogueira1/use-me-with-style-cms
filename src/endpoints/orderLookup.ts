import type { Endpoint, PayloadRequest } from 'payload'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()
type OrderLookupBody = { orderNumber?: string; email?: string }

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

export const orderLookupEndpoint: Endpoint = {
  path: '/order-lookup',
  method: 'post',
  handler: async (req) => {
    const startedAt = Date.now()
    const requestId = req.headers.get('x-vercel-id') || req.headers.get('x-request-id') || undefined
    if (isRateLimited(req)) {
      req.payload.logger.warn({ event: 'order_lookup_rate_limited', requestId })
      return Response.json({ error: 'Too many lookup attempts. Please try again shortly.' }, { status: 429 })
    }

    let body: OrderLookupBody
    try {
      body = (await req.json?.()) as OrderLookupBody
    } catch {
      return Response.json({ error: 'Invalid request.' }, { status: 400 })
    }

    const orderNumber = body?.orderNumber?.trim().toUpperCase()
    const email = body?.email?.trim().toLowerCase()
    if (!orderNumber || !email || orderNumber.length > 40 || email.length > 254) {
      return Response.json({ order: null })
    }

    const matches = await req.payload.find({
      collection: 'orders',
      where: {
        orderNumber: { equals: orderNumber },
      },
      limit: 1,
      depth: 0,
      overrideAccess: true,
    })
    const candidate = matches.docs[0]
    const order = candidate?.customerEmail.trim().toLowerCase() === email ? candidate : null

    req.payload.logger.info({
      event: 'order_lookup_completed',
      found: Boolean(order),
      durationMs: Date.now() - startedAt,
      requestId,
    })

    return Response.json({
      order: order
        ? {
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            total: order.total,
            currency: order.currency,
            updatedAt: order.updatedAt,
          }
        : null,
    })
  },
}
