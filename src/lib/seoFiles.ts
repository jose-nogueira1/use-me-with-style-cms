export type SeoMarket = 'AO' | 'PT'

export type SitemapEntry = {
  path: string
  updatedAt?: string | null
}

const STOREFRONT_ORIGINS: Record<SeoMarket, string> = {
  AO: 'https://ao.usemewithstyle.shop',
  PT: 'https://pt.usemewithstyle.shop',
}

export const STATIC_SITEMAP_PATHS = [
  '/',
  '/catalogo',
  '/ajuda',
  '/perguntas-frequentes',
  '/guia-de-tamanhos',
  '/sobre',
  '/estilo',
  '/shop-instagram',
  '/politica-privacidade',
  '/termos-condicoes',
  '/eliminacao-de-dados',
] as const

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function validLastModified(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function storefrontOrigin(market: SeoMarket): string {
  return STOREFRONT_ORIGINS[market]
}

export function buildSitemapXml(market: SeoMarket, entries: SitemapEntry[]): string {
  const origin = storefrontOrigin(market)
  const unique = new Map<string, SitemapEntry>()
  for (const entry of entries) {
    if (!entry.path.startsWith('/')) continue
    unique.set(entry.path, entry)
  }

  const urls = [...unique.values()].map((entry) => {
    const lastModified = validLastModified(entry.updatedAt)
    return [
      '  <url>',
      `    <loc>${escapeXml(`${origin}${entry.path}`)}</loc>`,
      ...(lastModified ? [`    <lastmod>${lastModified}</lastmod>`] : []),
      '  </url>',
    ].join('\n')
  })

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    '</urlset>',
    '',
  ].join('\n')
}

export function buildRobotsTxt(market: SeoMarket): string {
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    `Sitemap: ${storefrontOrigin(market)}/sitemap.xml`,
    '',
  ].join('\n')
}
