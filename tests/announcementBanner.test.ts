import assert from 'node:assert/strict'
import test from 'node:test'

import { couponBannerItem, messageBannerItem, type BannerCoupon } from '../src/lib/announcementBanner.ts'
import { Coupons } from '../src/collections/Coupons.ts'
import { storefrontBannerEndpoint } from '../src/endpoints/storefrontBanner.ts'

const NOW = new Date('2026-10-08T12:00:00.000Z')
const coupon = (over: Partial<BannerCoupon> = {}): BannerCoupon => ({ code: 'BEMVINDA10', type: 'percent', percentOff: 10, active: true, ...over })

test('the message is whatever the admin writes, and only while switched on', () => {
  const on = { enabled: true, textPt: '  Entrega grátis em compras acima de 80 mil Kz  ', textEn: 'Free delivery over 80k Kz' }
  assert.deepEqual(messageBannerItem(on), { id: 'message', pt: 'Entrega grátis em compras acima de 80 mil Kz', en: 'Free delivery over 80k Kz' })
  assert.equal(messageBannerItem({ ...on, enabled: false }), null)
  assert.equal(messageBannerItem({ textPt: 'x' }), null) // off by default
  assert.equal(messageBannerItem({ enabled: true, textPt: '  ', textEn: null }), null) // nothing to show
})

test('a message in one language is used for both', () => {
  assert.deepEqual(messageBannerItem({ enabled: true, textEn: 'Closed on Sunday' }), { id: 'message', pt: 'Closed on Sunday', en: 'Closed on Sunday' })
  assert.deepEqual(messageBannerItem({ enabled: true, textPt: 'Fechado ao domingo' }), { id: 'message', pt: 'Fechado ao domingo', en: 'Fechado ao domingo' })
})

test('a promoted code reads naturally for each coupon type', () => {
  assert.deepEqual(couponBannerItem(coupon(), 'AO', NOW), { id: 'coupon', code: 'BEMVINDA10', pt: 'Use o código BEMVINDA10 e ganhe 10% de desconto', en: 'Use code BEMVINDA10 for 10% off' })
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

test('the public feed returns the message, the live code and no secrets', async () => {
  const req = {
    url: 'http://x/api/storefront-banner?market=AO',
    payload: {
      findGlobal: async () => ({ angolaMessageEnabled: true, angolaMessageTextPt: 'Olá' }),
      find: async () => ({ docs: [{ code: 'BEMVINDA10', type: 'percent', percentOff: 10, active: true, usageCount: 3, description: 'internal note' }] }),
      logger: { error: () => undefined },
    },
  }
  const res = await storefrontBannerEndpoint.handler(req as never)
  const body = await res.json()
  assert.deepEqual(body.items.map((i: { id: string }) => i.id), ['message', 'coupon'])
  assert.doesNotMatch(JSON.stringify(body), /internal note|usageCount/)
  assert.match(res.headers.get('Cache-Control') ?? '', /max-age=60/)

  const broken = await storefrontBannerEndpoint.handler({ ...req, payload: { ...req.payload, findGlobal: async () => { throw new Error('db down') } } } as never)
  assert.deepEqual(await broken.json(), { items: [] })
  assert.equal(broken.headers.get('Cache-Control'), 'no-store')
})
