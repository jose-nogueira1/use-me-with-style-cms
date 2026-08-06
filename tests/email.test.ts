import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildContactAutoReplyEmail,
  buildOrderConfirmationEmail,
  buildOrderStatusEmail,
  deliveryMethodLabel,
  formatOrderMoney,
  paymentMethodLabel,
  resolveFirstName,
} from '../src/lib/email'

// Minimal, valid base input -- mirrors the OLD (pre-redesign) call shape on
// purpose, so these tests also cover that every field beyond it stays
// genuinely optional (no crash, no broken/empty sections) for any caller
// that hasn't been updated yet.
const BASE = {
  to: 'customer@example.com',
  orderNumber: 'PT-100200',
  customerName: 'Maria Fernandes',
  total: 45.5,
  currency: 'EUR',
} as const

test('subject and preheader match the requested PT/EN copy', () => {
  const pt = buildOrderConfirmationEmail({ ...BASE, lang: 'pt' })
  assert.equal(pt.subject, 'A sua encomenda está confirmada ✨ -- #PT-100200')
  assert.match(pt.html, /É oficial, Maria\./)
  assert.match(pt.html, /Obrigada, Maria\. Já estamos a preparar as suas peças\./)

  const en = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.equal(en.subject, 'Your order is confirmed ✨ -- #PT-100200')
  assert.match(en.html, /It's official, Maria\./)
})

test('defaults to Portuguese copy when lang is omitted or unrecognized', () => {
  const noLang = buildOrderConfirmationEmail({ ...BASE })
  assert.match(noLang.subject, /A sua encomenda está confirmada/)

  const badLang = buildOrderConfirmationEmail({ ...BASE, lang: 'fr' as never })
  assert.match(badLang.subject, /A sua encomenda está confirmada/)
})

test('greeting uses the first name, preferring the explicit field over a derived one', () => {
  const explicit = buildOrderConfirmationEmail({ ...BASE, customerName: 'Maria Fernandes', customerFirstName: 'Mia', lang: 'en' })
  assert.match(explicit.html, /It's official, Mia\./)

  const derived = buildOrderConfirmationEmail({ ...BASE, customerName: 'João Pedro Alves', lang: 'en' })
  assert.match(derived.html, /It's official, João\./)
})

test('resolveFirstName falls back sensibly', () => {
  assert.equal(resolveFirstName('Ana Sofia Martins'), 'Ana')
  assert.equal(resolveFirstName('Ana Sofia Martins', 'Aninha'), 'Aninha')
  assert.equal(resolveFirstName('Ana Sofia Martins', '  '), 'Ana') // blank explicit value falls through
  assert.equal(resolveFirstName(''), '')
})

test('HTML-escapes every customer- and order-controlled value', () => {
  const { html } = buildOrderConfirmationEmail({
    ...BASE,
    orderNumber: '<script>alert(1)</script>',
    // No internal whitespace, so resolveFirstName's "first token" split
    // leaves this value intact -- it's the whole string that must come out
    // escaped in the heading/preheader.
    customerName: '"><img/src=x/onerror=alert(1)>',
    lang: 'en',
    discountAmount: 5,
    discountLabel: '<b>VIP</b> & friends',
    subtotal: 50,
    shippingCost: 0,
    items: [
      {
        productName: '<svg onload=alert(2)>Dress</svg>',
        size: '"M"',
        color: 'Black & Gold',
        qty: 1,
        unitPrice: 45.5,
        imageUrl: 'https://example.com/x.jpg?a=1&b=2',
        imageAlt: '<script>bad</script>',
      },
    ],
    address: {
      line1: '<b>123 Main</b>',
      city: 'Porto"',
      country: 'Portugal',
    },
  })

  // No raw, un-escaped injection payloads anywhere in the output.
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(html, /"><img\/src=x\/onerror=alert\(1\)>/)
  assert.doesNotMatch(html, /<svg onload=alert\(2\)>/)
  assert.doesNotMatch(html, /<script>bad<\/script>/)
  assert.doesNotMatch(html, /<b>VIP<\/b>/)
  assert.doesNotMatch(html, /<b>123 Main<\/b>/)

  // The escaped forms are present instead.
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/) // orderNumber, shown in the meta line
  assert.match(html, /&quot;&gt;&lt;img\/src=x\/onerror=alert\(1\)&gt;/) // customerName, used as the greeting's first name
  assert.match(html, /&lt;svg onload=alert\(2\)&gt;Dress&lt;\/svg&gt;/) // productName
  assert.match(html, /&lt;b&gt;VIP&lt;\/b&gt; &amp; friends/) // discountLabel
  assert.match(html, /&lt;b&gt;123 Main&lt;\/b&gt;/) // address line1
  assert.match(html, /Porto&quot;/) // city
  // The & inside the image URL query string is escaped as an HTML attribute
  // value (still a valid, working URL once the browser/email client
  // unescapes the entity back to `&`).
  assert.match(html, /src="https:\/\/example\.com\/x\.jpg\?a=1&amp;b=2"/)
})

test('items render image, name, colour/size, quantity and a localized price; missing image falls back to a placeholder', () => {
  const { html } = buildOrderConfirmationEmail({
    ...BASE,
    lang: 'en',
    currency: 'EUR',
    items: [
      { productName: 'Silk Slip Dress', size: 'S', color: 'Ivory', qty: 2, unitPrice: 39.99, imageUrl: 'https://cdn.example.com/dress.jpg', imageAlt: 'Silk Slip Dress' },
      { productName: 'Leather Belt', size: 'One size', qty: 1, unitPrice: 25 }, // no color, no image
    ],
  })

  assert.match(html, /<img src="https:\/\/cdn\.example\.com\/dress\.jpg"/)
  assert.match(html, /Silk Slip Dress/)
  assert.match(html, /Size S/)
  assert.match(html, /Colour Ivory/)
  assert.match(html, /Qty 2/)
  // Line total for the first item: 2 x 39.99 = 79.98
  assert.match(html, /79\.98 EUR/)
  // Unit price shown for a qty>1 line.
  assert.match(html, /2&nbsp;&times;&nbsp;39\.99 EUR/)

  // Second item has no imageUrl -- a placeholder <div>, never a broken <img>.
  assert.match(html, /Leather Belt/)
  assert.match(html, /Qty 1/)
  const leatherBeltRow = html.slice(html.indexOf('Leather Belt') - 400, html.indexOf('Leather Belt') + 200)
  assert.doesNotMatch(leatherBeltRow, /<img/) // no broken <img> for the missing image
  assert.doesNotMatch(leatherBeltRow, /Colour/) // no "Colour" meta segment when color is absent
})

test('omits the items section entirely when no items are provided (backward compatible minimal input)', () => {
  const { html } = buildOrderConfirmationEmail({ ...BASE })
  assert.doesNotMatch(html, /Os seus artigos/)
})

test('summary shows subtotal, discount (only when positive) and shipping (or "free"), always ending in total', () => {
  const withDiscount = buildOrderConfirmationEmail({
    ...BASE,
    lang: 'pt',
    subtotal: 100,
    discountAmount: 10,
    discountLabel: 'SS26 (10% off)',
    shippingCost: 0,
    total: 90,
  })
  assert.match(withDiscount.html, /SS26 \(10% off\)/)
  assert.match(withDiscount.html, /\u2212\u00a0?10,00 EUR/) // minus-sign prefixed discount amount
  assert.match(withDiscount.html, /Grátis/) // free shipping

  const zeroDiscount = buildOrderConfirmationEmail({
    ...BASE,
    lang: 'pt',
    subtotal: 100,
    discountAmount: 0,
    shippingCost: 5,
    total: 105,
  })
  assert.doesNotMatch(zeroDiscount.html, /Desconto/) // no discount row rendered for a zero/absent discount

  const noDiscountLabel = buildOrderConfirmationEmail({
    ...BASE,
    lang: 'pt',
    subtotal: 100,
    discountAmount: 15,
    shippingCost: 5,
    total: 90,
  })
  assert.match(noDiscountLabel.html, />Desconto</) // falls back to the generic label when discountLabel is absent
})

test('payment method, delivery method and address render only when provided, with human labels', () => {
  const full = buildOrderConfirmationEmail({
    ...BASE,
    lang: 'en',
    paymentMethod: 'stripe',
    deliveryMethod: 'courier_pt',
    courierTrackingCode: 'CT123456789PT',
    address: { line1: 'Rua A, 1', line2: '2nd floor', postalCode: '1000-001', city: 'Lisbon', country: 'Portugal' },
  })
  assert.match(full.html, /Card \(Stripe\)/)
  assert.match(full.html, /CTT Registered \(tracked\)/)
  assert.match(full.html, /CT123456789PT/)
  assert.match(full.html, /Rua A, 1/)
  assert.match(full.html, /1000-001 Lisbon/)

  const bare = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.doesNotMatch(bare.html, />Payment</)
  assert.doesNotMatch(bare.html, />Delivery address</)
})

test('unknown payment/delivery method values fall back to the raw stored value instead of throwing', () => {
  assert.equal(paymentMethodLabel('bank_transfer_ao', 'pt'), 'Transferência bancária')
  assert.equal(paymentMethodLabel('some_future_method', 'en'), 'some_future_method')
  assert.equal(paymentMethodLabel(undefined, 'en'), undefined)
  assert.equal(deliveryMethodLabel('courier_ao', 'en'), 'Local courier')
  assert.equal(deliveryMethodLabel(null, 'pt'), undefined)
})

test('invoice note is shown only when an attachment is passed', () => {
  const withAttachment = buildOrderConfirmationEmail({ ...BASE, lang: 'en', attachment: { filename: 'f.pdf', content: Buffer.from('x') } })
  assert.match(withAttachment.html, /attached to this email as a PDF/)

  const withoutAttachment = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.doesNotMatch(withoutAttachment.html, /attached to this email as a PDF/)
})

test('order date is formatted per-locale and simply omitted when absent', () => {
  const withDate = buildOrderConfirmationEmail({ ...BASE, lang: 'en', orderDate: '2026-03-05T10:00:00.000Z' })
  assert.match(withDate.html, /March 05, 2026/)

  const withoutDate = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.doesNotMatch(withoutDate.html, />Date</)

  const invalidDate = buildOrderConfirmationEmail({ ...BASE, lang: 'en', orderDate: 'not-a-date' })
  assert.doesNotMatch(invalidDate.html, />Date</)
})

test('currency is localized through Intl, not raw numeric interpolation', () => {
  assert.equal(formatOrderMoney(1234.5, 'EUR', 'en'), '1,234.50 EUR')
  assert.equal(formatOrderMoney(1234.5, 'EUR', 'en'), formatOrderMoney(1234.5, 'EUR', 'en'))
  // pt-PT uses a comma decimal separator, unlike a naive `${value} ${currency}`.
  const ptFormatted = formatOrderMoney(1234.5, 'Kz', 'pt')
  assert.match(ptFormatted, /,50 Kz$/)
  assert.notEqual(ptFormatted, '1234.5 Kz')
  // Non-finite input never crashes the template -- degrades to 0.
  assert.equal(formatOrderMoney(Number.NaN, 'EUR', 'en'), '0.00 EUR')
})

test('the CTA always links to /conta regardless of language', () => {
  const pt = buildOrderConfirmationEmail({ ...BASE, lang: 'pt' })
  const en = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.match(pt.html, /href="https:\/\/usemewithstyle\.shop\/conta"/)
  assert.match(en.html, /href="https:\/\/usemewithstyle\.shop\/conta"/)
  assert.match(pt.html, />ACOMPANHAR A MINHA ENCOMENDA</)
  assert.match(en.html, />TRACK MY ORDER</)
})

test('the header logo is a self-contained base64 data URI, never a hosted URL', () => {
  // A hosted {siteUrl}/brand/... <img> was reported broken in some clients
  // (2026-08-06) -- the logo is now embedded directly in the email so it
  // can never depend on external hosting/DNS/CORS/blocked-remote-images.
  const { html } = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  const match = html.match(/<img src="(data:image\/png;base64,[^"]+)" alt="Use Me With Style"/)
  assert.ok(match, 'expected a base64-embedded logo <img>')
  const dataUri = match![1]
  assert.doesNotMatch(html, /src="https:\/\/usemewithstyle\.shop\/brand\//) // no hosted logo URL anywhere
  // The payload decodes as a real, reasonably small, non-empty PNG.
  const base64 = dataUri.replace('data:image/png;base64,', '')
  const bytes = Buffer.from(base64, 'base64')
  assert.ok(bytes.length > 1000, 'decoded logo should be a real image, not a stub')
  assert.ok(bytes.length < 100_000, 'decoded logo should be optimized/small, not the raw multi-hundred-KB source')
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a') // PNG magic bytes
})

test('preheader text is present but visually hidden (display:none / mso-hide)', () => {
  const { html } = buildOrderConfirmationEmail({ ...BASE, lang: 'en' })
  assert.match(html, /display:none;[^"]*mso-hide:all/)
  assert.match(html, /Thank you, Maria\. We're already preparing your pieces\./)
})

test('is a single self-contained HTML document with inline styles only (no <script>, no external stylesheet links)', () => {
  const { html } = buildOrderConfirmationEmail({ ...BASE, lang: 'pt' })
  assert.match(html, /^<!doctype html>/)
  assert.doesNotMatch(html, /<script/i)
  assert.doesNotMatch(html, /<link[^>]+stylesheet/i)
})

// --- contact-form auto-reply (2026-08-06) -------------------------------

const CONTACT_BASE = {
  to: 'shopper@example.com',
  name: 'Beatriz Alves',
  message: 'Olá, gostava de saber se o vestido azul volta a ter stock em breve.',
}

test('contact auto-reply subject/preheader/heading match the requested PT/EN copy', () => {
  const pt = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'pt' })
  assert.equal(pt.subject, 'Recebemos a sua mensagem -- Use Me With Style')
  assert.match(pt.html, /Recebemos a sua mensagem, Beatriz\./)
  assert.match(pt.html, /Obrigada por nos contactar, Beatriz\. A nossa equipa responde em breve\./)

  const en = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'en' })
  assert.equal(en.subject, "We've received your message -- Use Me With Style")
  assert.match(en.html, /We've received your message, Beatriz\./)
})

test('contact auto-reply defaults to Portuguese when lang is omitted or unrecognized', () => {
  const noLang = buildContactAutoReplyEmail({ ...CONTACT_BASE })
  assert.match(noLang.subject, /Recebemos a sua mensagem/)
  const badLang = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'fr' as never })
  assert.match(badLang.subject, /Recebemos a sua mensagem/)
})

test('contact auto-reply recaps the order number only when provided, and always recaps the message', () => {
  const withOrder = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'en', orderNumber: 'PT-100200' })
  assert.match(withOrder.html, /Order number/)
  assert.match(withOrder.html, /PT-100200/)
  assert.match(withOrder.html, /gostava de saber se o vestido azul/)

  const withoutOrder = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'en' })
  assert.doesNotMatch(withoutOrder.html, /Order number/)
  assert.match(withoutOrder.html, /gostava de saber se o vestido azul/)
})

