import type { CollectionConfig } from 'payload'

// Product photography. Phase 1 scope: placeholders are fine until the client
// provides final assets (confirmed in JOS-16 / JOS-52) -- this collection
// just needs to exist so the Products schema has something real to point at
// once photos arrive; the storefront falls back to the inline SVG
// silhouettes (carried over from the prototype) when a product has no image.
export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    read: () => true,
  },
  admin: {
    group: 'Catalogue',
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: {
        description: 'Required: describe what is visible. For product photos include the product, colour/view and product type; do not use the filename.',
      },
      validate: (value: string | null | undefined) =>
        (typeof value === 'string' && value.trim().length > 0) || 'Image alt text must contain a meaningful description.',
    },
  ],
  upload: {
    // Storage destination (local disk vs. S3-compatible object storage) is
    // decided in payload.config.ts based on whether S3_BUCKET is set -- see
    // that file's `plugins` setup. staticDir below is only used in the local
    // (no S3_BUCKET) case.
    staticDir: 'media',
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 400, position: 'centre' },
      { name: 'card', width: 600, height: 800, position: 'centre' },
    ],
    mimeTypes: ['image/*'],
  },
}
