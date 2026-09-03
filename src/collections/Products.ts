import { APIError, type CollectionAfterDeleteHook, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'
import { generateProductSlug } from '../lib/productSlug'
import { blockDeleteProductUsedByKit } from '../lib/productDeletionGuard'
import { removeProductFromInstagramProductTags, type InstagramProductTagEntry } from '../lib/instagramFeed'
import type { InstagramSpotlight } from '../payload-types'

const cleanupInstagramProductTags: CollectionAfterDeleteHook = async ({ id, req }) => {
  const global = await req.payload.findGlobal({ slug: 'instagram-spotlight', depth: 0 })
  const productTags = (Array.isArray(global.productTags) ? global.productTags : []) as InstagramProductTagEntry[]
  const cleaned = removeProductFromInstagramProductTags(productTags, id)
  if (JSON.stringify(productTags) === JSON.stringify(cleaned)) return
  await req.payload.updateGlobal({
    slug: 'instagram-spotlight',
    data: { productTags: cleaned as NonNullable<InstagramSpotlight['productTags']> },
    depth: 0,
  })
}

const validateProductStructure: CollectionBeforeValidateHook = async ({ data, operation, originalDoc }) => {
  if (!data) return data
  const kind = (data.productType ?? originalDoc?.productType) === 'bundle' ? 'bundle' : 'standard'
  const variants = Array.isArray(data.variants) ? data.variants : (Array.isArray(originalDoc?.variants) ? originalDoc.variants : [])
  const components = Array.isArray(data.bundleComponents) ? data.bundleComponents : (Array.isArray(originalDoc?.bundleComponents) ? originalDoc.bundleComponents : [])

  if (kind === 'standard' && variants.length < 1) {
    throw new APIError('A standard product needs at least one inventory variant.', 400, null, true)
  }
  if (kind === 'bundle' && components.length < 1) {
    throw new APIError('A product kit needs at least one component.', 400, null, true)
  }
  for (const component of components) {
    if (!component?.product || !component?.variantId || !Number.isInteger(Number(component?.qty)) || Number(component.qty) < 1) {
      throw new APIError('Every kit component needs a product, variant and positive quantity.', 400, null, true)
    }
  }
  return operation === 'create' || data.productType ? { ...data, productType: kind } : data
}

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
    beforeValidate: [generateProductSlug, validateProductStructure],
    beforeDelete: [blockDeleteProductUsedByKit],
    afterDelete: [cleanupInstagramProductTags],
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
      name: 'productType',
      type: 'select',
      required: true,
      defaultValue: 'standard',
      options: [
        { label: 'Standard product', value: 'standard' },
        { label: 'Product kit', value: 'bundle' },
      ],
      admin: { description: 'Standard products own stock variants. Product kits derive availability from their component variants.' },
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
      admin: {
        description: 'Product checklist: assign a shared measurement chart to every standard apparel product with clothing sizes. Leave blank only for accessories or products where measurements do not apply. Used on product pages and the public size-guide page.',
      },
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
    {
      name: 'optionLabelPT',
      type: 'text',
      label: 'Variant option label — Portuguese',
      admin: { description: 'Optional. Examples: Tamanho, Capacidade, Estilo. Leave empty when the product has no non-colour option.' },
    },
    {
      name: 'optionLabelEN',
      type: 'text',
      label: 'Variant option label — English',
      admin: { description: 'Optional. Examples: Size, Capacity, Style.' },
    },
    {
      name: 'specifications',
      type: 'array',
      labels: { singular: 'Product detail', plural: 'Product details' },
      admin: { description: 'Reusable customer-facing facts such as material, capacity, dimensions, care or fit.' },
      fields: [
        { name: 'labelPT', type: 'text', required: true, label: 'Label — Portuguese' },
        { name: 'labelEN', type: 'text', label: 'Label — English' },
        { name: 'valuePT', type: 'text', required: true, label: 'Value — Portuguese' },
        { name: 'valueEN', type: 'text', label: 'Value — English' },
      ],
    },
    {
      name: 'returnEligible',
      type: 'checkbox',
      defaultValue: true,
      label: 'Eligible for normal returns',
    },
    { name: 'returnNotePT', type: 'textarea', label: 'Product return note — Portuguese' },
    { name: 'returnNoteEN', type: 'textarea', label: 'Product return note — English' },
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
      name: 'marketTags',
      type: 'array',
      labels: { singular: 'Market-specific merchandising tag', plural: 'Market-specific merchandising tags' },
      admin: { description: 'Optional tags shown only in one storefront. Shared tags above appear in both markets.' },
      fields: [
        { name: 'tag', type: 'relationship', relationTo: 'merch-tags', required: true, label: 'Tag' },
        { name: 'market', type: 'select', required: true, options: [{ label: 'Angola', value: 'AO' }, { label: 'Portugal', value: 'PT' }], label: 'Storefront' },
      ],
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
        // Per-colour photo galleries (2026-08-07): optional on purpose --
        // unset means "general" (shown regardless of which colour is
        // selected), so every image uploaded before this field existed
        // keeps working exactly as it does today, and a product doesn't
        // need every photo re-tagged before its gallery is usable. The
        // storefront (ProductDetail.tsx) filters this array by the
        // shopper's selected colour and falls back to the untagged/general
        // pool when that colour has no photos of its own yet.
        {
          name: 'color',
          type: 'relationship',
          relationTo: 'colors',
          admin: { description: 'Optional. Leave blank for a general photo shown for every colour. Set this to show the photo only when this colour is selected.' },
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
    // Flexible variant inventory (2026-08-06). Array-row `id` is the stable
    // sellable identity used by carts and orders. Colour and the secondary
    // option are both optional, so a standard product can be colour+size,
    // capacity-only, colour-only, or a single option-less SKU.
    {
      name: 'variants',
      type: 'array',
      labels: { singular: 'Variant', plural: 'Variants' },
      admin: {
        description: 'One row per sellable combination, with per-market stock.',
        condition: (_, siblingData) => siblingData?.productType !== 'bundle',
      },
      fields: [
        { name: 'sku', type: 'text', label: 'SKU' },
        {
          name: 'color',
          type: 'relationship',
          relationTo: 'colors',
          label: 'Colour',
        },
        {
          name: 'size',
          type: 'text',
          label: 'Option value — Portuguese',
          admin: { description: 'Examples: XS, 750 ml, Ajustável. Leave empty for a colour-only or option-less product.' },
        },
        { name: 'optionValueEN', type: 'text', label: 'Option value — English' },
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
      name: 'bundleComponents',
      type: 'array',
      labels: { singular: 'Kit component', plural: 'Kit components' },
      admin: {
        description: 'Fixed contents of this kit. Stock is derived from and deducted from these component variants.',
        condition: (_, siblingData) => siblingData?.productType === 'bundle',
      },
      fields: [
        { name: 'product', type: 'relationship', relationTo: 'products', required: true },
        { name: 'variantId', type: 'text', required: true, label: 'Component variant ID' },
        { name: 'qty', type: 'number', required: true, min: 1, defaultValue: 1, label: 'Quantity in kit' },
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
