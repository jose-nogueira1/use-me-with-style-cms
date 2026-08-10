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
const messageColumns = await columns('messages')
const productVariantColumns = await columns('products_variants')
const orderItemColumns = await columns('orders_items')
const productImagesColumns = await columns('products_images')
const categoryColumns = await columns('categories')
const storefrontContentColumns = await columns('storefront_content')
const storefrontFaqColumns = await columns('storefront_content_faq_entries')

if (orderColumns.size === 0 || marketColumns.size === 0) {
  throw new Error('The local SQLite schema is missing. Restore or initialize dev.db before starting the CMS.')
}

const statements = []
if (storefrontContentColumns.size === 0) statements.push(`CREATE TABLE storefront_content (
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  faq_title_p_t TEXT DEFAULT 'Perguntas frequentes', faq_title_e_n TEXT DEFAULT 'Frequently asked questions',
  faq_intro_p_t TEXT, faq_intro_e_n TEXT, faq_support_prompt_p_t TEXT, faq_support_prompt_e_n TEXT,
  faq_support_label_p_t TEXT, faq_support_label_e_n TEXT, faq_seo_title_p_t TEXT, faq_seo_title_e_n TEXT,
  faq_seo_description_p_t TEXT, faq_seo_description_e_n TEXT,
  size_guide_title_p_t TEXT, size_guide_title_e_n TEXT, size_guide_intro_p_t TEXT, size_guide_intro_e_n TEXT,
  size_guide_how_to_title_p_t TEXT, size_guide_how_to_title_e_n TEXT,
  size_guide_bust_p_t TEXT, size_guide_bust_e_n TEXT, size_guide_waist_p_t TEXT, size_guide_waist_e_n TEXT,
  size_guide_hip_p_t TEXT, size_guide_hip_e_n TEXT, size_guide_length_p_t TEXT, size_guide_length_e_n TEXT,
  size_guide_closing_p_t TEXT, size_guide_closing_e_n TEXT,
  size_guide_support_label_p_t TEXT, size_guide_support_label_e_n TEXT,
  size_guide_catalog_label_p_t TEXT, size_guide_catalog_label_e_n TEXT,
  size_guide_seo_title_p_t TEXT, size_guide_seo_title_e_n TEXT,
  size_guide_seo_description_p_t TEXT, size_guide_seo_description_e_n TEXT,
  updated_at TEXT DEFAULT (datetime('now')), created_at TEXT DEFAULT (datetime('now'))
)`)
if (storefrontFaqColumns.size === 0) statements.push(`CREATE TABLE storefront_content_faq_entries (
  _order INTEGER NOT NULL, _parent_id INTEGER NOT NULL, id TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER DEFAULT true, question_p_t TEXT NOT NULL, question_e_n TEXT NOT NULL,
  answer_p_t TEXT NOT NULL, answer_e_n TEXT NOT NULL, answer_p_t_p_t TEXT, answer_e_n_p_t TEXT,
  link_path TEXT, link_label_p_t TEXT, link_label_e_n TEXT,
  FOREIGN KEY (_parent_id) REFERENCES storefront_content(id) ON DELETE CASCADE
)`)
if (!orderColumns.has('delivery_region')) statements.push('ALTER TABLE orders ADD COLUMN delivery_region TEXT')
if (!orderColumns.has('ctt_tracking_code')) statements.push('ALTER TABLE orders ADD COLUMN ctt_tracking_code TEXT')
if (!marketColumns.has('portugal_standard_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_standard_shipping_price REAL NOT NULL DEFAULT 4.9')
if (!marketColumns.has('portugal_tracked_shipping_price')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_tracked_shipping_price REAL NOT NULL DEFAULT 6.9')
if (!marketColumns.has('portugal_free_shipping_threshold')) statements.push('ALTER TABLE market_settings ADD COLUMN portugal_free_shipping_threshold REAL NOT NULL DEFAULT 75')
if (!marketColumns.has('angola_municipality_prices')) statements.push(`ALTER TABLE market_settings ADD COLUMN angola_municipality_prices TEXT NOT NULL DEFAULT '{"Luanda":3000,"Cacuaco":5000,"Cazenga":3500,"Viana":6000,"Belas":6500,"Talatona":4000,"Mussulo":8000,"Sambizanga":3000,"Rangel":3000,"Maianga":2500,"Samba":3500,"Camama":4500,"Mulenvos":5500,"Kilamba":5000,"Hoji Ya Henda":3500,"Ingombota":2500}'`)
if (!marketColumns.has('angola_free_shipping_threshold')) statements.push('ALTER TABLE market_settings ADD COLUMN angola_free_shipping_threshold REAL NOT NULL DEFAULT 80000')
if (!productColumns.has('shipping_weight_grams')) statements.push('ALTER TABLE products ADD COLUMN shipping_weight_grams REAL NOT NULL DEFAULT 500')
if (!productColumns.has('product_type')) statements.push("ALTER TABLE products ADD COLUMN product_type TEXT NOT NULL DEFAULT 'standard'")
if (!productColumns.has('option_label_p_t')) statements.push('ALTER TABLE products ADD COLUMN option_label_p_t TEXT')
if (!productColumns.has('option_label_e_n')) statements.push('ALTER TABLE products ADD COLUMN option_label_e_n TEXT')
if (!productColumns.has('return_eligible')) statements.push('ALTER TABLE products ADD COLUMN return_eligible INTEGER DEFAULT true')
if (!productColumns.has('return_note_p_t')) statements.push('ALTER TABLE products ADD COLUMN return_note_p_t TEXT')
if (!productColumns.has('return_note_e_n')) statements.push('ALTER TABLE products ADD COLUMN return_note_e_n TEXT')
if (!orderItemColumns.has('variant_id')) statements.push('ALTER TABLE orders_items ADD COLUMN variant_id TEXT')
if (!orderItemColumns.has('option_label')) statements.push('ALTER TABLE orders_items ADD COLUMN option_label TEXT')
if (!orderItemColumns.has('option_value')) statements.push('ALTER TABLE orders_items ADD COLUMN option_value TEXT')
if (!orderItemColumns.has('product_type')) statements.push("ALTER TABLE orders_items ADD COLUMN product_type TEXT DEFAULT 'standard'")
if (!orderItemColumns.has('inventory_components')) statements.push('ALTER TABLE orders_items ADD COLUMN inventory_components TEXT')
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

// Missing since 20260804_120000_order_customer_name_split.ts (Postgres-only,
// never mirrored here -- found 2026-08-04 when a fresh `npm run dev` crashed
// every order read/list with "no such column: customer_first_name").
if (!orderColumns.has('customer_first_name')) statements.push('ALTER TABLE orders ADD COLUMN customer_first_name TEXT')
if (!orderColumns.has('customer_last_name')) statements.push('ALTER TABLE orders ADD COLUMN customer_last_name TEXT')
// Missing since 20260804_130000_portugal_manual_checkout_instructions.ts.
if (!marketColumns.has('portugal_manual_checkout_instructions_p_t'))
  statements.push('ALTER TABLE market_settings ADD COLUMN portugal_manual_checkout_instructions_p_t TEXT')
if (!marketColumns.has('portugal_manual_checkout_instructions_e_n'))
  statements.push('ALTER TABLE market_settings ADD COLUMN portugal_manual_checkout_instructions_e_n TEXT')
// 20260804_140000_order_manual_whatsapp_payment_method.ts needs no SQLite
// equivalent -- payment_method is unconstrained TEXT here (SQLite has no
// real enum type), same reasoning as the free_shipping coupon type note
// elsewhere in this repo's migrations.
// Missing since 20260804_150000_regional_vat_rates.ts -- same backfill
// (vat_rate_a_o was still sitting at its original 0 default) plus the
// three new PT regional columns. vat_rate_p_t is NOT dropped here (SQLite
// column drops are avoided in this file when not strictly necessary -- see
// the tag_id comment above); it just sits there orphaned and harmless,
// same as tag_id.
if (invoiceSettingsColumns.size > 0) {
  await client.execute('UPDATE invoice_settings SET vat_rate_a_o = 14 WHERE vat_rate_a_o IS NULL OR vat_rate_a_o = 0')
}
if (!invoiceSettingsColumns.has('vat_rate_portugal_mainland'))
  statements.push('ALTER TABLE invoice_settings ADD COLUMN vat_rate_portugal_mainland REAL DEFAULT 23')
if (!invoiceSettingsColumns.has('vat_rate_portugal_madeira'))
  statements.push('ALTER TABLE invoice_settings ADD COLUMN vat_rate_portugal_madeira REAL DEFAULT 22')
if (!invoiceSettingsColumns.has('vat_rate_portugal_azores'))
  statements.push('ALTER TABLE invoice_settings ADD COLUMN vat_rate_portugal_azores REAL DEFAULT 16')
// Missing since 20260804_160000_invoice_vat_region.ts.
if (!invoicesColumns.has('vat_region')) statements.push('ALTER TABLE invoices ADD COLUMN vat_region TEXT')
// Missing since 20260807_200000_product_image_colors.ts (Postgres-only,
// never mirrored here -- found 2026-08-09 in the local devsafe log:
// GET /api/products?...&depth=2 failed on every request with "no such
// column: color_id" because Payload's config (Products.ts images[].color)
// expects this column but push:false means dev.db never picked it up.
// Index added separately below (after the batched ALTER TABLE runs),
// matching the CREATE INDEX IF NOT EXISTS pattern used for the other
// post-batch indexes in this file.
if (!productImagesColumns.has('color_id')) statements.push('ALTER TABLE products_images ADD COLUMN color_id INTEGER REFERENCES colors(id)')
// SEO audit task 8. Production receives these fields and their initial copy
// through the Postgres migration; mirror the schema in the checked-in local
// SQLite database so category reads keep working during local CMS QA.
if (!categoryColumns.has('intro_p_t')) statements.push('ALTER TABLE categories ADD COLUMN intro_p_t TEXT')
if (!categoryColumns.has('intro_e_n')) statements.push('ALTER TABLE categories ADD COLUMN intro_e_n TEXT')
// Messaging/AI fields were introduced through Postgres migrations while the
// checked-in SQLite dev database retained the original Phase 1 table. Keep
// local browser QA on the same schema instead of allowing every inbox query
// to fail at the first missing column.
const localMessageColumns = {
  instagram_context_type: 'TEXT',
  instagram_context_url: 'TEXT',
  instagram_context_permalink: 'TEXT',
  instagram_context_media_type: 'TEXT',
  reply_to_external_id: 'TEXT',
  reply_to_text: 'TEXT',
  admin_read_at: 'TEXT',
  instagram_seen_at: 'TEXT',
  conversation_status: "TEXT DEFAULT 'needs_reply'",
  internal_note: 'TEXT',
  ai_processing_status: 'TEXT',
  ai_attempts: 'REAL',
  ai_available_at: 'TEXT',
  ai_started_at: 'TEXT',
  ai_completed_at: 'TEXT',
  ai_cancelled_at: 'TEXT',
  ai_last_error: 'TEXT',
  ai_draft_status: 'TEXT',
  ai_draft: 'TEXT',
  ai_draft_confidence: 'REAL',
  ai_draft_source_record_ids: 'TEXT',
  ai_draft_reason: 'TEXT',
  ai_market: 'TEXT',
  ai_intent: 'TEXT',
  ai_language: 'TEXT',
  ai_facts: 'TEXT',
  ai_model: 'TEXT',
  ai_request_id: 'TEXT',
  ai_input_tokens: 'REAL',
  ai_output_tokens: 'REAL',
  ai_total_tokens: 'REAL',
  ai_estimated_cost_usd: 'REAL',
  ai_requires_human: 'INTEGER',
  ai_outcome: 'TEXT',
  ai_automation_decision: 'TEXT',
  ai_bot_paused: 'INTEGER',
}
for (const [column, definition] of Object.entries(localMessageColumns)) {
  if (messageColumns.size > 0 && !messageColumns.has(column)) statements.push(`ALTER TABLE messages ADD COLUMN ${column} ${definition}`)
}

if (statements.length > 0) await client.batch(statements, 'write')

await client.execute(`UPDATE categories SET intro_p_t = CASE slug
  WHEN 'vestidos' THEN 'Descubra vestidos desportivos femininos que combinam conforto, movimento e estilo, ideais para treinar ou acompanhar o seu dia em Angola e Portugal.'
  WHEN 'tops' THEN 'Explore tops desportivos femininos com suporte confortável e cortes versáteis, pensados para treinos, caminhadas e looks ativos do dia a dia.'
  WHEN 'leggings' THEN 'Encontre leggings femininas confortáveis e flexíveis, com modelos pensados para acompanhar cada movimento no treino e na rotina diária.'
  WHEN 'conjuntos' THEN 'Descubra conjuntos fitness femininos coordenados que unem conforto e estilo, para um look completo no treino e fora dele.'
  WHEN 'acessorios' THEN 'Complete o seu look ativo com acessórios práticos e elegantes, escolhidos para acompanhar o treino e facilitar a sua rotina.'
  ELSE intro_p_t END
  WHERE (intro_p_t IS NULL OR trim(intro_p_t) = '') AND slug IN ('vestidos', 'tops', 'leggings', 'conjuntos', 'acessorios')`)
await client.execute(`UPDATE categories SET intro_e_n = CASE slug
  WHEN 'vestidos' THEN 'Discover women’s sports dresses that combine comfort, movement and style, ideal for training or everyday wear in Angola and Portugal.'
  WHEN 'tops' THEN 'Explore women’s sports tops with comfortable support and versatile cuts, designed for workouts, walks and everyday active looks.'
  WHEN 'leggings' THEN 'Find comfortable, flexible women’s leggings designed to move with you through every workout and daily routine.'
  WHEN 'conjuntos' THEN 'Discover coordinated women’s fitness sets that bring comfort and style together for a complete look in and out of the gym.'
  WHEN 'acessorios' THEN 'Complete your active look with practical, elegant accessories selected to support your workouts and simplify your routine.'
  ELSE intro_e_n END
  WHERE (intro_e_n IS NULL OR trim(intro_e_n) = '') AND slug IN ('vestidos', 'tops', 'leggings', 'conjuntos', 'acessorios')`)

// Flexible catalogue variants (2026-08-06). SQLite cannot DROP NOT NULL
// from colour/size in place, so rebuild the two array tables once. The row
// IDs and every existing apparel value are copied unchanged.
if (!productVariantColumns.has('sku')) {
  await client.execute('PRAGMA foreign_keys = OFF')
  await client.execute(`
    CREATE TABLE products_variants_flexible (
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      sku text,
      color_id integer,
      size text,
      option_value_e_n text,
      stock_a_o numeric DEFAULT 0 NOT NULL,
      stock_p_t numeric DEFAULT 0 NOT NULL,
      FOREIGN KEY (color_id) REFERENCES colors(id) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`INSERT INTO products_variants_flexible (_order, _parent_id, id, color_id, size, stock_a_o, stock_p_t)
    SELECT _order, _parent_id, id, color_id, size, stock_a_o, stock_p_t FROM products_variants`)
  await client.execute('DROP TABLE products_variants')
  await client.execute('ALTER TABLE products_variants_flexible RENAME TO products_variants')
  await client.execute('CREATE INDEX products_variants_order_idx ON products_variants (_order)')
  await client.execute('CREATE INDEX products_variants_parent_id_idx ON products_variants (_parent_id)')
  await client.execute('CREATE INDEX products_variants_color_idx ON products_variants (color_id)')
  await client.execute('PRAGMA foreign_keys = ON')
}

if (!orderItemColumns.has('variant_id')) {
  await client.execute('PRAGMA foreign_keys = OFF')
  await client.execute(`
    CREATE TABLE orders_items_flexible (
      _order integer NOT NULL,
      _parent_id integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      product_id integer NOT NULL,
      product_name text NOT NULL,
      variant_id text,
      size text,
      option_label text,
      option_value text,
      color text,
      color_id text,
      product_type text DEFAULT 'standard',
      inventory_components text,
      qty numeric NOT NULL,
      unit_price numeric NOT NULL,
      FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE set null,
      FOREIGN KEY (_parent_id) REFERENCES orders(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`INSERT INTO orders_items_flexible (_order, _parent_id, id, product_id, product_name, size, color, color_id, qty, unit_price)
    SELECT _order, _parent_id, id, product_id, product_name, size, color, color_id, qty, unit_price FROM orders_items`)
  await client.execute('DROP TABLE orders_items')
  await client.execute('ALTER TABLE orders_items_flexible RENAME TO orders_items')
  await client.execute('CREATE INDEX orders_items_order_idx ON orders_items (_order)')
  await client.execute('CREATE INDEX orders_items_parent_id_idx ON orders_items (_parent_id)')
  await client.execute('CREATE INDEX orders_items_product_idx ON orders_items (product_id)')
  await client.execute('PRAGMA foreign_keys = ON')
}

await client.execute(`CREATE TABLE IF NOT EXISTS products_specifications (
  _order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL,
  label_p_t text NOT NULL, label_e_n text, value_p_t text NOT NULL, value_e_n text,
  FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE no action ON DELETE cascade
)`)
await client.execute('CREATE INDEX IF NOT EXISTS products_specifications_order_idx ON products_specifications (_order)')
await client.execute('CREATE INDEX IF NOT EXISTS products_specifications_parent_id_idx ON products_specifications (_parent_id)')
await client.execute(`CREATE TABLE IF NOT EXISTS products_bundle_components (
  _order integer NOT NULL, _parent_id integer NOT NULL, id text PRIMARY KEY NOT NULL,
  product_id integer NOT NULL, variant_id text NOT NULL, qty numeric DEFAULT 1 NOT NULL,
  FOREIGN KEY (_parent_id) REFERENCES products(id) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (product_id) REFERENCES products(id) ON UPDATE no action ON DELETE restrict
)`)
await client.execute('CREATE INDEX IF NOT EXISTS products_bundle_components_order_idx ON products_bundle_components (_order)')
await client.execute('CREATE INDEX IF NOT EXISTS products_bundle_components_parent_id_idx ON products_bundle_components (_parent_id)')
await client.execute('CREATE INDEX IF NOT EXISTS products_bundle_components_product_idx ON products_bundle_components (product_id)')
await client.execute('CREATE INDEX IF NOT EXISTS orders_ctt_tracking_code_idx ON orders(ctt_tracking_code)')
await client.execute('CREATE INDEX IF NOT EXISTS products_images_color_idx ON products_images(color_id)')

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

// Authenticated AI messaging controls (20260805_150000). Approval is the
// local default too, so running the dev server never enables auto-send.
const aiMessagingSettingsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_messaging_settings'`)).rows.length > 0
if (!aiMessagingSettingsExists) {
  await client.execute(`
    CREATE TABLE ai_messaging_settings (
      id integer PRIMARY KEY NOT NULL,
      assistant_enabled integer DEFAULT true,
      emergency_stop integer DEFAULT false,
      operating_mode text DEFAULT 'approval' NOT NULL,
      auto_reply_market_clarification integer DEFAULT true,
      auto_reply_product_clarification integer DEFAULT true,
      confidence_threshold real DEFAULT 0.92 NOT NULL,
      reply_delay_seconds real DEFAULT 15 NOT NULL,
      max_auto_replies_per_conversation real DEFAULT 6 NOT NULL,
      max_auto_replies_per_hour real DEFAULT 40 NOT NULL,
      monthly_budget_usd real DEFAULT 25 NOT NULL,
      updated_at text,
      created_at text
    )
  `)
  await client.execute(`
    CREATE TABLE ai_messaging_settings_auto_reply_intents (
      "order" integer NOT NULL,
      parent_id integer NOT NULL,
      value text,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES ai_messaging_settings(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute('CREATE INDEX IF NOT EXISTS ai_messaging_settings_auto_reply_intents_order_idx ON ai_messaging_settings_auto_reply_intents ("order")')
  await client.execute('CREATE INDEX IF NOT EXISTS ai_messaging_settings_auto_reply_intents_parent_idx ON ai_messaging_settings_auto_reply_intents (parent_id)')
  console.log('Created local SQLite ai_messaging_settings tables.')
} else {
  const aiMessagingColumns = await columns('ai_messaging_settings')
  if (!aiMessagingColumns.has('auto_reply_product_clarification')) {
    await client.execute('ALTER TABLE ai_messaging_settings ADD COLUMN auto_reply_product_clarification INTEGER DEFAULT true')
    console.log('Added auto_reply_product_clarification to local SQLite ai_messaging_settings.')
  }
}
const aiMessagingIntentsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'ai_messaging_settings_auto_reply_intents'`)).rows.length > 0
if (!aiMessagingIntentsExists) {
  await client.execute(`
    CREATE TABLE ai_messaging_settings_auto_reply_intents (
      "order" integer NOT NULL,
      parent_id integer NOT NULL,
      value text,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      FOREIGN KEY (parent_id) REFERENCES ai_messaging_settings(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute('CREATE INDEX IF NOT EXISTS ai_messaging_settings_auto_reply_intents_order_idx ON ai_messaging_settings_auto_reply_intents ("order")')
  await client.execute('CREATE INDEX IF NOT EXISTS ai_messaging_settings_auto_reply_intents_parent_idx ON ai_messaging_settings_auto_reply_intents (parent_id)')
}

// Homepage curation (2026-08-04) -- HomeContent's two new array fields
// (homepageCategorySlugs, collections) -- see
// src/migrations/20260804_170000_home_content_curation.ts for the Postgres
// version. Entirely new child tables, same situation as
// orders_status_history/instagram_spotlight above -- SQLite's push:false
// doesn't create these on its own. home_content itself always exists by
// this point (it's seeded on first boot); _home_content_v only exists once
// at least one save has happened (versions.max: 20, from
// 20260725_200000_home_content_versions.ts), so its two versioned
// counterparts are guarded separately and simply skipped until then --
// they'll be created the next time this script runs after that first save.
const homeContentCollectionsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_content_collections'`))
    .rows.length > 0
if (homeColumns.size > 0 && !homeContentCollectionsExists) {
  await client.execute(`
    CREATE TABLE home_content_homepage_category_slugs (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      slug text NOT NULL,
      FOREIGN KEY ("_parent_id") REFERENCES home_content(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`
    CREATE TABLE home_content_collections (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      tag_slug text NOT NULL,
      title_p_t text NOT NULL,
      title_e_n text NOT NULL,
      item_limit numeric DEFAULT 8,
      FOREIGN KEY ("_parent_id") REFERENCES home_content(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  console.log('Created local SQLite home_content_homepage_category_slugs/home_content_collections tables.')
}
const homeContentVersionsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_home_content_v'`)).rows
    .length > 0

// _home_content_v (the version-snapshot table) never got the same
// hero_cta_href -> hero_cta_type/category/tag conversion that home_content
// itself got above -- the 20260731_150000_home_hero_cta_picker.ts migration
// covers both tables on Postgres, but this file's mirror of it (the
// `hero_cta_href` block above) only ever touched `home_content`. Sat latent
// since 2026-07-31 because nothing had exercised a Home Page save (which
// always also writes a version row) until 2026-08-04, when it surfaced as
// "table _home_content_v has no column named version_hero_cta_type" on
// every save AND "no such column: version_hero_cta_type" on every load of
// Previous Versions -- both looked like an auth/login problem in the admin
// UI (generic error message) but were this schema gap. Same best-effort
// href-parsing backfill as the home_content block, mirrored onto the
// version_-prefixed columns.
if (homeContentVersionsExists) {
  const versionColumns = await columns('_home_content_v')
  if (versionColumns.has('version_hero_cta_href')) {
    await client.execute("ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_type TEXT DEFAULT 'all'")
    await client.execute('ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_category_slug TEXT')
    await client.execute('ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_tag_slug TEXT')
    const versionRows = (await client.execute('SELECT id, version_hero_cta_href FROM _home_content_v')).rows
    for (const row of versionRows) {
      const href = row.version_hero_cta_href ? String(row.version_hero_cta_href) : ''
      const tagMatch = href.match(/[?&]tag=([^&]+)/)
      const catMatch = href.match(/[?&]cat=([^&]+)/)
      const type = tagMatch ? 'tag' : catMatch ? 'category' : 'all'
      await client.execute({
        sql: 'UPDATE _home_content_v SET version_hero_cta_type = ?, version_hero_cta_tag_slug = ?, version_hero_cta_category_slug = ? WHERE id = ?',
        args: [type, tagMatch ? tagMatch[1] : null, catMatch ? catMatch[1] : null, row.id],
      })
    }
    await client.execute('ALTER TABLE _home_content_v DROP COLUMN version_hero_cta_href')
    console.log(
      'Converted local SQLite _home_content_v.version_hero_cta_href into version_hero_cta_type/version_hero_cta_category_slug/version_hero_cta_tag_slug.',
    )
  } else if (!versionColumns.has('version_hero_cta_type')) {
    // Table exists (a save happened) but has neither the old nor new
    // columns -- e.g. the very first version row, created before
    // heroCtaType existed. No href to backfill from, so just add the
    // columns bare.
    await client.execute("ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_type TEXT DEFAULT 'all'")
    await client.execute('ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_category_slug TEXT')
    await client.execute('ALTER TABLE _home_content_v ADD COLUMN version_hero_cta_tag_slug TEXT')
    console.log('Added version_hero_cta_type/version_hero_cta_category_slug/version_hero_cta_tag_slug to local SQLite _home_content_v.')
  }
}

const homeContentVersionCollectionsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_home_content_v_version_collections'`))
    .rows.length > 0
if (homeContentVersionsExists && !homeContentVersionCollectionsExists) {
  await client.execute(`
    CREATE TABLE "_home_content_v_version_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug text NOT NULL,
      _uuid text,
      FOREIGN KEY ("_parent_id") REFERENCES "_home_content_v"(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_content_v_version_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      tag_slug text NOT NULL,
      title_p_t text NOT NULL,
      title_e_n text NOT NULL,
      item_limit numeric DEFAULT 8,
      _uuid text,
      FOREIGN KEY ("_parent_id") REFERENCES "_home_content_v"(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  console.log('Created local SQLite _home_content_v_version_homepage_category_slugs/_home_content_v_version_collections tables.')
}

// Splits home-content into home-hero / home-categories / home-collections
// (2026-08-04, admin feedback after living with the combined version panel
// for a few hours: "I don't like the previous versions is a global preview
// of the whole home page... it should have previous versions of just each
// individually") -- see src/migrations/20260804_180000_home_content_split.ts
// for the Postgres version and its full reasoning/column-shape provenance.
// Same guarded-create-plus-backfill approach as every other new-table
// addition in this file; the OLD home_content/_home_content_v tables and
// their child tables are deliberately left in place, unreferenced, exactly
// as the Postgres migration does.
const homeHeroExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_hero'`)).rows.length > 0
if (homeColumns.size > 0 && !homeHeroExists) {
  await client.execute(`
    CREATE TABLE "home_hero" (
      id integer PRIMARY KEY NOT NULL,
      hero_eyebrow_p_t text DEFAULT 'Coleção SS26',
      hero_eyebrow_e_n text DEFAULT 'SS26 Collection',
      hero_headline_p_t text DEFAULT 'Moda que se move consigo.',
      hero_headline_e_n text DEFAULT 'Fashion that moves with you.',
      hero_subtitle_p_t text,
      hero_subtitle_e_n text,
      hero_cta_label_p_t text DEFAULT 'Ver tudo',
      hero_cta_label_e_n text DEFAULT 'Shop all',
      hero_cta_type text DEFAULT 'all',
      hero_cta_category_slug text,
      hero_cta_tag_slug text,
      hero_image_id integer,
      updated_at text,
      created_at text,
      FOREIGN KEY (hero_image_id) REFERENCES media(id) ON UPDATE no action ON DELETE set null
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_hero_v" (
      id integer PRIMARY KEY NOT NULL,
      version_hero_eyebrow_p_t text,
      version_hero_eyebrow_e_n text,
      version_hero_headline_p_t text,
      version_hero_headline_e_n text,
      version_hero_subtitle_p_t text,
      version_hero_subtitle_e_n text,
      version_hero_cta_label_p_t text,
      version_hero_cta_label_e_n text,
      version_hero_cta_type text DEFAULT 'all',
      version_hero_cta_category_slug text,
      version_hero_cta_tag_slug text,
      version_hero_image_id integer,
      version_updated_at text,
      version_created_at text,
      created_at text,
      updated_at text,
      FOREIGN KEY (version_hero_image_id) REFERENCES media(id) ON UPDATE no action ON DELETE set null
    )
  `)
  await client.execute(`
    INSERT INTO home_hero (
      hero_eyebrow_p_t, hero_eyebrow_e_n, hero_headline_p_t, hero_headline_e_n,
      hero_subtitle_p_t, hero_subtitle_e_n, hero_cta_label_p_t, hero_cta_label_e_n,
      hero_cta_type, hero_cta_category_slug, hero_cta_tag_slug, hero_image_id, updated_at, created_at
    )
    SELECT
      hero_eyebrow_p_t, hero_eyebrow_e_n, hero_headline_p_t, hero_headline_e_n,
      hero_subtitle_p_t, hero_subtitle_e_n, hero_cta_label_p_t, hero_cta_label_e_n,
      hero_cta_type, hero_cta_category_slug, hero_cta_tag_slug, hero_image_id, updated_at, created_at
    FROM home_content
  `)
  await client.execute(`
    INSERT INTO _home_hero_v (
      version_hero_eyebrow_p_t, version_hero_eyebrow_e_n, version_hero_headline_p_t, version_hero_headline_e_n,
      version_hero_subtitle_p_t, version_hero_subtitle_e_n, version_hero_cta_label_p_t, version_hero_cta_label_e_n,
      version_hero_cta_type, version_hero_cta_category_slug, version_hero_cta_tag_slug, version_hero_image_id,
      version_updated_at, version_created_at, created_at, updated_at
    )
    SELECT
      version_hero_eyebrow_p_t, version_hero_eyebrow_e_n, version_hero_headline_p_t, version_hero_headline_e_n,
      version_hero_subtitle_p_t, version_hero_subtitle_e_n, version_hero_cta_label_p_t, version_hero_cta_label_e_n,
      version_hero_cta_type, version_hero_cta_category_slug, version_hero_cta_tag_slug, version_hero_image_id,
      version_updated_at, version_created_at, created_at, updated_at
    FROM _home_content_v
  `)
  console.log('Created local SQLite home_hero/_home_hero_v tables and backfilled from home_content/_home_content_v.')
}

const homeCategoriesExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_categories'`)).rows.length > 0
if (homeColumns.size > 0 && !homeCategoriesExists) {
  await client.execute(`CREATE TABLE "home_categories" (id integer PRIMARY KEY NOT NULL, updated_at text, created_at text)`)
  await client.execute(`
    CREATE TABLE "home_categories_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      slug text NOT NULL,
      FOREIGN KEY ("_parent_id") REFERENCES home_categories(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_categories_v" (
      id integer PRIMARY KEY NOT NULL,
      version_updated_at text,
      version_created_at text,
      created_at text,
      updated_at text
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_categories_v_version_homepage_category_slugs" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      slug text NOT NULL,
      _uuid text,
      FOREIGN KEY ("_parent_id") REFERENCES "_home_categories_v"(id) ON UPDATE no action ON DELETE cascade
    )
  `)

  await client.execute(`INSERT INTO home_categories (updated_at, created_at) SELECT updated_at, created_at FROM home_content`)
  const newCategoriesParent = (await client.execute('SELECT id FROM home_categories LIMIT 1')).rows[0]
  if (newCategoriesParent) {
    await client.execute({
      sql: 'INSERT INTO home_categories_homepage_category_slugs ("_order", "_parent_id", id, slug) SELECT "_order", ?, id, slug FROM home_content_homepage_category_slugs',
      args: [newCategoriesParent.id],
    })
  }

  // Versions need a temporary passenger column to correlate old
  // _home_content_v.id -> new _home_categories_v.id across the copy, since
  // the new table's id must be freshly assigned (reusing the old numeric id
  // would collide with this table's own autoincrement the first time a real
  // save creates a new version row).
  await client.execute('ALTER TABLE _home_categories_v ADD COLUMN _migration_old_id integer')
  await client.execute(`
    INSERT INTO _home_categories_v (version_updated_at, version_created_at, created_at, updated_at, _migration_old_id)
    SELECT version_updated_at, version_created_at, created_at, updated_at, id FROM _home_content_v
  `)
  await client.execute(`
    INSERT INTO _home_categories_v_version_homepage_category_slugs ("_order", "_parent_id", slug, _uuid)
    SELECT c."_order", n.id, c.slug, c._uuid
    FROM _home_content_v_version_homepage_category_slugs c
    JOIN _home_categories_v n ON n._migration_old_id = c."_parent_id"
  `)
  await client.execute('ALTER TABLE _home_categories_v DROP COLUMN _migration_old_id')
  console.log('Created local SQLite home_categories/_home_categories_v tables and backfilled from home_content/_home_content_v.')
}

const homeCollectionsExists =
  (await client.execute(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'home_collections'`)).rows.length > 0
if (homeColumns.size > 0 && !homeCollectionsExists) {
  await client.execute(`CREATE TABLE "home_collections" (id integer PRIMARY KEY NOT NULL, updated_at text, created_at text)`)
  await client.execute(`
    CREATE TABLE "home_collections_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id text PRIMARY KEY NOT NULL,
      tag_slug text NOT NULL,
      title_p_t text NOT NULL,
      title_e_n text NOT NULL,
      item_limit numeric DEFAULT 8,
      FOREIGN KEY ("_parent_id") REFERENCES home_collections(id) ON UPDATE no action ON DELETE cascade
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_collections_v" (
      id integer PRIMARY KEY NOT NULL,
      version_updated_at text,
      version_created_at text,
      created_at text,
      updated_at text
    )
  `)
  await client.execute(`
    CREATE TABLE "_home_collections_v_version_collections" (
      "_order" integer NOT NULL,
      "_parent_id" integer NOT NULL,
      id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      tag_slug text NOT NULL,
      title_p_t text NOT NULL,
      title_e_n text NOT NULL,
      item_limit numeric DEFAULT 8,
      _uuid text,
      FOREIGN KEY ("_parent_id") REFERENCES "_home_collections_v"(id) ON UPDATE no action ON DELETE cascade
    )
  `)

  await client.execute(`INSERT INTO home_collections (updated_at, created_at) SELECT updated_at, created_at FROM home_content`)
  const newCollectionsParent = (await client.execute('SELECT id FROM home_collections LIMIT 1')).rows[0]
  if (newCollectionsParent) {
    await client.execute({
      sql: 'INSERT INTO home_collections_collections ("_order", "_parent_id", id, tag_slug, title_p_t, title_e_n, item_limit) SELECT "_order", ?, id, tag_slug, title_p_t, title_e_n, item_limit FROM home_content_collections',
      args: [newCollectionsParent.id],
    })
  }

  await client.execute('ALTER TABLE _home_collections_v ADD COLUMN _migration_old_id integer')
  await client.execute(`
    INSERT INTO _home_collections_v (version_updated_at, version_created_at, created_at, updated_at, _migration_old_id)
    SELECT version_updated_at, version_created_at, created_at, updated_at, id FROM _home_content_v
  `)
  await client.execute(`
    INSERT INTO _home_collections_v_version_collections ("_order", "_parent_id", tag_slug, title_p_t, title_e_n, item_limit, _uuid)
    SELECT c."_order", n.id, c.tag_slug, c.title_p_t, c.title_e_n, c.item_limit, c._uuid
    FROM _home_content_v_version_collections c
    JOIN _home_collections_v n ON n._migration_old_id = c."_parent_id"
  `)
  await client.execute('ALTER TABLE _home_collections_v DROP COLUMN _migration_old_id')
  console.log('Created local SQLite home_collections/_home_collections_v tables and backfilled from home_content/_home_content_v.')
}

client.close()

if (tagMigrated) {
  console.log('Converted local SQLite products.tag_id into products_rels (merch tags are now multi-select).')
}
