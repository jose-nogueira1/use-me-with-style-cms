// Local preview for the order-confirmation email (JOS-61 follow-up,
// 2026-08-04 editorial redesign) -- generates realistic PT and EN HTML
// samples on disk WITHOUT sending anything (no RESEND_API_KEY needed, no
// Payload/DB connection). Two different, realistic order shapes are used on
// purpose so the preview also exercises the template's graceful-omission
// paths (see lib/email.ts's buildOrderConfirmationEmail):
//   - AO/pt sample: multiple items (one long product name, one missing its
//     product image), a discount, an already-known CTT-style tracking code.
//   - PT/en sample: a single item, no discount, no tracking code yet (the
//     normal shape for a fresh payment confirmation), a PT postal address.
//
// Run with: npx tsx scripts/preview-email.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { buildContactAutoReplyEmail, buildOrderConfirmationEmail } from '../src/lib/email.ts'

const outputDir = resolve('output/email-previews')
await mkdir(outputDir, { recursive: true })

const samples = [
  {
    filename: 'order-confirmation-pt-AO.html',
    label: 'PT copy / Angola order (Kz, discount, multiple items, one missing image)',
    input: {
      to: 'jose.nogueira.working@gmail.com',
      orderNumber: 'AO-261787',
      orderDate: '2026-08-04T15:32:00.000Z',
      customerName: 'Ana Sofia Coelho Martins',
      customerFirstName: 'Ana',
      lang: 'pt',
      currency: 'Kz',
      subtotal: 138000,
      discountAmount: 13800,
      discountLabel: 'SS26 (10% off)',
      shippingCost: 3000,
      total: 127200,
      paymentMethod: 'multicaixa_express',
      deliveryMethod: 'courier_ao',
      address: {
        line1: 'Rua Amílcar Cabral, 245',
        line2: 'Prédio Girassol, 4º andar, Porta 12',
        city: 'Luanda',
        country: 'Angola',
      },
      items: [
        {
          productName: 'Vestido Longo Midi em Linho Estruturado com Cinto Removível',
          size: 'M',
          color: 'Preto',
          qty: 1,
          unitPrice: 68000,
          imageUrl: 'https://usemewithstyle.shop/brand/use-me-logo-black-transparent.png',
          imageAlt: 'Vestido Longo Midi em Linho Estruturado',
        },
        {
          productName: 'Top Cropped Canelado',
          size: 'S',
          color: 'Terracota',
          qty: 2,
          unitPrice: 35000,
          // Deliberately no imageUrl -- exercises the placeholder-swatch
          // fallback (renderItemRow in lib/email.ts) instead of a broken
          // <img>.
        },
      ],
      attachment: { filename: 'fatura.pdf', content: Buffer.from('stub') },
    },
  },
  {
    filename: 'order-confirmation-en-PT.html',
    label: 'EN copy / Portugal order (EUR, single item, no discount, no tracking yet)',
    input: {
      to: 'jose.nogueira.working@gmail.com',
      orderNumber: 'PT-118842',
      orderDate: new Date().toISOString(),
      customerName: 'Helena Marques',
      lang: 'en',
      currency: 'EUR',
      subtotal: 89,
      shippingCost: 4.9,
      total: 93.9,
      paymentMethod: 'stripe',
      deliveryMethod: 'courier_pt',
      address: {
        line1: 'Rua das Flores, 88',
        line2: '2º Esq.',
        postalCode: '1200-192',
        city: 'Lisboa',
        country: 'Portugal',
      },
      items: [
        {
          productName: 'Blazer Alfaiataria Oversized',
          size: 'L',
          color: 'Bege',
          qty: 1,
          unitPrice: 89,
          imageUrl: 'https://usemewithstyle.shop/brand/use-me-logo-black-transparent.png',
          imageAlt: 'Blazer Alfaiataria Oversized',
        },
      ],
      // No `attachment` -- exercises the invoice-note section being
      // omitted entirely rather than claiming a PDF is attached when it
      // isn't.
    },
  },
]

// Contact-form auto-reply (2026-08-06) -- one sample with an order number
// (the "I have a question about an existing order" case) and one without
// (a general enquiry), covering buildContactAutoReplyEmail's one optional
// section.
const contactSamples = [
  {
    filename: 'contact-autoreply-pt.html',
    label: 'PT copy / contact auto-reply, with an order number',
    input: {
      to: 'jose.nogueira.working@gmail.com',
      name: 'Beatriz Alves',
      lang: 'pt',
      orderNumber: 'PT-118842',
      message: 'Olá, a minha encomenda ainda não chegou e já passaram 10 dias. Podem verificar, por favor?',
    },
  },
  {
    filename: 'contact-autoreply-en.html',
    label: 'EN copy / contact auto-reply, general enquiry (no order number)',
    input: {
      to: 'jose.nogueira.working@gmail.com',
      name: 'Helena Marques',
      lang: 'en',
      message: 'Hi, do you ship to the Azores, and is delivery tracked?',
    },
  },
]

for (const sample of samples) {
  const { subject, html } = buildOrderConfirmationEmail(sample.input)
  const filePath = resolve(outputDir, sample.filename)
  await writeFile(filePath, html, 'utf8')
  console.log(`\n===== ${sample.label} =====`)
  console.log(`SUBJECT: ${subject}`)
  console.log(`WRITTEN: ${filePath}`)
}

for (const sample of contactSamples) {
  const { subject, html } = buildContactAutoReplyEmail(sample.input)
  const filePath = resolve(outputDir, sample.filename)
  await writeFile(filePath, html, 'utf8')
  console.log(`\n===== ${sample.label} =====`)
  console.log(`SUBJECT: ${subject}`)
  console.log(`WRITTEN: ${filePath}`)
}

console.log(`\nOpen the .html files above directly in a browser to review, or run scripts/screenshot-email-previews.mjs afterward for desktop/mobile screenshots.`)
