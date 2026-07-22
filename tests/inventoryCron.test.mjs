import assert from 'node:assert/strict'
import test from 'node:test'

import { releaseExpiredReservations } from '../scripts/release-expired-reservations.mjs'

test('cron calls the protected cleanup endpoint and returns the released count', async () => {
  let request
  const result = await releaseExpiredReservations({
    baseUrl: 'https://cms.example.test',
    secret: 'test-secret',
    fetchImpl: async (url, init) => {
      request = { url: String(url), init }
      return new Response(JSON.stringify({ released: 3 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    },
  })

  assert.equal(request.url, 'https://cms.example.test/api/inventory/release-expired')
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.headers.authorization, 'Bearer test-secret')
  assert.deepEqual(result, { released: 3 })
})

test('cron fails the run when cleanup is unauthorized or unavailable', async () => {
  await assert.rejects(
    releaseExpiredReservations({
      baseUrl: 'https://cms.example.test',
      secret: 'wrong-secret',
      fetchImpl: async () => new Response('Unauthorized', { status: 401 }),
    }),
    /HTTP 401/,
  )
})
