import assert from 'node:assert/strict'
import test from 'node:test'

import { absoluteMediaUrl } from '../src/lib/mediaUrl'
import { relationshipId, selectOrderItemImage } from '../src/lib/orderItemImage'

test('order confirmation image lookup accepts bare product relationship IDs', () => {
  assert.equal(relationshipId('product-123'), 'product-123')
  assert.equal(relationshipId(42), '42')
})

test('order confirmation image lookup accepts populated product relationships', () => {
  assert.equal(relationshipId({ id: 'product-123', name: 'Dress' }), 'product-123')
  assert.equal(relationshipId({ id: 42, images: [{ image: 'media-1' }] }), '42')
})

test('order confirmation image lookup rejects malformed relationships', () => {
  assert.equal(relationshipId(null), undefined)
  assert.equal(relationshipId({ name: 'Missing ID' }), undefined)
  assert.equal(relationshipId({ id: {} }), undefined)
})

test('order email chooses the image assigned to the purchased colour', () => {
  const images = [
    { color: { id: 8 }, image: 'black-photo' },
    { color: null, image: 'general-photo' },
    { color: { id: 13 }, image: 'red-photo' },
  ]
  assert.equal(selectOrderItemImage(images, '8'), 'black-photo')
  assert.equal(selectOrderItemImage(images, { id: 13 }), 'red-photo')
  assert.equal(selectOrderItemImage(images, 'unknown'), 'general-photo')
})

test('relative Payload media paths become absolute for external email clients', () => {
  assert.equal(
    absoluteMediaUrl('/api/media/file/product.webp'),
    'https://cms.usemewithstyle.shop/api/media/file/product.webp',
  )
})
