import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Payload } from 'payload'
import { readFile } from 'node:fs/promises'

import type { InvoiceAttachment } from './email'

type Market = 'AO' | 'PT'
type InvoiceLineInput = {
  productName: string
  size: string
  color?: string | null
  qty: number
  unitPrice: number
}

export type OrderForInternalInvoice = {
  id: number
  orderNumber: string
  market: Market
  lang?: 'pt' | 'en'
  customerName: string
  customerEmail: string
  customerPhone?: string
  customerTaxId?: string
  customerAddress: string
  currency: 'Kz' | 'EUR'
  subtotal: number
  shippingCost: number
  // Coupon codes (2026-07-25, discounts phase 2) -- discountAmount is
  // already subtracted into `total`; these two are only needed here to
  // render the discount as its own labeled invoice line instead of letting
  // it collapse into the generic "Ajuste da encomenda" reconciliation line.
  discountAmount?: number
  discountLabel?: string | null
  total: number
  paymentMethod?: string
  paymentReference?: string
  items: InvoiceLineInput[]
}

type Settings = {
  enabled: boolean
  issuerName: string
  issuerTaxId?: string
  issuerAddress?: string
  vatRate: number
  taxNote?: string
  prefix: string
  footer?: string
  disclaimer: string
}

// PDF chrome labels (2026-07-26 bilingual audit fix): every one of these was
// previously a hardcoded Portuguese literal drawn directly onto the page,
// regardless of the order's `lang` -- unlike order-confirmation emails
// (lib/email.ts's EMAIL_COPY), which already branch correctly. English or
// Portugal/international customers who chose English at checkout still got
// an all-Portuguese invoice. `order.lang` is already captured on every order
// (see the `lang` field on OrderForInternalInvoice); this just finally reads
// it here too.
const PDF_LABELS = {
  pt: {
    invoiceHeading: 'FATURA COMERCIAL',
    continuation: 'CONTINUAÇÃO',
    issuer: 'EMITENTE',
    billTo: 'FATURAR A',
    payment: 'PAGAMENTO',
    method: 'Método',
    reference: 'Referência',
    date: 'Data',
    paidBadge: 'PAGO',
    orderDetails: 'DETALHES DA ENCOMENDA',
    description: 'DESCRIÇÃO',
    quantity: 'QTD.',
    price: 'PREÇO',
    total: 'TOTAL',
    summary: 'RESUMO',
    net: 'Líquido',
    vatIncluded: (rate: number) => `IVA incluído (${rate}%)`,
    totalPaid: 'TOTAL PAGO',
    shippingLine: 'Portes de envio',
    discountLine: 'Desconto',
    orderAdjustmentLine: 'Ajuste da encomenda',
    trackOrder: (url: string) => `Consulte a sua encomenda em ${url}`,
    footerBrand: 'USE ME WITH STYLE',
    footerDocType: 'Documento comercial interno',
    page: (n: number, total: number) => `PÁGINA ${n} / ${total}`,
    dateLocale: 'pt-PT',
  },
  en: {
    invoiceHeading: 'COMMERCIAL INVOICE',
    continuation: 'CONTINUED',
    issuer: 'ISSUER',
    billTo: 'BILL TO',
    payment: 'PAYMENT',
    method: 'Method',
    reference: 'Reference',
    date: 'Date',
    paidBadge: 'PAID',
    orderDetails: 'ORDER DETAILS',
    description: 'DESCRIPTION',
    quantity: 'QTY',
    price: 'PRICE',
    total: 'TOTAL',
    summary: 'SUMMARY',
    net: 'Net',
    vatIncluded: (rate: number) => `VAT included (${rate}%)`,
    totalPaid: 'TOTAL PAID',
    shippingLine: 'Shipping',
    discountLine: 'Discount',
    orderAdjustmentLine: 'Order adjustment',
    trackOrder: (url: string) => `Track your order at ${url}`,
    footerBrand: 'USE ME WITH STYLE',
    footerDocType: 'Internal commercial document',
    page: (n: number, total: number) => `PAGE ${n} / ${total}`,
    dateLocale: 'en-US',
  },
} as const

type PdfLang = keyof typeof PDF_LABELS

