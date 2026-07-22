import { APIError, type CollectionBeforeChangeHook, type PayloadRequest } from 'payload'
import { sql } from 'drizzle-orm'
import { reservationTerminalState, reservationTtlMs } from './inventoryRules'

type ReservationOrder = {
  id?: string | number
  items?: Array<{
    product?: string | number | { id?: string | number }
    size?: string
    qty?: number
  }>
  market?: string
  paymentMethod?: string
  paymentStatus?: string
  status?: string
  inventoryReservationStatus?: string
}

type StockDelta = { productId: string | number; size: string; qty: number }

function relationshipId(value: StockDelta['productId'] | { id?: string | number } | undefined) {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && (typeof value.id === 'string' || typeof value.id === 'number')) return value.id
  return null
}

function itemDeltas(order: ReservationOrder): StockDelta[] {
  const grouped = new Map<string, StockDelta>()
  for (const item of order.items ?? []) {
    const productId = relationshipId(item.product)
    const size = String(item.size ?? '')
    const qty = Number(item.qty)
    if (productId === null || !size || !Number.isInteger(qty) || qty < 1) {
      throw new APIError('Invalid inventory reservation item.', 400, null, true)
    }
    const key = `${String(productId)}:${size}`
    const current = grouped.get(key)
    grouped.set(key, { productId, size, qty: (current?.qty ?? 0) + qty })
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
  const deltas = itemDeltas(order)
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
    const sizes = (product.sizes ?? []).map((sizeRow) => {
      const delta = productDeltas.find((entry) => entry.size === sizeRow.size)
      if (!delta) return sizeRow
      const currentStock = Number(sizeRow[stockKey] ?? 0)
      if (direction === 'reserve' && currentStock < delta.qty) {
        throw new APIError('The requested quantity is no longer in stock.', 409, null, true)
      }
      return {
        ...sizeRow,
        [stockKey]: direction === 'reserve' ? currentStock - delta.qty : currentStock + delta.qty,
      }
    })

    await req.payload.update({
      collection: 'products',
      id: productId,
      data: { sizes },
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
  if (!original || original.inventoryReservationStatus !== 'active') return data

  const nextPaymentStatus = String(data.paymentStatus ?? original.paymentStatus ?? '')
  const nextOrderStatus = String(data.status ?? original.status ?? '')
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
