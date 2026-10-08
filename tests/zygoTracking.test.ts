import assert from 'node:assert/strict'
import test from 'node:test'

import { Orders } from '../src/collections/Orders.ts'
import { orderLookupEndpoint } from '../src/endpoints/orderLookup.ts'
import { buildOrderStatusEmail } from '../src/lib/email.ts'
import { buildTrackingUrl, trackingProviderFor, ZYGO_TRACKING_URL } from '../src/lib/messaging.ts'

test('Angola orders link to Zygo\'s tracking page, Portugal keeps CTT', () => {
  assert.equal(trackingProviderFor('AO'), 'zygo')
  assert.equal(trackingProviderFor('PT'), 'ctt')
  assert.equal(buildTrackingUrl('AO', 'ZY-12345'), ZYGO_TRACKING_URL)
  assert.equal(ZYGO_TRACKING_URL, 'https://www.zygo.ao/rastreio')
  assert.match(buildTrackingUrl('PT', 'RR123456789PT'), /ctt\.pt.*RR123456789PT/)
})

test('the shipped email shows the Zygo number and a Zygo link', () => {
  const email = buildOrderStatusEmail({
    to: 'a@example.com', orderNumber: 'AO-1', customerName: 'Ana', lang: 'pt', stage: 'shipped',
    courierTrackingCode: 'ZY-12345', courierTrackingUrl: ZYGO_TRACKING_URL, courierProvider: 'zygo',
  })
  assert.match(email.html, /ZY-12345/)
  assert.match(email.html, /SEGUIR NA ZYGO/)
  assert.match(email.html, /href="https:\/\/www\.zygo\.ao\/rastreio"/)
  assert.doesNotMatch(email.html, /CTT/)
  assert.match(buildOrderStatusEmail({ to: 'a@example.com', orderNumber: 'AO-1', customerName: 'Ana', lang: 'en', stage: 'shipped', courierTrackingCode: 'ZY-1', courierTrackingUrl: ZYGO_TRACKING_URL, courierProvider: 'zygo' }).html, /TRACK WITH ZYGO/)
})

test('the tracking number rule depends on the market', () => {
  const field = Orders.fields.find((f) => 'name' in f && f.name === 'cttTrackingCode') as unknown as { validate: (v: unknown, o: unknown) => true | string }
  const check = (value: string, market: string) => field.validate(value, { siblingData: { market } })
  assert.equal(check('ZY-2026/0001', 'AO'), true)
  assert.equal(check('', 'AO'), true)
  assert.notEqual(check('ab', 'AO'), true)
  assert.notEqual(check('ZY 1;DROP', 'AO'), true)
  assert.equal(check('RR123456789PT', 'PT'), true)
  assert.notEqual(check('ZY-12345', 'PT'), true) // CTT rule unchanged
})

test('order lookup tells the storefront who carries the order and where to follow it', async () => {
  const order = { orderNumber: 'AO-1', customerEmail: 'a@example.com', market: 'AO', status: 'shipped', paymentStatus: 'paid', total: 100, currency: 'AOA', cttTrackingCode: 'ZY-12345', updatedAt: '2026-10-09T00:00:00.000Z' }
  const req = {
    headers: new Headers({ 'x-forwarded-for': '203.0.113.77' }),
    json: async () => ({ orderNumber: order.orderNumber, email: order.customerEmail }),
    payload: { find: async () => ({ docs: [order] }), logger: { info: () => {}, warn: () => {} } },
  }
  const body = await (await orderLookupEndpoint.handler(req as never)).json() as { order: Record<string, unknown> }
  assert.equal(body.order.trackingProvider, 'zygo')
  assert.equal(body.order.trackingUrl, ZYGO_TRACKING_URL)
})

test('a Zygo number saved before dispatch rides on the shipped email; saved after, it is sent on its own', async () => {
  const { notifyOrderEvent } = await import('../src/hooks/notifyOrderEvent.ts')
  process.env.RESEND_API_KEY = 'test-key' // the sender is a fake payload.sendEmail below
  const base = { orderNumber: 'AO-1', market: 'AO', customerEmail: 'a@example.com', customerName: 'Ana', lang: 'pt', paymentStatus: 'paid' }
  const run = async (previousDoc: object, doc: object) => {
    const sent: Array<{ html: string }> = []
    const req = { payload: { sendEmail: async (m: { html: string }) => { sent.push(m) }, logger: { info() {}, warn() {}, error() {} } } }
    await notifyOrderEvent({ doc: { ...base, ...doc }, previousDoc: { ...base, ...previousDoc }, operation: 'update', req, context: {} } as never)
    return sent
  }
  // code typed while still processing: no "shipped" email yet
  assert.equal((await run({ status: 'processing' }, { status: 'processing', cttTrackingCode: 'ZY-12345' })).length, 0)
  // then marked shipped: one email, with the code and the Zygo link
  const shipped = await run({ status: 'processing', cttTrackingCode: 'ZY-12345' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })
  assert.equal(shipped.length, 1)
  assert.match(shipped[0].html, /ZY-12345/)
  assert.match(shipped[0].html, /zygo\.ao\/rastreio/)
  // shipped first, number arrives later: a dedicated email
  assert.equal((await run({ status: 'shipped' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })).length, 1)
  // shipped and code entered together: still one email
  assert.equal((await run({ status: 'processing' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })).length, 1)
})