export type CalculatedInvoiceLine = {
  description: string
  quantity: number
  unitPrice: number
  netAmount: number
  taxAmount: number
  grossAmount: number
}

export type InvoiceCalculation = {
  lines: CalculatedInvoiceLine[]
  netTotal: number
  taxTotal: number
  total: number
}

const DEFAULT_DISCLAIMER: Record<PdfLang, string> = {
  pt: 'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.',
  en: 'Internal commercial document, not fiscally certified. Must be validated and processed by the issuing entity’s accountant.',
}

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateIncludedVatInvoice(
  order: Pick<OrderForInternalInvoice, 'items' | 'shippingCost' | 'total' | 'discountAmount' | 'discountLabel'>,
  vatRate: number,
  lang: PdfLang = 'pt',
): InvoiceCalculation {
  const labels = PDF_LABELS[lang]
  const rate = Math.max(0, Number(vatRate) || 0)
  const divisor = 1 + rate / 100
  const lines: CalculatedInvoiceLine[] = order.items.map((item) => {
    const grossAmount = roundMoney(item.qty * item.unitPrice)
    const netAmount = rate > 0 ? roundMoney(grossAmount / divisor) : grossAmount
    return {
      description: `${item.productName} — ${item.size}${item.color ? ` / ${item.color}` : ''}`,
      quantity: item.qty,
      unitPrice: roundMoney(item.unitPrice),
      netAmount,
      taxAmount: roundMoney(grossAmount - netAmount),
      grossAmount,
    }
  })

  if (order.shippingCost > 0) {
    const grossAmount = roundMoney(order.shippingCost)
    const netAmount = rate > 0 ? roundMoney(grossAmount / divisor) : grossAmount
    lines.push({
      description: labels.shippingLine,
      quantity: 1,
      unitPrice: grossAmount,
      netAmount,
      taxAmount: roundMoney(grossAmount - netAmount),
      grossAmount,
    })
  }

  if (order.discountAmount && order.discountAmount > 0) {
    const grossAmount = roundMoney(-order.discountAmount)
    const netAmount = rate > 0 ? roundMoney(grossAmount / divisor) : grossAmount
    lines.push({
      description: order.discountLabel || labels.discountLine,
      quantity: 1,
      unitPrice: grossAmount,
      netAmount,
      taxAmount: roundMoney(grossAmount - netAmount),
      grossAmount,
    })
  }

  const lineGross = roundMoney(lines.reduce((sum, line) => sum + line.grossAmount, 0))
  const paidTotal = roundMoney(order.total)
  const adjustment = roundMoney(paidTotal - lineGross)
  if (adjustment !== 0) {
    const netAmount = rate > 0 ? roundMoney(adjustment / divisor) : adjustment
    lines.push({
      description: labels.orderAdjustmentLine,
      quantity: 1,
      unitPrice: adjustment,
      netAmount,
      taxAmount: roundMoney(adjustment - netAmount),
      grossAmount: adjustment,
    })
  }

  const netTotal = rate > 0 ? roundMoney(paidTotal / divisor) : paidTotal
  const taxTotal = roundMoney(paidTotal - netTotal)
  const lineTaxTotal = roundMoney(lines.reduce((sum, line) => sum + line.taxAmount, 0))
  const taxRoundingDifference = roundMoney(taxTotal - lineTaxTotal)
  if (taxRoundingDifference !== 0 && lines.length) {
    const last = lines[lines.length - 1]
    last.taxAmount = roundMoney(last.taxAmount + taxRoundingDifference)
    last.netAmount = roundMoney(last.grossAmount - last.taxAmount)
  }

  return { lines, netTotal, taxTotal, total: paidTotal }
}

