import type { Payload } from 'payload'

// Order-confirmation email (JOS-61 follow-up: real transactional email,
// replacing the "We've sent the details by email and WhatsApp" confirmation
// copy that was previously just UI text -- no email was actually being sent).
//
// Sends through Resend via Payload's own email adapter (configured in
// payload.config.ts with @payloadcms/email-resend), so this just calls
// `payload.sendEmail(...)` -- same mechanism Payload itself uses for
// password-reset/verification emails.
//
// Same env-gated, log-instead-of-throw pattern as sendWhatsAppMessage in
// lib/messaging.ts: while RESEND_API_KEY is unset (local dev, or before the
// Resend account is set up), this logs instead of sending, so an order write
// never fails because email isn't configured yet.
export type EmailLang = 'pt' | 'en'

export type InvoiceAttachment = { filename: string; content: Buffer }

type OrderConfirmationInput = {
  to: string
  orderNumber: string
  customerName: string
  total: number
  currency: string
  // Storefront language the customer had selected at checkout (Orders.lang).
  // Defaults to 'pt' if the order predates this field or omitted it, to
  // match the frontend's own default language.
  lang?: EmailLang
  // Internal commercial invoice PDF, attached to the confirmation email for
  // both markets when generation succeeds.
  attachment?: InvoiceAttachment
}

// Small, self-contained PT/EN dictionary -- deliberately separate from the
// frontend's src/theme/i18n.ts (different runtime/deploy unit, no shared
// build step between the two repos) but mirrors its `T[key][lang]` shape so
// the two stay easy to keep in sync by eye.
const EMAIL_COPY: Record<
  EmailLang,
  {
    subject: (orderNumber: string) => string
    heading: (customerName: string) => string
    body: string
    orderNumberLabel: string
    totalLabel: string
    trackingIntro: string
    trackingLinkText: string
  }
> = {
  pt: {
    subject: (orderNumber) => `Encomenda ${orderNumber} confirmada -- Use Me With Style`,
    heading: (customerName) => `Obrigada pela sua compra, ${customerName}!`,
    body: 'A sua encomenda foi confirmada e o pagamento recebido.',
    orderNumberLabel: 'Número da encomenda',
    totalLabel: 'Total',
    trackingIntro: 'Pode acompanhar o estado da sua encomenda a qualquer momento em',
    trackingLinkText: 'consultar encomenda',
  },
  en: {
    subject: (orderNumber) => `Order ${orderNumber} confirmed -- Use Me With Style`,
    heading: (customerName) => `Thank you for your purchase, ${customerName}!`,
    body: 'Your order has been confirmed and payment received.',
    orderNumberLabel: 'Order number',
    totalLabel: 'Total',
    trackingIntro: 'You can check your order status any time at',
    trackingLinkText: 'track your order',
  },
}

export function buildOrderConfirmationEmail(input: OrderConfirmationInput): {
  subject: string
  html: string
} {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const copy = EMAIL_COPY[lang]
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.com'
  // /conta is the only order-lookup route -- the frontend's routes are not
  // localized (checkout/carrinho/conta stay the same PT slugs regardless of
  // UI language; only the on-page copy changes), so this must NOT vary by
  // lang or the English email would link to a 404.
  const trackingUrl = `${siteUrl}/conta`

  const subject = copy.subject(input.orderNumber)
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(copy.heading(input.customerName))}</h2>
      <p>${escapeHtml(copy.body)}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">${escapeHtml(copy.orderNumberLabel)}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${escapeHtml(input.orderNumber)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">${escapeHtml(copy.totalLabel)}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${input.total} ${escapeHtml(input.currency)}</td>
        </tr>
      </table>
      <p>
        ${escapeHtml(copy.trackingIntro)}
        <a href="${trackingUrl}">${escapeHtml(copy.trackingLinkText)}</a>.
      </p>
    </div>
  `.trim()

  return { subject, html }
}

export async function sendOrderConfirmationEmail(
  payload: Payload,
  input: OrderConfirmationInput,
): Promise<void> {
  const { subject, html } = buildOrderConfirmationEmail(input)

  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(
      `[email:not-configured] would send order confirmation (${input.lang ?? 'pt'}) for ${input.orderNumber} to ${input.to}`,
    )
    return
  }

  try {
    await payload.sendEmail({
      to: input.to,
      subject,
      html,
      ...(input.attachment
        ? { attachments: [{ filename: input.attachment.filename, content: input.attachment.content }] }
        : {}),
    })
  } catch (err) {
    // Never let an email failure break the order write itself.
    // eslint-disable-next-line no-console
    console.error('[email:send-failed]', err)
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
