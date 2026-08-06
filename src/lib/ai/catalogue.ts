import { effectiveUnitPrice } from '../salePricing'
import type { MessageExtraction } from './extraction'
import type { AiMessagingSettings } from './settings'

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
  categoryId: string | null
  categorySlug: string | null
  tagIds: string[]
  tagSlugs: string[]
}

export type SameProductRecoveryKind = 'same_size_other_colour' | 'same_colour_other_size' | 'other_variant'

export type SameProductRecoveryOption = ProductVariantContext & {
  kind: SameProductRecoveryKind
}

export type ProductRecommendationReason = 'same_category' | 'shared_merchandising_tag'

export type RankedProductRecommendation = {
  product: ProductContext
  score: number
  reasons: ProductRecommendationReason[]
  sharedTagCount: number
  priceDifferencePercent: number | null
}

export type OutOfStockRecovery = {
  sameProductOptions: SameProductRecoveryOption[]
  recommendations: RankedProductRecommendation[]
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

function relationId(value: unknown): string | null {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? String(id) : null
  }
  return null
}

function relationSlug(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('slug' in value)) return null
  return text((value as { slug?: unknown }).slug) || null
}

function relationList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value]
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
  const tags = relationList(product.tag)
  return {
    sourceRecordId: String(product.id), productId: product.id, name: namePT || nameEN || 'Unnamed product', namePT, nameEN,
    slug: text(product.slug) || null, market, availableInMarket, price: priced, currency: market === 'AO' ? 'AOA' : 'EUR', onSale,
    fitNote: market === 'AO' ? (text(product.fitNotePT) || text(product.fitNoteEN) || null) : (text(product.fitNotePT) || text(product.fitNoteEN) || null),
    sizeGuide: product.sizeGuide ?? null, variants, matchedVariants,
    productUrl: text(product.slug)
      ? `https://${market === 'AO' ? 'ao' : 'pt'}.usemewithstyle.shop/produto/${encodeURIComponent(text(product.slug))}`
      : null,
    categoryId: relationId(product.category),
    categorySlug: relationSlug(product.category),
    tagIds: tags.map(relationId).filter((id): id is string => Boolean(id)),
    tagSlugs: tags.map(relationSlug).filter((slug): slug is string => Boolean(slug)),
  }
}

export async function retrieveProductContexts(client: CatalogueClient, extraction: MessageExtraction, options: { market?: CatalogueMarket; now?: Date } = {}): Promise<ProductContext[]> {
  const market = options.market || extractionMarketToCatalogueMarket(extraction.market)
  if (!market || !extraction.candidateProductNames.length) return []
  const result = await client.find({ collection: 'products', where: buildCatalogueSearchWhere(extraction.candidateProductNames, market), depth: 2, limit: 10, overrideAccess: true })
  const requestedNames = extraction.candidateProductNames.map(normalize)
  const relevance = (product: ProductContext) => {
    const names = [product.name, product.namePT, product.nameEN].map(normalize).filter(Boolean)
    if (names.some((name) => requestedNames.includes(name))) return 2
    if (names.some((name) => requestedNames.some((requested) => name.includes(requested) || requested.includes(name)))) return 1
    return 0
  }
  return result.docs
    .map((product) => toProductContext(product, extraction, market, options.now))
    .sort((left, right) => relevance(right) - relevance(left) || left.name.localeCompare(right.name))
}

function sameNormalized(left: string | null, right: string | null): boolean {
  return Boolean(left && right && normalize(left) === normalize(right))
}

