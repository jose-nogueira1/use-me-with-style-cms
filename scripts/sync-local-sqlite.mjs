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

if (statements.length > 0) await client.batch(statements, 'write')
await client.execute('CREATE INDEX IF NOT EXISTS orders_ctt_tracking_code_idx ON orders(ctt_tracking_code)')
client.close()

if (statements.length > 0) {
  console.log(`Updated local SQLite schema (${statements.length} column${statements.length === 1 ? '' : 's'} added).`)
}
