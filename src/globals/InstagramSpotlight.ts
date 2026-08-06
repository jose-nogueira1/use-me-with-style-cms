import type { GlobalConfig } from 'payload'

// Homepage "Instagram feed" highlight (2026-08-02, simplified same day from
// an earlier ordered/labelled curation-list design -- Jay-P tried that
// version and called it overkill and confusing to manage for what's really
// a small ask: "just show the most recent 12 posts and allow me to choose
// the highlighted post"). Down to a single choice now: which one of the
// recent posts (if any) gets the large tile. Everything else about the
// section is automatic --
//   - which posts show: always the ~12 most recent, latest first
//   - the caption on each tile: always the real Instagram caption
//     (server-cleaned -- see lib/instagramFeed.ts's cleanCaptionForDisplay),
//     never an admin-authored override
//   - tile size: 'large' for the highlighted post, 'regular' for every
//     other one
//
// Managed day-to-day from the storefront admin's Settings > Instagram feed
// tab (a grid of the current 12 posts to click one to highlight), which
// stores the picked post's permalink here. Editing this field directly also
// works if needed -- paste the post's URL exactly as copied from Instagram.
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
      'Pick which of the ~12 most recent Instagram posts is shown as the large, highlighted tile in the homepage "Instagram feed" section. Leave empty to show all recent posts the same size. Managed from the storefront admin\'s Settings > Instagram feed tab.',
  },
  fields: [
    {
      name: 'highlightedPermalink',
      type: 'text',
      label: 'Highlighted post URL',
      admin: {
        description: 'e.g. https://www.instagram.com/p/AbCdEfG/ -- must still be one of the ~12 most recent posts, or nothing will be highlighted.',
      },
    },
    {
      name: 'productTags',
      type: 'array',
      label: 'Shop the look associations',
      admin: {
        description:
          'Products linked to individual Instagram posts. Managed from Storefront Admin > Settings > Instagram feed.',
      },
      fields: [
        {
          name: 'mediaId',
          type: 'text',
          label: 'Instagram media ID',
          admin: {
            description: 'Stable Instagram identifier. The permalink remains as a fallback when older entries have no media ID.',
          },
        },
        {
          name: 'permalink',
          type: 'text',
          required: true,
          label: 'Instagram post URL',
        },
        {
          name: 'products',
          type: 'relationship',
          relationTo: 'products',
          hasMany: true,
          maxRows: 4,
          label: 'Products in this look',
        },
        {
          name: 'variantSelections',
          type: 'json',
          label: 'Selected colours',
          admin: {
            hidden: true,
            description: 'Storefront-admin managed map of product ID to the colour visible in the Instagram post.',
          },
        },
      ],
    },
  ],
}
