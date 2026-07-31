import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

import { up } from '../src/migrations/20260725_150000_catalogue_taxonomies.ts'
import { up as tagsUp, down as tagsDown } from '../src/migrations/20260731_140000_merch_tags_multiselect.ts'
import { up as heroUp, down as heroDown } from '../src/migrations/20260731_150000_home_hero_cta_picker.ts'
import { up as freeShippingUp } from '../src/migrations/20260731_160000_coupons_free_shipping.ts'

const adminUrl = process.env.TEST_POSTGRES_URL

async function withDatabase(run: (client: pg.Pool) => Promise<void>) {
  if (!adminUrl) return
  const adminPool = new pg.Pool({ connectionString: adminUrl })
  const database = `migration_test_${randomUUID().replaceAll('-', '')}`
  await adminPool.query(`CREATE DATABASE "${database}"`)
  const databaseUrl = new URL(adminUrl)
  databaseUrl.pathname = `/${database}`
  const pool = new pg.Pool({ connectionString: databaseUrl.toString() })
  try { await run(pool) } finally {
    await pool.end()
    await adminPool.query(`DROP DATABASE "${database}" WITH (FORCE)`)
    await adminPool.end()
  }
}

async function createPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TYPE enum_products_category AS ENUM ('vestidos', 'tops', 'leggings', 'conjuntos');
    CREATE TYPE enum_products_tag AS ENUM ('NOVIDADE', 'BESTSELLER', 'QUASE ESGOTADO');
    CREATE TYPE enum_products_sizes_size AS ENUM ('XS', 'S', 'M', 'L', 'XL');
    CREATE TABLE media (id serial PRIMARY KEY);
    CREATE TABLE products (
      id serial PRIMARY KEY, category enum_products_category NOT NULL, tag enum_products_tag,
      size_guide_p_t varchar, size_guide_e_n varchar
    );
    CREATE TABLE products_sizes (
      _order integer NOT NULL, _parent_id integer NOT NULL, id varchar PRIMARY KEY,
      size enum_products_sizes_size NOT NULL, stock_a_o numeric NOT NULL, stock_p_t numeric NOT NULL
    );
    CREATE TABLE products_colors (_order integer NOT NULL, _parent_id integer NOT NULL, id varchar PRIMARY KEY, color varchar NOT NULL);
    CREATE TABLE payload_locked_documents_rels (id serial PRIMARY KEY);
    INSERT INTO products (category, tag) VALUES ('vestidos', 'NOVIDADE');
    INSERT INTO products_sizes VALUES (1, 1, 'size-1', 'M', 5, 3);
    INSERT INTO products_colors VALUES (1, 1, 'color-1', 'Preto');
  `)
}

async function runMigration(pool: pg.Pool) {
  const db = drizzle(pool)
  await up({ db } as never)
}

test('catalogue migration succeeds from a fresh legacy schema', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createPrerequisites(pool)
    await runMigration(pool)
    const result = await pool.query('SELECT category_id FROM products')
    assert.equal(result.rows.length, 1)
    assert.ok(result.rows[0].category_id)
    assert.equal((await pool.query('SELECT stock_p_t FROM products_variants')).rows[0].stock_p_t, '3')
  })
})

test('catalogue migration is idempotent on an already migrated schema', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createPrerequisites(pool)
    await runMigration(pool)
    await runMigration(pool)
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM categories')).rows[0].count, 4)
  })
})

test('catalogue migration recovers from the production partial state', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createPrerequisites(pool)
    await pool.query(`
      CREATE TABLE categories (id serial PRIMARY KEY, name_p_t varchar);
      CREATE TABLE merch_tags (id serial PRIMARY KEY, label_p_t varchar);
      CREATE TABLE colors (id serial PRIMARY KEY, name varchar);
      DROP TABLE products_sizes;
      DROP TABLE products_colors;
      ALTER TABLE products DROP COLUMN category, DROP COLUMN tag;
    `)
    await runMigration(pool)
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'`)
    assert.ok(columns.rows.some((row) => row.column_name === 'category_id'))
    assert.equal((await pool.query('SELECT count(*)::int AS count FROM categories')).rows[0].count, 4)
  })
})

