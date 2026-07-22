import type { CollectionConfig } from 'payload'

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
        description: 'URL-safe identifier, e.g. "vestido-aurora".',
      },
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Vestidos', value: 'vestidos' },
        { label: 'Tops', value: 'tops' },
        { label: 'Leggings', value: 'leggings' },
        { label: 'Conjuntos', value: 'conjuntos' },
      ],
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
      name: 'tag',
      type: 'select',
      admin: { description: 'Optional merchandising badge shown on the product card.' },
      options: [
        { label: 'Novidade', value: 'NOVIDADE' },
        { label: 'Bestseller', value: 'BESTSELLER' },
        { label: 'Quase esgotado', value: 'QUASE ESGOTADO' },
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
      ],
    },
    {
      name: 'colors',
      type: 'array',
      fields: [{ name: 'color', type: 'text', required: true }],
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
