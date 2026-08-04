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
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop'
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

// Shipped/delivered status emails (2026-08-01 request: "the buttons we use
// for mark as shipped and marked as delivered should automatically send
// customer updates via email and whatsapp" -- previously only the WhatsApp
// half of that existed for 'shipped' and NEITHER channel existed for
// 'delivered'; see notifyOrderEvent.ts for the transitions that call this).
// Deliberately a separate, lighter template from the order-confirmation
// email above (no price breakdown -- there's nothing new to confirm
// financially at these stages) rather than overloading one function with an
// optional "stage" no caller actually varies independently.
export type OrderStatusEmailStage = 'shipped' | 'delivered'

type OrderStatusEmailInput = {
  to: string
  orderNumber: string
  customerName: string
  lang?: EmailLang
  stage: OrderStatusEmailStage
  // CTT tracking code + its public tracking URL (2026-08-01 request), PT
  // orders only -- see lib/messaging.ts's buildCttTrackingUrl. Optional:
  // most 'shipped' emails still won't have one (the admin may not have
  // entered the code yet, or the order is Angola's untracked local
  // courier), and 'delivered' emails never pass this at all.
  courierTrackingCode?: string
  courierTrackingUrl?: string
}

const STATUS_EMAIL_COPY: Record<
  OrderStatusEmailStage,
  Record<EmailLang, { subject: (orderNumber: string) => string; heading: (customerName: string) => string; body: string }>
> = {
  shipped: {
    pt: {
      subject: (orderNumber) => `Encomenda ${orderNumber} enviada -- Use Me With Style`,
      heading: (customerName) => `Boas notícias, ${customerName}!`,
      body: 'A sua encomenda foi enviada e está a caminho.',
    },
    en: {
      subject: (orderNumber) => `Order ${orderNumber} shipped -- Use Me With Style`,
      heading: (customerName) => `Good news, ${customerName}!`,
      body: 'Your order has shipped and is on its way.',
    },
  },
  delivered: {
    pt: {
      subject: (orderNumber) => `Encomenda ${orderNumber} entregue -- Use Me With Style`,
      heading: (customerName) => `A sua encomenda chegou, ${customerName}!`,
      body: 'A sua encomenda foi entregue. Esperamos que goste!',
    },
    en: {
      subject: (orderNumber) => `Order ${orderNumber} delivered -- Use Me With Style`,
      heading: (customerName) => `Your order has arrived, ${customerName}!`,
      body: 'Your order has been delivered. We hope you love it!',
    },
  },
}

export function buildOrderStatusEmail(input: OrderStatusEmailInput): { subject: string; html: string } {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const copy = STATUS_EMAIL_COPY[input.stage][lang]
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop'
  const trackingUrl = `${siteUrl}/conta`
  const trackingIntro = lang === 'pt' ? 'Pode acompanhar o estado da sua encomenda a qualquer momento em' : 'You can check your order status any time at'
  const trackingLinkText = lang === 'pt' ? 'consultar encomenda' : 'track your order'
  const orderNumberLabel = lang === 'pt' ? 'Número da encomenda' : 'Order number'

  const courierLabel = lang === 'pt' ? 'Código de rastreio CTT' : 'CTT tracking code'
  const courierLinkText = lang === 'pt' ? 'Seguir encomenda nos CTT' : 'Track with CTT'

  const subject = copy.subject(input.orderNumber)
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">${escapeHtml(copy.heading(input.customerName))}</h2>
      <p>${escapeHtml(copy.body)}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">${escapeHtml(orderNumberLabel)}</td>
          <td style="padding: 8px 0; text-align: right; font-weight: bold;">${escapeHtml(input.orderNumber)}</td>
        </tr>
        ${
          input.courierTrackingCode
            ? `<tr>
                <td style="padding: 8px 0; color: #666;">${escapeHtml(courierLabel)}</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold;">${escapeHtml(input.courierTrackingCode)}</td>
              </tr>`
            : ''
        }
      </table>
      ${
        input.courierTrackingUrl
          ? `<p><a href="${input.courierTrackingUrl}">${escapeHtml(courierLinkText)}</a></p>`
          : ''
      }
      <p>
        ${escapeHtml(trackingIntro)}
        <a href="${trackingUrl}">${escapeHtml(trackingLinkText)}</a>.
      </p>
    </div>
  `.trim()

  return { subject, html }
}

export async function sendOrderStatusEmail(payload: Payload, input: OrderStatusEmailInput): Promise<void> {
  const { subject, html } = buildOrderStatusEmail(input)

  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[email:not-configured] would send ${input.stage} notice (${input.lang ?? 'pt'}) for ${input.orderNumber} to ${input.to}`)
    return
  }

  try {
    await payload.sendEmail({ to: input.to, subject, html })
  } catch (err) {
    // Never let an email failure break the order write itself.
    // eslint-disable-next-line no-console
    console.error('[email:send-failed]', err)
  }
}

// Help page "send us an email" form (JOS-64 follow-up, added 2026-07-24).
// Unlike the order confirmation email above (sent TO the customer), this
// goes TO the internal team's inbox, with reply-to set to the customer's
// address so replying from Gmail/Resend's dashboard just works. Internal
// notification copy is deliberately not bilingual (the team reads PT) even
// though the form itself is bilingual on the storefront.
type ContactMessageInput = {
  name: string
  email: string
  phone?: string
  orderNumber?: string
  message: string
}

export async function sendContactFormEmail(payload: Payload, input: ContactMessageInput): Promise<void> {
  // No dedicated CONTACT_EMAIL configured yet -- falls back to the same
  // address used as the sender for order confirmations. Set CONTACT_EMAIL
  // in Railway once there's a real monitored support inbox.
  const to = process.env.CONTACT_EMAIL || process.env.RESEND_FROM_EMAIL || 'support@usemewithstyle.shop'
  const subject = `Nova mensagem do site -- ${input.name}`
  const html = `
    <div style="font-family: -apple-system, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
      <h2 style="margin-bottom: 4px;">Nova mensagem via formulário de contacto</h2>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 6px 0; color: #666;">Nome</td>
          <td style="padding: 6px 0; text-align: right; font-weight: bold;">${escapeHtml(input.name)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Email</td>
          <td style="padding: 6px 0; text-align: right; font-weight: bold;">${escapeHtml(input.email)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Telefone</td>
          <td style="padding: 6px 0; text-align: right; font-weight: bold;">${escapeHtml(input.phone || 'Não indicado')}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #666;">Encomenda</td>
          <td style="padding: 6px 0; text-align: right; font-weight: bold;">${escapeHtml(input.orderNumber || 'Não indicada')}</td>
        </tr>
      </table>
      <p style="white-space: pre-wrap;">${escapeHtml(input.message)}</p>
    </div>
  `.trim()

  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[email:not-configured] would send contact-form message from ${input.email} to ${to}`)
    return
  }

  // Let send failures propagate so the contact endpoint can tell the
  // customer to email the support mailbox directly.
  await payload.sendEmail({
    to,
    replyTo: input.email,
    subject,
    html,
  })
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
