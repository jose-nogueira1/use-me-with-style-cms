export type BannerMarket = 'AO' | 'PT'
export type BannerItem = { id: 'delivery' | 'coupon'; pt: string; en: string }

// The storefront announcement bar shows at most two things: the free-delivery
// message (always on unless switched off) and one promoted discount code. These
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

export type DeliveryBannerConfig = { enabled?: boolean | null; textPt?: string | null; textEn?: string | null }

// Free-delivery message. Admin-edited text wins per language; otherwise it is
// built from the market's free-delivery threshold so it can't drift from the
// real rule.
export function deliveryBannerItem(market: BannerMarket, threshold: number | null | undefined, config: DeliveryBannerConfig): BannerItem | null {
  if (config.enabled === false) return null
  const over = (lang: 'pt' | 'en') =>
    threshold && threshold > 0
      ? lang === 'pt' ? `Entrega grátis acima de ${money(threshold, market, 'pt')}` : `Free delivery over ${money(threshold, market, 'en')}`
      : lang === 'pt' ? 'Entrega grátis' : 'Free delivery'
  return { id: 'delivery', pt: clean(config.textPt) ?? over('pt'), en: clean(config.textEn) ?? over('en') }
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
