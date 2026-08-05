import assert from 'node:assert/strict'
import test from 'node:test'

import { instagramProfileEndpoint } from '../src/endpoints/instagramProfile'
import { getInstagramUserProfile, sendInstagramMessage } from '../src/lib/messaging'

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
    // v23 is the newest production version currently accepted by the
    // Instagram Login messaging endpoint for this app/token.
    assert.equal(request?.url, 'https://graph.instagram.com/v23.0/me/messages')
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

test('requests and returns Instagram messaging participant profile pictures', async () => {
  const originalToken = process.env.INSTAGRAM_ACCESS_TOKEN
  const originalFetch = globalThis.fetch
  process.env.INSTAGRAM_ACCESS_TOKEN = 'IGAA-test-token'

  let requestUrl = ''
  globalThis.fetch = async (url) => {
    requestUrl = String(url)
    return Response.json({
      id: 'ig-user-1',
      name: 'Use Me Customer',
      username: 'useme_customer',
      profile_pic: 'https://cdn.example/profile.jpg',
      is_verified_user: true,
    })
  }

  try {
    const response = await instagramProfileEndpoint.handler({
      url: 'https://cms.example/api/instagram-profile?contactHandle=ig-user-1',
    } as Parameters<typeof instagramProfileEndpoint.handler>[0])
    assert.ok(response instanceof Response)
    const profile = await response.json()

    assert.match(requestUrl, /^https:\/\/graph\.instagram\.com\/v23\.0\/ig-user-1\?/)
    assert.match(requestUrl, /fields=id,username,name,profile_pic,is_verified_user/)
    assert.equal(profile.profile_pic, 'https://cdn.example/profile.jpg')
    assert.equal(profile.is_verified_user, true)
    assert.equal(response.headers.get('cache-control'), 'private, no-store')

    const helperProfile = await getInstagramUserProfile('ig-user-1')
    assert.equal(helperProfile?.profile_pic, 'https://cdn.example/profile.jpg')
    assert.match(requestUrl, /profile_pic/)
  } finally {
    globalThis.fetch = originalFetch
    if (originalToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN
    else process.env.INSTAGRAM_ACCESS_TOKEN = originalToken
  }
})