test('contact auto-reply HTML-escapes the customer name and message', () => {
  const { html } = buildContactAutoReplyEmail({
    to: 'x@example.com',
    name: '<b>Zoë</b>',
    lang: 'en',
    message: '<script>alert(1)</script> & "quoted"',
    orderNumber: '<i>PT-1</i>',
  })
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.doesNotMatch(html, /<b>Zoë<\/b>/)
  assert.doesNotMatch(html, /<i>PT-1<\/i>/)
  assert.match(html, /&lt;b&gt;Zoë&lt;\/b&gt;/) // greeting uses the (escaped) full name
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quoted&quot;/)
  assert.match(html, /&lt;i&gt;PT-1&lt;\/i&gt;/)
})

test('contact auto-reply shares the same branded shell as the order-confirmation email', () => {
  const { html } = buildContactAutoReplyEmail({ ...CONTACT_BASE, lang: 'pt' })
  assert.match(html, /^<!doctype html>/)
  const logoMatch = html.match(/<img src="(data:image\/png;base64,[^"]+)" alt="Use Me With Style"/)
  assert.ok(logoMatch, 'expected the same embedded logo as the order-confirmation email')
  assert.match(html, />USE ME WITH STYLE</)
  assert.match(html, /Instagram/)
  assert.doesNotMatch(html, /<script/i)
})

