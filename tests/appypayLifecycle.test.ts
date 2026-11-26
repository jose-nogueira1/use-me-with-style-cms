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

// applyVerifiedAppyPayCharge now locks the order row and re-fetches it via
// req.payload.findByID before deciding anything (2026-08-07, closing a
// concurrent-duplicate-webhook race) -- it needs req.payload.db.
// {begin,commit,rollback}Transaction to exist (Payload's own
// initTransaction/commitTransaction/killTransaction call them) and
// req.payload.findByID to exist. None of these tests set
// DATABASE_URL=postgres, so lockOrderRow's actual `FOR UPDATE` no-ops --
// only Postgres, in staging/production, can exercise the real row lock;
// these tests instead verify the surrounding logic (the idempotency
// decision itself, and the existing late-success/stock-conflict paths)
// still behaves correctly.
function fakeTransactionDb() {
  return {
    beginTransaction: async () => 'test-tx',
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
  }
}

test('late AppyPay success reopens only after stock is atomically re-reserved', async () => {
  const updates: Array<Record<string, unknown>> = []
  let state = { ...validOrder }
  const req = {
    payload: {
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        state = { ...state, ...(args.data as object) }
        return state
      },
      findByID: async () => state,
      logger: { error: () => {}, warn: () => {} },
      db: fakeTransactionDb(),
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
  let state = { ...validOrder }
  const req = {
    payload: {
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        if (updates.length === 1) throw new Error('The requested quantity is no longer in stock.')
        state = { ...state, ...(args.data as object) }
        return state
      },
      findByID: async () => state,
      logger: { error: (entry: Record<string, unknown>) => logged.push(entry), warn: () => {} },
      db: fakeTransactionDb(),
    },
  }

  const result = await applyVerifiedAppyPayCharge(req as never, validOrder, successfulCharge)
  assert.equal(updates.length, 2)
  assert.equal(result.status, 'cancelled')
  assert.equal(result.paymentStatus, 'paid')
  assert.equal(logged.length, 1)
})

