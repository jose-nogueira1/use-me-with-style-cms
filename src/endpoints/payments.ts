import type { Endpoint, PayloadRequest } from 'payload'

import {
  createCheckoutSession,
  constructWebhookEvent,
  retrieveSession,
  isStripeConfigured,
} from '../lib/payments/stripe'
import { createPaypalOrder, capturePaypalOrder, isPaypalConfigured } from '../lib/payments/paypal'

// Real Stripe + PayPal integration (JOS-61), Portugal/international only --
// Angola stays on SWEG/AppyPay + manual bank transfer (JOS-57). Both
// gateways share the same shape: the order is created up-front (status
// `new`, paymentStatus `pending`, same as the existing plain `/api/orders`
// create used by MB WAY / bank transfer), then the gateway session/order is
// created and linked back to it. The order only flips to `paymentStatus:
// paid` once the gateway confirms payment (Stripe via webhook, PayPal via
// the capture call) -- never optimistically on the frontend.

type CreateOrderBody = {
  market: 'AO' | 'PT'
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  city: string
  country: string
  notes?: string
  items: { product: string; productName: string; size: string; color?: string; qty: number; unitPrice: number }[]
  currency: 'Kz' | 'EUR'
  subtotal: number
  shippingCost: number
  total: number
  paymentMethod: string
  deliveryMethod: string
}

async function readJsonBody<T>(req: PayloadRequest): Promise<T | null> {
  try {
    return (await req.json?.()) as T
  } catch {
    return null
  }
}

async function createPendingOrder(req: PayloadRequest, body: CreateOrderBody) {
  // `body` is raw JSON off the wire (same as the public REST /api/orders
  // create the frontend already uses for MB WAY/bank transfer) -- casting
  // here is honest about that, matching how Payload's own REST create
  // endpoint accepts this same shape without compile-time checking either.
  return req.payload.create({
    collection: 'orders',
    overrideAccess: true,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: {
      ...body,
      status: 'new',
      paymentStatus: 'pending',
    } as any,
  })
}

async function markOrderPaidIfNeeded(req: PayloadRequest, orderId: string) {
  const existing = await req.payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true })
  if (existing.paymentStatus === 'paid') return existing
  return req.payload.update({
    collection: 'orders',
    id: orderId,
    overrideAccess: true,
    data: {
      paymentStatus: 'paid',
      // Real, confirmed payment -- skip Payment Review (that status exists
      // specifically for manual/unconfirmed methods like Angola's bank
      // transfer) and move straight to Processing.
      status: existing.status === 'new' || existing.status === 'payment_review' ? 'processing' : existing.status,
    },
  })
}

const stripeCreateSession: Endpoint = {
  path: '/payments/stripe/create-checkout-session',
  method: 'post',
  handler: async (req) => {
    if (!isStripeConfigured()) {
      return Response.json({ error: 'Stripe is not configured yet.' }, { status: 501 })
    }
    const body = await readJsonBody<CreateOrderBody>(req)
    if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    if (body.currency !== 'EUR') {
      return Response.json({ error: 'Stripe is only available for EUR (Portugal) orders.' }, { status: 400 })
    }

    try {
      const order = await createPendingOrder(req, body)
      const orderNumber = order.orderNumber ?? String(order.id)
      const session = await createCheckoutSession({
        orderId: String(order.id),
        orderNumber,
        currency: body.currency,
        items: body.items,
        shippingCost: body.shippingCost,
        customerEmail: body.customerEmail,
      })
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: { paymentReference: session.sessionId },
      })
      return Response.json({ orderNumber, sessionUrl: session.url })
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:stripe:create-session-failed]')
      return Response.json({ error: 'Could not start Stripe checkout.' }, { status: 500 })
    }
  },
}

const stripeWebhook: Endpoint = {
  path: '/payments/stripe/webhook',
  method: 'post',
  handler: async (req) => {
    const signature = req.headers.get('stripe-signature')
    if (!signature) return new Response('Missing signature', { status: 400 })

    let rawBody: string
    try {
      const text = await req.text?.()
      if (text === undefined) throw new Error('req.text unavailable')
      rawBody = text
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    let event
    try {
      event = constructWebhookEvent(rawBody, signature)
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:stripe:webhook-signature-invalid]')
      return new Response('Invalid signature', { status: 400 })
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as {
        metadata?: { orderId?: string }
        payment_status?: string
      }
      const orderId = session.metadata?.orderId
      if (orderId && session.payment_status === 'paid') {
        try {
          await markOrderPaidIfNeeded(req, orderId)
        } catch (err) {
          req.payload.logger.error({ err }, '[payments:stripe:webhook-update-failed]')
        }
      }
    }

    // Meta/Stripe both expect a fast 200 regardless, or they'll keep
    // retrying delivery -- errors above are logged, not surfaced here.
    return new Response('OK', { status: 200 })
  },
}

