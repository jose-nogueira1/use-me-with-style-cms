import { sql } from '@payloadcms/db-postgres'
import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

/** Product deletion must preserve historical orders by nulling their product
 * relationship. The old schema combined ON DELETE SET NULL with NOT NULL,
 * which made any product with order history impossible to delete. */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items" ALTER COLUMN "product_id" DROP NOT NULL;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "orders_items" ALTER COLUMN "product_id" SET NOT NULL;
  `)
}
