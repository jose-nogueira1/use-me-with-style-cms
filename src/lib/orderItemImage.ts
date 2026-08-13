export type ProductImageEntry = {
  image?: unknown
  color?: unknown
}

export function relationshipId(value: unknown): string | undefined {
  if (value == null) return undefined
  if (typeof value === 'object') {
    const id = (value as { id?: unknown }).id
    return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined
  }
  return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined
}

/** Pick the photograph that represents the purchased colour. General
 * photographs are the fallback for every colour, followed by the first image
 * for compatibility with older catalogue data that has no clean assignment. */
export function selectOrderItemImage(
  images: ProductImageEntry[] | null | undefined,
  colorId: unknown,
): unknown {
  if (!Array.isArray(images) || images.length === 0) return undefined
  const selectedColorId = relationshipId(colorId)
  const exact = selectedColorId
    ? images.find((entry) => relationshipId(entry.color) === selectedColorId)
    : undefined
  const general = images.find((entry) => !relationshipId(entry.color))
  return exact?.image ?? general?.image ?? images[0]?.image
}
