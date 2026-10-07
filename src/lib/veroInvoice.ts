import type { Payload, PayloadRequest } from 'payload'

import type { InvoiceAttachment } from './email'
import { customerPaymentMethodLabel, invoiceLineDescription, type OrderForInternalInvoice } from './internalInvoice'

const VERO_BASE = 'https://api.vero.ao'
// Prime Essencial is in Regime Simplificado ("Exclusão"): every line is 0%
// and Vero requires an exemption code. `taxRate` is deliberately omitted so
// the org's regime in the Vero dashboard stays the single source of truth.
// Confirm the code with the accountant.
const EXEMPTION_CODE = 'M04'

type VeroLine = { description: string; quantity: number; unitPrice: number; taxExemptionCode: string }
type VeroInvoice = {
  id: string
  number: string
  total: number
  atcud: string | null
  agtStatus: 'pending' | 'validated' | 'rejected' | null
  status: string
  pdfUrl: string
}

const cents = (value: number): number => Math.round((value + Number.EPSILON) * 100)
const kz = (value: number): string => `${new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)} Kz`

// Vero has no discount field (its API spec accepts only description, quantity,
// price and tax per line), so the price history is written into the line's
// description, in parentheses. No line breaks: it is unclear whether the AGT
// accepts them in a fiscal document's description. The coupon's code is on its
// own invoice line, not repeated here. Prices on the lines are the amounts
// actually charged.
function itemDetails(item: OrderForInternalInvoice['items'][number], couponCents: number): string {
  const onSale = Boolean(item.regularUnitPrice && item.regularUnitPrice > item.unitPrice)
  const details: string[] = []
  if (onSale || couponCents > 0) details.push(`Original ${kz(onSale ? item.regularUnitPrice! : item.unitPrice)}`)
  if (onSale) {
    const pct = item.saleDiscountPercentage || Math.round((1 - item.unitPrice / item.regularUnitPrice!) * 100)
    details.push(`Promoção -${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(pct)}%`)
  }
  if (couponCents > 0) details.push(`Cupão -${kz(couponCents / 100)}`)
  return details.join(' | ')
}

// The coupon is not repeated here: it has its own line on the invoice.
export function veroNotes(order: OrderForInternalInvoice): string {
  // multicaixa_express orders are the AppyPay ones; paymentReference holds the
  // AppyPay transaction id once the charge is verified.
  const method = order.paymentMethod === 'multicaixa_express'
    ? 'Multicaixa Express (AppyPay)'
    : customerPaymentMethodLabel(order.paymentMethod, 'pt')
  const payment = method
    ? ` | Pagamento: ${method}${order.paymentReference ? `, ref. ${order.paymentReference}` : ''}`
    : ''
  return `Encomenda ${order.orderNumber}${payment}`
}

