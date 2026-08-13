import type { Payload } from 'payload'

import { LOGO_WHITE_360_BASE64 } from './emailAssets'

// Order-confirmation email (JOS-61 follow-up: real transactional email,
// backing the paid-order confirmation shown on the storefront
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

// One line item as shown in the confirmation email. Deliberately its own
// (slightly wider) shape than Orders.items -- it adds the resolved product
// image, which is NOT stored on the order itself (items only snapshot
// productName/size/color/qty/unitPrice; see Orders.ts). The caller
// (notifyOrderEvent.ts) is responsible for resolving each item's `product`
// relationship to a Media URL and making it absolute (lib/mediaUrl.ts)
// before calling in -- this module stays a pure template/string builder with
// no Payload/DB access of its own, so it can be unit-tested without a
// database.
export type OrderConfirmationItemInput = {
  productName: string
  size?: string | null
  optionLabel?: string | null
  optionValue?: string | null
  productType?: 'standard' | 'bundle' | null
  color?: string | null
  qty: number
  unitPrice: number
  // Absolute URL only -- a relative path would render as a broken image in
  // every major email client (there's no page origin to resolve it
  // against). Omit rather than pass a relative URL.
  imageUrl?: string | null
  imageAlt?: string | null
}

export type OrderConfirmationAddressInput = {
  line1?: string | null
  line2?: string | null
  postalCode?: string | null
  city?: string | null
  country?: string | null
}

type OrderConfirmationInput = {
  to: string
  orderNumber: string
  // ISO string or Date -- Orders.createdAt. Optional so the type doesn't
  // hard-require a field older test fixtures/callers might not pass; the
  // order-date line is simply omitted when missing (see formatOrderDate).
  orderDate?: string | Date
  customerName: string
  // Orders.customerFirstName (added 2026-08-04, optional/not guaranteed on
  // older orders) -- when absent, the greeting falls back to the first
  // whitespace-delimited token of customerName (see resolveFirstName).
  customerFirstName?: string | null
  total: number
  currency: string
  // Storefront language the customer had selected at checkout (Orders.lang).
  // Defaults to 'pt' if the order predates this field or omitted it, to
  // match the frontend's own default language.
  lang?: EmailLang
  items?: OrderConfirmationItemInput[]
  subtotal?: number
  discountAmount?: number
  discountLabel?: string | null
  shippingCost?: number
  paymentMethod?: string | null
  deliveryMethod?: string | null
  // CTT tracking code/link, PT-only and rarely present this early (an order
  // has usually only just been paid, not yet shipped) -- shown only when
  // both are set. See buildCttTrackingUrl in lib/messaging.ts.
  courierTrackingCode?: string | null
  courierTrackingUrl?: string
  address?: OrderConfirmationAddressInput
  // Internal commercial invoice PDF, attached to the confirmation email for
  // both markets when generation succeeds.
  attachment?: InvoiceAttachment
}

// ---------------------------------------------------------------------------
// Brand palette (2026-08-04 redesign) -- restrained black / warm ivory / gold
// editorial palette, matching the storefront's own theme tokens (see
// use-me-with-style-platform/src/theme). Kept as local constants (not
// imported from the frontend -- different repo/runtime, no shared build
// step) but intentionally close to it so the email doesn't feel like a
// different brand than the site.
const INK = '#161311' // near-black body text
const INK_SOFT = '#6f6a63' // muted secondary text, still >=4.5:1 on ivory/white
const IVORY = '#F6F1E7' // page background
const CARD = '#FFFFFF' // content card background
const HAIRLINE = '#E4DAC4' // warm hairline/divider, gold-adjacent but subtle
const BLACK = '#0E0C0B' // header/footer band + CTA background
const GOLD = '#B08A4E' // restrained accent -- labels, CTA text, thin rules
const GOLD_ON_BLACK = '#D9BE8A' // lighter gold for legibility on the black band

const SERIF = "Georgia, 'Times New Roman', Times, serif"
const SANS = "Helvetica, Arial, sans-serif"

// Small, self-contained PT/EN dictionary -- deliberately separate from the
// frontend's src/theme/i18n.ts (different runtime/deploy unit, no shared
// build step between the two repos) but mirrors its `T[key][lang]` shape so
// the two stay easy to keep in sync by eye.
const CONFIRMATION_COPY: Record<
  EmailLang,
  {
    subject: (orderNumber: string) => string
    preheader: (firstName: string) => string
    heading: (firstName: string) => string
    body: string
    orderNumberLabel: string
    orderDateLabel: string
    itemsHeading: string
    sizeLabel: string
    colorLabel: string
    qtyLabel: string
    subtotalLabel: string
    discountFallbackLabel: string
    shippingLabel: string
    freeLabel: string
    totalLabel: string
    paymentHeading: string
    deliveryHeading: string
    addressHeading: string
    trackingCodeLabel: string
    ctaText: string
    nextStepsHeading: string
    steps: { title: string; body: string }[]
    supportHeading: string
    supportBody: string
    emailLinkText: string
    invoiceNote: string
    footerTagline: string
    footerRights: (year: number) => string
  }
