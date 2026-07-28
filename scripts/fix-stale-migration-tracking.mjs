// ONE-OFF fix -- 2026-07-27/28 prod migration investigation.
//
// payload_migrations incorrectly records '20260725_150000_catalogue_taxonomies'
// as fully applied. Confirmed via scripts/diagnose-prod-schema.mjs's boot dump:
// categories/colors/merch_tags exist with real data (an earlier, shorter
// version of this migration's content ran successfully at some point), but
// size_guides, products_variants, and 4 FK columns on
// payload_locked_documents_rels do not exist -- consistent with the migration
// file being expanded with more DDL AFTER that earlier partial run was
// already recorded as done, so every later `payload migrate` skipped it.
//
// Every statement in that migration is written to be safely re-runnable
// (IF NOT EXISTS / ON CONFLICT DO NOTHING / WHERE NOT EXISTS / exception-
// swallowing DO blocks for constraints), so deleting its tracking row and
// letting `payload migrate` re-run it for real is safe and lossless by
// design -- confirmed with the user before running this in prod.
//
// Safe to delete this file once confirmed the re-run succeeded.
import pg from 'pg'

const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
await client.connect()

const before = await client.query(
  "SELECT id, name FROM payload_migrations WHERE name = '20260725_150000_catalogue_taxonomies'",
)
console.log('=== before delete ===')
console.log(JSON.stringify(before.rows))

if (before.rows.length > 0) {
  const del = await client.query(
    "DELETE FROM payload_migrations WHERE name = '20260725_150000_catalogue_taxonomies'",
  )
  console.log(`=== deleted ${del.rowCount} row(s) ===`)
} else {
  console.log('=== no matching row found, nothing to delete ===')
}

await client.end()
console.log('=== FIX SCRIPT DONE ===')
