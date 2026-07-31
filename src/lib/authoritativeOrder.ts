import { APIError, type CollectionBeforeValidateHook } from 'payload'
import { effectiveUnitPrice } from './salePricing'
import { claimCouponRedemption } from './couponPricing'
import { normalizePortugalShipping, portugalDeliveryRegion, portugalShippingCost, type PortugalShippingSettings } from './portugalShipping'
import { angolaShippingCost, canonicalLuandaMunicipality, type AngolaShippingSettings } from './angolaShipping'

type Market = 'AO' | 'PT'

type SubmittedOrderItem = {
  product?: string | number | { id?: string | number }
  size?: string
  color?: string
  qty?: number
}

type InventoryProduct = {
  id: string | number
  active?: boolean | null
  availableAO?: boolean | null
  availablePT?: boolean | null
  name: string
  nameEN?: string | null
  namePT?: string | null
  priceAOKz: number
  pricePTEur: number
  shippingWeightGrams?: number | null
  // Discounts phase 1 (2026-07-25): optional per-market sale price + window
  // -- see lib/salePricing.ts, the single place this is resolved into an
  // actual charged unit price.
  saleAOKz?: number | null
  salePTEur?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
  // Variant-level inventory (2026-07-25): stock per colour+size row. The
  // colour ref is a plain id at depth 0, a populated doc at depth >= 1.
  variants?: Array<{
    color?: string | number | { id?: string | number; name?: string | null } | null
    size: string
    stockAO: number
    stockPT: number
  }> | null
}

export function authoritativeShippingCost(
  market: Market,
  deliveryMethod: string,
  merchandiseTotalAfterDiscount: number,
  settings?: (PortugalShippingSettings & AngolaShippingSettings) | null,
  municipality?: string,
  totalWeightGrams = 0,
  postalCode?: string,
): number {
  if (market === 'AO') return angolaShippingCost(municipality ?? '', merchandiseTotalAfterDiscount, settings)
  return portugalShippingCost(deliveryMethod, merchandiseTotalAfterDiscount, settings, totalWeightGrams, portugalDeliveryRegion(postalCode) ?? 'mainland')
}

const ALLOWED_PAYMENT_METHODS: Record<Market, string[]> = {
  AO: ['multicaixa_express'],
  PT: ['paypal', 'stripe', 'mbway'],
}

const ALLOWED_DELIVERY_METHODS: Record<Market, string[]> = {
  AO: ['courier_ao'],
  PT: ['ctt', 'courier_pt'],
}

function badRequest(message: string): never {
  throw new APIError(message, 400, null, true)
}

function relationshipId(value: SubmittedOrderItem['product']): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
  return null
}

/**
 * Makes the CMS the source of truth for every public order path. The browser
 * may choose products and variants, but never the price, currency, shipping,
 * product name, or total that is stored or sent to a payment provider.
 */
