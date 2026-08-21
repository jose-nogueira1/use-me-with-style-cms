import assert from 'node:assert/strict'
import test from 'node:test'

import { checkInventoryHeartbeat, runOperationsMonitor } from '../scripts/operations-monitor.mjs'

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

test('heartbeat check rejects stale successful runs', async () => {
  await assert.rejects(
    checkInventoryHeartbeat({
      env: { GITHUB_REPOSITORY: 'owner/repo', GITHUB_TOKEN: 'token', OPS_HEARTBEAT_MAX_AGE_MS: '900000' },
      now: Date.parse('2026-08-21T12:30:01Z'),
      fetchImpl: async () => json({ workflow_runs: [{ updated_at: '2026-08-21T12:15:00Z' }] }),
    }),
    /older than 15 minutes/,
  )
})

test('a failed platform check sends an operations alert and fails closed', async () => {
  const env = {
    META_WEBHOOK_VERIFY_TOKEN: 'verify',
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_TOKEN: 'token',
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
      if (value.includes('api.github.com')) return json({ workflow_runs: [{ updated_at: '2026-08-21T12:29:00Z' }] })
      if (value.includes('messaging-webhook')) return new Response(new URL(value).searchParams.get('hub.challenge'))
      if (value.includes('/api/globals/')) return json({ id: 1 })
      if (value === 'https://pt.usemewithstyle.shop') return new Response('down', { status: 503 })
      return new Response('<html></html>', { headers: { 'content-type': 'text/html' } })
    },
  })

  assert.equal(result.ok, false)
  assert.equal(result.failures[0].check, 'storefronts')
  assert.deepEqual(result.alert, { check: 'email_accepted' })
})
