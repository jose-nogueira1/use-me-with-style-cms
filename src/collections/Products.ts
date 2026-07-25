import type { CollectionConfig } from 'payload'
import { generateProductSlug } from '../lib/productSlug'

// Product catalogue. Phase 1 decision (JOS-52/JOS-16): manual admin entry,
// placeholder media until the client supplies final photography.
//
// ASSUMPTION FLAGGED FOR JAY-P: the blueprint's "Key Decisions to Finalise"
// (Technical Appendix, blueprint v5) left "Angola stock: separate or shared
// inventory with Portugal?" unresolved. This schema defaults to SEPARATE
// per-market stock (stockAO / stockPT per size) since that's the safer,
// more general model -- if the real answer is "shared", collapse the two
// fields into one `stock` field later; that's a smaller migration than the
// reverse.
export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'category', 'priceAOKz', 'pricePTEur', 'active', 'availableAO', 'availablePT'],
    group: 'Catalogue',
  },
  access: {
    // Storefront reads products publicly; only admins can write.
    read: () => true,
  },
  hooks: {
    beforeValidate: [generateProductSlug],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      admin: { description: 'Internal/default product name (kept aligned with the Portuguese name).' },
    },
    {
      name: 'namePT',
      type: 'text',
      label: 'Product name — Portuguese',
    },
    {
      name: 'nameEN',
      type: 'text',
      label: 'Product name — English',
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      admin: {
        readOnly: true,
        description: 'Auto-generated from the product name -- not editable (2026-07-25 admin request). See generateProductSlug in src/lib/productSlug.ts.',
      },
    },
    // Was a hardcoded select (vestidos/tops/leggings/conjuntos) until
    // 2026-07-25; now a relationship so admins can create categories
    // themselves. Old enum values were seeded into the categories
    // collection with the same slugs by the catalogue_taxonomies migration.
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'categories',
      required: true,
    },
    {
      name: 'description',
      type: 'textarea',
      admin: { description: 'Legacy/default description. New storefront editing uses the language-specific fields below.' },
    },
    {
      name: 'descriptionPT',
      type: 'textarea',
      label: 'Description — Portuguese',
    },
    {
      name: 'descriptionEN',
      type: 'textarea',
      label: 'Description — English',
    },
    {
      name: 'sizeGuidePT',
      type: 'textarea',
      label: 'Size guide — Portuguese',
      admin: { description: 'Optional. Free text -- e.g. measurements per size (bust/waist/hip in cm) and fit notes. Shown to shoppers on the product page.' },
    },
    {
      name: 'sizeGuideEN',
      type: 'textarea',
      label: 'Size guide — English',
    },
    // Was a hardcoded select until 2026-07-25 -- same relationship
    // conversion as `category` above so admins can create their own badges.
    {
      name: 'tag',
      type: 'relationship',
      relationTo: 'merch-tags',
      admin: { description: 'Optional merchandising badge shown on the product card.' },
    },
    {
      name: 'images',
      type: 'array',
      fields: [
        {
          name: 'image',
          type: 'upload',
          relationTo: 'media',
          required: true,
        },
      ],
    },
    // Was an array of free-text strings until 2026-07-25; now references
    // the colours taxonomy so names stay consistent across products and the
    // storefront can render real swatches. See collections/Colors.ts.
    {
      name: 'colors',
      type: 'relationship',
      relationTo: 'colors',
      hasMany: true,
      label: 'Colours',
    },
    {
      name: 'priceAOKz',
      type: 'number',
      required: true,
      min: 0,
      label: 'Price -- Angola (Kz)',
    },
    {
      name: 'pricePTEur',
      type: 'number',
      required: true,
      min: 0,
      label: 'Price -- Portugal (EUR)',
    },
    {
      name: 'sizes',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Size', plural: 'Sizes' },
      fields: [
        {
          name: 'size',
          type: 'select',
          required: true,
          options: ['XS', 'S', 'M', 'L', 'XL'],
        },
        {
          name: 'stockAO',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
          label: 'Stock -- Angola',
        },
        {
          name: 'stockPT',
          type: 'number',
          required: true,
          min: 0,
          defaultValue: 0,
          label: 'Stock -- Portugal',
        },
      ],
    },
    {
      name: 'active',
      type: 'checkbox',
      defaultValue: true,
      admin: { description: 'Unpublish to hide from the storefront without deleting it.' },
    },
    // Market separation (2026-07-10): the Angola and Portugal storefronts are
    // now fully separate sites (ao./pt. subdomains), each only ever
    // requesting products flagged available in its own market. Both default
    // to true so every existing product keeps shipping everywhere until an
    // admin deliberately restricts one.
    {
      name: 'availableAO',
      type: 'checkbox',
      defaultValue: true,
      label: 'Available in Angola',
      admin: { description: 'Uncheck to hide this product from the Angola storefront entirely.', position: 'sidebar' },
    },
    {
      name: 'availablePT',
      type: 'checkbox',
      defaultValue: true,
      label: 'Available in Portugal',
      admin: { description: 'Uncheck to hide this product from the Portugal storefront entirely.', position: 'sidebar' },
    },
  ],
}
