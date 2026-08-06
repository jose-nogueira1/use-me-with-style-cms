import { APIError, type CollectionBeforeValidateHook } from 'payload'
import { effectiveUnitPrice, isProductOnSale } from './salePricing'
import { claimCouponRedemption } from './couponPricing'
import { normalizePortugalShipping, portugalDeliveryRegion, portugalShippingCost, type PortugalShippingSettings } from './portugalShipping'
import { angolaShippingCost, canonicalLuandaMunicipality, type AngolaShippingSettings } from './angolaShipping'

type Market = 'AO' | 'PT'

type SubmittedOrderItem = {
  product?: string | number | { id?: string | number }
  variantId?: string
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
  productType?: 'standard' | 'bundle' | null
  optionLabelPT?: string | null
  optionLabelEN?: string | null
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
    id?: string | null
    color?: string | number | { id?: string | number; name?: string | null } | null
    size?: string | null
    optionValueEN?: string | null
    stockAO: number
    stockPT: number
  }> | null
  bundleComponents?: Array<{
    product?: string | number | { id?: string | number }
    variantId?: string | null
    qty?: number | null
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

// 'manual_whatsapp' (2026-08-04): Portugal's checkout fallback while
// portugalPaymentsEnabled is off. Listed here so it passes this allow-list;
// whether it's actually usable in the current live/deferred state is
// enforced separately below, right next to the deferred-checkout block it
// replaces.
const ALLOWED_PAYMENT_METHODS: Record<Market, string[]> = {
  AO: ['multicaixa_express'],
  PT: ['paypal', 'stripe', 'mbway', 'manual_whatsapp'],
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
  const paymentMethod = String(data.paymentMethod ?? '')
  const deliveryMethod = String(data.deliveryMethod ?? '')

  // Portugal manual-WhatsApp fallback (2026-08-04): while payments are
  // deferred, only 'manual_whatsapp' is accepted (real gateways would
  // silently fail, since Stripe/PayPal/MB WAY aren't actually wired up for
  // this market yet). Once portugalPaymentsEnabled flips on, the reverse
  // applies -- 'manual_whatsapp' stops being accepted so every PT order
  // goes through a real payment method from then on.
  if (market === 'PT') {
    const portugalLive = shippingSettings?.portugalPaymentsEnabled === true
    if (!portugalLive && paymentMethod !== 'manual_whatsapp') {
      badRequest('Portugal checkout is temporarily unavailable.')
    }
    if (portugalLive && paymentMethod === 'manual_whatsapp') {
      badRequest('Portugal checkout is live -- please choose a payment method.')
    }
  }
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

  const loadProduct = async (id: string | number) => {
    try {
      return (await req.payload.findByID({
        collection: 'products',
        id,
        overrideAccess: true,
        depth: 0,
      })) as unknown as InventoryProduct
    } catch {
      badRequest('A selected product is unavailable.')
    }
  }

  const variantRowsFor = async (product: InventoryProduct) => {
    const variantRefs = product.variants ?? []
    const unresolvedIds = [...new Set(variantRefs
      .map((entry) => relationshipId(entry.color ?? undefined))
      .filter((value): value is string | number => value !== null))]
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
    const localizedColorName = (doc: { namePT?: string | null; nameEN?: string | null } | undefined) =>
      (data.lang === 'en' ? doc?.nameEN : doc?.namePT)?.trim() || doc?.namePT?.trim() || ''
    return variantRefs.map((entry) => {
      const rawColorId = relationshipId(entry.color ?? undefined)
      const colorId = rawColorId === null ? '' : String(rawColorId)
      const populated = entry.color && typeof entry.color === 'object' ? entry.color : undefined
      const doc = colorDocById.get(colorId) ?? (populated as { namePT?: string | null; nameEN?: string | null } | undefined)
      return {
        id: String(entry.id ?? ''),
        colorId,
        colorLabel: localizedColorName(doc),
        colorNames: [doc?.namePT, doc?.nameEN].filter((name): name is string => Boolean(name)).map((name) => name.trim().toLowerCase()),
        optionValue: (data.lang === 'en' ? entry.optionValueEN : entry.size)?.trim() || entry.size?.trim() || '',
        legacySize: entry.size?.trim() || '',
        stock: market === 'AO' ? Number(entry.stockAO ?? 0) : Number(entry.stockPT ?? 0),
      }
    })
  }

  const reserveRequestedVariant = (productId: string | number, variantId: string, stock: number, requestedQty: number) => {
    const key = `${String(productId)}:${variantId}`
    const total = (requestedByVariant.get(key) ?? 0) + requestedQty
    requestedByVariant.set(key, total)
    if (total > stock) badRequest('The requested quantity is no longer in stock.')
  }

  for (const submitted of submittedItems) {
    const productId = relationshipId(submitted.product)
    const qty = Number(submitted.qty)
    const submittedVariantId = String(submitted.variantId ?? '')
    const size = String(submitted.size ?? '')
    const color = String(submitted.color ?? '')

    if (productId === null || !Number.isInteger(qty) || qty < 1 || qty > 20) {
      badRequest('Invalid order item.')
    }

    const product = await loadProduct(productId)

    const isAvailable = product.active && (market === 'AO' ? product.availableAO : product.availablePT)
    if (!isAvailable) badRequest('A selected product is unavailable.')

    let chosenVariantId = ''
    let chosenColorId = ''
    let colorLabel = ''
    let optionValue = ''
    let legacySize = ''
    let inventoryComponents: Array<{ product: string | number; variantId: string; qty: number }> | undefined

    if (product.productType === 'bundle') {
      const components = product.bundleComponents ?? []
      if (components.length === 0) badRequest('This product kit is not configured.')
      inventoryComponents = []
      for (const component of components) {
        const componentProductId = relationshipId(component.product)
        const componentVariantId = String(component.variantId ?? '')
        const componentQty = Number(component.qty)
        if (componentProductId === null || !componentVariantId || !Number.isInteger(componentQty) || componentQty < 1) {
          badRequest('This product kit is not configured.')
        }
        const componentProduct = await loadProduct(componentProductId)
        const componentAvailable = componentProduct.active && (market === 'AO' ? componentProduct.availableAO : componentProduct.availablePT)
        if (!componentAvailable || componentProduct.productType === 'bundle') badRequest('A product in this kit is unavailable.')
        const componentVariant = (await variantRowsFor(componentProduct)).find((row) => row.id === componentVariantId)
        if (!componentVariant) badRequest('A product in this kit is unavailable.')
        reserveRequestedVariant(componentProduct.id, componentVariant.id, componentVariant.stock, componentQty * qty)
        inventoryComponents.push({ product: componentProduct.id, variantId: componentVariant.id, qty: componentQty })
      }
    } else {
      const variantRows = await variantRowsFor(product)
      if (variantRows.length === 0) badRequest('A selected product is unavailable.')
      let variantRow = submittedVariantId ? variantRows.find((row) => row.id === submittedVariantId) : undefined
      // Backward-compatible colour/size matching for carts created before
      // stable variant IDs shipped.
      if (!variantRow) {
        let legacyColorId = color && variantRows.some((row) => row.colorId === color) ? color : ''
        if (!legacyColorId && color) {
          legacyColorId = variantRows.find((row) => row.colorNames.includes(color.trim().toLowerCase()))?.colorId ?? ''
        }
        variantRow = variantRows.find((row) => row.legacySize === size && (!legacyColorId || row.colorId === legacyColorId))
      }
      if (!variantRow && variantRows.length === 1 && !submittedVariantId && !size && !color) variantRow = variantRows[0]
      if (!variantRow) badRequest('A selected product option is unavailable.')
      chosenVariantId = variantRow.id
      chosenColorId = variantRow.colorId
      colorLabel = variantRow.colorLabel
      optionValue = variantRow.optionValue
      legacySize = variantRow.legacySize
      reserveRequestedVariant(product.id, variantRow.id, variantRow.stock, qty)
    }

    const usesEurSettlement = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal'
    const unitPrice = effectiveUnitPrice(product, usesEurSettlement ? 'PT' : 'AO')
    totalWeightGrams += Math.max(1, Number(product.shippingWeightGrams ?? 500)) * qty

    authoritativeItems.push({
      product: product.id,
      productName: data.lang === 'en' ? product.nameEN || product.name : product.namePT || product.name,
      variantId: chosenVariantId || undefined,
      size: legacySize || undefined,
      optionLabel: product.productType === 'bundle' ? undefined : ((data.lang === 'en' ? product.optionLabelEN : product.optionLabelPT)?.trim() || product.optionLabelPT?.trim() || undefined),
      optionValue: optionValue || undefined,
      color: colorLabel || undefined,
      colorId: chosenColorId || undefined,
      productType: product.productType === 'bundle' ? 'bundle' : 'standard',
      inventoryComponents,
      qty,
      unitPrice,
      // Sale-price exclusion (2026-08-04) -- not persisted on the order
      // (Orders.ts's items field doesn't carry it), only used below to
      // build eligibleSubtotal for the coupon check. A line already priced
      // via the running sale is never itself discounted further by a
      // percent-off coupon.
      onSale: isProductOnSale(product),
    })
  }

  const currency = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal' ? 'EUR' : 'Kz'
  const subtotal = authoritativeItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const eligibleSubtotal = authoritativeItems.reduce((sum, item) => sum + (item.onSale ? 0 : item.unitPrice * item.qty), 0)
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
      eligibleSubtotal,
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
    // `onSale` was only ever needed above (eligibleSubtotal) -- Orders.ts's
    // items field has no such field, so it's dropped here rather than left
    // for Payload to silently ignore.
    items: authoritativeItems.map(({ onSale: _onSale, ...item }) => item),
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
