import { APIError, type Payload, type PayloadRequest } from 'payload'
import { sql } from 'drizzle-orm'

type Market = 'AO' | 'PT'

type CouponDoc = {
  id: string | number
  code: string
  active?: boolean | null
  type: 'percent' | 'fixed' | 'free_shipping'
  percentOff?: number | null
  fixedOffAOKz?: number | null
  fixedOffPTEur?: number | null
  minOrderValueAOKz?: number | null
  minOrderValuePTEur?: number | null
  startDate?: string | null
  endDate?: string | null
  usageLimit?: number | null
  usageCount?: number | null
  maxRedemptionsPerEmail?: number | null
  availableAO?: boolean | null
  availablePT?: boolean | null
}

export type CouponResolution =
  // freeShipping (2026-07-31, "let admins create a code that gives the
  // customer free delivery"): a coupon is either a merchandise discount
  // (percent/fixed, discountAmount > 0, freeShipping false) or a shipping
  // waiver (free_shipping, discountAmount always 0, freeShipping true) --
  // never both, same mutually-exclusive `type` field as percent vs fixed.
  // Callers (authoritativeOrder.ts, Checkout.tsx) zero the shipping cost
  // themselves when freeShipping is true; this function never touches
  // shipping math directly, same separation as today.
  | { valid: true; code: string; discountAmount: number; freeShipping: boolean; label: string }
  | { valid: false; reason: string }

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

/**
 * The single place a coupon code turns into an actual discount amount --
 * used by BOTH the public /coupons/validate endpoint (advisory, powers the
 * checkout "Apply" button before payment) and authoritativeOrder.ts (the
 * real enforcement, at order-creation time). The advisory call can go
 * stale between "Apply" and submit (another shopper exhausts the usage
 * limit, the window lapses) -- that's fine, since order creation always
 * re-resolves for real and rejects the order if it's no longer valid.
 *
 * `customerEmail`, when omitted (the advisory endpoint may be called before
 * the shopper has filled in the checkout form), skips the per-email limit
 * check -- authoritativeOrder.ts always has one, so that check is never
 * skippable for real.
 */
