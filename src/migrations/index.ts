import * as migration_20260708_220620_initial from './20260708_220620_initial'
import * as migration_20260709_171700_add_order_payment_reference from './20260709_171700_add_order_payment_reference'
import * as migration_20260710_010000_add_order_lang from './20260710_010000_add_order_lang'

export const migrations = [
  {
    up: migration_20260708_220620_initial.up,
    down: migration_20260708_220620_initial.down,
    name: '20260708_220620_initial',
  },
  {
    up: migration_20260709_171700_add_order_payment_reference.up,
    down: migration_20260709_171700_add_order_payment_reference.down,
    name: '20260709_171700_add_order_payment_reference',
  },
  {
    up: migration_20260710_010000_add_order_lang.up,
    down: migration_20260710_010000_add_order_lang.down,
    name: '20260710_010000_add_order_lang',
  },
]
