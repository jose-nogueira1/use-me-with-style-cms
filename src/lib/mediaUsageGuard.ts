import { APIError, type CollectionBeforeDeleteHook } from 'payload'

type UsageCheck = { label: string; count: number }

/**
 * Media relationships must be detached before the underlying file can be
 * deleted. This is enforced in Payload as well as the Storefront Admin so a
 * direct REST call or the native Payload UI cannot orphan storefront images.
 */
export const blockDeleteMediaWhileInUse: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const [products, categories, colours, hero] = await Promise.all([
    req.payload.find({
      collection: 'products',
      where: { 'images.image': { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'categories',
      where: { image: { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.find({
      collection: 'colors',
      where: { swatch: { equals: id } },
      limit: 1,
      depth: 0,
      overrideAccess: true,
      req,
    }),
    req.payload.findGlobal({ slug: 'home-hero', depth: 0, overrideAccess: true, req }),
  ])

  const heroDesktop = String(hero.heroImage ?? '') === String(id)
  const heroMobile = String(hero.heroImageMobile ?? '') === String(id)
  const checks: UsageCheck[] = [
    { label: 'product', count: products.totalDocs },
    { label: 'category', count: categories.totalDocs },
    { label: 'colour swatch', count: colours.totalDocs },
    { label: 'home-page hero', count: Number(heroDesktop) + Number(heroMobile) },
  ].filter((check) => check.count > 0)

  if (checks.length > 0) {
    const summary = checks.map(({ label, count }) => `${count} ${label}${count === 1 ? '' : 's'}`).join(', ')
    throw new APIError(
      `This image is still used by ${summary}. Remove those assignments first, then delete the image.`,
      400,
      null,
      true,
    )
  }
}

// Later Media Library phases, intentionally deferred:
// 3. Existing-media picker; 4. exact checksum deduplication; 5. master asset
// with purpose-specific crops; 6. optional perceptual duplicate warnings.
