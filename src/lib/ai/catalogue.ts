import { effectiveUnitPrice } from '../salePricing'
import type { MessageExtraction } from './extraction'

export type CatalogueMarket = 'AO' | 'PT'

export type CatalogueProduct = {
  id: string | number
  name?: string | null
  namePT?: string | null
  nameEN?: string | null
  slug?: string | null
  active?: boolean | null
  availableAO?: boolean | null
  availablePT?: boolean | null
  priceAOKz?: number | null
  pricePTEur?: number | null
  saleAOKz?: number | null
  salePTEur?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
  fitNotePT?: string | null
  fitNoteEN?: string | null
  sizeGuide?: unknown
  variants?: Array<CatalogueVariant> | null
  category?: unknown
  tag?: unknown
}

export type CatalogueVariant = {
  id?: string | number | null
  size?: string | null
  color?: string | number | { id?: string | number; name?: string; namePT?: string; nameEN?: string } | null
  stockAO?: number | null
  stockPT?: number | null
}

export type ProductVariantContext = {
  id: string | number | null
  size: string | null
  colour: string | null
  stock: number
  available: boolean
}

export type ProductContext = {
  sourceRecordId: string
  productId: string | number
  name: string
  namePT: string | null
  nameEN: string | null
  slug: string | null
  market: CatalogueMarket
  availableInMarket: boolean
  price: number | null
  currency: 'AOA' | 'EUR'
  onSale: boolean
  fitNote: string | null
  sizeGuide: unknown
  variants: ProductVariantContext[]
  matchedVariants: ProductVariantContext[]
  productUrl: string | null
}

export type CatalogueClient = {
  find: (args: Record<string, unknown>) => Promise<{ docs: CatalogueProduct[] }>
}

export function extractionMarketToCatalogueMarket(market: MessageExtraction['market']): CatalogueMarket | null {
  if (market === 'angola') return 'AO'
  if (market === 'portugal') return 'PT'
  return null
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function normalize(value: unknown): string {
  return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function colourName(value: CatalogueVariant['color']): string | null {
  if (typeof value === 'object' && value) return text(value.namePT || value.nameEN || value.name) || null
  return value == null ? null : String(value)
}

function matches(value: string | null, requested: string | null): boolean {
  return !requested || normalize(value) === normalize(requested)
}

export function buildCatalogueSearchWhere(candidateNames: string[], market: CatalogueMarket): Record<string, unknown> {
  const marketField = market === 'AO' ? 'availableAO' : 'availablePT'
  const names = candidateNames.map((name) => name.trim()).filter(Boolean).slice(0, 5)
  return {
    and: [
      { active: { equals: true } },
      { [marketField]: { equals: true } },
      ...(names.length ? [{ or: names.flatMap((name) => [
        { name: { like: name } }, { namePT: { like: name } }, { nameEN: { like: name } },
      ]) }] : []),
    ],
  }
}

export function toProductContext(product: CatalogueProduct, extraction: MessageExtraction, market: CatalogueMarket, now = new Date()): ProductContext {
  const availableInMarket = product.active !== false && (market === 'AO' ? product.availableAO !== false : product.availablePT !== false)
  const rawVariants = product.variants || []
  const variants = rawVariants.map((variant) => {
    const stock = Number(market === 'AO' ? variant.stockAO : variant.stockPT) || 0
    return { id: variant.id ?? null, size: text(variant.size) || null, colour: colourName(variant.color), stock, available: stock > 0 }
  })
  const matchedVariants = variants.filter((variant, index) => {
    if (!matches(variant.size, extraction.size)) return false
    if (!extraction.colour) return true
    const rawColour = rawVariants[index]?.color
    const aliases = typeof rawColour === 'object' && rawColour
      ? [rawColour.name, rawColour.namePT, rawColour.nameEN]
      : [variant.colour]
    return aliases.some((alias) => matches(alias || null, extraction.colour))
  })
  const priced = typeof product.priceAOKz === 'number' && typeof product.pricePTEur === 'number'
    ? effectiveUnitPrice({ ...product, priceAOKz: product.priceAOKz, pricePTEur: product.pricePTEur }, market, now)
    : null
  const regular = market === 'AO' ? product.priceAOKz : product.pricePTEur
  const onSale = priced !== null && regular != null && priced < regular
  const namePT = text(product.namePT) || text(product.name) || null
  const nameEN = text(product.nameEN) || text(product.name) || null
  return {
    sourceRecordId: String(product.id), productId: product.id, name: namePT || nameEN || 'Unnamed product', namePT, nameEN,
    slug: text(product.slug) || null, market, availableInMarket, price: priced, currency: market === 'AO' ? 'AOA' : 'EUR', onSale,
    fitNote: market === 'AO' ? (text(product.fitNotePT) || text(product.fitNoteEN) || null) : (text(product.fitNotePT) || text(product.fitNoteEN) || null),
    sizeGuide: product.sizeGuide ?? null, variants, matchedVariants,
    productUrl: text(product.slug)
      ? `https://${market === 'AO' ? 'ao' : 'pt'}.usemewithstyle.shop/produto/${encodeURIComponent(text(product.slug))}`
      : null,
  }
}

export async function retrieveProductContexts(client: CatalogueClient, extraction: MessageExtraction, options: { market?: CatalogueMarket; now?: Date } = {}): Promise<ProductContext[]> {
  const market = options.market || extractionMarketToCatalogueMarket(extraction.market)
  if (!market || !extraction.candidateProductNames.length) return []
  const result = await client.find({ collection: 'products', where: buildCatalogueSearchWhere(extraction.candidateProductNames, market), depth: 2, limit: 10, overrideAccess: true })
  return result.docs.map((product) => toProductContext(product, extraction, market, options.now))
}