// ---------------------------------------------------------------------------
// Shipped/delivered status emails (redesigned 2026-08-06 to share the
// order-confirmation email's branded shell -- see buildOrderStatusEmail).
const STATUS_BASE = {
  to: 'customer@example.com',
  orderNumber: 'PT-100200',
  customerName: 'Maria Fernandes',
  stage: 'shipped',
} as const

test('status email subject/eyebrow/heading/body match the requested PT/EN copy, per stage', () => {
  const shippedPt = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', stage: 'shipped' })
  assert.equal(shippedPt.subject, 'Encomenda PT-100200 enviada -- Use Me With Style')
  assert.match(shippedPt.html, /ENVIADA/)
  assert.match(shippedPt.html, /A caminho, Maria\./)
  assert.match(shippedPt.html, /A sua encomenda foi enviada e está a caminho\./)

  const shippedEn = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'en', stage: 'shipped' })
  assert.equal(shippedEn.subject, 'Order PT-100200 shipped -- Use Me With Style')
  assert.match(shippedEn.html, /SHIPPED/)
  assert.match(shippedEn.html, /On its way, Maria\./)
  assert.match(shippedEn.html, /Your order has shipped and is on its way\./)

  const deliveredPt = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', stage: 'delivered' })
  assert.equal(deliveredPt.subject, 'Encomenda PT-100200 entregue -- Use Me With Style')
  assert.match(deliveredPt.html, /ENTREGUE/)
  assert.match(deliveredPt.html, /Chegou, Maria!/)

  const deliveredEn = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'en', stage: 'delivered' })
  assert.equal(deliveredEn.subject, 'Order PT-100200 delivered -- Use Me With Style')
  assert.match(deliveredEn.html, /DELIVERED/)
  assert.match(deliveredEn.html, /It's here, Maria!/)
})

