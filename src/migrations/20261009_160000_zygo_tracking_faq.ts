import { sql, type MigrateUpArgs, type MigrateDownArgs } from '@payloadcms/db-postgres'

// "How do I track my order?" now mentions Zygo tracking for Angola (2026-10-09).
// Rewritten only where the answer still holds the exact old default; anything an
// admin has edited is left alone. No schema change.
const REWRITES = [
  ['answer_p_t', 'Use o número da encomenda e o email utilizado na compra na página Consultar encomenda.', 'Use o número da encomenda e o email utilizado na compra na página Consultar encomenda. Depois de a encomenda ser enviada, enviamos-lhe por email o número de rastreio da Zygo, que pode consultar em zygo.ao/rastreio.'],
  ['answer_e_n', 'Use the order number and the email used at checkout on the Track order page.', 'Use the order number and the email used at checkout on the Track order page. Once your order ships, we email you the Zygo tracking number, which you can follow at zygo.ao/rastreio.'],
] as const

export async function up({ db }: MigrateUpArgs): Promise<void> {
  for (const [column, before, after] of REWRITES) {
    await db.execute(sql`UPDATE "storefront_content_faq_entries" SET ${sql.identifier(column)} = ${after} WHERE ${sql.identifier(column)} = ${before}`)
  }
}

// The wording is content and is not restored.
export async function down(_args: MigrateDownArgs): Promise<void> {}
