import * as migration_20260708_220620_initial from './20260708_220620_initial'
import * as migration_20260709_171700_add_order_payment_reference from './20260709_171700_add_order_payment_reference'
import * as migration_20260710_010000_add_order_lang from './20260710_010000_add_order_lang'
import * as migration_20260718_183031 from './20260718_183031'
import * as migration_20260720_120500_internal_invoicing from './20260720_120500_internal_invoicing'
import * as migration_20260721_230000_meta_order_tracking from './20260721_230000_meta_order_tracking'
import * as migration_20260722_010000_appypay_verification from './20260722_010000_appypay_verification'
import * as migration_20260722_150000_product_localization from './20260722_150000_product_localization'
import * as migration_20260722_152800_fix_product_localization_columns from './20260722_152800_fix_product_localization_columns'
import * as migration_20260722_220000_inventory_reservations from './20260722_220000_inventory_reservations'
import * as migration_20260723_120000_returns_policy_per_market from './20260723_120000_returns_policy_per_market'
import * as migration_20260724_130000_bilingual_returns_policy from './20260724_130000_bilingual_returns_policy'
import * as migration_20260724_133000_fix_returns_policy_column_names from './20260724_133000_fix_returns_policy_column_names'

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
  {
    up: migration_20260718_183031.up,
    down: migration_20260718_183031.down,
    name: '20260718_183031',
  },
  {
    up: migration_20260720_120500_internal_invoicing.up,
    down: migration_20260720_120500_internal_invoicing.down,
    name: '20260720_120500_internal_invoicing',
  },
  {
    up: migration_20260721_230000_meta_order_tracking.up,
    down: migration_20260721_230000_meta_order_tracking.down,
    name: '20260721_230000_meta_order_tracking',
  },
  {
    up: migration_20260722_010000_appypay_verification.up,
    down: migration_20260722_010000_appypay_verification.down,
    name: '20260722_010000_appypay_verification',
  },
  {
    up: migration_20260722_150000_product_localization.up,
    down: migration_20260722_150000_product_localization.down,
    name: '20260722_150000_product_localization',
  },
  {
    up: migration_20260722_152800_fix_product_localization_columns.up,
    down: migration_20260722_152800_fix_product_localization_columns.down,
    name: '20260722_152800_fix_product_localization_columns',
  },
  {
    up: migration_20260722_220000_inventory_reservations.up,
    down: migration_20260722_220000_inventory_reservations.down,
    name: '20260722_220000_inventory_reservations',
  },
  {
    up: migration_20260723_120000_returns_policy_per_market.up,
    down: migration_20260723_120000_returns_policy_per_market.down,
    name: '20260723_120000_returns_policy_per_market',
  },
  {
    up: migration_20260724_130000_bilingual_returns_policy.up,
    down: migration_20260724_130000_bilingual_returns_policy.down,
    name: '20260724_130000_bilingual_returns_policy',
  },
  {
    up: migration_20260724_133000_fix_returns_policy_column_names.up,
    down: migration_20260724_133000_fix_returns_policy_column_names.down,
    name: '20260724_133000_fix_returns_policy_column_names',
  },
]
