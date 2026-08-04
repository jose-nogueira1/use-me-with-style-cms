import type { CollectionAfterChangeHook } from 'payload'

import { sendWhatsAppMessage, buildCttTrackingUrl } from '../lib/messaging'
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../lib/email'
import { generateInternalInvoiceForOrder } from '../lib/internalInvoice'
import type { InvoiceAttachment } from '../lib/email'
import { sendMetaPurchase } from '../endpoints/metaConversions'

// WhatsApp/Instagram messaging automation FOUNDATION (Phase 1 scope per
// JOS-58) -- this is deliberately not a marketing automation engine (that's
// Phase 2, JOS-18). If WhatsApp/email credentials aren't configured (true
// for local dev and until the client's WhatsApp Business / Resend accounts
// are set up), sends log instead of throwing, so an order write never fails
// because messaging isn't wired up yet. Every WhatsApp message sent here is
// also logged to the `messages` collection so it shows up in the admin
// Mensagens conversation view alongside customer-initiated chats (email
// isn't a Messages channel -- see Messages.ts's `channel` options).
//
// 2026-08-01: previously the admin's "WhatsApp update" button on the Orders
// page was the ONLY way a customer heard about a shipped/delivered order
// getting there (and it had to be clicked manually, per order, every time).
// Per the client's request, every step of the NEXT_STEP pipeline an admin
// actually clicks through in OrderDetail.tsx (confirm payment -> mark as
// shipped -> mark as delivered) now sends BOTH an email and a WhatsApp
// message automatically, and the manual button itself is gone from the
// admin (Orders.tsx) -- there's nothing left for it to cover that this
// hook doesn't already handle, including the CTT tracking-code notice
// below.
export const notifyOrderEvent: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const isNewOrder = operation === 'create'
  const justShipped = operation === 'update' && previousDoc?.status !== 'shipped' && doc.status === 'shipped'
  const justDelivered = operation === 'update' && previousDoc?.status !== 'delivered' && doc.status === 'delivered'
  // Order-confirmation EMAIL (and, below, the "payment confirmed" WhatsApp)
  // fire on the paid transition, not on create -- unlike the initial
  // WhatsApp message below. Stripe/PayPal orders are created up-front in
  // `pending` (see endpoints/payments.ts) before the buyer has actually
  // paid, so "on create" would be premature for those. Manual methods (MB
  // WAY, AO bank transfer) only flip to `paid` once staff confirm it in the
  // admin, which is also an `update`, so gating on the paid transition
  // (rather than create) covers every payment method correctly with one
  // check.
  const justPaid = doc.status !== 'cancelled' && (
    (operation === 'create' && doc.paymentStatus === 'paid') ||
    (operation === 'update' && previousDoc?.paymentStatus !== 'paid' && doc.paymentStatus === 'paid')
  )
  // CTT tracking code added (2026-08-01, alongside the shipped/delivered
  // emails below) -- an admin often only gets the tracking code from the
  // courier AFTER clicking "mark as shipped" (or fills it in separately,
  // out of order), so the shipped notice above can't always include it.
  // This closes that gap on its own: whenever cttTrackingCode goes from
  // empty to set, on ANY update, send a dedicated notice -- independent of
  // whatever else changed in the same request. Guarded to skip a request
  // that's ALSO justShipped, so a code entered at the exact same moment as
  // the shipped transition doesn't fire two separate WhatsApp messages
  // (the shipped notice below already includes the link in that case).
  const justAddedTracking =
    operation === 'update' && !previousDoc?.cttTrackingCode && !!doc.cttTrackingCode && !justShipped
  const trackingUrl = doc.cttTrackingCode ? buildCttTrackingUrl(doc.cttTrackingCode, doc.lang === 'en' ? 'en' : 'pt') : undefined

  if (isNewOrder || justShipped || justDelivered) {
    const trackingLine = justShipped && trackingUrl ? ` Rastreio: ${trackingUrl}` : ''
    const message = isNewOrder
      ? `Obrigada pela sua compra! Encomenda ${doc.orderNumber} confirmada -- total ${doc.total} ${doc.currency}.`
      : justShipped
        ? `A sua encomenda ${doc.orderNumber} foi enviada.${trackingLine}`
        : `A sua encomenda ${doc.orderNumber} foi entregue. Esperamos que goste!`

    await sendWhatsAppMessage(doc.customerPhone, message)

    try {
      // `req` joins this create to the same transaction the order write is
      // already running in -- omitting it throws `SQLITE_BUSY: database is
      // locked` on every single order (confirmed live 2026-07-27; this was
      // silently swallowed by the catch below, so the messages log has been
      // failing to record any auto-sent order notification).
      await req.payload.create({
        collection: 'messages',
        overrideAccess: true,
        req,
        data: {
          channel: 'whatsapp',
          direction: 'outbound',
          contactHandle: doc.customerPhone,
          customerName: doc.customerName,
          body: message,
          status: 'auto_handled',
          automationNote: isNewOrder ? 'order-confirmation' : justShipped ? 'shipped-notice' : 'delivered-notice',
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

  // Shipped/delivered EMAIL, mirroring the WhatsApp notices above --
  // separate from the block above because the confirmation email
  // (order-confirmation, below) already has its own attachment/Meta-pixel
  // side effects that don't apply here, and duplicating that machinery for
  // a plain status notice isn't worth it.
  if (justShipped) {
    await sendOrderStatusEmail(req.payload, {
      to: doc.customerEmail,
      orderNumber: doc.orderNumber,
      customerName: doc.customerName,
      lang: doc.lang,
      stage: 'shipped',
      courierTrackingCode: doc.cttTrackingCode || undefined,
      courierTrackingUrl: trackingUrl,
    })
  }
  if (justDelivered) {
    await sendOrderStatusEmail(req.payload, {
      to: doc.customerEmail,
      orderNumber: doc.orderNumber,
      customerName: doc.customerName,
      lang: doc.lang,
      stage: 'delivered',
    })
  }

  // Dedicated tracking-code notice -- see justAddedTracking's own comment
  // above for why this needs to be independent of the shipped notice.
  if (justAddedTracking && trackingUrl) {
    const body = `Código de rastreio da encomenda ${doc.orderNumber}: ${doc.cttTrackingCode}. Acompanhe aqui: ${trackingUrl}`
    await sendWhatsAppMessage(doc.customerPhone, body)
    try {
      await req.payload.create({
        collection: 'messages',
        overrideAccess: true,
        req,
        data: {
          channel: 'whatsapp',
          direction: 'outbound',
          contactHandle: doc.customerPhone,
          customerName: doc.customerName,
          body,
          status: 'auto_handled',
          automationNote: 'tracking-code-notice',
          relatedOrder: doc.id,
          sentByAutomation: true,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[messages:log-failed]', err)
    }
  }

  // "Payment confirmed" WhatsApp -- only when this transition happens on an
  // UPDATE (an admin confirming payment later moves status to 'processing'
  // in the same request; see OrderDetail.tsx's NEXT_STEP map). Skipped when
  // justPaid coincides with isNewOrder (an AppyPay charge that succeeds
  // synchronously at checkout) since the order-confirmation WhatsApp above
  // already covers that case -- a second "payment confirmed" message right
  // after would be redundant.
  if (justPaid && !isNewOrder) {
    await sendWhatsAppMessage(
      doc.customerPhone,
      `Pagamento da encomenda ${doc.orderNumber} confirmado! A sua encomenda está agora em processamento.`,
    )
    try {
      await req.payload.create({
        collection: 'messages',
        overrideAccess: true,
        req,
        data: {
          channel: 'whatsapp',
          direction: 'outbound',
          contactHandle: doc.customerPhone,
          customerName: doc.customerName,
          body: `Pagamento da encomenda ${doc.orderNumber} confirmado! A sua encomenda está agora em processamento.`,
          status: 'auto_handled',
          automationNote: 'payment-confirmed-notice',
          relatedOrder: doc.id,
          sentByAutomation: true,
        },
      })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[messages:log-failed]', err)
    }
  }

  if (justPaid) {
    await sendMetaPurchase(doc, req.payload.logger)
    // Generate the immutable commercial-document snapshot before sending the
    // confirmation so the same PDF is stored in admin and attached to email.
    // The PDF is explicitly marked non-fiscal during this phase.
    let invoiceAttachment: InvoiceAttachment | undefined
    const addressParts = [doc.address, doc.addressLine2, doc.postalCode, doc.city, doc.country].filter(Boolean)
    const attachment = await generateInternalInvoiceForOrder(req.payload, {
      id: doc.id,
      orderNumber: doc.orderNumber,
      market: doc.market,
      lang: doc.lang,
      customerName: doc.customerName,
      customerEmail: doc.customerEmail,
      customerPhone: doc.customerPhone,
      customerTaxId: doc.taxId || undefined,
      customerAddress: addressParts.join(', '),
      deliveryRegion: doc.deliveryRegion || undefined,
      currency: doc.currency,
      subtotal: doc.subtotal,
      shippingCost: doc.shippingCost,
      discountAmount: doc.discountAmount || undefined,
      discountLabel: doc.discountLabel || undefined,
      total: doc.total,
      paymentMethod: doc.paymentMethod,
      paymentReference: doc.paymentReference || undefined,
      items: doc.items,
    }, req)
    if (attachment) invoiceAttachment = attachment

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
