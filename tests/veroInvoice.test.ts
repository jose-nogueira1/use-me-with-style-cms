import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVeroLines, customerPayload, veroLinesTotal, veroNotes } from '../src/lib/veroInvoice.ts'
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
  assert.deepEqual(lines.map((l) => [l.quantity, l.unitPrice]), [[2, 3333], [1, 3334], [1, 0], [1, 0]])
})

test('free delivery is shown as a zero-price line, with its coupon in the notes', () => {
  const o = order({ items: [item('A', 1, 5_000)], shippingCost: 0, total: 5_000, discountLabel: 'FREESHIP (free shipping)' })
  const lines = buildVeroLines(o)
  assert.deepEqual(lines.at(-1) && [lines.at(-1)!.description, lines.at(-1)!.unitPrice], ['Portes de envio (Grátis por cupão FREESHIP (free shipping))', 0])
  assert.equal(veroLinesTotal(lines), 500_000)
  assert.equal(veroNotes(o), 'Encomenda UMWS-1')
})

test('a coupon discount gets its own explanatory zero-price line', () => {
  const o = order({ items: [item('A', 1, 10)], total: 1, discountAmount: 9, discountLabel: 'TEST90 (90% off)' })
  const lines = buildVeroLines(o)
  assert.equal(veroLinesTotal(lines), 100)
  assert.deepEqual(lines.map((l) => [l.description, l.unitPrice]), [
    ['A (Original 10,00 Kz | Cupão -9,00 Kz)', 100],
    ['Desconto TEST90 (90% off): -9,00 Kz (já incluído nos preços acima)', 0],
    ['Portes de envio (Grátis)', 0],
  ])
})

test('no description ever contains a line break', () => {
  const [plain] = buildVeroLines(order({ items: [item('Plain', 2, 500)], total: 1_000 }))
  assert.equal(plain.description, 'Plain') // no discount, nothing appended
  const o = order({
    items: [{ productName: 'A', qty: 3, unitPrice: 100, regularUnitPrice: 150, saleDiscountPercentage: 33.33 }],
    total: 100,
    discountAmount: 200,
    discountLabel: 'X (10% off)',
    shippingCost: 0,
  })
  const lines = buildVeroLines(o)
  assert.ok(lines.length > 3)
  assert.ok(lines.every((l) => !/[\r\n]/.test(l.description)))
})

test('waived delivery says why and what it would normally cost', () => {
  const shipping = { regular: 4_000, freeThreshold: 80_000 }
  const byThreshold = buildVeroLines(order({ items: [item('A', 1, 90_000)], total: 90_000 }), shipping)
  assert.equal(byThreshold.at(-1)?.description, 'Portes de envio (Original 4.000,00 Kz | Grátis: compra acima de 80.000,00 Kz)')
  const byCoupon = buildVeroLines(order({ items: [item('A', 1, 5_000)], total: 5_000, discountLabel: 'FREESHIP (free shipping)' }), shipping)
  assert.equal(byCoupon.at(-1)?.description, 'Portes de envio (Original 4.000,00 Kz | Grátis por cupão FREESHIP (free shipping))')
  const paid = buildVeroLines(order({ items: [item('A', 1, 5_000)], shippingCost: 4_000, total: 9_000 }), shipping)
  assert.deepEqual([paid.at(-1)?.description, paid.at(-1)?.unitPrice], ['Portes de envio', 400_000])
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
  assert.equal(line.description, 'Vestido (Original 25.000,00 Kz | Promoção -20% | Cupão -1.000,00 Kz)')
  assert.equal(veroNotes(o), 'Encomenda UMWS-1')
  assert.equal(veroNotes(order({ orderNumber: 'X' })), 'Encomenda X')
  assert.equal(
    veroNotes(order({ orderNumber: 'X', paymentMethod: 'multicaixa_express', paymentReference: 'abc-123' })),
    'Encomenda X | Pagamento: Multicaixa Express (AppyPay), ref. abc-123',
  )
})

test('buyers without a NIF keep their details and become Consumidor Final per order', () => {
  const base = { orderNumber: 'AO-1', customerName: 'Ana Silva', customerEmail: 'ana@example.com', customerAddress: 'Luanda' }
  const noNif = customerPayload(order(base))
  assert.deepEqual([noNif.externalId, noNif.name, noNif.taxId, noNif.isConsumidorFinal], ['order_AO-1', 'Ana Silva', undefined, true])
  const withNif = customerPayload(order({ ...base, customerTaxId: ' 5000123456 ' }))
  assert.deepEqual([withNif.externalId, withNif.taxId, withNif.isConsumidorFinal], ['nif_5000123456', '5000123456', undefined])
})
