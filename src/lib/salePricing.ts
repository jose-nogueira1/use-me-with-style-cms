// Shared by Products.ts (admin field descriptions reference this same
// logic), authoritativeOrder.ts (the only place a sale price actually
// changes what's charged), and hand-mirrored on the platform side in
// productAdapters.ts for storefront display. Phase 1 of the discounts
// feature (2026-07-25 user request, "figure out discounts") -- see
// productAdapters.ts for why the platform keeps its own copy rather than
// importing this file directly (separate repos/deploys).
export type SalePricingFields = {
  saleAOKz?: number | null
  salePTEur?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
}

/** A product is "on sale" when at least one market's sale price is set and
 * `now` falls within any configured start/end window (an unset bound is
 * open-ended on that side). Both sale price fields are independent -- a
 * sale can be scoped to a single market. */
export function isProductOnSale(product: SalePricingFields, now: Date = new Date()): boolean {
  const hasSalePrice = (product.saleAOKz ?? null) !== null || (product.salePTEur ?? null) !== null
  if (!hasSalePrice) return false
  if (product.saleStartDate && now < new Date(product.saleStartDate)) return false
  if (product.saleEndDate && now > new Date(product.saleEndDate)) return false
  return true
}

/** Resolves the unit price actually charged for one pricing market ('AO' or
 * 'PT' -- NOT necessarily the order's own `market` field: Angola orders
 * settling via Stripe/PayPal price in EUR, i.e. as 'PT' here, same as
 * authoritativeOrder.ts's existing usesEurSettlement split). Falls back to
 * the regular price when not on sale, or when this specific market has no
 * sale price set even though the other one does. */
export function effectiveUnitPrice(
  product: SalePricingFields & { priceAOKz: number; pricePTEur: number },
  pricingMarket: 'AO' | 'PT',
  now: Date = new Date(),
): number {
  if (!isProductOnSale(product, now)) {
    return pricingMarket === 'AO' ? product.priceAOKz : product.pricePTEur
  }
  return pricingMarket === 'AO' ? (product.saleAOKz ?? product.priceAOKz) : (product.salePTEur ?? product.pricePTEur)
}
