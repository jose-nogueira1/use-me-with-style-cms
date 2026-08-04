import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

test('order lifecycle notifications are email-only', async () => {
  const source = await readFile(new URL('../src/hooks/notifyOrderEvent.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(source, /sendWhatsAppMessage/)
  assert.doesNotMatch(source, /channel:\s*['"]whatsapp['"]/)
  assert.match(source, /sendOrderConfirmationEmail/)
  assert.match(source, /sendOrderStatusEmail/)
})
