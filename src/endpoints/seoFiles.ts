import type { Endpoint, PayloadRequest, Where } from 'payload'
import { buildRobotsTxt, buildSitemapXml, STATIC_SITEMAP_PATHS, type SeoMarket, type SitemapEntry } from '../lib/seoFiles'

const CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=0, s-maxage=900, stale-while-revalidate=3600',
}

function requestedMarket(req: PayloadRequest): SeoMarket | null {
  const value = new URL(req.url || 'http://localhost').searchParams.get('market')?.toUpperCase()
  return value === 'AO' || value === 'PT' ? value : null
}

function relationshipId(value: unknown): string | number | null {
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? id : null
  }
  return null
}

async function findEveryPage(req: PayloadRequest, collection: 'products' | 'categories', where?: Where) {
  const docs: Record<string, unknown>[] = []
  let page = 1
  let totalPages: number
  do {
    const result = await req.payload.find({
      collection,
      where,
      limit: 100,
      page,
      depth: 0,
      overrideAccess: true,
      pagination: true,
    })
    docs.push(...(result.docs as unknown as Record<string, unknown>[]))
    totalPages = Number(result.totalPages) || 1
    page += 1
  } while (page <= totalPages)
  return docs
}

async function sitemapEntries(req: PayloadRequest, market: SeoMarket): Promise<SitemapEntry[]> {
  const availability = market === 'AO' ? 'availableAO' : 'availablePT'
  const products = await findEveryPage(req, 'products', {
    and: [
      { active: { equals: true } },
      { [availability]: { equals: true } },
    ],
  })

  const referencedCategoryIds = new Set(
    products.map((product) => relationshipId(product.category)).filter((id): id is string | number => id !== null).map(String),
  )
  const categories = referencedCategoryIds.size > 0 ? await findEveryPage(req, 'categories') : []

  const productEntries = products.flatMap((product): SitemapEntry[] => {
    const slug = typeof product.slug === 'string' ? product.slug.trim() : ''
    return slug ? [{ path: `/produto/${encodeURIComponent(slug)}`, updatedAt: typeof product.updatedAt === 'string' ? product.updatedAt : null }] : []
  })
  const categoryEntries = categories.flatMap((category): SitemapEntry[] => {
    if (!referencedCategoryIds.has(String(category.id))) return []
    const slug = typeof category.slug === 'string' ? category.slug.trim() : ''
    return slug ? [{ path: `/catalogo?cat=${encodeURIComponent(slug)}`, updatedAt: typeof category.updatedAt === 'string' ? category.updatedAt : null }] : []
  })

  return [
    ...STATIC_SITEMAP_PATHS.map((path) => ({ path })),
    ...categoryEntries,
    ...productEntries,
  ]
}

function invalidMarketResponse(): Response {
  return Response.json({ error: 'market must be AO or PT' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
}

export const sitemapEndpoint: Endpoint = {
  path: '/sitemap.xml',
  method: 'get',
  handler: async (req) => {
    const market = requestedMarket(req)
    if (!market) return invalidMarketResponse()
    return new Response(buildSitemapXml(market, await sitemapEntries(req, market)), {
      headers: { ...CACHE_HEADERS, 'Content-Type': 'application/xml; charset=utf-8' },
    })
  },
}

export const robotsEndpoint: Endpoint = {
  path: '/robots.txt',
  method: 'get',
  handler: async (req) => {
    const market = requestedMarket(req)
    if (!market) return invalidMarketResponse()
    return new Response(buildRobotsTxt(market), {
      headers: { ...CACHE_HEADERS, 'Content-Type': 'text/plain; charset=utf-8' },
    })
  },
}
