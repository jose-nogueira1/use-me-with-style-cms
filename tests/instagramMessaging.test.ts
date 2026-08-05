import assert from 'node:assert/strict'
import test from 'node:test'

import { sendInstagramMessage } from '../src/lib/messaging'

test('sends Instagram Login messages through graph.instagram.com as me', async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const originalFetch = globalThis.fetch
  process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token'

  let request: { url: string; init?: RequestInit } | undefined
  globalThis.fetch = async (url, init) => {
    request = { url: String(url), init }
    return new Response(JSON.stringify({ recipient_id: 'recipient-1', message_id: 'message-1' }), {
      status: 200,
    })
  }

  try {
    const messageId = await sendInstagramMessage('recipient-1', 'Hello')
    assert.equal(messageId, 'message-1')
    assert.equal(request?.url, 'https://graph.instagram.com/v26.0/me/messages')
    assert.equal(request?.init?.method, 'POST')
    assert.equal((request?.init?.headers as Record<string, string>).Authorization, 'Bearer test-token')
    assert.deepEqual(JSON.parse(String(request?.init?.body)), {
      recipient: { id: 'recipient-1' },
      message: { text: 'Hello' },
    })
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = originalToken
  }
})

test('throws when Instagram rejects a message', async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const originalFetch = globalThis.fetch
  process.env.INSTAGRAM_ACCESS_TOKEN = 'test-token'
  globalThis.fetch = async () => new Response('{"error":"denied"}', { status: 403 })

  try {
    await assert.rejects(
      sendInstagramMessage('recipient-1', 'Hello'),
      /Instagram message send failed \(403\):.*denied/,
    )
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = originalToken
  }
})

test('throws when Instagram messaging is not configured', async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN
  delete process.env.INSTAGRAM_ACCESS_TOKEN

  try {
    await assert.rejects(sendInstagramMessage('recipient-1', 'Hello'), /INSTAGRAM_ACCESS_TOKEN is missing/)
  } finally {
    if (originalToken !== undefined) process.env.INSTAGRAM_ACCESS_TOKEN = originalToken
  }
})
