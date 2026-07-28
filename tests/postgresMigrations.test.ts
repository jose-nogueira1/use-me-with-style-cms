import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

import { up } from '../src/migrations/20260725_150000_catalogue_taxonomies.ts'

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