// Merch tags multi-select (2026-07-31): products.tag goes from a single
// tag_id column to a hasMany relationship, stored by Payload's Postgres
// adapter as a products_rels join table (id, order, parent_id, path,
// merch_tags_id) rather than a column. Confirmed against the real shape by
// generating a full schema snapshot from the post-change config against an
// empty database and diffing it -- the same technique used for the
// migration itself, not just this test.
async function createTagPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE merch_tags (id serial PRIMARY KEY, label_p_t varchar NOT NULL);
    CREATE TABLE products (id serial PRIMARY KEY, name varchar, tag_id integer);
    ALTER TABLE products ADD CONSTRAINT products_tag_id_merch_tags_id_fk
      FOREIGN KEY (tag_id) REFERENCES merch_tags(id) ON DELETE SET NULL;
    CREATE INDEX products_tag_idx ON products (tag_id);
    INSERT INTO merch_tags (label_p_t) VALUES ('Novidade'), ('Bestseller');
    INSERT INTO products (name, tag_id) VALUES ('Vestido Ana', 1), ('Top Bia', NULL);
  `)
}

async function runTagsUp(pool: pg.Pool) {
  const db = drizzle(pool)
  await tagsUp({ db } as never)
}

async function runTagsDown(pool: pg.Pool) {
  const db = drizzle(pool)
  await tagsDown({ db } as never)
}

test('merch tags migration converts each tag_id into a products_rels row', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createTagPrerequisites(pool)
    await runTagsUp(pool)

    // Column gone, replaced by the join table.
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'`)
    assert.ok(!columns.rows.some((row) => row.column_name === 'tag_id'))

    const rels = await pool.query(`SELECT parent_id, path, merch_tags_id FROM products_rels ORDER BY parent_id`)
    assert.equal(rels.rows.length, 1)
    assert.equal(rels.rows[0].path, 'tag')
    assert.equal(rels.rows[0].merch_tags_id, 1)
    // The untagged product got no row at all, not a null one.
    assert.ok(!rels.rows.some((row) => row.parent_id === 2))
  })
})

test('merch tags migration is idempotent and does not duplicate rows', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createTagPrerequisites(pool)
    await runTagsUp(pool)
    await runTagsUp(pool)
    const rels = await pool.query(`SELECT count(*)::int AS count FROM products_rels`)
    assert.equal(rels.rows[0].count, 1)
  })
})

test('merch tags migration down restores a single tag_id per product', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createTagPrerequisites(pool)
    await runTagsUp(pool)

    // Give the tagged product a SECOND tag, only possible in the new shape --
    // proves down deterministically picks one rather than erroring.
    await pool.query(`INSERT INTO products_rels ("order", parent_id, path, merch_tags_id) VALUES (2, 1, 'tag', 2)`)

    await runTagsDown(pool)
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products'`)
    assert.ok(columns.rows.some((row) => row.column_name === 'tag_id'))

    const products = await pool.query(`SELECT id, tag_id FROM products ORDER BY id`)
    assert.equal(products.rows[0].tag_id, 1) // kept the first (order 1) tag
    assert.equal(products.rows[1].tag_id, null)

    assert.equal((await pool.query(`SELECT to_regclass('public.products_rels') AS t`)).rows[0].t, null)
  })
})