async function getSettings(payload: Payload, market: Market, lang: PdfLang): Promise<Settings> {
  const global = (await payload.findGlobal({ slug: 'invoice-settings', overrideAccess: true })) as unknown as Record<
    string,
    unknown
  >
  const suffix = market
  const readString = (name: string): string | undefined => {
    const value = global[`${name}${suffix}`]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }
  // Disclaimer is PT/EN (language), not AO/PT (market) -- split 2026-07-26
  // bilingual audit fix, see InvoiceSettings.ts's field comment.
  const disclaimerKey = lang === 'en' ? 'phaseOneDisclaimerEN' : 'phaseOneDisclaimerPT'
  const disclaimerValue = global[disclaimerKey]

  return {
    enabled: global[`invoicingEnabled${suffix}`] !== false,
    issuerName: readString('issuerName') || 'Use Me With Style',
    issuerTaxId: readString('issuerTaxId'),
    issuerAddress: readString('issuerAddress'),
    vatRate: Math.max(0, Number(global[`vatRate${suffix}`]) || 0),
    taxNote: readString('taxNote'),
    prefix: (readString('invoicePrefix') || `UMWS-${market}`).replace(/[^A-Za-z0-9-]/g, '-'),
    footer: readString('invoiceFooter'),
    disclaimer:
      typeof disclaimerValue === 'string' && disclaimerValue.trim() ? disclaimerValue.trim() : DEFAULT_DISCLAIMER[lang],
  }
}

function formatMoney(value: number, currency: string, lang: PdfLang): string {
  return `${new Intl.NumberFormat(PDF_LABELS[lang].dateLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`
}

