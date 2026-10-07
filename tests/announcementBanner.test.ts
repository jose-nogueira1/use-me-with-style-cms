import assert from 'node:assert/strict'
import test from 'node:test'

import { couponBannerItem, deliveryBannerItem, type BannerCoupon } from '../src/lib/announcementBanner.ts'
import { Coupons } from '../src/collections/Coupons.ts'
import { storefrontBannerEndpoint } from '../src/endpoints/storefrontBanner.ts'

const NOW = new Date('2026-10-08T12:00:00.000Z')
const coupon = (over: Partial<BannerCoupon> = {}): BannerCoupon => ({ code: 'BEMVINDA10', type: 'percent', percentOff: 10, active: true, ...over })

test('free-delivery text is built from the threshold, in both languages and currencies', () => {
  assert.deepEqual(deliveryBannerItem('AO', 80_000, {}), { id: 'delivery', pt: 'Entrega grátis acima de 80.000 Kz', en: 'Free delivery over 80,000 Kz' })
  const pt = deliveryBannerItem('PT', 75, {})!
  assert.match(pt.pt, /^Entrega grátis acima de 75\s€$/)
  assert.equal(pt.en, 'Free delivery over €75')
  assert.equal(deliveryBannerItem('PT', 45.5, {})!.en, 'Free delivery over €45.50')
  assert.deepEqual(deliveryBannerItem('AO', 0, {}), { id: 'delivery', pt: 'Entrega grátis', en: 'Free delivery' })
})

test('admin text overrides each language independently; the switch removes the message', () => {
  const item = deliveryBannerItem('AO', 80_000, { textPt: '  Entrega grátis em compras acima de 80 mil Kz  ' })!
  assert.equal(item.pt, 'Entrega grátis em compras acima de 80 mil Kz')
  assert.equal(item.en, 'Free delivery over 80,000 Kz')
  assert.equal(deliveryBannerItem('AO', 80_000, { enabled: false }), null)
})

test('a promoted code reads naturally for each coupon type', () => {
  assert.deepEqual(couponBannerItem(coupon(), 'AO', NOW), { id: 'coupon', pt: 'Use o código BEMVINDA10 e ganhe 10% de desconto', en: 'Use code BEMVINDA10 for 10% off' })
  const fixed = couponBannerItem(coupon({ type: 'fixed', percentOff: null, fixedOffAOKz: 1500, fixedOffPTEur: 5 }), 'AO', NOW)!
  assert.equal(fixed.pt, 'Use o código BEMVINDA10 e ganhe 1.500 Kz de desconto')
  assert.equal(fixed.en, 'Use code BEMVINDA10 for 1,500 Kz off')
  assert.equal(couponBannerItem(coupon({ type: 'fixed', percentOff: null, fixedOffAOKz: 1500, fixedOffPTEur: 5 }), 'PT', NOW)!.en, 'Use code BEMVINDA10 for €5 off')
  assert.equal(couponBannerItem(coupon({ type: 'free_shipping', percentOff: null, code: 'FRETE' }), 'AO', NOW)!.en, 'Use code FRETE for free delivery')
  assert.equal(couponBannerItem(coupon({ bannerTextEn: 'Spring sale: code SS26' }), 'AO', NOW)!.en, 'Spring sale: code SS26')
})

test('a code the checkout would refuse is never advertised', () => {
  assert.equal(couponBannerItem(coupon({ active: false }), 'AO', NOW), null)
  assert.equal(couponBannerItem(coupon({ availableAO: false }), 'AO', NOW), null)
  assert.ok(couponBannerItem(coupon({ availableAO: false }), 'PT', NOW))
  assert.equal(couponBannerItem(coupon({ startDate: '2026-10-09T00:00:00.000Z' }), 'AO', NOW), null)
  assert.equal(couponBannerItem(coupon({ endDate: '2026-10-07T00:00:00.000Z' }), 'AO', NOW), null)
  assert.equal(couponBannerItem(coupon({ usageLimit: 5, usageCount: 5 }), 'AO', NOW), null)
  assert.ok(couponBannerItem(coupon({ usageLimit: 5, usageCount: 4 }), 'AO', NOW))
  assert.equal(couponBannerItem(coupon({ type: 'fixed', percentOff: null, fixedOffAOKz: null }), 'AO', NOW), null) // no amount in this market
})

test('turning "show on the announcement bar" on turns it off on every other coupon', async () => {
  const hook = Coupons.hooks!.beforeChange![0]
  const updates: Array<{ id: unknown; data: unknown }> = []
  const queries: unknown[] = []
  const req = {
    payload: {
      find: async (args: unknown) => { queries.push(args); return { docs: [{ id: 7 }, { id: 9 }] } },
      update: async (args: { id: unknown; data: unknown }) => { updates.push({ id: args.id, data: args.data }) },
    },
  }
  await hook({ data: { showOnBanner: true }, originalDoc: { id: 3 }, req, operation: 'update' } as never)
  assert.deepEqual(updates, [{ id: 7, data: { showOnBanner: false } }, { id: 9, data: { showOnBanner: false } }])
  assert.match(JSON.stringify(queries[0]), /"not_equals":3/) // never unflags itself

  updates.length = 0
  await hook({ data: { showOnBanner: false }, originalDoc: { id: 3 }, req, operation: 'update' } as never)
  await hook({ data: { code: 'X' }, originalDoc: { id: 3 }, req, operation: 'update' } as never)
  assert.deepEqual(updates, [])
})

test('the public feed returns the delivery message, the live code and no secrets', async () => {
  const req = {
    url: 'http://x/api/storefront-banner?market=AO',
    payload: {
      findGlobal: async ({ slug }: { slug: string }) =>
        slug === 'announcement-banner' ? { angolaDeliveryEnabled: true } : { angolaFreeShippingThreshold: 80_000 },
      find: async () => ({ docs: [{ code: 'BEMVINDA10', type: 'percent', percentOff: 10, active: true, usageCount: 3, description: 'internal note' }] }),
      logger: { error: () => undefined },
    },
  }
  const res = await storefrontBannerEndpoint.handler(req as never)
  const body = await res.json()
  assert.deepEqual(body.items.map((i: { id: string }) => i.id), ['delivery', 'coupon'])
  assert.doesNotMatch(JSON.stringify(body), /internal note|usageCount/)
  assert.match(res.headers.get('Cache-Control') ?? '', /max-age=60/)

  const broken = await storefrontBannerEndpoint.handler({ ...req, payload: { ...req.payload, findGlobal: async () => { throw new Error('db down') } } } as never)
  assert.deepEqual(await broken.json(), { items: [] })
  assert.equal(broken.headers.get('Cache-Control'), 'no-store')
})