// Vero rejects negative lines, so the coupon (and any rounding drift versus the
// paid total) is folded into the merchandise prices. Under 0% VAT this has no
// tax effect. Every line is integer cêntimos x integer quantity, and the lines
// always sum to exactly the paid total.
export function buildVeroLines(order: OrderForInternalInvoice): VeroLine[] {
  const gross = order.items.map((item) => cents(item.qty * item.unitPrice))
  const grossSum = gross.reduce((a, b) => a + b, 0)
  const shipping = cents(order.shippingCost)
  const reduction = grossSum - (cents(order.total) - shipping)
  if (!order.items.length || grossSum <= 0) throw new Error('Order has no payable merchandise')

  const share = gross.map((g) => Math.round((reduction * g) / grossSum))
  share[share.length - 1] += reduction - share.reduce((a, b) => a + b, 0)

  const lines: VeroLine[] = []
  order.items.forEach((item, i) => {
    const total = gross[i] - share[i]
    if (total < 0 || !Number.isInteger(item.qty) || item.qty < 1) throw new Error(`Invalid line for ${item.productName}`)
    const details = itemDetails(item, share[i])
    const name = invoiceLineDescription(item, 'pt')
    const description = details ? `${name} (${details})` : name
    const unit = Math.floor(total / item.qty)
    const rem = total - unit * item.qty
    // Quantity x unit price can't always hit `total` exactly, so the odd
    // cêntimos go on `rem` units priced one cêntimo higher.
    lines.push({ description, quantity: item.qty - rem, unitPrice: unit, taxExemptionCode: EXEMPTION_CODE })
    if (rem > 0) {
      lines.push({ description: `${name} (ajuste de arredondamento)`, quantity: rem, unitPrice: unit + 1, taxExemptionCode: EXEMPTION_CODE })
    }
  })
  // Vero rejects negative lines, so the coupon is shown as an explanatory
  // zero-price line right under the goods (it is already inside their prices).
  if (order.discountAmount && order.discountAmount > 0) {
    lines.push({
      description: `Desconto${order.discountLabel ? ` ${order.discountLabel}` : ' cupão'}: -${kz(order.discountAmount)} (já incluído nos preços acima)`,
      quantity: 1,
      unitPrice: 0,
      taxExemptionCode: EXEMPTION_CODE,
    })
  }
  // Angola has no pickup option, so delivery is always part of the order; free
  // delivery (threshold or coupon) is still shown, as a zero-price line.
  lines.push({
    description: shipping > 0
      ? 'Portes de envio'
      : `Portes de envio (grátis${!order.discountAmount && order.discountLabel ? `, cupão ${order.discountLabel}` : ''})`,
    quantity: 1,
    unitPrice: shipping,
    taxExemptionCode: EXEMPTION_CODE,
  })
  return lines
}

export const veroLinesTotal = (lines: VeroLine[]): number => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0)

// A buyer with a NIF is keyed by it. A buyer without one is still printed on the
// invoice (name, address, contacts) but flagged Consumidor Final, which makes
// Vero use the generic NIF 999999999. Keyed per order so a later order can never
// rewrite the customer details of an already-issued fiscal document.
export function customerPayload(order: OrderForInternalInvoice) {
  const nif = order.customerTaxId?.trim()
  return {
    externalId: nif ? `nif_${nif}` : `order_${order.orderNumber}`,
    name: order.customerName,
    taxId: nif || undefined,
    isConsumidorFinal: nif ? undefined : true,
    email: order.customerEmail,
    phone: order.customerPhone,
    addressLine1: order.customerAddress,
  }
}