function safePdfText(value: string): string {
  return value.replace(/—/g, '-').replace(/–/g, '-').replace(/\u00a0/g, ' ')
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = safePdfText(text).split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

// "Boutique Dark" layout (2026-07-26 redesign, replacing the original
// cream-only layout): a full-bleed dark header/footer bookend the page
// (mirrors the storefront's dark hero treatment), with a three-column
// issuer/bill-to/payment band replacing the old two flat cards -- payment
// method/reference previously weren't shown on the invoice at all. Chosen
// by Jay-P over a lighter "refined editorial" alternative after reviewing
// both as rendered samples.
async function renderInvoicePdf(input: {
  invoiceNumber: string
  issuedAt: Date
  order: OrderForInternalInvoice
  settings: Settings
  calculation: InvoiceCalculation
  lang: PdfLang
}): Promise<Buffer> {
  const labels = PDF_LABELS[input.lang]
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const width = 595.28
  const height = 841.89
  const margin = 48

  const ink = rgb(0.02, 0.02, 0.02)
  const near0 = rgb(0.02, 0.02, 0.02)
  const muted = rgb(0.42, 0.4, 0.36)
  const paper = rgb(1, 0.99, 0.973)
  const stone = rgb(0.91, 0.87, 0.81)
  const rowTint = rgb(0.965, 0.955, 0.93)
  const gold = rgb(0.79, 0.63, 0.22)
  const champagne = rgb(0.898, 0.761, 0.31)
  const goldDeep = rgb(0.58, 0.44, 0.15)
  const onDarkText = rgb(0.996, 0.992, 0.973)
  const onDarkMuted = rgb(0.78, 0.75, 0.7)

  let page: PDFPage = pdf.addPage([width, height])
  let y = 0
  const headerH = 148
  const footerH = 116

  let whiteLogo: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
  let pictorial: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
  try {
    const [logoBytes, pictorialBytes] = await Promise.all([
      readFile(new URL('../assets/use-me-logo-white-transparent.png', import.meta.url)),
      readFile(new URL('../assets/use-me-pictorial-gold.png', import.meta.url)),
    ])
    whiteLogo = await pdf.embedPng(logoBytes)
    pictorial = await pdf.embedPng(pictorialBytes)
  } catch (error) {
    // Keep invoice generation operational if deployment packaging ever omits
    // the brand assets; the issuer name / plain text fallback below still
    // produces a usable, correctly-branded-in-substance document.
    // eslint-disable-next-line no-console
    console.error('[invoice:brand-assets-unavailable]', error)
  }

  const draw = (text: string, x: number, size = 9, font: PDFFont = regular, color = ink) => {
    page.drawText(safePdfText(text), { x, y, size, font, color })
  }
  const drawRight = (text: string, right: number, baseline: number, size = 9, font: PDFFont = regular, color = ink) => {
    const safe = safePdfText(text)
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y: baseline, size, font, color })
  }

  const drawHeader = (continuation = false) => {
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper })
    page.drawRectangle({ x: 0, y: height - headerH, width, height: headerH, color: near0 })
    if (whiteLogo) {
      const dim = whiteLogo.scaleToFit(140, 66)
      page.drawImage(whiteLogo, { x: margin, y: height - headerH / 2 - dim.height / 2 + 4, width: dim.width, height: dim.height })
    } else {
      page.drawText('Use Me with Style', { x: margin, y: height - 76, size: 20, font: serif, color: onDarkText })
    }
    const metaRight = width - margin
    const eyebrow = continuation ? labels.continuation : labels.invoiceHeading
    page.drawText(eyebrow, { x: metaRight - bold.widthOfTextAtSize(eyebrow, 8), y: height - 56, size: 8, font: bold, color: champagne })
    page.drawText(input.invoiceNumber, {
      x: metaRight - serif.widthOfTextAtSize(input.invoiceNumber, 16),
      y: height - 78,
      size: 16,
      font: serif,
      color: onDarkText,
    })
    const dateStr = input.issuedAt.toLocaleDateString(labels.dateLocale)
    page.drawText(dateStr, { x: metaRight - regular.widthOfTextAtSize(dateStr, 9), y: height - 96, size: 9, font: regular, color: onDarkMuted })
    const badgeText = labels.paidBadge
    const badgeW = bold.widthOfTextAtSize(badgeText, 7.5) + 18
    page.drawRectangle({ x: metaRight - badgeW, y: height - 116, width: badgeW, height: 15, color: rgb(0.09, 0.09, 0.08) })
    page.drawRectangle({ x: metaRight - badgeW, y: height - 116, width: 2, height: 15, color: gold })
    page.drawText(badgeText, { x: metaRight - badgeW + 10, y: height - 111.5, size: 7.5, font: bold, color: champagne })
    page.drawRectangle({ x: 0, y: height - headerH - 3, width, height: 3, color: gold })
  }

  const topOfBody = height - headerH - 28
  const newPage = () => {
    page = pdf.addPage([width, height])
    drawHeader(true)
    y = topOfBody
  }
  const ensureSpace = (needed: number) => {
    if (y < footerH + 84 + needed) newPage()
  }
  const drawWrapped = (text: string, x: number, maxWidth: number, size = 9, font: PDFFont = regular, color = ink) => {
    for (const line of wrapText(text, font, size, maxWidth)) {
      ensureSpace(size + 4)
      draw(line, x, size, font, color)
      y -= size + 4
    }
  }

  drawHeader()
  y = topOfBody

  // Three-column info band: Issuer / Bill To / Payment -- the payment
  // method and reference previously weren't printed on the invoice at all.
  const colGap = 16
  const colWidth = (width - margin * 2 - colGap * 2) / 3
  const cols = [margin, margin + colWidth + colGap, margin + (colWidth + colGap) * 2]
  const colTop = y

  const drawColumn = (x: number, label: string, lines: (string | undefined)[]) => {
    page.drawText(label, { x, y: colTop, size: 7, font: bold, color: goldDeep })
    let cy = colTop - 16
    const filtered = lines.filter(Boolean) as string[]
    for (const line of filtered) {
      const wrapped = wrapText(line, regular, 8.3, colWidth)
      for (const w of wrapped) {
        page.drawText(safePdfText(w), { x, y: cy, size: 8.3, font: line === filtered[0] ? bold : regular, color: ink })
        cy -= 11.5
      }
    }
    return cy
  }

  const bottoms = [
    drawColumn(cols[0], labels.issuer, [input.settings.issuerName, input.settings.issuerTaxId, input.settings.issuerAddress]),
    drawColumn(cols[1], labels.billTo, [
      input.order.customerName,
      input.order.customerTaxId,
      input.order.customerEmail,
      input.order.customerPhone,
      input.order.customerAddress,
    ]),
    drawColumn(cols[2], labels.payment, [
      input.order.paymentMethod ? `${labels.method}: ${input.order.paymentMethod}` : undefined,
      input.order.paymentReference ? `${labels.reference}: ${input.order.paymentReference}` : undefined,
      `${labels.date}: ${input.issuedAt.toLocaleDateString(labels.dateLocale)}`,
    ]),
  ]
  y = Math.min(...bottoms) - 16
  page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.75, color: stone })

  y -= 16
  draw(labels.orderDetails, margin, 7.5, bold, goldDeep)
  drawRight(input.order.orderNumber, width - margin, y, 9, bold)
  y -= 24
  page.drawRectangle({ x: margin, y: y - 8, width: width - margin * 2, height: 24, color: near0 })
  page.drawText(labels.description, { x: margin + 12, y: y - 1, size: 7.2, font: bold, color: onDarkText })
  page.drawText(labels.quantity, { x: 358, y: y - 1, size: 7.2, font: bold, color: onDarkText })
  page.drawText(labels.price, { x: 408, y: y - 1, size: 7.2, font: bold, color: onDarkText })
  drawRight(labels.total, width - margin - 12, y - 1, 7.2, bold, champagne)
  y -= 26

  input.calculation.lines.forEach((line, idx) => {
    ensureSpace(30)
    const descLines = wrapText(line.description, regular, 8.5, 280)
    const rowTop = y
    const rowHeight = Math.max(24, descLines.length * 11 + 10)
    if (idx % 2 === 0) {
      page.drawRectangle({ x: margin, y: rowTop - rowHeight + 12, width: width - margin * 2, height: rowHeight, color: rowTint })
    }
    descLines.forEach((d, i) => {
      page.drawText(safePdfText(d), { x: margin + 12, y: rowTop - i * 11.5, size: 8.5, font: regular, color: ink })
    })
    page.drawText(String(line.quantity), { x: 358, y: rowTop, size: 8.5, font: regular, color: muted })
    drawRight(formatMoney(line.unitPrice, input.order.currency, input.lang), 475, rowTop, 8.5, regular, muted)
    drawRight(formatMoney(line.grossAmount, input.order.currency, input.lang), width - margin - 12, rowTop, 9, bold)
    y -= rowHeight
  })

  ensureSpace(150)
  y -= 18

  const leftWidth = width - margin * 2 - 240
  const noteTop = y
  const siteUrl = process.env.PUBLIC_SITE_URL || 'https://usemewithstyle.com'
  // /conta is the only order-lookup route -- not localized by language (see
  // the same convention in lib/email.ts's trackingUrl), so this must not
  // vary by lang either.
  draw(labels.trackOrder(`${siteUrl}/conta`), margin, 8, regular, muted)
  y -= 16
  if (input.settings.taxNote) drawWrapped(input.settings.taxNote, margin, leftWidth, 7.6, regular, muted)
  y -= 4
  drawWrapped(input.settings.disclaimer, margin, leftWidth, 7.3, bold, muted)
  if (input.settings.footer) {
    y -= 4
    drawWrapped(input.settings.footer, margin, leftWidth, 7.6, regular, muted)
  }

  y = noteTop
  const totalsWidth = 220
  const totalsX = width - margin - totalsWidth
  const totalsTop = y
  page.drawRectangle({ x: totalsX, y: totalsTop - 112, width: totalsWidth, height: 112, color: near0 })
  page.drawRectangle({ x: totalsX, y: totalsTop - 112, width: totalsWidth, height: 3, color: gold })
  page.drawText(labels.summary, { x: totalsX + 18, y: totalsTop - 22, size: 7.2, font: bold, color: champagne })
  page.drawText(labels.net, { x: totalsX + 18, y: totalsTop - 44, size: 8.5, font: regular, color: onDarkMuted })
  drawRight(formatMoney(input.calculation.netTotal, input.order.currency, input.lang), width - margin - 18, totalsTop - 44, 8.5, regular, onDarkText)
  page.drawText(labels.vatIncluded(input.settings.vatRate), { x: totalsX + 18, y: totalsTop - 62, size: 8.5, font: regular, color: onDarkMuted })
  drawRight(formatMoney(input.calculation.taxTotal, input.order.currency, input.lang), width - margin - 18, totalsTop - 62, 8.5, regular, onDarkText)
  page.drawLine({ start: { x: totalsX + 18, y: totalsTop - 74 }, end: { x: width - margin - 18, y: totalsTop - 74 }, thickness: 1, color: gold })
  page.drawText(labels.totalPaid, { x: totalsX + 18, y: totalsTop - 97, size: 9, font: bold, color: onDarkMuted })
  drawRight(formatMoney(input.calculation.total, input.order.currency, input.lang), width - margin - 18, totalsTop - 101, 16, bold, champagne)

  const pages = pdf.getPages()
  pages.forEach((currentPage, index) => {
    currentPage.drawRectangle({ x: 0, y: 0, width, height: footerH, color: near0 })
    let iconWidth = 0
    if (pictorial) {
      const dim = pictorial.scaleToFit(100, 100)
      iconWidth = dim.width
      currentPage.drawImage(pictorial, { x: margin, y: (footerH - dim.height) / 2, width: dim.width, height: dim.height })
    }
    const textX = margin + iconWidth + 18
    const textCenterY = footerH / 2
    currentPage.drawText(labels.footerBrand, { x: textX, y: textCenterY + 7, size: 7.5, font: bold, color: onDarkText })
    currentPage.drawText(labels.footerDocType, { x: textX, y: textCenterY - 7, size: 7.5, font: regular, color: onDarkMuted })
    const pageLabel = labels.page(index + 1, pages.length)
    currentPage.drawText(pageLabel, {
      x: width - margin - bold.widthOfTextAtSize(pageLabel, 7.5),
      y: textCenterY,
      size: 7.5,
      font: bold,
      color: champagne,
    })
  })

  return Buffer.from(await pdf.save())
}

