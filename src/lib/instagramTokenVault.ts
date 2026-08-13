import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

type PayloadClient = {
  find: (args: Record<string, unknown>) => Promise<{ docs: any[] }>
  create: (args: Record<string, unknown>) => Promise<any>
  update: (args: Record<string, unknown>) => Promise<any>
}

const COLLECTION = 'instagram-token-vault'
const REFRESH_AFTER_MS = 30 * 24 * 60 * 60 * 1000
const ASSUMED_INITIAL_TTL_MS = 60 * 24 * 60 * 60 * 1000

function encryptionKey(): Buffer | null {
  const secret = process.env.INSTAGRAM_TOKEN_ENCRYPTION_KEY?.trim()
  if (!secret) return null
  // Accept a random secret of any practical representation while deriving a
  // fixed 256-bit AES key. The original secret never enters the database.
  return createHash('sha256').update(secret).digest()
}

export function encryptInstagramToken(token: string, key = encryptionKey()): string {
  if (!key) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY is missing')
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.')
}

export function decryptInstagramToken(value: string, key = encryptionKey()): string {
  if (!key) throw new Error('INSTAGRAM_TOKEN_ENCRYPTION_KEY is missing')
  const [version, iv, tag, encrypted] = value.split('.')
  if (version !== 'v1' || !iv || !tag || !encrypted) throw new Error('Invalid Instagram token ciphertext')
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64url')), decipher.final()]).toString('utf8')
}

async function currentVault(payload: PayloadClient): Promise<any | null> {
  const result = await payload.find({ collection: COLLECTION, limit: 1, sort: '-updatedAt', depth: 0, overrideAccess: true })
  return result.docs[0] ?? null
}

/**
 * Reads the encrypted DB token, bootstrapping it once from the existing
 * Railway variable during rollout. If encryption has not been configured
 * yet, the environment token remains a safe compatibility fallback.
 */
export async function getInstagramAccessToken(payload?: PayloadClient): Promise<string | null> {
  const fallback = process.env.INSTAGRAM_ACCESS_TOKEN?.trim() || null
  if (!payload || !encryptionKey()) return fallback
  const vault = await currentVault(payload)
  if (vault?.ciphertext) return decryptInstagramToken(String(vault.ciphertext))
  if (!fallback) return null
  const now = new Date()
  await payload.create({
    collection: COLLECTION,
    overrideAccess: true,
    data: {
      ciphertext: encryptInstagramToken(fallback),
      expiresAt: new Date(now.getTime() + ASSUMED_INITIAL_TTL_MS).toISOString(),
      lastRefreshedAt: now.toISOString(),
      lastError: null,
    },
  })
  return fallback
}

export type InstagramTokenRefreshResult = {
  ok: boolean
  action: 'refreshed' | 'not_due' | 'unconfigured' | 'failed'
  expiresAt?: string
  daysRemaining?: number
  error?: string
  alertRequired?: boolean
  alertThreshold?: number
}

export async function refreshInstagramAccessToken(
  payload: PayloadClient,
  options: { force?: boolean; fetchImpl?: typeof fetch; now?: Date } = {},
): Promise<InstagramTokenRefreshResult> {
  const now = options.now ?? new Date()
  const fetchImpl = options.fetchImpl ?? fetch
  const token = await getInstagramAccessToken(payload)
  if (!token || !encryptionKey()) return { ok: false, action: 'unconfigured', error: 'Token vault is not configured' }
  const vault = await currentVault(payload)
  if (!vault) return { ok: false, action: 'unconfigured', error: 'Token vault is empty' }

  const lastRefresh = new Date(vault.lastRefreshedAt ?? vault.createdAt).getTime()
  const expiresAt = new Date(vault.expiresAt).getTime()
  const daysRemaining = Math.max(0, Math.ceil((expiresAt - now.getTime()) / 86_400_000))
  if (!options.force && now.getTime() - lastRefresh < REFRESH_AFTER_MS && daysRemaining > 14) {
    return { ok: true, action: 'not_due', expiresAt: new Date(expiresAt).toISOString(), daysRemaining }
  }

  const attemptedAt = now.toISOString()
  try {
    const params = new URLSearchParams({ grant_type: 'ig_refresh_token', access_token: token })
    const response = await fetchImpl(`https://graph.instagram.com/refresh_access_token?${params}`)
    if (!response.ok) throw new Error(`Meta refresh failed (${response.status})`)
    const refreshed = await response.json() as { access_token?: string; expires_in?: number }
    if (!refreshed.access_token || !refreshed.expires_in) throw new Error('Meta refresh response was incomplete')

    // Validate before promotion: a refresh response alone is not enough to
    // replace the working credential.
    const validation = await fetchImpl('https://graph.instagram.com/v26.0/me?fields=id,username', {
      headers: { Authorization: `Bearer ${refreshed.access_token}` },
    })
    if (!validation.ok) throw new Error(`Refreshed token validation failed (${validation.status})`)

    const nextExpiry = new Date(now.getTime() + refreshed.expires_in * 1000).toISOString()
    await payload.update({
      collection: COLLECTION,
      id: vault.id,
      overrideAccess: true,
      data: {
        ciphertext: encryptInstagramToken(refreshed.access_token),
        expiresAt: nextExpiry,
        lastRefreshedAt: attemptedAt,
        lastAttemptAt: attemptedAt,
        lastError: null,
        lastAlertThreshold: null,
      },
    })
    return { ok: true, action: 'refreshed', expiresAt: nextExpiry, daysRemaining: Math.ceil(refreshed.expires_in / 86_400) }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown refresh error'
    const threshold = daysRemaining <= 1 ? 1 : daysRemaining <= 3 ? 3 : daysRemaining <= 7 ? 7 : daysRemaining <= 14 ? 14 : 30
    const alertRequired = Number(vault.lastAlertThreshold ?? 0) !== threshold
    await payload.update({ collection: COLLECTION, id: vault.id, overrideAccess: true, data: {
      lastAttemptAt: attemptedAt,
      lastError: message,
      ...(alertRequired ? { lastAlertAt: attemptedAt, lastAlertThreshold: threshold } : {}),
    } })
    return { ok: false, action: 'failed', expiresAt: vault.expiresAt, daysRemaining, error: message, alertRequired, alertThreshold: threshold }
  }
}
