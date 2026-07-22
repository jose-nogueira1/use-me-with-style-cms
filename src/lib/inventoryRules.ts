export const ONLINE_PAYMENT_TTL_MS = 30 * 60 * 1000
export const MANUAL_PAYMENT_TTL_MS = 24 * 60 * 60 * 1000

export function reservationTtlMs(paymentMethod: string | undefined) {
  return paymentMethod === 'stripe' || paymentMethod === 'paypal' || paymentMethod === 'multicaixa_express'
    ? ONLINE_PAYMENT_TTL_MS
    : MANUAL_PAYMENT_TTL_MS
}

export function reservationTerminalState(paymentStatus: string, orderStatus: string) {
  if (paymentStatus === 'paid') return 'committed' as const
  if (paymentStatus === 'failed' || orderStatus === 'cancelled') return 'released' as const
  return 'active' as const
}
