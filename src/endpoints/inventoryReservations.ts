import type { Endpoint } from 'payload'

import { releaseExpiredReservations } from '../lib/inventoryReservation'

export const inventoryReservationEndpoints: Endpoint[] = [
  {
    path: '/inventory/release-expired',
    method: 'post',
    handler: async (req) => {
      const configuredSecret = process.env.CRON_SECRET
      const suppliedSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      if (!req.user && (!configuredSecret || suppliedSecret !== configuredSecret)) {
        return new Response('Unauthorized', { status: 401 })
      }

      const startedAt = Date.now()
      const requestId = req.headers.get('x-vercel-id') || req.headers.get('x-request-id') || undefined
      try {
        const released = await releaseExpiredReservations(req)
        req.payload.logger.info({
          event: 'inventory_reservations_released',
          released,
          durationMs: Date.now() - startedAt,
          requestId,
        })
        return Response.json({ released })
      } catch (error) {
        req.payload.logger.error({
          event: 'inventory_reservation_cleanup_failed',
          err: error,
          durationMs: Date.now() - startedAt,
          requestId,
        })
        return Response.json({ error: 'Reservation cleanup failed.' }, { status: 500 })
      }
    },
  },
]
