import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { applyAuthoritativeOrderValues, authoritativeShippingCost } from '../src/lib/authoritativeOrder.ts'
import { claimCouponRedemption, releaseCouponRedemption, resolveCoupon } from '../src/lib/couponPricing.ts'
import { calculateIncludedVatInvoice, resolveVatRate } from '../src/lib/internalInvoice.ts'
import { inventoryDeltasForOrder, manageInventoryReservation } from '../src/lib/inventoryReservation.ts'
import { effectiveUnitPrice, isProductOnSale } from '../src/lib/salePricing.ts'
import { portugalDeliveryRegion } from '../src/lib/portugalShipping.ts'
import { orderLookupEndpoint } from '../src/endpoints/orderLookup.ts'

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
    { valid: true, code: 'SAVE20', discountAmount: 20, freeShipping: false, label: 'SAVE20 (20% off)' },
  )
  assert.equal((await resolveCoupon(payload as never, { code: 'save20', market: 'AO', pricingMarket: 'AO', subtotal: 100, now: NOW })).valid, false)
  assert.equal((await resolveCoupon(payload as never, { code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 20, now: NOW })).valid, false)
})

// Free delivery coupon type (2026-07-31 admin request): resolveCoupon
// returns freeShipping instead of a discountAmount -- it never touches
// shipping math itself (see authoritativeOrder.ts/Checkout.tsx for where
// the actual waiver happens), so discountAmount stays 0 even though the
// coupon is fully valid and should NOT be rejected the way a genuine
// zero-value percent/fixed coupon would be.
test('free-shipping coupon resolves with a shipping waiver instead of a discount amount', async () => {
  const coupon = { id: 11, code: 'FREESHIP', active: true, type: 'free_shipping', availableAO: true, availablePT: true }
  const payload = {
    find: async () => ({ docs: [coupon] }),
    count: async () => ({ totalDocs: 0 }),
  }
  assert.deepEqual(
    await resolveCoupon(payload as never, { code: 'freeship', market: 'PT', pricingMarket: 'PT', subtotal: 50, now: NOW }),
    { valid: true, code: 'FREESHIP', discountAmount: 0, freeShipping: true, label: 'FREESHIP (free shipping)' },
  )
})

