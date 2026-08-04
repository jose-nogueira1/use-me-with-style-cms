import type { CollectionAfterChangeHook } from 'payload'

import { buildCttTrackingUrl } from '../lib/messaging'
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../lib/email'
import { generateInternalInvoiceForOrder } from '../lib/internalInvoice'
import type { InvoiceAttachment } from '../lib/email'
import { sendMetaPurchase } from '../endpoints/metaConversions'

// Customer order communication is email-only. Telephone numbers remain on
// orders for exceptional staff-initiated contact, but order events never
// automatically send or queue WhatsApp messages.
export const notifyOrderEvent: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  const justShipped = operation === 'update' && previousDoc?.status !== 'shipped' && doc.status === 'shipped'
  const justDelivered = operation === 'update' && previousDoc?.status !== 'delivered' && doc.status === 'delivered'
  // Order-confirmation email fires on the paid transition, not on create.
  // Stripe/PayPal orders are created up-front in
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
  // the shipped transition doesn't fire two separate emails.
  const justAddedTracking =
    operation === 'update' && !previousDoc?.cttTrackingCode && !!doc.cttTrackingCode && !justShipped
  const trackingUrl = doc.cttTrackingCode ? buildCttTrackingUrl(doc.cttTrackingCode, doc.lang === 'en' ? 'en' : 'pt') : undefined

  // Shipped and delivered updates remain transactional emails.
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

  // If tracking is added after shipment, send an updated shipping email.
  if (justAddedTracking && trackingUrl) {
    await sendOrderStatusEmail(req.payload, {
      to: doc.customerEmail,
      orderNumber: doc.orderNumber,
      customerName: doc.customerName,
      lang: doc.lang,
      stage: 'shipped',
      courierTrackingCode: doc.cttTrackingCode,
      courierTrackingUrl: trackingUrl,
    })
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
