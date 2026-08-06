import type { CollectionAfterChangeHook } from 'payload'

import { buildCttTrackingUrl } from '../lib/messaging'
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../lib/email'
import type { OrderConfirmationItemInput } from '../lib/email'
import { generateInternalInvoiceForOrder } from '../lib/internalInvoice'
import type { InvoiceAttachment } from '../lib/email'
import { sendMetaPurchase } from '../endpoints/metaConversions'
import { absoluteMediaUrl } from '../lib/mediaUrl'

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

    // Resolve each item's product image for the confirmation email --
    // Orders.items only snapshots productName/size/color/qty/unitPrice (see
    // Orders.ts), never an image, so the `product` relationship has to be
    // looked up separately. Best-effort: a lookup failure (or a product
    // with no images) just means that item's email row falls back to the
    // template's own placeholder swatch (see renderItemRow in lib/email.ts)
    // instead of blocking or failing the confirmation send.
    const orderItems: Array<Record<string, unknown>> = Array.isArray(doc.items) ? doc.items : []
    const productIds = Array.from(new Set(orderItems.map((item) => item.product).filter((id) => id != null)))
    const productImageById = new Map<string, { url?: string; alt?: string }>()
    if (productIds.length) {
      try {
        const products = await req.payload.find({
          collection: 'products',
          where: { id: { in: productIds } },
          depth: 1,
          limit: productIds.length,
          overrideAccess: true,
        })
        for (const product of products.docs) {
          const firstImage = Array.isArray(product.images) ? product.images[0]?.image : undefined
          if (firstImage && typeof firstImage === 'object') {
            const media = firstImage as { url?: string | null; alt?: string | null; sizes?: { card?: { url?: string | null } } }
            // Prefer the pre-cropped "card" size (600x800, matches the
            // storefront's own product-card aspect ratio) over the full
            // original when available -- smaller download for an email.
            productImageById.set(String(product.id), {
              url: absoluteMediaUrl(media.sizes?.card?.url || media.url),
              alt: media.alt || product.name,
            })
          }
        }
      } catch (err) {
        // Never let an image-lookup failure block the confirmation email.
        // eslint-disable-next-line no-console
        console.error('[email:product-image-lookup-failed]', err)
      }
    }

    const emailItems: OrderConfirmationItemInput[] = orderItems.map((item) => {
      const image = item.product != null ? productImageById.get(String(item.product)) : undefined
      return {
        productName: String(item.productName ?? ''),
        size: (item.size as string | undefined) || undefined,
        color: (item.color as string | undefined) || undefined,
        qty: Number(item.qty) || 1,
        unitPrice: Number(item.unitPrice) || 0,
        imageUrl: image?.url,
        imageAlt: image?.alt || String(item.productName ?? ''),
      }
    })

    await sendOrderConfirmationEmail(req.payload, {
      to: doc.customerEmail,
      orderNumber: doc.orderNumber,
      orderDate: doc.createdAt,
      customerName: doc.customerName,
      // customerFirstName is optional/not backfilled on older orders --
      // buildOrderConfirmationEmail itself falls back to the first token of
      // customerName when this is absent (see resolveFirstName).
      customerFirstName: doc.customerFirstName || undefined,
      total: doc.total,
      currency: doc.currency,
      // doc.lang is the storefront language at checkout (Orders.lang,
      // defaultValue 'pt'); sendOrderConfirmationEmail also defaults to 'pt'
      // itself if this is somehow missing (e.g. an order written before this
      // field existed).
      lang: doc.lang,
      items: emailItems,
      subtotal: doc.subtotal,
      discountAmount: doc.discountAmount || undefined,
      discountLabel: doc.discountLabel || undefined,
      shippingCost: doc.shippingCost,
      paymentMethod: doc.paymentMethod,
      deliveryMethod: doc.deliveryMethod,
      // Only set this early if staff somehow entered a tracking code before
      // the payment-confirmation email went out -- rare (tracking is
      // normally added at the shipped stage, see justShipped above) but
      // harmless to include when it happens.
      courierTrackingCode: doc.cttTrackingCode || undefined,
      courierTrackingUrl: trackingUrl,
      address: {
        line1: doc.address,
        line2: doc.addressLine2,
        postalCode: doc.postalCode || undefined,
        city: doc.city,
        country: doc.country,
      },
      attachment: invoiceAttachment,
    })
  }

  return doc
}
