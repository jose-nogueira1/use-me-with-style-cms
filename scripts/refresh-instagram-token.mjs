const baseUrl = (process.env.CMS_URL || 'http://localhost:3000').replace(/\/$/, '')
const secret = process.env.CRON_SECRET
if (!secret) throw new Error('CRON_SECRET is required')

const response = await fetch(`${baseUrl}/api/cron/refresh-instagram-token`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${secret}` },
})
const body = await response.text()
if (!response.ok) throw new Error(`Instagram token refresh failed (${response.status}): ${body}`)
console.log(body)
