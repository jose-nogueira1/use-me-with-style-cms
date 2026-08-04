import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// The preceding communication-policy migration intentionally used exact
// replacements, but older production copy contains small wording variants.
// Normalize those variants without removing legitimate historical references
// to WhatsApp conversations from the data-deletion policy.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "legal_content"
    SET
      "privacy_policy_text_p_t" = replace(
        replace(
          replace("privacy_policy_text_p_t", 'por email e WhatsApp', 'por email'),
          ', utilize o formulário da página de Ajuda ou contacte-nos por WhatsApp através do número +244 933 617 878',
          ' ou utilize o formulário da página de Ajuda'
        ),
        ', utilize o formulário disponível na página de Ajuda ou contacte-nos por WhatsApp através do número +244 933 617 878',
        ' ou utilize o formulário disponível na página de Ajuda'
      ),
      "privacy_policy_text_e_n" = replace(
        replace("privacy_policy_text_e_n", 'by email and WhatsApp', 'by email'),
        ', use the form on the Help page, or contact us by WhatsApp at +244 933 617 878',
        ' or use the form on the Help page'
      ),
      "terms_text_p_t" = replace(
        replace("terms_text_p_t", ' ou +244 933 617 878 por WhatsApp', ''),
        ' ou contacte-nos por WhatsApp através do número +244 933 617 878',
        ''
      ),
      "terms_text_e_n" = replace(
        replace("terms_text_e_n", ' or contact +244 933 617 878 by WhatsApp', ''),
        ' or contact us by WhatsApp at +244 933 617 878',
        ''
      ),
      "data_deletion_text_p_t" = replace(
        "data_deletion_text_p_t",
        'Também pode fazer o pedido por WhatsApp através do número +244 933 617 878, ou através do formulário disponível na página de Ajuda.',
        'Também pode utilizar o formulário disponível na página de Ajuda.'
      ),
      "data_deletion_text_e_n" = replace(
        "data_deletion_text_e_n",
        'You can also make the request by WhatsApp at +244 933 617 878, or via the form available on the Help page.',
        'You can also use the form available on the Help page.'
      );
  `)
}

export async function down(_args: MigrateDownArgs): Promise<void> {}
