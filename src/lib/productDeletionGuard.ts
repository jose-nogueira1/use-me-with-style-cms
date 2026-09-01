import { APIError, type CollectionBeforeDeleteHook } from 'payload'

export function productDeletionError(kitCount: number): string | null {
  if (kitCount < 1) return null
  return `This product is used by ${kitCount} product kit${kitCount === 1 ? '' : 's'}. Remove it from those kits first, then delete it.`
}

export const blockDeleteProductUsedByKit: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const kits = await req.payload.find({
    collection: 'products',
    where: { 'bundleComponents.product': { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const message = productDeletionError(kits.totalDocs)
  if (message) throw new APIError(message, 400, null, true)
}
