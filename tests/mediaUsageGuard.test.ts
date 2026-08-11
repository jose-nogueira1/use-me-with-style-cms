import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('media deletion is guarded across every current Payload relationship', () => {
  const guard = read('../src/lib/mediaUsageGuard.ts')
  const media = read('../src/collections/Media.ts')

  assert.match(guard, /'images\.image'/)
  assert.match(guard, /collection: 'categories'/)
  assert.match(guard, /collection: 'colors'/)
  assert.match(guard, /slug: 'home-hero'/)
  assert.match(guard, /Remove those assignments first/)
  assert.match(media, /beforeDelete: \[blockDeleteMediaWhileInUse\]/)
})

test('later reuse, deduplication, crop and similarity phases stay documented', () => {
  const guard = read('../src/lib/mediaUsageGuard.ts')
  assert.match(guard, /Existing-media picker/)
  assert.match(guard, /checksum deduplication/)
  assert.match(guard, /purpose-specific crops/)
  assert.match(guard, /perceptual duplicate warnings/)
})
