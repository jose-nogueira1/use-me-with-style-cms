import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { test } from 'node:test'

import { extractInboundMessages, verifyMetaWebhookSignature } from '../src/endpoints/messagingWebhook'
import { buildAutoReply, classifyIncomingMessage } from '../src/lib/messaging'

test('sensitive messages always take priority and receive only an acknowledgement', () => {
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

test('WhatsApp text messages are extracted and non-text events ignored', () => {
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
  assert.deepEqual(messages, [{
    channel: 'whatsapp', contactHandle: '244933617878', customerName: 'Cliente',
    body: 'Entrega?', externalId: 'wamid.1',
  }])
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

test('Meta webhook signatures require an exact HMAC match', () => {
  const body = JSON.stringify({ object: 'instagram' })
  const secret = 'test-app-secret'
  const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`
  assert.equal(verifyMetaWebhookSignature(body, signature, secret), true)
  assert.equal(verifyMetaWebhookSignature(`${body} `, signature, secret), false)
  assert.equal(verifyMetaWebhookSignature(body, null, secret), false)
  assert.equal(verifyMetaWebhookSignature(body, 'sha1=wrong', secret), false)
})
