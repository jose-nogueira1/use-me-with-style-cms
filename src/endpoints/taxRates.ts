import type { Endpoint } from 'payload'

// Public, read-only VAT rates for the storefront checkout (2026-08-04) --
// added so Checkout.tsx can show a "VAT (X%) included" line using the same
// rates the invoice PDF later uses (see calculateIncludedVatInvoice in
// lib/internalInvoice.ts). InvoiceSettings itself stays admin-only (it also
// holds bank IBAN, issuer tax ID, etc.) -- this endpoint reads it
// server-side with overrideAccess and returns nothing but the four
// percentages, so the public storefront never needs read access to the
// global itself.
export const taxRatesEndpoint: Endpoint = {
  path: '/tax-rates',
  method: 'get',
  handler: async (req) => {
    const settings = (await req.payload.findGlobal({
      slug: 'invoice-settings',
      depth: 0,
      overrideAccess: true,
    })) as {
      vatRateAO?: number | null
      vatRatePortugalMainland?: number | null
      vatRatePortugalMadeira?: number | null
      vatRatePortugalAzores?: number | null
    }

    const rate = (value: number | null | undefined, fallback: number) =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback

    return Response.json({
      AO: rate(settings.vatRateAO, 14),
      PT: {
        mainland: rate(settings.vatRatePortugalMainland, 23),
        madeira: rate(settings.vatRatePortugalMadeira, 22),
        azores: rate(settings.vatRatePortugalAzores, 16),
      },
    })
  },
}
