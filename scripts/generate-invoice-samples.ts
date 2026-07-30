import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import {
  calculateIncludedVatInvoice,
  renderInvoicePdf,
  type InternalInvoiceSettings,
  type OrderForInternalInvoice,
} from '../src/lib/internalInvoice'

const outputDir = resolve('output/pdf')
await mkdir(outputDir, { recursive: true })

const disclaimer = {
  pt: 'EXEMPLO PARA APROVAÇÃO — documento comercial interno, não certificado fiscalmente. Dados fiscais e bancários pendentes devem ser preenchidos e validados antes do lançamento.',
  en: 'REVIEW SAMPLE — internal commercial document, not fiscally certified. Pending fiscal and bank details must be completed and validated before launch.',
}

const samples: Array<{
  filename: string
  invoiceNumber: string
  lang: 'pt' | 'en'
  order: OrderForInternalInvoice
  settings: InternalInvoiceSettings
}> = [
  {
    filename: 'Internal_Invoice_Sample_AO.pdf',
    invoiceNumber: 'EXEMPLO-UMWS-AO-2026-00001',
    lang: 'pt',
    order: {
      id: 0, orderNumber: 'AO-EXEMPLO', market: 'AO', lang: 'pt',
      customerName: 'Cliente de Exemplo', customerEmail: 'cliente@example.com', customerPhone: '+244 900 000 000',
      customerTaxId: 'NIF DO CLIENTE', customerAddress: 'Ingombota, Luanda, Angola', currency: 'Kz',
      subtotal: 65000, shippingCost: 3500, total: 68500, paymentMethod: 'AppyPay', paymentReference: 'REF-EXEMPLO-AO',
      items: [{ productName: 'Vestido de Exemplo', size: 'M', color: 'Preto', qty: 1, unitPrice: 65000 }],
    },
    settings: {
      enabled: true,
      issuerName: 'Prime Essencial - Comércio e Prestação de Serviços, LDA',
      issuerTaxId: 'NIF 5002772817',
      issuerAddress: 'Rua do Timor - Bairro Kinaxixi, N.º 17, Município de Ingombota, Província de Luanda',
      bankName: '[PREENCHER NO ADMIN]', accountHolder: '[PREENCHER NO ADMIN]',
      bankAccount: '[PREENCHER NO ADMIN]', swiftBic: '[PREENCHER NO ADMIN]',
      paymentInstructions: 'Dados bancários definitivos pendentes de confirmação pela administração.',
      vatRate: 0, taxNote: 'Taxa de imposto / fundamento de isenção pendente de validação pelo contabilista.',
      prefix: 'UMWS-AO', disclaimer: disclaimer.pt,
    },
  },
  {
    filename: 'Internal_Invoice_Sample_PT.pdf',
    invoiceNumber: 'SAMPLE-UMWS-PT-2026-00001',
    lang: 'en',
    order: {
      id: 0, orderNumber: 'PT-SAMPLE', market: 'PT', lang: 'en',
      customerName: 'Sample Customer', customerEmail: 'customer@ex.pt', customerPhone: '+351 900 000 000',
      customerTaxId: 'CUSTOMER NIF', customerAddress: '1000-001 Lisboa, Portugal', currency: 'EUR',
      subtotal: 82, shippingCost: 0, discountAmount: 8.2, discountLabel: 'WELCOME10 (10% off)', total: 73.8,
      paymentMethod: 'Stripe', paymentReference: 'REF-PT-001',
      items: [{ productName: 'Sample Top', size: 'S', color: 'Gold', qty: 2, unitPrice: 41 }],
    },
    settings: {
      enabled: true,
      issuerName: 'USE ME WITH STYLE — PT ENTITY PENDING',
      issuerTaxId: 'NIF TO BE CONFIRMED', issuerAddress: 'REGISTERED ADDRESS TO BE CONFIRMED',
      bankName: '[COMPLETE IN ADMIN]', accountHolder: '[COMPLETE IN ADMIN]',
      bankAccount: '[COMPLETE IN ADMIN]', swiftBic: '[COMPLETE IN ADMIN]',
      paymentInstructions: 'Final bank and payment information awaits administrative approval.',
      vatRate: 0, taxNote: 'VAT rate / exemption basis awaits validation by the Portuguese accountant.',
      prefix: 'UMWS-PT', disclaimer: disclaimer.en,
    },
  },
]

for (const sample of samples) {
  const calculation = calculateIncludedVatInvoice(sample.order, sample.settings.vatRate, sample.lang)
  const pdf = await renderInvoicePdf({
    invoiceNumber: sample.invoiceNumber,
    issuedAt: new Date('2026-07-30T10:00:00.000Z'),
    order: sample.order,
    settings: sample.settings,
    calculation,
    lang: sample.lang,
  })
  await writeFile(resolve(outputDir, sample.filename), pdf)
}
