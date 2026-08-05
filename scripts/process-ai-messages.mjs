const base = process.env.CMS_URL || process.env.PAYLOAD_PUBLIC_SERVER_URL || 'https://cms.usemewithstyle.shop'
const secret = process.env.CRON_SECRET
if (!secret) throw new Error('CRON_SECRET is required')
const response = await fetch(`${base.replace(/\/$/, '')}/api/ai/process`, { method: 'POST', headers: { authorization: `Bearer ${secret}` } })
const body = await response.text()
if (!response.ok) throw new Error(`AI worker failed (${response.status}): ${body.slice(0, 500)}`)
console.log(body)