const stripeSessionStatus: Endpoint = {
  path: '/payments/stripe/session-status',
  method: 'get',
  handler: async (req) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const sessionId = url.searchParams.get('session_id')
    if (!sessionId) return Response.json({ error: 'session_id required' }, { status: 400 })
    try {
      const session = await retrieveSession(sessionId)
      return Response.json({ paymentStatus: session?.payment_status ?? 'unknown' })
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:stripe:session-status-failed]')
      return Response.json({ error: 'Could not retrieve session' }, { status: 500 })
    }
  },
}

const paypalCreateOrderEndpoint: Endpoint = {
  path: '/payments/paypal/create-order',
  method: 'post',
  handler: async (req) => {
    if (!isPaypalConfigured()) {
      return Response.json({ error: 'PayPal is not configured yet.' }, { status: 501 })
    }
    const body = await readJsonBody<CreateOrderBody>(req)
    if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    if (body.currency !== 'EUR') {
      return Response.json({ error: 'PayPal is only available for EUR (Portugal) orders.' }, { status: 400 })
    }

    try {
      const order = await createPendingOrder(req, body)
      const orderNumber = order.orderNumber ?? String(order.id)
      const paypal = await createPaypalOrder({
        orderId: String(order.id),
        orderNumber,
        currency: body.currency,
        total: body.total,
      })
      await req.payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: { paymentReference: paypal.paypalOrderId },
      })
      return Response.json({ orderNumber, paypalOrderId: paypal.paypalOrderId })
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:paypal:create-order-failed]')
      return Response.json({ error: 'Could not start PayPal checkout.' }, { status: 500 })
    }
  },
}

const paypalCaptureOrderEndpoint: Endpoint = {
  path: '/payments/paypal/capture-order',
  method: 'post',
  handler: async (req) => {
    const body = await readJsonBody<{ paypalOrderId?: string }>(req)
    if (!body?.paypalOrderId) return Response.json({ error: 'paypalOrderId required' }, { status: 400 })

    try {
      const result = await capturePaypalOrder(body.paypalOrderId)
      // Previous attempt: matched our order via result.orderId (PayPal's
      // echoed purchase_units[].custom_id) and filled orderNumber from our
      // own DB. Still broken in production -- every real PayPal test this
      // session left the order stuck on status "New" (markOrderPaidIfNeeded
      // never ran), proving PayPal doesn't reliably echo custom_id back on
      // /capture either, same unreliable-echo problem as invoice_id, just a
      // different field. Real fix: don't depend on PayPal echoing ANYTHING
      // back to identify our order. `body.paypalOrderId` (the id the client
      // got from PayPal's own SDK onApprove callback -- always reliable,
      // it's what we just captured) was already stored as `paymentReference`
      // on our order at create-order time. Look our order up by that --
      // entirely within our own control, no dependency on PayPal's response
      // shape at all.
      let orderNumber: string | undefined
      if (result.status === 'COMPLETED') {
        const matches = await req.payload.find({
          collection: 'orders',
          where: { paymentReference: { equals: body.paypalOrderId } },
          limit: 1,
          overrideAccess: true,
        })
        const order = matches.docs[0]
        if (order) {
          const updated = await markOrderPaidIfNeeded(req, String(order.id))
          orderNumber = updated.orderNumber ?? undefined
        } else {
          req.payload.logger.error(
            { paypalOrderId: body.paypalOrderId },
            '[payments:paypal:capture-order-not-found]',
          )
        }
      }
      return Response.json({ status: result.status, orderNumber })
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:paypal:capture-failed]')
      return Response.json({ error: 'Could not capture PayPal payment.' }, { status: 500 })
    }
  },
}

export const paymentsEndpoints: Endpoint[] = [
  stripeCreateSession,
  stripeWebhook,
  stripeSessionStatus,
  paypalCreateOrderEndpoint,
  paypalCaptureOrderEndpoint,
]
