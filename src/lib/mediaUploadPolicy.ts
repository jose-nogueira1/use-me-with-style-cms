import type { CollectionBeforeValidateHook } from 'payload'
import { APIError } from 'payload'
import sharp from 'sharp'

export type MediaUploadPurpose = 'hero' | 'catalogue' | 'brand'

export const MEDIA_UPLOAD_POLICIES: Record<MediaUploadPurpose, { maxBytes: number; maxWidth: number; label: string }> = {
  hero: { maxBytes: 3 * 1024 * 1024, maxWidth: 2560, label: 'Homepage/hero images' },
  catalogue: { maxBytes: 2 * 1024 * 1024, maxWidth: 2000, label: 'Product and category images' },
  brand: { maxBytes: 500 * 1024, maxWidth: 1024, label: 'Logos and icons' },
}

function uploadPurpose(value: unknown): MediaUploadPurpose {
  return value === 'hero' || value === 'brand' ? value : 'catalogue'
}

function megabytes(bytes: number): string {
  return `${bytes / (1024 * 1024)} MB`
}

/**
 * Authoritative upload guard. The storefront sends `uploadPurpose` inside
 * Payload's multipart `_payload` object; direct Payload-admin uploads omit it
 * and intentionally receive the safer catalogue limits. The transient value
 * is removed before Payload validates/persists collection fields.
 */
export const enforceMediaUploadPolicy: CollectionBeforeValidateHook = async ({ data, operation, req }) => {
  if (!req.file || (operation !== 'create' && operation !== 'update')) return data

  const purpose = uploadPurpose(data?.uploadPurpose)
  const policy = MEDIA_UPLOAD_POLICIES[purpose]
  if (data) delete data.uploadPurpose

  if (req.file.size > policy.maxBytes) {
    throw new APIError(
      `${policy.label} must be ${megabytes(policy.maxBytes)} or smaller. This file is ${megabytes(req.file.size).slice(0, 4)} MB.`,
      413,
      undefined,
      true,
    )
  }

  const metadata = await sharp(req.file.data).metadata()
  if (metadata.width && metadata.width > policy.maxWidth) {
    throw new APIError(
      `${policy.label} must be no wider than ${policy.maxWidth}px. This image is ${metadata.width}px wide.`,
      422,
      undefined,
      true,
    )
  }

  return data
}
