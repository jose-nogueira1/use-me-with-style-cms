export const DEFAULT_PORTUGAL_SHIPPING = {
  standardPrice: 4.9,
  trackedPrice: 6.9,
  freeThreshold: 75,
  standardWeightLimitGrams: 2000,
  heavyMainlandPrice: 9.9,
  heavyIslandsPrice: 14.9,
} as const

export type PortugalDeliveryRegion = 'mainland' | 'madeira' | 'azores'

export type PortugalShippingSettings = {
  portugalStandardShippingPrice?: number | null
  portugalTrackedShippingPrice?: number | null
  portugalFreeShippingThreshold?: number | null
  portugalStandardWeightLimitGrams?: number | null
  portugalHeavyMainlandShippingPrice?: number | null
  portugalHeavyIslandsShippingPrice?: number | null
}

function nonNegative(value: number | null | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

export function normalizePortugalShipping(settings?: PortugalShippingSettings | null) {
  return {
    standardPrice: nonNegative(settings?.portugalStandardShippingPrice, DEFAULT_PORTUGAL_SHIPPING.standardPrice),
    trackedPrice: nonNegative(settings?.portugalTrackedShippingPrice, DEFAULT_PORTUGAL_SHIPPING.trackedPrice),
    freeThreshold: nonNegative(settings?.portugalFreeShippingThreshold, DEFAULT_PORTUGAL_SHIPPING.freeThreshold),
    standardWeightLimitGrams: nonNegative(settings?.portugalStandardWeightLimitGrams, DEFAULT_PORTUGAL_SHIPPING.standardWeightLimitGrams),
    heavyMainlandPrice: nonNegative(settings?.portugalHeavyMainlandShippingPrice, DEFAULT_PORTUGAL_SHIPPING.heavyMainlandPrice),
    heavyIslandsPrice: nonNegative(settings?.portugalHeavyIslandsShippingPrice, DEFAULT_PORTUGAL_SHIPPING.heavyIslandsPrice),
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
  totalWeightGrams = 0,
  region: PortugalDeliveryRegion = 'mainland',
): number {
  const values = normalizePortugalShipping(settings)
  if (merchandiseTotalAfterDiscount >= values.freeThreshold) return 0
  if (totalWeightGrams > values.standardWeightLimitGrams) {
    return region === 'mainland' ? values.heavyMainlandPrice : values.heavyIslandsPrice
  }
  return deliveryMethod === 'courier_pt' ? values.trackedPrice : values.standardPrice
}
