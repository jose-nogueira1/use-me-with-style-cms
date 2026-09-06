import { getPayload } from 'payload'
import config from '../src/payload.config'

async function main() {
  const payload = await getPayload({ config })
  const market = await payload.findGlobal({ slug: 'market-settings', depth: 0 })
  const pt = String(market.angolaReturnsPolicyTextPT ?? '')
  const en = String(market.angolaReturnsPolicyTextEN ?? '')
  const nextPt = pt.replace(
    'Os pedidos de troca devem ser comunicados no prazo máximo de 48 horas após a receção da encomenda.',
    'Os pedidos de troca devem ser comunicados no prazo máximo de 14 dias após a receção da encomenda.',
  )
  const nextEn = en.replace(
    'Exchange requests must be made within a maximum of 48 hours of receiving the order.',
    'Exchange requests must be made within a maximum of 14 days of receiving the order.',
  )
  if (nextPt === pt || nextEn === en) throw new Error('Expected current 48-hour market-policy sentences were not found exactly')
  await payload.updateGlobal({
    slug: 'market-settings',
    overrideAccess: true,
    data: { angolaReturnsPolicyTextPT: nextPt, angolaReturnsPolicyTextEN: nextEn },
  })

  const content = await payload.findGlobal({ slug: 'storefront-content', depth: 0 })
  const faqEntries = Array.isArray(content.faqEntries) ? content.faqEntries : []
  let ptChanged = 0
  let enChanged = 0
  const nextFaqEntries = faqEntries.map((entry: any) => {
    const answerPT = String(entry.answerPT ?? '')
    const answerEN = String(entry.answerEN ?? '')
    const replacedPT = answerPT.replace('prazo máximo de 48 horas', 'prazo máximo de 14 dias')
    const replacedEN = answerEN.replace('within 48 hours', 'within 14 days')
    if (replacedPT !== answerPT) ptChanged += 1
    if (replacedEN !== answerEN) enChanged += 1
    return { ...entry, answerPT: replacedPT, answerEN: replacedEN }
  })
  if (ptChanged !== 1 || enChanged !== 1) throw new Error(`Expected one PT and one EN FAQ replacement; got PT=${ptChanged} EN=${enChanged}`)
  await payload.updateGlobal({ slug: 'storefront-content', overrideAccess: true, data: { faqEntries: nextFaqEntries } })
  console.log(JSON.stringify({ marketPolicyUpdated: true, faqPTUpdated: ptChanged, faqENUpdated: enChanged }))
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