export const applyAuthoritativeOrderValues: CollectionBeforeValidateHook = async ({
  data,
  operation,
  req,
}) => {
  if (!data) return data
  if (operation !== 'create') {
    if (data.market === 'PT' && data.postalCode) {
      const deliveryRegion = portugalDeliveryRegion(data.postalCode)
      if (!deliveryRegion) badRequest('A valid Portuguese postal code is required.')
      return { ...data, country: 'Portugal', deliveryRegion }
    }
    if (data.market === 'AO' && data.city) {
      const municipality = canonicalLuandaMunicipality(data.city)
      if (!municipality) badRequest('Select a valid Luanda municipality.')
      return { ...data, country: 'Angola', city: municipality, deliveryRegion: null }
    }
    return data
  }

  const market = data.market as Market
  if (market !== 'AO' && market !== 'PT') badRequest('Invalid market.')

  let shippingSettings: (PortugalShippingSettings & AngolaShippingSettings & { portugalPaymentsEnabled?: boolean }) | null = null
  if (typeof req.payload.findGlobal === 'function') {
    shippingSettings = (await req.payload.findGlobal({
      slug: 'market-settings',
      depth: 0,
      overrideAccess: true,
    })) as PortugalShippingSettings & AngolaShippingSettings & { portugalPaymentsEnabled?: boolean }
  }
  if (market === 'PT' && shippingSettings?.portugalPaymentsEnabled !== true) {
    badRequest('Portugal checkout is temporarily unavailable.')
  }

  const paymentMethod = String(data.paymentMethod ?? '')
  const deliveryMethod = String(data.deliveryMethod ?? '')
  if (!ALLOWED_PAYMENT_METHODS[market].includes(paymentMethod)) {
    badRequest('Payment method is not available for this market.')
  }
  if (!ALLOWED_DELIVERY_METHODS[market].includes(deliveryMethod)) {
    badRequest('Delivery method is not available for this market.')
  }
  const requestPath = new URL(req.url ?? '', 'http://localhost').pathname
  if (requestPath.endsWith('/orders') && (paymentMethod === 'stripe' || paymentMethod === 'paypal')) {
    badRequest('This payment method must use its verified payment endpoint.')
  }

  const submittedItems = Array.isArray(data.items) ? (data.items as SubmittedOrderItem[]) : []
  if (submittedItems.length === 0 || submittedItems.length > 50) {
    badRequest('Order must contain between 1 and 50 items.')
  }

  const requestedByVariant = new Map<string, number>()
  const authoritativeItems = []
  let totalWeightGrams = 0

  for (const submitted of submittedItems) {
    const productId = relationshipId(submitted.product)
    const qty = Number(submitted.qty)
    const size = String(submitted.size ?? '')
    const color = String(submitted.color ?? '')

    if (productId === null || !Number.isInteger(qty) || qty < 1 || qty > 20 || !size) {
      badRequest('Invalid order item.')
    }

    let product: InventoryProduct
    try {
      product = (await req.payload.findByID({
        collection: 'products',
        id: productId,
        overrideAccess: true,
        depth: 0,
      })) as unknown as InventoryProduct
    } catch {
      badRequest('A selected product is unavailable.')
    }

    const isAvailable = product.active && (market === 'AO' ? product.availableAO : product.availablePT)
    if (!isAvailable) badRequest('A selected product is unavailable.')

    // Variant-level stock (2026-07-25), colours bilingual (2026-07-25
    // follow-up): the storefront cart carries the colour's stable ROW ID
    // (language-independent -- switching PT/EN mid-session never changes
    // which colour a cart line means), submitted here as `color`. Order
    // items still store a human-readable, LOCALIZED colour name (like
    // productName) plus that same id as `colorId`, so inventory matching
    // stays exact regardless of display language.
    //
    // Falls back to matching `color` as a NAME (any language) if it isn't a
    // known id -- covers a stale cached storefront bundle sending the old
    // shape during rollout, and is otherwise a no-op.
    const variantRefs = product.variants ?? []
    if (variantRefs.length === 0) badRequest('A selected product is unavailable.')

    const unresolvedIds = [
      ...new Set(
        variantRefs
          .map((entry) => relationshipId(entry.color ?? undefined))
          .filter((value): value is string | number => value !== null),
      ),
    ]
    const colorDocById = new Map<string, { namePT?: string | null; nameEN?: string | null }>()
    if (unresolvedIds.length > 0) {
      const colorDocs = await req.payload.find({
        collection: 'colors',
        where: { id: { in: unresolvedIds } },
        limit: unresolvedIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of colorDocs.docs) {
        colorDocById.set(String(doc.id), doc as { namePT?: string | null; nameEN?: string | null })
      }
    }
    const localizedName = (doc: { namePT?: string | null; nameEN?: string | null } | undefined) =>
      (data.lang === 'en' ? doc?.nameEN : doc?.namePT)?.trim() || doc?.namePT?.trim() || ''

    const variantRows = variantRefs.map((entry) => {
      const id = String(relationshipId(entry.color ?? undefined))
      const populated = entry.color && typeof entry.color === 'object' ? entry.color : undefined
      const doc = colorDocById.get(id) ?? (populated as { namePT?: string | null; nameEN?: string | null } | undefined)
      return {
        colorId: id,
        colorLabel: localizedName(doc),
        // Every known name of this colour, any language, lowercased --
        // for the legacy/fallback text match only.
        colorNames: [doc?.namePT, doc?.nameEN].filter((n): n is string => Boolean(n)).map((n) => n.trim().toLowerCase()),
        size: entry.size,
        stock: market === 'AO' ? Number(entry.stockAO ?? 0) : Number(entry.stockPT ?? 0),
      }
    })

    // Tolerate an omitted colour only when it's unambiguous (single-colour
    // product) -- covers older cached storefront bundles.
    const distinctColorIds = [...new Set(variantRows.map((entry) => entry.colorId))]
    let chosenColorId = color && variantRows.some((entry) => entry.colorId === color)
      ? color
      : ''
    if (!chosenColorId && color) {
      // Legacy fallback: treat the submitted value as a NAME, not an id.
      const byName = variantRows.find((entry) => entry.colorNames.includes(color.trim().toLowerCase()))
      if (byName) chosenColorId = byName.colorId
    }
    if (!chosenColorId && !color && distinctColorIds.length === 1) chosenColorId = distinctColorIds[0]
    if (!chosenColorId) badRequest('A selected colour is unavailable.')

    const variantRow = variantRows.find((entry) => entry.size === size && entry.colorId === chosenColorId)
    if (!variantRow) badRequest('A selected size/colour combination is unavailable.')

    const variantKey = `${String(product.id)}:${size}:${chosenColorId}`
    const requestedQty = (requestedByVariant.get(variantKey) ?? 0) + qty
    requestedByVariant.set(variantKey, requestedQty)
    if (requestedQty > variantRow.stock) badRequest('The requested quantity is no longer in stock.')

    const usesEurSettlement = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal'
    const unitPrice = effectiveUnitPrice(product, usesEurSettlement ? 'PT' : 'AO')
    totalWeightGrams += Math.max(1, Number(product.shippingWeightGrams ?? 500)) * qty

    authoritativeItems.push({
      product: product.id,
      productName: data.lang === 'en' ? product.nameEN || product.name : product.namePT || product.name,
      size,
      color: variantRow.colorLabel || undefined,
      colorId: chosenColorId || undefined,
      qty,
      unitPrice,
    })
  }

  const currency = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal' ? 'EUR' : 'Kz'
  const subtotal = authoritativeItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const customerEmail = String(data.customerEmail ?? '').trim().toLowerCase()

  // Coupon codes (2026-07-25, discounts phase 2). The client may suggest a
  // CODE (just the string), never a discount amount -- resolveCoupon() is
  // the only thing that turns it into a number, same authoritative-only
  // boundary as unitPrice/subtotal/total above. An invalid/expired/
  // exhausted code fails the whole order (the checkout UI validates ahead
  // of time via /coupons/validate, so this should be rare -- mainly a race
  // against another shopper exhausting a limited-use code).
  let couponCode: string | undefined
  let discountAmount = 0
  let discountLabel: string | undefined
  // freeShipping (2026-07-31 "free delivery" coupon type): kept separate
  // from discountAmount, which only ever discounts merchandise -- applied
  // below by zeroing shippingCost rather than folding into the subtotal
  // math, so the invoice still shows the real shipping price alongside the
  // waiver (see discountLabel, e.g. "FREESHIP (free shipping)").
  let freeShipping = false
  const submittedCode = typeof data.couponCode === 'string' ? data.couponCode.trim() : ''
  if (submittedCode) {
    const result = await claimCouponRedemption(req, {
      code: submittedCode,
      market,
      pricingMarket: currency === 'EUR' ? 'PT' : 'AO',
      subtotal,
      customerEmail,
    })
    if (!result.valid) badRequest(result.reason)
    couponCode = result.code
    discountAmount = result.discountAmount
    discountLabel = result.label
    freeShipping = result.freeShipping
  }

  const merchandiseTotalAfterDiscount = Math.max(0, subtotal - discountAmount)
  const municipality = market === 'AO' ? canonicalLuandaMunicipality(data.city) : null
  if (market === 'AO' && !municipality) badRequest('Select a valid Luanda municipality.')
  const deliveryRegion = market === 'PT' ? portugalDeliveryRegion(data.postalCode) : null
  if (market === 'PT' && !deliveryRegion) badRequest('A valid Portuguese postal code is required.')
  const portugalSettings = normalizePortugalShipping(shippingSettings)
  if (market === 'PT' && totalWeightGrams > portugalSettings.standardWeightLimitGrams && deliveryMethod !== 'courier_pt') {
    badRequest('Parcels over the standard weight limit require tracked delivery.')
  }
  const shippingCost = freeShipping
    ? 0
    : authoritativeShippingCost(market, deliveryMethod, merchandiseTotalAfterDiscount, shippingSettings, municipality ?? undefined, totalWeightGrams, String(data.postalCode ?? ''))

  return {
    ...data,
    customerEmail,
    items: authoritativeItems,
    currency,
    subtotal,
    shippingCost,
    country: market === 'PT' ? 'Portugal' : 'Angola',
    city: municipality ?? data.city,
    deliveryRegion,
    couponCode: couponCode ?? null,
    discountAmount,
    discountLabel: discountLabel ?? null,
    total: merchandiseTotalAfterDiscount + shippingCost,
  }
}
