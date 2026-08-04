import type { GlobalConfig } from 'payload'

// Generalises "New Arrivals" + "Featured" into any number of admin-defined,
// tag-driven shelves (2026-08-04 follow-up: "think about me having a new
// collection, lets say summer ss26, I should be able to feature it with the
// tag SS26, like we have featured and new arrivals now"). Each row is one
// shelf: pick a real merch tag, give it a bilingual title, cap how many
// products show. Order in this array is the order shelves render on the
// homepage.
//
// Split out of the combined `home-content` global the same day (admin
// feedback: wants Hero/Categories/Collections to each save and version
// independently -- see HomeHero.ts's header comment for the full
// reasoning). This global owns ONLY the collection shelves and gets its
// own independent version history.
//
// Optional and empty by default: Home.tsx (platform) falls back to the
// previous fixed New Arrivals / Featured sections until an admin actually
// fills this in.
export const HomeCollections: GlobalConfig = {
  slug: 'home-collections',
  label: 'Home Page — Collections',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description: 'Tag-driven product shelves shown on the storefront home page.',
  },
  versions: {
    max: 20,
  },
  fields: [
    {
      name: 'collections',
      type: 'array',
      label: 'Homepage collections (tag-driven shelves)',
      admin: {
        description:
          'Each row is one product shelf on the homepage, driven by a merchandising tag (e.g. "New", "Bestseller", "SS26"). Leave empty to keep the previous fixed New Arrivals / Featured sections.',
      },
      fields: [
        {
          name: 'tagSlug',
          type: 'text',
          required: true,
          label: 'Merchandising tag',
          admin: { description: 'Picked from the real merch tag list in Settings.' },
        },
        { name: 'titlePT', type: 'text', required: true, label: 'Title -- Portuguese' },
        { name: 'titleEN', type: 'text', required: true, label: 'Title -- English' },
        {
          name: 'itemLimit',
          type: 'number',
          min: 1,
          max: 24,
          defaultValue: 8,
          label: 'Item limit',
          admin: { description: 'Maximum products shown in this shelf.' },
        },
      ],
    },
  ],
}
