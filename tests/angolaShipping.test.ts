import assert from 'node:assert/strict'
import test from 'node:test'

import {
  ANGOLA_DELIVERY_ZONES,
  angolaShippingCost,
  angolaZoneOf,
  angolaZonePrice,
  canonicalAngolaNeighbourhood,
  normalizeAngolaShipping,
} from '../src/lib/angolaShipping.ts'
import { applyAuthoritativeOrderValues } from '../src/lib/authoritativeOrder.ts'

test('every Zygo neighbourhood belongs to exactly one zone, with the agreed default prices', () => {
  const all = Object.values(ANGOLA_DELIVERY_ZONES).flat()
  assert.equal(all.length, 21)
  assert.equal(new Set(all).size, 21)
  const zones = Object.fromEntries(Object.entries(ANGOLA_DELIVERY_ZONES).map(([zone, names]) => [zone, names.length]))
  assert.deepEqual(zones, { centro: 6, sul: 5, norte: 5, periferia: 5 })
  for (const name of ['Ingombotas', 'Maianga', 'Alvalade', 'Maculusso', 'Mutamba', 'Cassenda', 'Talatona', 'Patriota', 'Belas', 'Camama', 'Benfica', 'Vila Alice', 'Sambizanga', 'Rangel', 'Cazenga']) {
    assert.equal(angolaZonePrice(name), 3500, name)
  }
  for (const name of ['Viana', 'Kilamba', 'Zango', 'Cacuaco', 'Funda']) assert.equal(angolaZonePrice(name), 5500, name)
  assert.equal(angolaZonePrice('Hoji ya Henda'), 3500)
})

test('neighbourhood names match regardless of case and accents, and old municipalities are refused', () => {
  assert.equal(canonicalAngolaNeighbourhood('  talatona '), 'Talatona')
  assert.equal(canonicalAngolaNeighbourhood('HOJI YA HENDA'), 'Hoji ya Henda')
  assert.equal(canonicalAngolaNeighbourhood('vila  alice'), 'Vila Alice')
  assert.equal(angolaZoneOf('zango'), 'periferia')
  for (const gone of ['Luanda', 'Mussulo', 'Samba', 'Mulenvos', 'Ingombota', '', undefined]) assert.equal(canonicalAngolaNeighbourhood(gone), null)
})

test('admin zone prices override the defaults and the free threshold is judged after discounts', () => {
  const settings = { angolaZonePriceCentro: 3000, angolaZonePricePeriferia: 6000, angolaFreeShippingEnabled: true, angolaFreeShippingThreshold: 100_000 }
  assert.equal(angolaShippingCost('Mutamba', 50_000, settings), 3000)
  assert.equal(angolaShippingCost('Talatona', 50_000, settings), 3500) // untouched zone keeps its default
  assert.equal(angolaShippingCost('Zango', 50_000, settings), 6000)
  assert.equal(angolaShippingCost('Zango', 99_999, settings), 6000)
  assert.equal(angolaShippingCost('Zango', 100_000, settings), 0)
  assert.equal(normalizeAngolaShipping({ angolaZonePriceSul: -1 as never }).zonePrices.sul, 3500) // invalid -> default
  assert.equal(normalizeAngolaShipping(null).freeThreshold, 80_000)
})

test('free delivery is off unless an admin switches it on', () => {
  const off = { angolaFreeShippingThreshold: 100_000 }
  assert.equal(angolaShippingCost('Zango', 1_000_000, off), 5500)
  assert.equal(angolaShippingCost('Zango', 1_000_000, { ...off, angolaFreeShippingEnabled: false }), 5500)
  assert.equal(angolaShippingCost('Zango', 1_000_000, null), 5500)
  assert.equal(angolaShippingCost('Zango', 1_000_000, { ...off, angolaFreeShippingEnabled: true }), 0)
})

test('an old order stays editable, and changing its neighbourhood is checked', async () => {
  // updating an old order that still carries a retired municipality must not fail
  const update = await applyAuthoritativeOrderValues({
    operation: 'update',
    originalDoc: { city: 'Mussulo' },
    req: {},
    data: { market: 'AO', city: 'Mussulo', status: 'shipped' },
  } as never)
  assert.equal((update as { city: string }).city, 'Mussulo')
  await assert.rejects(applyAuthoritativeOrderValues({ operation: 'update', originalDoc: { city: 'Mussulo' }, req: {}, data: { market: 'AO', city: 'Marte' } } as never), /neighbourhood/i)
  const moved = await applyAuthoritativeOrderValues({ operation: 'update', originalDoc: { city: 'Mussulo' }, req: {}, data: { market: 'AO', city: 'viana' } } as never)
  assert.equal((moved as { city: string }).city, 'Viana')
})
