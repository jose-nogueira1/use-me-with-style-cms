import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { slugify } from '../lib/productSlug'
import { blockDeleteWhileInUse } from '../lib/taxonomyGuards'

// Product categories as data instead of a hardcoded select (2026-07-25 admin
// request: "the admin needs to be able to create categories"). The previous
// enum values (vestidos/tops/leggings/conjuntos) are seeded by the
// 20260725_150000_catalogue_taxonomies migration, so existing products and
// storefront ?cat= links keep working unchanged.
//
// Same slug policy as Products: auto-generated from the Portuguese name on
// create, immutable afterwards (a renamed category keeps its slug so
// bookmarked /catalogo?cat=... URLs never break).
const generateCategorySlug: CollectionBeforeValidateHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  if (operation === 'update' && originalDoc?.slug) {
    data.slug = originalDoc.slug
    return data
  }

  const base = slugify(data.namePT || 'categoria') || 'categoria'
  let candidate = base
  let suffix = 2
  while (
    await req.payload
      .find({ collection: 'categories', where: { slug: { equals: candidate } }, limit: 1, depth: 0 })
      .then((result) => result.docs.length > 0)
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  data.slug = candidate
  return data
}

export const Categories: CollectionConfig = {
  slug: 'categories',
  admin: {
    useAsTitle: 'namePT',
    defaultColumns: ['namePT', 'nameEN', 'slug'],
    group: 'Catalogue',
  },
  access: {
    // Storefront reads categories publicly (Browse filter pills); only
    // logged-in admins can write -- same policy as Products.
    read: () => true,
  },
  hooks: {
    beforeValidate: [generateCategorySlug],
    beforeDelete: [blockDeleteWhileInUse('category', 'category')],
  },
  fields: [
    {
      name: 'namePT',
      type: 'text',
      required: true,
      label: 'Name — Portuguese',
    },
    {
      name: 'nameEN',
      type: 'text',
      label: 'Name — English',
      admin: { description: 'Shown when the shopper switches the storefront to English. Falls back to the Portuguese name if empty.' },
    },
    {
      name: 'introPT',
      type: 'textarea',
      label: 'Catalogue introduction — Portuguese',
      admin: {
        description: 'Shown below the category filters when this is the only active category. Keep it concise and useful to shoppers.',
      },
    },
    {
      name: 'introEN',
      type: 'textarea',
      label: 'Catalogue introduction — English',
      admin: {
        description: 'English version of the catalogue introduction. Falls back to Portuguese if empty.',
      },
    },
    {
      name: 'slug',
      type: 'text',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated from the Portuguese name; used in storefront URLs (/catalogo?cat=...). Not editable.',
      },
    },
    {
      // 2026-07-25 admin request: category tiles on the home page were a
      // decorative placeholder with no way to change them. Optional --
      // falls back to the placeholder when unset, so nothing breaks for
      // existing categories until the admin uploads a real photo.
      name: 'image',
      type: 'upload',
      relationTo: 'media',
      label: 'Category tile image',
      admin: { description: 'Shown on the home page\'s category tiles. Optional -- falls back to a decorative placeholder when unset.' },
    },
  ],
}
