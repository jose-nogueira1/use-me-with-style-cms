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
