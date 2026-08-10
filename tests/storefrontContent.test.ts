import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { StorefrontContent } from '../src/globals/StorefrontContent.ts'

const projectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('storefront content is publicly readable and seeds the existing six FAQs', () => {
  assert.equal(StorefrontContent.slug, 'storefront-content')
  assert.equal(StorefrontContent.access?.read?.({} as never), true)
  const faqField = StorefrontContent.fields.find((field) => 'name' in field && field.name === 'faqEntries')
  assert.ok(faqField && 'defaultValue' in faqField && Array.isArray(faqField.defaultValue))
  assert.equal(faqField.defaultValue.length, 6)
})

test('Payload config, Postgres migration and local SQLite sync include the content global', () => {
  assert.match(projectFile('src/payload.config.ts'), /StorefrontContent/)
  const migration = projectFile('src/migrations/20260810_170000_storefront_content.ts')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "storefront_content"/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "storefront_content_faq_entries"/)
  assert.match(migration, /answer_p_t_p_t/)
  assert.match(projectFile('src/migrations/index.ts'), /20260810_170000_storefront_content/)
  assert.match(projectFile('scripts/sync-local-sqlite.mjs'), /CREATE TABLE storefront_content/)
})
