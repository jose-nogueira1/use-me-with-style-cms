// Additive upgrade shared by the local sync command and disposable SQLite tests.
export async function syncHeroPositions(client) {
  for (const [table, prefix] of [['home_hero', ''], ['_home_hero_v', 'version_']]) {
    const info = await client.execute(`PRAGMA table_info(${table})`)
    const columns = new Set(info.rows.map(row => String(row.name)))
    if (columns.size === 0) continue
    for (const [field, fallback] of [
      ['hero_desktop_position_x', 65],
      ['hero_desktop_position_y', 20],
      ['hero_mobile_position_x', 50],
      ['hero_mobile_position_y', 50],
    ]) {
      const column = `${prefix}${field}`
      if (!columns.has(column)) {
        await client.execute(`ALTER TABLE ${table} ADD COLUMN ${column} NUMERIC DEFAULT ${fallback}`)
      }
    }
  }
}
