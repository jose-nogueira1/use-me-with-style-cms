import type { CollectionAfterChangeHook, Payload } from 'payload'

type Market = 'AO' | 'PT'

type CouponDoc = {
  id: string | number
  code: string
  active?: boolean | null
  type: 'percent' | 'fixed'
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
}

export type CouponResolution =
  | { valid: true; code: string; discountAmount: number; label: string }
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
  params: { code: string; pricingMarket: Market; subtotal: number; customerEmail?: string; now?: Date },
): Promise<CouponResolution> {
  const code = params.code.trim().toUpperCase()
  if (!code) return { valid: false, reason: 'Enter a code.' }

  const matches = await payload.find({
    collection: 'coupons',
    where: { code: { equals: code } },
    limit: 1,
    overrideAccess: true,
  })
  const coupon = matches.docs[0] as unknown as CouponDoc | undefined
  if (!coupon) return { valid: false, reason: 'This code was not found.' }
  if (coupon.active === false) return { valid: false, reason: 'This code is no longer active.' }

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
    })
    if (priorRedemptions.totalDocs >= coupon.maxRedemptionsPerEmail) {
      return { valid: false, reason: 'You have already used this code the maximum number of times.' }
    }
  }

  const rawDiscount =
    coupon.type === 'percent'
      ? (params.subtotal * (coupon.percentOff ?? 0)) / 100
      : (params.pricingMarket === 'AO' ? coupon.fixedOffAOKz : coupon.fixedOffPTEur) ?? 0
  const discountAmount = roundMoney(Math.max(0, Math.min(rawDiscount, params.subtotal)))
  if (discountAmount <= 0) return { valid: false, reason: 'This code is not available for this order.' }

  const label = coupon.type === 'percent' ? `${code} (${coupon.percentOff}% off)` : `${code} (discount)`
  return { valid: true, code, discountAmount, label }
}

/** Bumps the coupon's usageCount once an order that used it is actually
 * created. Fire-and-forget-tolerant: a failure here shouldn't fail order
 * creation (the order and its discount are already committed) -- logged
 * instead, same defensive pattern as notifyOrderEvent.ts's own side
 * effects. Only runs on create, matching when inventory reservations are
 * first taken (manageInventoryReservation) -- not re-run on later status
 * updates to the same order. */
export const incrementCouponUsageAfterOrderCreate: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation !== 'create' || !doc.couponCode) return doc
  try {
    const matches = await req.payload.find({
      collection: 'coupons',
      where: { code: { equals: String(doc.couponCode).toUpperCase() } },
      limit: 1,
      overrideAccess: true,
    })
    const coupon = matches.docs[0]
    if (!coupon) return doc
    await req.payload.update({
      collection: 'coupons',
      id: coupon.id,
      overrideAccess: true,
      data: { usageCount: (Number(coupon.usageCount) || 0) + 1 },
    })
  } catch (err) {
    req.payload.logger.error({ err, couponCode: doc.couponCode }, '[coupons:usage-increment-failed]')
  }
  return doc
}
