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

const DEFAULT_DISCLAIMER =
  'Documento comercial interno, não certificado fiscalmente. Deve ser validado e tratado pelo contabilista da entidade emitente.'

const roundMoney = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

export function calculateIncludedVatInvoice(
  order: Pick<OrderForInternalInvoice, 'items' | 'shippingCost' | 'total'>,
  vatRate: number,
): InvoiceCalculation {
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
      description: 'Portes de envio',
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
      description: 'Ajuste da encomenda',
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

async function getSettings(payload: Payload, market: Market): Promise<Settings> {
  const global = (await payload.findGlobal({ slug: 'invoice-settings', overrideAccess: true })) as unknown as Record<
    string,
    unknown
  >
  const suffix = market
  const readString = (name: string): string | undefined => {
    const value = global[`${name}${suffix}`]
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  }

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
      typeof global.phaseOneDisclaimer === 'string' && global.phaseOneDisclaimer.trim()
        ? global.phaseOneDisclaimer.trim()
        : DEFAULT_DISCLAIMER,
  }
}

function formatMoney(value: number, currency: string): string {
  return `${new Intl.NumberFormat('pt-PT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} ${currency}`
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

async function renderInvoicePdf(input: {
  invoiceNumber: string
  issuedAt: Date
  order: OrderForInternalInvoice
  settings: Settings
  calculation: InvoiceCalculation
}): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const serif = await pdf.embedFont(StandardFonts.TimesRoman)
  const width = 595.28
  const height = 841.89
  const margin = 42
  const ink = rgb(0.02, 0.02, 0.02)
  const muted = rgb(0.35, 0.33, 0.3)
  const paper = rgb(1, 0.99, 0.973)
  const stone = rgb(0.91, 0.87, 0.81)
  const gold = rgb(0.79, 0.63, 0.22)
  let page: PDFPage = pdf.addPage([width, height])
  let y = height - 172

  let logo: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
  let pictorial: Awaited<ReturnType<typeof pdf.embedPng>> | undefined
  try {
    const [logoBytes, pictorialBytes] = await Promise.all([
      readFile(new URL('../assets/use-me-logo-black-transparent.png', import.meta.url)),
      readFile(new URL('../assets/use-me-pictorial-gold.png', import.meta.url)),
    ])
    logo = await pdf.embedPng(logoBytes)
    pictorial = await pdf.embedPng(pictorialBytes)
  } catch (error) {
    // Keep invoice generation operational if deployment packaging ever omits
    // the brand assets; the issuer name below remains as a safe fallback.
    // eslint-disable-next-line no-console
    console.error('[invoice:brand-assets-unavailable]', error)
  }

  const drawHeader = (continuation = false) => {
    page.drawRectangle({ x: 0, y: 0, width, height, color: paper })
    if (logo) {
      const dimensions = logo.scaleToFit(158, 76)
      page.drawImage(logo, {
        x: margin,
        y: height - margin - dimensions.height,
        width: dimensions.width,
        height: dimensions.height,
      })
    } else {
      page.drawText('Use Me with Style', { x: margin, y: height - 72, size: 21, font: serif, color: ink })
    }

    page.drawText(continuation ? 'CONTINUAÇÃO' : 'FATURA COMERCIAL', {
      x: width - margin - 170,
      y: height - 60,
      size: 8,
      font: bold,
      color: muted,
    })
    page.drawText(input.invoiceNumber, {
      x: width - margin - 170,
      y: height - 82,
      size: 14,
      font: serif,
      color: ink,
    })
    page.drawText(input.issuedAt.toLocaleDateString('pt-PT'), {
      x: width - margin - 170,
      y: height - 103,
      size: 9,
      font: regular,
      color: muted,
    })
    page.drawRectangle({ x: margin, y: height - 139, width: width - margin * 2, height: 2.5, color: gold })
  }

  const newPage = () => {
    page = pdf.addPage([width, height])
    drawHeader(true)
    y = height - 172
  }
  const ensureSpace = (needed: number) => {
    if (y < 112 + needed) newPage()
  }
  const draw = (text: string, x: number, size = 9, font: PDFFont = regular, color = ink) => {
    page.drawText(safePdfText(text), { x, y, size, font, color })
  }
  const drawRight = (text: string, right: number, baseline: number, size = 9, font: PDFFont = regular, color = ink) => {
    const safe = safePdfText(text)
    page.drawText(safe, { x: right - font.widthOfTextAtSize(safe, size), y: baseline, size, font, color })
  }
  const drawWrapped = (text: string, x: number, maxWidth: number, size = 9, font: PDFFont = regular) => {
    for (const line of wrapText(text, font, size, maxWidth)) {
      ensureSpace(size + 4)
      draw(line, x, size, font)
      y -= size + 4
    }
  }

  drawHeader()
  const cardTop = y
  const cardHeight = 105
  const gap = 12
  const cardWidth = (width - margin * 2 - gap) / 2
  page.drawRectangle({ x: margin, y: cardTop - cardHeight, width: cardWidth, height: cardHeight, color: rgb(0.975, 0.956, 0.92) })
  page.drawRectangle({ x: margin + cardWidth + gap, y: cardTop - cardHeight, width: cardWidth, height: cardHeight, color: rgb(0.975, 0.956, 0.92) })

  y = cardTop - 22
  draw('EMITENTE', margin + 14, 7.5, bold, gold)
  const issuerStartY = y - 18
  y = issuerStartY
  const issuerLines = [input.settings.issuerName, input.settings.issuerTaxId, input.settings.issuerAddress].filter(Boolean) as string[]
  const customerLines = [
    input.order.customerName,
    input.order.customerTaxId,
    input.order.customerEmail,
    input.order.customerPhone,
    input.order.customerAddress,
  ].filter(Boolean) as string[]
  for (const line of issuerLines) {
    drawWrapped(line, margin + 14, cardWidth - 28, 8.5, line === input.settings.issuerName ? bold : regular)
  }
  y = cardTop - 22
  draw('FATURAR A', margin + cardWidth + gap + 14, 7.5, bold, gold)
  y = issuerStartY
  for (const line of customerLines) {
    drawWrapped(line, margin + cardWidth + gap + 14, cardWidth - 28, 8.5, line === input.order.customerName ? bold : regular)
  }

  y = cardTop - cardHeight - 28
  draw('DETALHES DA ENCOMENDA', margin, 7.5, bold, gold)
  drawRight(input.order.orderNumber, width - margin, y, 9, bold)
  y -= 32
  page.drawRectangle({ x: margin, y: y - 7, width: width - margin * 2, height: 27, color: ink })
  page.drawText('DESCRIÇÃO', { x: margin + 12, y: y + 2, size: 7.5, font: bold, color: paper })
  page.drawText('QTD.', { x: 352, y: y + 2, size: 7.5, font: bold, color: paper })
  page.drawText('PREÇO', { x: 400, y: y + 2, size: 7.5, font: bold, color: paper })
  drawRight('TOTAL', width - margin - 12, y + 2, 7.5, bold, paper)
  y -= 29

  for (const line of input.calculation.lines) {
    ensureSpace(38)
    const descriptionLines = wrapText(line.description, regular, 8.5, 270)
    const rowY = y
    descriptionLines.forEach((description, index) => {
      page.drawText(safePdfText(description), { x: margin + 12, y: rowY - index * 11, size: 8.5, font: regular, color: ink })
    })
    page.drawText(String(line.quantity), { x: 358, y: rowY, size: 8.5, font: regular, color: ink })
    drawRight(formatMoney(line.unitPrice, input.order.currency), 467, rowY, 8.5)
    drawRight(formatMoney(line.grossAmount, input.order.currency), width - margin - 12, rowY, 8.5, bold)
    const rowHeight = Math.max(25, descriptionLines.length * 11 + 10)
    page.drawLine({ start: { x: margin, y: rowY - rowHeight + 8 }, end: { x: width - margin, y: rowY - rowHeight + 8 }, thickness: 0.5, color: stone })
    y -= rowHeight
  }

  ensureSpace(165)
  y -= 8
  const totalsWidth = 220
  const totalsX = width - margin - totalsWidth
  page.drawRectangle({ x: totalsX, y: y - 93, width: totalsWidth, height: 100, color: rgb(0.975, 0.956, 0.92) })
  page.drawText('RESUMO', { x: totalsX + 15, y: y - 15, size: 7.5, font: bold, color: gold })
  page.drawText('Líquido', { x: totalsX + 15, y: y - 37, size: 8.5, font: regular, color: muted })
  drawRight(formatMoney(input.calculation.netTotal, input.order.currency), width - margin - 15, y - 37, 8.5, bold)
  page.drawText(`IVA incluído (${input.settings.vatRate}%)`, { x: totalsX + 15, y: y - 55, size: 8.5, font: regular, color: muted })
  drawRight(formatMoney(input.calculation.taxTotal, input.order.currency), width - margin - 15, y - 55, 8.5, bold)
  page.drawLine({ start: { x: totalsX + 15, y: y - 67 }, end: { x: width - margin - 15, y: y - 67 }, thickness: 1, color: gold })
  page.drawText('TOTAL PAGO', { x: totalsX + 15, y: y - 84, size: 9.5, font: bold, color: ink })
  drawRight(formatMoney(input.calculation.total, input.order.currency), width - margin - 15, y - 84, 11, bold)

  const noteY = y - 116
  y = noteY
  if (input.settings.taxNote) drawWrapped(input.settings.taxNote, margin, width - margin * 2, 7.5)
  y -= 3
  drawWrapped(input.settings.disclaimer, margin, width - margin * 2, 7.2, bold)
  if (input.settings.footer) {
    y -= 3
    drawWrapped(input.settings.footer, margin, width - margin * 2, 7.5)
  }

  const pages = pdf.getPages()
  pages.forEach((currentPage, index) => {
    currentPage.drawLine({ start: { x: margin, y: 58 }, end: { x: width - margin, y: 58 }, thickness: 0.7, color: stone })
    if (pictorial) {
      const dimensions = pictorial.scaleToFit(25, 18)
      currentPage.drawImage(pictorial, { x: margin, y: 25, width: dimensions.width, height: dimensions.height })
    }
    currentPage.drawText('USE ME WITH STYLE', { x: margin + 34, y: 30, size: 6.5, font: bold, color: muted })
    currentPage.drawText('Documento comercial interno', { x: margin + 34, y: 20, size: 6.5, font: regular, color: muted })
    const pageLabel = `PÁGINA ${index + 1} / ${pages.length}`
    currentPage.drawText(pageLabel, {
      x: width - margin - bold.widthOfTextAtSize(pageLabel, 6.5),
      y: 25,
      size: 6.5,
      font: bold,
      color: muted,
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

  const settings = await getSettings(payload, order.market)
  if (!settings.enabled) return null

  const calculation = calculateIncludedVatInvoice(order, settings.vatRate)
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
    const pdfBuffer = await renderInvoicePdf({ invoiceNumber, issuedAt, order, settings, calculation })
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
