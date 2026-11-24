import { execFile } from 'node:child_process'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { promisify } from 'node:util'
import { createRemoteJWKSet, jwtVerify } from 'jose'

export const runtime = 'nodejs'
const issuer = 'https://token.actions.githubusercontent.com'
const keys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks'))
const workflow = 'usemewithstyle/use-me-with-style-cms/.github/workflows/database-backup.yml@refs/heads/main'
const headers = { 'Cache-Control': 'no-store' }
let running = false

export async function POST(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/)?.[1]
  if (!token) return new Response(null, { status: 401, headers })
  try {
    const { payload } = await jwtVerify(token, keys, {
      issuer, audience: 'useme-production-postgres-backup', algorithms: ['RS256'],
      requiredClaims: ['exp', 'iat', 'nbf'], maxTokenAge: '6 minutes',
    })
    if (payload.repository_id !== '1294229742' || payload.repository_owner_id !== '360419208' ||
        payload.workflow_ref !== workflow || payload.ref !== 'refs/heads/main' ||
        !['schedule', 'workflow_dispatch'].includes(String(payload.event_name)) ||
        payload.runner_environment !== 'github-hosted') {
      return new Response(null, { status: 403, headers })
    }
  } catch {
    return new Response(null, { status: 401, headers })
  }

  if (!process.env.BACKUP_ENCRYPTION_PASSPHRASE || !process.env.DATABASE_URL) {
    return new Response(null, { status: 503, headers })
  }
  if (running) return new Response(null, { status: 409, headers })
  running = true
  let dir: string | undefined
  try {
    dir = await mkdtemp(join(tmpdir(), 'useme-encrypted-backup-'))
    const file = join(dir, 'database.dump.enc')
    // Return only a fully written ciphertext file after both pg_dump and openssl exit successfully.
    await promisify(execFile)('bash', ['scripts/encrypted-database-backup.sh', file])
    const handle = await open(file, 'r')
    const size = (await handle.stat()).size
    const body = Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>
    return new Response(body, { headers: {
      ...headers, 'Content-Length': String(size), 'Content-Type': 'application/octet-stream',
    } })
  } catch {
    // Child-process errors can contain database connection details.
    console.error('encrypted_database_backup_failed')
    return new Response(null, { status: 500, headers })
  } finally {
    running = false
    // Linux keeps the open read stream valid after unlinking its directory entry.
    if (dir) await rm(dir, { recursive: true, force: true })
  }
}
