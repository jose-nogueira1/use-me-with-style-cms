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

test('TikTok profile is optional and only accepts an official HTTPS profile URL', () => {
  const field = StorefrontContent.fields.find((candidate) => 'name' in candidate && candidate.name === 'tiktokUrl')
  assert.ok(field && 'validate' in field && typeof field.validate === 'function')
  const validate = field.validate as (value: unknown) => true | string
  assert.equal(validate(''), true)
  assert.equal(validate('https://www.tiktok.com/@usemewithstyle'), true)
  assert.equal(validate('https://tiktok.com/@usemewithstyle'), true)
  assert.equal(typeof validate('https://example.com/@usemewithstyle'), 'string')
  assert.equal(typeof validate('http://www.tiktok.com/@usemewithstyle'), 'string')
  assert.equal(typeof validate('https://www.tiktok.com/video/123'), 'string')
})

test('homepage SEO defaults localize delivery and payment positioning by market', () => {
  const fieldDefault = (name: string) => {
    const field = StorefrontContent.fields.find((candidate) => 'name' in candidate && candidate.name === name)
    assert.ok(field && 'defaultValue' in field)
    return String(field.defaultValue)
  }
  assert.match(fieldDefault('homeSeoTitleAngolaPT'), /Luanda/)
  assert.match(fieldDefault('homeSeoDescriptionAngolaPT'), /Multicaixa Express/)
  assert.match(fieldDefault('homeSeoTitlePortugalPT'), /Portugal/)
  assert.doesNotMatch(fieldDefault('homeSeoDescriptionPortugalPT'), /Multicaixa|AppyPay/)
})

test('About defaults preserve the approved story and add factual AO/PT presence copy', () => {
  const fieldDefault = (name: string) => {
    const field = StorefrontContent.fields.find((candidate) => 'name' in candidate && candidate.name === name)
    assert.ok(field && 'defaultValue' in field)
    return field.defaultValue
  }
  assert.match(String(fieldDefault('aboutStoryBodyPT')), /Com atuação em Angola e Portugal/)
  assert.match(String(fieldDefault('aboutAngolaBodyPT')), /16 municípios de Luanda/)
  assert.match(String(fieldDefault('aboutPortugalBodyPT')), /CTT/)
  const values = fieldDefault('aboutValues')
  assert.ok(Array.isArray(values))
  assert.equal(values.length, 3)
})

test('Payload config, Postgres migration and local SQLite sync include the content global', () => {
  assert.match(projectFile('src/payload.config.ts'), /StorefrontContent/)
  const migration = projectFile('src/migrations/20260810_170000_storefront_content.ts')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "storefront_content"/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "storefront_content_faq_entries"/)
  assert.match(migration, /answer_p_t_p_t/)
  assert.match(projectFile('src/migrations/index.ts'), /20260810_170000_storefront_content/)
  assert.match(projectFile('scripts/sync-local-sqlite.mjs'), /CREATE TABLE storefront_content/)
  assert.match(projectFile('src/migrations/20260810_180000_home_market_seo.ts'), /home_seo_description_angola_p_t/)
  assert.match(projectFile('src/migrations/index.ts'), /20260810_180000_home_market_seo/)
  const aboutMigration = projectFile('src/migrations/20260810_190000_about_brand_story.ts')
  assert.match(aboutMigration, /storefront_content_about_values/)
  assert.match(aboutMigration, /CROSS JOIN \(VALUES/)
  assert.match(projectFile('scripts/sync-local-sqlite.mjs'), /quality-' \|\| id/)
  assert.match(projectFile('src/migrations/index.ts'), /20260810_190000_about_brand_story/)
  assert.match(projectFile('src/migrations/20260810_210000_storefront_tiktok.ts'), /ADD COLUMN IF NOT EXISTS "tiktok_url"/)
  assert.match(projectFile('src/migrations/index.ts'), /20260810_210000_storefront_tiktok/)
  assert.match(projectFile('scripts/sync-local-sqlite.mjs'), /ADD COLUMN tiktok_url TEXT/)
})
