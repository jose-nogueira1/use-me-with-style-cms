import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Endpoint, PayloadRequest } from 'payload'
import { allocateReturnAmounts, type ReturnItem } from '../lib/returns'

const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 8
const attempts = new Map<string, { count: number; reset: number }>()

const requestKey = (req: PayloadRequest) =>
  (req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown').trim()

function limited(req: PayloadRequest) {
  const now = Date.now()
  const key = requestKey(req)
  const current = attempts.get(key)
  if (!current || current.reset < now) {
    attempts.set(key, { count: 1, reset: now + WINDOW_MS })
    return false
  }
  current.count += 1
  return current.count > MAX_ATTEMPTS
}

function secret() {
  return process.env.RETURN_SESSION_SECRET || process.env.PAYLOAD_SECRET || 'local-return-secret'
}

function sign(payload: string) {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

function sessionToken(orderId: string | number, email: string) {
  const expiresAt = Date.now() + 30 * 60_000
  const payload = `${orderId}.${expiresAt}.${email.toLowerCase()}`
  return `${Buffer.from(payload).toString('base64url')}.${sign(payload)}`
}

function verifySession(value: string, email: string) {
  try {
    const [encoded, signature] = value.split('.')
    const payload = Buffer.from(encoded, 'base64url').toString()
    const parts = payload.split('.')
    const expected = sign(payload)
    if (!signature || signature.length !== expected.length ||
      !timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ||
      Number(parts[1]) < Date.now() || parts.slice(2).join('.') !== email.toLowerCase()) return null
    return parts[0]
  } catch {
    return null
  }
}

const deliveredAt = (order: { statusHistory?: Array<{ status?: string; changedAt?: string }> | null; updatedAt?: string }) =>
  order.statusHistory?.filter((entry) => entry.status === 'delivered').at(-1)?.changedAt || order.updatedAt

const withinWindow = (market: string, date?: string) =>
  Boolean(date) && Date.now() - new Date(date!).getTime() <= (market === 'AO' ? 48 : 14 * 24) * 60 * 60_000

async function verifiedOrder(req: PayloadRequest, orderNumber: string, email: string) {
  const found = await req.payload.find({
    collection: 'orders',
    where: { orderNumber: { equals: orderNumber.trim().toUpperCase() } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const order = found.docs[0]
  return order?.customerEmail?.toLowerCase() === email.toLowerCase() ? order : null
}

async function existingReturns(req: PayloadRequest, orderId: string | number) {
  return req.payload.find({
    collection: 'returns' as any,
    where: { and: [{ order: { equals: orderId } }, { status: { not_in: ['rejected', 'customer_cancelled'] } }] },
    limit: 100,
    depth: 0,
    overrideAccess: true,
  })
}

export const customerReturnEndpoints: Endpoint[] = [
  {
    path: '/customer-returns/session',
    method: 'post',
    handler: async (req) => {
      if (limited(req)) return Response.json({ error: 'Too many attempts.' }, { status: 429 })
      const body = await req.json?.() as { orderNumber?: string; email?: string }
      if (!body?.orderNumber || !body.email) return Response.json({ eligible: false })
      const order = await verifiedOrder(req, body.orderNumber, body.email)
      if (!order) return Response.json({ eligible: false })

      const existing = await existingReturns(req, order.id)
      const cancellableReturns = existing.docs
        .filter((row) => row.origin === 'customer' && row.status === 'requested')
        .map((row) => ({ returnNumber: row.returnNumber, createdAt: row.createdAt }))
      const token = sessionToken(order.id, body.email)
      const eligible = order.status === 'delivered' && order.paymentStatus === 'paid' && withinWindow(order.market, deliveredAt(order))
      if (!eligible) {
        return Response.json({
          eligible: false,
          reason: order.status !== 'delivered' ? 'not_delivered' : 'window_closed',
          sessionToken: token,
          cancellableReturns,
        })
      }

      const used = new Map<string, number>()
      for (const row of existing.docs) {
        for (const item of (row.items || []) as ReturnItem[]) {
          used.set(item.orderItemId, (used.get(item.orderItemId) || 0) + Number(item.quantity))
        }
      }
      const products = await Promise.all((order.items || []).map((item) => req.payload.findByID({
        collection: 'products',
        id: typeof item.product === 'object' ? item.product.id : item.product,
        depth: 1,
        overrideAccess: true,
      })))
      const allocated = allocateReturnAmounts(order.items as never[], Number(order.discountAmount || 0))

      return Response.json({
        eligible: true,
        sessionToken: token,
        market: order.market,
        currency: order.currency,
        policyWindowHours: order.market === 'AO' ? 48 : 336,
        cancellableReturns,
        items: allocated.map((item, index) => ({
          orderItemId: item.orderItemId,
          productName: item.productName,
          size: item.size,
          color: item.color,
          purchasedQuantity: item.quantity,
          availableQuantity: Math.max(0, item.quantity - (used.get(item.orderItemId) || 0)),
          unitRefundable: item.quantity ? item.refundableAmount / item.quantity : 0,
          returnEligible: products[index]?.returnEligible !== false,
          variants: (products[index]?.variants || []).map((variant) => ({
            id: variant.id,
            label: [
              variant.color && typeof variant.color === 'object' ? (variant.color.namePT || variant.color.nameEN) : '',
              variant.size || variant.optionValueEN,
            ].filter(Boolean).join(' / '),
          })),
        })),
      })
    },
  },
  {
    path: '/customer-returns/request',
    method: 'post',
    handler: async (req) => {
      if (limited(req)) return Response.json({ error: 'Too many attempts.' }, { status: 429 })
      const body = await req.json?.() as {
        orderNumber: string
        email: string
        sessionToken: string
        resolution: string
        reason: string
        customerNote?: string
        items: Array<{ orderItemId: string; quantity: number; replacementVariantId?: string }>
        evidence?: Array<{ filename: string; mimeType: string; data: string }>
      }
      const orderId = verifySession(body.sessionToken || '', body.email || '')
      if (!orderId) return Response.json({ error: 'Return session expired.' }, { status: 401 })
      const order = await verifiedOrder(req, body.orderNumber, body.email)
      if (!order || String(order.id) !== orderId || order.status !== 'delivered' || order.paymentStatus !== 'paid' || !withinWindow(order.market, deliveredAt(order))) {
        return Response.json({ error: 'Order is not eligible.' }, { status: 400 })
      }
      if (!['refund', 'exchange', 'store_credit'].includes(body.resolution)) return Response.json({ error: 'Invalid resolution.' }, { status: 400 })
      if (order.market === 'AO' && body.resolution === 'refund' && !['defective', 'incorrect_item'].includes(body.reason)) {
        return Response.json({ error: 'Refund is not available for this Angola request.' }, { status: 400 })
      }
      if (!Array.isArray(body.items) || !body.items.length) return Response.json({ error: 'Select at least one item.' }, { status: 400 })
      if (['defective', 'incorrect_item'].includes(body.reason) && !(body.evidence || []).length) {
        return Response.json({ error: 'Add at least one evidence image for this reason.' }, { status: 400 })
      }
      if ((body.evidence || []).length > 3) return Response.json({ error: 'Maximum three evidence images.' }, { status: 400 })
      for (const file of body.evidence || []) {
        if (!/^image\/(jpeg|png|webp)$/.test(file.mimeType) || Buffer.from(file.data, 'base64').length > 2_000_000) {
          return Response.json({ error: 'Invalid evidence image.' }, { status: 400 })
        }
      }

      const allocated = allocateReturnAmounts(order.items as never[], Number(order.discountAmount || 0))
      const byId = new Map(allocated.map((item) => [item.orderItemId, item]))
      for (const requested of body.items) {
        const source = byId.get(requested.orderItemId)
        if (!source) return Response.json({ error: 'Invalid return item.' }, { status: 400 })
        const product = await req.payload.findByID({ collection: 'products', id: source.product, depth: 0, overrideAccess: true })
        if (product.returnEligible === false && !['defective', 'incorrect_item'].includes(body.reason)) {
          return Response.json({ error: `${source.productName} is not returnable for this reason.` }, { status: 400 })
        }
        if (body.resolution === 'exchange') {
          const variants = Array.isArray(product.variants) ? product.variants : []
          if (!requested.replacementVariantId || !variants.some((variant) => variant.id === requested.replacementVariantId)) {
            return Response.json({ error: `Choose a valid replacement for ${source.productName}.` }, { status: 400 })
          }
        }
      }

      const doc = await req.payload.create({
        collection: 'returns' as any,
        overrideAccess: true,
        context: { customerInitiated: true },
        data: {
          order: order.id,
          origin: 'customer',
          resolution: body.resolution,
          reason: body.reason,
          customerNote: body.customerNote,
          items: body.items,
          evidence: body.evidence || [],
        } as never,
      })
      return Response.json({ returnNumber: doc.returnNumber, status: doc.status })
    },
  },
  {
    path: '/customer-returns/cancel',
    method: 'post',
    handler: async (req) => {
      const body = await req.json?.() as { orderNumber: string; email: string; sessionToken: string; returnNumber: string }
      const orderId = verifySession(body.sessionToken || '', body.email || '')
      if (!orderId) return Response.json({ error: 'Return session expired.' }, { status: 401 })
      const order = await verifiedOrder(req, body.orderNumber, body.email)
      if (!order || String(order.id) !== orderId) return Response.json({ error: 'Invalid request.' }, { status: 401 })
      const rows = await req.payload.find({
        collection: 'returns' as any,
        where: { and: [{ returnNumber: { equals: body.returnNumber } }, { order: { equals: order.id } }] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const row = rows.docs[0]
      if (!row || row.origin !== 'customer' || row.status !== 'requested') {
        return Response.json({ error: 'This request can no longer be cancelled.' }, { status: 400 })
      }
      await req.payload.update({
        collection: 'returns' as any,
        id: row.id,
        overrideAccess: true,
        context: { customerInitiated: true },
        data: { status: 'customer_cancelled' },
      })
      return Response.json({ cancelled: true })
    },
  },
]
