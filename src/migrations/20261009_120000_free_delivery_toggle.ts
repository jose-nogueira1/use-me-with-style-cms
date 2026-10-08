import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Free delivery becomes an admin switch per market (2026-10-09), OFF to start with:
// the owner will not offer it at launch and can switch it on later. The thresholds
// keep their values. The default "How much does delivery cost?" FAQ answers no
// longer promise free delivery, but only where they still hold the exact old
// default; anything an admin has edited is left alone.
const SENTENCE = {
  answer_p_t: [' A entrega é gratuita a partir de 80 000 Kz, depois de descontos.', 'O valor exato é calculado no checkout antes de confirmar.'],
  answer_e_n: [' Delivery is free from 80,000 Kz, after discounts.', 'The exact fee is calculated at checkout before you confirm.'],
  answer_p_t_p_t: [' A entrega é gratuita a partir de 75 €, depois de descontos.', 'O valor exato é calculado no checkout antes de confirmar.'],
  answer_e_n_p_t: [' Delivery is free from €75, after discounts.', 'The exact fee is calculated at checkout before you confirm.'],
} as const

const TAIL = {
  answer_p_t: ' Também fazemos envios internacionais; contacte o apoio para confirmar custo e prazo para o seu país.',
  answer_p_t_p_t: ' Também fazemos envios internacionais; contacte o apoio para confirmar custo e prazo para o seu país.',
  answer_e_n: ' International shipping is also available; contact support to confirm the cost and timing for your country.',
  answer_e_n_p_t: ' International shipping is also available; contact support to confirm the cost and timing for your country.',
} as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      ADD COLUMN IF NOT EXISTS "angola_free_shipping_enabled" boolean DEFAULT false,
      ADD COLUMN IF NOT EXISTS "portugal_free_shipping_enabled" boolean DEFAULT false;
    UPDATE "market_settings" SET
      "angola_free_shipping_enabled" = COALESCE("angola_free_shipping_enabled", false),
      "portugal_free_shipping_enabled" = COALESCE("portugal_free_shipping_enabled", false);
  `)
  for (const column of Object.keys(SENTENCE) as Array<keyof typeof SENTENCE>) {
    const [free, lead] = SENTENCE[column]
    const before = `${lead}${free}${TAIL[column]}`
    const after = `${lead}${TAIL[column]}`
    await db.execute(sql`UPDATE "storefront_content_faq_entries" SET ${sql.identifier(column)} = ${after} WHERE ${sql.identifier(column)} = ${before}`)
  }
}

// Drops the switches. The FAQ wording is content and is not restored.
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "market_settings"
      DROP COLUMN IF EXISTS "portugal_free_shipping_enabled",
      DROP COLUMN IF EXISTS "angola_free_shipping_enabled";
  `)
}
