import assert from 'node:assert/strict'
import { test } from 'node:test'
import { POST } from '../src/app/api/operations/database-backup/route.ts'

test('a public caller cannot request an archive or cache a backup response', async () => {
  for (const authorization of ['', 'Bearer invalid']) {
    const response = await POST(new Request('https://example.invalid/api/operations/database-backup', {
      method: 'POST', headers: { authorization, 'x-backup-transfer-key': 'a'.repeat(64) },
    }))
    assert.equal(response.status, 401)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.equal(await response.text(), '')
  }
})
