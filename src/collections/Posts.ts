import { APIError, type CollectionBeforeValidateHook, type CollectionConfig } from 'payload'
import { slugify } from '../lib/productSlug'

const preparePost: CollectionBeforeValidateHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  if (operation === 'update' && originalDoc?.slug) {
    data.slug = originalDoc.slug
  } else {
    const base = slugify(data.titlePT || 'artigo') || 'artigo'
    let candidate = base
    let suffix = 2
    while (
      await req.payload
        .find({ collection: 'posts', where: { slug: { equals: candidate } }, limit: 1, depth: 0, overrideAccess: true })
        .then((result) => result.docs.length > 0)
    ) {
      candidate = `${base}-${suffix}`
      suffix += 1
    }
    data.slug = candidate
  }

  if (data.status === 'published' && !(data.publishedAt || originalDoc?.publishedAt)) {
    data.publishedAt = new Date().toISOString()
  }

  const body = Array.isArray(data.body) ? data.body : (Array.isArray(originalDoc?.body) ? originalDoc.body : [])
  for (const block of body) {
    if (block?.kind === 'section' && (!String(block.headingPT || '').trim() || !String(block.headingEN || '').trim())) {
      throw new APIError('Section blocks need Portuguese and English headings.', 400, null, true)
    }
  }

  return data
}

export const Posts: CollectionConfig = {
  slug: 'posts',
  labels: { singular: 'Style guide article', plural: 'Style guide articles' },
  admin: {
    useAsTitle: 'titlePT',
    defaultColumns: ['titlePT', 'status', 'publishedAt', 'availableAO', 'availablePT'],
    group: 'Content',
    description: 'Bilingual editorial articles. Day-to-day editing is also available in the custom storefront admin.',
  },
  access: {
    read: ({ req }) => req.user ? true : { status: { equals: 'published' } },
  },
  hooks: { beforeValidate: [preparePost] },
  defaultSort: '-publishedAt',
  fields: [
    { name: 'titlePT', type: 'text', required: true, label: 'Title — Portuguese' },
    { name: 'titleEN', type: 'text', required: true, label: 'Title — English' },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: { readOnly: true, description: 'Generated from the Portuguese title and kept stable after publication.' },
    },
    { name: 'excerptPT', type: 'textarea', required: true, label: 'Excerpt — Portuguese' },
    { name: 'excerptEN', type: 'textarea', required: true, label: 'Excerpt — English' },
    {
      name: 'body',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Content block', plural: 'Content blocks' },
      admin: { description: 'Structured rich content. Blocks can be reordered and edited bilingually in the storefront admin.' },
      fields: [
        {
          name: 'kind',
          type: 'select',
          required: true,
          defaultValue: 'paragraph',
          options: [
            { label: 'Section with heading', value: 'section' },
            { label: 'Paragraph', value: 'paragraph' },
            { label: 'Bulleted list (one item per line)', value: 'bullets' },
          ],
        },
        { name: 'headingPT', type: 'text', label: 'Heading — Portuguese' },
        { name: 'headingEN', type: 'text', label: 'Heading — English' },
        { name: 'textPT', type: 'textarea', required: true, label: 'Text — Portuguese' },
        { name: 'textEN', type: 'textarea', required: true, label: 'Text — English' },
      ],
    },
    { name: 'seoTitlePT', type: 'text', required: true, label: 'SEO title — Portuguese' },
    { name: 'seoTitleEN', type: 'text', required: true, label: 'SEO title — English' },
    { name: 'seoDescriptionPT', type: 'textarea', required: true, label: 'SEO description — Portuguese' },
    { name: 'seoDescriptionEN', type: 'textarea', required: true, label: 'SEO description — English' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'draft',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' },
      ],
    },
    { name: 'publishedAt', type: 'date', admin: { date: { pickerAppearance: 'dayAndTime' } } },
    { name: 'availableAO', type: 'checkbox', required: true, defaultValue: true, label: 'Published in Angola store' },
    { name: 'availablePT', type: 'checkbox', required: true, defaultValue: true, label: 'Published in Portugal store' },
  ],
}
