import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MANUAL_PAYMENT_TTL_MS,
  ONLINE_PAYMENT_TTL_MS,
  reservationTerminalState,
  reservationTtlMs,
} from '../src/lib/inventoryRules.ts'

test('online checkout methods receive short-lived reservations', () => {
  for (const method of ['stripe', 'paypal', 'multicaixa_express']) {
    assert.equal(reservationTtlMs(method), ONLINE_PAYMENT_TTL_MS)
  }
  assert.equal(reservationTtlMs('mbway'), MANUAL_PAYMENT_TTL_MS)
})

test('paid reservations commit and failed or cancelled reservations release', () => {
  assert.equal(reservationTerminalState('paid', 'processing'), 'committed')
  assert.equal(reservationTerminalState('failed', 'pending'), 'released')
  assert.equal(reservationTerminalState('pending', 'cancelled'), 'released')
  assert.equal(reservationTerminalState('pending', 'pending'), 'active')
})