export async function generateInternalInvoiceForOrder(
  payload: Payload,
  order: OrderForInternalInvoice,
): Promise<InvoiceAttachment | null> {
  const existing = await payload.find({
    collection: 'invoices',
    overrideAccess: true,
    limit: 1,
    where: { relatedOrder: { equals: order.id } },
  })
  if (existing.docs.some((invoice) => invoice.status === 'issued')) return null

  const lang: PdfLang = order.lang ?? 'pt'
  const settings = await getSettings(payload, order.market, lang)
  if (!settings.enabled) return null

  const calculation = calculateIncludedVatInvoice(order, settings.vatRate, lang)
  const issuedAt = new Date()
  const year = issuedAt.getUTCFullYear()
  const previous = await payload.find({
    collection: 'invoices',
    overrideAccess: true,
    limit: 1,
    sort: '-sequence',
    where: {
      and: [{ market: { equals: order.market } }, { year: { equals: year } }, { status: { equals: 'issued' } }],
    },
  })
  const sequence = Number(previous.docs[0]?.sequence || 0) + 1
  const invoiceNumber = `${settings.prefix}-${year}-${String(sequence).padStart(5, '0')}`
  const filename = `${invoiceNumber}.pdf`

  const snapshot = {
    relatedOrder: order.id,
    invoiceNumber,
    sequence,
    year,
    market: order.market,
    issuedAt: issuedAt.toISOString(),
    orderNumber: order.orderNumber,
    issuerName: settings.issuerName,
    issuerTaxId: settings.issuerTaxId,
    issuerAddress: settings.issuerAddress,
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerTaxId: order.customerTaxId,
    customerAddress: order.customerAddress,
    lines: calculation.lines,
    currency: order.currency,
    vatRate: settings.vatRate,
    taxNote: settings.taxNote,
    subtotal: roundMoney(order.subtotal),
    shipping: roundMoney(order.shippingCost),
    netTotal: calculation.netTotal,
    taxTotal: calculation.taxTotal,
    total: calculation.total,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    disclaimer: settings.disclaimer,
    footer: settings.footer,
  }

  try {
    const pdfBuffer = await renderInvoicePdf({ invoiceNumber, issuedAt, order, settings, calculation, lang })
    await payload.create({
      collection: 'invoices',
      overrideAccess: true,
      data: {
        ...snapshot,
        status: 'issued',
        pdfFilename: filename,
        pdfData: { base64: pdfBuffer.toString('base64') },
      },
      file: { data: pdfBuffer, mimetype: 'application/pdf', name: filename, size: pdfBuffer.length },
    })
    return { filename, content: pdfBuffer }
  } catch (err) {
    // Preserve enough context for an administrator to diagnose the failure.
    // A later retry can delete this failed row and regenerate the document.
    if (!existing.docs.length) {
      try {
        await payload.create({
          collection: 'invoices',
          overrideAccess: true,
          data: {
            ...snapshot,
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err),
          },
        })
      } catch (recordError) {
        // eslint-disable-next-line no-console
        console.error('[invoice:failed-record-write-failed]', recordError)
      }
    }
    // eslint-disable-next-line no-console
    console.error('[invoice:generation-failed]', err)
    return null
  }
}
