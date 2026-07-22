const CLEANUP_PATH = '/api/inventory/release-expired'

export async function releaseExpiredReservations({
  baseUrl = process.env.PAYLOAD_PUBLIC_SERVER_URL,
  secret = process.env.CRON_SECRET,
  fetchImpl = fetch,
  timeoutMs = 15_000,
} = {}) {
  if (!baseUrl) throw new Error('PAYLOAD_PUBLIC_SERVER_URL is required.')
  if (!secret) throw new Error('CRON_SECRET is required.')

  const endpoint = new URL(CLEANUP_PATH, baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const response = await fetchImpl(endpoint, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
      'user-agent': 'use-me-with-style-inventory-cron/1.0',
    },
    signal: AbortSignal.timeout(timeoutMs),
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Inventory cleanup returned HTTP ${response.status}.`)
  }
  if (!payload || typeof payload.released !== 'number') {
    throw new Error('Inventory cleanup returned an invalid response.')
  }
  return payload
}

const isDirectExecution = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href
if (isDirectExecution) {
  const startedAt = Date.now()
  releaseExpiredReservations()
    .then(({ released }) => {
      console.log(JSON.stringify({ event: 'inventory_cleanup_cron_completed', released, durationMs: Date.now() - startedAt }))
    })
    .catch((error) => {
      console.error(JSON.stringify({
        event: 'inventory_cleanup_cron_failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        durationMs: Date.now() - startedAt,
      }))
      process.exitCode = 1
    })
}
