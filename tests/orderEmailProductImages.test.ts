import assert from 'node:assert/strict'
import test from 'node:test'

import { orderItemProductId } from '../src/hooks/notifyOrderEvent'

test('order confirmation image lookup accepts bare product relationship IDs', () => {
  assert.equal(orderItemProductId('product-123'), 'product-123')
  assert.equal(orderItemProductId(42), '42')
})

test('order confirmation image lookup accepts populated product relationships', () => {
  assert.equal(orderItemProductId({ id: 'product-123', name: 'Dress' }), 'product-123')
  assert.equal(orderItemProductId({ id: 42, images: [{ image: 'media-1' }] }), '42')
})

test('order confirmation image lookup rejects malformed relationships', () => {
  assert.equal(orderItemProductId(null), undefined)
  assert.equal(orderItemProductId({ name: 'Missing ID' }), undefined)
  assert.equal(orderItemProductId({ id: {} }), undefined)
})
