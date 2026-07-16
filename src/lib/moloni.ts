// Moloni ON invoicing (Portugal market only -- Angola invoicing is SWEG, see
// docs/decisions/phase-1-architecture-and-blockers.md §2). Deliberately
// hand-rolled GraphQL-over-fetch, matching this codebase's existing pattern
// for third-party APIs (see lib/payments/paypal.ts, lib/messaging.ts) rather
// than pulling in a provider SDK.
//
// Auth: a Moloni ON "API Key" (Account -> API -> API Keys in the Moloni ON
// web app), passed as a Bearer token. No OAuth flow -- this is a
// server-to-server integration with no end-user login involved.
//
// One-time setup required in Moloni ON before this can issue a real invoice
// (none of this is automated here -- AT/tax-authority series registration is
// a compliance action, not something to fire from application code):
//   1. A document set (numbering series) for Invoices, with AT registration
//      active -- see "First Time Invoicing" in the Moloni ON API docs.
//   2. A product category and a measurement unit (any will do -- the two
//      generic products below just need somewhere to live).
//   3. The standard VAT tax rate for the company.
//   4. Portugal's countryId and Português's languageId (query `countries`
//      and `languages` once via the Moloni ON GraphQL Explorer).
// The resulting IDs go in the MOLONI_* env vars below.
//
// Simplification: rather than syncing the full Products catalogue into
// Moloni's own product list (a second catalogue to keep in sync), every
// invoice line reuses ONE generic Moloni "product" per order (merchandise,
// plus a second generic one for shipping when charged) and overrides its
// name/price/qty per line. Moloni supports this explicitly -- line items can
// override `summary`, `price`, and `qty` from the catalog defaults -- so the
// invoice still itemizes exactly what was purchased without maintaining a
// second product catalogue.

import type { Payload } from 'payload'

const MOLONI_API_URL = 'https://api.molonion.pt/v1'
const MOLONI_MEDIA_BASE = 'https://mediaapi.moloni.org'

const REQUIRED_ENV_VARS = [
  'MOLONI_API_KEY',
  'MOLONI_COMPANY_ID',
  'MOLONI_DOCUMENT_SET_ID',
  'MOLONI_TAX_ID',
  'MOLONI_PRODUCT_CATEGORY_ID',
  'MOLONI_MEASUREMENT_UNIT_ID',
  'MOLONI_COUNTRY_ID',
  'MOLONI_LANGUAGE_ID',
] as const

export function isMoloniConfigured(): boolean {
  return REQUIRED_ENV_VARS.every((key) => Boolean(process.env[key]))
}

type MoloniFieldError = { field: string; msg: string }
type MoloniOperationResult<T> = { data?: T; errors?: MoloniFieldError[] }

async function moloniRequest<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const apiKey = process.env.MOLONI_API_KEY
  if (!apiKey) throw new Error('Moloni is not configured (MOLONI_API_KEY missing)')

  const res = await fetch(MOLONI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  })

  const json = (await res.json()) as { data?: T; errors?: { message: string }[] }
  if (!res.ok || json.errors?.length) {
    throw new Error(`Moloni request failed (${res.status}): ${JSON.stringify(json.errors ?? json)}`)
  }
  if (!json.data) throw new Error('Moloni request returned no data')
  return json.data
}

