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
import * as migration_20260724_150000_business_hours_and_shipping_info from './20260724_150000_business_hours_and_shipping_info'
import * as migration_20260724_170000_legal_content from './20260724_170000_legal_content'
import * as migration_20260725_090000_product_size_guide from './20260725_090000_product_size_guide'
import * as migration_20260725_150000_catalogue_taxonomies from './20260725_150000_catalogue_taxonomies'
import * as migration_20260725_160000_colors_bilingual from './20260725_160000_colors_bilingual'
import * as migration_20260725_180000_colors_hex2 from './20260725_180000_colors_hex2'
import * as migration_20260725_190000_home_content from './20260725_190000_home_content'
import * as migration_20260725_200000_home_content_versions from './20260725_200000_home_content_versions'
import * as migration_20260725_210000_merch_tags_slug from './20260725_210000_merch_tags_slug'
import * as migration_20260725_220000_categories_image from './20260725_220000_categories_image'
import * as migration_20260725_230000_product_sale_pricing from './20260725_230000_product_sale_pricing'
import * as migration_20260725_231500_coupons from './20260725_231500_coupons'
import * as migration_20260725_232000_order_coupon_fields from './20260725_232000_order_coupon_fields'
import * as migration_20260725_233000_fix_home_content_versions_columns from './20260725_233000_fix_home_content_versions_columns'
import * as migration_20260725_234000_fix_home_content_timestamps from './20260725_234000_fix_home_content_timestamps'
import * as migration_20260725_235000_coupons_locked_documents_rel from './20260725_235000_coupons_locked_documents_rel'
import * as migration_20260726_100000_bilingual_bank_transfer_and_disclaimer from './20260726_100000_bilingual_bank_transfer_and_disclaimer'
import * as migration_20260727_100000_coupons_market_availability from './20260727_100000_coupons_market_availability'
import * as migration_20260729_180000_portugal_shipping_and_tracking from './20260729_180000_portugal_shipping_and_tracking'
import * as migration_20260729_183000_angola_delivery_prices from './20260729_183000_angola_delivery_prices'
import * as migration_20260729_190000_portugal_heavy_parcels from './20260729_190000_portugal_heavy_parcels'
import * as migration_20260730_130000_invoice_payment_details from './20260730_130000_invoice_payment_details'
import * as migration_20260730_140000_fix_invoice_payment_detail_columns from './20260730_140000_fix_invoice_payment_detail_columns'
import * as migration_20260730_150000_defer_portugal_payments from './20260730_150000_defer_portugal_payments'
import * as migration_20260731_140000_merch_tags_multiselect from './20260731_140000_merch_tags_multiselect'
import * as migration_20260731_150000_home_hero_cta_picker from './20260731_150000_home_hero_cta_picker'
import * as migration_20260731_160000_coupons_free_shipping from './20260731_160000_coupons_free_shipping'
import * as migration_20260801_100000_order_status_history from './20260801_100000_order_status_history'
import * as migration_20260801_110000_legal_content_data_deletion from './20260801_110000_legal_content_data_deletion'

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
  {
    up: migration_20260724_150000_business_hours_and_shipping_info.up,
    down: migration_20260724_150000_business_hours_and_shipping_info.down,
    name: '20260724_150000_business_hours_and_shipping_info',
  },
  {
    up: migration_20260724_170000_legal_content.up,
    down: migration_20260724_170000_legal_content.down,
    name: '20260724_170000_legal_content',
  },
  {
    up: migration_20260725_090000_product_size_guide.up,
    down: migration_20260725_090000_product_size_guide.down,
    name: '20260725_090000_product_size_guide',
  },
  {
    up: migration_20260725_150000_catalogue_taxonomies.up,
    down: migration_20260725_150000_catalogue_taxonomies.down,
    name: '20260725_150000_catalogue_taxonomies',
  },
  {
    up: migration_20260725_160000_colors_bilingual.up,
    down: migration_20260725_160000_colors_bilingual.down,
    name: '20260725_160000_colors_bilingual',
  },
  {
    up: migration_20260725_180000_colors_hex2.up,
    down: migration_20260725_180000_colors_hex2.down,
    name: '20260725_180000_colors_hex2',
  },
  {
    up: migration_20260725_190000_home_content.up,
    down: migration_20260725_190000_home_content.down,
    name: '20260725_190000_home_content',
  },
  {
    up: migration_20260725_200000_home_content_versions.up,
    down: migration_20260725_200000_home_content_versions.down,
    name: '20260725_200000_home_content_versions',
  },
  {
    up: migration_20260725_210000_merch_tags_slug.up,
    down: migration_20260725_210000_merch_tags_slug.down,
    name: '20260725_210000_merch_tags_slug',
  },
  {
    up: migration_20260725_220000_categories_image.up,
    down: migration_20260725_220000_categories_image.down,
    name: '20260725_220000_categories_image',
  },
  {
    up: migration_20260725_230000_product_sale_pricing.up,
    down: migration_20260725_230000_product_sale_pricing.down,
    name: '20260725_230000_product_sale_pricing',
  },
  {
    up: migration_20260725_231500_coupons.up,
    down: migration_20260725_231500_coupons.down,
    name: '20260725_231500_coupons',
  },
  {
    up: migration_20260725_232000_order_coupon_fields.up,
    down: migration_20260725_232000_order_coupon_fields.down,
    name: '20260725_232000_order_coupon_fields',
  },
  {
    up: migration_20260725_233000_fix_home_content_versions_columns.up,
    down: migration_20260725_233000_fix_home_content_versions_columns.down,
    name: '20260725_233000_fix_home_content_versions_columns',
  },
  {
    up: migration_20260725_234000_fix_home_content_timestamps.up,
    down: migration_20260725_234000_fix_home_content_timestamps.down,
    name: '20260725_234000_fix_home_content_timestamps',
  },
  {
    up: migration_20260725_235000_coupons_locked_documents_rel.up,
    down: migration_20260725_235000_coupons_locked_documents_rel.down,
    name: '20260725_235000_coupons_locked_documents_rel',
  },
  {
    up: migration_20260726_100000_bilingual_bank_transfer_and_disclaimer.up,
    down: migration_20260726_100000_bilingual_bank_transfer_and_disclaimer.down,
    name: '20260726_100000_bilingual_bank_transfer_and_disclaimer',
  },
  {
    up: migration_20260727_100000_coupons_market_availability.up,
    down: migration_20260727_100000_coupons_market_availability.down,
    name: '20260727_100000_coupons_market_availability',
  },
  {
    up: migration_20260729_180000_portugal_shipping_and_tracking.up,
    down: migration_20260729_180000_portugal_shipping_and_tracking.down,
    name: '20260729_180000_portugal_shipping_and_tracking',
  },
  {
    up: migration_20260729_183000_angola_delivery_prices.up,
    down: migration_20260729_183000_angola_delivery_prices.down,
    name: '20260729_183000_angola_delivery_prices',
  },
  {
    up: migration_20260729_190000_portugal_heavy_parcels.up,
    down: migration_20260729_190000_portugal_heavy_parcels.down,
    name: '20260729_190000_portugal_heavy_parcels',
  },
  {
    up: migration_20260730_130000_invoice_payment_details.up,
    down: migration_20260730_130000_invoice_payment_details.down,
    name: '20260730_130000_invoice_payment_details',
  },
  {
    up: migration_20260730_140000_fix_invoice_payment_detail_columns.up,
    down: migration_20260730_140000_fix_invoice_payment_detail_columns.down,
    name: '20260730_140000_fix_invoice_payment_detail_columns',
  },
  {
    up: migration_20260730_150000_defer_portugal_payments.up,
    down: migration_20260730_150000_defer_portugal_payments.down,
    name: '20260730_150000_defer_portugal_payments',
  },
  {
    up: migration_20260731_140000_merch_tags_multiselect.up,
    down: migration_20260731_140000_merch_tags_multiselect.down,
    name: '20260731_140000_merch_tags_multiselect',
  },
  {
    up: migration_20260731_150000_home_hero_cta_picker.up,
    down: migration_20260731_150000_home_hero_cta_picker.down,
    name: '20260731_150000_home_hero_cta_picker',
  },
  {
    up: migration_20260731_160000_coupons_free_shipping.up,
    down: migration_20260731_160000_coupons_free_shipping.down,
    name: '20260731_160000_coupons_free_shipping',
  },
  {
    up: migration_20260801_100000_order_status_history.up,
    down: migration_20260801_100000_order_status_history.down,
    name: '20260801_100000_order_status_history',
  },
  {
    up: migration_20260801_110000_legal_content_data_deletion.up,
    down: migration_20260801_110000_legal_content_data_deletion.down,
    name: '20260801_110000_legal_content_data_deletion',
  },
]
