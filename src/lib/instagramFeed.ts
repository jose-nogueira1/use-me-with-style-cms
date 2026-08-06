// Pure mapping/config logic for the public storefront "Instagram feed"
// section, kept separate from the endpoint (src/endpoints/instagramFeed.ts)
// so it can be unit tested without hitting the network -- same split as
// lib/inventoryRules.ts / endpoints/inventoryReservations.ts.
//
// Reuses INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_PAGE_ID, the Instagram Login
// credentials already documented in .env.example for DM messaging (JOS-58).
// Both features call graph.instagram.com with bearer authorization.

import { effectiveUnitPrice } from './salePricing'

export type GraphMediaItem = {
  id: string
  caption?: string
  media_type?: 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM' | string
  media_url?: string
  thumbnail_url?: string
  permalink: string
  timestamp?: string
}

export type InstagramPost = {
  id: string
  imageUrl: string
  permalink: string
  caption: string
}

export type ShopTheLookProduct = {
  id: string
  slug: string
  name: string
  namePT: string
  nameEN: string
  imageUrl: string | null
  price: number
  regularPrice: number
  currency: 'AOA' | 'EUR'
  onSale: boolean
  inStock: boolean
  availableSizes: string[]
  selectedColorId: string | null
  selectedColorNamePT: string | null
  selectedColorNameEN: string | null
}

export type InstagramProductTagEntry = {
  mediaId?: string | null
  permalink?: string | null
  products?: unknown[] | null
  variantSelections?: unknown
}

type CatalogueProduct = {
  id?: string | number
  slug?: string | null
  name?: string | null
  namePT?: string | null
  nameEN?: string | null
  active?: boolean | null
  productType?: 'standard' | 'bundle' | null
  availableAO?: boolean | null
  availablePT?: boolean | null
  priceAOKz?: number | null
  pricePTEur?: number | null
  saleAOKz?: number | null
  salePTEur?: number | null
  saleStartDate?: string | null
  saleEndDate?: string | null
  images?: Array<{ image?: unknown }> | null
  variants?: Array<{
    id?: string | null
    color?: unknown
    size?: string | null
    optionValueEN?: string | null
    stockAO?: number | null
    stockPT?: number | null
  }> | null
  bundleComponents?: Array<{
    product?: CatalogueProduct | string | number | null
    variantId?: string | null
    qty?: number | null
  }> | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function relationshipId(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (isRecord(value) && (typeof value.id === 'string' || typeof value.id === 'number')) return String(value.id)
  return ''
}

function relationshipDoc(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null
}

function selectedColours(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string | number] => typeof entry[1] === 'string' || typeof entry[1] === 'number')
      .map(([productId, colourId]) => [String(productId), String(colourId)]),
  )
}

function productImageUrl(product: CatalogueProduct): string | null {
  const image = relationshipDoc(product.images?.[0]?.image)
  return typeof image?.url === 'string' && image.url ? image.url : null
}

function colourNames(value: unknown): { pt: string | null; en: string | null } {
  const colour = relationshipDoc(value)
  if (!colour) return { pt: null, en: null }
  const pt = typeof colour.namePT === 'string' && colour.namePT.trim() ? colour.namePT.trim() : null
  const en = typeof colour.nameEN === 'string' && colour.nameEN.trim() ? colour.nameEN.trim() : pt
  return { pt, en }
}

function bundleStock(product: CatalogueProduct, market: 'AO' | 'PT'): number {
  const stockField = market === 'AO' ? 'stockAO' : 'stockPT'
  const componentStocks = (product.bundleComponents ?? []).map((component) => {
    const componentProduct = relationshipDoc(component.product) as CatalogueProduct | null
    const variant = componentProduct?.variants?.find((row) => String(row.id ?? '') === String(component.variantId ?? ''))
    return Math.floor(Number(variant?.[stockField] ?? 0) / Math.max(1, Number(component.qty ?? 1)))
  })
  return componentStocks.length > 0 ? Math.min(...componentStocks) : 0
}

