// EMERGENCY restore -- 2026-07-28 prod outage.
//
// Earlier tonight, scripts/fix-stale-migration-tracking.mjs deleted the
// payload_migrations tracking row for '20260725_150000_catalogue_taxonomies'
// so `payload migrate` would re-run it, on the assumption every statement
// was safely re-runnable via CREATE TABLE IF NOT EXISTS / ON CONFLICT DO
// NOTHING. That assumption was wrong: the "colors" (and likely
// "categories"/"merch_tags") table already existing in prod was created by
// an EARLIER, narrower version of this migration's SQL, with a different
// column set. CREATE TABLE IF NOT EXISTS silently no-ops against a table
// that already exists -- it does NOT add missing columns -- so the
// migration's later references to colors."name" throw a real Postgres
// error ("column \"name\" does not exist"), crashing every boot attempt
// tonight and taking prod down (confirmed via deploy logs showing the
// actual stack trace, not just Railway's log-rate-limit noise seen
// earlier).
//
// Restoring prod to its last known-stable state: re-insert the tracking row
// so `payload migrate` treats this migration as already applied again (the
// same state every deploy was in before tonight's investigation started --
// site up, though /api/products and anything touching products_variants
// still errors with "relation products_variants does not exist", a
// pre-existing, already-tolerated issue, NOT a full crash/502).
//
// This does NOT fix the underlying schema mismatch. It also dumps the
// REAL current columns on colors/categories/merch_tags so the follow-up
// fix (rewriting the migration to ALTER these tables into shape instead of
// assuming CREATE TABLE will do it) can be based on fact, not guesswork.
//
// Safe to delete this file once the real fix is confirmed and deployed.
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const maxBatchResult = await client.query(
  'SELECT COALESCE(MAX(batch), 0) AS max FROM payload_migrations',
)
const batch = Number(maxBatchResult.rows[0].max) || 1

const existing = await client.query(
  "SELECT id FROM payload_migrations WHERE name = '20260725_150000_catalogue_taxonomies'",
)
console.log('=== existing tracking row check ===')
console.log(JSON.stringify(existing.rows))

if (existing.rows.length === 0) {
  await client.query(
    'INSERT INTO payload_migrations (name, batch, updated_at, created_at) VALUES ($1, $2, now(), now())',
    ['20260725_150000_catalogue_taxonomies', batch],
  )
  console.log(`=== re-inserted tracking row, batch ${batch} ===`)
} else {
  console.log('=== tracking row already present, nothing to do ===')
}

for (const table of ['colors', 'categories', 'merch_tags', 'size_guides']) {
  const tableExists = await client.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1`,
    [table],
  )
  if (tableExists.rows.length === 0) {
    console.log(`=== ${table}: TABLE DOES NOT EXIST ===`)
    continue
  }
  const cols = await client.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY column_name`,
    [table],
  )
  console.log(`=== ${table} columns ===`)
  for (const row of cols.rows) console.log(JSON.stringify(row))
}

await client.end()
console.log('=== RESTORE SCRIPT DONE ===')
