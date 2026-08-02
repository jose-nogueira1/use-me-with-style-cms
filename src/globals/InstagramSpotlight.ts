import type { GlobalConfig } from 'payload'

// Homepage "Instagram feed" curation (2026-08-02, Jay-P: "curate instead of
// latest N" -- the section previously always showed whatever 6-10 posts
// were most recent on @use_me_withstyle, no editorial control at all).
//
// Deliberately scoped to curating from the RECENT pool the endpoint already
// fetches (up to 12 posts via the Graph API), not arbitrary historical
// posts -- resolving an arbitrary Instagram permalink to its media object
// would need its own Graph API lookup call per entry, which is a bigger,
// separately-justified piece of work. In practice this means: to feature a
// post here, it needs to still be one of Raisa's ~12 most recent Instagram
// posts. Entries for posts that have since aged out of that window are
// simply skipped by the endpoint (see lib/instagramFeed.ts) rather than
// erroring, so an admin can build this list ahead of time without it
// breaking when an old entry rolls off.
//
// When this list has at least one entry that matches a currently-recent
// post, the storefront shows ONLY the curated entries, in this order --
// otherwise it falls back to the original "latest N" behaviour exactly as
// before, so an empty list is a safe, valid state (nothing to configure
// yet, or intentionally showing the raw recent feed).
export const InstagramSpotlight: GlobalConfig = {
  slug: 'instagram-spotlight',
  label: 'Instagram Feed (Homepage)',
  access: {
    // The storefront needs this to render the homepage section; anyone can
    // read it, same as every other storefront-content global.
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description:
      'Curate which Instagram posts show in the homepage "Instagram feed" section, and in what order. Paste the post URL from Instagram (e.g. https://www.instagram.com/p/AbCdEfG/) -- it must still be one of the ~12 most recent posts on @use_me_withstyle. Leave empty to show the latest posts automatically, as before.',
  },
  fields: [
    {
      name: 'entries',
      type: 'array',
      label: 'Featured posts',
      labels: { singular: 'Featured post', plural: 'Featured posts' },
      admin: { description: 'Drag to reorder -- this is the order they appear in on the homepage.' },
      fields: [
        {
          name: 'permalink',
          type: 'text',
          required: true,
          label: 'Instagram post URL',
          admin: { description: 'e.g. https://www.instagram.com/p/AbCdEfG/ -- copy this from the Instagram app or website.' },
        },
        {
          name: 'labelPT',
          type: 'text',
          label: 'Caption shown on the tile — Portuguese',
          admin: { description: 'Optional. A short line shown over the photo, e.g. "Conjunto Chocolate". Falls back to a shortened version of the real Instagram caption if left blank.' },
        },
        {
          name: 'labelEN',
          type: 'text',
          label: 'Caption shown on the tile — English',
        },
        {
          name: 'size',
          type: 'select',
          label: 'Tile size',
          defaultValue: 'regular',
          options: [
            { label: 'Regular', value: 'regular' },
            { label: 'Large (stands out from the row)', value: 'large' },
          ],
          admin: { description: 'Use "Large" sparingly -- a couple of standout tiles read as curated; too many and it’s just a bigger grid again.' },
        },
      ],
    },
  ],
}
