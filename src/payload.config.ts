import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Orders } from './collections/Orders'
import { Customers } from './collections/Customers'
import { Messages } from './collections/Messages'
import { MarketSettings } from './globals/MarketSettings'
import { messagingWebhookEndpoints } from './endpoints/messagingWebhook'
import { paymentsEndpoints } from './endpoints/payments'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')

// Per the JOS-20 architecture decision: Postgres (Railway) in staging and
// production. Locally, developers shouldn't need Docker/a Postgres install
// just to run this service, so a `file:./...` DATABASE_URL transparently
// uses SQLite instead -- same collections, same API shape either way.
// prodMigrations wires up the checked-in src/migrations so production boots
// apply any pending ones automatically (payload tracks applied migrations by
// name in the `payload-migrations` collection, so this is a no-op once a
// migration has already run) -- no need to SSH in and run `payload migrate`
// by hand on every deploy.
const db = isPostgres
  ? postgresAdapter({ pool: { connectionString: databaseUrl }, prodMigrations: migrations })
  : sqliteAdapter({ client: { url: databaseUrl } })

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

// Media storage: local disk by default (zero setup for local dev, no cloud
// account needed), swapping transparently to S3-compatible object storage
// (AWS S3, Cloudflare R2, Backblaze B2, DigitalOcean Spaces, etc.) once
// S3_BUCKET is set -- same "env decides, no code change" pattern as the
// Postgres/SQLite switch above. Media.ts's own `upload.staticDir` config is
// unaffected either way; this plugin only changes WHERE files end up.
const s3Bucket = process.env.S3_BUCKET
const plugins = s3Bucket
  ? [
      s3Storage({
        collections: {
          media: { disableLocalStorage: true },
        },
        bucket: s3Bucket,
        config: {
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
          },
          region: process.env.S3_REGION || 'auto',
          // Only S3-compatible providers (R2, B2, Spaces) need an explicit
          // endpoint + path-style URLs -- real AWS S3 leaves both unset.
          ...(process.env.S3_ENDPOINT
            ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
            : {}),
        },
      }),
    ]
  : []

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Products, Orders, Customers, Messages],
  globals: [MarketSettings],
  endpoints: [...messagingWebhookEndpoints, ...paymentsEndpoints],
  editor: lexicalEditor(),
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  sharp,
  // The SPA (dev on Vite, staging/production on Vercel) calls this API
  // cross-origin, so it needs to be explicitly allow-listed.
  cors: corsOrigins,
  csrf: corsOrigins,
})
