import assert from 'node:assert/strict'
import test from 'node:test'

import { applyVerifiedAppyPayCharge, paymentsEndpoints } from '../src/endpoints/payments.ts'

const validOrder = {
  id: 42,
  orderNumber: 'AO-TEST42',
  market: 'AO',
  currency: 'Kz',
  paymentMethod: 'multicaixa_express',
  paymentStatus: 'pending',
  status: 'cancelled',
  total: 21500,
  appyPayMerchantTransactionId: 'UMTEST42',
  appyPayTransactionId: null,
  inventoryReservationStatus: 'released',
}

const successfulCharge = {
  id: 'charge-42',
  merchantTransactionId: 'UMTEST42',
  amount: 21500,
  currency: 'AOA',
  status: 'Success' as const,
  paymentMethod: 'REF',
  responses: [{ code: 0, message: 'Success' }],
}

test('late AppyPay success reopens only after stock is atomically re-reserved', async () => {
  const updates: Array<Record<string, unknown>> = []
  const req = {
    payload: {
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        return { ...validOrder, ...(args.data as object) }
      },
      logger: { error: () => {} },
    },
  }

  const result = await applyVerifiedAppyPayCharge(req as never, validOrder, successfulCharge)
  assert.equal(updates.length, 1)
  assert.deepEqual(updates[0].context, { lateVerifiedPayment: true })
  assert.equal(result.status, 'processing')
  assert.equal(result.paymentStatus, 'paid')
})

test('late AppyPay success stays cancelled and paid when stock cannot be re-reserved', async () => {
  const updates: Array<Record<string, unknown>> = []
  const logged: Array<Record<string, unknown>> = []
  const req = {
    payload: {
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        if (updates.length === 1) throw new Error('The requested quantity is no longer in stock.')
        return { ...validOrder, ...(args.data as object) }
      },
      logger: { error: (entry: Record<string, unknown>) => logged.push(entry) },
    },
  }

  const result = await applyVerifiedAppyPayCharge(req as never, validOrder, successfulCharge)
  assert.equal(updates.length, 2)
  assert.equal(result.status, 'cancelled')
  assert.equal(result.paymentStatus, 'paid')
  assert.equal(logged.length, 1)
})

test('public cancellation token cancels a pending AppyPay order and releases through the order hook', async () => {
  const previousSecret = process.env.PAYLOAD_SECRET
  process.env.PAYLOAD_SECRET = 'test-only-appypay-signing-secret'
  try {
    const createEndpoint = paymentsEndpoints.find((endpoint) => endpoint.path === '/payments/appypay/create-order')
    const cancelEndpoint = paymentsEndpoints.find((endpoint) => endpoint.path === '/payments/appypay/cancel-order')
    assert.ok(createEndpoint?.handler)
    assert.ok(cancelEndpoint?.handler)

    let storedOrder = {
      ...validOrder,
      status: 'new',
      appyPayMerchantTransactionId: '',
      inventoryReservationStatus: 'active',
      inventoryReservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
    const updates: Array<Record<string, unknown>> = []
    const payload = {
      create: async () => storedOrder,
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        storedOrder = { ...storedOrder, ...(args.data as object) }
        return storedOrder
      },
      find: async () => ({ docs: [storedOrder] }),
      logger: { error: () => {} },
    }
    const createResponse = await createEndpoint.handler({
      json: async () => ({
        market: 'AO', customerName: 'Test Buyer', customerPhone: '+244923000000', customerEmail: 'test@example.com',
        address: 'Rua Teste', addressLine2: '10', city: 'Luanda', country: 'Angola', items: [], currency: 'Kz',
        subtotal: 21500, shippingCost: 0, total: 21500, paymentMethod: 'multicaixa_express', deliveryMethod: 'courier_ao',
      }),
      payload,
    } as never)
    assert.equal(createResponse.status, 200)
    const created = await createResponse.json() as { merchantTransactionId: string; cancellationToken: string }
    assert.ok(created.cancellationToken.length > 30)

    const cancelResponse = await cancelEndpoint.handler({
      json: async () => created,
      headers: new Headers(),
      payload,
    } as never)
    assert.equal(cancelResponse.status, 200)
    assert.deepEqual(updates.at(-1)?.data, { status: 'cancelled', paymentStatus: 'failed' })
    assert.deepEqual(updates.at(-1)?.context, { inventoryReleaseReason: 'shopper_cancelled' })
  } finally {
    if (previousSecret === undefined) delete process.env.PAYLOAD_SECRET
    else process.env.PAYLOAD_SECRET = previousSecret
  }
})