/** Stable, human-shareable identifier used by /shop-instagram/:lookSlug. */
export function instagramLookSlug(permalink: string): string {
  try {
    const parsed = new URL(/^https?:\/\//i.test(permalink) ? permalink : `https://${permalink}`)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return parts.at(-1) || ''
  } catch {
    return ''
  }
}

/** Indexes associations by stable media ID and normalized permalink so
 * entries saved before media IDs were introduced keep working. */
export function indexInstagramProductTags(entries: InstagramProductTagEntry[] = []): Map<string, InstagramProductTagEntry> {
  const index = new Map<string, InstagramProductTagEntry>()
  for (const entry of entries) {
    const mediaId = typeof entry.mediaId === 'string' ? entry.mediaId.trim() : ''
    const permalink = typeof entry.permalink === 'string' ? entry.permalink.trim() : ''
    if (mediaId) index.set(`id:${mediaId}`, entry)
    if (permalink) index.set(`url:${normalizePermalink(permalink)}`, entry)
  }
  return index
}

export function findInstagramProductTag(
  index: Map<string, InstagramProductTagEntry>,
  post: Pick<InstagramPost, 'id' | 'permalink'>,
): InstagramProductTagEntry | null {
  return index.get(`id:${post.id}`) ?? index.get(`url:${normalizePermalink(post.permalink)}`) ?? null
}

/** Resolves only current catalogue facts. The association stores references,
 * never copied prices/stock, so every request reflects the selected market. */
export function resolveShopTheLookProducts(
  entry: InstagramProductTagEntry | null,
  market: 'AO' | 'PT',
): ShopTheLookProduct[] {
  if (!entry) return []
  const variantsByProduct = selectedColours(entry.variantSelections)
  const result: ShopTheLookProduct[] = []

  for (const value of entry.products ?? []) {
    if (!isRecord(value)) continue
    const product = value as CatalogueProduct
    const id = relationshipId(product)
    const slug = typeof product.slug === 'string' ? product.slug.trim() : ''
    if (!id || !slug || product.active === false) continue
    if (market === 'AO' ? product.availableAO === false : product.availablePT === false) continue

    const selectedColorId = variantsByProduct[id] || null
    const relevantVariants = (product.variants ?? []).filter((variant) =>
      !selectedColorId || relationshipId(variant.color) === selectedColorId,
    )
    const stockField = market === 'AO' ? 'stockAO' : 'stockPT'
    const inStockVariants = relevantVariants.filter((variant) => Number(variant[stockField] ?? 0) > 0)
    const availableSizes = [...new Set(inStockVariants
      .map((variant) => variant.size?.trim() || variant.optionValueEN?.trim() || '')
      .filter(Boolean))]
    const selectedVariant = selectedColorId
      ? (product.variants ?? []).find((variant) => relationshipId(variant.color) === selectedColorId)
      : null
    const names = colourNames(selectedVariant?.color)
    const regularPrice = market === 'AO' ? Number(product.priceAOKz ?? 0) : Number(product.pricePTEur ?? 0)
    const price = effectiveUnitPrice({
      priceAOKz: Number(product.priceAOKz ?? 0),
      pricePTEur: Number(product.pricePTEur ?? 0),
      saleAOKz: product.saleAOKz,
      salePTEur: product.salePTEur,
      saleStartDate: product.saleStartDate,
      saleEndDate: product.saleEndDate,
    }, market)
    const namePT = (typeof product.namePT === 'string' && product.namePT.trim()) || (typeof product.name === 'string' ? product.name : '')
    const nameEN = (typeof product.nameEN === 'string' && product.nameEN.trim()) || namePT

    result.push({
      id,
      slug,
      name: namePT || nameEN,
      namePT,
      nameEN,
      imageUrl: productImageUrl(product),
      price,
      regularPrice,
      currency: market === 'AO' ? 'AOA' : 'EUR',
      onSale: price < regularPrice,
      // A colour-only or option-less accessory has no display option but is
      // still sellable. Fixed kits derive availability from every component
      // variant instead of maintaining duplicate stock on the kit itself.
      inStock: product.productType === 'bundle' ? bundleStock(product, market) > 0 : inStockVariants.length > 0,
      availableSizes,
      selectedColorId,
      selectedColorNamePT: names.pt,
      selectedColorNameEN: names.en,
    })
  }

  return result.slice(0, 4)
}

// Highlighting (2026-08-02, simplified from an earlier ordered/labelled
// curation list -- see globals/InstagramSpotlight.ts's comment for why:
// Jay-P found the array-of-entries version overkill and confusing. Now
// there's exactly one admin choice: which of the recent posts, if any, gets
// the large tile. Everything else about the feed -- which posts appear, in
// what order, what caption shows -- is automatic (latest N, real caption).
export type HighlightedInstagramPost = InstagramPost & {
  size: 'regular' | 'large'
}

export function isInstagramFeedConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return Boolean(env.INSTAGRAM_ACCESS_TOKEN && env.INSTAGRAM_PAGE_ID)
}

