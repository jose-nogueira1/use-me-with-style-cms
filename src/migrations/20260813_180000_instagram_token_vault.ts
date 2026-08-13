import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "instagram_token_vault" (
      "id" serial PRIMARY KEY NOT NULL,
      "ciphertext" varchar NOT NULL,
      "expires_at" timestamp(3) with time zone NOT NULL,
      "last_refreshed_at" timestamp(3) with time zone,
      "last_attempt_at" timestamp(3) with time zone,
      "last_error" varchar,
      "last_alert_at" timestamp(3) with time zone,
      "last_alert_threshold" numeric,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "instagram_token_vault_updated_at_idx" ON "instagram_token_vault" USING btree ("updated_at");
    CREATE INDEX IF NOT EXISTS "instagram_token_vault_created_at_idx" ON "instagram_token_vault" USING btree ("created_at");
  `)
}

export async function down({ db }: MigrateDownArgs) {
  await db.execute(sql`DROP TABLE IF EXISTS "instagram_token_vault" CASCADE;`)
}
