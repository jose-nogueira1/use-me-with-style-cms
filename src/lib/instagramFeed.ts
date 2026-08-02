// Pure mapping/config logic for the public storefront "Instagram feed"
// section, kept separate from the endpoint (src/endpoints/instagramFeed.ts)
// so it can be unit tested without hitting the network -- same split as
// lib/inventoryRules.ts / endpoints/inventoryReservations.ts.
//
// Reuses INSTAGRAM_ACCESS_TOKEN / INSTAGRAM_PAGE_ID, the same credentials
// already documented in .env.example for Instagram DM messaging (JOS-58).
// Both features call the Meta Graph API against the same Instagram Business
// Account node -- messaging POSTs to `/{ig-id}/messages`, this reads public
// posts from `/{ig-id}/media` -- so no new credentials are needed once
// Instagram messaging is configured.

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

// Curation (2026-08-02, "curate instead of latest N" -- see
// globals/InstagramSpotlight.ts). An admin-configured entry: which recent
// post to feature, an optional bilingual override for the caption shown on
// the tile, and whether it should render as a "large" tile to break up the
// otherwise-uniform row.
export type SpotlightEntry = {
  permalink: string
  labelPT?: string | null
  labelEN?: string | null
  size?: 'regular' | 'large' | null
}

export type CuratedInstagramPost = InstagramPost & {
  labelPT?: string
  labelEN?: string
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
export const INSTAGRAM_GRAPH_VERSION = 'v21.0'

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
 * Matches curated entries against the pool of recently-fetched posts (see
 * the module comment on globals/InstagramSpotlight.ts for why curation is
 * scoped to that recent pool rather than arbitrary historical posts).
 * Entries with no match in the pool -- most likely because the post has
 * aged out of the last ~12 -- are silently skipped rather than shown
 * broken. Order follows the entries list, not the pool's chronological
 * order, since the whole point is admin-controlled ordering.
 */
export function applySpotlightCuration(pool: InstagramPost[], entries: SpotlightEntry[]): CuratedInstagramPost[] {
  const byPermalink = new Map(pool.map((post) => [normalizePermalink(post.permalink), post]))
  const curated: CuratedInstagramPost[] = []
  for (const entry of entries) {
    const match = byPermalink.get(normalizePermalink(entry.permalink))
    if (!match) continue
    curated.push({
      ...match,
      labelPT: entry.labelPT?.trim() || undefined,
      labelEN: entry.labelEN?.trim() || undefined,
      size: entry.size === 'large' ? 'large' : 'regular',
    })
  }
  return curated
}
