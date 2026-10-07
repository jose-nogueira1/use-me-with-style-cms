import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVeroLines, veroLinesTotal, veroNotes } from '../src/lib/veroInvoice.ts'
import type { OrderForInternalInvoice } from '../src/lib/internalInvoice.ts'

const order = (over: Partial<OrderForInternalInvoice>): OrderForInternalInvoice => ({
  id: 1,
  orderNumber: 'UMWS-1',
  market: 'AO',
  customerName: 'Ana',
  customerEmail: 'ana@example.com',
  customerAddress: 'Luanda',
  currency: 'Kz',
  subtotal: 0,
  shippingCost: 0,
  total: 0,
  items: [],
  ...over,
})
const item = (productName: string, qty: number, unitPrice: number) => ({ productName, qty, unitPrice })

test('Vero lines sum exactly to the paid total, with shipping and a coupon folded into prices', () => {
  const o = order({
    items: [item('A', 3, 12_500.5), item('B', 1, 8_999.99), item('C', 7, 333.33)],
    shippingCost: 3_500,
    discountAmount: 1_234.57,
    total: 3 * 12_500.5 + 8_999.99 + 7 * 333.33 + 3_500 - 1_234.57,
  })
  const lines = buildVeroLines(o)
  assert.equal(veroLinesTotal(lines), Math.round(o.total * 100))
  assert.ok(lines.every((l) => Number.isInteger(l.unitPrice) && l.unitPrice >= 0 && l.quantity >= 1))
  assert.equal(lines.at(-1)?.description, 'Portes de envio')
  assert.equal(lines.at(-1)?.unitPrice, 350_000)
})

test('a discount that does not divide by quantity splits the line instead of drifting', () => {
  const lines = buildVeroLines(order({ items: [item('A', 3, 100)], total: 100, discountAmount: 200 }))
  assert.equal(veroLinesTotal(lines), 10_000)
  assert.deepEqual(lines.map((l) => [l.quantity, l.unitPrice]), [[2, 3333], [1, 3334], [1, 0]])
})

test('free delivery is shown as a zero-price line, with its coupon in the notes', () => {
  const o = order({ items: [item('A', 1, 5_000)], shippingCost: 0, total: 5_000, discountLabel: 'FREESHIP (free shipping)' })
  const lines = buildVeroLines(o)
  assert.deepEqual(lines.at(-1) && [lines.at(-1)!.description, lines.at(-1)!.unitPrice], ['Portes de envio (grátis)', 0])
  assert.equal(veroLinesTotal(lines), 500_000)
  assert.match(veroNotes(o), /\| Cupão: FREESHIP/)
})

test('empty or free orders are refused rather than invoiced', () => {
  assert.throws(() => buildVeroLines(order({ items: [], total: 0 })))
  assert.throws(() => buildVeroLines(order({ items: [item('A', 1, 0)], total: 0 })))
})

test('sale and coupon discounts are described in text, not hidden', () => {
  const o = order({
    items: [{ productName: 'Vestido', qty: 1, unitPrice: 20_000, regularUnitPrice: 25_000, saleDiscountPercentage: 20 }],
    total: 19_000,
    discountAmount: 1_000,
    discountLabel: 'BEMVINDA',
  })
  const [line] = buildVeroLines(o)
  assert.match(line.description, /Promoção -20%, preço original 25\.000,00 Kz/)
  assert.match(veroNotes(o), /UMWS-1 \| Desconto \(BEMVINDA\): 1\.000,00 Kz/)
  assert.equal(veroNotes(order({ orderNumber: 'X' })), 'Encomenda X')
  assert.equal(
    veroNotes(order({ orderNumber: 'X', paymentMethod: 'multicaixa_express', paymentReference: 'abc-123' })),
    'Encomenda X | Pagamento: Multicaixa Express (AppyPay), ref. abc-123',
  )
})
