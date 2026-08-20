import assert from 'node:assert/strict'
import test from 'node:test'
import * as returnRules from '../src/lib/returns.ts'
import { buildReturnStatusEmail } from '../src/lib/email.ts'

const { allocateReturnAmounts, requestedRefund } = returnRules

test('Angola and Portugal return requests remain eligible for 14 days', () => {
  const returnWindowHours = (returnRules as Record<string, unknown>).RETURN_WINDOW_HOURS
  assert.equal(returnWindowHours, 14 * 24)
  const isWithinReturnWindow = (returnRules as Record<string, unknown>).isWithinReturnWindow
  assert.equal(typeof isWithinReturnWindow, 'function')
  const withinWindow = isWithinReturnWindow as (deliveredAt: string | undefined, now?: number) => boolean
  const now = Date.UTC(2026, 7, 20, 12)
  assert.equal(withinWindow(new Date(now - 13 * 24 * 60 * 60_000).toISOString(), now), true)
  assert.equal(withinWindow(new Date(now - 15 * 24 * 60 * 60_000).toISOString(), now), false)
})

test('return allocation preserves original prices and allocates order coupon proportionally', () => {
  const items = allocateReturnAmounts([
    { id: 'a', product: 1, productName: 'Dress', qty: 2, unitPrice: 50 },
    { id: 'b', product: 2, productName: 'Top', qty: 1, unitPrice: 100 },
  ], 20)
  assert.equal(items[0].couponShare, 10)
  assert.equal(items[0].refundableAmount, 90)
  assert.equal(items[1].couponShare, 10)
  assert.equal(requestedRefund(items), 180)
})

test('return status email is bilingual and escapes customer-controlled fields', () => {
  const pt = buildReturnStatusEmail({ to: 'buyer@example.com', customerName: '<Ana>', returnNumber: 'RET-PT-1', orderNumber: 'PT-1', status: 'received', resolution: 'refund', amount: 20, currency: 'EUR', lang: 'pt' })
  const en = buildReturnStatusEmail({ to: 'buyer@example.com', customerName: 'Ana', returnNumber: 'RET-PT-1', orderNumber: 'PT-1', status: 'received', resolution: 'refund', amount: 20, currency: 'EUR', lang: 'en' })
  assert.match(pt.html, /Artigo recebido/)
  assert.match(en.html, /Item received/)
  assert.doesNotMatch(pt.html, /<Ana>/)
})
