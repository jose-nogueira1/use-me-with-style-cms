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
    // Structured size guide (2026-07-25, replaces the free-text
    // sizeGuidePT/EN textareas that shipped earlier the same day): shared
    // measurement charts live in the size-guides collection; the product
    // just references one. Language handled by the storefront's labels.
    {
      name: 'sizeGuide',
      type: 'relationship',
      relationTo: 'size-guides',
      admin: { description: 'Optional. Shared measurement chart shown in the product page size-guide modal.' },
    },
    {
      name: 'fitNotePT',
      type: 'textarea',
      label: 'Fit note — Portuguese',
      admin: { description: 'Optional short per-product advice shown under the size chart, e.g. "Veste pequeno, recomendamos um tamanho acima."' },
    },
    {
      name: 'fitNoteEN',
      type: 'textarea',
      label: 'Fit note — English',
    },
    // Was a hardcoded select until 2026-07-25 -- same relationship
    // conversion as `category` above so admins can create their own badges.
    // hasMany since 2026-07-31 (admin bug report: "I can only select one
    // merchandising tag per item") -- a product can legitimately be both
    // e.g. "Novidade" and "Bestseller" at once. Stored in a new products_rels
    // join table by Payload's own convention for hasMany relationships; see
    // migrations/20260731_*_merch_tags_multiselect.ts for the data-preserving
    // conversion from the old single tag_id column.
    {
      name: 'tag',
      type: 'relationship',
      relationTo: 'merch-tags',
      hasMany: true,
      admin: { description: 'Optional merchandising badge(s) shown on the product card.' },
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
      name: 'shippingWeightGrams',
      type: 'number',
      required: true,
      min: 1,
      defaultValue: 500,
      label: 'Shipping weight (grams)',
      admin: { description: 'Used to calculate Portugal parcel shipping. Include normal product packaging.' },
    },
    // Sale pricing (2026-07-25, "discounts" phase 1): optional per-market
    // override, same shape as the regular price fields above. When set (and
    // within the optional start/end window), this replaces the regular
    // price at checkout -- see lib/salePricing.ts, used by
    // authoritativeOrder.ts, the only place this actually changes what's
    // charged. A sale can be scoped to a single market (e.g. discount only
    // the Angola price) by leaving the other field blank.
    {
      name: 'saleAOKz',
      type: 'number',
      min: 0,
      label: 'Sale price -- Angola (Kz)',
      admin: { description: 'Optional. Replaces the regular Angola price while set and within the sale window (if any).' },
      validate: (value: number | null | undefined, { siblingData }: { siblingData?: { priceAOKz?: number } }) => {
        if (value == null) return true
        if (typeof siblingData?.priceAOKz === 'number' && value >= siblingData.priceAOKz) {
          return 'Sale price must be lower than the regular Angola price.'
        }
        return true
      },
    },
    {
      name: 'salePTEur',
      type: 'number',
      min: 0,
      label: 'Sale price -- Portugal (EUR)',
      admin: { description: 'Optional. Replaces the regular Portugal price while set and within the sale window (if any).' },
      validate: (value: number | null | undefined, { siblingData }: { siblingData?: { pricePTEur?: number } }) => {
        if (value == null) return true
        if (typeof siblingData?.pricePTEur === 'number' && value >= siblingData.pricePTEur) {
          return 'Sale price must be lower than the regular Portugal price.'
        }
        return true
      },
    },
    {
      name: 'saleStartDate',
      type: 'date',
      label: 'Sale start',
      admin: { description: 'Optional. Leave blank for the sale to be active immediately.' },
    },
    {
      name: 'saleEndDate',
      type: 'date',
      label: 'Sale end',
      admin: { description: 'Optional. Leave blank for the sale to run indefinitely.' },
      validate: (value: Date | string | null | undefined, { siblingData }: { siblingData?: { saleStartDate?: Date | string } }) => {
        if (value && siblingData?.saleStartDate && new Date(value) < new Date(siblingData.saleStartDate)) {
          return 'Sale end must be after the sale start.'
        }
        return true
      },
    },
    // Variant-level inventory (2026-07-25): stock is tracked per COLOUR +
    // SIZE combination, replacing the earlier per-size `sizes` array and
    // the separate `colors` list. Every product has at least one colour
    // (confirmed with Jay-P), so each row carries a required colour ref.
    // The storefront derives the product's colour list from these rows
    // (row order = display order) and disables size buttons that are out
    // of stock for the selected colour.
    {
      name: 'variants',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Variant', plural: 'Variants' },
      admin: { description: 'One row per colour + size combination, with per-market stock.' },
      fields: [
        {
          name: 'color',
          type: 'relationship',
          relationTo: 'colors',
          required: true,
          label: 'Colour',
        },
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
