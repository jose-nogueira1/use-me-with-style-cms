import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'

const DEFAULT_CMS_URL = 'https://cms.usemewithstyle.shop'
const DEFAULT_STOREFRONTS = [
  'https://usemewithstyle.shop',
  'https://ao.usemewithstyle.shop',
  'https://pt.usemewithstyle.shop',
]
// GitHub Actions cron runs are best-effort and can start well after their
// scheduled time. The primary Railway cleanup still runs every five minutes;
// this independent heartbeat alerts after 45 minutes without a successful run.
const DEFAULT_HEARTBEAT_MAX_AGE_MS = 45 * 60 * 1000

function required(env, name) {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required.`)
  return value
}

async function request(fetchImpl, url, options = {}) {
  const response = await fetchImpl(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000),
    ...options,
  })
  if (!response.ok) throw new Error(`${new URL(url).hostname} returned HTTP ${response.status}.`)
  return response
}

export async function checkStorefronts({ env, fetchImpl }) {
  const storefronts = env.OPS_STOREFRONT_URLS
    ? env.OPS_STOREFRONT_URLS.split(',').map((value) => value.trim()).filter(Boolean)
    : DEFAULT_STOREFRONTS

  for (const storefront of storefronts) {
    const response = await request(fetchImpl, storefront, {
      headers: { 'user-agent': 'use-me-with-style-operations-monitor/1.0' },
    })
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) throw new Error(`${new URL(storefront).hostname} did not return HTML.`)
  }

  return { check: 'storefronts', count: storefronts.length }
}

export async function checkCms({ env, fetchImpl }) {
  const cmsUrl = env.OPS_CMS_URL || DEFAULT_CMS_URL
  const response = await request(fetchImpl, new URL('/api/globals/storefront-content?depth=0', cmsUrl))
  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload !== 'object') throw new Error('CMS health response was not valid JSON.')
  return { check: 'cms' }
}

export async function checkMetaWebhook({ env, fetchImpl }) {
  const cmsUrl = env.OPS_CMS_URL || DEFAULT_CMS_URL
  const token = required(env, 'META_WEBHOOK_VERIFY_TOKEN')
  const challenge = `gate3-${randomUUID()}`
  const endpoint = new URL('/api/messaging-webhook', cmsUrl)
  endpoint.searchParams.set('hub.mode', 'subscribe')
  endpoint.searchParams.set('hub.verify_token', token)
  endpoint.searchParams.set('hub.challenge', challenge)
  const response = await request(fetchImpl, endpoint)
  if ((await response.text()) !== challenge) throw new Error('Meta webhook did not echo the verification challenge.')
  return { check: 'meta_webhook' }
}

export async function runInventoryCleanup({ env, fetchImpl }) {
  const cmsUrl = env.OPS_CMS_URL || DEFAULT_CMS_URL
  const secret = required(env, 'CRON_SECRET')
  const response = await request(fetchImpl, new URL('/api/inventory/release-expired', cmsUrl), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
      'user-agent': 'use-me-with-style-operations-monitor/1.0',
    },
  })
  const payload = await response.json().catch(() => null)
  if (!payload || typeof payload.released !== 'number') throw new Error('Inventory cleanup returned an invalid response.')
  return { check: 'inventory_cleanup', released: payload.released }
}

export async function checkInventoryHeartbeat({ env, fetchImpl, now = Date.now() }) {
  if (env.SIMULATE_MISSED_HEARTBEAT === '1') throw new Error('Simulated missed inventory-cleanup heartbeat.')
  const repository = required(env, 'GITHUB_REPOSITORY')
  const token = required(env, 'GITHUB_TOKEN')
  const endpoint = `https://api.github.com/repos/${repository}/actions/workflows/inventory-cleanup-heartbeat.yml/runs?status=success&per_page=1`
  const response = await request(fetchImpl, endpoint, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'x-github-api-version': '2022-11-28',
    },
  })
  const payload = await response.json().catch(() => null)
  const run = payload?.workflow_runs?.[0]
  const completedAt = Date.parse(run?.updated_at || run?.run_started_at || run?.created_at || '')
  const maxAgeMs = Number(env.OPS_HEARTBEAT_MAX_AGE_MS || DEFAULT_HEARTBEAT_MAX_AGE_MS)
  if (!Number.isFinite(completedAt)) throw new Error('No successful inventory-cleanup heartbeat was found.')
  if (now - completedAt > maxAgeMs) throw new Error(`Inventory-cleanup heartbeat is older than ${Math.round(maxAgeMs / 60_000)} minutes.`)
  return { check: 'inventory_heartbeat', ageSeconds: Math.max(0, Math.round((now - completedAt) / 1000)) }
}

