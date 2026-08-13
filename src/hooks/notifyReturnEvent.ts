import type { CollectionAfterChangeHook } from 'payload'
import { sendReturnStatusEmail } from '../lib/email'

export const notifyReturnEvent: CollectionAfterChangeHook = async ({ doc, previousDoc, operation, req, context }) => {
  const changed = operation === 'create' || doc.status !== previousDoc?.status
  if (!changed) return
  if (context.returnSideEffect || doc.customerLastNotifiedStatus === doc.status) return
  await sendReturnStatusEmail(req.payload, {
    to: doc.customerEmail, customerName: doc.customerName, returnNumber: doc.returnNumber,
    orderNumber: doc.orderNumber, status: doc.status, resolution: doc.resolution,
    amount: Number(doc.approvedAmount ?? doc.requestedAmount ?? 0), currency: doc.currency,
    lang: doc.lang === 'en' ? 'en' : 'pt',
  })
  await req.payload.update({ collection: 'returns' as any, id: doc.id, overrideAccess: true, req, data: { customerLastNotifiedStatus: doc.status }, context: { returnSideEffect: true } })
}
