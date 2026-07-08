import * as migration_20260708_220620_initial from './20260708_220620_initial'

export const migrations = [
  {
    up: migration_20260708_220620_initial.up,
    down: migration_20260708_220620_initial.down,
    name: '20260708_220620_initial',
  },
]