> = {
  pt: {
    subject: (orderNumber) => `A sua encomenda está confirmada ✨ -- #${orderNumber}`,
    preheader: (firstName) => `Obrigada, ${firstName}. Já estamos a preparar as suas peças.`,
    heading: (firstName) => `É oficial, ${firstName}.`,
    body: 'Recebemos o seu pagamento e já estamos a preparar tudo com cuidado. Enviaremos uma nova mensagem assim que a sua encomenda estiver a caminho.',
    orderNumberLabel: 'Número da encomenda',
    orderDateLabel: 'Data',
    itemsHeading: 'Os seus artigos',
    sizeLabel: 'Tamanho',
    colorLabel: 'Cor',
    qtyLabel: 'Qtd.',
    subtotalLabel: 'Subtotal',
    discountFallbackLabel: 'Desconto',
    shippingLabel: 'Portes de envio',
    freeLabel: 'Grátis',
    totalLabel: 'Total',
    paymentHeading: 'Pagamento',
    deliveryHeading: 'Entrega',
    addressHeading: 'Morada de entrega',
    trackingCodeLabel: 'Código de rastreio',
    ctaText: 'ACOMPANHAR A MINHA ENCOMENDA',
    nextStepsHeading: 'O que se segue?',
    steps: [
      { title: 'Preparação', body: 'Estamos a preparar cuidadosamente as suas peças.' },
      { title: 'Aviso de envio', body: 'Enviamos uma mensagem assim que a encomenda seguir, com o código de rastreio quando aplicável.' },
      { title: 'Entrega', body: 'A sua encomenda chega à morada indicada.' },
    ],
    supportHeading: 'Precisa de ajuda?',
    supportBody: 'O email é o nosso canal oficial de apoio. Inclua o número da encomenda e um telefone de contacto; se necessário, entraremos em contacto diretamente.',
    emailLinkText: 'Escrever para o apoio ao cliente',
    invoiceNote: 'A sua fatura comercial (documento interno, não fiscal) segue em anexo neste email, em PDF.',
    footerTagline: 'Peças pensadas para durar, com um acabamento cuidado.',
    footerRights: (year) => `© ${year} Use Me With Style. Todos os direitos reservados.`,
  },
  en: {
    subject: (orderNumber) => `Your order is confirmed ✨ -- #${orderNumber}`,
    preheader: (firstName) => `Thank you, ${firstName}. We're already preparing your pieces.`,
    heading: (firstName) => `It's official, ${firstName}.`,
    body: "We've received your payment and are already preparing everything with care. We'll send another message as soon as your order is on its way.",
    orderNumberLabel: 'Order number',
    orderDateLabel: 'Date',
    itemsHeading: 'Your items',
    sizeLabel: 'Size',
    colorLabel: 'Colour',
    qtyLabel: 'Qty',
    subtotalLabel: 'Subtotal',
    discountFallbackLabel: 'Discount',
    shippingLabel: 'Delivery',
    freeLabel: 'Free',
    totalLabel: 'Total',
    paymentHeading: 'Payment',
    deliveryHeading: 'Delivery',
    addressHeading: 'Delivery address',
    trackingCodeLabel: 'Tracking code',
    ctaText: 'TRACK MY ORDER',
    nextStepsHeading: 'What happens next?',
    steps: [
      { title: 'Preparation', body: "We're carefully preparing your pieces." },
      { title: 'Shipping notice', body: "We'll message you as soon as it ships, with a tracking code when available." },
      { title: 'Delivery', body: 'Your order arrives at the address you provided.' },
    ],
    supportHeading: 'Need help?',
    supportBody: 'Email is our official support channel. Include your order number and a contact telephone number; if necessary, we will contact you directly.',
    emailLinkText: 'Email customer support',
    invoiceNote: 'Your commercial invoice (internal document, non-fiscal) is attached to this email as a PDF.',
    footerTagline: 'Pieces made to last, finished with care.',
    footerRights: (year) => `© ${year} Use Me With Style. All rights reserved.`,
  },
}

// Mirrors PAYMENT_METHODS/DELIVERY_METHODS in collections/Orders.ts and the
// human-label mapping already used by the admin
// (use-me-with-style-platform/src/admin/lib/orderLabels.ts +
// src/admin/i18n.ts) -- duplicated here (not imported) because that's a
// separate frontend repo/build with no shared package between the two.
// Falls back to the raw stored value for anything not in the map (e.g. the
// legacy bank_transfer_ao/sweg_appypay values), same fallback the admin uses.
const PAYMENT_METHOD_LABELS: Record<string, Record<EmailLang, string>> = {
  paypal: { pt: 'PayPal', en: 'PayPal' },
  stripe: { pt: 'Cartão (Stripe)', en: 'Card (Stripe)' },
  mbway: { pt: 'MB WAY', en: 'MB WAY' },
  multicaixa_express: { pt: 'Multicaixa Express (AppyPay)', en: 'Multicaixa Express (AppyPay)' },
  manual_whatsapp: { pt: 'Coordenação manual por email', en: 'Manual coordination by email' },
  bank_transfer_ao: { pt: 'Transferência bancária', en: 'Bank transfer' },
  sweg_appypay: { pt: 'AppyPay', en: 'AppyPay' },
}
const DELIVERY_METHOD_LABELS: Record<string, Record<EmailLang, string>> = {
  ctt: { pt: 'CTT Standard (sem rastreio)', en: 'CTT Standard (untracked)' },
  courier_pt: { pt: 'CTT Registado (com rastreio)', en: 'CTT Registered (tracked)' },
  courier_ao: { pt: 'Estafeta local', en: 'Local courier' },
  manual_ao: { pt: 'Coordenação manual', en: 'Manual coordination' },
}

export function paymentMethodLabel(value: string | null | undefined, lang: EmailLang): string | undefined {
  if (!value) return undefined
  return PAYMENT_METHOD_LABELS[value]?.[lang] ?? value
}

export function deliveryMethodLabel(value: string | null | undefined, lang: EmailLang): string | undefined {
  if (!value) return undefined
  return DELIVERY_METHOD_LABELS[value]?.[lang] ?? value
}

// customerFirstName is optional/not backfilled on older orders -- falls back
// to the first whitespace-delimited token of the combined customerName
// (e.g. "Ana Sofia Martins" -> "Ana") rather than the full name, so the
// personalized greeting ("É oficial, Ana.") doesn't read as a form letter.
export function resolveFirstName(fullName: string, explicitFirst?: string | null): string {
  if (explicitFirst && explicitFirst.trim()) return explicitFirst.trim()
  const trimmed = (fullName || '').trim()
  if (!trimmed) return ''
  return trimmed.split(/\s+/)[0]
}

// Money is always rendered as "<Intl-formatted number> <currency code>"
// (e.g. "1 234,56 Kz" / "24.00 EUR") -- mirrors internalInvoice.ts's own
// formatMoney exactly, so the email and the attached invoice PDF never
// disagree on how a total is written.
export function formatOrderMoney(value: number, currency: string, lang: EmailLang): string {
  const locale = lang === 'en' ? 'en-US' : 'pt-PT'
  const amount = Number.isFinite(value) ? value : 0
  return `${new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)} ${currency}`
}

function formatOrderDate(value: string | Date | undefined, lang: EmailLang): string | undefined {
  if (!value) return undefined
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return undefined
  const locale = lang === 'en' ? 'en-US' : 'pt-PT'
  return new Intl.DateTimeFormat(locale, { day: '2-digit', month: 'long', year: 'numeric' }).format(date)
}

