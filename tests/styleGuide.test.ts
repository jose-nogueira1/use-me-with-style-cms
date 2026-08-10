import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const projectFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Posts collection provides a protected bilingual publishing workflow', () => {
  const collection = projectFile('src/collections/Posts.ts')
  const config = projectFile('src/payload.config.ts')
  assert.match(config, /Posts/)
  assert.match(config, /SizeGuides, Posts, Orders/)
  assert.match(collection, /req\.user \? true : \{ status: \{ equals: 'published' \} \}/)
  assert.match(collection, /name: 'body'/)
  assert.match(collection, /value: 'section'/)
  assert.match(collection, /value: 'bullets'/)
  assert.match(collection, /name: 'seoTitlePT'/)
  assert.match(collection, /name: 'availableAO'/)
  assert.match(collection, /data\.publishedAt = new Date\(\)\.toISOString\(\)/)
})

test('style-guide migration is registered, seeds three published posts and supports local SQLite', () => {
  const migration = projectFile('src/migrations/20260810_200000_style_guide_posts.ts')
  const index = projectFile('src/migrations/index.ts')
  const local = projectFile('scripts/sync-local-sqlite.mjs')
  for (const slug of ['como-escolher-leggings', 'o-que-vestir-no-ginasio', 'guia-tecidos-roupa-desportiva']) {
    assert.match(migration, new RegExp(slug))
    assert.match(local, new RegExp(slug))
  }
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "posts"/)
  assert.match(migration, /CREATE TABLE IF NOT EXISTS "posts_body"/)
  assert.match(migration, /ON CONFLICT \("slug"\) DO NOTHING/)
  assert.match(migration, /payload_locked_documents_rels_posts_id_idx/)
  assert.match(index, /20260810_200000_style_guide_posts/)
  assert.match(local, /CREATE TABLE posts/)
  assert.match(local, /INSERT OR IGNORE INTO posts/)
  assert.match(local, /payload_locked_documents_rels ADD COLUMN posts_id/)
})
