import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

import { up } from '../src/migrations/20260725_150000_catalogue_taxonomies.ts'
import { up as tagsUp, down as tagsDown } from '../src/migrations/20260731_140000_merch_tags_multiselect.ts'
import { up as heroUp, down as heroDown } from '../src/migrations/20260731_150000_home_hero_cta_picker.ts'
import { up as freeShippingUp } from '../src/migrations/20260731_160000_coupons_free_shipping.ts'
import { up as legalDataDeletionUp } from '../src/migrations/20260801_110000_legal_content_data_deletion.ts'
import { up as homeContentCurationUp, down as homeContentCurationDown } from '../src/migrations/20260804_170000_home_content_curation.ts'
import { up as fixColorsLegacyNameUp } from '../src/migrations/20260806_160000_fix_colors_legacy_name.ts'

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

test('colour legacy-name migration removes the stale required column and permits bilingual inserts', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await pool.query(`
      CREATE TABLE colors (
        id serial PRIMARY KEY,
        name_p_t varchar NOT NULL,
        name_e_n varchar,
        hex varchar,
        name varchar NOT NULL
      );
      INSERT INTO colors (name_p_t, name_e_n, hex, name)
      VALUES ('Preto', 'Black', '#000000', 'Preto');
    `)

    const db = drizzle(pool)
    await fixColorsLegacyNameUp({ db } as never)
    await fixColorsLegacyNameUp({ db } as never)

    const columns = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'colors'
    `)
    assert.ok(!columns.rows.some((row) => row.column_name === 'name'))

    await pool.query(`
      INSERT INTO colors (name_p_t, name_e_n, hex)
      VALUES ('Mostarda', 'Mustard', '#F0A919')
    `)
    const rows = await pool.query('SELECT name_p_t, name_e_n, hex FROM colors ORDER BY id')
    assert.deepEqual(rows.rows, [
      { name_p_t: 'Preto', name_e_n: 'Black', hex: '#000000' },
      { name_p_t: 'Mostarda', name_e_n: 'Mustard', hex: '#F0A919' },
    ])
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

// Live incident, 2026-08-01: production had a "products_rels" table that
// already existed WITHOUT "merch_tags_id" by the time this migration first
// ran for real -- CREATE TABLE IF NOT EXISTS was a no-op against it, so the
// very next CREATE INDEX on that column crashed the app on every single
// deploy from then on (this migration's statements were never wrapped in a
// transaction, so a table created via CREATE TABLE IF NOT EXISTS without
// merch_tags_id is exactly the kind of state a mid-batch failure on an
// earlier attempt could leave behind). Reproduces that exact broken state
// and confirms the ADD COLUMN IF NOT EXISTS fix recovers from it, same
// "partial state" pattern already covered for the catalogue migration above.
test('merch tags migration recovers from a products_rels table missing merch_tags_id', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createTagPrerequisites(pool)
    await pool.query(`
      CREATE TABLE "products_rels" (
        "id" serial PRIMARY KEY NOT NULL,
        "order" integer,
        "parent_id" integer NOT NULL,
        "path" varchar NOT NULL
      );
    `)
    await runTagsUp(pool)
    const columns = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'products_rels'`)
    assert.ok(columns.rows.some((row) => row.column_name === 'merch_tags_id'))
    const rels = await pool.query(`SELECT parent_id, path, merch_tags_id FROM products_rels ORDER BY parent_id`)
    assert.equal(rels.rows.length, 1)
    assert.equal(rels.rows[0].merch_tags_id, 1)
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

// Live incident, 2026-08-01: dataDeletionTextPT/EN were added to the
// legal-content global (LegalContent.ts) without a matching migration.
// Production's "legal_content" table never got the columns, so Payload's
// generated SELECT for the whole global started failing with a 500 --
// not just the new field, but Privacy Policy and Terms too, since all
// three live on the same row. Confirmed live: usemewithstyle.shop
// /politica-privacidade was stuck on "A carregar..." forever until this
// migration ran. Reproduces the production table (pre-fix shape, from
// 20260724_170000_legal_content) and confirms the ADD COLUMN IF NOT
// EXISTS fix both adds the columns and leaves the existing PT/EN privacy
// and terms text completely untouched.
async function createLegalContentPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE "legal_content" (
      "id" serial PRIMARY KEY NOT NULL,
      "privacy_policy_text_p_t" varchar,
      "privacy_policy_text_e_n" varchar,
      "terms_text_p_t" varchar,
      "terms_text_e_n" varchar,
      "updated_at" timestamp(3) with time zone,
      "created_at" timestamp(3) with time zone
    );
    INSERT INTO legal_content (id, privacy_policy_text_p_t, terms_text_e_n)
    VALUES (1, 'Texto de privacidade real.', 'Real terms text.');
  `)
}

async function runLegalDataDeletionUp(pool: pg.Pool) {
  const db = drizzle(pool)
  await legalDataDeletionUp({ db } as never)
}

test('legal content data-deletion migration adds the missing columns without touching existing text', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createLegalContentPrerequisites(pool)
    await runLegalDataDeletionUp(pool)

    const columns = (await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'legal_content'`)).rows.map((row) => row.column_name)
    assert.ok(columns.includes('data_deletion_text_p_t'))
    assert.ok(columns.includes('data_deletion_text_e_n'))

    const row = (await pool.query(`SELECT privacy_policy_text_p_t, terms_text_e_n, data_deletion_text_p_t FROM legal_content WHERE id = 1`)).rows[0]
    assert.equal(row.privacy_policy_text_p_t, 'Texto de privacidade real.')
    assert.equal(row.terms_text_e_n, 'Real terms text.')
    assert.equal(row.data_deletion_text_p_t, null)
  })
})

