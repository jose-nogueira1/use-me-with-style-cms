import assert from 'node:assert/strict'
import test from 'node:test'
import { randomBytes } from 'node:crypto'
import { decryptInstagramToken, encryptInstagramToken, refreshInstagramAccessToken } from '../src/lib/instagramTokenVault'

test('Instagram tokens are authenticated-encrypted and never stored as plaintext', () => {
  const key = randomBytes(32)
  const token = 'IGAA-super-secret-token'
  const ciphertext = encryptInstagramToken(token, key)
  assert.equal(ciphertext.includes(token), false)
  assert.equal(decryptInstagramToken(ciphertext, key), token)
  assert.throws(() => decryptInstagramToken(`${ciphertext}x`, key))
})

function memoryPayload() {
  const docs: any[] = []
  return { docs, payload: {
    async find() { return { docs } },
    async create({ data }: any) { const doc = { id: 1, createdAt: '2026-06-01T00:00:00.000Z', updatedAt: '2026-06-01T00:00:00.000Z', ...data }; docs.push(doc); return doc },
    async update({ id, data }: any) { Object.assign(docs.find((doc) => doc.id === id), data); return docs[0] },
  } }
}

test('refresh validates the replacement token before atomically promoting it', async () => {
  process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = 'test-encryption-key'
  process.env.INSTAGRAM_ACCESS_TOKEN = 'IGAA-old-token'
  const { docs, payload } = memoryPayload()
  const calls: string[] = []
  const result = await refreshInstagramAccessToken(payload, {
    force: true, now: new Date('2026-08-13T12:00:00.000Z'),
    fetchImpl: (async (url: string | URL | Request) => {
      calls.push(String(url))
      return String(url).includes('refresh_access_token')
        ? Response.json({ access_token: 'IGAA-new-token', expires_in: 5_184_000 })
        : Response.json({ id: '1784', username: 'use_me_withstyle' })
    }) as typeof fetch,
  })
  assert.equal(result.action, 'refreshed')
  assert.equal(decryptInstagramToken(docs[0].ciphertext), 'IGAA-new-token')
  assert.equal(calls.length, 2)
})

test('a failed validation preserves the previously working token', async () => {
  process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY = 'test-encryption-key'
  process.env.INSTAGRAM_ACCESS_TOKEN = 'IGAA-working-token'
  const { docs, payload } = memoryPayload()
  const result = await refreshInstagramAccessToken(payload, {
    force: true,
    fetchImpl: (async (url: string | URL | Request) => String(url).includes('refresh_access_token')
      ? Response.json({ access_token: 'IGAA-bad-token', expires_in: 5_184_000 })
      : new Response('invalid', { status: 401 })) as typeof fetch,
  })
  assert.equal(result.action, 'failed')
  assert.equal(decryptInstagramToken(docs[0].ciphertext), 'IGAA-working-token')
  assert.match(docs[0].lastError, /validation failed/)
})
