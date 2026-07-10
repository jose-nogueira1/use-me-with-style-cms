import type { CollectionAfterChangeHook } from 'payload'

import { sendWhatsAppMessage } from '../lib/messaging'
import { sendOrderConfirmationEmail } from '../lib/email'
import { generateMoloniInvoiceForOrder, type InvoiceAttachment } from '../lib/moloni'

// WhatsApp/Instagram messaging automation FOUNDATION (Phase 1 scope per
// JOS-58) -- this is deliberately not a marketing automation engine (that's
// Phase 2, JOS-18). It sends exactly two things: an order confirmation on
// create, and a shipped notice on status change to "shipped". If WhatsApp
// credentials aren't configured (true for local dev and until the client's
// WhatsApp Business account is set up), it logs instead of throwing, so
// checkout never fails because messaging isn't wired up yet. Every message
// sent here is also logged to the `messages` collection so it shows up in
// the admin Mensagens conversation view alongside customer-initiated chats.
export const notifyOrderEvent: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const isNewOrder = operation === 'create'
  const justShipped = operation === 'update' && previousDoc?.status !== 'shipped' && doc.status === 'shipped'
  // Order-confirmation EMAIL fires on the paid transition, not on create --
  // unlike the WhatsApp message below. Stripe/PayPal orders are created
  // up-front in `pending` (see endpoints/payments.ts) before the buyer has
  // actually paid, so "on create" would be premature for those. Manual
  // methods (MB WAY, AO bank transfer) only flip to `paid` once staff
  // confirm it in the admin, which is also an `update`, so gating on the
  // paid transition (rather than create) covers every payment method
  // correctly with one check.
  const justPaid =
    (operation === 'create' && doc.paymentStatus === 'paid') ||
    (operation === 'update' && previousDoc?.paymentStatus !== 'paid' && doc.paymentStatus === 'paid')

  if (isNewOrder || justShipped) {
    const message = isNewOrder
      ? `Obrigada pela sua compra! Encomenda ${doc.orderNumber} confirmada -- total ${doc.total} ${doc.currency}.`
      : `A sua encomenda ${doc.orderNumber} foi enviada.`

    await sendWhatsAppMessage(doc.customerPhone, message)

    try {
      await req.payload.create({
        collection: 'messages',
        overrideAccess: true,
        data: {
          channel: 'whatsapp',
          direction: 'outbound',
          contactHandle: doc.customerPhone,
          customerName: doc.customerName,
          body: message,
          status: 'auto_handled',
          automationNote: isNewOrder ? 'order-confirmation' : 'shipped-notice',
          relatedOrder: doc.id,
          sentByAutomation: true,
        },
      })
    } catch (err) {
      // Logging the notification should never break the order write itself.
      // eslint-disable-next-line no-console
      console.error('[messages:log-failed]', err)
    }
  }

  if (justPaid) {
    // PT-market invoicing via Moloni ON (JOS-?? -- see lib/moloni.ts). Runs
    // BEFORE the email send so the invoice PDF can be attached to the same
    // order-confirmation email rather than sent separately. Angola invoicing
    // is SWEG, handled outside this codebase for now, so this only fires for
    // market === 'PT'. Never throws -- a Moloni failure is recorded as a
    // Failed `invoices` row (for admin visibility/retry) and the
    // confirmation email still goes out without an attachment.
    let invoiceAttachment: InvoiceAttachment | undefined
    if (doc.market === 'PT') {
      const attachment = await generateMoloniInvoiceForOrder(req.payload, {
        id: doc.id,
        orderNumber: doc.orderNumber,
        customerName: doc.customerName,
        customerEmail: doc.customerEmail,
        customerTaxId: doc.taxId || undefined,
        currency: doc.currency,
        shippingCost: doc.shippingCost,
        items: doc.items,
      })
      if (attachment) invoiceAttachment = attachment
    }

    await sendOrderConfirmationEmail(req.payload, {
      to: doc.customerEmail,
      orderNumber: doc.orderNumber,
      customerName: doc.customerName,
      total: doc.total,
      currency: doc.currency,
      // doc.lang is the storefront language at checkout (Orders.lang,
      // defaultValue 'pt'); sendOrderConfirmationEmail also defaults to 'pt'
      // itself if this is somehow missing (e.g. an order written before this
      // field existed).
      lang: doc.lang,
      attachment: invoiceAttachment,
    })
  }

  return doc
}
