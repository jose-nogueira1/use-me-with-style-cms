import type { CollectionConfig } from 'payload'
import { blockDeleteWhileInUse } from '../lib/taxonomyGuards'

// Shared, structured size charts (2026-07-25 admin request, replacing the
// short-lived free-text sizeGuidePT/EN fields on Products). One chart (e.g.
// "Vestidos — padrão") serves every product that references it, so
// measurements are entered once and stay consistent across the catalogue.
// Values are plain centimetres -- language-neutral -- and the storefront
// translates the row/column labels, so nothing is written twice for PT/EN.
// Per-product nuance ("runs small, size up") lives in the product's own
// fitNotePT/fitNoteEN fields, not here.
export const SizeGuides: CollectionConfig = {
  slug: 'size-guides',
  labels: { singular: 'Size guide', plural: 'Size guides' },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: 'Catalogue',
  },
  access: {
    // Product pages render the chart publicly; admin-only writes.
    read: () => true,
  },
  hooks: {
    beforeDelete: [blockDeleteWhileInUse('sizeGuide', 'size guide')],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
      unique: true,
      admin: { description: 'Internal name, e.g. "Vestidos — padrão". Shoppers never see this.' },
    },
    {
      name: 'rows',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Size row', plural: 'Size rows' },
      admin: { description: 'One row per size. All measurements in centimetres; leave blank any that do not apply to this garment type.' },
      fields: [
        {
          name: 'size',
          type: 'select',
          required: true,
          options: ['XS', 'S', 'M', 'L', 'XL'],
        },
        { name: 'bust', type: 'number', min: 0, label: 'Bust (cm)' },
        { name: 'waist', type: 'number', min: 0, label: 'Waist (cm)' },
        { name: 'hip', type: 'number', min: 0, label: 'Hip (cm)' },
        { name: 'length', type: 'number', min: 0, label: 'Length (cm)' },
      ],
    },
  ],
}
