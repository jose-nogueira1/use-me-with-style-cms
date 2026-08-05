import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_market" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_intent" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_language" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_facts" jsonb;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_model" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_request_id" varchar;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_input_tokens" numeric;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_output_tokens" numeric;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_total_tokens" numeric;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_estimated_cost_usd" numeric;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_requires_human" boolean DEFAULT false;
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_outcome" varchar;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_market";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_intent";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_language";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_facts";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_model";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_request_id";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_input_tokens";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_output_tokens";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_total_tokens";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_estimated_cost_usd";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_requires_human";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_outcome";
  `)
}