test('status email defaults to Portuguese copy when lang is omitted or unrecognized', () => {
  const omitted = buildOrderStatusEmail({ ...STATUS_BASE })
  assert.match(omitted.subject, /enviada/)
  const unrecognized = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'fr' as never })
  assert.match(unrecognized.subject, /enviada/)
})

test('status email greeting uses the first name, preferring the explicit field over a derived one', () => {
  const explicit = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', customerName: 'Maria Fernandes', customerFirstName: 'Mia' })
  assert.match(explicit.html, /A caminho, Mia\./)

  const derived = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', customerName: 'João Pedro Silva', customerFirstName: null })
  assert.match(derived.html, /A caminho, João\./)
})

test('status email progress marker highlights up through the current stage: shipped = 2 filled circles, delivered = 3', () => {
  const shipped = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', stage: 'shipped' })
  const shippedFilled = shipped.html.match(/background-color:#B08A4E;/g) ?? []
  assert.equal(shippedFilled.length, 2, 'Confirmed + Shipped should be filled, Delivered should not')
  assert.match(shipped.html, />Confirmada</)
  assert.match(shipped.html, />Enviada</)
  assert.match(shipped.html, />Entregue</)

  const delivered = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', stage: 'delivered' })
  const deliveredFilled = delivered.html.match(/background-color:#B08A4E;/g) ?? []
  assert.equal(deliveredFilled.length, 3, 'all three stages should be filled once delivered')
})

test('status email shows the tracking code and CTT link only when provided, independently of each other', () => {
  const neither = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt' })
  assert.doesNotMatch(neither.html, /Código de rastreio/)
  assert.doesNotMatch(neither.html, /SEGUIR NOS CTT/)

  const codeOnly = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', courierTrackingCode: 'RR123456789PT' })
  assert.match(codeOnly.html, /Código de rastreio/)
  assert.match(codeOnly.html, /RR123456789PT/)
  assert.doesNotMatch(codeOnly.html, /SEGUIR NOS CTT/)

  const both = buildOrderStatusEmail({
    ...STATUS_BASE,
    lang: 'pt',
    courierTrackingCode: 'RR123456789PT',
    courierTrackingUrl: 'https://www.ctt.pt/track?objects=RR123456789PT',
  })
  assert.match(both.html, /Código de rastreio/)
  assert.match(both.html, /SEGUIR NOS CTT/)
  assert.match(both.html, /href="https:\/\/www\.ctt\.pt\/track\?objects=RR123456789PT"/)

  const englishCta = buildOrderStatusEmail({
    ...STATUS_BASE,
    lang: 'en',
    courierTrackingCode: 'RR123456789PT',
    courierTrackingUrl: 'https://www.ctt.pt/track?objects=RR123456789PT',
  })
  assert.match(englishCta.html, /TRACK WITH CTT/)
})

test('status email HTML-escapes every customer- and order-controlled value', () => {
  const { html } = buildOrderStatusEmail({
    to: 'customer@example.com',
    orderNumber: '<i>PT-1</i>',
    customerName: '<b>Zoë</b>',
    lang: 'pt',
    stage: 'shipped',
    courierTrackingCode: '<script>alert(1)</script> & "quoted"',
    courierTrackingUrl: 'https://example.com/?x=1&y=2',
  })
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/)
  assert.match(html, /&lt;i&gt;PT-1&lt;\/i&gt;/)
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; &quot;quoted&quot;/)
})