// Percent-off excludes sale items (2026-08-04 user request: "if a product
// already has a promotion going on... the coupon with discount percentage
// should not work on those products"). Fixed-amount deliberately ignores
// eligibleSubtotal -- confirmed decision: "Fixed value coupon should just
// discount from the total amount regardless of what products she has in
// the cart."
test('percent-off coupons only discount the non-sale portion of the cart; fixed-off ignores it', async () => {
  const percentCoupon = { id: 20, code: 'SAVE20', active: true, type: 'percent', percentOff: 20, availableAO: true, availablePT: true }
  const percentPayload = { find: async () => ({ docs: [percentCoupon] }), count: async () => ({ totalDocs: 0 }) }
  // Cart: EUR 60 full-price + EUR 40 already on sale = 100 subtotal, but
  // only the 60 is eligible. 20% of 60 = 12, not 20% of 100 = 20.
  assert.deepEqual(
    await resolveCoupon(percentPayload as never, {
      code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 100, eligibleSubtotal: 60, now: NOW,
    }),
    { valid: true, code: 'SAVE20', discountAmount: 12, freeShipping: false, label: 'SAVE20 (20% off)' },
  )
  // Every line on sale -- nothing left for a percentage to discount.
  assert.equal(
    (await resolveCoupon(percentPayload as never, {
      code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 100, eligibleSubtotal: 0, now: NOW,
    })).valid,
    false,
  )
  // Omitting eligibleSubtotal entirely (an un-updated caller) keeps the old
  // full-subtotal behaviour -- backward compatible.
  assert.deepEqual(
    await resolveCoupon(percentPayload as never, { code: 'save20', market: 'PT', pricingMarket: 'PT', subtotal: 100, now: NOW }),
    { valid: true, code: 'SAVE20', discountAmount: 20, freeShipping: false, label: 'SAVE20 (20% off)' },
  )

  const fixedCoupon = { id: 21, code: 'FLAT10', active: true, type: 'fixed', fixedOffPTEur: 10, availableAO: true, availablePT: true }
  const fixedPayload = { find: async () => ({ docs: [fixedCoupon] }), count: async () => ({ totalDocs: 0 }) }
  // Same cart (60 eligible / 100 total) -- a fixed EUR 10 off applies in
  // full regardless of eligibleSubtotal being far smaller.
  assert.deepEqual(
    await resolveCoupon(fixedPayload as never, {
      code: 'flat10', market: 'PT', pricingMarket: 'PT', subtotal: 100, eligibleSubtotal: 0, now: NOW,
    }),
    { valid: true, code: 'FLAT10', discountAmount: 10, freeShipping: false, label: 'FLAT10 (discount)' },
  )
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

// Bug found 2026-08-07: a shopper's order was cancelled before payment, but
// the coupon's per-email limit still counted it, permanently blocking them
// from ever using that code again. The fix excludes cancelled orders from
// the count query -- this pins the `where` clause shape so a future edit
// can't silently drop that filter.
test('maxRedemptionsPerEmail excludes cancelled orders from the prior-redemptions count', async () => {
  const coupon = { id: 30, code: 'ONCE', active: true, type: 'percent', percentOff: 10, maxRedemptionsPerEmail: 1, availableAO: true, availablePT: true }
  let capturedWhere: unknown
  const payload = {
    find: async () => ({ docs: [coupon] }),
    count: async (options: { where: unknown }) => {
      capturedWhere = options.where
      return { totalDocs: 0 }
    },
  }
  const result = await resolveCoupon(payload as never, {
    code: 'once', market: 'PT', pricingMarket: 'PT', subtotal: 100, customerEmail: 'shopper@example.com', now: NOW,
  })
  assert.equal(result.valid, true)
  assert.deepEqual(capturedWhere, {
    and: [
      { couponCode: { equals: 'ONCE' } },
      { customerEmail: { equals: 'shopper@example.com' } },
      { status: { not_equals: 'cancelled' } },
    ],
  })
})

// Compensating action for the claim above: cancelling/expiring an order
// that claimed a coupon gives the redemption back so a genuinely limited
// code isn't exhausted by orders that never went through.
test('releaseCouponRedemption decrements usage by one and never goes below zero', async () => {
  const coupon = { id: 31, code: 'SAVE10', usageCount: 3 }
  const updates: number[] = []
  const payload = {
    find: async () => ({ docs: [coupon] }),
    update: async (options: { data: { usageCount: number } }) => {
      updates.push(options.data.usageCount)
      coupon.usageCount = options.data.usageCount
      return coupon
    },
  }
  const req = { payload } as never
  await releaseCouponRedemption(req, 'save10')
  assert.deepEqual(updates, [2])

  // Already at zero (e.g. a duplicate release racing the guard at the call
  // site) -- no-ops instead of going negative.
  coupon.usageCount = 0
  await releaseCouponRedemption(req, 'save10')
  assert.deepEqual(updates, [2])
})

test('releaseCouponRedemption is a no-op for an unknown or blank code', async () => {
  let updateCalled = false
  const payload = {
    find: async () => ({ docs: [] }),
    update: async () => {
      updateCalled = true
      return {}
    },
  }
  const req = { payload } as never
  await releaseCouponRedemption(req, 'GHOST')
  await releaseCouponRedemption(req, '  ')
  assert.equal(updateCalled, false)
})

test('Portugal shipping is authoritative, method-specific, and free from EUR 75 after discounts', () => {
  assert.equal(authoritativeShippingCost('PT', 'ctt', 74.99), 4.9)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 74.99), 6.9)
  assert.equal(authoritativeShippingCost('PT', 'ctt', 75), 0)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 100), 0)
  assert.equal(authoritativeShippingCost('AO', 'courier_ao', 79_999, undefined, 'Ingombota'), 2500)
  assert.equal(authoritativeShippingCost('AO', 'courier_ao', 79_999, undefined, 'Mussulo'), 8000)
  assert.equal(authoritativeShippingCost('AO', 'courier_ao', 80_000, undefined, 'Mussulo'), 0)
  const custom = { portugalStandardShippingPrice: 5.5, portugalTrackedShippingPrice: 8, portugalFreeShippingThreshold: 90 }
  assert.equal(authoritativeShippingCost('PT', 'ctt', 75, custom), 5.5)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 89.99, custom), 8)
  assert.equal(authoritativeShippingCost('PT', 'ctt', 90, custom), 0)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 50, undefined, undefined, 2500, '1000-001'), 9.9)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 50, undefined, undefined, 2500, '9000-001'), 14.9)
  assert.equal(authoritativeShippingCost('PT', 'courier_pt', 75, undefined, undefined, 2500, '9500-001'), 0)
})

