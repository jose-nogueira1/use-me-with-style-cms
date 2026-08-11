import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

test('mobile hero image is versioned, migrated and available in local SQLite', () => {
  const global = read('../src/globals/HomeHero.ts')
  const migration = read('../src/migrations/20260811_200000_mobile_hero_image.ts')
  const registry = read('../src/migrations/index.ts')
  const sqlite = read('../scripts/sync-local-sqlite.mjs')

  assert.match(global, /name: 'heroImageMobile'/)
  assert.match(migration, /hero_image_mobile_id/)
  assert.match(migration, /version_hero_image_mobile_id/)
  assert.match(registry, /20260811_200000_mobile_hero_image/)
  assert.match(sqlite, /ADD COLUMN hero_image_mobile_id INTEGER/)
  assert.match(sqlite, /ADD COLUMN version_hero_image_mobile_id INTEGER/)
})
