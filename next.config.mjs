import { withPayload } from '@payloadcms/next/withPayload'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The SPA storefront/admin lives in the sibling use-me-with-style-platform
  // repo and calls this service's REST/GraphQL API over HTTP (CORS enabled
  // below via payload.config.ts). This app only serves /admin and /api.
  reactStrictMode: true,
}

export default withPayload(nextConfig)
