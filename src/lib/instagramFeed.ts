// Pure mapping/config logic for the public storefront "Instagram feed"
// section, kept separate from the endpoint (src/endpoints/instagramFeed.ts)
// so it can be unit tested without hitting the network -- same split as
// lib/inventoryRules.ts / endpoints/inventoryReservations.ts.
//
// Reuses INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_PAGE_ID, the Instagram Login
// credentials already documented in .env.example for DM messaging (JOS-58).
// Both features call graph.instagram.com with bearer authorization.

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
