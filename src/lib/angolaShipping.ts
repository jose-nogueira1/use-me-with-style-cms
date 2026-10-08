// Angola delivery is done by Zygo (zygo.ao) in Luanda, priced by four zones.
// The neighbourhood -> zone map is fixed here; the zone prices and the
// free-delivery threshold are editable in the market settings. The order's
// `city` stores the neighbourhood the customer picked.
export const ANGOLA_DELIVERY_ZONES = {
  centro: ['Ingombotas', 'Maianga', 'Alvalade', 'Maculusso', 'Mutamba', 'Cassenda'],
  sul: ['Talatona', 'Patriota', 'Belas', 'Camama', 'Benfica'],
  norte: ['Vila Alice', 'Sambizanga', 'Rangel', 'Cazenga', 'Hoji ya Henda'],
  periferia: ['Viana', 'Kilamba', 'Zango', 'Cacuaco', 'Funda'],
} as const

export type AngolaZone = keyof typeof ANGOLA_DELIVERY_ZONES

export const ANGOLA_ZONES = Object.keys(ANGOLA_DELIVERY_ZONES) as AngolaZone[]

export const DEFAULT_ANGOLA_ZONE_PRICES: Record<AngolaZone, number> = {
  centro: 3500,
  sul: 3500,
  norte: 3500,
  periferia: 5500,
}

export const DEFAULT_ANGOLA_FREE_SHIPPING_THRESHOLD = 80_000

export type AngolaShippingSettings = {
  angolaZonePriceCentro?: number | null
  angolaZonePriceSul?: number | null
  angolaZonePriceNorte?: number | null
  angolaZonePricePeriferia?: number | null
  angolaFreeShippingEnabled?: boolean | null
  angolaFreeShippingThreshold?: number | null
}

const ZONE_SETTING: Record<AngolaZone, keyof AngolaShippingSettings> = {
  centro: 'angolaZonePriceCentro',
  sul: 'angolaZonePriceSul',
  norte: 'angolaZonePriceNorte',
  periferia: 'angolaZonePricePeriferia',
}

const comparable = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLocaleLowerCase('pt').replace(/\s+/g, ' ')

// Case/accent-insensitive lookup that returns the canonical spelling, or null
// when the neighbourhood is not one Zygo serves for us.
export function canonicalAngolaNeighbourhood(value: unknown): string | null {
  const submitted = comparable(String(value ?? ''))
  for (const names of Object.values(ANGOLA_DELIVERY_ZONES)) {
    const match = names.find((name) => comparable(name) === submitted)
    if (match) return match
  }
  return null
}

export function angolaZoneOf(neighbourhood: string): AngolaZone | null {
  const canonical = canonicalAngolaNeighbourhood(neighbourhood)
  return ANGOLA_ZONES.find((zone) => (ANGOLA_DELIVERY_ZONES[zone] as readonly string[]).includes(canonical ?? '')) ?? null
}

export function normalizeAngolaShipping(settings?: AngolaShippingSettings | null) {
  const zonePrices = Object.fromEntries(ANGOLA_ZONES.map((zone) => {
    const value = Number(settings?.[ZONE_SETTING[zone]])
    return [zone, Number.isFinite(value) && value >= 0 ? value : DEFAULT_ANGOLA_ZONE_PRICES[zone]]
  })) as Record<AngolaZone, number>
  const threshold = Number(settings?.angolaFreeShippingThreshold)
  return {
    zonePrices,
    // Off unless an admin switches it on (Market settings).
    freeEnabled: settings?.angolaFreeShippingEnabled === true,
    freeThreshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_ANGOLA_FREE_SHIPPING_THRESHOLD,
  }
}

// The normal delivery price for a neighbourhood (ignoring the free threshold).
export function angolaZonePrice(neighbourhood: string, settings?: AngolaShippingSettings | null): number {
  const zone = angolaZoneOf(neighbourhood)
  return zone ? normalizeAngolaShipping(settings).zonePrices[zone] : 0
}

export function angolaShippingCost(neighbourhood: string, merchandiseTotalAfterDiscount: number, settings?: AngolaShippingSettings | null): number {
  const { freeEnabled, freeThreshold } = normalizeAngolaShipping(settings)
  if (freeEnabled && merchandiseTotalAfterDiscount >= freeThreshold) return 0
  return angolaZonePrice(neighbourhood, settings)
}
