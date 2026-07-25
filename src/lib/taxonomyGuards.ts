import { APIError, type CollectionBeforeDeleteHook } from 'payload'

// Deleting a category/tag/colour/size-guide that products still reference
// would silently orphan those products (Payload nullifies the relationship
// -- fatal for the REQUIRED category field, surprising for the rest). So
// deletion is blocked while anything references the doc, and the error
// tells the admin exactly how many products to reassign first.
//
// Enforced here in the CMS (not just disabled buttons in the storefront
// admin) so the native Payload admin panel can't orphan products either.
//
// `field` is the products-collection query path that references the doc:
//   categories   -> 'category'
//   merch-tags   -> 'tag'
//   colors       -> 'variants.color'  (dot path into the variants array)
//   size-guides  -> 'sizeGuide'
export function blockDeleteWhileInUse(field: string, label: string): CollectionBeforeDeleteHook {
  return async ({ id, req }) => {
    const inUse = await req.payload.find({
      collection: 'products',
      where: { [field]: { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    })
    if (inUse.totalDocs > 0) {
      throw new APIError(
        `This ${label} is used by ${inUse.totalDocs} product${inUse.totalDocs === 1 ? '' : 's'}. Reassign ${inUse.totalDocs === 1 ? 'it' : 'them'} first, then delete.`,
        400,
        null,
        true,
      )
    }
  }
}