// Home hero CTA becomes a picker (2026-07-31 admin bug report: hero
// promoted an "SS26" collection but the button led to the full catalogue).
// heroCtaHref (free text) is replaced by heroCtaType/heroCtaCategorySlug/
// heroCtaTagSlug; existing hrefs are parsed best-effort into the new shape.
async function createHeroPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE home_content (id serial PRIMARY KEY, hero_cta_href varchar);
    CREATE TABLE _home_content_v (id serial PRIMARY KEY, version_hero_cta_href varchar);
    INSERT INTO home_content (id, hero_cta_href) VALUES
      (1, '/catalogo?tag=ss26'),
      (2, '/catalogo?cat=vestidos'),
      (3, '/catalogo');
    INSERT INTO _home_content_v (id, version_hero_cta_href) VALUES (1, '/catalogo?tag=bestseller');
  `)
}

async function runHeroUp(pool: pg.Pool) {
  const db = drizzle(pool)
  await heroUp({ db } as never)
}

async function runHeroDown(pool: pg.Pool) {
  const db = drizzle(pool)
  await heroDown({ db } as never)
}

test('home hero migration parses existing hrefs into type + slug', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createHeroPrerequisites(pool)
    await runHeroUp(pool)

    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'home_content'`)
    assert.ok(!columns.rows.some((row) => row.column_name === 'hero_cta_href'))

    const rows = (await pool.query(`SELECT id, hero_cta_type, hero_cta_category_slug, hero_cta_tag_slug FROM home_content ORDER BY id`)).rows
    assert.deepEqual(rows[0], { id: 1, hero_cta_type: 'tag', hero_cta_category_slug: null, hero_cta_tag_slug: 'ss26' })
    assert.deepEqual(rows[1], { id: 2, hero_cta_type: 'category', hero_cta_category_slug: 'vestidos', hero_cta_tag_slug: null })
    assert.deepEqual(rows[2], { id: 3, hero_cta_type: 'all', hero_cta_category_slug: null, hero_cta_tag_slug: null })

    const versionRow = (await pool.query(`SELECT version_hero_cta_type, version_hero_cta_tag_slug FROM _home_content_v WHERE id = 1`)).rows[0]
    assert.equal(versionRow.version_hero_cta_type, 'tag')
    assert.equal(versionRow.version_hero_cta_tag_slug, 'bestseller')
  })
})

test('home hero migration down rebuilds a working href from type + slug', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createHeroPrerequisites(pool)
    await runHeroUp(pool)
    await runHeroDown(pool)

    const rows = (await pool.query(`SELECT id, hero_cta_href FROM home_content ORDER BY id`)).rows
    assert.equal(rows[0].hero_cta_href, '/catalogo?tag=ss26')
    assert.equal(rows[1].hero_cta_href, '/catalogo?cat=vestidos')
    assert.equal(rows[2].hero_cta_href, '/catalogo')
  })
})

// Free delivery coupon type (2026-07-31): coupons.type gains a new
// 'free_shipping' enum value. Confirms an existing row survives the change
// untouched, the new value can actually be inserted afterward, and running
// up() twice (ADD VALUE IF NOT EXISTS) doesn't error.
async function createCouponsFreeShippingPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TYPE "public"."enum_coupons_type" AS ENUM('percent', 'fixed');
    CREATE TABLE coupons (id serial PRIMARY KEY, code varchar NOT NULL, type "public"."enum_coupons_type" DEFAULT 'percent' NOT NULL);
    INSERT INTO coupons (code, type) VALUES ('SAVE10', 'percent');
  `)
}

async function runFreeShippingUp(pool: pg.Pool) {
  const db = drizzle(pool)
  await freeShippingUp({ db } as never)
}

test('coupons free-shipping migration adds the enum value without disturbing existing rows', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createCouponsFreeShippingPrerequisites(pool)
    await runFreeShippingUp(pool)

    const existing = (await pool.query(`SELECT code, type FROM coupons`)).rows
    assert.deepEqual(existing, [{ code: 'SAVE10', type: 'percent' }])

    await pool.query(`INSERT INTO coupons (code, type) VALUES ('FREESHIP', 'free_shipping')`)
    const inserted = (await pool.query(`SELECT type FROM coupons WHERE code = 'FREESHIP'`)).rows[0]
    assert.equal(inserted.type, 'free_shipping')
  })
})

test('coupons free-shipping migration is idempotent', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createCouponsFreeShippingPrerequisites(pool)
    await runFreeShippingUp(pool)
    await runFreeShippingUp(pool)
    await pool.query(`INSERT INTO coupons (code, type) VALUES ('FREESHIP2', 'free_shipping')`)
    const inserted = (await pool.query(`SELECT type FROM coupons WHERE code = 'FREESHIP2'`)).rows[0]
    assert.equal(inserted.type, 'free_shipping')
  })
})
