import { APIError, type CollectionBeforeValidateHook } from 'payload'

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
  // Variant-level inventory (2026-07-25): stock per colour+size row. The
  // colour ref is a plain id at depth 0, a populated doc at depth >= 1.
  variants?: Array<{
    color?: string | number | { id?: string | number; name?: string | null } | null
    size: string
    stockAO: number
    stockPT: number
  }> | null
}

const PT_SHIPPING_COSTS: Record<string, number> = {
  ctt: 4,
  courier_pt: 6,
}

const ALLOWED_PAYMENT_METHODS: Record<Market, string[]> = {
  AO: ['multicaixa_express', 'stripe', 'paypal'],
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
  if (operation !== 'create' || !data) return data

  const market = data.market as Market
  if (market !== 'AO' && market !== 'PT') badRequest('Invalid market.')

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

    // Variant-level stock (2026-07-25): every product tracks stock per
    // colour+size row, and order items keep storing the colour NAME
    // (human-readable on invoices/labels). Resolve colour ids -> names,
    // then validate the exact colour+size combination.
    const variantRefs = product.variants ?? []
    if (variantRefs.length === 0) badRequest('A selected product is unavailable.')

    const unresolvedIds = [
      ...new Set(
        variantRefs
          .map((entry) => relationshipId(entry.color ?? undefined))
          .filter((value): value is string | number => value !== null),
      ),
    ]
    const nameById = new Map<string, string>()
    if (unresolvedIds.length > 0) {
      const colorDocs = await req.payload.find({
        collection: 'colors',
        where: { id: { in: unresolvedIds } },
        limit: unresolvedIds.length,
        depth: 0,
        overrideAccess: true,
      })
      for (const doc of colorDocs.docs) {
        const name = (doc as { name?: string | null }).name
        if (name) nameById.set(String(doc.id), name)
      }
    }
    const variantRows = variantRefs.map((entry) => ({
      colorName:
        (entry.color && typeof entry.color === 'object' && entry.color.name) ||
        nameById.get(String(relationshipId(entry.color ?? undefined))) ||
        '',
      size: entry.size,
      stock: market === 'AO' ? Number(entry.stockAO ?? 0) : Number(entry.stockPT ?? 0),
    }))

    // Tolerate an omitted colour only when it's unambiguous (single-colour
    // product) -- covers older cached storefront bundles.
    const distinctColors = [...new Set(variantRows.map((entry) => entry.colorName))]
    const chosenColor = color || (distinctColors.length === 1 ? distinctColors[0] : '')
    if (!chosenColor) badRequest('A selected colour is unavailable.')

    const variantRow = variantRows.find((entry) => entry.size === size && entry.colorName === chosenColor)
    if (!variantRow) badRequest('A selected size/colour combination is unavailable.')

    const variantKey = `${String(product.id)}:${size}:${chosenColor}`
    const requestedQty = (requestedByVariant.get(variantKey) ?? 0) + qty
    requestedByVariant.set(variantKey, requestedQty)
    if (requestedQty > variantRow.stock) badRequest('The requested quantity is no longer in stock.')

    const usesEurSettlement = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal'
    const unitPrice = usesEurSettlement ? product.pricePTEur : product.priceAOKz

    authoritativeItems.push({
      product: product.id,
      productName: data.lang === 'en' ? product.nameEN || product.name : product.namePT || product.name,
      size,
      color: chosenColor,
      qty,
      unitPrice,
    })
  }

  const currency = market === 'PT' || paymentMethod === 'stripe' || paymentMethod === 'paypal' ? 'EUR' : 'Kz'
  const shippingCost = market === 'AO' ? 0 : PT_SHIPPING_COSTS[deliveryMethod]
  const subtotal = authoritativeItems.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)

  return {
    ...data,
    customerEmail: String(data.customerEmail ?? '').trim().toLowerCase(),
    items: authoritativeItems,
    currency,
    subtotal,
    shippingCost,
    total: subtotal + shippingCost,
  }
}
