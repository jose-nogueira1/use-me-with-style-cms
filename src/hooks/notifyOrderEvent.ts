import type { CollectionAfterChangeHook } from 'payload'

import { sendWhatsAppMessage } from '../lib/messaging'

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

  if (!isNewOrder && !justShipped) return doc

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

  return doc
}
