import type { Endpoint } from 'payload'

import { couponBannerItem, messageBannerItem, type BannerCoupon, type BannerItem, type BannerMarket } from '../lib/announcementBanner'

// Public, read-only feed for the storefront announcement bar. Returns nothing
// but display text, so the (admin-only) coupons and banner settings stay
// private. Short cache: edits show up within about a minute.
export const storefrontBannerEndpoint: Endpoint = {
  path: '/storefront-banner',
  method: 'get',
  handler: async (req) => {
    const market: BannerMarket = new URL(req.url ?? '', 'http://localhost').searchParams.get('market') === 'PT' ? 'PT' : 'AO'
    const { payload } = req
    const items: BannerItem[] = []
    try {
      const banner = await payload.findGlobal({ slug: 'announcement-banner', depth: 0, overrideAccess: true })
      const message = market === 'AO'
        ? messageBannerItem({ enabled: banner.angolaMessageEnabled, textPt: banner.angolaMessageTextPt, textEn: banner.angolaMessageTextEn })
        : messageBannerItem({ enabled: banner.portugalMessageEnabled, textPt: banner.portugalMessageTextPt, textEn: banner.portugalMessageTextEn })
      if (message) items.push(message)

      const coupons = await payload.find({
        collection: 'coupons',
        where: { showOnBanner: { equals: true } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const coupon = coupons.docs[0] ? couponBannerItem(coupons.docs[0] as unknown as BannerCoupon, market) : null
      if (coupon) items.push(coupon)
    } catch (err) {
      // The bar is decoration: never let it break a page. Serve it empty, uncached.
      payload.logger.error({ event: 'storefront_banner_failed', err })
      return Response.json({ items: [] }, { headers: { 'Cache-Control': 'no-store' } })
    }
    return Response.json({ items }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } })
  },
}
