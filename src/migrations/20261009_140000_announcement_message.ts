import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// The announcement bar's "free delivery" line becomes a message the admin writes
// (2026-10-09): the columns are renamed delivery -> message, and the switch now
// starts OFF. Rows keep their data, but a row that was on with no custom text
// (the old automatic "free delivery over ..." wording) is switched off, since
// that wording no longer exists.
const COLUMNS = ['enabled', 'text_pt', 'text_en'] as const
const MARKETS = ['angola', 'portugal'] as const

// Renames only the columns that exist, so a repeated run is a no-op.
const rename = async (db: MigrateUpArgs['db'], from: string, to: string) => {
  const found = await db.execute(sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'announcement_banner'`)
  const existing = new Set((found.rows as Array<{ column_name: string }>).map((row) => row.column_name))
  for (const market of MARKETS) {
    for (const column of COLUMNS) {
      const old = `${market}_${from}_${column}`
      if (existing.has(old)) await db.execute(sql.raw(`ALTER TABLE "announcement_banner" RENAME COLUMN "${old}" TO "${market}_${to}_${column}"`))
    }
  }
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await rename(db, 'delivery', 'message')
  await db.execute(sql`
    ALTER TABLE "announcement_banner"
      ALTER COLUMN "angola_message_enabled" SET DEFAULT false,
      ALTER COLUMN "portugal_message_enabled" SET DEFAULT false;
    UPDATE "announcement_banner" SET "angola_message_enabled" = false
      WHERE COALESCE("angola_message_text_pt", '') = '' AND COALESCE("angola_message_text_en", '') = '';
    UPDATE "announcement_banner" SET "portugal_message_enabled" = false
      WHERE COALESCE("portugal_message_text_pt", '') = '' AND COALESCE("portugal_message_text_en", '') = '';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await rename(db, 'message', 'delivery')
  await db.execute(sql`
    ALTER TABLE "announcement_banner"
      ALTER COLUMN "angola_delivery_enabled" SET DEFAULT true,
      ALTER COLUMN "portugal_delivery_enabled" SET DEFAULT true;
  `)
}
