import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import sharp from 'sharp'

import { enforceMediaUploadPolicy, MEDIA_UPLOAD_POLICIES } from '../src/lib/mediaUploadPolicy'

async function image(width = 100, height = 100): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#ffffff' } }).png().toBuffer()
}

function args(file: { data: Buffer; size: number }, uploadPurpose?: string) {
  return {
    collection: {} as never,
    context: {},
    data: uploadPurpose ? { uploadPurpose } : {},
    operation: 'create' as const,
    req: {
      file: { ...file, mimetype: 'image/png', name: 'test.png' },
    } as never,
  }
}

test('unmarked CMS uploads default to catalogue limits', async () => {
  const data = await image()
  await assert.rejects(
    enforceMediaUploadPolicy(args({ data, size: MEDIA_UPLOAD_POLICIES.catalogue.maxBytes + 1 })),
    (error: unknown) => error instanceof Error && error.message.includes('Product and category images'),
  )
})

test('hero uploads use the larger hero filesize limit and discard transient purpose', async () => {
  const data = await image()
  const hookArgs = args({ data, size: MEDIA_UPLOAD_POLICIES.catalogue.maxBytes + 1 }, 'hero')
  await enforceMediaUploadPolicy(hookArgs)
  assert.equal('uploadPurpose' in hookArgs.data, false)
})

test('catalogue uploads reject images wider than 2000px', async () => {
  const data = await image(2001, 10)
  await assert.rejects(
    enforceMediaUploadPolicy(args({ data, size: data.byteLength }, 'catalogue')),
    (error: unknown) => error instanceof Error && error.message.includes('2000px'),
  )
})

test('brand uploads enforce the 500 KB policy', async () => {
  const data = await image()
  await assert.rejects(
    enforceMediaUploadPolicy(args({ data, size: MEDIA_UPLOAD_POLICIES.brand.maxBytes + 1 }, 'brand')),
    (error: unknown) => error instanceof Error && error.message.includes('Logos and icons'),
  )
})

test('responsive media schema migration is registered and local SQLite is kept in sync', async () => {
  const [migrationIndex, migration, sqliteSync] = await Promise.all([
    readFile(new URL('../src/migrations/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/migrations/20260811_180000_responsive_media_sizes.ts', import.meta.url), 'utf8'),
    readFile(new URL('../scripts/sync-local-sqlite.mjs', import.meta.url), 'utf8'),
  ])
  assert.match(migrationIndex, /20260811_180000_responsive_media_sizes/)
  assert.match(migration, /sizeNames = \['small', 'medium', 'large', 'hero'\]/)
  assert.match(migration, /sizes_\$\{name\}_filename/)
  assert.match(sqliteSync, /\['small', 'medium', 'large', 'hero'\]/)
})
