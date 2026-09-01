import test from 'node:test'
import assert from 'node:assert/strict'

import { productDeletionError } from '../src/lib/productDeletionGuard.ts'

test('deleting a product used by a kit returns a useful error', () => {
  assert.equal(
    productDeletionError(2),
    'This product is used by 2 product kits. Remove it from those kits first, then delete it.',
  )
})

test('deleting a product without kit references is allowed', () => {
  assert.equal(productDeletionError(0), null)
})