export async function resolveCoupon(
  payload: Payload,
  params: {
    code: string
    // The real storefront/customer market -- Angola or Portugal, always
    // accurate regardless of which currency the order happens to settle
    // in. Kept deliberately separate from `pricingMarket` below: an Angola
    // order paid via Stripe/PayPal settles in EUR (usesEurSettlement), but
    // it's still an ANGOLA order for the purposes of "is this coupon
    // available in this market" -- conflating the two would let an
    // Angola-only coupon silently apply (or an Angola-restricted one
    // silently reject) based on payment method rather than the actual
    // storefront the customer is on.
    market: Market
    // The market whose currency this order actually settles in -- used
    // only for min-order-value and fixed-amount lookups, same meaning as
    // Checkout.tsx/authoritativeOrder.ts's usesEurSettlement.
    pricingMarket: Market
    subtotal: number
    customerEmail?: string
    now?: Date
  },
  req?: Partial<PayloadRequest>,
): Promise<CouponResolution> {
  const code = params.code.trim().toUpperCase()
  if (!code) return { valid: false, reason: 'Enter a code.' }

  const matches = await payload.find({
    collection: 'coupons',
    where: { code: { equals: code } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  const coupon = matches.docs[0] as unknown as CouponDoc | undefined
  if (!coupon) return { valid: false, reason: 'This code was not found.' }
  if (coupon.active === false) return { valid: false, reason: 'This code is no longer active.' }

  // Market scoping (2026-07-27): both flags default true in the schema, but
  // an existing coupon predating this field has `undefined` rather than
  // `true` in the doc until it's next saved -- `?? true` treats that the
  // same as an explicit true, so nothing that worked before this change
  // stops working.
  const availableInMarket = params.market === 'AO' ? (coupon.availableAO ?? true) : (coupon.availablePT ?? true)
  if (!availableInMarket) return { valid: false, reason: 'This code is not available in this market.' }

  const now = params.now ?? new Date()
  if (coupon.startDate && now < new Date(coupon.startDate)) return { valid: false, reason: 'This code is not active yet.' }
  if (coupon.endDate && now > new Date(coupon.endDate)) return { valid: false, reason: 'This code has expired.' }

  const minOrderValue = params.pricingMarket === 'AO' ? coupon.minOrderValueAOKz : coupon.minOrderValuePTEur
  if (minOrderValue != null && params.subtotal < minOrderValue) {
    return { valid: false, reason: `This code requires a minimum order of ${minOrderValue}.` }
  }

  if (coupon.usageLimit != null && (coupon.usageCount ?? 0) >= coupon.usageLimit) {
    return { valid: false, reason: 'This code has reached its usage limit.' }
  }

  if (coupon.maxRedemptionsPerEmail != null && params.customerEmail) {
    const priorRedemptions = await payload.count({
      collection: 'orders',
      where: {
        and: [
          { couponCode: { equals: code } },
          { customerEmail: { equals: params.customerEmail.trim().toLowerCase() } },
        ],
      },
      overrideAccess: true,
      req,
    })
    if (priorRedemptions.totalDocs >= coupon.maxRedemptionsPerEmail) {
      return { valid: false, reason: 'You have already used this code the maximum number of times.' }
    }
  }

  if (coupon.type === 'free_shipping') {
    return { valid: true, code, discountAmount: 0, freeShipping: true, label: `${code} (free shipping)` }
  }

  const rawDiscount =
    coupon.type === 'percent'
      ? (params.subtotal * (coupon.percentOff ?? 0)) / 100
      : (params.pricingMarket === 'AO' ? coupon.fixedOffAOKz : coupon.fixedOffPTEur) ?? 0
  const discountAmount = roundMoney(Math.max(0, Math.min(rawDiscount, params.subtotal)))
  if (discountAmount <= 0) return { valid: false, reason: 'This code is not available for this order.' }

  const label = coupon.type === 'percent' ? `${code} (${coupon.percentOff}% off)` : `${code} (discount)`
  return { valid: true, code, discountAmount, freeShipping: false, label }
}

async function lockCouponRow(req: PayloadRequest, code: string): Promise<void> {
  if (!String(process.env.DATABASE_URL ?? '').startsWith('postgres')) return
  const transactionID = await req.transactionID
  if (!transactionID) throw new APIError('Coupon redemption requires a database transaction.', 503, null, true)
  const session = req.payload.db.sessions?.[String(transactionID)] as
    | { db?: { execute?: (query: unknown) => Promise<unknown> } }
    | undefined
  if (!session?.db?.execute) throw new APIError('Coupon transaction session is unavailable.', 503, null, true)
  await session.db.execute(sql`SELECT id FROM coupons WHERE code = ${code} FOR UPDATE`)
}

/** Atomically validates and claims one coupon redemption inside the order
 * creation transaction. The row lock serializes concurrent uses of the same
 * code; passing `req` to every Payload operation keeps the usage update and
 * the eventual order insert in one commit/rollback boundary. */
export async function claimCouponRedemption(
  req: PayloadRequest,
  params: Parameters<typeof resolveCoupon>[1],
): Promise<CouponResolution> {
  const code = params.code.trim().toUpperCase()
  await lockCouponRow(req, code)
  const result = await resolveCoupon(req.payload, { ...params, code }, req)
  if (!result.valid) return result

  const matches = await req.payload.find({
    collection: 'coupons',
    where: { code: { equals: code } },
    limit: 1,
    overrideAccess: true,
    req,
  })
  const coupon = matches.docs[0]
  if (!coupon) return { valid: false, reason: 'This code was not found.' }
  await req.payload.update({
    collection: 'coupons',
    id: coupon.id,
    overrideAccess: true,
    req,
    data: { usageCount: (Number(coupon.usageCount) || 0) + 1 },
  })
  return result
}
