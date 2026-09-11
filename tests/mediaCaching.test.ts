import assert from 'node:assert/strict'
import test from 'node:test'
import { Media } from '../src/collections/Media.ts'

test('public media responses are immutable so browsers and the storefront CDN can reuse them', () => {
  assert.equal(typeof Media.upload, 'object')
  if (!Media.upload || typeof Media.upload !== 'object') return

  const headers = new Headers()
  Media.upload.modifyResponseHeaders?.({ headers })
  assert.equal(headers.get('Cache-Control'), 'public, max-age=31536000, immutable')
  assert.equal(headers.get('CDN-Cache-Control'), 'public, max-age=31536000, immutable')
  assert.equal(headers.get('Vercel-CDN-Cache-Control'), 'public, max-age=31536000, immutable')
})