// Address is intentionally NOT a single concatenated field on the order
// (see Orders.ts) -- built here from the separate street/line2/postal
// code/city/country fields, one line per non-empty part, same filter-and-
// join spirit as notifyOrderEvent.ts's own address-for-the-invoice
// assembly, just multi-line instead of comma-joined (reads better as a
// mailing-address block).
function addressLines(address: OrderConfirmationAddressInput | undefined): string[] {
  if (!address) return []
  const line1 = address.line1?.trim()
  const line2 = address.line2?.trim()
  const cityLine = [address.postalCode?.trim(), address.city?.trim()].filter(Boolean).join(' ')
  const country = address.country?.trim()
  return [line1, line2, cityLine, country].filter((line): line is string => Boolean(line && line.length > 0))
}

function renderItemRow(item: OrderConfirmationItemInput, currency: string, lang: EmailLang, copy: (typeof CONFIRMATION_COPY)[EmailLang]): string {
  const qty = Number.isFinite(item.qty) && item.qty > 0 ? Math.round(item.qty) : 1
  const lineTotal = formatOrderMoney(item.unitPrice * qty, currency, lang)

  const metaParts: string[] = []
  if (item.productType === 'bundle') metaParts.push(lang === 'en' ? 'Product kit' : 'Kit de produtos')
  else if (item.optionValue) metaParts.push(`${escapeHtml(item.optionLabel || copy.sizeLabel)} ${escapeHtml(item.optionValue)}`)
  else if (item.size) metaParts.push(`${copy.sizeLabel} ${escapeHtml(item.size)}`)
  if (item.color) metaParts.push(`${copy.colorLabel} ${escapeHtml(item.color)}`)
  metaParts.push(`${copy.qtyLabel} ${qty}`)
  const metaLine = metaParts.join('&nbsp;&nbsp;·&nbsp;&nbsp;')

  const imageCell = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" width="64" height="80" alt="${escapeHtml(item.imageAlt || item.productName)}" style="display:block; width:64px; height:80px; border-radius:2px; border:1px solid ${HAIRLINE}; object-fit:cover;" />`
    : `<div style="width:64px; height:80px; background-color:${IVORY}; border:1px solid ${HAIRLINE}; border-radius:2px;">&nbsp;</div>`

  const unitLine = qty > 1
    ? `<div style="font-family:${SANS}; font-size:11px; line-height:16px; color:${INK_SOFT}; margin:0 0 2px;">${qty}&nbsp;&times;&nbsp;${formatOrderMoney(item.unitPrice, currency, lang)}</div>`
    : ''

  return `
    <tr>
      <td style="padding:16px 0; border-bottom:1px solid ${HAIRLINE};">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="64" valign="top" style="padding-right:16px;">${imageCell}</td>
            <td valign="top">
              <div style="font-family:${SERIF}; font-size:15px; line-height:21px; color:${INK};">${escapeHtml(item.productName)}</div>
              <div style="font-family:${SANS}; font-size:12px; line-height:18px; color:${INK_SOFT}; margin-top:4px;">${metaLine}</div>
            </td>
            <td width="96" valign="top" align="right">
              ${unitLine}
              <div style="font-family:${SANS}; font-size:14px; line-height:18px; color:${INK}; font-weight:700; white-space:nowrap;">${lineTotal}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>`
}

function renderSummaryRow(label: string, value: string, opts?: { emphasize?: boolean; negative?: boolean }): string {
  const weight = opts?.emphasize ? '700' : '400'
  const topBorder = opts?.emphasize ? `border-top:1px solid ${GOLD}; padding-top:12px;` : ''
  const color = opts?.emphasize ? INK : INK_SOFT
  const valueColor = opts?.emphasize ? INK : INK
  const prefix = opts?.negative ? '− ' : ''
  return `
    <tr>
      <td style="padding:6px 0; ${topBorder} font-family:${SANS}; font-size:${opts?.emphasize ? '15' : '13'}px; color:${color}; font-weight:${weight};">${label}</td>
      <td align="right" style="padding:6px 0; ${topBorder} font-family:${SANS}; font-size:${opts?.emphasize ? '15' : '13'}px; color:${valueColor}; font-weight:${weight}; white-space:nowrap;">${prefix}${value}</td>
    </tr>`
}

function renderDetailBlock(heading: string, lines: string[]): string {
  if (!lines.length) return ''
  return `
    <td valign="top" style="padding:0 16px 20px 0;">
      <div style="font-family:${SANS}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:${GOLD}; margin-bottom:6px;">${escapeHtml(heading)}</div>
      <div style="font-family:${SANS}; font-size:13px; line-height:20px; color:${INK};">${lines.join('<br/>')}</div>
    </td>`
}

// ---------------------------------------------------------------------------
// Shared chrome (2026-08-06, extracted while adding the contact-form
// auto-reply email below) -- every customer-facing email in this file
// (order confirmation, contact auto-reply, and any future one) shares the
// same outer HTML document, black-band logo header, and black-band footer.
// Pulling these into one place means a brand tweak (palette, logo, footer
// links) only has to happen once, and keeps each `build*Email` function
// focused on its own body content instead of re-authoring ~80 lines of
// boilerplate <head>/MSO/media-query markup per email.
function renderHeaderRow(): string {
  // Inlined as a base64 data URI, NOT a hosted {siteUrl}/brand/... URL --
  // see emailAssets.ts for why (a hosted logo URL rendered as a broken
  // image for at least one reviewer; embedding it removes that entire
  // class of failure). This is the one image across these templates that
  // isn't naturally absolute-URL-only -- order items' product photos still
  // are, correctly, since those are genuinely per-order dynamic content.
  return `
          <tr>
            <td align="center" bgcolor="${BLACK}" style="padding:28px 32px; background-color:${BLACK};">
              <img src="data:image/png;base64,${LOGO_WHITE_360_BASE64}" alt="Use Me With Style" width="180" style="display:block; width:180px; max-width:60%; height:auto; border:0;" />
            </td>
          </tr>`
}

