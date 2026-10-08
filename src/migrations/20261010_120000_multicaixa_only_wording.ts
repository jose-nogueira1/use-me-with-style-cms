import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// Angola checkout takes Multicaixa Express only (no payment by Reference), so the
// stored default texts that said "Multicaixa Express or Reference" are corrected
// (2026-10-10). Rewritten only where a text still holds the exact old default;
// anything an admin has edited is left alone. No schema change.
const REWRITES = [
  ['home_seo_description_angola_p_t', 'Compre moda desportiva feminina com entrega em Luanda e pagamento por Multicaixa Express ou Referência. Preços em Kz e apoio local.', 'Compre moda desportiva feminina com entrega em Luanda e pagamento por Multicaixa Express. Preços em Kz e apoio local.'],
  ['home_seo_description_angola_e_n', "Shop women's activewear with delivery across Luanda and payment by Multicaixa Express or Reference. Prices in Kz and local support.", "Shop women's activewear with delivery across Luanda and payment by Multicaixa Express. Prices in Kz and local support."],
  ['about_angola_body_p_t', 'Na loja Angola, encontra preços em Kz, entrega em Luanda pela Zygo e pagamento por Multicaixa Express ou Referência. Para outros destinos, o apoio confirma as opções disponíveis.', 'Na loja Angola, encontra preços em Kz, entrega em Luanda pela Zygo e pagamento por Multicaixa Express. Para outros destinos, o apoio confirma as opções disponíveis.'],
  ['about_angola_body_e_n', 'In the Angola store, prices are shown in Kz, with delivery in Luanda by Zygo and payment by Multicaixa Express or Reference. For other destinations, support confirms the available options.', 'In the Angola store, prices are shown in Kz, with delivery in Luanda by Zygo and payment by Multicaixa Express. For other destinations, support confirms the available options.'],
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [column, before, after] of REWRITES) {
    await db.execute(sql`UPDATE "storefront_content" SET ${sql.identifier(column)} = ${after} WHERE ${sql.identifier(column)} = ${before}`)
  }
}

// The wording is content and is not restored.
export async function down(_args: MigrateDownArgs): Promise<void> {}