async function sendResendEmail({ env, fetchImpl, subject, text, html }) {
  const apiKey = required(env, 'RESEND_API_KEY')
  const fromEmail = required(env, 'RESEND_FROM_EMAIL')
  const to = required(env, 'OPS_ALERT_EMAIL')
  const fromName = env.RESEND_FROM_NAME?.trim() || 'Use Me With Style Operations'
  const response = await request(fetchImpl, 'https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: `${fromName} <${fromEmail}>`, to: [to], subject, text, html }),
  })
  const payload = await response.json().catch(() => null)
  if (!payload?.id) throw new Error('Resend accepted no email identifier.')
  return { check: 'email_accepted' }
}

export async function sendOperationsAlert({ env, fetchImpl, failures, now = new Date() }) {
  const safeFailures = failures.map((failure) => `${failure.check}: ${failure.message}`)
  const subject = `[Use Me Operations] ${failures.length} production check${failures.length === 1 ? '' : 's'} failed`
  const text = [
    'Use Me With Style production monitoring detected an incident.',
    '',
    ...safeFailures.map((failure) => `- ${failure}`),
    '',
    `Detected at: ${now.toISOString()}`,
    'Technical response owner: José',
    'Operations escalation: José and Raisa via WhatsApp',
  ].join('\n')
  const html = `<h1>Production monitoring alert</h1><ul>${safeFailures.map((failure) => `<li>${failure.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</li>`).join('')}</ul><p>Detected at: ${now.toISOString()}</p><p>Technical response owner: José<br>Operations escalation: José and Raisa via WhatsApp</p>`
  return sendResendEmail({ env, fetchImpl, subject, text, html })
}

export async function sendEmailCanary({ env, fetchImpl, now = new Date() }) {
  const timestamp = now.toISOString()
  return sendResendEmail({
    env,
    fetchImpl,
    subject: `[Use Me Operations] Email delivery canary — ${timestamp.slice(0, 10)}`,
    text: `Use Me With Style email delivery canary accepted at ${timestamp}. Confirm receipt in the shared master mailbox.`,
    html: `<p>Use Me With Style email delivery canary accepted at <strong>${timestamp}</strong>.</p><p>Confirm receipt in the shared master mailbox.</p>`,
  })
}

export async function runOperationsMonitor({ mode = 'platform', env = process.env, fetchImpl = fetch, now = new Date() } = {}) {
  if (mode === 'email-canary') {
    const result = await sendEmailCanary({ env, fetchImpl, now })
    return { ok: true, mode, results: [result] }
  }

  const checks = mode === 'inventory'
    ? [['inventory_cleanup', runInventoryCleanup]]
    : [
        ['storefronts', checkStorefronts],
        ['cms', checkCms],
        ['meta_webhook', checkMetaWebhook],
        ['inventory_heartbeat', checkInventoryHeartbeat],
      ]
  const results = []
  const failures = []

  for (const [check, execute] of checks) {
    try {
      results.push(await execute({ env, fetchImpl, now: now.getTime() }))
    } catch (error) {
      failures.push({ check, message: error instanceof Error ? error.message : 'Unknown failure.' })
    }
  }

  if (failures.length) {
    let alert
    try {
      alert = await sendOperationsAlert({ env, fetchImpl, failures, now })
    } catch (error) {
      failures.push({ check: 'alert_delivery', message: error instanceof Error ? error.message : 'Unknown alert failure.' })
    }
    return { ok: false, mode, results, failures, alert }
  }

  return { ok: true, mode, results }
}

function cliMode(args) {
  const modeArgument = args.find((argument) => argument.startsWith('--mode='))
  return modeArgument ? modeArgument.slice('--mode='.length) : 'platform'
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOperationsMonitor({ mode: cliMode(process.argv.slice(2)) })
    .then((result) => {
      console.log(JSON.stringify(result))
      if (!result.ok) process.exitCode = 1
    })
    .catch((error) => {
      console.error(JSON.stringify({ ok: false, fatal: error instanceof Error ? error.message : 'Unknown failure.' }))
      process.exitCode = 1
    })
}
