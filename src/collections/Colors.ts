import type { CollectionConfig } from 'payload'
import { blockDeleteWhileInUse } from '../lib/taxonomyGuards'

// Colour taxonomy (2026-07-25 admin request). Replaces the previous
// free-text colours array on Products, which produced inconsistent filter
// values ("verde" / "Verde" / "green" as three different colours). Each
// colour is defined once here and referenced from products, so storefront
// filters stay consistent and product pages can render a real swatch:
// - `hex` covers solid colours (renders a coloured dot);
// - `swatch` (an image) covers patterns/multicolour fabrics a single hex
//   can't represent. If both are set the image wins; if neither is set the
//   storefront falls back to a text chip, so nothing breaks.
//
// Bilingual (2026-07-25 follow-up, mirrors Categories/MerchTags): namePT is
// the canonical name the admin types; nameEN is optional and falls back to
// namePT if empty. The DB row's ID (not either name) is the stable identity
// used everywhere that matters -- product variants reference colours by id,
// and the storefront cart/order flow now carries that same id (see
// authoritativeOrder.ts) so switching storefront language mid-session never
// changes which colour a cart line refers to. namePT/nameEN are display-only.
export const Colors: CollectionConfig = {
  slug: 'colors',
  labels: { singular: 'Colour', plural: 'Colours' },
  admin: {
    useAsTitle: 'namePT',
    defaultColumns: ['namePT', 'nameEN', 'hex', 'hex2'],
    group: 'Catalogue',
  },
  access: {
    read: () => true,
  },
  hooks: {
    beforeDelete: [blockDeleteWhileInUse('variants.color', 'colour')],
  },
  fields: [
    {
      name: 'namePT',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      label: 'Name — Portuguese',
      admin: { description: 'Display name, e.g. "Verde Oliva".' },
    },
    {
      name: 'nameEN',
      type: 'text',
      label: 'Name — English',
      admin: { description: 'Shown when the shopper switches the storefront to English. Falls back to the Portuguese name if empty.' },
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
      // Two-tone combination colours (2026-07-25 admin request, e.g. "red &
      // white"): setting hex2 alongside hex renders a split-circle swatch
      // instead of a solid dot. Still a single Colours doc/id -- variants,
      // cart, and orders all treat it exactly like any other colour, since
      // they only ever key off the id. Three-plus tones aren't supported;
      // use a swatch image for anything more complex than two colours.
      name: 'hex2',
      type: 'text',
      label: 'Second hex value (combination colour)',
      validate: (value: string | null | undefined) => {
        if (!value) return true
        return /^#[0-9a-fA-F]{6}$/.test(value) || 'Must be a 6-digit hex colour like #7A8B5C.'
      },
      admin: { description: 'Optional. Set this to create a two-tone combination colour -- the swatch renders as a split circle.' },
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
