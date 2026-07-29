export const LUANDA_MUNICIPALITIES = [
  'Luanda', 'Cacuaco', 'Cazenga', 'Viana', 'Belas', 'Talatona', 'Mussulo', 'Sambizanga',
  'Rangel', 'Maianga', 'Samba', 'Camama', 'Mulenvos', 'Kilamba', 'Hoji Ya Henda', 'Ingombota',
] as const

export const DEFAULT_ANGOLA_MUNICIPALITY_PRICES: Record<string, number> = {
  Luanda: 3000,
  Cacuaco: 5000,
  Cazenga: 3500,
  Viana: 6000,
  Belas: 6500,
  Talatona: 4000,
  Mussulo: 8000,
  Sambizanga: 3000,
  Rangel: 3000,
  Maianga: 2500,
  Samba: 3500,
  Camama: 4500,
  Mulenvos: 5500,
  Kilamba: 5000,
  'Hoji Ya Henda': 3500,
  Ingombota: 2500,
}

export const DEFAULT_ANGOLA_FREE_SHIPPING_THRESHOLD = 80_000

export type AngolaShippingSettings = {
  angolaMunicipalityPrices?: Record<string, unknown> | null
  angolaFreeShippingThreshold?: number | null
}

export function canonicalLuandaMunicipality(value: unknown): string | null {
  const submitted = String(value ?? '').trim().toLocaleLowerCase('pt')
  return LUANDA_MUNICIPALITIES.find((name) => name.toLocaleLowerCase('pt') === submitted) ?? null
}

export function normalizeAngolaShipping(settings?: AngolaShippingSettings | null) {
  const configured = settings?.angolaMunicipalityPrices
  const municipalityPrices = Object.fromEntries(LUANDA_MUNICIPALITIES.map((municipality) => {
    const value = Number(configured?.[municipality])
    return [municipality, Number.isFinite(value) && value >= 0 ? value : DEFAULT_ANGOLA_MUNICIPALITY_PRICES[municipality]]
  }))
  const threshold = Number(settings?.angolaFreeShippingThreshold)
  return {
    municipalityPrices,
    freeThreshold: Number.isFinite(threshold) && threshold >= 0 ? threshold : DEFAULT_ANGOLA_FREE_SHIPPING_THRESHOLD,
  }
}

export function angolaShippingCost(municipality: string, merchandiseTotalAfterDiscount: number, settings?: AngolaShippingSettings | null): number {
  const values = normalizeAngolaShipping(settings)
  if (merchandiseTotalAfterDiscount >= values.freeThreshold) return 0
  return values.municipalityPrices[municipality] ?? 0
}
