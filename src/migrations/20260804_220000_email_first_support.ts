import { sql, type MigrateDownArgs, type MigrateUpArgs } from '@payloadcms/db-postgres'

// Remove the public WhatsApp support number from existing production copy
// and make email the official channel. Historical conversation references
// remain in the data-deletion policy because they describe data that may
// already have been collected.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "market_settings"
    SET
      "angola_bank_transfer_instructions_p_t" = CASE
        WHEN "angola_bank_transfer_instructions_p_t" ILIKE '%whatsapp%'
          THEN 'A nossa equipa enviará por email quaisquer instruções adicionais necessárias após a confirmação da encomenda.'
        ELSE "angola_bank_transfer_instructions_p_t"
      END,
      "angola_bank_transfer_instructions_e_n" = CASE
        WHEN "angola_bank_transfer_instructions_e_n" ILIKE '%whatsapp%'
          THEN 'Our team will email any additional instructions required after the order is confirmed.'
        ELSE "angola_bank_transfer_instructions_e_n"
      END,
      "portugal_manual_checkout_instructions_p_t" = CASE
        WHEN "portugal_manual_checkout_instructions_p_t" ILIKE '%whatsapp%'
          THEN 'Enviaremos por email as instruções para concluir o pagamento assim que a encomenda for confirmada.'
        ELSE "portugal_manual_checkout_instructions_p_t"
      END,
      "portugal_manual_checkout_instructions_e_n" = CASE
        WHEN "portugal_manual_checkout_instructions_e_n" ILIKE '%whatsapp%'
          THEN 'We will email the instructions needed to complete payment once the order is confirmed.'
        ELSE "portugal_manual_checkout_instructions_e_n"
      END;

    UPDATE "legal_content"
    SET
      "privacy_policy_text_p_t" = replace(
        replace("privacy_policy_text_p_t", '(por email e WhatsApp)', 'por email'),
        ', utilize o formulário disponível na página de Ajuda ou fale connosco por WhatsApp através do número +244 933 617 878',
        ' ou utilize o formulário disponível na página de Ajuda'
      ),
      "privacy_policy_text_e_n" = replace(
        replace("privacy_policy_text_e_n", '(by email and WhatsApp)', 'by email'),
        ', use the form on the Help page, or contact us by WhatsApp at +244 933 617 878',
        ' or use the form on the Help page'
      ),
      "terms_text_p_t" = replace(
        "terms_text_p_t",
        'contacte support@usemewithstyle.shop ou +244 933 617 878 por WhatsApp',
        'contacte support@usemewithstyle.shop'
      ),
      "terms_text_e_n" = replace(
        "terms_text_e_n",
        'email support@usemewithstyle.shop or contact +244 933 617 878 by WhatsApp',
        'email support@usemewithstyle.shop'
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

// This is a deliberate communication-policy change; restoring a public
// telephone number automatically would be unsafe, so rollback is a no-op.
export async function down(_args: MigrateDownArgs): Promise<void> {}