test('Portuguese postal codes classify mainland, Madeira and the Azores', () => {
  assert.equal(portugalDeliveryRegion('1000-001'), 'mainland')
  assert.equal(portugalDeliveryRegion('9000-001'), 'madeira')
  assert.equal(portugalDeliveryRegion('9499-999'), 'madeira')
  assert.equal(portugalDeliveryRegion('9500-001'), 'azores')
  assert.equal(portugalDeliveryRegion('9999-999'), 'azores')
  assert.equal(portugalDeliveryRegion('invalid'), null)
})

test('order lookup exposes manual CTT tracking only after email verification', async () => {
  const order = {
    orderNumber: 'PT-123456', customerEmail: 'buyer@example.com', status: 'shipped', paymentStatus: 'paid',
    total: 86.9, currency: 'EUR', deliveryRegion: 'madeira', cttTrackingCode: 'RD123456789PT', updatedAt: NOW.toISOString(),
  }
  const makeReq = (email: string) => ({
    headers: new Headers({ 'x-forwarded-for': `198.51.100.${email === order.customerEmail ? '1' : '2'}` }),
    json: async () => ({ orderNumber: order.orderNumber, email }),
    payload: {
      find: async () => ({ docs: [order] }),
      logger: { info: () => {}, warn: () => {} },
    },
  })
  const rejected = await orderLookupEndpoint.handler(makeReq('wrong@example.com') as never)
  assert.deepEqual(await rejected.json(), { order: null })
  const accepted = await orderLookupEndpoint.handler(makeReq(order.customerEmail) as never)
  const body = await accepted.json() as { order: typeof order }
  assert.equal(body.order.cttTrackingCode, 'RD123456789PT')
  assert.equal(body.order.deliveryRegion, 'madeira')
})

test('authoritative order ignores submitted prices and applies sale, coupon and shipping', async () => {
  const coupon = { id: 9, code: 'SAVE10', active: true, type: 'percent', percentOff: 10, usageCount: 0 }
  let shippingWeightGrams = 500
  const payload = {
    db: {},
    findByID: async () => ({
      id: 4, active: true, availableAO: true, availablePT: true,
      name: 'Vestido', nameEN: 'Dress', namePT: 'Vestido', priceAOKz: 50_000, pricePTEur: 50,
      shippingWeightGrams,
      salePTEur: 40, variants: [{ color: 3, size: 'M', stockAO: 2, stockPT: 2 }],
    }),
    find: async (options: { collection: string }) => options.collection === 'colors'
      ? { docs: [{ id: 3, namePT: 'Preto', nameEN: 'Black' }] }
      : { docs: [coupon] },
    count: async () => ({ totalDocs: 0 }),
    update: async () => coupon,
    findGlobal: async () => ({ portugalPaymentsEnabled: true }),
  }
  // Product 4 is on sale (salePTEur: 40) -- no percent coupon should apply
  // (2026-08-04 rule), so this cart legitimately has no eligible subtotal.
  // The happy path here submits WITHOUT a coupon (verified separately,
  // below, and in dedicated resolveCoupon-level tests) so this stays a
  // clean check of sale-price + shipping + market handling.
  const data = await applyAuthoritativeOrderValues({
    data: {
      market: 'PT', lang: 'en', paymentMethod: 'mbway', deliveryMethod: 'ctt', customerEmail: ' USER@EXAMPLE.COM ', postalCode: '9500-001',
      items: [{ product: 4, size: 'M', color: '3', qty: 2, unitPrice: 1 }],
      subtotal: 2, total: 2,
    },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)
  assert.equal(data?.items?.[0]?.unitPrice, 40)
  assert.equal(data?.subtotal, 80)
  assert.equal(data?.discountAmount, 0)
  // Without the (now-rejected) coupon, merchandise-after-discount is the
  // full 80 -- above Portugal's EUR 75 free-shipping threshold, so
  // shipping is correctly free here (it wasn't, before this change, only
  // because the coupon had knocked the discounted total below 75).
  assert.equal(data?.shippingCost, 0)
  assert.equal(data?.total, 80)
  assert.equal(data?.deliveryRegion, 'azores')
  assert.equal(data?.country, 'Portugal')
  assert.equal(data?.customerEmail, 'user@example.com')

  // A percent coupon on this same all-on-sale cart is correctly rejected --
  // there's no non-sale line left for it to discount.
  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: {
      market: 'PT', lang: 'en', paymentMethod: 'mbway', deliveryMethod: 'ctt', customerEmail: 'user@example.com', postalCode: '9500-001',
      couponCode: 'SAVE10', items: [{ product: 4, size: 'M', color: '3', qty: 2, unitPrice: 1 }],
    },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /already on sale/)

  payload.findGlobal = async () => ({ portugalPaymentsEnabled: false })
  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: { market: 'PT', paymentMethod: 'mbway', deliveryMethod: 'ctt' },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /temporarily unavailable/)
  payload.findGlobal = async () => ({ portugalPaymentsEnabled: true })

  shippingWeightGrams = 1200
  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: {
      market: 'PT', lang: 'en', paymentMethod: 'mbway', deliveryMethod: 'ctt', customerEmail: 'user@example.com', postalCode: '1000-001',
      items: [{ product: 4, size: 'M', color: '3', qty: 2 }],
    },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /tracked delivery/)
})

