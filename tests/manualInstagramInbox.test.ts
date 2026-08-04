import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const webhookSource = readFileSync(new URL('../src/endpoints/messagingWebhook.ts', import.meta.url), 'utf8')

test('Instagram webhook ingestion is manual-only and deduplicates Meta retries', () => {
  assert.match(webhookSource, /instagram-inbox -- manual reply required/)
  assert.match(webhookSource, /where: \{ externalId: \{ equals: msg\.externalId \} \}/)
  assert.doesNotMatch(webhookSource, /^\s*await sendInstagramMessage\(/m)
  assert.match(webhookSource, /Future AI-assisted reply path \(deliberately dormant\)/)
})
