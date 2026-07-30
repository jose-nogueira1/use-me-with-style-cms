import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import test from 'node:test'

import { metaConversionEndpoints, sendMetaPurchase } from '../src/endpoints/metaConversions'

const logger = { error: () => undefined }
const originalFetch = globalThis.fetch

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function configuredMeta() {
  process.env.META_PIXEL_ID = '1234567890'
  process.env.META_ACCESS_TOKEN = 'test-token'
}

test.afterEach(() => {
  globalThis.fetch = originalFetch
  delete process.env.META_PIXEL_ID
  delete process.env.META_ACCESS_TOKEN
  delete process.env.META_TEST_EVENT_CODE
})

test('purchase conversion is suppressed without affirmative consent', async () => {
  configuredMeta()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    return new Response(null, { status: 200 })
  }

  const sent = await sendMetaPurchase({ analyticsConsent: false, orderNumber: 'AO-100' }, logger)
  assert.equal(sent, false)
  assert.equal(calls, 0)
})

test('purchase conversion normalizes AO currency and hashes customer identifiers', async () => {
  configuredMeta()
  process.env.META_TEST_EVENT_CODE = 'TEST123'
  let requestBody: Record<string, unknown> | undefined
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body))
    return Response.json({ events_received: 1 })
  }

  const sent = await sendMetaPurchase({
    analyticsConsent: true,
    orderNumber: 'AO-100',
    customerEmail: ' Customer@Example.COM ',
    customerPhone: '+244 933 617 878',
    metaFbp: 'fb.1.123',
    metaFbc: 'fb.1.456',
    metaEventSourceUrl: 'https://ao.usemewithstyle.shop/checkout',
    total: 80000,
    currency: 'Kz',
    items: [{ product: 7, qty: 2 }],
  }, logger)

  assert.equal(sent, true)
  assert.equal(requestBody?.test_event_code, 'TEST123')
  const event = (requestBody?.data as Array<Record<string, unknown>>)[0]
  assert.equal(event.event_id, 'purchase-AO-100')
  assert.equal(event.event_source_url, 'https://ao.usemewithstyle.shop/checkout')
  assert.deepEqual(event.custom_data, {
    value: 80000,
    currency: 'AOA',
    content_type: 'product',
    content_ids: ['7'],
    num_items: 2,
    order_id: 'AO-100',
  })
  assert.deepEqual(event.user_data, {
    em: [sha256('customer@example.com')],
    ph: [sha256('244933617878')],
    fbp: 'fb.1.123',
    fbc: 'fb.1.456',
  })
})

test('browser conversion endpoint requires consent and preserves the shared deduplication ID', async () => {
  configuredMeta()
  let requestBody: Record<string, unknown> | undefined
  globalThis.fetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body))
    return Response.json({ events_received: 1 })
  }
  const handler = metaConversionEndpoints[0].handler
  const baseRequest = {
    headers: new Headers({ 'user-agent': 'qa-browser', 'x-forwarded-for': '203.0.113.4' }),
    payload: { logger },
  }

  const rejected = await handler({
    ...baseRequest,
    json: async () => ({ eventName: 'InitiateCheckout', eventId: 'dedupe-123', analyticsConsent: false }),
  } as never)
  assert.equal(rejected.status, 403)
  assert.equal(requestBody, undefined)

  const accepted = await handler({
    ...baseRequest,
    json: async () => ({
      eventName: 'InitiateCheckout',
      eventId: 'dedupe-123',
      analyticsConsent: true,
      eventSourceUrl: 'https://pt.usemewithstyle.shop/carrinho',
      customData: { value: 24.9, currency: 'EUR' },
    }),
  } as never)
  assert.equal(accepted.status, 204)
  const event = (requestBody?.data as Array<Record<string, unknown>>)[0]
  assert.equal(event.event_id, 'dedupe-123')
  assert.deepEqual(event.custom_data, { value: 24.9, currency: 'EUR' })
})
