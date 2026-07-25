import type { Endpoint, PayloadRequest } from 'payload'
import { resolveCoupon } from '../lib/couponPricing'

// Advisory-only: powers the checkout "Apply" button so a shopper sees the
// discount before paying. The real enforcement is authoritativeOrder.ts,
// which re-resolves the SAME coupon via the same resolveCoupon() at
// order-creation time -- this endpoint's response is never trusted as the
// actual charged amount.
type ValidateCouponBody = {
  code?: string
  market?: 'AO' | 'PT'
  // Whether this order will settle in EUR regardless of market (Angola
  // orders paid via Stripe/PayPal) -- same usesEurSettlement concept as
  // authoritativeOrder.ts/Checkout.tsx.
  usesEurSettlement?: boolean
  subtotal?: number
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
  path: '/coupons/validate',
  method: 'post',
  handler: async (req) => {
    const body = await readJsonBody<ValidateCouponBody>(req)
    if (!body?.code || (body.market !== 'AO' && body.market !== 'PT')) {
      return Response.json({ valid: false, reason: 'Missing code or market.' }, { status: 400 })
    }

    const pricingMarket = body.usesEurSettlement ? 'PT' : body.market
    const result = await resolveCoupon(req.payload, {
      code: body.code,
      pricingMarket,
      subtotal: Number(body.subtotal) || 0,
      customerEmail: body.customerEmail,
    })
    return Response.json(result)
  },
}

export const couponsEndpoints: Endpoint[] = [validateCoupon]