test('status email CTA always links to /conta regardless of language or stage', () => {
  const shipped = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'en', stage: 'shipped' })
  const delivered = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt', stage: 'delivered' })
  assert.match(shipped.html, /href="https:\/\/usemewithstyle\.shop\/conta"/)
  assert.match(delivered.html, /href="https:\/\/usemewithstyle\.shop\/conta"/)
})

test('status email reuses the exact support/footer copy from the confirmation email (single source of truth)', () => {
  const { html } = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt' })
  assert.match(html, /O email é o nosso canal oficial de apoio\./)
  assert.match(html, /Peças pensadas para durar, com um acabamento cuidado\./)
  assert.match(html, /ACOMPANHAR A MINHA ENCOMENDA/)
})

test('status email shares the same branded shell as the order-confirmation email', () => {
  const { html } = buildOrderStatusEmail({ ...STATUS_BASE, lang: 'pt' })
  assert.match(html, /^<!doctype html>/)
  const logoMatch = html.match(/<img src="(data:image\/png;base64,[^"]+)" alt="Use Me With Style"/)
  assert.ok(logoMatch, 'expected the same embedded logo as the order-confirmation email')
  assert.match(html, />USE ME WITH STYLE</)
  assert.match(html, /Instagram/)
  assert.doesNotMatch(html, /<script/i)
  const preheaderDiv = html.match(/<div style="display:none;[^"]*">\s*([^\n<]+)/)
  assert.ok(preheaderDiv, 'expected a hidden preheader div')
})
