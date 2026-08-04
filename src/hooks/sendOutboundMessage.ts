import type { CollectionAfterChangeHook } from 'payload'

import { sendInstagramMessage } from '../lib/messaging'
// WhatsApp is dormant, not deleted. Restore this import together with the
// guarded branch below when WhatsApp returns to the admin inbox.
// import { sendWhatsAppMessage } from '../lib/messaging'

// Sends a Messages doc the moment it's created, UNLESS it's already been
// sent by automation (webhook auto-reply or notifyOrderEvent both set
// `sentByAutomation: true` themselves to avoid double-sending). This is what
// makes an admin composing a reply in the Mensagens UI actually deliver it:
// they create a `direction: outbound` doc with `sentByAutomation` left
// false, and this hook does the rest.
export const sendOutboundMessage: CollectionAfterChangeHook = async ({ doc, operation }) => {
  if (operation !== 'create') return doc
  if (doc.direction !== 'outbound') return doc
  if (doc.sentByAutomation) return doc

  // The admin inbox is Instagram-only for now. The collection also rejects
  // newly-created WhatsApp rows, but keep this guard as a second boundary so
  // an old/imported WhatsApp document can never trigger an outbound send.
  if (doc.channel !== 'instagram') return doc
  await sendInstagramMessage(doc.contactHandle, doc.body)

  // Dormant WhatsApp delivery path (future reactivation):
  // if (doc.channel === 'whatsapp') {
  //   await sendWhatsAppMessage(doc.contactHandle, doc.body)
  // }

  return doc
}