export async function veroRequest<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  if (!process.env.VERO_API_KEY || !process.env.VERO_ORG_ID) throw new Error('VERO_API_KEY / VERO_ORG_ID are not configured')
  const res = await fetch(`${VERO_BASE}/v1/organisations/${process.env.VERO_ORG_ID}${path}`, {
    method,
    headers: { Authorization: `Bearer ${process.env.VERO_API_KEY}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) throw new Error(`Vero ${method} ${path} -> ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return (await res.json()) as T
}

// Sandbox returns a base64 data: URI; live returns a path on the API that
// needs the same Authorization header. Only api.vero.ao ever receives the key.
export async function fetchVeroPdf(pdfUrl: string): Promise<Buffer> {
  if (pdfUrl.startsWith('data:')) return Buffer.from(pdfUrl.slice(pdfUrl.indexOf(',') + 1), 'base64')
  const url = new URL(pdfUrl, VERO_BASE)
  if (url.protocol !== 'https:' || !url.hostname.endsWith('vero.ao')) throw new Error('Unexpected Vero PDF host')
  const headers = url.origin === VERO_BASE ? { Authorization: `Bearer ${process.env.VERO_API_KEY}` } : undefined
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`Vero PDF -> ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// Issues the fiscal Factura-Recibo for a paid Angola order and stores it in the
// `invoices` collection. Returns the PDF for the confirmation email, or null if
// an invoice already exists or Vero failed (a `failed` row is recorded and
// /vero/sync retries it).
export async function issueVeroInvoiceForOrder(
  payload: Payload,
  order: OrderForInternalInvoice,
  req?: Partial<PayloadRequest>,
): Promise<InvoiceAttachment | null> {
  const existing = await payload.find({
    collection: 'invoices',
    overrideAccess: true,
    limit: 1,
    where: { relatedOrder: { equals: order.id } },
    req,
  })
  if (existing.docs.some((invoice) => invoice.status === 'issued')) return null

  const issuedAt = new Date()
  const year = issuedAt.getUTCFullYear()
  const previous = await payload.find({
    collection: 'invoices',
    overrideAccess: true,
    limit: 1,
    sort: '-sequence',
    where: { and: [{ market: { equals: order.market } }, { year: { equals: year } }, { status: { equals: 'issued' } }] },
    req,
  })
  const sequence = Number(previous.docs[0]?.sequence || 0) + 1

  const total = cents(order.total) / 100
  const snapshot = {
    relatedOrder: order.id,
    sequence,
    year,
    market: order.market,
    provider: 'vero' as const,
    issuedAt: issuedAt.toISOString(),
    orderNumber: order.orderNumber,
    // Informational snapshot only: the fiscal issuer is the Vero organisation.
    issuerName: 'Prime Essencial - Comércio & Prestação de Serviços LDA',
    customerName: order.customerName,
    customerEmail: order.customerEmail,
    customerPhone: order.customerPhone,
    customerTaxId: order.customerTaxId,
    customerAddress: order.customerAddress,
    currency: order.currency,
    vatRate: 0,
    vatRegion: 'flat' as const,
    taxNote: `Isento - ${EXEMPTION_CODE}`,
    subtotal: cents(order.subtotal) / 100,
    shipping: cents(order.shippingCost) / 100,
    netTotal: total,
    taxTotal: 0,
    total,
    paymentMethod: order.paymentMethod,
    paymentReference: order.paymentReference,
    disclaimer: 'Documento fiscal emitido via Vero, certificado pela AGT.',
  }

  try {
    const lines = buildVeroLines(order)
    const expected = cents(order.total)
    if (veroLinesTotal(lines) !== expected) throw new Error('Invoice lines do not add up to the paid total')

    const customer = await veroRequest<{ id: string }>('POST', '/customers/ensure', customerPayload(order))
    const invoice = await veroRequest<VeroInvoice>('POST', '/invoices', {
      customerId: customer.id,
      documentType: 'FR',
      items: lines,
      idempotencyKey: `order_${order.orderNumber}`,
      notes: veroNotes(order),
    })
    if (invoice.total !== expected) throw new Error(`Vero total ${invoice.total} differs from paid total ${expected}`)

    const pdf = await fetchVeroPdf(invoice.pdfUrl)
    const filename = `${invoice.number.replace(/[^A-Za-z0-9-]/g, '-')}.pdf`
    // A failed attempt left by an earlier run would trip the unique relatedOrder.
    if (existing.docs.length) {
      await payload.delete({ collection: 'invoices', id: existing.docs[0].id, overrideAccess: true, req })
    }
    await payload.create({
      collection: 'invoices',
      overrideAccess: true,
      data: {
        ...snapshot,
        invoiceNumber: invoice.number,
        status: 'issued',
        veroId: invoice.id,
        veroStatus: invoice.status,
        atcud: invoice.atcud,
        agtStatus: invoice.agtStatus,
        lines: lines.map((l) => ({
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice / 100,
          netAmount: (l.quantity * l.unitPrice) / 100,
          taxAmount: 0,
          grossAmount: (l.quantity * l.unitPrice) / 100,
        })),
        pdfFilename: filename,
        pdfData: { base64: pdf.toString('base64') },
      },
      file: { data: pdf, mimetype: 'application/pdf', name: filename, size: pdf.length },
      req,
    })
    return { filename, content: pdf, number: invoice.number }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[invoice:vero-failed]', err)
    if (!existing.docs.length) {
      try {
        await payload.create({
          collection: 'invoices',
          overrideAccess: true,
          data: {
            ...snapshot,
            invoiceNumber: `VERO-PENDING-${order.orderNumber}`,
            status: 'failed',
            errorMessage: err instanceof Error ? err.message : String(err),
            lines: [{ description: order.orderNumber, quantity: 1, unitPrice: total, netAmount: total, taxAmount: 0, grossAmount: total }],
          },
          req,
        })
      } catch (recordError) {
        // eslint-disable-next-line no-console
        console.error('[invoice:failed-record-write-failed]', recordError)
      }
    }
    return null
  }
}
