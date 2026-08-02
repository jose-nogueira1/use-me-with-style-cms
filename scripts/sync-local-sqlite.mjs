import 'dotenv/config'
import { createClient } from '@libsql/client'

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'

if (!databaseUrl.startsWith('file:')) process.exit(0)

const client = createClient({ url: databaseUrl })

async function columns(table) {
  const result = await client.execute(`PRAGMA table_info(${table})`)
  return new Set(result.rows.map((row) => String(row.name)))
}

const orderColumns = await columns('orders')
const marketColumns = await columns('market_settings')
const productColumns = await columns('products')
const homeColumns = await columns('home_content')
const invoiceSettingsColumns = await columns('invoice_settings')
const invoicesColumns = await columns('invoices')
const legalContentColumns = await columns('legal_content')

if (orderColumns.size === 0 || marketColumns.size === 0) {
  throw new Error('The local SQLite schema is missing. Restore or initialize dev.db before starting the CMS.')
}

const statements = []
if (!orderColumns.has('delivery_region')) statements.push('ALTER TABLE orders ADD COLUMN delivery_region TEXT')
if (!orderColumns.has('ctt_tracking_code')) statements.push('ALTER TABLE orders ADD COLUMN ctt_tracking_code TEXT')
if (!marketColumns.has('portugal_standard_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_standard_shipping_price REAL NOT NULL DEFAULT 4.9')
if (!marketColumns.has('portugal_tracked_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_tracked_shipping_price REAL NOT NULL DEFAULT 6.9')
if (!marketColumns.has('portugal_free_shipping_threshold')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_free_shipping_threshold REAL NOT NULL DEFAULT 75')
if (!marketColumns.has('angola_municipality_prices')) statements.push(`ALTER TABLE market_settings ADD COLUMN angola_municipality_prices TEXT NOT NULL DEFAULT '{"Luanda":3000,"Cacuaco":5000,"Cazenga":3500,"Viana":6000,"Belas":6500,"Talatona":4000,"Mussulo":8000,"Sambizanga":3000,"Rangel":3000,"Maianga":2500,"Samba":3500,"Camama":4500,"Mulenvos":5500,"Kilamba":5000,"Hoji Ya Henda":3500,"Ingombota":2500}'`)
if (!marketColumns.has('angola_free_shipping_threshold')) statements.push('ALTER TABLE market_settings ADD COLUMN angola_free_shipping_threshold REAL NOT NULL DEFAULT 80000')
if (!productColumns.has('shipping_weight_grams')) statements.push('ALTER TABLE products ADD COLUMN shipping_weight_grams REAL NOT NULL DEFAULT 500')
if (!marketColumns.has('portugal_standard_weight_limit_grams')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_standard_weight_limit_grams REAL NOT NULL DEFAULT 2000')
if (!marketColumns.has('portugal_heavy_mainland_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_heavy_mainland_shipping_price REAL NOT NULL DEFAULT 9.9')
if (!marketColumns.has('portugal_heavy_islands_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_heavy_islands_shipping_price REAL NOT NULL DEFAULT 14.9')
// Missing since 20260730_150000_defer_portugal_payments.ts (Postgres-only
// migration, never mirrored here -- found 2026-07-31 while QA-ing orders
// locally: creating a Portugal order crashed with "no such column:
// portugal_payments_enabled" because applyAuthoritativeOrderValues reads
// this global on every order CREATE (checkout), PT or AO -- one
// unconditional query regardless of which fields end up used. Same
// boolean/default as the Postgres migration.
if (!marketColumns.has('portugal_payments_enabled')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_payments_enabled INTEGER NOT NULL DEFAULT false')
// Missing since 20260730_130000_invoice_payment_details.ts (Postgres-only,
// also never mirrored -- found in the same QA pass: confirming an order's
// payment (paymentStatus -> paid) generates an internal invoice
// (internalInvoice.ts), which crashed with "no such column: bank_name"
// because these columns never existed locally. Column names match the
// corrected set from 20260730_140000_fix_invoice_payment_detail_columns.ts
// (Payload's snake_case mapping expands AO/PT to _a_o/_p_t, not _ao/_pt).
const invoiceSettingsBankFields = ['bank_name', 'account_holder', 'bank_account', 'swift_bic', 'payment_instructions']
for (const market of ['a_o', 'p_t']) {
  for (const field of invoiceSettingsBankFields) {
    const col = `${field}_${market}`
    if (!invoiceSettingsColumns.has(col)) statements.push(`ALTER TABLE invoice_settings ADD COLUMN ${col} TEXT`)
  }
}
for (const field of invoiceSettingsBankFields) {
  if (!invoicesColumns.has(field)) statements.push(`ALTER TABLE invoices ADD COLUMN ${field} TEXT`)
}
if (homeColumns.size > 0 && !homeColumns.has('hero_cta_type')) statements.push("ALTER TABLE home_content ADD COLUMN hero_cta_type TEXT DEFAULT 'all'")
if (homeColumns.size > 0 && !homeColumns.has('hero_cta_category_slug')) statements.push('ALTER TABLE home_content ADD COLUMN hero_cta_category_slug TEXT')
if (homeColumns.size > 0 && !homeColumns.has('hero_cta_tag_slug')) statements.push('ALTER TABLE home_content ADD COLUMN hero_cta_tag_slug TEXT')
// Missing since 20260801_110000_legal_content_data_deletion.ts (Postgres-only,
// never mirrored here -- found 2026-08-02 when a fresh `npm run dev` crashed
// every read of the legal-content global, Privacy Policy/Terms included,
// with "no such column: data_deletion_text_p_t". Same lesson as every other
// gap in this file: a Postgres migration alone doesn't touch dev.db.
if (legalContentColumns.size > 0 && !legalContentColumns.has('data_deletion_text_p_t'))
  statements.push('ALTER TABLE legal_content ADD COLUMN data_deletion_text_p_t TEXT')
if (legalContentColumns.size > 0 && !legalContentColumns.has('data_deletion_text_e_n'))
  statements.push('ALTER TABLE legal_content ADD COLUMN data_deletion_text_e_n TEXT')

if (statements.length > 0) await client.batch(statements, 'write')
await client.execute('CREATE INDEX IF NOT EXISTS orders_ctt_tracking_code_idx ON orders(ctt_tracking_code)')

if (statements.length > 0) {
  console.log(`Updated local SQLite schema (${statements.length} column${statements.length === 1 ? '' : 's'} added).`)
}

// Merch tags become multi-select (2026-07-31, admin bug report: "I can only
// select one merchandising tag per item"). products.tag_id (a column)
// becomes a products_rels join table (hasMany relationship) -- the Postgres
// equivalent is src/migrations/20260731_140000_merch_tags_multiselect.ts;
// this is the by-hand SQLite counterpart this repo's dev.db always gets
// (see the ALTER TABLE statements above -- same established pattern, just a
// bigger change than a single column this time).
//
// Gated on products_rels NOT existing yet, rather than tag_id still being
// there -- tag_id is never dropped in SQLite (see comment below), so it
// would stay a truthy check forever and this block would re-run its
// (harmless, but pointless) queries on every single `npm run dev`.
const productsRelsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'products_rels'`)).rows
    .length > 0
let tagMigrated = false
if (!productsRelsExists && productColumns.has('tag_id')) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS products_rels (
      id integer PRIMARY KEY NOT NULL,
      "order" integer,
      parent_id integer NOT NULL,
      path text NOT NULL,
      merch_tags_id integer,
      FOREIGN KEY (parent_id) REFERENCES products(id) ON UPDATE no action ON DELETE cascade,
      FOREIGN KEY (merch_tags_id) REFERENCES merch_tags(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute('CREATE INDEX IF NOT EXISTS products_rels_order_idx ON products_rels ("order")')
  await client.execute('CREATE INDEX IF NOT EXISTS products_rels_parent_idx ON products_rels (parent_id)')
  await client.execute('CREATE INDEX IF NOT EXISTS products_rels_path_idx ON products_rels (path)')
  await client.execute('CREATE INDEX IF NOT EXISTS products_rels_merch_tags_id_idx ON products_rels (merch_tags_id)')

  // One row per product that already had a tag. NOT EXISTS guard makes this
  // safe to run again if the script is interrupted before reaching the
  // products_rels-exists check above next time.
  await client.execute(`
    INSERT INTO products_rels ("order", parent_id, path, merch_tags_id)
    SELECT 1, p.id, 'tag', p.tag_id
    FROM products p
    WHERE p.tag_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM products_rels r WHERE r.parent_id = p.id AND r.path = 'tag' AND r.merch_tags_id = p.tag_id
      )
  `)

  // Not dropping products.tag_id here: SQLite refuses to drop a column
  // that's part of a foreign key definition without rebuilding the whole
  // table (confirmed against this actual database -- "unknown column
  // tag_id in foreign key definition"), and a full table rebuild is a lot
  // of risk for a column that's now simply unused. Payload's queries are
  // driven by the current collection config, which no longer references
  // tag_id, so it just sits there orphaned and harmless. The real
  // production database (Postgres) does drop it -- see that migration.
  tagMigrated = true
}

// Home hero CTA becomes a picker (2026-07-31, admin bug report: hero
// promoted an "SS26" collection but the button led to the full catalogue).
// heroCtaHref (free-text URL) is replaced by heroCtaType/heroCtaCategorySlug/
// heroCtaTagSlug -- see src/migrations/20260731_150000_home_hero_cta_picker.ts
// for the Postgres version and its full reasoning. Best-effort backfill from
// whatever was in hero_cta_href, then the old column is dropped -- unlike
// tag_id, this one isn't part of any foreign key, so SQLite can drop it
// directly without a table rebuild.
if (homeColumns.has('hero_cta_href')) {
  const rows = (await client.execute('SELECT id, hero_cta_href FROM home_content')).rows
  for (const row of rows) {
    const href = row.hero_cta_href ? String(row.hero_cta_href) : ''
    const tagMatch = href.match(/[?&]tag=([^&]+)/)
    const catMatch = href.match(/[?&]cat=([^&]+)/)
    const type = tagMatch ? 'tag' : catMatch ? 'category' : 'all'
    await client.execute({
      sql: 'UPDATE home_content SET hero_cta_type = ?, hero_cta_tag_slug = ?, hero_cta_category_slug = ? WHERE id = ?',
      args: [type, tagMatch ? tagMatch[1] : null, catMatch ? catMatch[1] : null, row.id],
    })
  }
  await client.execute('ALTER TABLE home_content DROP COLUMN hero_cta_href')
  console.log('Converted local SQLite home_content.hero_cta_href into hero_cta_type/hero_cta_category_slug/hero_cta_tag_slug.')
}

// Status-change audit trail (2026-08-01, Orders.ts's new `statusHistory`
// array field -- see src/migrations/20260801_100000_order_status_history.ts
// for the Postgres version). Confirmed empirically: unlike a plain ALTER
// TABLE ADD COLUMN, a brand-new array-field child table is NOT
// auto-created by Payload's SQLite adapter on startup -- querying an order
// immediately failed with "no such table: orders_status_history" until
// this was added. Column shape mirrors orders_items (`_order` integer,
// `_parent_id` integer, `id` text primary key, then the field's own
// columns) -- confirmed against the real local schema via `PRAGMA
// table_info(orders_items)` before writing this.
const statusHistoryExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'orders_status_history'`)).rows
    .length > 0
if (!statusHistoryExists) {
  await client.execute(`
    CREATE TABLE orders_status_history (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      status text NOT NULL,
      changed_at text NOT NULL,
      changed_by text,
      FOREIGN KEY ("_parent_id") REFERENCES orders(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  console.log('Created local SQLite orders_status_history table.')
}

// New global (2026-08-02, Instagram feed curation -- see
// src/migrations/20260802_150000_instagram_spotlight.ts for the Postgres
// version). Entirely new table, not just an added column, so push:false
// means SQLite won't create it on its own -- same situation as
// orders_status_history above, so the same guarded CREATE TABLE approach.
const instagramSpotlightExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'instagram_spotlight'`)).rows
    .length > 0
if (!instagramSpotlightExists) {
  await client.execute(`
    CREATE TABLE instagram_spotlight (
      id integer PRIMARY KEY NOT NULL,
      highlighted_permalink text,
      updated_at text,
      created_at text
    )
  `)
  console.log('Created local SQLite instagram_spotlight table.')
}

// Simplified same day (20260802_180000_instagram_spotlight_simplify.ts) --
// the ordered/labelled entries list turned out to be overkill for what's
// really "highlight one recent post". Two follow-up steps, each guarded so
// a fresh checkout (which creates the table with highlighted_permalink
// already, above) and an existing local dev.db (which still has the old
// shape from before this simplification) both end up correct:
if (instagramSpotlightExists) {
  const instagramSpotlightColumns = await columns('instagram_spotlight')
  if (!instagramSpotlightColumns.has('highlighted_permalink')) {
    await client.execute('ALTER TABLE instagram_spotlight ADD COLUMN highlighted_permalink text')
    console.log('Added highlighted_permalink to local SQLite instagram_spotlight.')
  }
}
const instagramSpotlightEntriesExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'instagram_spotlight_entries'`))
    .rows.length > 0
if (instagramSpotlightEntriesExists) {
  await client.execute('DROP TABLE instagram_spotlight_entries')
  console.log('Dropped local SQLite instagram_spotlight_entries (replaced by a single highlighted_permalink column).')
}

client.close()

if (tagMigrated) {
  console.log('Converted local SQLite products.tag_id into products_rels (merch tags are now multi-select).')
}
