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

const settings: InternalInvoiceSettings = {
  enabled: true,
  issuerName: 'Prime Essencial - Comercio e Prestacao de Servicos, LDA',
  issuerTaxId: '5002772817',
  issuerAddress: 'Rua do Timor - Bairro Kinaxixi, N. 17, Ingombota, Luanda',
  vatRate: 14,
  taxNote: 'Precos de produtos incluem IVA. Portes de envio isentos de IVA.',
  prefix: 'UMWS-AO',
  disclaimer: 'AMOSTRA PARA REVISAO - documento comercial interno, nao certificado fiscalmente.',
}

const commonOrder: Omit<OrderForInternalInvoice, 'orderNumber' | 'subtotal' | 'total' | 'items'> = {
  id: 0,
  market: 'AO',
  lang: 'pt',
  customerName: 'Cliente de Exemplo',
  customerEmail: 'cliente@example.com',
  customerPhone: '+244 900 000 000',
  customerAddress: 'Ingombota, Luanda, Angola',
  currency: 'Kz',
  shippingCost: 2500,
  paymentMethod: 'manual_whatsapp',
}

const samples: Array<{ filename: string; invoiceNumber: string; order: OrderForInternalInvoice }> = [
  {
    filename: 'Invoice_Sample_20_Percent_Coupon.pdf',
    invoiceNumber: 'SAMPLE-AO-COUPON-20',
    order: {
      ...commonOrder,
      orderNumber: 'AO-COUPON20',
      subtotal: 15000,
      discountAmount: 3000,
      discountLabel: 'CUPAO20 (20%)',
      total: 14500,
      items: [{ productName: 'Mochila desportiva compacta', color: 'Preto', qty: 1, unitPrice: 15000 }],
    },
  },
  {
    filename: 'Invoice_Sample_Product_On_Sale.pdf',
    invoiceNumber: 'SAMPLE-AO-SALE-PRICE',
    order: {
      ...commonOrder,
      orderNumber: 'AO-SALEPRICE',
      subtotal: 12000,
      total: 14500,
      items: [{ productName: 'Mochila desportiva compacta', color: 'Preto', qty: 1, unitPrice: 12000 }],
    },
  },
]

for (const sample of samples) {
  const calculation = calculateIncludedVatInvoice(sample.order, settings.vatRate, 'pt')
  const pdf = await renderInvoicePdf({
    invoiceNumber: sample.invoiceNumber,
    issuedAt: new Date('2026-08-12T22:30:00.000Z'),
    order: sample.order,
    settings,
    calculation,
    lang: 'pt',
  })
  await writeFile(resolve(outputDir, sample.filename), pdf)
}
