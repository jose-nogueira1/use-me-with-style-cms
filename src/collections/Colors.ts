import type { CollectionConfig } from 'payload'

// Colour taxonomy (2026-07-25 admin request). Replaces the previous
// free-text colours array on Products, which produced inconsistent filter
// values ("verde" / "Verde" / "green" as three different colours). Each
// colour is defined once here and referenced from products, so storefront
// filters stay consistent and product pages can render a real swatch:
// - `hex` covers solid colours (renders a coloured dot);
// - `swatch` (an image) covers patterns/multicolour fabrics a single hex
//   can't represent. If both are set the image wins; if neither is set the
//   storefront falls back to a text chip, so nothing breaks.
// Existing free-text values were migrated 1:1 into this collection (name
// only, no hex) by 20260725_150000_catalogue_taxonomies -- the admin can
// fill in hexes/swatches over time.
export const Colors: CollectionConfig = {
  slug: 'colors',
  labels: { singular: 'Colour', plural: 'Colours' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'hex'],
    group: 'Catalogue',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { description: 'Display name, e.g. "Verde Oliva". Also the value stored on order items.' },
    },
    {
      name: 'hex',
      type: 'text',
      label: 'Hex value',
      validate: (value: string | null | undefined) => {
        if (!value) return true
        return /^#[0-9a-fA-F]{6}$/.test(value) || 'Must be a 6-digit hex colour like #7A8B5C.'
      },
      admin: { description: 'Solid-colour swatch, e.g. #7A8B5C. Leave empty for patterned fabrics and upload a swatch image instead.' },
    },
    {
      name: 'swatch',
      type: 'upload',
      relationTo: 'media',
      label: 'Swatch image',
      admin: { description: 'Optional. For patterns/multicolour fabrics where a single hex value is not representative. Takes precedence over the hex value.' },
    },
  ],
}
