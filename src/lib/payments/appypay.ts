type AppyPayStatus = 'Requested' | 'Pending' | 'Success' | 'Failed'

export type AppyPayCharge = {
  id: string
  merchantTransactionId: string
  amount: number
  currency: string
  status: AppyPayStatus
  paymentMethod?: string
  reference?: {
    referenceNumber?: string
    entity?: string
    dueDate?: string
  } | null
  transactionEvents?: Array<{
    responseStatus?: {
      successful?: boolean
      status?: AppyPayStatus
      code?: number
      message?: string
      source?: string
    }
  }>
}

type TokenResponse = {
  access_token: string
  expires_in?: string | number
}

let cachedToken: { value: string; expiresAt: number } | null = null

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required for AppyPay verification`)
  return value
}

export function isAppyPayServerConfigured(): boolean {
  return Boolean(
    process.env.APPY_PAY_CLIENT_ID &&
      process.env.APPY_PAY_CLIENT_SECRET &&
      process.env.APPY_PAY_OAUTH_RESOURCE &&
      process.env.APPY_PAY_OAUTH_TOKEN_URL &&
      process.env.APPY_PAY_API_BASE_URL,
  )
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: requiredEnv('APPY_PAY_CLIENT_ID'),
    client_secret: requiredEnv('APPY_PAY_CLIENT_SECRET'),
    resource: requiredEnv('APPY_PAY_OAUTH_RESOURCE'),
  })
  const response = await fetch(requiredEnv('APPY_PAY_OAUTH_TOKEN_URL'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`AppyPay token request failed (${response.status})`)
  }

  const token = (await response.json()) as TokenResponse
  if (!token.access_token) throw new Error('AppyPay token response did not include access_token')
  const expiresInSeconds = Number(token.expires_in ?? 3600)
  cachedToken = {
    value: token.access_token,
    expiresAt: Date.now() + (Number.isFinite(expiresInSeconds) ? expiresInSeconds : 3600) * 1000,
  }
  return cachedToken.value
}

export async function getAppyPayCharge(
  transactionId: string,
  merchantTransactionId: string,
): Promise<AppyPayCharge> {
  const token = await getAccessToken()
  const baseUrl = requiredEnv('APPY_PAY_API_BASE_URL').replace(/\/$/, '')
  const url = new URL(`${baseUrl}/charges/${encodeURIComponent(transactionId)}`)
  url.searchParams.set('merchantTransactionId', merchantTransactionId)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'pt-BR',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`AppyPay charge verification failed (${response.status})`)
  }

  const result = (await response.json()) as { payment?: AppyPayCharge }
  if (!result.payment) throw new Error('AppyPay charge response did not include payment')
  return result.payment
}

export function latestAppyPayResponse(charge: AppyPayCharge) {
  return charge.transactionEvents?.at(-1)?.responseStatus
}