test('a duplicate delivery that loses the race sees the already-paid state after the lock and does not re-apply the charge', async () => {
  // Simulates the real race this fix closes: two callers (a duplicate
  // webhook redelivery, or the webhook racing the admin's manual
  // /reconcile endpoint) each start with the SAME stale, not-yet-paid
  // snapshot of the order. The first to acquire the lock wins and commits;
  // this test represents the second caller reaching the lock+refetch step
  // AFTER that first commit has already landed -- its own stale `order`
  // argument (passed in before either caller's lock attempt) still says
  // 'pending', but the fresh read after the lock must win the decision.
  const paidState = {
    ...validOrder,
    paymentStatus: 'paid',
    appyPayTransactionId: successfulCharge.id,
    status: 'processing',
    inventoryReservationStatus: 'committed',
  }
  const updates: Array<Record<string, unknown>> = []
  const req = {
    payload: {
      update: async (args: Record<string, unknown>) => {
        updates.push(args)
        return { ...paidState, ...(args.data as object) }
      },
      findByID: async () => paidState,
      logger: { error: () => {}, warn: () => {} },
      db: fakeTransactionDb(),
    },
  }

  const staleOrderSnapshot = {
    ...validOrder,
    paymentStatus: 'pending',
    appyPayTransactionId: null,
    status: 'new',
    inventoryReservationStatus: 'active',
  }

  const result = await applyVerifiedAppyPayCharge(req as never, staleOrderSnapshot, successfulCharge)
  assert.equal(updates.length, 0, 'must not write again -- the fresh post-lock read already shows this charge applied')
  assert.equal(result.paymentStatus, 'paid')
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
        address: 'Rua Teste', addressLine2: '10', city: 'Talatona', country: 'Angola', items: [], currency: 'Kz',
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

test('signed AppyPay status lookup exposes the webhook payment result without changing the order', async () => {
  const previousSecret = process.env.PAYLOAD_SECRET
  process.env.PAYLOAD_SECRET = 'test-only-appypay-signing-secret'
  try {
    const createEndpoint = paymentsEndpoints.find((endpoint) => endpoint.path === '/payments/appypay/create-order')
    const statusEndpoint = paymentsEndpoints.find((endpoint) => endpoint.path === '/payments/appypay/status')
    assert.ok(createEndpoint?.handler)
    assert.ok(statusEndpoint?.handler)

    let storedOrder = {
      ...validOrder,
      status: 'new',
      paymentStatus: 'pending',
      appyPayStatus: 'Pending',
      appyPayMerchantTransactionId: '',
      inventoryReservationStatus: 'active',
      inventoryReservationExpiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }
    const payload = {
      create: async () => storedOrder,
      update: async (args: Record<string, unknown>) => {
        storedOrder = { ...storedOrder, ...(args.data as object) }
        return storedOrder
      },
      find: async () => ({ docs: [storedOrder] }),
      logger: { error: () => {} },
    }
    const createResponse = await createEndpoint.handler({
      json: async () => ({
        market: 'AO', customerName: 'Test Buyer', customerPhone: '+244923000000', customerEmail: 'test@example.com',
        address: 'Rua Teste', addressLine2: '10', city: 'Talatona', country: 'Angola', items: [], currency: 'Kz',
        subtotal: 21500, shippingCost: 0, total: 21500, paymentMethod: 'multicaixa_express', deliveryMethod: 'courier_ao',
      }),
      payload,
    } as never)
    const created = await createResponse.json() as { merchantTransactionId: string; cancellationToken: string }
    storedOrder = { ...storedOrder, status: 'processing', paymentStatus: 'paid', appyPayStatus: 'Success' }

    const statusResponse = await statusEndpoint.handler({
      json: async () => created,
      headers: new Headers(),
      payload,
    } as never)
    assert.equal(statusResponse.status, 200)
    assert.deepEqual(await statusResponse.json(), {
      orderNumber: 'AO-TEST42',
      status: 'processing',
      paymentStatus: 'paid',
      appyPayStatus: 'Success',
    })
  } finally {
    if (previousSecret === undefined) delete process.env.PAYLOAD_SECRET
    else process.env.PAYLOAD_SECRET = previousSecret
  }
})

test('a verified failure opens one new AppyPay attempt on the same order', async (t) => {
  const retry = paymentsEndpoints.find((endpoint) => endpoint.path === '/payments/appypay/retry-order')
  assert.ok(retry)
  const { appyPayRetryCredentials } = await import('../src/endpoints/payments.ts')
  const env = {
    ORDER_CANCELLATION_SECRET: 'retry-test-secret',
    APPY_PAY_CLIENT_ID: 'test-client',
    APPY_PAY_CLIENT_SECRET: 'test-secret',
    APPY_PAY_OAUTH_RESOURCE: 'test-resource',
    APPY_PAY_OAUTH_TOKEN_URL: 'https://appy.test/token',
    APPY_PAY_API_BASE_URL: 'https://appy.test',
  }
  const previousEnv = Object.fromEntries(Object.keys(env).map((key) => [key, process.env[key]]))
  Object.assign(process.env, env)
  t.after(() => {
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  const gatewayCharge = { ...successfulCharge, paymentMethod: 'GPO', status: 'Failed' }
  t.mock.method(globalThis, 'fetch', async (url: URL | string) => Response.json(
    String(url).endsWith('/token') ? { access_token: 'fixture', expires_in: 0 } : { payment: gatewayCharge },
  ))

  let order = {
    ...validOrder,
    status: 'payment_review',
    paymentStatus: 'failed',
    appyPayStatus: 'Failed',
    appyPayTransactionId: gatewayCharge.id,
    appyPayResponseCode: 211,
    appyPayVerifiedAt: new Date().toISOString(),
    appyPayAttempts: [] as Array<{ merchantTransactionId: string; responseCode: number }>,
    inventoryReservationExpiresAt: '',
  }
  const credentials = appyPayRetryCredentials(order as never)
  assert.ok(credentials)
  let writes = 0
  const handler = () => retry.handler({
    json: async () => credentials,
    payload: {
      db: fakeTransactionDb(),
      find: async () => ({ docs: [{ id: order.id }] }),
      findByID: async () => order,
      update: async ({ data, context }: { data: Partial<typeof order>; context: object }) => {
        writes += 1
        assert.deepEqual(context, { appyPayRetry: true })
        order = {
          ...order, ...data,
          inventoryReservationStatus: 'active',
          inventoryReservationExpiresAt: new Date(Date.now() + 60_000).toISOString(),
        }
        return order
      },
      logger: { error: () => {} },
    },
  } as never)

  const response = await handler()
  assert.equal(response.status, 200)
  const next = await response.json()
  assert.equal(next.orderNumber, validOrder.orderNumber)
  assert.equal(next.amount, validOrder.total)
  assert.notEqual(next.merchantTransactionId, credentials.merchantTransactionId)
  assert.equal(order.paymentStatus, 'pending')
  assert.equal(order.appyPayAttempts[0].responseCode, 211)
  assert.deepEqual(await (await handler()).json(), next)
  assert.equal(writes, 1)
})
