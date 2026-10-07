import type { Endpoint } from 'payload'

import { orderInvoiceInput } from '../lib/internalInvoice'
import { issueVeroInvoiceForOrder, veroRequest } from '../lib/veroInvoice'

// Cron-driven (same CRON_SECRET pattern as /inventory/release-expired).
// Vero has no webhook for AGT validation, so this polls documents still
// `pending`, logs rejections, and retries invoices that failed to issue.
export const veroSyncEndpoints: Endpoint[] = [
  {
    path: '/vero/sync',
    method: 'post',
    handler: async (req) => {
      const configuredSecret = process.env.CRON_SECRET
      const suppliedSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (!req.user && (!configuredSecret || suppliedSecret !== configuredSecret)) {
        return new Response('Unauthorized', { status: 401 })
      }
      if (!process.env.VERO_API_KEY || !process.env.VERO_ORG_ID) return Response.json({ skipped: 'Vero not configured' })

      const { payload } = req
      const result = { validated: 0, rejected: 0, stillPending: 0, retried: 0, errors: 0 }

      const pending = await payload.find({
        collection: 'invoices',
        overrideAccess: true,
        limit: 50,
        where: { and: [{ provider: { equals: 'vero' } }, { agtStatus: { equals: 'pending' } }] },
      })
      for (const row of pending.docs) {
        try {
          const doc = await veroRequest<{ agtStatus: 'pending' | 'validated' | 'rejected'; agtErrors: unknown; status: string; atcud: string | null }>(
            'GET',
            `/invoices/${row.veroId}`,
          )
          if (doc.agtStatus === 'pending') {
            result.stillPending++
            continue
          }
          await payload.update({
            collection: 'invoices',
            id: row.id,
            overrideAccess: true,
            data: { agtStatus: doc.agtStatus, agtErrors: doc.agtErrors ?? null, veroStatus: doc.status, atcud: doc.atcud },
          })
          if (doc.agtStatus === 'rejected') {
            result.rejected++
            payload.logger.error({ event: 'vero_agt_rejected', invoice: row.invoiceNumber, agtErrors: doc.agtErrors })
          } else result.validated++
        } catch (err) {
          result.errors++
          payload.logger.error({ event: 'vero_sync_poll_failed', invoice: row.invoiceNumber, err })
        }
      }

      const failed = await payload.find({
        collection: 'invoices',
        overrideAccess: true,
        limit: 20,
        where: { and: [{ provider: { equals: 'vero' } }, { status: { equals: 'failed' } }] },
      })
      for (const row of failed.docs) {
        const orderId = typeof row.relatedOrder === 'object' ? row.relatedOrder.id : row.relatedOrder
        const order = await payload.findByID({ collection: 'orders', id: orderId, overrideAccess: true, depth: 0 })
        if (await issueVeroInvoiceForOrder(payload, orderInvoiceInput(order))) result.retried++
      }

      return Response.json(result)
    },
  },
]
