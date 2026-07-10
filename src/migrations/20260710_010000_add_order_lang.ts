import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Adds the `lang` column to the `orders` table (order-confirmation email
// localization follow-up to JOS-61).
//
// `lang` is a `type: 'select'` field on the Orders collection, and Payload's
// Postgres adapter (drizzle-orm) represents single-value select fields as a
// native Postgres ENUM column -- NOT varchar/text -- named
// `enum_<table>_<field>` (verified against
// @payloadcms/drizzle/dist/schema/traverseFields.js and
// @payloadcms/db-postgres's buildDrizzleTable.js). This is different from
// the payment_reference migration (a plain `text` field, correctly varchar)
// -- copying that pattern here would have created a column type mismatch
// against what Payload's query layer expects at runtime, the same class of
// bug that broke the very first production Stripe checkout when the
// payment_reference migration was missing entirely. Guarding both statements
// with existence checks keeps this safe to run against a database that
// somehow already has the type/column (e.g. a future `payload migrate:create`
// diff landing the same change).
export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      CREATE TYPE "public"."enum_orders_lang" AS ENUM ('pt', 'en');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `)
  await db.execute(sql`
    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "lang" "public"."enum_orders_lang" DEFAULT 'pt'::"public"."enum_orders_lang";
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "lang";
  `)
  await db.execute(sql`
    DROP TYPE IF EXISTS "public"."enum_orders_lang";
  `)
}
