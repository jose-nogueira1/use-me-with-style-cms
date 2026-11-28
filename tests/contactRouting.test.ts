import assert from 'node:assert/strict'
import test from 'node:test'
import type { PayloadRequest } from 'payload'
import { contactEndpoint } from '../src/endpoints/contact'
import { orderLookupEndpoint } from '../src/endpoints/orderLookup'

const order = { orderNumber: 'AO-123', customerEmail: 'buyer@example.com', customerName: 'Buyer', market: 'AO', status: 'delivered', items: [{ productName: 'Dress', qty: 1, size: 'M', unitPrice: 20 }], total: 20 }
test('return requests verify order ownership and article, and route server-owned details to returns', async t => {
  const previous = process.env.RESEND_API_KEY
  process.env.RESEND_API_KEY = 'unit-test'
  t.after(() => { if (previous === undefined) delete process.env.RESEND_API_KEY; else process.env.RESEND_API_KEY = previous })
  const messages: Array<{ to: string; html: string }> = []
  const find = t.mock.fn(async () => ({ docs: [order] }))
  const request = (body: object, ip: string) => ({
    headers: new Headers({ 'x-real-ip': ip }), json: async () => body,
    payload: { find, sendEmail: async (message: typeof messages[number]) => { messages.push(message) }, logger: { warn() {}, error() {}, info() {} } },
  }) as unknown as PayloadRequest
  const input = { topic: 'returns', email: order.customerEmail, orderNumber: '#AO-123', article: '0', message: 'Wrong size' }
  const bad = await contactEndpoint.handler(request({ ...input, email: 'other@example.com' }, 'bad-owner')) as Response
  assert.equal(bad.status, 400)
  assert.equal(messages.length, 0)
  const invalid = await contactEndpoint.handler(request({ ...input, article: '20' }, 'bad-item')) as Response
  assert.equal(invalid.status, 400)
  const good = await contactEndpoint.handler(request(input, 'good-owner')) as Response
  assert.equal(good.status, 200)
  assert.equal(messages[0].to, 'returns@usemewithstyle.shop')
  assert.match(messages[0].html, /Dress/)
  assert.match(messages[0].html, /Wrong size/)
  for (const topic of ['support', 'legal']) {
    messages.length = 0
    const response = await contactEndpoint.handler(request({ name: 'Buyer', email: order.customerEmail, topic, message: 'Question' }, topic)) as Response
    assert.equal(response.status, 200)
    assert.equal(messages[0].to, topic + '@usemewithstyle.shop')
  }
  const hidden = await orderLookupEndpoint.handler(request({ orderNumber: '#AO-123', email: 'other@example.com' }, 'lookup-denied')) as Response
  assert.deepEqual(await hidden.json(), { order: null })
  const visible = await orderLookupEndpoint.handler(request({ orderNumber: '#AO-123', email: order.customerEmail }, 'lookup-ok')) as Response
  const data = await visible.json()
  assert.equal(data.order.items[0].productName, 'Dress')
})
