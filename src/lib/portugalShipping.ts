export const DEFAULT_PORTUGAL_SHIPPING = {
  standardPrice: 4.9,
  trackedPrice: 6.9,
  freeThreshold: 75,
} as const

export type PortugalDeliveryRegion = 'mainland' | 'madeira' | 'azores'

export type PortugalShippingSettings = {
  portugalStandardShippingPrice?: number | null
  portugalTrackedShippingPrice?: number | null
  portugalFreeShippingThreshold?: number | null
}

function nonNegative(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

export function normalizePortugalShipping(settings?: PortugalShippingSettings | null) {
  return {
    standardPrice: nonNegative(settings?.portugalStandardShippingPrice, DEFAULT_PORTUGAL_SHIPPING.standardPrice),
    trackedPrice: nonNegative(settings?.portugalTrackedShippingPrice, DEFAULT_PORTUGAL_SHIPPING.trackedPrice),
    freeThreshold: nonNegative(settings?.portugalFreeShippingThreshold, DEFAULT_PORTUGAL_SHIPPING.freeThreshold),
  }
}

export function portugalDeliveryRegion(postalCode: unknown): PortugalDeliveryRegion | null {
  const match = String(postalCode ?? '').trim().match(/^(\d{4})-\d{3}$/)
  if (!match) return null
  const prefix = Number(match[1])
  if (prefix >= 9000 && prefix <= 9499) return 'madeira'
  if (prefix >= 9500 && prefix <= 9999) return 'azores'
  return 'mainland'
}

export function portugalShippingCost(
  deliveryMethod: string,
  merchandiseTotalAfterDiscount: number,
  settings?: PortugalShippingSettings | null,
): number {
  const values = normalizePortugalShipping(settings)
  if (merchandiseTotalAfterDiscount >= values.freeThreshold) return 0
  return deliveryMethod === 'courier_pt' ? values.trackedPrice : values.standardPrice
}
