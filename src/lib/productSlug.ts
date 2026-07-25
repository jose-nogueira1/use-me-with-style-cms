import type { CollectionBeforeValidateHook } from 'payload'

// Slugs are auto-generated from the product name and are never
// user-editable (2026-07-25, admin request: "user should not be allowed to
// create them"). The `slug` field on Products.ts is marked admin.readOnly
// as a first line of defense in the native Payload admin; this hook is the
// real enforcement, since it runs on every create/update regardless of
// what (if anything) a client sends for `slug`.
//
// On update, an existing slug is left exactly as-is -- reslugging on every
// name edit would silently break any bookmarked/shared product URL, which
// is worse than a slug that no longer matches a since-renamed product.

export function slugify(value: string): string {
  const combiningDiacritics = new RegExp('[\\u0300-\\u036f]', 'g')
  return value
    .normalize('NFD') // e.g. "Vestido Mare" + a combining acute accent mark
    .replace(combiningDiacritics, '') // strip the accent, keeping plain "e"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const generateProductSlug: CollectionBeforeValidateHook = async ({ data, req, operation, originalDoc }) => {
  if (!data) return data

  if (operation === 'update') {
    // Immutable after creation -- always win over anything the client sent.
    if (originalDoc?.slug) {
      data.slug = originalDoc.slug
      return data
    }
    // Fall through to generate one for the rare pre-existing row that
    // somehow has no slug yet, rather than leaving it permanently blank.
  }

  const base = slugify(data.namePT || data.name || 'produto') || 'produto'
  let candidate = base
  let suffix = 2

  // Guards against the (rare, but real -- e.g. "Vestido Maré" launching in
  // two colourways as separate catalogue rows) case of two products
  // slugifying to the same base string.
  while (
    await req.payload
      .find({
        collection: 'products',
        where: { slug: { equals: candidate } },
        limit: 1,
        depth: 0,
      })
      .then((result) => result.docs.length > 0)
  ) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  data.slug = candidate
  return data
}
