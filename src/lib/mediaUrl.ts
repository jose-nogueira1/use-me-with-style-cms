// Small helper shared by anything that needs to turn a Payload Media
// document's `url` into an ABSOLUTE URL suitable for contexts that can't
// resolve a relative path themselves -- email clients being the motivating
// case (JOS-61 follow-up, order-confirmation email redesign): an <img src>
// of "/api/media/file/foo.jpg" renders fine in a browser (relative to the
// page origin) but is simply broken in an email client, which has no origin
// to resolve it against.
//
// In production, media lives in S3-compatible object storage (Cloudflare R2,
// see payload.config.ts's s3Storage plugin) and @payloadcms/storage-s3
// already returns a fully-qualified URL in that case (`${endpoint}/${bucket}/
// ${fileKey}`, see node_modules/@payloadcms/storage-s3/dist/generateURL.js) --
// so this is a no-op for real deployments. It only matters for local dev
// (no S3_BUCKET set), where Media.url is the relative local-disk route.
export function absoluteMediaUrl(url?: string | null): string | undefined {
  if (!url) return undefined
  if (/^https?:\/\//i.test(url)) return url

  // Production media documents use Payload's relative static route. Email
  // clients have no page origin, so retain an explicit canonical fallback
  // even if PAYLOAD_PUBLIC_SERVER_URL was omitted from the deployment.
  const base = process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://cms.usemewithstyle.shop'

  try {
    return new URL(url, base).toString()
  } catch {
    return undefined
  }
}
