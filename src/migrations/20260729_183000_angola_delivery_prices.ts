import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

export async function up({ db, payload: _payload, req: _req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_municipality_prices" jsonb NOT NULL DEFAULT '{"Luanda":3000,"Cacuaco":5000,"Cazenga":3500,"Viana":6000,"Belas":6500,"Talatona":4000,"Mussulo":8000,"Sambizanga":3000,"Rangel":3000,"Maianga":2500,"Samba":3500,"Camama":4500,"Mulenvos":5500,"Kilamba":5000,"Hoji Ya Henda":3500,"Ingombota":2500}'::jsonb,
      ADD COLUMN IF NOT EXISTS "angola_free_shipping_threshold" numeric NOT NULL DEFAULT 80000;
  `)
}

export async function down({ db, payload: _payload, req: _req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_municipality_prices",
      DROP COLUMN IF EXISTS "angola_free_shipping_threshold";
  `)
}