function dedupeVariants(variants: SameProductRecoveryOption[]): SameProductRecoveryOption[] {
  const seen = new Set<string>()
  return variants.filter((variant) => {
    const key = `${normalize(variant.size)}:${normalize(variant.colour)}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function isRequestedProductOptionOutOfStock(product: ProductContext): boolean {
  return product.availableInMarket && product.variants.length > 0 && !product.matchedVariants.some((variant) => variant.available)
}

export function sameProductRecoveryOptions(
  product: ProductContext,
  extraction: Pick<MessageExtraction, 'size' | 'colour'>,
  settings: Pick<AiMessagingSettings, 'outOfStockAllowOtherColours' | 'outOfStockAllowOtherSizes'>,
): SameProductRecoveryOption[] {
  const available = product.variants.filter((variant) => variant.available)
  const options: SameProductRecoveryOption[] = []

  if (settings.outOfStockAllowOtherColours && extraction.size) {
    options.push(...available
      .filter((variant) => sameNormalized(variant.size, extraction.size) && !sameNormalized(variant.colour, extraction.colour))
      .map((variant) => ({ ...variant, kind: 'same_size_other_colour' as const })))
  }
  if (settings.outOfStockAllowOtherSizes && extraction.colour) {
    options.push(...available
      .filter((variant) => sameNormalized(variant.colour, extraction.colour) && !sameNormalized(variant.size, extraction.size))
      .map((variant) => ({ ...variant, kind: 'same_colour_other_size' as const })))
  }
  options.push(...available
    .filter((variant) => !extraction.size || sameNormalized(variant.size, extraction.size) || settings.outOfStockAllowOtherSizes)
    .filter((variant) => !extraction.colour || sameNormalized(variant.colour, extraction.colour) || settings.outOfStockAllowOtherColours)
    .map((variant) => ({ ...variant, kind: 'other_variant' as const })))
  return dedupeVariants(options).slice(0, 8)
}

export function rankOutOfStockRecommendations(
  requested: ProductContext,
  candidates: ProductContext[],
  settings: Pick<AiMessagingSettings,
    'outOfStockMaxAlternatives' | 'outOfStockPriceTolerancePercent' | 'outOfStockCategoryWeight' | 'outOfStockTagWeight'>,
): RankedProductRecommendation[] {
  const requestedTags = new Set(requested.tagIds)
  return candidates
    .filter((candidate) => String(candidate.productId) !== String(requested.productId))
    .filter((candidate) => candidate.availableInMarket && candidate.variants.some((variant) => variant.available))
    .map((candidate): RankedProductRecommendation | null => {
      const sameCategory = Boolean(requested.categoryId && candidate.categoryId === requested.categoryId)
      const sharedTagCount = candidate.tagIds.filter((id) => requestedTags.has(id)).length
      if (!sameCategory && sharedTagCount === 0) return null

      const priceDifferencePercent = requested.price != null && requested.price > 0 && candidate.price != null
        ? Math.abs(candidate.price - requested.price) / requested.price * 100
        : null
      if (priceDifferencePercent != null && priceDifferencePercent > settings.outOfStockPriceTolerancePercent) return null

      const reasons: ProductRecommendationReason[] = []
      let score = 0
      if (sameCategory) {
        reasons.push('same_category')
        score += settings.outOfStockCategoryWeight
      }
      if (sharedTagCount > 0) {
        reasons.push('shared_merchandising_tag')
        score += settings.outOfStockTagWeight * Math.min(sharedTagCount, 2)
      }
      if (priceDifferencePercent != null) {
        const range = Math.max(1, settings.outOfStockPriceTolerancePercent)
        score += Math.max(0, 20 * (1 - priceDifferencePercent / range))
      }
      score += Math.min(10, candidate.variants.reduce((sum, variant) => sum + (variant.available ? variant.stock : 0), 0))
      return { product: candidate, score, reasons, sharedTagCount, priceDifferencePercent }
    })
    .filter((candidate): candidate is RankedProductRecommendation => Boolean(candidate))
    .sort((left, right) => right.score - left.score
      || (left.priceDifferencePercent ?? Number.MAX_SAFE_INTEGER) - (right.priceDifferencePercent ?? Number.MAX_SAFE_INTEGER)
      || left.product.name.localeCompare(right.product.name))
    .slice(0, settings.outOfStockMaxAlternatives)
}

export async function retrieveOutOfStockRecovery(
  client: CatalogueClient,
  requested: ProductContext,
  extraction: MessageExtraction,
  settings: Pick<AiMessagingSettings,
    'outOfStockRecoveryEnabled' | 'outOfStockAllowOtherColours' | 'outOfStockAllowOtherSizes'
    | 'outOfStockMaxAlternatives' | 'outOfStockPriceTolerancePercent' | 'outOfStockCategoryWeight' | 'outOfStockTagWeight'>,
  options: { now?: Date } = {},
): Promise<OutOfStockRecovery | null> {
  if (!settings.outOfStockRecoveryEnabled || !isRequestedProductOptionOutOfStock(requested)) return null
  const sameProductOptions = sameProductRecoveryOptions(requested, extraction, settings)
  const relatedSignals: Record<string, unknown>[] = []
  if (requested.categoryId) relatedSignals.push({ category: { equals: requested.categoryId } })
  if (requested.tagIds.length) relatedSignals.push({ tag: { in: requested.tagIds } })
  if (!relatedSignals.length) return { sameProductOptions, recommendations: [] }

  const marketField = requested.market === 'AO' ? 'availableAO' : 'availablePT'
  const result = await client.find({
    collection: 'products',
    where: { and: [
      { active: { equals: true } },
      { [marketField]: { equals: true } },
      { or: relatedSignals },
    ] },
    depth: 2,
    limit: 50,
    overrideAccess: true,
  })
  const candidates = result.docs.map((product) => toProductContext(product, extraction, requested.market, options.now))
  return { sameProductOptions, recommendations: rankOutOfStockRecommendations(requested, candidates, settings) }
}
