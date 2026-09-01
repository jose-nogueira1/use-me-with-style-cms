import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('product deletion migration makes historical order product references nullable', () => {
  const source = readFileSync(new URL('../src/migrations/20260901_120000_product_delete_safety.ts', import.meta.url), 'utf8')
  assert.match(source, /orders_items/)
  assert.match(source, /DROP NOT NULL/)
  assert.match(source, /ON DELETE SET NULL/i)
})
