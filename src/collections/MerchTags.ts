import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { slugify } from '../lib/productSlug'
import { blockDeleteWhileInUse } from '../lib/taxonomyGuards'

// Merchandising badges ("Novidade", "Bestseller", ...) as data instead of a
// hardcoded select (2026-07-25 admin request, same change as Categories).
// The previous enum values are seeded by the
// 20260725_150000_catalogue_taxonomies migration.
//
// slug (2026-07-25 follow-up, "collections" via the hero button): same
// auto-generated-on-create, immutable-after policy as Categories.slug, so
// a tag can be used as a stable ?tag= target (e.g. a "SS26" tag for the
// home hero button to link to) without the storefront URL breaking if the
// label is edited later.
const generateMerchTagSlug: CollectionBeforeValidateHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  if (operation === 'update' && originalDoc?.slug) {
    data.slug = originalDoc.slug
    return data
  }

  const base = slugify(data.labelPT || 'tag') || 'tag'
  let candidate = base
  let suffix = 2
  while (
    await req.payload
      .find({ collection: 'merch-tags', where: { slug: { equals: candidate } }, limit: 1, depth: 0 })
      .then((result) => result.docs.length > 0)
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  data.slug = candidate
  return data
}

export const MerchTags: CollectionConfig = {
  slug: 'merch-tags',
  labels: { singular: 'Merchandising tag', plural: 'Merchandising tags' },
  admin: {
    useAsTitle: 'labelPT',
    defaultColumns: ['labelPT', 'labelEN', 'slug'],
    group: 'Catalogue',
  },
  access: {
    // Storefront renders the badge on product cards; public read, admin write.
    read: () => true,
  },
  hooks: {
    beforeValidate: [generateMerchTagSlug],
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
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated from the Portuguese label; usable as a storefront "collection" link (/catalogo?tag=...). Not editable.',
      },
    },
  ],
}
