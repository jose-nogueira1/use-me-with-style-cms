import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

/** Persistent, authenticated controls for approval/hybrid AI messaging. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "ai_automation_decision" varchar;

    DO $$ BEGIN
      CREATE TYPE "public"."enum_ai_messaging_settings_operating_mode" AS ENUM('approval', 'hybrid');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    DO $$ BEGIN
      CREATE TYPE "public"."enum_ai_messaging_settings_auto_reply_intents" AS ENUM(
        'greeting', 'product_availability', 'product_price', 'product_sizing',
        'delivery', 'payment', 'coupon', 'return_policy'
      );
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE TABLE IF NOT EXISTS "ai_messaging_settings" (
      "id" serial PRIMARY KEY NOT NULL,
      "assistant_enabled" boolean DEFAULT true,
      "emergency_stop" boolean DEFAULT false,
      "operating_mode" "enum_ai_messaging_settings_operating_mode" DEFAULT 'approval' NOT NULL,
      "auto_reply_market_clarification" boolean DEFAULT true,
      "auto_reply_product_clarification" boolean DEFAULT true,
      "confidence_threshold" numeric DEFAULT 0.92 NOT NULL,
      "reply_delay_seconds" numeric DEFAULT 15 NOT NULL,
      "max_auto_replies_per_conversation" numeric DEFAULT 6 NOT NULL,
      "max_auto_replies_per_hour" numeric DEFAULT 40 NOT NULL,
      "monthly_budget_usd" numeric DEFAULT 25 NOT NULL,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );

    CREATE TABLE IF NOT EXISTS "ai_messaging_settings_auto_reply_intents" (
      "order" integer NOT NULL,
      "parent_id" integer NOT NULL,
      "value" "enum_ai_messaging_settings_auto_reply_intents",
      "id" serial PRIMARY KEY NOT NULL
    );
    DO $$ BEGIN
      ALTER TABLE "ai_messaging_settings_auto_reply_intents"
        ADD CONSTRAINT "ai_messaging_settings_auto_reply_intents_parent_fk"
        FOREIGN KEY ("parent_id") REFERENCES "public"."ai_messaging_settings"("id")
        ON DELETE cascade ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN NULL; END $$;

    CREATE INDEX IF NOT EXISTS "ai_messaging_settings_updated_at_idx" ON "ai_messaging_settings" ("updated_at");
    CREATE INDEX IF NOT EXISTS "ai_messaging_settings_created_at_idx" ON "ai_messaging_settings" ("created_at");
    CREATE INDEX IF NOT EXISTS "ai_messaging_settings_auto_reply_intents_order_idx" ON "ai_messaging_settings_auto_reply_intents" ("order");
    CREATE INDEX IF NOT EXISTS "ai_messaging_settings_auto_reply_intents_parent_idx" ON "ai_messaging_settings_auto_reply_intents" ("parent_id");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "ai_messaging_settings_auto_reply_intents" CASCADE;
    DROP TABLE IF EXISTS "ai_messaging_settings" CASCADE;
    DROP TYPE IF EXISTS "public"."enum_ai_messaging_settings_auto_reply_intents";
    DROP TYPE IF EXISTS "public"."enum_ai_messaging_settings_operating_mode";
    ALTER TABLE "messages" DROP COLUMN IF EXISTS "ai_automation_decision";
  `)
}
