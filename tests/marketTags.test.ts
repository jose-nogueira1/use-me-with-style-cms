import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

test('products support shared and market-scoped merchandising tags', () => {
  const source = readFileSync(new URL('../src/collections/Products.ts', import.meta.url), 'utf8')
  assert.match(source, /name: 'marketTags'/)
  assert.match(source, /name: 'tag'[\s\S]*?type: 'relationship'/)
  assert.match(source, /name: 'market'[\s\S]*?type: 'select'/)
})
