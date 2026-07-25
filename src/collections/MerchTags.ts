import type { CollectionConfig } from 'payload'
import { blockDeleteWhileInUse } from '../lib/taxonomyGuards'

// Merchandising badges ("Novidade", "Bestseller", ...) as data instead of a
// hardcoded select (2026-07-25 admin request, same change as Categories).
// The previous enum values are seeded by the
// 20260725_150000_catalogue_taxonomies migration.
export const MerchTags: CollectionConfig = {
  slug: 'merch-tags',
  labels: { singular: 'Merchandising tag', plural: 'Merchandising tags' },
  admin: {
    useAsTitle: 'labelPT',
    defaultColumns: ['labelPT', 'labelEN'],
    group: 'Catalogue',
  },
  access: {
    // Storefront renders the badge on product cards; public read, admin write.
    read: () => true,
  },
  hooks: {
    beforeDelete: [blockDeleteWhileInUse('tag', 'merchandising tag')],
  },
  fields: [
    {
      name: 'labelPT',
      type: 'text',
      required: true,
      label: 'Label — Portuguese',
      admin: { description: 'Badge text shown on product cards, e.g. "Novidade".' },
    },
    {
      name: 'labelEN',
      type: 'text',
      label: 'Label — English',
      admin: { description: 'Shown on the English storefront. Falls back to the Portuguese label if empty.' },
    },
  ],
}
