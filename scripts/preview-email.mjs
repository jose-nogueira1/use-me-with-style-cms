import { buildOrderConfirmationEmail } from '../src/lib/email.ts'

const base = {
  to: 'jose.nogueira.working@gmail.com',
  orderNumber: 'PT-261787',
  customerName: 'Jay-P Test',
  total: 24,
  currency: 'EUR',
}

for (const lang of ['pt', 'en']) {
  const { subject, html } = buildOrderConfirmationEmail({ ...base, lang })
  console.log('=====LANG:' + lang + '=====')
  console.log('SUBJECT:' + subject)
  console.log('HTML_START')
  console.log(html)
  console.log('HTML_END')
}
