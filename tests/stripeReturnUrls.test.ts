import assert from 'node:assert/strict'
import test from 'node:test'
import { stripeReturnSiteUrl } from '../src/lib/payments/stripe.ts'

test('Stripe returns to the Portugal market instead of the geo-routed apex', () => {
  const previousPublic = process.env.PUBLIC_SITE_URL
  const previousPortugal = process.env.PORTUGAL_SITE_URL
  delete process.env.PORTUGAL_SITE_URL
  process.env.PUBLIC_SITE_URL = 'https://usemewithstyle.shop/'

  assert.equal(stripeReturnSiteUrl(), 'https://pt.usemewithstyle.shop')

  if (previousPublic === undefined) delete process.env.PUBLIC_SITE_URL
  else process.env.PUBLIC_SITE_URL = previousPublic
  if (previousPortugal === undefined) delete process.env.PORTUGAL_SITE_URL
  else process.env.PORTUGAL_SITE_URL = previousPortugal
})

test('an explicit Portugal storefront URL takes precedence', () => {
  const previous = process.env.PORTUGAL_SITE_URL
  process.env.PORTUGAL_SITE_URL = 'https://pt.example.test/'
  assert.equal(stripeReturnSiteUrl(), 'https://pt.example.test')
  if (previous === undefined) delete process.env.PORTUGAL_SITE_URL
  else process.env.PORTUGAL_SITE_URL = previous
})
