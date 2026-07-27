// TEMPORARY diagnostic script -- 2026-07-27 prod migration investigation.
// Dumps payload_migrations rows + whether key tables exist, then exits.
// Safe to delete once the schema-drift mystery (products_variants missing
// despite categories/colors/merch_tags existing) is resolved.
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const migrations = await client.query(
  'SELECT id, name, batch, created_at FROM payload_migrations ORDER BY created_at',
)
console.log('=== payload_migrations ===')
for (const row of migrations.rows) {
  console.log(JSON.stringify(row))
}

const tables = await client.query(
  `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN
   ('products_variants','products_sizes','products_colors','categories','colors','merch_tags','size_guides','payload_locked_documents_rels')
   ORDER BY table_name`,
)
console.log('=== existing tables (of interest) ===')
for (const row of tables.rows) {
  console.log(row.table_name)
}

const columns = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='payload_locked_documents_rels' ORDER BY column_name`,
)
console.log('=== payload_locked_documents_rels columns ===')
for (const row of columns.rows) {
  console.log(row.column_name)
}

await client.end()
console.log('=== DIAGNOSTIC DONE ===')
