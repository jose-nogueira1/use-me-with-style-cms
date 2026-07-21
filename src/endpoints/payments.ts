import type { Endpoint, PayloadRequest } from 'payload'
import { randomBytes, timingSafeEqual } from 'node:crypto'

import {
  createCheckoutSession,
  constructWebhookEvent,
  retrieveSession,
  isStripeConfigured,
} from '../lib/payments/stripe'
import { createPaypalOrder, capturePaypalOrder, isPaypalConfigured } from '../lib/payments/paypal'

// Real Stripe + PayPal integration (JOS-61). Both gateways only support EUR
// here -- enforced below -- which covers Portugal directly and, since
// 2026-07-10, Angola too: neither Stripe nor PayPal support AOA (and Stripe
// has no Angola merchant accounts), so AO orders paid by Stripe/PayPal are
// built by the frontend with `currency: 'EUR'` and EUR-converted item prices
// (see Checkout.tsx) even though the storefront displayed Kz to the shopper.
// `market` on the order stays 'AO' regardless -- it identifies the
// storefront/customer, not the settlement currency. Angola's Multicaixa
// Express (via AppyPay, JOS-57) isn't integrated with a gateway here yet; it
// still goes through the plain `/api/orders` create, same as MB WAY.
//
// Both gateways share the same shape: the order is created up-front (status
// `new`, paymentStatus `pending`, same as the existing plain `/api/orders`
// create used by MB WAY / Multicaixa Express), then the gateway session/
// order is created and linked back to it. The order only flips to
// `paymentStatus: paid` once the gateway confirms payment (Stripe via
// webhook, PayPal via the capture call) -- never optimistically on the
// frontend.

type CreateOrderBody = {
  market: 'AO' | 'PT'
  customerName: string
  customerPhone: string
  customerEmail: string
  address: string
  addressLine2?: string
  postalCode?: string
  city: string
  country: string
  taxId?: string
  notes?: string
  items: { product: string; productName: string; size: string; color?: string; qty: number; unitPrice: number }[]
  currency: 'Kz' | 'EUR'
  subtotal: number
  shippingCost: number
  total: number
  paymentMethod: string
  deliveryMethod: string
  // Storefront language at checkout (falls back to 'pt' -- same default as
  // the frontend's own AppContext -- if an older client omits it). Drives
  // the language of the order-confirmation email in notifyOrderEvent.ts.
  lang?: 'pt' | 'en'
  analyticsConsent?: boolean
  metaFbp?: string
  metaFbc?: string
  metaEventSourceUrl?: string
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

function newAppyPayMerchantTransactionId(): string {
  // AppyPay requires 1-15 alphanumeric characters. Timestamp + entropy is
  // compact, traceable, and independent of Payload's UUID/string DB ids.
  return `UM${Date.now().toString(36)}${randomBytes(2).toString('hex')}`.slice(0, 15)
}

function safeEqual(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual)
  const expectedBuffer = Buffer.from(expected)
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
}

function isAppyPayWebhookAuthorized(req: PayloadRequest): boolean {
  const username = process.env.APPY_PAY_WEBHOOK_USERNAME
  const password = process.env.APPY_PAY_WEBHOOK_PASSWORD
  if (!username || !password) return false

  const authorization = req.headers.get('authorization') || ''
  if (!authorization.startsWith('Basic ')) return false
  try {
    const decoded = Buffer.from(authorization.slice(6), 'base64').toString('utf8')
    return safeEqual(decoded, `${username}:${password}`)
  } catch {
    return false
  }
}

type AppyPayWebhookBody = {
  id?: string
  merchantTransactionId?: string
  amount?: number
  responseStatus?: {
    successful?: boolean
    status?: 'Requested' | 'Pending' | 'Success' | 'Failed'
    code?: number
    message?: string
    source?: string
  }
}

const appyPayCreateOrder: Endpoint = {
  path: '/payments/appypay/create-order',
  method: 'post',
  handler: async (req) => {
    const body = await readJsonBody<CreateOrderBody>(req)
    if (!body) return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    if (body.market !== 'AO' || body.currency !== 'Kz' || body.paymentMethod !== 'multicaixa_express') {
      return Response.json({ error: 'AppyPay only accepts Angola Multicaixa Express orders in Kz.' }, { status: 400 })
    }

    try {
      const merchantTransactionId = newAppyPayMerchantTransactionId()
      const order = await createPendingOrder(req, body)
      const updated = await req.payload.update({
        collection: 'orders',
        id: order.id,
        overrideAccess: true,
        data: { appyPayMerchantTransactionId: merchantTransactionId },
      })
      return Response.json({
        orderNumber: updated.orderNumber ?? String(updated.id),
        merchantTransactionId,
      })
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:appypay:create-order-failed]')
      return Response.json({ error: 'Could not start AppyPay checkout.' }, { status: 500 })
    }
  },
}

const appyPayWebhook: Endpoint = {
  path: '/payments/appypay/webhook',
  method: 'post',
  handler: async (req) => {
    if (!isAppyPayWebhookAuthorized(req)) {
      return new Response('Unauthorized', { status: 401 })
    }

    const body = await readJsonBody<AppyPayWebhookBody>(req)
    if (!body?.id || !body.merchantTransactionId || !body.responseStatus?.status) {
      return new Response('Invalid payload', { status: 400 })
    }

    const matches = await req.payload.find({
      collection: 'orders',
      where: { appyPayMerchantTransactionId: { equals: body.merchantTransactionId } },
      limit: 1,
      overrideAccess: true,
    })
    const order = matches.docs[0]
    if (!order) {
      req.payload.logger.error(
        { merchantTransactionId: body.merchantTransactionId },
        '[payments:appypay:webhook-order-not-found]',
      )
      // Acknowledge a valid AppyPay delivery to avoid an endless retry loop;
      // the unmatched transaction remains visible in server logs for review.
      return new Response('OK', { status: 200 })
    }

    try {
      if (body.responseStatus.successful && body.responseStatus.status === 'Success') {
        await req.payload.update({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
          data: {
            paymentReference: body.id,
            paymentStatus: 'paid',
            status:
              order.status === 'new' || order.status === 'payment_review'
                ? 'processing'
                : order.status,
          },
        })
      } else if (body.responseStatus.status === 'Failed') {
        await req.payload.update({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
          data: {
            paymentReference: body.id,
            paymentStatus: 'failed',
            status: 'payment_review',
          },
        })
      } else if (order.paymentReference !== body.id) {
        await req.payload.update({
          collection: 'orders',
          id: order.id,
          overrideAccess: true,
          data: { paymentReference: body.id },
        })
      }
    } catch (err) {
      req.payload.logger.error({ err }, '[payments:appypay:webhook-update-failed]')
      return new Response('Could not process webhook', { status: 500 })
    }

    return new Response('OK', { status: 200 })
  },
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
      return Response.json({ error: 'Stripe only supports EUR orders (Portugal, or Angola settling in EUR).' }, { status: 400 })
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
      return Response.json({ error: 'PayPal only supports EUR orders (Portugal, or Angola settling in EUR).' }, { status: 400 })
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
  appyPayCreateOrder,
  appyPayWebhook,
  stripeCreateSession,
  stripeWebhook,
  stripeSessionStatus,
  paypalCreateOrderEndpoint,
  paypalCaptureOrderEndpoint,
]
