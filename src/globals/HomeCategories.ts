import type { GlobalConfig } from 'payload'

// Which categories appear in the homepage category row, and in what order
// (2026-08-04, admin request: "how does the admin choose which categories
// are present in the homepage... admin should have total control here").
// Previously this row showed EVERY category automatically with no admin
// control at all.
//
// Split out of the combined `home-content` global on the same day (admin
// feedback: wants Hero/Categories/Collections to each save and version
// independently -- see HomeHero.ts's header comment for the full
// reasoning). This global owns ONLY the category row and gets its own
// independent version history.
//
// Optional and empty by default: Home.tsx (platform) falls back to
// exactly the previous behaviour (show every category) until an admin
// actually fills this in.
export const HomeCategories: GlobalConfig = {
  slug: 'home-categories',
  label: 'Home Page — Categories',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Settings',
    description: 'Which categories appear on the storefront home page, and in what order.',
  },
  versions: {
    max: 20,
  },
  fields: [
    {
      name: 'homepageCategorySlugs',
      type: 'array',
      label: 'Homepage categories',
      admin: {
        description:
          'Which categories appear in the homepage category row, and in what order. Leave empty to show every category (today\'s behaviour).',
      },
      fields: [
        {
          name: 'slug',
          type: 'text',
          required: true,
          label: 'Category',
          admin: { description: 'Picked from the real category list in Settings -- see Settings.tsx.' },
        },
      ],
    },
  ],
}
