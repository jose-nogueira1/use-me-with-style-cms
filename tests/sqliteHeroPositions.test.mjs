import assert from 'node:assert/strict'
import test from 'node:test'
import { createClient } from '@libsql/client'
import { syncHeroPositions } from '../scripts/lib/sync-hero-positions.mjs'

test('SQLite hero upgrade defaults legacy records and preserves edits on repeat runs', async () => {
  const client = createClient({ url: ':memory:' })
  try {
    await client.execute('CREATE TABLE home_hero (id INTEGER PRIMARY KEY, headline TEXT)')
    await client.execute('CREATE TABLE _home_hero_v (id INTEGER PRIMARY KEY, version_headline TEXT)')
    await client.execute("INSERT INTO home_hero VALUES (1, 'Current campaign')")
    await client.execute("INSERT INTO _home_hero_v VALUES (1, 'Previous campaign')")
    await syncHeroPositions(client)
    const current = (await client.execute('SELECT * FROM home_hero')).rows[0]
    assert.equal(current.headline, 'Current campaign')
    assert.deepEqual([
      current.hero_desktop_position_x, current.hero_desktop_position_y,
      current.hero_mobile_position_x, current.hero_mobile_position_y,
    ], [65, 20, 50, 50])
    const version = (await client.execute('SELECT * FROM _home_hero_v')).rows[0]
    assert.equal(version.version_headline, 'Previous campaign')
    assert.deepEqual([
      version.version_hero_desktop_position_x, version.version_hero_desktop_position_y,
      version.version_hero_mobile_position_x, version.version_hero_mobile_position_y,
    ], [65, 20, 50, 50])
    await client.execute('UPDATE home_hero SET hero_desktop_position_x = 0, hero_mobile_position_y = 100')
    await client.execute('UPDATE _home_hero_v SET version_hero_desktop_position_y = 75')
    await syncHeroPositions(client)
    const edited = (await client.execute('SELECT * FROM home_hero')).rows[0]
    assert.equal(edited.hero_desktop_position_x, 0)
    assert.equal(edited.hero_mobile_position_y, 100)
    assert.equal((await client.execute('SELECT version_hero_desktop_position_y FROM _home_hero_v')).rows[0].version_hero_desktop_position_y, 75)
  } finally {
    client.close()
  }
})

test('SQLite hero upgrade tolerates a missing optional version table', async () => {
  const client = createClient({ url: ':memory:' })
  try {
    await client.execute('CREATE TABLE home_hero (id INTEGER PRIMARY KEY)')
    await syncHeroPositions(client)
    await client.execute('INSERT INTO home_hero (id) VALUES (1)')
    assert.equal((await client.execute('SELECT hero_mobile_position_y FROM home_hero')).rows[0].hero_mobile_position_y, 50)
  } finally {
    client.close()
  }
})
