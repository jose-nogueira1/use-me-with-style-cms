import type { Endpoint, PayloadRequest } from 'payload'
import { resolveCoupon } from '../lib/couponPricing'

// Advisory-only: powers the checkout "Apply" button so a shopper sees the
// discount before paying. The real enforcement is authoritativeOrder.ts,
// which re-resolves the SAME coupon via the same resolveCoupon() at
// order-creation time -- this endpoint's response is never trusted as the
// actual charged amount.
//
// Registered as a COLLECTION-level endpoint on Coupons (see
// collections/Coupons.ts's `endpoints` field), not a root-level one.
// Payload's router treats the first path segment as a collection slug
// whenever one matches (handleEndpoints.js) -- a root-level endpoint at
// '/coupons/validate' collides with the 'coupons' collection slug itself,
// so the router always resolved it as "collection coupons, sub-route
// /validate" and looked in the (empty) collection endpoints array instead
// of root endpoints, 404ing every time regardless of server restarts. This
// bit us for real (2026-07-26) before being caught. Collection-level
// endpoints are relative to /api/<slug>, hence the bare '/validate' path.
type ValidateCouponBody = {
  code?: string
  market?: 'AO' | 'PT'
  // Whether this order will settle in EUR regardless of market (Angola
  // orders paid via Stripe/PayPal) -- same usesEurSettlement concept as
  // authoritativeOrder.ts/Checkout.tsx.
  usesEurSettlement?: boolean
  subtotal?: number
  // Sale-price exclusion (2026-08-04) -- the subtotal of only the cart
  // lines NOT currently at a sale price. Checkout.tsx computes this
  // client-side (same effectiveUnitPrice logic mirrored there) so the
  // "Apply" preview matches what authoritativeOrder.ts will actually
  // enforce at order-creation time.
  eligibleSubtotal?: number
  customerEmail?: string
}

async function readJsonBody<T>(req: PayloadRequest): Promise<T | null> {
  try {
    return (await req.json?.()) as T
  } catch {
    return null
  }
}

const validateCoupon: Endpoint = {
  path: '/validate',
  method: 'post',
  handler: async (req) => {
    const body = await readJsonBody<ValidateCouponBody>(req)
    if (!body?.code || (body.market !== 'AO' && body.market !== 'PT')) {
      return Response.json({ valid: false, reason: 'Missing code or market.' }, { status: 400 })
    }

    const pricingMarket = body.usesEurSettlement ? 'PT' : body.market
    const result = await resolveCoupon(req.payload, {
      code: body.code,
      market: body.market,
      pricingMarket,
      subtotal: Number(body.subtotal) || 0,
      eligibleSubtotal: body.eligibleSubtotal != null ? Number(body.eligibleSubtotal) || 0 : undefined,
      customerEmail: body.customerEmail,
    })
    return Response.json(result)
  },
}

export const couponsEndpoints: Endpoint[] = [validateCoupon]
