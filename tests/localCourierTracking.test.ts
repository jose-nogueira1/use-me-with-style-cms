import assert from 'node:assert/strict'
import test from 'node:test'

import { Orders } from '../src/collections/Orders.ts'
import { orderLookupEndpoint } from '../src/endpoints/orderLookup.ts'
import { buildOrderStatusEmail } from '../src/lib/email.ts'
import { buildTrackingUrl, trackingProviderFor } from '../src/lib/messaging.ts'

test('Local courier references have no external tracking link, Portugal keeps CTT', () => {
  assert.equal(trackingProviderFor('AO'), 'courier_ao')
  assert.equal(trackingProviderFor('PT'), 'ctt')
  assert.equal(buildTrackingUrl('AO', 'ZY-12345'), undefined)
  assert.match(buildTrackingUrl('PT', 'RR123456789PT') ?? '', /ctt\.pt.*RR123456789PT/)
})

test('the shipped email shows the local courier reference without an external tracking link', () => {
  const email = buildOrderStatusEmail({
    to: 'a@example.com', orderNumber: 'AO-1', customerName: 'Ana', lang: 'pt', stage: 'shipped',
    courierTrackingCode: 'ZY-12345', courierProvider: 'courier_ao',
  })
  assert.match(email.html, /ZY-12345/)
  assert.match(email.html, /Referência do estafeta/)
  assert.doesNotMatch(email.html, /href="https:\/\/www\.zygo\.ao\/rastreio"/)
  assert.doesNotMatch(email.html, /CTT/)
  assert.match(buildOrderStatusEmail({ to: 'a@example.com', orderNumber: 'AO-1', customerName: 'Ana', lang: 'en', stage: 'shipped', courierTrackingCode: 'ZY-1', courierProvider: 'courier_ao' }).html, /Courier reference/)
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
  assert.equal(body.order.trackingProvider, 'courier_ao')
  assert.equal(body.order.trackingUrl, null)
})

test('a courier reference saved before dispatch rides on the shipped email; saved after, it is sent on its own', async () => {
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
  // then marked shipped: one email, with the code without a carrier link
  const shipped = await run({ status: 'processing', cttTrackingCode: 'ZY-12345' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })
  assert.equal(shipped.length, 1)
  assert.match(shipped[0].html, /ZY-12345/)
  assert.doesNotMatch(shipped[0].html, /zygo\.ao\/rastreio/)
  // shipped first, number arrives later: ONE short tracking email (not a repeat of "shipped")
  const late = await run({ status: 'shipped' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })
  assert.equal(late.length, 1)
  assert.match(late[0].html, /Já pode acompanhar/)
  assert.doesNotMatch(late[0].html, /foi enviada e está a caminho/)
  // shipped and code entered in the same save: still one email, the shipped one
  const together = await run({ status: 'processing' }, { status: 'shipped', cttTrackingCode: 'ZY-12345' })
  assert.equal(together.length, 1)
  assert.match(together[0].html, /foi enviada e está a caminho/)
})
