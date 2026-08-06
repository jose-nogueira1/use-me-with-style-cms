import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import { sql } from 'drizzle-orm'
import { reservationTerminalState, reservationTtlMs } from './inventoryRules'

type ReservationOrder = {
  id?: string | number
  items?: Array<{
    product?: string | number | { id?: string | number }
    size?: string
    // Localized, human-readable colour name (variant-level stock,
    // 2026-07-25). Optional so orders created before the variants change
    // can still be released.
    color?: string | null
    // Colour row id (bilingual colours, 2026-07-25 follow-up) -- the
    // language-independent identity `color` above can no longer provide.
    // Preferred whenever present; `color` alone is the legacy fallback for
    // orders created before this field existed.
    colorId?: string | null
    variantId?: string | null
    inventoryComponents?: Array<{
      product?: string | number | { id?: string | number }
      variantId?: string | null
      qty?: number
    }> | null
    qty?: number
  }>
  market?: string
  paymentMethod?: string
  paymentStatus?: string
  status?: string
  inventoryReservationStatus?: string
}

type StockDelta = { productId: string | number; variantId: string; size: string; color: string; colorId: string; qty: number }

function relationshipId(value: StockDelta['productId'] | { id?: string | number } | undefined) {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
  return null
}

export function inventoryDeltasForOrder(order: ReservationOrder): StockDelta[] {
  const grouped = new Map<string, StockDelta>()
  for (const item of order.items ?? []) {
    const lineQty = Number(item.qty)
    if (!Number.isInteger(lineQty) || lineQty < 1) {
      throw new APIError('Invalid inventory reservation item.', 400, null, true)
    }
    if (Array.isArray(item.inventoryComponents) && item.inventoryComponents.length > 0) {
      for (const component of item.inventoryComponents) {
        const productId = relationshipId(component.product)
        const variantId = String(component.variantId ?? '')
        const componentQty = Number(component.qty)
        if (productId === null || !variantId || !Number.isInteger(componentQty) || componentQty < 1) {
          throw new APIError('Invalid kit inventory component.', 400, null, true)
        }
        const key = `${String(productId)}:${variantId}`
        const current = grouped.get(key)
        grouped.set(key, { productId, variantId, size: '', color: '', colorId: '', qty: (current?.qty ?? 0) + componentQty * lineQty })
      }
      continue
    }
    const productId = relationshipId(item.product)
    const variantId = String(item.variantId ?? '')
    const size = String(item.size ?? '')
    const color = String(item.color ?? '')
    const colorId = String(item.colorId ?? '')
    if (productId === null || (!variantId && !size)) {
      throw new APIError('Invalid inventory reservation item.', 400, null, true)
    }
    const key = variantId ? `${String(productId)}:${variantId}` : `${String(productId)}:${size}:${colorId || color}`
    const current = grouped.get(key)
    grouped.set(key, { productId, variantId, size, color, colorId, qty: (current?.qty ?? 0) + lineQty })
  }
  return [...grouped.values()].sort((a, b) => String(a.productId).localeCompare(String(b.productId)))
}

async function lockProductRow(req: PayloadRequest, productId: string | number) {
  if (!String(process.env.DATABASE_URL ?? '').startsWith('postgres')) return
  const transactionID = await req.transactionID
  if (!transactionID) throw new Error('Inventory reservation requires a database transaction.')
  const session = req.payload.db.sessions?.[String(transactionID)] as
    | { db?: { execute?: (query: unknown) => Promise<unknown> } }
    | undefined
  if (!session?.db?.execute) throw new Error('Inventory transaction session is unavailable.')
  await session.db.execute(sql`SELECT id FROM products WHERE id = ${productId} FOR UPDATE`)
}