test('authoritative orders price fixed kits and snapshot exact component variants', async () => {
  const products = new Map<number, Record<string, unknown>>([
    [90, {
      id: 90, active: true, availableAO: true, availablePT: true,
      name: 'Kit Hidratação', priceAOKz: 12_000, pricePTEur: 24,
      shippingWeightGrams: 900, productType: 'bundle', variants: [],
      bundleComponents: [{ product: 4, variantId: 'bottle-750', qty: 2 }],
    }],
    [4, {
      id: 4, active: true, availableAO: true, availablePT: true,
      name: 'Garrafa', priceAOKz: 5_000, pricePTEur: 10,
      productType: 'standard',
      variants: [{ id: 'bottle-750', size: '750 ml', optionValueEN: '750 ml', stockAO: 3, stockPT: 3 }],
    }],
  ])
  const payload = {
    db: {},
    findByID: async ({ id }: { id: number }) => products.get(Number(id)),
    find: async () => ({ docs: [] }),
    findGlobal: async () => ({}),
  }
  const input = {
    market: 'AO', lang: 'pt', paymentMethod: 'multicaixa_express', deliveryMethod: 'courier_ao',
    city: 'Maianga', customerEmail: 'cliente@example.com',
    items: [{ product: 90, variantId: 'bundle', qty: 1 }],
  }
  const data = await applyAuthoritativeOrderValues({
    data: input,
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)

  assert.equal(data?.items?.[0]?.productType, 'bundle')
  assert.equal(data?.items?.[0]?.unitPrice, 12_000)
  assert.equal(data?.items?.[0]?.size, undefined)
  assert.deepEqual(data?.items?.[0]?.inventoryComponents, [{ product: 4, variantId: 'bottle-750', qty: 2 }])

  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: { ...input, items: [{ product: 90, variantId: 'bundle', qty: 2 }] },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /no longer in stock/)
})

