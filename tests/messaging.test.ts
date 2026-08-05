import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'

import { extractInboundMessages, summarizeInstagramEvent, verifyMetaWebhookSignature } from '../src/endpoints/messagingWebhook'
import { buildAutoReply, classifyIncomingMessage } from '../src/lib/messaging'

test('legacy rule helpers remain deterministic for a future assisted-reply plan', () => {
  assert.equal(classifyIncomingMessage('Quero cancelar a minha encomenda e receber reembolso'), 'sensitive')
  assert.match(buildAutoReply('sensitive') ?? '', /equipa vai analisar/i)
})

test('FAQ and order-status automation is deterministic', () => {
  assert.equal(classifyIncomingMessage('Como posso fazer o pagamento?'), 'payment')
  assert.equal(classifyIncomingMessage('Qual é o prazo de entrega?'), 'delivery')
  assert.equal(classifyIncomingMessage('Onde está a minha encomenda?'), 'order_status')
  assert.equal(buildAutoReply('order_status'), null)
  assert.match(
    buildAutoReply('order_status', { orderNumber: 'UMS-100', status: 'shipped' }) ?? '',
    /UMS-100.*enviada/i,
  )
  assert.equal(classifyIncomingMessage('Gostava de saber mais sobre a coleção'), 'unknown')
  assert.equal(buildAutoReply('unknown'), null)
})

test('WhatsApp webhook events stay dormant while the admin inbox is Instagram-only', () => {
  const messages = extractInboundMessages({
    object: 'whatsapp_business_account',
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: '244933617878', profile: { name: 'Cliente' } }],
      messages: [
        { from: '244933617878', id: 'wamid.1', type: 'text', text: { body: 'Entrega?' } },
        { from: '244933617878', id: 'wamid.2', type: 'image' },
      ],
    } }] }],
  })
  assert.deepEqual(messages, [])
})

test('Instagram text messages are extracted', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ messaging: [{ sender: { id: 'ig-user' }, message: { mid: 'ig-mid', text: 'Olá' } }] }],
  })
  assert.deepEqual(messages, [{
    channel: 'instagram', contactHandle: 'ig-user', body: 'Olá', externalId: 'ig-mid',
  }])
})

test('Instagram v26 changes payloads from Meta webhook testing are extracted', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{
      changes: [{
        field: 'messages',
        value: {
          sender: { id: '12334' },
          recipient: { id: '23245' },
          message: { mid: 'random_mid', text: 'random_text' },
        },
      }],
    }],
  })
  assert.deepEqual(messages, [{
    channel: 'instagram', contactHandle: '12334', body: 'random_text', externalId: 'random_mid',
  }])
})

test('Instagram outbound echoes are ignored instead of creating a second conversation', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{
      id: 'business-account',
      messaging: [{
        sender: { id: 'business-account' },
        recipient: { id: 'customer-account' },
        message: { mid: 'echo-mid', text: 'Reply from admin', is_echo: true },
      }],
      changes: [{
        field: 'messages',
        value: {
          sender: { id: 'business-account' },
          recipient: { id: 'customer-account' },
          message: { mid: 'echo-mid-2', text: 'Reply from admin' },
        },
      }],
    }],
  })
  assert.deepEqual(messages, [])
})

test('Instagram story replies retain the story preview and customer text', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [{
      sender: { id: 'customer' },
      recipient: { id: 'business' },
      message: {
        mid: 'story-reply-mid',
        text: 'Is this dress available?',
        reply_to: { story: { id: 'story-id', url: 'https://cdn.example/story.jpg' } },
      },
    }] }],
  })
  assert.deepEqual(messages, [{
    channel: 'instagram',
    contactHandle: 'customer',
    body: 'Is this dress available?',
    externalId: 'story-reply-mid',
    instagramContextType: 'story_reply',
    instagramContextUrl: 'https://cdn.example/story.jpg',
    instagramContextMediaType: 'story',
  }])
})