async function applyStockDelta(req: PayloadRequest, order: ReservationOrder, direction: 'reserve' | 'release') {
  const deltas = inventoryDeltasForOrder(order)
  const productIds = [...new Set(deltas.map((entry) => entry.productId))]

  for (const productId of productIds) {
    await lockProductRow(req, productId)
    const product = await req.payload.findByID({
      collection: 'products',
      id: productId,
      depth: 0,
      overrideAccess: true,
      req,
    })
    const productDeltas = deltas.filter((entry) => String(entry.productId) === String(productId))
    const stockKey = order.market === 'PT' ? 'stockPT' : 'stockAO'

    // Variant-level stock (2026-07-25), colours bilingual (2026-07-25
    // follow-up): rows are colour+size, matched primarily by the colour's
    // stable ROW ID (deltas carry `colorId` -- see itemDeltas above), which
    // is exact and independent of display language. Colour NAME matching
    // is kept only as a fallback for orders created before `colorId`
    // existed on order items.
    type VariantRow = {
      id?: string | null
      color?: string | number | { id?: string | number; namePT?: string | null; nameEN?: string | null } | null
      size?: string | null
      sku?: string | null
      optionValueEN?: string | null
      stockAO: number
      stockPT: number
    }
    const variants = ((product.variants ?? []) as VariantRow[]).map((row) => ({
      id: row.id,
      colorId: relationshipId(row.color as never) ?? undefined,
      populated: row.color && typeof row.color === 'object' ? row.color : undefined,
      size: String(row.size ?? ''),
      sku: row.sku ?? undefined,
      optionValueEN: row.optionValueEN ?? undefined,
      stockAO: Number(row.stockAO ?? 0),
      stockPT: Number(row.stockPT ?? 0),
    }))

    // Only hit the DB for colour names if some delta actually needs the
    // legacy fallback -- new orders always carry colorId, so this is
    // normally a no-op.
    const needsNameFallback = productDeltas.some((delta) => !delta.colorId && delta.color)
    const nameById = new Map<string, string>()
    if (needsNameFallback) {
      const unresolved = [...new Set(variants.filter((v) => !v.populated && v.colorId !== undefined).map((v) => v.colorId as string | number))]
      if (unresolved.length > 0) {
        const colorDocs = await req.payload.find({
          collection: 'colors',
          where: { id: { in: unresolved } },
          limit: unresolved.length,
          depth: 0,
          overrideAccess: true,
          req,
        })
        for (const doc of colorDocs.docs) {
          const d = doc as { namePT?: string | null; nameEN?: string | null }
          const name = d.namePT || d.nameEN
          if (name) nameById.set(String(doc.id), name)
        }
      }
    }
    const colorNameOf = (v: (typeof variants)[number]) =>
      v.populated?.namePT || v.populated?.nameEN || nameById.get(String(v.colorId)) || ''

    for (const delta of productDeltas) {
      let idx = -1
      if (delta.variantId) {
        idx = variants.findIndex((v) => String(v.id) === delta.variantId)
      }
      if (idx === -1 && delta.colorId) {
        idx = variants.findIndex((v) => v.size === delta.size && String(v.colorId) === delta.colorId)
      }
      if (idx === -1 && delta.color) {
        idx = variants.findIndex((v) => v.size === delta.size && colorNameOf(v).toLowerCase() === delta.color.toLowerCase())
      }
      // Colour-less deltas (orders that predate variants entirely) fall
      // back to any row of that size with stock; release always accepts
      // any row of that size as a last resort.
      if (idx === -1 && !delta.color && !delta.colorId) {
        idx = variants.findIndex((v) => v.size === delta.size && (direction === 'release' || v[stockKey] >= delta.qty))
      }
      if (idx === -1 && direction === 'release') {
        idx = variants.findIndex((v) => v.size === delta.size)
      }
      if (idx === -1) {
        throw new APIError('The requested quantity is no longer in stock.', 409, null, true)
      }
      if (direction === 'reserve' && variants[idx][stockKey] < delta.qty) {
        throw new APIError('The requested quantity is no longer in stock.', 409, null, true)
      }
      variants[idx][stockKey] += direction === 'reserve' ? -delta.qty : delta.qty
    }

    await req.payload.update({
      collection: 'products',
      id: productId,
      data: {
        // Cast: relationship ids are numbers under both adapters at
        // runtime; the local VariantRow type is looser (string | number)
        // only because relationshipId() is shared with request payloads.
        variants: variants.map((v) => ({
          id: v.id ?? undefined,
          color: v.colorId,
          size: v.size || undefined,
          sku: v.sku,
          optionValueEN: v.optionValueEN,
          stockAO: v.stockAO,
          stockPT: v.stockPT,
        })) as never,
      },
      depth: 0,
      overrideAccess: true,
      req,
      context: { inventoryReservationMutation: true },
    })
  }
}