test('Portugal manual-WhatsApp checkout is only accepted while payments are deferred', async () => {
  const payload = {
    db: {},
    findByID: async () => ({
      id: 4, active: true, availableAO: true, availablePT: true,
      name: 'Vestido', nameEN: 'Dress', namePT: 'Vestido', priceAOKz: 50_000, pricePTEur: 50,
      shippingWeightGrams: 500,
      variants: [{ color: 3, size: 'M', stockAO: 2, stockPT: 2 }],
    }),
    find: async (options: { collection: string }) => options.collection === 'colors'
      ? { docs: [{ id: 3, namePT: 'Preto', nameEN: 'Black' }] }
      : { docs: [] },
    count: async () => ({ totalDocs: 0 }),
    update: async () => ({}),
    findGlobal: async () => ({ portugalPaymentsEnabled: false }),
  }
  const orderInput = {
    market: 'PT', lang: 'en', paymentMethod: 'manual_whatsapp', deliveryMethod: 'ctt',
    customerEmail: 'user@example.com', postalCode: '1000-001',
    items: [{ product: 4, size: 'M', color: '3', qty: 1 }],
  }

  // Deferred (portugalPaymentsEnabled: false): manual_whatsapp is accepted,
  // a real gateway is not.
  const data = await applyAuthoritativeOrderValues({
    data: orderInput,
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)
  assert.equal(data?.deliveryRegion, 'mainland')
  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: { ...orderInput, paymentMethod: 'mbway' },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /temporarily unavailable/)

  // Live (portugalPaymentsEnabled: true): the reverse -- a real gateway is
  // accepted, manual_whatsapp is not, so every PT order goes through a real
  // payment method once the market is actually live.
  payload.findGlobal = async () => ({ portugalPaymentsEnabled: true })
  const liveData = await applyAuthoritativeOrderValues({
    data: { ...orderInput, paymentMethod: 'mbway' },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)
  assert.equal(liveData?.deliveryRegion, 'mainland')
  await assert.rejects(() => applyAuthoritativeOrderValues({
    data: orderInput,
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never), /Portugal checkout is live/)
})

test('a free-shipping coupon zeroes shippingCost without discounting merchandise', async () => {
  const coupon = { id: 12, code: 'FREESHIP', active: true, type: 'free_shipping', usageCount: 0 }
  const payload = {
    db: {},
    findByID: async () => ({
      id: 4, active: true, availableAO: true, availablePT: true,
      name: 'Vestido', nameEN: 'Dress', namePT: 'Vestido', priceAOKz: 50_000, pricePTEur: 50,
      shippingWeightGrams: 500,
      variants: [{ color: 3, size: 'M', stockAO: 2, stockPT: 2 }],
    }),
    find: async (options: { collection: string }) => options.collection === 'colors'
      ? { docs: [{ id: 3, namePT: 'Preto', nameEN: 'Black' }] }
      : { docs: [coupon] },
    count: async () => ({ totalDocs: 0 }),
    update: async () => coupon,
    findGlobal: async () => ({ portugalPaymentsEnabled: true }),
  }
  const data = await applyAuthoritativeOrderValues({
    data: {
      market: 'PT', lang: 'en', paymentMethod: 'mbway', deliveryMethod: 'ctt', customerEmail: 'user@example.com', postalCode: '1000-001',
      couponCode: 'FREESHIP', items: [{ product: 4, size: 'M', color: '3', qty: 1 }],
      subtotal: 1, total: 1,
    },
    operation: 'create',
    req: { payload, url: 'http://localhost/api/orders' },
  } as never)
  // Below the EUR 75 free-shipping threshold, so this proves the zero came
  // from the coupon, not from the pre-existing threshold.
  assert.equal(data?.subtotal, 50)
  assert.equal(data?.discountAmount, 0)
  assert.equal(data?.shippingCost, 0)
  assert.equal(data?.total, 50)
  assert.equal(data?.discountLabel, 'FREESHIP (free shipping)')
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

test('product kits reserve component variants and multiply component quantities by kit quantity', () => {
  const deltas = inventoryDeltasForOrder({
    market: 'AO',
    items: [{
      product: 90,
      qty: 2,
      inventoryComponents: [
        { product: 4, variantId: 'bottle-black', qty: 1 },
        { product: 7, variantId: 'towel-white', qty: 2 },
      ],
    }],
  })
  assert.deepEqual(deltas.map((delta) => ({ productId: delta.productId, variantId: delta.variantId, qty: delta.qty })), [
    { productId: 4, variantId: 'bottle-black', qty: 2 },
    { productId: 7, variantId: 'towel-white', qty: 4 },
  ])
})

// Shipping zero-rated, discount taken before VAT (2026-08-04, user rules:
// "VAT & discount should never affect shipping cost... shipping should
// never be included in the VAT calculation" and "if a coupon is applied
// then VAT is calculated from the final price"). Merchandise-after-discount
// here is 80 - 8 = 72; 72 / 1.23 = 58.5365... -> net 58.54, tax 13.46.
// Shipping (4) carries zero tax and lands entirely in netTotal alongside
// the merchandise net, so netTotal + taxTotal still reconciles exactly to
// the 76 total actually paid.
test('invoice calculation reconciles products, shipping, coupon and included VAT -- shipping zero-rated', () => {
  const result = calculateIncludedVatInvoice({
    items: [{ productName: 'Dress', size: 'M', color: 'Black', qty: 2, unitPrice: 40 }],
    shippingCost: 4,
    discountAmount: 8,
    discountLabel: 'SAVE10 (10% off)',
    total: 76,
  }, 23, 'en')
  assert.equal(result.total, 76)
  assert.equal(result.netTotal, 62.54)
  assert.equal(result.taxTotal, 13.46)
  assert.equal(result.lines.find((line) => line.description.startsWith('SAVE10'))?.grossAmount, -8)
  const shippingLine = result.lines.find((line) => line.description === 'Shipping')
  assert.equal(shippingLine?.taxAmount, 0)
  assert.equal(shippingLine?.netAmount, 4)
  assert.equal(result.lines.some((line) => line.description === 'Order adjustment'), false)
})

// Back-calculation formula confirmed with Jay-P (2026-08-04): "Price before
// VAT = VAT-inclusive price / (1 + VAT rate); VAT amount = VAT-inclusive
// price - price before VAT" -- NOT rate * gross (which double-counts, since
// the price already includes VAT). A pure product-only sanity check with no
// shipping/discount noise: EUR 33 gross at 23% -> net 26.83, VAT 6.17 (not
// 33 * 0.23 = 7.59).
test('invoice VAT uses the back-calculation formula, not rate times the VAT-inclusive price', () => {
  const result = calculateIncludedVatInvoice({
    items: [{ productName: 'Aurora Set', size: 'M', color: undefined, qty: 1, unitPrice: 33 }],
    shippingCost: 0,
    discountAmount: 0,
    discountLabel: null,
    total: 33,
  }, 23, 'en')
  assert.equal(result.netTotal, 26.83)
  assert.equal(result.taxTotal, 6.17)
})

test('invoice summary explicitly separates product VAT from VAT-exempt shipping', () => {
  const source = readFileSync(new URL('../src/lib/internalInvoice.ts', import.meta.url), 'utf8')
  for (const label of [
    'Product subtotal (excl. VAT)',
    'Product total (incl. VAT)',
    'Shipping (VAT exempt)',
    'Subtotal de produtos (sem IVA)',
    'Total de produtos (com IVA)',
    'Portes (isentos de IVA)',
  ]) assert.match(source, new RegExp(label.replace(/[().]/g, '\\$&')))
  assert.match(source, /calculation\.netTotal - input\.order\.shippingCost/)
  assert.match(source, /calculation\.total - input\.order\.shippingCost/)
})

test('regional VAT: Angola is flat, Portugal picks the rate for the order\'s delivery region', () => {
  const global = {
    vatRateAO: 14,
    vatRatePortugalMainland: 23,
    vatRatePortugalMadeira: 22,
    vatRatePortugalAzores: 16,
  }
  assert.equal(resolveVatRate(global, 'AO', null), 14)
  assert.equal(resolveVatRate(global, 'AO', 'azores'), 14) // deliveryRegion is meaningless for AO -- ignored
  assert.equal(resolveVatRate(global, 'PT', 'mainland'), 23)
  assert.equal(resolveVatRate(global, 'PT', 'madeira'), 22)
  assert.equal(resolveVatRate(global, 'PT', 'azores'), 16)
  // A PT order with no recorded region falls back to mainland's rate
  // rather than 0% -- silently charging no VAT is a worse failure mode.
  assert.equal(resolveVatRate(global, 'PT', null), 23)
  assert.equal(resolveVatRate(global, 'PT', undefined), 23)
})