// Homepage curation (2026-08-04): two new array fields on home-content --
// homepageCategorySlugs and collections (tag-driven shelves) -- each gets
// its own child rows table (+ a versioned counterpart, since versions.max:
// 20 is enabled on this global), same pattern as products_variants/
// orders_items. Shape confirmed by generating the real schema `payload
// migrate:create` produces for an empty database and taking these 4 tables'
// definitions verbatim -- notably the _home_content_v_version_* tables use
// a serial id plus an extra _uuid column, not something to guess by hand.
async function createHomeContentCurationPrerequisites(pool: pg.Pool) {
  await pool.query(`
    CREATE TABLE "home_content" (id serial PRIMARY KEY);
    CREATE TABLE "_home_content_v" (id serial PRIMARY KEY);
    INSERT INTO home_content DEFAULT VALUES;
  `)
}

async function runHomeContentCurationUp(pool: pg.Pool) {
  const db = drizzle(pool)
  await homeContentCurationUp({ db } as never)
}

async function runHomeContentCurationDown(pool: pg.Pool) {
  const db = drizzle(pool)
  await homeContentCurationDown({ db } as never)
}

test('home content curation migration creates category/collection shelf tables that accept real rows', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createHomeContentCurationPrerequisites(pool)
    await runHomeContentCurationUp(pool)

    // Live tables use a text (nanoid) primary key, same as every other
    // non-versioned Payload array table in this codebase.
    await pool.query(
      `INSERT INTO home_content_homepage_category_slugs (_order, _parent_id, id, slug) VALUES (1, 1, 'row-1', 'vestidos')`,
    )
    await pool.query(
      `INSERT INTO home_content_collections (_order, _parent_id, id, tag_slug, title_p_t, title_e_n, item_limit)
       VALUES (1, 1, 'row-2', 'ss26', 'Verão SS26', 'Summer SS26', 12)`,
    )
    const cat = (await pool.query(`SELECT slug FROM home_content_homepage_category_slugs WHERE _parent_id = 1`)).rows[0]
    assert.equal(cat.slug, 'vestidos')
    const coll = (await pool.query(`SELECT tag_slug, title_p_t, item_limit FROM home_content_collections WHERE _parent_id = 1`)).rows[0]
    assert.equal(coll.tag_slug, 'ss26')
    assert.equal(coll.title_p_t, 'Verão SS26')
    assert.equal(coll.item_limit, '12')

    // itemLimit's schema default (8) applies when a row omits it.
    await pool.query(
      `INSERT INTO home_content_collections (_order, _parent_id, id, tag_slug, title_p_t, title_e_n)
       VALUES (2, 1, 'row-3', 'bestseller', 'Mais vendidos', 'Bestsellers')`,
    )
    const defaulted = (await pool.query(`SELECT item_limit FROM home_content_collections WHERE id = 'row-3'`)).rows[0]
    assert.equal(defaulted.item_limit, '8')

    // Deleting the parent home_content row cascades to its child rows (ON
    // DELETE cascade), same as every other array-field table in this repo.
    await pool.query(`DELETE FROM home_content WHERE id = 1`)
    const remaining = await pool.query(`SELECT count(*)::int AS n FROM home_content_collections`)
    assert.equal(remaining.rows[0].n, 0)
  })
})

test('home content curation migration is idempotent and down() cleanly removes the new tables', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createHomeContentCurationPrerequisites(pool)
    await runHomeContentCurationUp(pool)
    await runHomeContentCurationUp(pool) // must not error the second time

    await runHomeContentCurationDown(pool)
    const tables = (
      await pool.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'home_content_%' OR table_name LIKE '_home_content_v_version_%'`)
    ).rows.map((row) => row.table_name)
    assert.equal(tables.length, 0)
  })
})

test('legal content data-deletion migration is idempotent', { skip: !adminUrl }, async () => {
  await withDatabase(async (pool) => {
    await createLegalContentPrerequisites(pool)
    await runLegalDataDeletionUp(pool)
    await runLegalDataDeletionUp(pool)
    await pool.query(`UPDATE legal_content SET data_deletion_text_p_t = 'ok' WHERE id = 1`)
    const row = (await pool.query(`SELECT data_deletion_text_p_t FROM legal_content WHERE id = 1`)).rows[0]
    assert.equal(row.data_deletion_text_p_t, 'ok')
  })
})
