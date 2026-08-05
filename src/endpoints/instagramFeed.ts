import type { Endpoint } from 'payload'
import {
  applyHighlight,
  buildInstagramMediaRequest,
  cleanCaptionForDisplay,
  isInstagramFeedConfigured,
  mapGraphMediaToPosts,
  type GraphMediaItem,
  type HighlightedInstagramPost,
  type InstagramPost,
} from '../lib/instagramFeed'

const MAX_LIMIT = 12
const DEFAULT_LIMIT = 6
// Instagram content doesn't change minute to minute, and the Graph API is
// rate-limited per app -- cache across requests so a busy storefront homepage
// doesn't hit Meta on every visitor. Cache lives in process memory, which is
// fine here since the CMS runs as a long-lived Railway service, not
// per-request serverless functions. This caches the raw recent-posts POOL
// only -- the highlight pick (see below) is re-applied on every request,
// uncached, so an admin changing it shows up immediately without waiting
// out the 15-minute TTL.
const CACHE_TTL_MS = 15 * 60 * 1000
let cache: { posts: InstagramPost[]; fetchedAt: number } | null = null

async function fetchFromGraphApi(limit: number): Promise<InstagramPost[]> {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN
  const igId = process.env.INSTAGRAM_PAGE_ID
  const request = buildInstagramMediaRequest(igId ?? '', token ?? '', limit)
  const res = await fetch(request.url, request.init)
  if (!res.ok) {
    throw new Error(`Instagram Graph API responded ${res.status}: ${await res.text()}`)
  }
  const data = (await res.json()) as { data?: GraphMediaItem[] }
  return mapGraphMediaToPosts(data.data ?? [])
}

async function fetchHighlightedPermalink(reqPayload: any): Promise<string | null> {
  try {
    const global = await reqPayload.findGlobal({ slug: 'instagram-spotlight' })
    const value = global?.highlightedPermalink
    return typeof value === 'string' && value.trim() ? value : null
  } catch (err) {
    // A missing/misconfigured global shouldn't take down the whole feed --
    // just means nothing gets highlighted this request.
    reqPayload.logger.error(
      { err: err instanceof Error ? err.message : String(err) },
      '[instagram:spotlight-fetch-failed]',
    )
    return null
  }
}

// Shapes a pool post into the wire format the storefront consumes.
// `captionDisplay` is always server-computed (hashtags/newlines stripped,
// truncated) from the real Instagram caption -- "give each tile a reason to
// exist beyond a photo" applies to every post, not just a highlighted one.
function toApiPost(post: HighlightedInstagramPost) {
  return {
    id: post.id,
    imageUrl: post.imageUrl,
    permalink: post.permalink,
    caption: post.caption,
    captionDisplay: cleanCaptionForDisplay(post.caption),
    size: post.size,
  }
}

export const instagramFeedEndpoints: Endpoint[] = [
  {
    path: '/instagram-feed',
    method: 'get',
    handler: async (req) => {
      const url = new URL(req.url ?? '', 'http://localhost')
      const limitParam = Number(url.searchParams.get('limit'))
      const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(Math.floor(limitParam), MAX_LIMIT) : DEFAULT_LIMIT

      // Not configured yet -- tell the storefront so it can fall back to
      // the static placeholder grid, same "log instead of throw when
      // unconfigured" pattern used elsewhere (see lib/messaging.ts,
      // lib/payments/appypay.ts).
      if (!isInstagramFeedConfigured()) {
        return Response.json({ configured: false, posts: [] })
      }

      const now = Date.now()
      let pool: InstagramPost[] | null = cache && now - cache.fetchedAt < CACHE_TTL_MS ? cache.posts : null

      if (!pool) {
        try {
          pool = await fetchFromGraphApi(MAX_LIMIT)
          cache = { posts: pool, fetchedAt: now }
        } catch (err) {
          req.payload.logger.error(
            { err: err instanceof Error ? err.message : String(err) },
            '[instagram:feed-fetch-failed]',
          )
          // Serve a stale cache over an empty grid if we have one; otherwise
          // let the storefront fall back to placeholders for this request.
          pool = cache?.posts ?? null
          if (!pool) return Response.json({ configured: true, posts: [] })
        }
      }

      const highlightedPermalink = await fetchHighlightedPermalink(req.payload)
      const posts = applyHighlight(pool, highlightedPermalink)
        .slice(0, limit)
        .map(toApiPost)
      return Response.json({ configured: true, posts })
    },
  },
]