// Moloni ON's own per-operation error shape (`{ errors, data }`) is nested
// one level below the GraphQL response -- this unwraps and throws so callers
// can just await the resolved value.
function unwrap<T>(result: MoloniOperationResult<T> | null | undefined, opName: string): T {
  if (!result) throw new Error(`Moloni ${opName}: empty response`)
  if (result.errors?.length) {
    throw new Error(`Moloni ${opName} failed: ${result.errors.map((e) => `${e.field}: ${e.msg}`).join('; ')}`)
  }
  if (result.data === undefined || result.data === null) {
    throw new Error(`Moloni ${opName}: no data returned`)
  }
  return result.data
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function findOrCreateCustomer(
  companyId: number,
  input: { name: string; email: string; taxId?: string },
): Promise<number> {
  const searchResult = await moloniRequest<{ customers: MoloniOperationResult<{ customerId: number }[]> }>(
    `query($companyId: Int!, $email: String!) {
      customers(companyId: $companyId, options: { search: { field: email, value: $email }, pagination: { page: 1, qty: 1 } }) {
        errors { field msg }
        data { customerId }
      }
    }`,
    { companyId, email: input.email },
  )
  const existing = unwrap(searchResult.customers, 'customers search')
  if (existing[0]) return existing[0].customerId

  const nextNumberResult = await moloniRequest<{ customerNextNumber: MoloniOperationResult<string> }>(
    `query($companyId: Int!) {
      customerNextNumber(companyId: $companyId) { data errors { field msg } }
    }`,
    { companyId },
  )
  const number = unwrap(nextNumberResult.customerNextNumber, 'customerNextNumber')

  const createResult = await moloniRequest<{ customerCreate: MoloniOperationResult<{ customerId: number }> }>(
    `mutation($companyId: Int!, $data: CustomerInsert!) {
      customerCreate(companyId: $companyId, data: $data) {
        errors { field msg }
        data { customerId }
      }
    }`,
    {
      companyId,
      data: {
        number,
        name: input.name,
        email: input.email,
        // NIF collected at PT checkout (2026-07-10 addition, optional field)
        // -- Moloni's `vat` is exactly the customer's tax number, per the
        // customerCreate example in their Getting Started guide. Omitted
        // entirely (not sent as "") when the shopper didn't provide one, so
        // Moloni falls back to its own default ("Consumidor Final"-style)
        // handling rather than us guessing a placeholder value.
        ...(input.taxId ? { vat: input.taxId } : {}),
        countryId: Number(process.env.MOLONI_COUNTRY_ID),
        languageId: Number(process.env.MOLONI_LANGUAGE_ID),
      },
    },
  )
  return unwrap(createResult.customerCreate, 'customerCreate').customerId
}

type GenericProductKind = 'merchandise' | 'shipping'

const GENERIC_PRODUCTS: Record<GenericProductKind, { reference: string; name: string; type: 1 | 2; productType: 'M' | 'S' }> = {
  merchandise: { reference: 'UMWS-ITEM', name: 'Artigo Use Me With Style', type: 1, productType: 'M' },
  shipping: { reference: 'UMWS-SHIP', name: 'Portes de Envio', type: 2, productType: 'S' },
}

async function findOrCreateGenericProduct(companyId: number, kind: GenericProductKind): Promise<number> {
  const config = GENERIC_PRODUCTS[kind]

  const searchResult = await moloniRequest<{ products: MoloniOperationResult<{ productId: number; reference: string }[]> }>(
    `query($companyId: Int!, $ref: String!) {
      products(companyId: $companyId, options: { search: { field: ALL, value: $ref }, pagination: { page: 1, qty: 5 } }) {
        errors { field msg }
        data { productId reference }
      }
    }`,
    { companyId, ref: config.reference },
  )
  const existing = unwrap(searchResult.products, 'products search').find((p) => p.reference === config.reference)
  if (existing) return existing.productId

  const createResult = await moloniRequest<{ productCreate: MoloniOperationResult<{ productId: number }> }>(
    `mutation($companyId: Int!, $data: ProductInsert!) {
      productCreate(companyId: $companyId, data: $data) {
        errors { field msg }
        data { productId }
      }
    }`,
    {
      companyId,
      data: {
        productCategoryId: Number(process.env.MOLONI_PRODUCT_CATEGORY_ID),
        type: config.type,
        reference: config.reference,
        name: config.name,
        price: 0,
        measurementUnitId: Number(process.env.MOLONI_MEASUREMENT_UNIT_ID),
        taxes: [{ taxId: Number(process.env.MOLONI_TAX_ID), ordering: 1 }],
        productAT: { productType: config.productType },
      },
    },
  )
  return unwrap(createResult.productCreate, 'productCreate').productId
}

async function downloadInvoicePdf(companyId: number, documentId: number): Promise<{ buffer: Buffer; filename: string }> {
  await moloniRequest<boolean>(
    `mutation($companyId: Int!, $documentId: Int!) {
      invoiceGetPDF(companyId: $companyId, documentId: $documentId)
    }`,
    { companyId, documentId },
  )

  // PDF generation happens async server-side and the download token has a
  // ~10s TTL, so poll a few times with a short delay rather than assuming
  // it's ready immediately after the mutation above returns.
  let lastError: unknown
  for (let attempt = 0; attempt < 5; attempt++) {
    await sleep(1500)
    try {
      const tokenResult = await moloniRequest<{
        invoiceGetPDFToken: MoloniOperationResult<{ token: string; path: string; filename: string }>
      }>(
        `query($documentId: Int!) {
          invoiceGetPDFToken(documentId: $documentId) {
            data { token path filename }
            errors { field msg }
          }
        }`,
        { documentId },
      )
      const { token, path, filename } = unwrap(tokenResult.invoiceGetPDFToken, 'invoiceGetPDFToken')
      const res = await fetch(`${MOLONI_MEDIA_BASE}${path}?jwt=${token}`)
      if (!res.ok) throw new Error(`Moloni PDF download failed (${res.status})`)
      const arrayBuffer = await res.arrayBuffer()
      return { buffer: Buffer.from(arrayBuffer), filename }
    } catch (err) {
      lastError = err
    }
  }
  throw new Error(`Moloni PDF was not ready in time: ${lastError instanceof Error ? lastError.message : lastError}`)
}

type MoloniInvoiceLineInput = { name: string; qty: number; unitPrice: number }

type MoloniInvoiceResult = {
  documentId: number
  number: string
  totalValue: number
  pdfBuffer: Buffer
  pdfFilename: string
}

async function createMoloniInvoice(input: {
  customerName: string
  customerEmail: string
  customerTaxId?: string
  items: MoloniInvoiceLineInput[]
  shippingCost: number
}): Promise<MoloniInvoiceResult> {
  const companyId = Number(process.env.MOLONI_COMPANY_ID)
  const documentSetId = Number(process.env.MOLONI_DOCUMENT_SET_ID)

  const customerId = await findOrCreateCustomer(companyId, {
    name: input.customerName,
    email: input.customerEmail,
    taxId: input.customerTaxId,
  })
  const merchandiseProductId = await findOrCreateGenericProduct(companyId, 'merchandise')

  const products = input.items.map((item, index) => ({
    productId: merchandiseProductId,
    qty: item.qty,
    ordering: index + 1,
    price: item.unitPrice,
    summary: item.name,
  }))

  if (input.shippingCost > 0) {
    const shippingProductId = await findOrCreateGenericProduct(companyId, 'shipping')
    products.push({
      productId: shippingProductId,
      qty: 1,
      ordering: products.length + 1,
      price: input.shippingCost,
      summary: 'Portes de envio',
    })
  }

  const now = new Date()

  const invoiceResult = await moloniRequest<{
    invoiceCreate: MoloniOperationResult<{ documentId: number; number: number; totalValue: number }>
  }>(
    `mutation($companyId: Int!, $data: InvoiceInsert!) {
      invoiceCreate(companyId: $companyId, data: $data) {
        errors { field msg }
        data { documentId number totalValue status }
      }
    }`,
    {
      companyId,
      data: {
        documentSetId,
        customerId,
        date: now.toISOString(),
        // Already paid at this point (this only runs on the justPaid
        // transition -- see hooks/notifyOrderEvent.ts), so the due date is
        // today, not a real payment term.
        expirationDate: now.toISOString().slice(0, 10),
        status: 1, // finalize immediately, per the "auto-finalize" decision
        products,
      },
    },
  )
  const invoice = unwrap(invoiceResult.invoiceCreate, 'invoiceCreate')

  const { buffer, filename } = await downloadInvoicePdf(companyId, invoice.documentId)

  return {
    documentId: invoice.documentId,
    number: String(invoice.number),
    totalValue: invoice.totalValue,
    pdfBuffer: buffer,
    pdfFilename: filename,
  }
}

export type OrderForInvoicing = {
  id: number
  orderNumber: string
  customerName: string
  customerEmail: string
  /** Optional NIF collected at PT checkout (2026-07-10) -- passed to Moloni
   * as the customer's `vat` so it appears on the issued invoice. */
  customerTaxId?: string
  currency: string
  shippingCost: number
  items: { productName: string; size: string; color?: string | null; qty: number; unitPrice: number }[]
}

export type InvoiceAttachment = { filename: string; content: Buffer }

// Orchestrates the whole PT-market invoicing flow for one order: issue the
// invoice in Moloni ON, download its PDF, save an `invoices` record (visible
// in the admin dashboard) with the PDF attached to that record, and return
// the PDF so the caller can attach the SAME file to the order-confirmation
// email. Mirrors the log-instead-of-throw pattern used by
// sendOrderConfirmationEmail/sendWhatsAppMessage elsewhere in this codebase
// -- an invoicing failure must never break the order write itself; it's
// recorded as a Failed `invoices` row instead so it's visible in admin and
// can be retried/issued manually.
export async function generateMoloniInvoiceForOrder(
  payload: Payload,
  order: OrderForInvoicing,
): Promise<InvoiceAttachment | null> {
  if (!isMoloniConfigured()) {
    // eslint-disable-next-line no-console
    console.log(`[moloni:not-configured] would issue invoice for order ${order.orderNumber}`)
    return null
  }

  try {
    const result = await createMoloniInvoice({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerTaxId: order.customerTaxId,
      shippingCost: order.shippingCost,
      items: order.items.map((item) => ({
        name: `${item.productName} (${item.size}${item.color ? `, ${item.color}` : ''})`,
        qty: item.qty,
        unitPrice: item.unitPrice,
      })),
    })

    await payload.create({
      collection: 'invoices',
      overrideAccess: true,
      data: {
        relatedOrder: order.id,
        status: 'issued',
        moloniDocumentId: result.documentId,
        moloniNumber: result.number,
        total: result.totalValue,
        currency: order.currency,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
      },
      file: {
        data: result.pdfBuffer,
        mimetype: 'application/pdf',
        name: result.pdfFilename,
        size: result.pdfBuffer.length,
      },
    })

    return { filename: result.pdfFilename, content: result.pdfBuffer }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[moloni:invoice-failed]', err)
    try {
      await payload.create({
        collection: 'invoices',
        overrideAccess: true,
        data: {
          relatedOrder: order.id,
          status: 'failed',
          currency: order.currency,
          customerName: order.customerName,
          customerEmail: order.customerEmail,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      })
    } catch (logErr) {
      // eslint-disable-next-line no-console
      console.error('[moloni:failed-record-write-failed]', logErr)
    }
    return null
  }
}
