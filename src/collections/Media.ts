import type { CollectionConfig } from 'payload'

import { enforceMediaUploadPolicy } from '../lib/mediaUploadPolicy'

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
    description: 'Upload guidance: products/categories up to 2 MB and 2000px wide; homepage hero images up to 3 MB and 2560px wide; logos/icons up to 500 KB.',
  },
  hooks: {
    beforeValidate: [enforceMediaUploadPolicy],
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
    adminThumbnail: 'thumbnail',
    formatOptions: { format: 'webp', options: { quality: 84 } },
    resizeOptions: { width: 2560, withoutEnlargement: true },
    imageSizes: [
      { name: 'thumbnail', width: 300, height: 400, position: 'centre', formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'card', width: 600, height: 800, position: 'centre', formatOptions: { format: 'webp', options: { quality: 82 } } },
      { name: 'small', width: 480, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 80 } } },
      { name: 'medium', width: 960, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 82 } } },
      { name: 'large', width: 1600, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 84 } } },
      { name: 'hero', width: 2560, withoutEnlargement: true, formatOptions: { format: 'webp', options: { quality: 84 } } },
    ],
    mimeTypes: ['image/*'],
  },
}
