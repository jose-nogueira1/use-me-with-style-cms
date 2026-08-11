import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('R2 media storage retries transient S3 failures', () => {
  const config = readFileSync(new URL('../src/payload.config.ts', import.meta.url), 'utf8')
  assert.match(config, /maxAttempts: 5/)
  assert.match(config, /retryMode: 'adaptive'/)
})
