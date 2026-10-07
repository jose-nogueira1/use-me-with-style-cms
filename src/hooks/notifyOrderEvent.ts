import type { CollectionAfterChangeHook, Payload } from 'payload'

import { buildCttTrackingUrl } from '../lib/messaging'
import { sendOrderConfirmationEmail, sendOrderStatusEmail } from '../lib/email'
import type { OrderConfirmationItemInput } from '../lib/email'
import { generateInternalInvoiceForOrder, orderInvoiceInput } from '../lib/internalInvoice'
import { issueVeroInvoiceForOrder } from '../lib/veroInvoice'
import type { InvoiceAttachment } from '../lib/email'
import { sendMetaPurchase } from '../endpoints/metaConversions'
import { absoluteMediaUrl } from '../lib/mediaUrl'
import { relationshipId, selectOrderItemImage } from '../lib/orderItemImage'

// Runs `task` once the order is seen as `paid` by a fresh, transaction-free
// read (i.e. the writer committed). Gives up quietly if that never happens.
// ponytail: in-process retry, a restart in this window drops the task; the
// /vero/sync job still retries the invoice but not the confirmation email.
function afterCommit(payload: Payload, orderId: number | string, task: (order: Record<string, any>) => Promise<void>) {
  void (async () => {
    for (let attempt = 0; attempt < 8; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 500 : 1500))
      const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 }).catch(() => null)
      if (order?.paymentStatus !== 'paid') continue
      try {
        await task(order)
      } catch (err) {
        payload.logger.error({ event: 'after_commit_task_failed', orderId, err })
      }
      return
    }
    payload.logger.warn({ event: 'after_commit_order_not_paid', orderId })
  })()
}

// Customer order communication is email-only. Telephone numbers remain on
// orders for exceptional staff-initiated contact, but order events never
// automatically send or queue WhatsApp messages.
export const notifyOrderEvent: CollectionAfterChangeHook = async ({
  doc,
  previousDoc,
  operation,
  req,
  context,
}) => {
  if (context?.returnReplacement === true) return
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
      customerFirstName: doc.customerFirstName || undefined,
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
      customerFirstName: doc.customerFirstName || undefined,
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
      customerFirstName: doc.customerFirstName || undefined,
      lang: doc.lang,
      stage: 'shipped',
      courierTrackingCode: doc.cttTrackingCode,
      courierTrackingUrl: trackingUrl,
    })
  }

  if (justPaid) {
    await sendMetaPurchase(doc, req.payload.logger)
    const sendConfirmation = async (payload: Payload, order: Record<string, any>, attachment?: InvoiceAttachment) => {
      // Resolve each item's product image for the confirmation email --
      // Orders.items only snapshots productName/size/color/qty/unitPrice (see
      // Orders.ts), never an image, so the `product` relationship has to be
      // looked up separately. Best-effort: a lookup failure (or a product
      // with no images) just means that item's email row falls back to the
      // template's own placeholder swatch (see renderItemRow in lib/email.ts)
      // instead of blocking or failing the confirmation send.
      const orderItems: Array<Record<string, unknown>> = Array.isArray(order.items) ? order.items : []
      const productIds = Array.from(
        new Set(orderItems.map((item) => relationshipId(item.product)).filter((id): id is string => Boolean(id))),
      )
      const productById = new Map<string, Record<string, unknown>>()
      if (productIds.length) {
        try {
          const products = await payload.find({
            collection: 'products',
            where: { id: { in: productIds } },
            depth: 1,
            limit: productIds.length,
            overrideAccess: true,
          })
          for (const product of products.docs) {
            productById.set(String(product.id), product as unknown as Record<string, unknown>)
          }
        } catch (err) {
          // Never let an image-lookup failure block the confirmation email.
          // eslint-disable-next-line no-console
          console.error('[email:product-image-lookup-failed]', err)
        }
      }

      const emailItems: OrderConfirmationItemInput[] = orderItems.map((item) => {
        const productId = relationshipId(item.product)
        const product = productId ? productById.get(productId) : undefined
        const selectedImage = selectOrderItemImage(
          product?.images as Array<{ image?: unknown; color?: unknown }> | undefined,
          item.colorId,
        )
        const media = selectedImage && typeof selectedImage === 'object'
          ? selectedImage as { url?: string | null; alt?: string | null; sizes?: { card?: { url?: string | null } } }
          : undefined
        return {
          productName: String(item.productName ?? ''),
          size: (item.size as string | undefined) || undefined,
          optionLabel: (item.optionLabel as string | undefined) || undefined,
          optionValue: (item.optionValue as string | undefined) || undefined,
          productType: item.productType === 'bundle' ? 'bundle' : 'standard',
          color: (item.color as string | undefined) || undefined,
          qty: Number(item.qty) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          imageUrl: absoluteMediaUrl(media?.sizes?.card?.url || media?.url),
          imageAlt: media?.alt || String(item.productName ?? ''),
        }
      })

      await sendOrderConfirmationEmail(payload, {
        to: order.customerEmail,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt,
        customerName: order.customerName,
        // customerFirstName is optional/not backfilled on older orders --
        // buildOrderConfirmationEmail itself falls back to the first token of
        // customerName when this is absent (see resolveFirstName).
        customerFirstName: order.customerFirstName || undefined,
        total: order.total,
        currency: order.currency,
        // order.lang is the storefront language at checkout (Orders.lang,
        // defaultValue 'pt'); sendOrderConfirmationEmail also defaults to 'pt'
        // itself if this is somehow missing (e.g. an order written before this
        // field existed).
        lang: order.lang,
        items: emailItems,
        subtotal: order.subtotal,
        discountAmount: order.discountAmount || undefined,
        discountLabel: order.discountLabel || undefined,
        shippingCost: order.shippingCost,
        paymentMethod: order.paymentMethod,
        deliveryMethod: order.deliveryMethod,
        // Only set this early if staff somehow entered a tracking code before
        // the payment-confirmation email went out -- rare (tracking is
        // normally added at the shipped stage, see justShipped above) but
        // harmless to include when it happens.
        courierTrackingCode: order.cttTrackingCode || undefined,
        courierTrackingUrl: trackingUrl,
        address: {
          line1: order.address,
          line2: order.addressLine2,
          postalCode: order.postalCode || undefined,
          city: order.city,
          country: order.country,
        },
        attachment,
      })
    }

    if (doc.market === 'AO') {
      // Angola invoices are fiscal documents issued through Vero (AGT-certified);
      // there is no internal fallback. This hook runs inside the payment
      // webhook's database transaction (which holds a row lock on the order), so
      // the Vero call waits until the paid state is actually committed -- a
      // rollback must never leave a fiscal document nobody recorded. A Vero
      // failure leaves a `failed` invoice row that /vero/sync retries.
      afterCommit(req.payload, doc.id, async (paid) => {
        const attachment = await issueVeroInvoiceForOrder(req.payload, orderInvoiceInput(paid))
        await sendConfirmation(req.payload, paid, attachment ?? undefined)
      })
    } else {
      // Portugal keeps the internal commercial PDF (generated in-transaction:
      // purely local, no external call).
      const attachment = await generateInternalInvoiceForOrder(req.payload, orderInvoiceInput(doc), req)
      await sendConfirmation(req.payload, doc, attachment ?? undefined)
    }
  }

  return doc
}
