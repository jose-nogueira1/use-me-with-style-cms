import assert from 'node:assert/strict'
import test from 'node:test'

import { robotsEndpoint, sitemapEndpoint } from '../src/endpoints/seoFiles'
import { buildRobotsTxt, buildSitemapXml } from '../src/lib/seoFiles'

test('builds standards-compliant, escaped market sitemap XML', () => {
  const xml = buildSitemapXml('AO', [
    { path: '/' },
    { path: '/catalogo?cat=fitness&sort=new', updatedAt: '2026-08-10T12:00:00+01:00' },
    { path: '/produto/invalid-date', updatedAt: 'not-a-date' },
    { path: '/', updatedAt: '2020-01-01' },
  ])

  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/)
  assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/)
  assert.match(xml, /https:\/\/ao\.usemewithstyle\.shop\/catalogo\?cat=fitness&amp;sort=new/)
  assert.match(xml, /<lastmod>2026-08-10T11:00:00\.000Z<\/lastmod>/)
  assert.doesNotMatch(xml, /not-a-date/)
  assert.equal((xml.match(/<loc>https:\/\/ao\.usemewithstyle\.shop\/<\/loc>/g) ?? []).length, 1)
})

test('builds market-specific robots.txt', () => {
  assert.equal(buildRobotsTxt('PT'), [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin/',
    'Sitemap: https://pt.usemewithstyle.shop/sitemap.xml',
    '',
  ].join('\n'))
})

test('sitemap endpoint includes only active market products and their admin-created categories', async () => {
  const calls: Array<Record<string, unknown>> = []
  const payload = {
    find: async (args: Record<string, unknown>) => {
      calls.push(args)
      if (args.collection === 'products') {
        return {
          docs: [
            { id: 1, slug: 'legging-azul', category: 10, updatedAt: '2026-08-09T10:00:00Z' },
            { id: 2, slug: 'top-verde', category: 11, updatedAt: '2026-08-08T10:00:00Z' },
          ],
          totalPages: 1,
        }
      }
      return {
        docs: [
          { id: 10, slug: 'leggings', updatedAt: '2026-08-07T10:00:00Z' },
          { id: 11, slug: 'tops', updatedAt: '2026-08-06T10:00:00Z' },
          { id: 12, slug: 'categoria-vazia', updatedAt: '2026-08-05T10:00:00Z' },
        ],
        totalPages: 1,
      }
    },
  }

  const response = await sitemapEndpoint.handler({
    url: 'https://cms.example/api/sitemap.xml?market=AO',
    payload,
  } as never)
  const xml = await response.text()

  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /^application\/xml/)
  assert.match(response.headers.get('cache-control') ?? '', /s-maxage=900/)
  assert.match(xml, /https:\/\/ao\.usemewithstyle\.shop\/produto\/legging-azul/)
  assert.match(xml, /https:\/\/ao\.usemewithstyle\.shop\/catalogo\?cat=leggings/)
  assert.match(xml, /https:\/\/ao\.usemewithstyle\.shop\/catalogo\?cat=tops/)
  assert.doesNotMatch(xml, /categoria-vazia/)
  assert.doesNotMatch(xml, /pt\.usemewithstyle\.shop/)
  assert.deepEqual(calls[0].where, { and: [{ active: { equals: true } }, { availableAO: { equals: true } }] })
})

test('SEO endpoints reject a missing or unknown market', async () => {
  const request = { url: 'https://cms.example/api/sitemap.xml', payload: { find: async () => assert.fail('must not query') } } as never
  assert.equal((await sitemapEndpoint.handler(request)).status, 400)
  assert.equal((await robotsEndpoint.handler(request)).status, 400)
})