function reservationExpiry(paymentMethod: string | undefined) {
  return new Date(Date.now() + reservationTtlMs(paymentMethod)).toISOString()
}

export const manageInventoryReservation: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (context.skipInventoryReservation) return data

  if (operation === 'create') {
    await releaseExpiredReservations(req, 25)
    await applyStockDelta(req, data as ReservationOrder, 'reserve')
    return {
      ...data,
      inventoryReservationStatus: 'active',
      inventoryReservationExpiresAt: reservationExpiry(String(data.paymentMethod ?? '')),
    }
  }

  const original = originalDoc as ReservationOrder | undefined
  if (!original) return data

  const nextPaymentStatus = String(data.paymentStatus ?? original.paymentStatus ?? '')
  const nextOrderStatus = String(data.status ?? original.status ?? '')

  if (original.inventoryReservationStatus === 'active') {
    const terminalState = reservationTerminalState(nextPaymentStatus, nextOrderStatus)
    if (terminalState === 'committed') {
      return {
        ...data,
        inventoryReservationStatus: 'committed',
        inventoryReservationExpiresAt: null,
      }
    }

    if (terminalState === 'released') {
      await applyStockDelta(req, original, 'release')
      return {
        ...data,
        inventoryReservationStatus: 'released',
        inventoryReservationExpiresAt: null,
        inventoryReservationReleasedAt: new Date().toISOString(),
      }
    }

    return data
  }

  // Cancelling an order whose inventory was already 'committed' (i.e. it
  // had been marked paid) -- a return/refund, essentially. Found during
  // 2026-07-31 Orders QA: the guard above used to be `!== 'active'`, so it
  // returned `data` unchanged for a committed reservation too, and stock
  // was NEVER restored no matter how the order was cancelled afterwards.
  // Verified against the Payload Local API: cancelling a paid order left
  // stock counts untouched. `original.status !== 'cancelled'` makes this
  // fire exactly once, the same idempotency pattern the 'active' branch
  // above already relies on (re-saving an already-terminal order is a
  // no-op).
  if (original.inventoryReservationStatus === 'committed' && nextOrderStatus === 'cancelled' && original.status !== 'cancelled') {
    await applyStockDelta(req, original, 'release')
    return {
      ...data,
      inventoryReservationStatus: 'released',
      inventoryReservationExpiresAt: null,
      inventoryReservationReleasedAt: new Date().toISOString(),
    }
  }

  // A gateway success can arrive after the shopper cancelled or the
  // reservation expired. Re-acquire the exact variants before reopening
  // the order so a late callback can never oversell inventory. The payment
  // endpoint catches a 409 here and records the genuine payment against the
  // cancelled order for manual refund/review instead.
  if (
    context.lateVerifiedPayment &&
    original.inventoryReservationStatus === 'released' &&
    nextPaymentStatus === 'paid'
  ) {
    await applyStockDelta(req, original, 'reserve')
    return {
      ...data,
      inventoryReservationStatus: 'committed',
      inventoryReservationExpiresAt: null,
      inventoryReservationReleasedAt: null,
    }
  }

  return data
}

export async function releaseExpiredReservations(req: PayloadRequest, limit = 100) {
  const expired = await req.payload.find({
    collection: 'orders',
    where: {
      and: [
        { inventoryReservationStatus: { equals: 'active' } },
        { inventoryReservationExpiresAt: { less_than_equal: new Date().toISOString() } },
      ],
    },
    limit,
    depth: 0,
    overrideAccess: true,
    req,
  })

  for (const order of expired.docs) {
    await req.payload.update({
      collection: 'orders',
      id: order.id,
      data: { status: 'cancelled', paymentStatus: 'failed' },
      depth: 0,
      overrideAccess: true,
      req,
      context: { inventoryReleaseReason: 'expired' },
    })
  }
  return expired.docs.length
}
