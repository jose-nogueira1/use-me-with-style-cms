import assert from 'node:assert/strict'
import test from 'node:test'

import { applyAuthoritativeOrderValues } from '../src/lib/authoritativeOrder.ts'
import { claimCouponRedemption, resolveCoupon } from '../src/lib/couponPricing.ts'
import { calculateIncludedVatInvoice } from '../src/lib/internalInvoice.ts'
import { inventoryDeltasForOrder, manageInventoryReservation } from '../src/lib/inventoryReservation.ts'
import { effectiveUnitPrice, isProductOnSale } from '../src/lib/salePricing.ts'

const NOW = new Date('2026-07-28T12:00:00.000Z')

test('sale pricing respects market-specific prices and the active window', () => {
  const product = {
    priceAOKz: 50_000,
    pricePTEur: 50,
    saleAOKz: 40_000,
    salePTEur: 42,
    saleStartDate: '2026-07-01T00:00:00.000Z',
    saleEndDate: '2026-07-31T23:59:59.000Z',
  }
  assert.equal(isProductOnSale(product, NOW), true)
  assert.equal(effectiveUnitPrice(product, 'AO', NOW), 40_000)
  assert.equal(effectiveUnitPrice(product, 'PT', NOW), 42)
  assert.equal(effectiveUnitPrice(product, 'PT', new Date('2026-08-01T00:00:00.000Z')), 50)
})

test('coupon validation enforces market, window, limits, minimum and amount cap', async () => {
  const coupon = {
    id: 7,
    code: 'SAVE20',
    active: true,
    type: 'percent',
    percentOff: 20,
    minOrderValuePTEur: 50,
    usageLimit: 2,
    usageCount: 1,
    maxRedemptionsPerEmail: 1,
    availableAO: false,
    availablePT: true,
    startDate: '2026-07-01T00:00:00.000Z',
    endDate: '2026-07-31T23:59:59.000Z',
  }
  const payload = {
    find: async () => ({ docs: [coupon] }),
    count: async () => ({ totalDocs: 0 }),
  }
  assert.deepEqual(
    await resolveCoupon(payload as never, { code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 100, now: NOW }),
    { valid: true, code: 'SAVE20', discountAmount: 20, label: 'SAVE20 (20% off)' },
  )
  assert.equal((await resolveCoupon(payload as never, { code: 'save20', market: 'AO', pricingMarket: 'AO', subtotal: 100, now: NOW })).valid, false)
  assert.equal((await resolveCoupon(payload as never, { code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 20, now: NOW })).valid, false)
})

test('coupon claim increments usage inside the request transaction', async () => {
  const calls: string[] = []
  const coupon = { id: 7, code: 'SAVE10', active: true, type: 'percent', percentOff: 10, usageCount: 0 }
  const payload = {
    find: async (options: { req?: unknown }) => {
      assert.ok(options.req)
      calls.push('find')
      return { docs: [coupon] }
    },
    count: async () => ({ totalDocs: 0 }),
    update: async (options: { data: { usageCount: number }; req?: unknown }) => {
      assert.ok(options.req)
      calls.push('update')
      assert.equal(options.data.usageCount, 1)
      return { ...coupon, usageCount: 1 }
    },
  }
  const req = { payload } as never
  const result = await claimCouponRedemption(req, { code: 'save10', market: 'PT', pricingMarket: 'PT', subtotal: 80, now: NOW })
  assert.equal(result.valid, true)
  assert.deepEqual(calls, ['find', 'find', 'update'])
})

test('authoritative order ignores submitted prices and applies sale, coupon and shipping', async () => {
  const coupon = { id: 9, code: 'SAVE10', active: true, type: 'percent', percentOff: 10, usageCount: 0 }
  const payload = {
    db: {},
    findByID: async () => ({
      id: 4, active: true, availableAO: true, availablePT: true,
      name: 'Vestido', nameEN: 'Dress', namePT: 'Vestido', priceAOKz: 50_000, pricePTEur: 50,
      salePTEur: 40, variants: [{ color: 3, size: 'M', stockAO: 2, stockPT: 2 }],
    }),
    find: async (options: { collection: string }) => options.collection === 'colors'
      ? { docs: [{ id: 3, namePT: 'Preto', nameEN: 'Black' }] }
      : { docs: [coupon] },
    count: async () => ({ totalDocs: 0 }),
    update: async () => coupon,
  }
  const data = await applyAuthoritativeOrderValues({
    data: {
      market: 'PT', lang: 'en', paymentMethod: 'mbway', deliveryMethod: 'ctt', customerEmail: ' USER@EXAMPLE.COM ',
      couponCode: 'SAVE10', items: [{ product: 4, size: 'M', color: '3', qty: 2, unitPrice: 1 }],
      subtotal: 2, total: 2,
    },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)
  assert.equal(data?.items?.[0]?.unitPrice, 40)
  assert.equal(data?.subtotal, 80)
  assert.equal(data?.discountAmount, 8)
  assert.equal(data?.shippingCost, 4)
  assert.equal(data?.total, 76)
  assert.equal(data?.customerEmail, 'user@example.com')
})

test('inventory groups duplicate variants and reserves stock once', async () => {
  const order = {
    market: 'PT', paymentMethod: 'mbway',
    items: [
      { product: 4, size: 'M', color: 'Black', colorId: '3', qty: 1 },
      { product: 4, size: 'M', color: 'Black', colorId: '3', qty: 2 },
    ],
  }
  assert.equal(inventoryDeltasForOrder(order)[0].qty, 3)
  let updatedStock: number | undefined
  const payload = {
    find: async () => ({ docs: [] }),
    findByID: async () => ({ id: 4, variants: [{ id: 'v1', color: 3, size: 'M', stockAO: 8, stockPT: 5 }] }),
    update: async (options: { collection: string; data: { variants?: Array<{ stockPT: number }> } }) => {
      if (options.collection === 'products') updatedStock = options.data.variants?.[0]?.stockPT
      return {}
    },
  }
  const result = await manageInventoryReservation({ data: order, operation: 'create', context: {}, req: { payload } } as never)
  assert.equal(updatedStock, 2)
  assert.equal(result?.inventoryReservationStatus, 'active')
})

test('invoice calculation reconciles products, shipping, coupon and included VAT', () => {
  const result = calculateIncludedVatInvoice({
    items: [{ productName: 'Dress', size: 'M', color: 'Black', qty: 2, unitPrice: 40 }],
    shippingCost: 4,
    discountAmount: 8,
    discountLabel: 'SAVE10 (10% off)',
    total: 76,
  }, 23, 'en')
  assert.equal(result.total, 76)
  assert.equal(result.netTotal, 61.79)
  assert.equal(result.taxTotal, 14.21)
  assert.equal(result.lines.find((line) => line.description.startsWith('SAVE10'))?.grossAmount, -8)
  assert.equal(result.lines.some((line) => line.description === 'Order adjustment'), false)
})
