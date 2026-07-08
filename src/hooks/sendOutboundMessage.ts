import type { CollectionAfterChangeHook } from 'payload'

import { sendInstagramMessage, sendWhatsAppMessage } from '../lib/messaging'

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

  if (doc.channel === 'instagram') {
    await sendInstagramMessage(doc.contactHandle, doc.body)
  } else {
    await sendWhatsAppMessage(doc.contactHandle, doc.body)
  }

  return doc
}
