import type { Endpoint } from 'payload'
import { refreshInstagramAccessToken } from '../lib/instagramTokenVault'

export const instagramTokenRefreshEndpoint: Endpoint = {
  path: '/cron/refresh-instagram-token',
  method: 'post',
  handler: async (req) => {
    const secret = process.env.CRON_SECRET
    if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
      return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
    }
    const result = await refreshInstagramAccessToken(req.payload as any)
    if (!result.ok) {
      req.payload.logger.error({ action: result.action, daysRemaining: result.daysRemaining, error: result.error }, '[instagram:token-refresh-failed]')
      if (result.alertRequired && process.env.RESEND_API_KEY) {
        await req.payload.sendEmail({
          to: process.env.SUPPORT_EMAIL || 'support@usemewithstyle.shop',
          subject: `Instagram token renewal needs attention (${result.daysRemaining ?? '?'} days remaining)`,
          html: `<p>The automatic Instagram token renewal failed.</p><p><strong>Days remaining:</strong> ${result.daysRemaining ?? 'unknown'}</p><p><strong>Error:</strong> ${result.error ?? 'unknown'}</p><p>Reconnect Instagram before the current token expires.</p>`,
          text: `The automatic Instagram token renewal failed. Days remaining: ${result.daysRemaining ?? 'unknown'}. Error: ${result.error ?? 'unknown'}. Reconnect Instagram before the current token expires.`,
        }).catch((error) => req.payload.logger.error({ error }, '[instagram:token-alert-email-failed]'))
      }
    }
    else req.payload.logger.info({ action: result.action, daysRemaining: result.daysRemaining, expiresAt: result.expiresAt }, '[instagram:token-refresh]')
    return Response.json(result, { status: result.ok ? 200 : 503 })
  },
}
