import assert from 'node:assert/strict'
import test from 'node:test'

import { buildVeroLines, customerPayload, discountPercentFor, veroLinesTotal, veroNotes } from '../src/lib/veroInvoice.ts'
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
    ['Portes de envio', 0],
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
  // free because the municipality is priced at 0, not because of the threshold
  const zeroMunicipality = buildVeroLines(order({ items: [item('A', 1, 5_000)], total: 5_000 }), { regular: 0, freeThreshold: 80_000 })
  assert.deepEqual([zeroMunicipality.at(-1)?.description, zeroMunicipality.at(-1)?.unitPrice], ['Portes de envio', 0]) // a price of 0, not a free delivery
  // the threshold is judged after discounts: 90.000 minus a 20.000 coupon is under 80.000
  const discounted = buildVeroLines(order({ items: [item('A', 1, 90_000)], total: 70_000, discountAmount: 20_000, discountLabel: 'F (discount)' }), { regular: 0, freeThreshold: 80_000 })
  assert.equal(discounted.at(-1)?.description, 'Portes de envio')
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

test('lineDiscount mode keeps the full price on the line and still sums to the paid total', () => {
  const o = order({
    items: [{ productName: 'Vestido', qty: 2, unitPrice: 20_000, regularUnitPrice: 25_000, saleDiscountPercentage: 20 }],
    total: 38_500,
    discountAmount: 1_500,
    discountLabel: 'X',
  })
  const lines = buildVeroLines(o, undefined, true)
  const [item] = lines
  assert.equal(item.unitPrice, 2_500_000) // full price, not the sale price
  assert.ok(item.lineDiscount && item.lineDiscount > 0 && item.lineDiscount < 100)
  assert.equal(item.description, 'Vestido (Promoção -20% | Cupão X -1.500,00 Kz)')
  assert.equal(lines.length, 2) // item + delivery: no zero-price coupon row
  assert.equal(veroLinesTotal(lines), 3_850_000)
})

test('without the flag no line carries lineDiscount', () => {
  const o = order({ items: [item('A', 2, 100)], total: 100, discountAmount: 100 })
  assert.ok(buildVeroLines(o).every((l) => l.lineDiscount === undefined))
})

test('discountPercentFor hits the exact discounted unit and refuses unsafe prices', () => {
  assert.equal(discountPercentFor(1_000_000, 850_000), 15)
  assert.equal(discountPercentFor(1_000_000, 1_000_000), 0)
  assert.equal(discountPercentFor(1_000_000, 0), 100)
  assert.equal(discountPercentFor(1_000_000, 1_000_001), null) // would need a surcharge
  assert.equal(discountPercentFor(100_000_000, 50_000_000), null) // >= 1.000.000 Kz per unit
})

test('lineDiscount mode is exact for thousands of random orders (Vero rounds the discounted unit)', () => {
  let seed = 12345
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296)
  for (let n = 0; n < 3000; n++) {
    const items = Array.from({ length: 1 + Math.floor(rnd() * 3) }, (_, i) => {
      const unitPrice = Math.round((1 + rnd() * 90_000) * 100) / 100
      const sale = rnd() < 0.4
      return { productName: `P${i}`, qty: 1 + Math.floor(rnd() * 9), unitPrice, regularUnitPrice: sale ? Math.round(unitPrice * (1.1 + rnd()) * 100) / 100 : undefined }
    })
    const merch = items.reduce((sum, it) => sum + Math.round(it.qty * it.unitPrice * 100), 0) / 100
    const percent = rnd() < 0.5
    const eligibleMerch = items.reduce((sum, it) => sum + (percent && it.regularUnitPrice ? 0 : Math.round(it.qty * it.unitPrice * 100)), 0) / 100
    const discountAmount = rnd() < 0.5 ? Math.round(rnd() * (percent ? eligibleMerch : merch) * 0.9 * 100) / 100 : 0
    const shippingCost = rnd() < 0.5 ? 3_500 : 0
    const o = order({ items, shippingCost, discountAmount, discountLabel: discountAmount ? (percent ? 'X (10% off)' : 'X (discount)') : undefined, total: Math.round((merch - discountAmount + shippingCost) * 100) / 100 })
    const lines = buildVeroLines(o, undefined, true)
    assert.equal(veroLinesTotal(lines), Math.round(o.total * 100), JSON.stringify(o))
    for (const l of lines) {
      assert.ok(Number.isInteger(l.quantity) && l.quantity >= 1 && Number.isInteger(l.unitPrice))
      if (l.lineDiscount !== undefined) assert.ok(l.lineDiscount > 0 && l.lineDiscount <= 100 && Math.abs(l.lineDiscount * 1e6 - Math.round(l.lineDiscount * 1e6)) < 1e-6)
    }
  }
})

test('a percent coupon is shown only against items that were not on sale', () => {
  const items = [
    { productName: 'Sale', qty: 1, unitPrice: 20_000, regularUnitPrice: 25_000, saleDiscountPercentage: 20 },
    { productName: 'Regular', qty: 1, unitPrice: 10_000 },
  ]
  // 10% off the non-sale item only: 1.000 Kz
  const percent = order({ items, total: 29_000, discountAmount: 1_000, discountLabel: 'P10 (10% off)' })
  const [sale, regular] = buildVeroLines(percent)
  assert.doesNotMatch(sale.description, /Cupão/)
  assert.match(regular.description, /Cupão -1\.000,00 Kz/)
  assert.equal(veroLinesTotal(buildVeroLines(percent)), 2_900_000)
  // a fixed coupon spreads over everything, sale item included
  const fixed = order({ items, total: 28_500, discountAmount: 1_500, discountLabel: 'F15 (discount)' })
  const [sale2, regular2] = buildVeroLines(fixed)
  assert.match(sale2.description, /Cupão/)
  assert.match(regular2.description, /Cupão/)
  assert.equal(veroLinesTotal(buildVeroLines(fixed)), 2_850_000)
})

test('line-discount mode keeps the coupon row only when some item had to fold its discount', () => {
  // a unit price of 1.000.000 Kz or more cannot use Vero's percentage safely
  const big = order({ items: [{ productName: 'Big', qty: 1, unitPrice: 1_000_000 }], total: 900_000, discountAmount: 100_000, discountLabel: 'C (10% off)' })
  const lines = buildVeroLines(big, undefined, true)
  assert.ok(lines.some((l) => l.description.startsWith('Desconto C')))
  assert.equal(veroLinesTotal(lines), 90_000_000)
})