test('Instagram shared posts and inline replies retain useful sales context', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [
      {
        sender: { id: 'customer' },
        message: { mid: 'share-mid', attachments: [{ type: 'ig_reel', payload: { url: 'https://cdn.example/reel.mp4' } }] },
      },
      {
        sender: { id: 'customer' },
        message: { mid: 'reply-mid', text: 'Yes, that one', reply_to: { mid: 'original-mid' } },
      },
    ] }],
  })
  assert.equal(messages[0]?.instagramContextType, 'shared_post')
  assert.equal(messages[0]?.instagramContextMediaType, 'ig_reel')
  assert.equal(messages[0]?.body, 'Shared an Instagram post')
  assert.equal(messages[1]?.instagramContextType, 'inline_reply')
  assert.equal(messages[1]?.replyToExternalId, 'original-mid')
})

test('Instagram image and video attachments retain their temporary preview URLs', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [
      {
        sender: { id: 'customer' },
        message: { mid: 'image-mid', attachments: [{ type: 'image', payload: { media_url: 'https://cdn.example/image.jpg' } }] },
      },
      {
        sender: { id: 'customer' },
        message: { mid: 'video-mid', attachments: [{ type: 'video', payload: { video_url: 'https://cdn.example/video.mp4' } }] },
      },
    ] }],
  })
  assert.equal(messages[0]?.instagramContextType, 'media')
  assert.equal(messages[0]?.instagramContextUrl, 'https://cdn.example/image.jpg')
  assert.equal(messages[0]?.instagramContextMediaType, 'image')
  assert.equal(messages[1]?.instagramContextType, 'media')
  assert.equal(messages[1]?.instagramContextUrl, 'https://cdn.example/video.mp4')
})

test('Instagram shared content separates a canonical post link from its preview', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [{
      sender: { id: 'customer' },
      message: {
        mid: 'post-mid',
        attachments: [{
          type: 'share',
          payload: {
            image_url: 'https://scontent.cdninstagram.com/post.jpg',
            permalink: 'https://www.instagram.com/p/ABC123/',
          },
        }],
      },
    }] }],
  })
  assert.equal(messages[0]?.instagramContextUrl, 'https://scontent.cdninstagram.com/post.jpg')
  assert.equal(messages[0]?.instagramContextPermalink, 'https://www.instagram.com/p/ABC123/')
})

test('Instagram ig_post attachments from production are treated as shared posts', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [{
      sender: { id: 'customer' },
      message: {
        mid: 'ig-post-mid',
        attachments: [{ type: 'ig_post', payload: { url: 'https://lookaside.example/post-media' } }],
      },
    }] }],
  })
  assert.equal(messages[0]?.instagramContextType, 'shared_post')
  assert.equal(messages[0]?.instagramContextMediaType, 'ig_post')
  assert.equal(messages[0]?.instagramContextUrl, 'https://lookaside.example/post-media')
})

test('Instagram webhook diagnostics expose structure without private values', () => {
  const summary = summarizeInstagramEvent({
    sender: { id: 'private-user-id' },
    message: {
      mid: 'private-message-id',
      text: 'private customer text',
      attachments: [{ type: 'image', payload: { url: 'https://private.example/image.jpg', token: 'secret' } }],
    },
  })
  const serialized = JSON.stringify(summary)
  assert.match(serialized, /"type":"image"/)
  assert.match(serialized, /"hasUsableUrl":true/)
  assert.doesNotMatch(serialized, /private-user-id|private-message-id|private customer text|private\.example|secret/)
})

test('unsupported Instagram media is retained as an actionable fallback', () => {
  const messages = extractInboundMessages({
    object: 'instagram',
    entry: [{ id: 'business', messaging: [{
      sender: { id: 'customer' },
      message: { mid: 'voice-mid', attachments: [{ type: 'audio', payload: { url: 'https://cdn.example/audio' } }] },
    }] }],
  })
  assert.equal(messages[0]?.instagramContextType, 'unsupported_media')
  assert.match(messages[0]?.body ?? '', /open this conversation on Instagram/i)
})

test('Meta webhook signatures require an exact HMAC match', () => {
  const body = JSON.stringify({ object: 'instagram' })
  const secret = 'test-app-secret'
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyMetaWebhookSignature(body, signature, secret), true)
  assert.equal(verifyMetaWebhookSignature(`${body} `, signature, secret), false)
  assert.equal(verifyMetaWebhookSignature(body, null, secret), false)
  assert.equal(verifyMetaWebhookSignature(body, 'sha1=wrong', secret), false)
})
