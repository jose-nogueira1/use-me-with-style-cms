import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Angola delivery by Zygo, priced in four zones (2026-10-08):
//  - market_settings gets the four zone prices (Centro/Sul/Norte 3500, Periferia 5500);
//    the old 16-municipality price table is no longer used, so its NOT NULL is
//    dropped (the column and its data are kept).
//  - orders.delivery_reference: the customer's point of reference for the courier.
//  - The delivery FAQ answer and the Angola "about" text that said "16 municípios de
//    Luanda" are rewritten, but only where they still hold the exact old default;
//    anything an admin has edited is left alone.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_zone_price_centro" numeric DEFAULT 3500,
      ADD COLUMN IF NOT EXISTS "angola_zone_price_sul" numeric DEFAULT 3500,
      ADD COLUMN IF NOT EXISTS "angola_zone_price_norte" numeric DEFAULT 3500,
      ADD COLUMN IF NOT EXISTS "angola_zone_price_periferia" numeric DEFAULT 5500;
    UPDATE "market_settings" SET
      "angola_zone_price_centro" = COALESCE("angola_zone_price_centro", 3500),
      "angola_zone_price_sul" = COALESCE("angola_zone_price_sul", 3500),
      "angola_zone_price_norte" = COALESCE("angola_zone_price_norte", 3500),
      "angola_zone_price_periferia" = COALESCE("angola_zone_price_periferia", 5500);
    ALTER TABLE "market_settings" ALTER COLUMN "angola_municipality_prices" DROP NOT NULL;

    ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "delivery_reference" varchar;

    UPDATE "storefront_content_faq_entries" SET "answer_p_t" = 'Entregamos em Luanda através da Zygo (zygo.ao), em 21 bairros organizados em 4 zonas. O custo depende da zona e é apresentado no checkout; depois da confirmação, a equipa coordena consigo o horário de entrega. Não prometemos um prazo de 24 horas sem confirmação prévia.' WHERE "answer_p_t" = 'Entregamos por estafeta local nos 16 municípios de Luanda. O custo é calculado pela localização e apresentado no checkout; depois da confirmação, a equipa coordena consigo o horário de entrega. Não prometemos um prazo de 24 horas sem confirmação prévia.';
    UPDATE "storefront_content_faq_entries" SET "answer_e_n" = 'We deliver in Luanda through Zygo (zygo.ao), across 21 neighbourhoods grouped in 4 zones. The fee depends on the zone and is shown at checkout; after confirmation, our team coordinates the delivery time. We do not promise 24-hour delivery without prior confirmation.' WHERE "answer_e_n" = 'We deliver by local courier across Luanda’s 16 municipalities. The fee is calculated from your location and shown at checkout; after confirmation, our team coordinates the delivery time. We do not promise 24-hour delivery without prior confirmation.';
    UPDATE "storefront_content" SET "about_angola_body_p_t" = 'Na loja Angola, encontra preços em Kz, entrega em Luanda pela Zygo e pagamento por Multicaixa Express ou Referência. Para outros destinos, o apoio confirma as opções disponíveis.' WHERE "about_angola_body_p_t" = 'Na loja Angola, encontra preços em Kz, entrega por estafeta nos 16 municípios de Luanda e pagamento por Multicaixa Express ou Referência. Para outros destinos, o apoio confirma as opções disponíveis.';
    UPDATE "storefront_content" SET "about_angola_body_e_n" = 'In the Angola store, prices are shown in Kz, with delivery in Luanda by Zygo and payment by Multicaixa Express or Reference. For other destinations, support confirms the available options.' WHERE "about_angola_body_e_n" = 'In the Angola store, prices are shown in Kz, with courier delivery across Luanda’s 16 municipalities and payment by Multicaixa Express or Reference. For other destinations, support confirms the available options.';
  `)
}

// Reverses the schema additions. The rewritten texts are not restored (they are
// content, and the new wording is correct for the new delivery).
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders" DROP COLUMN IF EXISTS "delivery_reference";
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "angola_zone_price_periferia",
      DROP COLUMN IF EXISTS "angola_zone_price_norte",
      DROP COLUMN IF EXISTS "angola_zone_price_sul",
      DROP COLUMN IF EXISTS "angola_zone_price_centro";
  `)
}
