import path from 'path'
import { fileURLToPath } from 'url'

import { postgresAdapter } from '@payloadcms/db-postgres'
import { sqliteAdapter } from '@payloadcms/db-sqlite'
import { resendAdapter } from '@payloadcms/email-resend'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'
import { buildConfig } from 'payload'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { Products } from './collections/Products'
import { Categories } from './collections/Categories'
import { MerchTags } from './collections/MerchTags'
import { Colors } from './collections/Colors'
import { SizeGuides } from './collections/SizeGuides'
import { Orders } from './collections/Orders'
import { Customers } from './collections/Customers'
import { Messages } from './collections/Messages'
import { Invoices } from './collections/Invoices'
import { Coupons } from './collections/Coupons'
import { MarketSettings } from './globals/MarketSettings'
import { InvoiceSettings } from './globals/InvoiceSettings'
import { LegalContent } from './globals/LegalContent'
import { HomeHero } from './globals/HomeHero'
import { HomeCategories } from './globals/HomeCategories'
import { HomeCollections } from './globals/HomeCollections'
import { InstagramSpotlight } from './globals/InstagramSpotlight'
import { AiMessagingSettings } from './globals/AiMessagingSettings'
import { messagingWebhookEndpoints } from './endpoints/messagingWebhook'
import { paymentsEndpoints } from './endpoints/payments'
import { internalInvoiceEndpoints } from './endpoints/internalInvoices'
import { metaConversionEndpoints } from './endpoints/metaConversions'
import { orderLookupEndpoint } from './endpoints/orderLookup'
import { contactEndpoint } from './endpoints/contact'
import { inventoryReservationEndpoints } from './endpoints/inventoryReservations'
import { instagramFeedEndpoints } from './endpoints/instagramFeed'
import { couponsEndpoints } from './endpoints/coupons'
import { taxRatesEndpoint } from './endpoints/taxRates'
import { aiAssistantEndpoint, aiAssistantStatusEndpoint } from './endpoints/aiAssistant'
import { instagramProfileEndpoint } from './endpoints/instagramProfile'
import { robotsEndpoint, sitemapEndpoint } from './endpoints/seoFiles'
import { migrations } from './migrations'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db'
const isPostgres = databaseUrl.startsWith('postgres://') || databaseUrl.startsWith('postgresql://')

// Per the JOS-20 architecture decision: Postgres (Railway) in staging and
// production. Locally, developers shouldn't need Docker/a Postgres install
// just to run this service, so a `file:./...` DATABASE_URL transparently
// uses SQLite instead -- same collections, same API shape either way.
// prodMigrations wires up the checked-in src/migrations (payload tracks
// applied migrations by name in the `payload-migrations` collection, so
// re-running is a no-op once a migration has already applied).
//
// *** IMPORTANT, corrected 2026-07-27: prodMigrations does NOT run migrations
// automatically just by being present in this config on Railway's Railpack
// runtime -- confirmed live: 14 migrations checked in since 2026-07-25 never
// applied to production Postgres despite several successful deploys in
// between, causing "column ... does not exist" errors on every request that
// touched a newer collection. `payload migrate` must be explicitly invoked
// as part of boot -- see package.json's "start" script, which now runs it
// before `next start` on every container start. Do not remove that without
// confirming migrations are actually applying some other way first. ***
const db = isPostgres
  ? postgresAdapter({ pool: { connectionString: databaseUrl }, prodMigrations: migrations })
  : sqliteAdapter({
      client: { url: databaseUrl },
      transactionOptions: { behavior: 'immediate' },
      busyTimeout: 5_000,
      wal: true,
      // Payload's SQLite adapter defaults to auto-pushing schema changes on
      // every dev boot (`push: true`) -- convenient in isolation, but this
      // repo's actual practice (documented in every migration file's own
      // comments) is to hand-apply schema changes to dev.db with a Python
      // script alongside a checked-in migration for Postgres, the same as
      // every other collection/global change. Push doesn't know about those
      // manual edits and, on 2026-07-25, twice tried to blindly recreate
      // tables/indexes that already matched, crashing the admin panel with
      // "already exists" errors instead of just leaving a correct schema
      // alone. Disabling it makes dev.db behave the same way as
      // production Postgres: schema only changes via an explicit migration
      // (hand-applied here, prodMigrations there), never silently on boot.
      push: false,
    })

const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173')
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
// Keep the plugin in the config even when local/build-time env does not carry
// the production bucket. Payload's import-map generator only sees components
// contributed by configured plugins; making the whole plugin conditional
// produced a build whose authenticated Admin crashed in production once S3
// was enabled at runtime. `enabled` disables all storage behaviour locally
// while keeping the client component discoverable in the committed map.
const plugins = [
      s3Storage({
        enabled: Boolean(s3Bucket),
        collections: {
          media: { disableLocalStorage: true },
          invoices: { disableLocalStorage: true },
        },
        bucket: s3Bucket || 'disabled-local-storage',
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

// Order-confirmation email (JOS-61 follow-up), via Resend -- same "env
// decides, no code change" pattern as the S3/Postgres switches above. While
// RESEND_API_KEY is unset (local dev, or before the Resend account exists),
// no adapter is configured at all; lib/email.ts's sendOrderConfirmationEmail
// already logs-instead-of-throwing in that case, so this stays optional
// without special-casing Payload's own internal emails (password
// reset/verification use whatever adapter is configured here too).
const resendApiKey = process.env.RESEND_API_KEY
const email = resendApiKey
  ? resendAdapter({
      apiKey: resendApiKey,
      defaultFromAddress: process.env.RESEND_FROM_EMAIL || 'orders@usemewithstyle.shop',
      defaultFromName: process.env.RESEND_FROM_NAME || 'Use Me With Style',
    })
  : undefined

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
  },
  collections: [Users, Media, Products, Categories, MerchTags, Colors, SizeGuides, Orders, Customers, Messages, Invoices, Coupons],
  // home-content (2026-07-25..2026-08-04) was split into three independent
  // globals on 2026-08-04 -- HomeHero, HomeCategories, HomeCollections --
  // each with its own save + version history (admin feedback: a single
  // combined "Previous versions" list mixed all three sections together
  // with no way to tell what actually changed). The old home_content /
  // _home_content_v tables and their child tables are left in place,
  // unreferenced, same as every other superseded-but-not-dropped table in
  // this project (see products.tag_id's precedent) -- see
  // src/migrations/20260804_180000_home_content_split.ts for the data
  // migration that seeded the three new globals from them.
  globals: [MarketSettings, InvoiceSettings, LegalContent, HomeHero, HomeCategories, HomeCollections, InstagramSpotlight, AiMessagingSettings],
  endpoints: [
    orderLookupEndpoint,
    contactEndpoint,
    ...inventoryReservationEndpoints,
    ...messagingWebhookEndpoints,
    ...paymentsEndpoints,
    ...internalInvoiceEndpoints,
    ...metaConversionEndpoints,
    ...instagramFeedEndpoints,
    ...couponsEndpoints,
    taxRatesEndpoint,
    aiAssistantEndpoint,
    aiAssistantStatusEndpoint,
    instagramProfileEndpoint,
    sitemapEndpoint,
    robotsEndpoint,
  ],
  editor: lexicalEditor(),
  plugins,
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db,
  email,
  sharp,
  // The SPA (dev on Vite, staging/production on Vercel) calls this API
  // cross-origin, so it needs to be explicitly allow-listed.
  cors: corsOrigins,
  csrf: corsOrigins,
})
