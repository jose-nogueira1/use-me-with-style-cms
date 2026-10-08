export type BannerMarket = 'AO' | 'PT'
export type BannerItem = { id: 'message' | 'coupon'; pt: string; en: string }

// The storefront announcement bar shows at most two things: the admin's own
// message (when switched on) and one promoted discount code. These
// helpers turn admin data into the bilingual texts; the endpoint just wires
// them to the database.

const clean = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined

function money(value: number, market: BannerMarket, lang: 'pt' | 'en'): string {
  const digits = Number.isInteger(value) ? 0 : 2
  const format = (locale: string) => new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: 2 }).format(value)
  if (market === 'AO') return `${format(lang === 'pt' ? 'pt-BR' : 'en-US')} Kz`
  return lang === 'pt' ? `${format('pt-PT')} €` : `€${format('en-US')}`
}

export type MessageBannerConfig = { enabled?: boolean | null; textPt?: string | null; textEn?: string | null }

// The admin's own message (free delivery, a sale, opening hours, anything). Off
// unless switched on; shows nothing while both texts are blank. If only one
// language is filled in, it is used for both rather than leaving a gap.
export function messageBannerItem(config: MessageBannerConfig): BannerItem | null {
  if (config.enabled !== true) return null
  const pt = clean(config.textPt)
  const en = clean(config.textEn)
  if (!pt && !en) return null
  return { id: 'message', pt: (pt ?? en)!, en: (en ?? pt)! }
}

export type BannerCoupon = {
  code: string
  type: 'percent' | 'fixed' | 'free_shipping'
  active?: boolean | null
  percentOff?: number | null
  fixedOffAOKz?: number | null
  fixedOffPTEur?: number | null
  startDate?: string | null
  endDate?: string | null
  usageLimit?: number | null
  usageCount?: number | null
  availableAO?: boolean | null
  availablePT?: boolean | null
  bannerTextPt?: string | null
  bannerTextEn?: string | null
}

// The promoted code, or null when it can't currently be used in this market (so
// the bar never advertises a code the checkout would refuse).
export function couponBannerItem(coupon: BannerCoupon, market: BannerMarket, now = new Date()): BannerItem | null {
  if (coupon.active === false) return null
  if ((market === 'AO' ? coupon.availableAO : coupon.availablePT) === false) return null
  if (coupon.startDate && new Date(coupon.startDate) > now) return null
  if (coupon.endDate && new Date(coupon.endDate) < now) return null
  if (coupon.usageLimit && (coupon.usageCount ?? 0) >= coupon.usageLimit) return null

  const { code } = coupon
  let pt: string
  let en: string
  if (coupon.type === 'free_shipping') {
    pt = `Use o código ${code} para entrega grátis`
    en = `Use code ${code} for free delivery`
  } else if (coupon.type === 'percent') {
    if (!coupon.percentOff) return null
    pt = `Use o código ${code} e ganhe ${coupon.percentOff}% de desconto`
    en = `Use code ${code} for ${coupon.percentOff}% off`
  } else {
    const amount = market === 'AO' ? coupon.fixedOffAOKz : coupon.fixedOffPTEur
    if (!amount) return null
    pt = `Use o código ${code} e ganhe ${money(amount, market, 'pt')} de desconto`
    en = `Use code ${code} for ${money(amount, market, 'en')} off`
  }
  return { id: 'coupon', pt: clean(coupon.bannerTextPt) ?? pt, en: clean(coupon.bannerTextEn) ?? en }
}
