import type { Endpoint } from 'payload'
import {
  INSTAGRAM_GRAPH_FIELDS,
  INSTAGRAM_GRAPH_VERSION,
  isInstagramFeedConfigured,
  mapGraphMediaToPosts,
  type GraphMediaItem,
  type InstagramPost,
} from '../lib/instagramFeed'

const MAX_LIMIT = 12
const DEFAULT_LIMIT = 6
// Instagram content doesn't change minute to minute, and the Graph API is
// rate-limited per app -- cache across requests so a busy storefront homepage
// doesn't hit Meta on every visitor. Cache lives in process memory, which is
// fine here since the CMS runs as a long-lived Railway service, not
// per-request serverless functions.
const CACHE_TTL_MS = 15 * 60 * 1000
let cache: { posts: InstagramPost[]; fetchedAt: number } | null = null

async function fetchFromGraphApi(limit: number): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const igId = process.env.INSTAGRAM_PAGE_ID
  const url = `https://graph.facebook.com/${INSTAGRAM_GRAPH_VERSION}/${igId}/media?fields=${INSTAGRAM_GRAPH_FIELDS}&limit=${limit}&access_token=${encodeURIComponent(token ?? '')}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Instagram Graph API responded ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { data?: GraphMediaItem[] }
  return mapGraphMediaToPosts(data.data ?? [])
}

export const instagramFeedEndpoints: Endpoint[] = [
  {
    path: '/instagram-feed',
    method: 'get',
    handler: async (req) => {
      const url = new URL(req.url ?? '', 'http://localhost')
      const limitParam = Number(url.searchParams.get('limit'))
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT

      // Not configured yet (JOS-58 credentials pending) -- tell the
      // storefront so it can fall back to the static placeholder grid,
      // same "log instead of throw when unconfigured" pattern used
      // elsewhere (see lib/messaging.ts, lib/payments/appypay.ts).
      if (!isInstagramFeedConfigured()) {
        return Response.json({ configured: false, posts: [] })
      }

      const now = Date.now()
      if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
        return Response.json({ configured: true, posts: cache.posts.slice(0, limit) })
      }

      try {
        const posts = await fetchFromGraphApi(MAX_LIMIT)
        cache = { posts, fetchedAt: now }
        return Response.json({ configured: true, posts: posts.slice(0, limit) })
      } catch (err) {
        req.payload.logger.error(
          { err: err instanceof Error ? err.message : String(err) },
          '[instagram:feed-fetch-failed]',
        )
        // Serve a stale cache over an empty grid if we have one; otherwise
        // let the storefront fall back to placeholders for this request.
        if (cache) return Response.json({ configured: true, posts: cache.posts.slice(0, limit) })
        return Response.json({ configured: true, posts: [] })
      }
    },
  },
]