function renderFooterRows(opts: { tagline: string; rights: string; siteUrl: string }): string {
  const instagramUrl = 'https://www.instagram.com/use_me_withstyle/'
  return `
          <tr>
            <td style="padding:40px 32px 0;">
              <div style="border-top:1px solid ${HAIRLINE}; line-height:0; font-size:0;">&nbsp;</div>
            </td>
          </tr>
          <tr>
            <td align="center" bgcolor="${BLACK}" style="padding:28px 32px; background-color:${BLACK}; margin-top:40px;">
              <div style="font-family:${SERIF}; font-size:13px; color:${GOLD_ON_BLACK}; letter-spacing:0.5px;">USE ME WITH STYLE</div>
              <div style="font-family:${SANS}; font-size:11px; line-height:18px; color:#B9B4AC; margin-top:6px;">${escapeHtml(opts.tagline)}</div>
              <div style="font-family:${SANS}; font-size:11px; margin-top:14px;">
                <a href="${escapeHtml(opts.siteUrl)}" target="_blank" style="color:${GOLD_ON_BLACK}; text-decoration:none;">${escapeHtml(opts.siteUrl.replace(/^https?:\/\//, ''))}</a>
                <span style="color:#4A4642;">&nbsp;&nbsp;·&nbsp;&nbsp;</span>
                <a href="${escapeHtml(instagramUrl)}" target="_blank" style="color:${GOLD_ON_BLACK}; text-decoration:none;">Instagram</a>
              </div>
              <div style="font-family:${SANS}; font-size:10px; color:#8A857D; margin-top:16px;">${escapeHtml(opts.rights)}</div>
            </td>
          </tr>`
}

// `rows` is the pre-rendered sequence of <tr> blocks that make up the
// 600px content card (header row through footer rows, inclusive) --
// callers assemble their own body rows and pass the whole thing through
// here just for the outer document/MSO/media-query wrapper.
function renderEmailShell(opts: { lang: EmailLang; subject: string; preheader: string; rows: string }): string {
  const { lang, subject, preheader, rows } = opts
  return `<!doctype html>
<html lang="${lang}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(subject)}</title>
<!--[if mso]>
<noscript>
<xml>
<o:OfficeDocumentSettings>
<o:PixelsPerInch>96</o:PixelsPerInch>
</o:OfficeDocumentSettings>
</xml>
</noscript>
<![endif]-->
<style>
  body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
  table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
  img { -ms-interpolation-mode: bicubic; border: 0; line-height: 100%; outline: none; text-decoration: none; }
  body { margin: 0; padding: 0; width: 100% !important; background-color: ${IVORY}; }
  a { color: ${GOLD}; }
  @media screen and (max-width: 600px) {
    .ums-container { width: 100% !important; }
    .ums-px { padding-left: 20px !important; padding-right: 20px !important; }
    .ums-stack { display: block !important; width: 100% !important; padding-right: 0 !important; padding-bottom: 20px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:${IVORY};">
  <div style="display:none; font-size:1px; line-height:1px; max-height:0; max-width:0; opacity:0; overflow:hidden; mso-hide:all; font-family:${SANS};">
    ${escapeHtml(preheader)}
    &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${IVORY};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <!--[if mso]>
        <table role="presentation" width="600" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td>
        <![endif]-->
        <table role="presentation" class="ums-container" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px; max-width:600px; background-color:${CARD};">
          ${rows}
        </table>
        <!--[if mso]>
        </td></tr></table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`
}