/**
 * Maps raw Graph API `/media` items to the shape the storefront needs.
 * - VIDEO and CAROUSEL_ALBUM items only expose a still image via
 *   `thumbnail_url`; a VIDEO's `media_url` points at the video file itself,
 *   which an <img> tag can't render, so it's used only as a last resort.
 * - Items with no renderable image at all (shouldn't normally happen) are
 *   dropped rather than shown broken.
 */
export function mapGraphMediaToPosts(items: GraphMediaItem[]): InstagramPost[] {
  return items
    .map((item) => {
      const imageUrl = item.media_type === 'VIDEO'
        ? item.thumbnail_url || item.media_url || ''
        : item.media_url || item.thumbnail_url || '';
      return {
        id: item.id,
        imageUrl,
        permalink: item.permalink,
        caption: (item.caption ?? '').trim(),
      };
    })
    .filter((post): post is InstagramPost => Boolean(post.imageUrl && post.permalink));
}

export const INSTAGRAM_GRAPH_FIELDS = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp'
export const INSTAGRAM_GRAPH_VERSION = 'v26.0'

export function buildInstagramMediaRequest(igId: string, token: string, limit: number) {
  const params = new URLSearchParams({
    fields: INSTAGRAM_GRAPH_FIELDS,
    limit: String(limit),
  })
  return {
    url: `https://graph.instagram.com/${INSTAGRAM_GRAPH_VERSION}/${encodeURIComponent(igId)}/media?${params}`,
    init: { headers: { Authorization: `Bearer ${token}` } },
  }
}

/**
 * Reduces an Instagram permalink to just its path, ignoring scheme, host,
 * query string, and a trailing slash -- so
 * "https://www.instagram.com/p/AbCdEfG/?igsh=xyz" and
 * "instagram.com/p/AbCdEfG" (an admin typing/pasting either form) both
 * match the same post. Falls back to a lowercased trim of the raw string if
 * it isn't a parseable URL at all, rather than throwing.
 */
export function normalizePermalink(url: string): string {
  const trimmed = url.trim()
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
    const parsed = new URL(withScheme)
    return parsed.pathname.replace(/\/+$/, '').toLowerCase()
  } catch {
    return trimmed.replace(/\/+$/, '').toLowerCase()
  }
}

/**
 * Fallback tile caption when an admin hasn't set a curated label: strips
 * hashtags and emoji-adjacent line breaks out of the raw Instagram caption
 * (real captions look like "Elegância, confiança...\n\n#usemewithstyle
 * #newcollection" -- the hashtag block is noise on a small tile) and
 * truncates to a length that reads as a caption, not a paragraph.
 */
export function cleanCaptionForDisplay(caption: string, maxLength = 70): string {
  const withoutHashtags = caption
    .split('\n')
    .filter((line) => !/^\s*#/.test(line))
    .join(' ')
    .replace(/#\S+/g, '')
  const collapsed = withoutHashtags.replace(/\s+/g, ' ').trim()
  if (collapsed.length <= maxLength) return collapsed
  return `${collapsed.slice(0, maxLength).trimEnd()}…`
}

/**
 * Marks every post in the pool 'regular', except the one matching
 * `highlightedPermalink` (if any), which gets 'large'. Order and membership
 * are otherwise untouched -- still the plain latest-N pool, just with at
 * most one tile called out as bigger. A highlighted permalink that no
 * longer matches anything in the pool (aged out of the last ~12) simply
 * results in nothing being marked large, rather than an error -- same
 * "degrade gracefully" spirit as the rest of this module.
 */
export function applyHighlight(pool: InstagramPost[], highlightedPermalink?: string | null): HighlightedInstagramPost[] {
  const target = highlightedPermalink?.trim() ? normalizePermalink(highlightedPermalink) : null
  return pool.map((post) => ({
    ...post,
    size: target && normalizePermalink(post.permalink) === target ? 'large' : 'regular',
  }))
}
