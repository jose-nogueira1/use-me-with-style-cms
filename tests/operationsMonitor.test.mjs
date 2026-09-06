import assert from 'node:assert/strict'
import test from 'node:test'

import { runOperationsMonitor } from '../scripts/operations-monitor.mjs'

const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'content-type': 'application/json' },
})

test('inventory mode accepts a valid cleanup heartbeat', async () => {
  const result = await runOperationsMonitor({
    mode: 'inventory',
    env: { CRON_SECRET: 'secret', OPS_CMS_URL: 'https://cms.example.test' },
    fetchImpl: async (url, options) => {
      assert.equal(String(url), 'https://cms.example.test/api/inventory/release-expired')
      assert.equal(options.headers.authorization, 'Bearer secret')
      return json({ released: 2 })
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.results, [{ check: 'inventory_cleanup', released: 2 }])
})

test('platform mode verifies inventory cleanup directly without depending on GitHub schedule timing', async () => {
  const requestedUrls = []
  const result = await runOperationsMonitor({
    env: {
      CRON_SECRET: 'secret',
      META_WEBHOOK_VERIFY_TOKEN: 'verify',
    },
    fetchImpl: async (url, options = {}) => {
      const value = String(url)
      requestedUrls.push(value)
      if (value.includes('messaging-webhook')) return new Response(new URL(value).searchParams.get('hub.challenge'))
      if (value.includes('/api/globals/')) return json({ id: 1 })
      if (value.endsWith('/api/inventory/release-expired')) {
        assert.equal(options.headers.authorization, 'Bearer secret')
        return json({ released: 0 })
      }
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    },
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.results.at(-1), { check: 'inventory_cleanup', released: 0 })
  assert.equal(requestedUrls.some((url) => url.includes('api.github.com')), false)
})

test('a failed platform check sends an operations alert and fails closed', async () => {
  const env = {
    CRON_SECRET: 'secret',
    META_WEBHOOK_VERIFY_TOKEN: 'verify',
    RESEND_API_KEY: 'resend',
    RESEND_FROM_EMAIL: 'orders@example.test',
    OPS_ALERT_EMAIL: 'master@example.test',
  }

  const result = await runOperationsMonitor({
    env,
    now: new Date('2026-08-21T12:30:00Z'),
    fetchImpl: async (url, options = {}) => {
      const value = String(url)
      if (value === 'https://api.resend.com/emails') {
        const body = JSON.parse(options.body)
        assert.deepEqual(body.to, ['master@example.test'])
        assert.match(body.subject, /production check/)
        return json({ id: 'email-id' })
      }
      if (value.includes('messaging-webhook')) return new Response(new URL(value).searchParams.get('hub.challenge'))
      if (value.includes('/api/globals/')) return json({ id: 1 })
      if (value.endsWith('/api/inventory/release-expired')) return json({ released: 0 })
      if (value === 'https://pt.usemewithstyle.shop') return new Response('down', { status: 503 })
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.failures[0].check, 'storefronts')
  assert.deepEqual(result.alert, { check: 'email_accepted' })
})