export function buildOrderConfirmationEmail(input: OrderConfirmationInput): {
  subject: string
  html: string
} {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const copy = CONFIRMATION_COPY[lang]
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop').replace(/\/$/, '')
  // /conta is the only order-lookup route -- the frontend's routes are not
  // localized (checkout/carrinho/conta stay the same PT slugs regardless of
  // UI language; only the on-page copy changes), so this must NOT vary by
  // lang or the English email would link to a 404.
  const trackingUrl = `${siteUrl}/conta?order=${encodeURIComponent(input.orderNumber)}&email=${encodeURIComponent(input.to)}`

  const firstName = resolveFirstName(input.customerName, input.customerFirstName)
  const orderDate = formatOrderDate(input.orderDate, lang)
  const subject = copy.subject(input.orderNumber)
  const preheader = copy.preheader(firstName || input.customerName)

  const items = Array.isArray(input.items) ? input.items : []
  const itemRows = items.map((item) => renderItemRow(item, input.currency, lang, copy)).join('')
  const itemsSection = items.length
    ? `
      <tr>
        <td style="padding:36px 32px 0;">
          <div style="font-family:${SERIF}; font-size:13px; letter-spacing:1px; text-transform:uppercase; color:${INK}; border-bottom:1px solid ${INK}; padding-bottom:10px;">${escapeHtml(copy.itemsHeading)}</div>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${itemRows}</table>
        </td>
      </tr>`
    : ''

  const subtotal = typeof input.subtotal === 'number' ? input.subtotal : undefined
  const shippingCost = typeof input.shippingCost === 'number' ? input.shippingCost : undefined
  const discountAmount = typeof input.discountAmount === 'number' && input.discountAmount > 0 ? input.discountAmount : undefined
  const hasSummary = typeof subtotal === 'number' || typeof shippingCost === 'number' || typeof input.total === 'number'
  const summaryRows = [
    typeof subtotal === 'number' ? renderSummaryRow(escapeHtml(copy.subtotalLabel), formatOrderMoney(subtotal, input.currency, lang)) : '',
    discountAmount
      ? renderSummaryRow(escapeHtml(input.discountLabel || copy.discountFallbackLabel), formatOrderMoney(discountAmount, input.currency, lang), { negative: true })
      : '',
    typeof shippingCost === 'number'
      ? renderSummaryRow(escapeHtml(copy.shippingLabel), shippingCost > 0 ? formatOrderMoney(shippingCost, input.currency, lang) : escapeHtml(copy.freeLabel))
      : '',
    renderSummaryRow(escapeHtml(copy.totalLabel), formatOrderMoney(input.total, input.currency, lang), { emphasize: true }),
  ].join('')
  const summarySection = hasSummary
    ? `
      <tr>
        <td style="padding:20px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${summaryRows}</table>
        </td>
      </tr>`
    : ''

  const paymentLabel = paymentMethodLabel(input.paymentMethod, lang)
  const deliveryLabelRaw = deliveryMethodLabel(input.deliveryMethod, lang)
  const deliveryLines = [
    deliveryLabelRaw ? escapeHtml(deliveryLabelRaw) : '',
    input.courierTrackingCode ? `${escapeHtml(copy.trackingCodeLabel)}: ${escapeHtml(input.courierTrackingCode)}` : '',
  ].filter(Boolean)
  const addrLines = addressLines(input.address).map((line) => escapeHtml(line))

  const detailCells = [
    paymentLabel ? renderDetailBlock(copy.paymentHeading, [escapeHtml(paymentLabel)]) : '',
    deliveryLines.length ? renderDetailBlock(copy.deliveryHeading, deliveryLines) : '',
    addrLines.length ? renderDetailBlock(copy.addressHeading, addrLines) : '',
  ].filter(Boolean)
  const detailsSection = detailCells.length
    ? `
      <tr>
        <td style="padding:28px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${detailCells.join('')}</tr></table>
        </td>
      </tr>`
    : ''

  const orderMetaRows = [
    renderSummaryRow(escapeHtml(copy.orderNumberLabel), escapeHtml(input.orderNumber), { emphasize: false }),
    orderDate ? renderSummaryRow(escapeHtml(copy.orderDateLabel), escapeHtml(orderDate), { emphasize: false }) : '',
  ].join('')

  const stepsHtml = copy.steps
    .map(
      (step, i) => `
      <tr>
        <td width="34" valign="top" style="padding:2px 14px 20px 0;">
          <div style="width:24px; height:24px; border-radius:50%; border:1px solid ${GOLD}; text-align:center; font-family:${SANS}; font-size:11px; line-height:22px; color:${GOLD};">${i + 1}</div>
        </td>
        <td valign="top" style="padding-bottom:20px;">
          <div style="font-family:${SERIF}; font-size:15px; color:${INK};">${escapeHtml(step.title)}</div>
          <div style="font-family:${SANS}; font-size:13px; line-height:19px; color:${INK_SOFT}; margin-top:2px;">${escapeHtml(step.body)}</div>
        </td>
      </tr>`,
    )
    .join('')

  const invoiceNote = input.attachment
    ? `<tr><td style="padding:24px 32px 0;"><div style="font-family:${SANS}; font-size:12px; line-height:19px; color:${INK_SOFT}; background-color:${IVORY}; border:1px solid ${HAIRLINE}; border-radius:4px; padding:14px 16px;">${escapeHtml(copy.invoiceNote)}</div></td></tr>`
    : ''

  // Email is the single public customer-support channel.
  const supportEmail = process.env.CONTACT_EMAIL || 'support@usemewithstyle.shop'
  const year = new Date().getFullYear()

  const rows = `
          ${renderHeaderRow()}
          <tr>
            <td class="ums-px" style="padding:40px 32px 0;">
              <div style="font-family:${SANS}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:${GOLD};">${escapeHtml(copy.orderNumberLabel)} ${escapeHtml(input.orderNumber)}</div>
              <div style="font-family:${SERIF}; font-size:28px; line-height:34px; color:${INK}; margin-top:10px; font-weight:400;">${escapeHtml(copy.heading(firstName || input.customerName))}</div>
              <div style="font-family:${SANS}; font-size:14px; line-height:22px; color:${INK_SOFT}; margin-top:14px;">${escapeHtml(copy.body)}</div>
            </td>
          </tr>
          <tr>
            <td class="ums-px" style="padding:20px 32px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${orderMetaRows}</table>
            </td>
          </tr>
          ${itemsSection}
          ${summarySection}
          ${detailsSection}
          <tr>
            <td class="ums-px" align="center" style="padding:32px 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${BLACK}" style="border-radius:2px; background-color:${BLACK}; border:1px solid ${GOLD};">
                    <a href="${escapeHtml(trackingUrl)}" target="_blank" style="display:inline-block; padding:15px 34px; font-family:${SANS}; font-size:12px; letter-spacing:2px; font-weight:700; color:${GOLD_ON_BLACK}; text-decoration:none; text-transform:uppercase;">${escapeHtml(copy.ctaText)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${invoiceNote}
          <tr>
            <td class="ums-px" style="padding:40px 32px 0;">
              <div style="font-family:${SERIF}; font-size:13px; letter-spacing:1px; text-transform:uppercase; color:${INK}; border-bottom:1px solid ${INK}; padding-bottom:10px;">${escapeHtml(copy.nextStepsHeading)}</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:20px;">${stepsHtml}</table>
            </td>
          </tr>
          <tr>
            <td class="ums-px" style="padding:4px 32px 0;">
              <div style="font-family:${SERIF}; font-size:13px; letter-spacing:1px; text-transform:uppercase; color:${INK}; border-bottom:1px solid ${INK}; padding-bottom:10px;">${escapeHtml(copy.supportHeading)}</div>
              <div style="font-family:${SANS}; font-size:13px; line-height:20px; color:${INK_SOFT}; margin-top:14px;">${escapeHtml(copy.supportBody)}</div>
              <div style="font-family:${SANS}; font-size:13px; line-height:26px; margin-top:8px;">
                <a href="mailto:${escapeHtml(supportEmail)}" style="color:${GOLD}; text-decoration:none;">${escapeHtml(copy.emailLinkText)}</a>
              </div>
            </td>
          </tr>
          ${renderFooterRows({ tagline: copy.footerTagline, rights: copy.footerRights(year), siteUrl })}`

  const html = renderEmailShell({ lang, subject, preheader, rows })

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
// Redesigned 2026-08-06 to share the order-confirmation email's branded
// shell (logo header, black/ivory/gold palette, footer) instead of the
// original plain black-on-white template -- reviewed as HTML/PNG mockups
// with Jay-P before this was written. Still deliberately a separate,
// lighter template from the confirmation email above (no price breakdown
// -- there's nothing new to confirm financially at these stages).
export type OrderStatusEmailStage = 'shipped' | 'delivered'

type OrderStatusEmailInput = {
  to: string
  orderNumber: string
  customerName: string
  // Same optional-explicit-first-name pattern as OrderConfirmationInput --
  // falls back to resolveFirstName(customerName) when absent. See
  // notifyOrderEvent.ts's three call sites (shipped, delivered, and the
  // tracking-code-added-after-shipping resend).
  customerFirstName?: string | null
  lang?: EmailLang
  stage: OrderStatusEmailStage
  // CTT tracking code + its public tracking URL (2026-08-01 request), PT
  // orders only -- see lib/messaging.ts's buildCttTrackingUrl. Optional:
  // most 'shipped' emails still won't have one (the admin may not have
  // entered the code yet, or the order is Angola's untracked local
  // courier), and 'delivered' emails never pass this at all.
  courierTrackingCode?: string | null
  courierTrackingUrl?: string
}

// Only the stage-specific copy lives here -- orderNumberLabel,
// trackingCodeLabel, ctaText, the support section, and the footer are all
// identical in wording to CONFIRMATION_COPY above, so buildOrderStatusEmail
// reuses that dictionary directly rather than re-authoring (and risking
// drifting from) the same PT/EN strings a second time.
const STATUS_PROGRESS_LABELS: Record<EmailLang, [string, string, string]> = {
  pt: ['Confirmada', 'Enviada', 'Entregue'],
  en: ['Confirmed', 'Shipped', 'Delivered'],
}
const STATUS_CTT_CTA_TEXT: Record<EmailLang, string> = {
  pt: 'SEGUIR NOS CTT',
  en: 'TRACK WITH CTT',
}
const STATUS_STAGE_COPY: Record<
  OrderStatusEmailStage,
  Record<
    EmailLang,
    {
      subject: (orderNumber: string) => string
      preheader: (firstName: string) => string
      eyebrow: string
      heading: (firstName: string) => string
      body: string
    }
  >
> = {
  shipped: {
    pt: {
      subject: (orderNumber) => `Encomenda ${orderNumber} enviada -- Use Me With Style`,
      preheader: (firstName) => `${firstName}, a sua encomenda está a caminho.`,
      eyebrow: 'ENVIADA',
      heading: (firstName) => `A caminho, ${firstName}.`,
      body: 'A sua encomenda foi enviada e está a caminho. Assim que chegar, enviamos uma última mensagem a confirmar a entrega.',
    },
    en: {
      subject: (orderNumber) => `Order ${orderNumber} shipped -- Use Me With Style`,
      preheader: (firstName) => `${firstName}, your order is on its way.`,
      eyebrow: 'SHIPPED',
      heading: (firstName) => `On its way, ${firstName}.`,
      body: "Your order has shipped and is on its way. We'll send one last message to confirm once it's delivered.",
    },
  },
  delivered: {
    pt: {
      subject: (orderNumber) => `Encomenda ${orderNumber} entregue -- Use Me With Style`,
      preheader: (firstName) => `${firstName}, a sua encomenda chegou.`,
      eyebrow: 'ENTREGUE',
      heading: (firstName) => `Chegou, ${firstName}!`,
      body: 'A sua encomenda foi entregue. Esperamos que goste tanto das suas novas peças quanto nós gostámos de as preparar.',
    },
    en: {
      subject: (orderNumber) => `Order ${orderNumber} delivered -- Use Me With Style`,
      preheader: (firstName) => `${firstName}, your order has arrived.`,
      eyebrow: 'DELIVERED',
      heading: (firstName) => `It's here, ${firstName}!`,
      body: 'Your order has been delivered. We hope you love your new pieces as much as we loved preparing them.',
    },
  },
}

// Three evenly-spaced labeled circles (Confirmed -> Shipped -> Delivered),
// same gold-outline/filled visual language as the confirmation email's
// "what happens next" numbered steps. Deliberately no connecting line
// between circles -- a thin cross-cell hairline is one of the more
// failure-prone things to get pixel-perfect across Outlook/Gmail/Apple
// Mail, and the rest of this template already favors standalone circles
// over connectors. `activeIndex` = furthest complete stage (1 = shipped,
// 2 = delivered) -- everything up to and including it renders solid gold.
function renderStatusProgressTracker(labels: [string, string, string], activeIndex: number): string {
  const cells = labels
    .map((label, i) => {
      const done = i <= activeIndex
      const circle = done
        ? `<div style="width:22px; height:22px; border-radius:50%; background-color:${GOLD}; text-align:center; font-family:${SANS}; font-size:11px; line-height:22px; color:${BLACK}; font-weight:700;">${i + 1}</div>`
        : `<div style="width:22px; height:22px; border-radius:50%; border:1px solid ${HAIRLINE}; text-align:center; font-family:${SANS}; font-size:11px; line-height:20px; color:${INK_SOFT};">${i + 1}</div>`
      const labelColor = done ? INK : INK_SOFT
      return `
        <td align="center" style="width:${100 / labels.length}%;">
          ${circle}
          <div style="font-family:${SANS}; font-size:10px; letter-spacing:0.5px; text-transform:uppercase; color:${labelColor}; margin-top:6px; white-space:nowrap;">${escapeHtml(label)}</div>
        </td>`
    })
    .join('')
  return `
      <tr>
        <td class="ums-px" style="padding:28px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${cells}</tr></table>
        </td>
      </tr>`
}

export function buildOrderStatusEmail(input: OrderStatusEmailInput): { subject: string; html: string } {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const confirmationCopy = CONFIRMATION_COPY[lang]
  const stageCopy = STATUS_STAGE_COPY[input.stage][lang]
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop').replace(/\/$/, '')
  const trackingUrl = `${siteUrl}/conta?order=${encodeURIComponent(input.orderNumber)}&email=${encodeURIComponent(input.to)}`

  const firstName = resolveFirstName(input.customerName, input.customerFirstName) || input.customerName
  const subject = stageCopy.subject(input.orderNumber)
  const preheader = stageCopy.preheader(firstName)
  const activeIndex = input.stage === 'shipped' ? 1 : 2

  const detailsSection = input.courierTrackingCode
    ? `
      <tr>
        <td class="ums-px" style="padding:24px 32px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${renderDetailBlock(confirmationCopy.trackingCodeLabel, [escapeHtml(input.courierTrackingCode)])}</tr></table>
        </td>
      </tr>`
    : ''

  const cttButton = input.courierTrackingUrl
    ? `
      <tr>
        <td class="ums-px" align="center" style="padding:14px 32px 0;">
          <a href="${escapeHtml(input.courierTrackingUrl)}" target="_blank" style="display:inline-block; font-family:${SANS}; font-size:11px; letter-spacing:1.5px; color:${GOLD}; text-decoration:underline;">${escapeHtml(STATUS_CTT_CTA_TEXT[lang])}</a>
        </td>
      </tr>`
    : ''

  const year = new Date().getFullYear()
  const supportEmail = process.env.CONTACT_EMAIL || 'support@usemewithstyle.shop'

  const rows = `
          ${renderHeaderRow()}
          <tr>
            <td class="ums-px" style="padding:40px 32px 0;">
              <div style="font-family:${SANS}; font-size:11px; letter-spacing:1.5px; text-transform:uppercase; color:${GOLD};">${escapeHtml(confirmationCopy.orderNumberLabel)} ${escapeHtml(input.orderNumber)}&nbsp;&nbsp;&middot;&nbsp;&nbsp;${escapeHtml(stageCopy.eyebrow)}</div>
              <div style="font-family:${SERIF}; font-size:28px; line-height:34px; color:${INK}; margin-top:10px; font-weight:400;">${escapeHtml(stageCopy.heading(firstName))}</div>
              <div style="font-family:${SANS}; font-size:14px; line-height:22px; color:${INK_SOFT}; margin-top:14px;">${escapeHtml(stageCopy.body)}</div>
            </td>
          </tr>
          ${renderStatusProgressTracker(STATUS_PROGRESS_LABELS[lang], activeIndex)}
          ${detailsSection}
          ${cttButton}
          <tr>
            <td class="ums-px" align="center" style="padding:32px 32px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" bgcolor="${BLACK}" style="border-radius:2px; background-color:${BLACK}; border:1px solid ${GOLD};">
                    <a href="${escapeHtml(trackingUrl)}" target="_blank" style="display:inline-block; padding:15px 34px; font-family:${SANS}; font-size:12px; letter-spacing:2px; font-weight:700; color:${GOLD_ON_BLACK}; text-decoration:none; text-transform:uppercase;">${escapeHtml(confirmationCopy.ctaText)}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="ums-px" style="padding:44px 32px 0;">
              <div style="font-family:${SERIF}; font-size:13px; letter-spacing:1px; text-transform:uppercase; color:${INK}; border-bottom:1px solid ${INK}; padding-bottom:10px;">${escapeHtml(confirmationCopy.supportHeading)}</div>
              <div style="font-family:${SANS}; font-size:13px; line-height:20px; color:${INK_SOFT}; margin-top:14px;">${escapeHtml(confirmationCopy.supportBody)}</div>
              <div style="font-family:${SANS}; font-size:13px; line-height:26px; margin-top:8px;">
                <a href="mailto:${escapeHtml(supportEmail)}" style="color:${GOLD}; text-decoration:none;">${escapeHtml(confirmationCopy.emailLinkText)}</a>
              </div>
            </td>
          </tr>
          ${renderFooterRows({ tagline: confirmationCopy.footerTagline, rights: confirmationCopy.footerRights(year), siteUrl })}`

  const html = renderEmailShell({ lang, subject, preheader, rows })

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

export type ReturnStatusEmailInput = {
  to: string; customerName: string; returnNumber: string; orderNumber: string
  status: string; resolution: string; amount: number; currency: string; lang?: EmailLang
}

export function buildReturnStatusEmail(input: ReturnStatusEmailInput): { subject: string; html: string } {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const labels = lang === 'en'
    ? { subject: `Return ${input.returnNumber} updated`, heading: 'Your return has been updated', order: 'Original order', status: 'Status', resolution: 'Resolution', amount: 'Approved value', support: 'If you have any questions, reply to this email.' }
    : { subject: `Devolução ${input.returnNumber} atualizada`, heading: 'A sua devolução foi atualizada', order: 'Encomenda original', status: 'Estado', resolution: 'Resolução', amount: 'Valor aprovado', support: 'Se tiver alguma questão, responda a este email.' }
  const statusLabels: Record<string, Record<EmailLang, string>> = {
    requested: { pt: 'Pedido recebido', en: 'Request received' }, approved: { pt: 'Aprovada', en: 'Approved' }, awaiting_item: { pt: 'A aguardar artigo', en: 'Awaiting item' }, received: { pt: 'Artigo recebido', en: 'Item received' }, inspected: { pt: 'Inspecionada', en: 'Inspected' }, resolved: { pt: 'Concluída', en: 'Resolved' }, rejected: { pt: 'Recusada', en: 'Rejected' }, customer_cancelled: { pt: 'Cancelada', en: 'Cancelled' },
  }
  const resolutionLabels: Record<string, Record<EmailLang, string>> = { refund: { pt: 'Reembolso', en: 'Refund' }, exchange: { pt: 'Troca', en: 'Exchange' }, store_credit: { pt: 'Crédito em loja', en: 'Store credit' } }
  const subject = labels.subject
  const rows = `${renderHeaderRow()}<tr><td class="ums-px" style="padding:40px 32px;"><div style="font-family:${SANS};font-size:11px;letter-spacing:1.5px;color:${GOLD};">${escapeHtml(input.returnNumber)}</div><h1 style="font-family:${SERIF};font-weight:400;color:${INK};">${escapeHtml(labels.heading)}, ${escapeHtml(resolveFirstName(input.customerName) || input.customerName)}.</h1><table role="presentation" width="100%" style="font-family:${SANS};font-size:13px;line-height:26px;color:${INK_SOFT};"><tr><td>${labels.order}</td><td align="right"><b>${escapeHtml(input.orderNumber)}</b></td></tr><tr><td>${labels.status}</td><td align="right"><b>${escapeHtml(statusLabels[input.status]?.[lang] || input.status)}</b></td></tr><tr><td>${labels.resolution}</td><td align="right"><b>${escapeHtml(resolutionLabels[input.resolution]?.[lang] || input.resolution)}</b></td></tr><tr><td>${labels.amount}</td><td align="right"><b>${escapeHtml(String(input.amount))} ${escapeHtml(input.currency)}</b></td></tr></table><p style="font-family:${SANS};font-size:13px;color:${INK_SOFT};margin-top:28px;">${escapeHtml(labels.support)}</p></td></tr>${renderFooterRows({ tagline: 'Use Me With Style', rights: `© ${new Date().getFullYear()} Use Me With Style`, siteUrl: (process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop').replace(/\/$/, '') })}`
  return { subject, html: renderEmailShell({ lang, subject, preheader: subject, rows }) }
}

export async function sendReturnStatusEmail(payload: Payload, input: ReturnStatusEmailInput): Promise<void> {
  const { subject, html } = buildReturnStatusEmail(input)
  if (!process.env.RESEND_API_KEY) { console.log(`[email:not-configured] would send return notice for ${input.returnNumber} to ${input.to}`); return }
  try { await payload.sendEmail({ to: input.to, subject, html }) } catch (error) { console.error('[return-email:send-failed]', error) }
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

// Customer-facing "we got your message" auto-reply (2026-08-06 request,
// alongside the order-confirmation redesign) -- sent TO the customer,
// separate from sendContactFormEmail above (which notifies the internal
// team). Reuses the same shared header/footer chrome (renderHeaderRow,
// renderFooterRows, renderEmailShell) as buildOrderConfirmationEmail so it
// carries the same brand look, but its own copy dict/content since there's
// no order to summarize here -- just an acknowledgement, a rough response-
// time expectation, and a recap of what the customer actually submitted (so
// they can immediately confirm nothing was garbled/dropped).
export type ContactAutoReplyInput = {
  to: string
  name: string
  // The Help page form doesn't currently send `lang` -- see contact.ts and
  // Help.tsx/api.ts on the frontend, which need a small addition to pass
  // the storefront's active UI language through. Defaults to 'pt' exactly
  // like every other email in this file when omitted (e.g. an older
  // frontend build that hasn't picked up that change yet).
  lang?: EmailLang
  orderNumber?: string
  message: string
}

const CONTACT_AUTO_REPLY_COPY: Record<
  EmailLang,
  {
    subject: string
    preheader: (firstName: string) => string
    heading: (firstName: string) => string
    body: string
    responseTimeNote: string
    recapHeading: string
    orderNumberLabel: string
    footerTagline: string
    footerRights: (year: number) => string
  }
> = {
  pt: {
    subject: 'Recebemos a sua mensagem -- Use Me With Style',
    preheader: (firstName) => `Obrigada por nos contactar, ${firstName}. A nossa equipa responde em breve.`,
    heading: (firstName) => `Recebemos a sua mensagem, ${firstName}.`,
    body: 'Obrigada por entrar em contacto. A nossa equipa vai analisar o que escreveu e responde assim que possível, normalmente dentro de 1 a 2 dias úteis.',
    responseTimeNote: 'Esta caixa de correio não é monitorizada em tempo real -- não é necessário responder a esta mensagem automática; entraremos em contacto diretamente através do email que indicou.',
    recapHeading: 'O que recebemos',
    orderNumberLabel: 'Número da encomenda',
    footerTagline: 'Peças pensadas para durar, com um acabamento cuidado.',
    footerRights: (year) => `© ${year} Use Me With Style. Todos os direitos reservados.`,
  },
  en: {
    subject: "We've received your message -- Use Me With Style",
    preheader: (firstName) => `Thanks for reaching out, ${firstName}. Our team will reply soon.`,
    heading: (firstName) => `We've received your message, ${firstName}.`,
    body: "Thank you for getting in touch. Our team will review what you've sent and reply as soon as possible, usually within 1-2 business days.",
    responseTimeNote: "This inbox isn't monitored in real time -- there's no need to reply to this automatic message; we'll contact you directly at the email address you provided.",
    recapHeading: 'What we received',
    orderNumberLabel: 'Order number',
    footerTagline: 'Pieces made to last, finished with care.',
    footerRights: (year) => `© ${year} Use Me With Style. All rights reserved.`,
  },
}

export function buildContactAutoReplyEmail(input: ContactAutoReplyInput): { subject: string; html: string } {
  const lang: EmailLang = input.lang === 'en' ? 'en' : 'pt'
  const copy = CONTACT_AUTO_REPLY_COPY[lang]
  const siteUrl = (process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.shop').replace(/\/$/, '')
  const year = new Date().getFullYear()

  const firstName = resolveFirstName(input.name)
  const subject = copy.subject
  const preheader = copy.preheader(firstName || input.name)

  const recapRows = [
    input.orderNumber
      ? `<div style="margin-bottom:10px;"><span style="font-family:${SANS}; font-size:11px; letter-spacing:1px; text-transform:uppercase; color:${GOLD};">${escapeHtml(copy.orderNumberLabel)}</span><br/><span style="font-family:${SANS}; font-size:13px; color:${INK};">${escapeHtml(input.orderNumber)}</span></div>`
      : '',
    `<div style="font-family:${SANS}; font-size:13px; line-height:20px; color:${INK}; white-space:pre-wrap;">${escapeHtml(input.message)}</div>`,
  ]
    .filter(Boolean)
    .join('')

  const rows = `
          ${renderHeaderRow()}
          <tr>
            <td class="ums-px" style="padding:40px 32px 0;">
              <div style="font-family:${SERIF}; font-size:28px; line-height:34px; color:${INK}; font-weight:400;">${escapeHtml(copy.heading(firstName || input.name))}</div>
              <div style="font-family:${SANS}; font-size:14px; line-height:22px; color:${INK_SOFT}; margin-top:14px;">${escapeHtml(copy.body)}</div>
            </td>
          </tr>
          <tr>
            <td class="ums-px" style="padding:20px 32px 0;">
              <div style="font-family:${SANS}; font-size:12px; line-height:19px; color:${INK_SOFT}; background-color:${IVORY}; border:1px solid ${HAIRLINE}; border-radius:4px; padding:14px 16px;">${escapeHtml(copy.responseTimeNote)}</div>
            </td>
          </tr>
          <tr>
            <td class="ums-px" style="padding:32px 32px 0;">
              <div style="font-family:${SERIF}; font-size:13px; letter-spacing:1px; text-transform:uppercase; color:${INK}; border-bottom:1px solid ${INK}; padding-bottom:10px;">${escapeHtml(copy.recapHeading)}</div>
              <div style="margin-top:16px;">${recapRows}</div>
            </td>
          </tr>
          ${renderFooterRows({ tagline: copy.footerTagline, rights: copy.footerRights(year), siteUrl })}`

  const html = renderEmailShell({ lang, subject, preheader, rows })

  return { subject, html }
}

export async function sendContactAutoReplyEmail(payload: Payload, input: ContactAutoReplyInput): Promise<void> {
  const { subject, html } = buildContactAutoReplyEmail(input)

  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.log(`[email:not-configured] would send contact auto-reply (${input.lang ?? 'pt'}) to ${input.to}`)
    return
  }

  try {
    await payload.sendEmail({ to: input.to, subject, html })
  } catch (err) {
    // Never let this fail the contact-form submission -- the internal
    // notification (sendContactFormEmail) is the one that actually needs to
    // reach the team; this is just a courtesy acknowledgement to the
    // customer, and by the time this runs their message has already been
    // sent successfully (see contact.ts's call order).
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
