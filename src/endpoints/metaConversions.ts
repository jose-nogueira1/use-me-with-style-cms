import { createHash } from 'node:crypto'
import type { Endpoint } from 'payload'

type MetaEventBody = {
  eventName?: string
  eventId?: string
  eventSourceUrl?: string
  customData?: Record<string, unknown>
  email?: string
  phone?: string
  fbp?: string
  fbc?: string
}

const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Purchase'])

function hash(value: string | undefined) {
  if (!value) return undefined
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

type MetaLogger = { error: (details: unknown, message?: string) => void }

async function postMetaEvent(body: MetaEventBody, userData: Record<string, string | string[]>, logger: MetaLogger) {
  const pixelId = process.env.META_PIXEL_ID
  const accessToken = process.env.META_ACCESS_TOKEN
  if (!pixelId || !accessToken || !body.eventName || !body.eventId) return false

  try {
    const response = await fetch(`https://graph.facebook.com/v23.0/${encodeURIComponent(pixelId)}/events?access_token=${encodeURIComponent(accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: [{ event_name: body.eventName, event_time: Math.floor(Date.now() / 1000), event_id: body.eventId, action_source: 'website', event_source_url: body.eventSourceUrl, user_data: userData, custom_data: body.customData || {} }],
        ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {}),
      }),
    })
    if (!response.ok) {
      logger.error({ status: response.status, body: await response.text() }, '[meta:capi-failed]')
      return false
    }
    return true
  } catch (err) {
    logger.error({ err }, '[meta:capi-request-failed]')
    return false
  }
}

type PaidOrder = {
  analyticsConsent?: boolean | null
  orderNumber?: string | null
  customerEmail?: string | null
  customerPhone?: string | null
  metaFbp?: string | null
  metaFbc?: string | null
  metaEventSourceUrl?: string | null
  total?: number | null
  currency?: string | null
  items?: Array<{ product?: string | number | { id?: string | number } | null; qty?: number | null }> | null
}

export async function sendMetaPurchase(order: PaidOrder, logger: MetaLogger) {
  if (!order.analyticsConsent || !order.orderNumber) return false
  const userData: Record<string, string | string[]> = {}
  const email = hash(order.customerEmail || undefined)
  const phone = hash(order.customerPhone?.replace(/\D/g, '') || undefined)
  if (email) userData.em = [email]
  if (phone) userData.ph = [phone]
  if (order.metaFbp) userData.fbp = order.metaFbp
  if (order.metaFbc) userData.fbc = order.metaFbc
  const contentIds = order.items?.map((item) => typeof item.product === 'object' ? String(item.product?.id || '') : String(item.product || '')).filter(Boolean)
  return postMetaEvent({
    eventName: 'Purchase',
    eventId: `purchase-${order.orderNumber}`,
    eventSourceUrl: order.metaEventSourceUrl || undefined,
    customData: {
      value: order.total ?? 0,
      currency: order.currency === 'Kz' ? 'AOA' : order.currency || 'EUR',
      content_type: 'product',
      content_ids: contentIds,
      num_items: order.items?.reduce((sum, item) => sum + (item.qty || 0), 0) || 0,
      order_id: order.orderNumber,
    },
  }, userData, logger)
}

const metaEvents: Endpoint = {
  path: '/meta/events',
  method: 'post',
  handler: async (req) => {
    if (!process.env.META_PIXEL_ID || !process.env.META_ACCESS_TOKEN) return new Response(null, { status: 204 })

    let body: MetaEventBody
    try {
      body = (await req.json?.()) as MetaEventBody
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    if (!body.eventName || !body.eventId || !ALLOWED_EVENTS.has(body.eventName)) {
      return Response.json({ error: 'Invalid event' }, { status: 400 })
    }

    const userData: Record<string, string | string[]> = {}
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || undefined
    const userAgent = req.headers.get('user-agent') || undefined
    if (ip) userData.client_ip_address = ip
    if (userAgent) userData.client_user_agent = userAgent
    const email = hash(body.email)
    const phone = hash(body.phone?.replace(/\D/g, ''))
    if (email) userData.em = [email]
    if (phone) userData.ph = [phone]
    if (body.fbp) userData.fbp = body.fbp
    if (body.fbc) userData.fbc = body.fbc

    const sent = await postMetaEvent(body, userData, req.payload.logger)
    return sent ? new Response(null, { status: 204 }) : Response.json({ error: 'Meta event unavailable' }, { status: 502 })
  },
}

export const metaConversionEndpoints = [metaEvents]
