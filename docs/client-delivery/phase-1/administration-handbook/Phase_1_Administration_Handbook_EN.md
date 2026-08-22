# Administration Handbook - Phase 1

**Version:** 1.0  
**Date:** 22 August 2026  
**Operations owner:** Raisa  
**Technical owner:** Jose

## 1. Start safely

This handbook assumes no previous ecommerce administration experience. Use the storefront admin first. Payload CMS is a technical, exceptional area.

![1. Start safely](assets/screenshots/annotated/admin__01-dashboard-overview.jpg)

1 Main navigation. 2 Search, notifications and exports. 3 Metrics and priority actions.

### Sign in and sign out

> **SAFE ROUTINE ACTION**

1. Open https://ao.usemewithstyle.shop/admin or https://pt.usemewithstyle.shop/admin.
2. Enter the email address and password supplied separately.
3. Confirm that the account name appears at the bottom of the sidebar.
4. When finished, choose Log out, especially on a shared computer.

### Change the admin language

> **SAFE ROUTINE ACTION**

1. Use PT or EN under the logo. This changes admin labels, not the language published on the storefront.
2. When editing bilingual content, always complete both Portuguese and English fields when available.

### Interpret safety labels

> **CHECK BEFORE PUBLISHING**

1. Safe routine action: suitable for everyday operations.
2. Check before publishing: review copy, price, image and market before saving.
3. Contact Jose first: payments, VAT, infrastructure, integrations or unexpected behavior.
4. High-impact action: deletion, unpublishing or a change affecting existing customers.

## 2. Daily routine and dashboard

The dashboard summarizes orders, paid revenue, pending confirmations, processing, low stock, market performance and operational health.

![2. Daily routine and dashboard](assets/screenshots/annotated/admin__01-dashboard-overview.jpg)

1 Today's cards. 2 7/30/90-day period. 3 Attention queue and trends.

### Morning check

> **SAFE ROUTINE ACTION**

1. Open Dashboard and check Needs confirmation, Processing and Low stock.
2. Open each card through View details to apply the correct filter automatically.
3. Review the Attention queue. Handle payments, overdue orders and out-of-stock variants first.
4. Compare Angola and Portugal without adding Kz and EUR together. They are separate currencies and markets.

### Change the reporting period

> **SAFE ROUTINE ACTION**

1. Choose 7d, 30d or 90d in Market performance or Revenue trend.
2. Choose Revenue or Orders to change the chart.
3. Click a daily bar to open that day's orders.

### Export the summary

> **CHECK BEFORE PUBLISHING**

1. Choose Export summary for a quick report for the current period.
2. Choose Download detailed CSV when row-level analysis is needed.
3. Store files securely: they may include personal and commercial data.

## 3. Orders, payment and fulfilment

The orders list supports search, filtering, export and order detail access. The detail page controls payment, processing, shipment, delivery and documents.

![3. Orders, payment and fulfilment](assets/screenshots/annotated/admin__02-orders-list.jpg)

1 Search and filters. 2 Status, payment and market. 3 Export and detail access.

### Find an order

> **SAFE ROUTINE ACTION**

1. Open Orders.
2. Search by order number, name or email.
3. Use market, status, payment and date filters to narrow the list.
4. Clear filters when finished so new orders are not hidden.

### Confirm a manual payment

> **HIGH-IMPACT ACTION**

1. Open an order in Payment review.
2. Confirm outside the application that payment was genuinely received.
3. Choose Confirm payment once only.
4. The application records payment, moves the order into fulfilment, generates the internal commercial document and sends confirmation email.
5. Check the event history, invoice and email. Do not click again if the page is slow; refresh and verify the state first.

> At AppyPay launch, follow the gateway-confirmed state. WhatsApp remains only as an activatable fallback.

### Process and ship

> **SAFE ROUTINE ACTION**

1. After payment, mark the order as Processing.
2. Compare items, variants, quantities and address. Address line 2 should appear separately.
3. Prepare the parcel and enter the CTT tracking code when applicable.
4. Mark it Shipped. The customer receives the shipping email.
5. Mark it Delivered only after delivery is confirmed.

### Cancel

> **CONTACT JOSE FIRST**

1. An order can only be cancelled while it is New.
2. After payment confirmation, the cancel button is unavailable. Do not force a change through another system.
3. If payment was confirmed, contact Jose for the correct procedure; the robust returns workflow is deferred to Phase 2.

### Print and view documents

> **CHECK BEFORE PUBLISHING**

1. Use the packing slip to pick items from inventory.
2. Open the Invoice/PDF from the order or Invoices page.
3. The current document is an internal commercial document; it is not certified fiscal invoicing.

## 4. Products, images, prices and stock

Products controls everything the customer sees and can buy: photography, bilingual names, category, badges, prices, sale, variants, stock and markets.

![4. Products, images, prices and stock](assets/screenshots/annotated/admin__05-product-editor.jpg)

1 Gallery and colour assignments. 2 Commercial data and variants. 3 Publishing, markets and Save changes.

### Create a product

> **CHECK BEFORE PUBLISHING**

1. Open Products and choose New product.
2. Complete Portuguese and English names. The slug is generated automatically and must not be changed.
3. Choose Standard product or Product kit. A standard product requires at least one variant; a kit requires components.
4. Choose category, merchandising tags and a size guide where applicable.
5. Keep it as Draft until images, prices, descriptions, stock and markets are complete.

### Add and crop photographs

> **CHECK BEFORE PUBLISHING**

1. Choose Add photo and select JPG, PNG or WebP within the displayed limits.
2. In the editor, adjust framing and zoom. Confirm the requested version before saving.
3. A preview appears before persistence. The photo only becomes part of the product after Save changes.
4. Enter useful alternative text. If left blank, the application falls back to the product name.
5. Assign a photo to a colour when it should only appear for that colour. Leave it General to show across all colours.
6. Choose the cover photo and reorder the remainder.

### Set price and sale

> **CHECK BEFORE PUBLISHING**

1. Enter the AO price in Kz and PT price in EUR separately.
2. A sale price must be lower than the regular price.
3. Start and end dates are optional. Without dates, the sale remains active while a sale price exists.
4. Confirm on the storefront product that the regular price is struck through and the sale price is highlighted.

### Manage variants and stock

> **SAFE ROUTINE ACTION**

1. Specify whether the product has colours and/or another option such as size or capacity.
2. Select colours and enter comma-separated option values.
3. Complete AO and PT stock for every combination. They are independent inventories.
4. Zero means sold out for that variant. Stock of two or less appears in the low-stock alert.
5. Never reduce stock to correct an order without checking its history first.

### Publish by market

> **CHECK BEFORE PUBLISHING**

1. Enable Published when the product is ready.
2. Use Available in Angola and Available in Portugal to control each storefront.
3. Save and open both stores to confirm name, price, stock, images and description.

### Delete or unpublish

> **HIGH-IMPACT ACTION**

1. Prefer unpublishing when the item may return.
2. Deletion removes the product from the admin and may affect links, articles or operational history.
3. Before deleting, confirm dependencies and preserve any required data.

## 5. Categories, tags, colours and size guides

Settings > Products contains reusable structures that automatically become available in the product editor.

![5. Categories, tags, colours and size guides](assets/screenshots/annotated/admin__19-settings-product-taxonomies.jpg)

1 Definition types. 2 List and creation. 3 Effect on products and storefront navigation.

### Create a category

> **CHECK BEFORE PUBLISHING**

1. Open Settings > Products > Categories.
2. Enter PT name, EN name and introductory copy in both languages.
3. Add the tile image and adjust the crop.
4. Save. The category becomes available to products and storefront navigation/filters.
5. A category in use cannot be deleted until products are reassigned.

### Manage tags and colours

> **SAFE ROUTINE ACTION**

1. Create bilingual tags for badges such as New or Bestseller.
2. Create colours with PT/EN names and a visual value. Internal identity remains stable if the name changes.
3. Assign tags and colours to products. Verify cards, selectors and galleries on the storefront.

### Manage size guides

> **CHECK BEFORE PUBLISHING**

1. Create a reusable table with labels and measurements.
2. Assign it to all relevant apparel products.
3. Use the product fit note for specific recommendations.
4. Confirm the product and public Size guide page.

## 6. Customers

Customers is a lightweight operational record created from orders. It is not a customer-account system.

![6. Customers](assets/screenshots/annotated/admin__07-customers-list.jpg)

1 Search and export. 2 Contact details. 3 Order history.

### View and correct a customer

> **CHECK BEFORE PUBLISHING**

1. Open Customers and search by name or email.
2. Open the detail to see contact information, market and related orders.
3. Correct confirmed errors only. Editing the customer does not automatically rewrite historical order addresses.
4. Use Export customers only for a legitimate operational purpose.

### Protect personal data

> **HIGH-IMPACT ACTION**

1. Do not share exports through public channels.
2. Do not copy addresses, telephone numbers or emails into handbooks or screenshots.
3. Delete exported files when they are no longer required.

## 7. Messages and Instagram support

Messages brings together Instagram conversations, conversation status, priorities, customer/order links and AI draft assistance where available.

![7. Messages and Instagram support](assets/screenshots/annotated/admin__09-messages.jpg)

1 Conversation list. 2 Priority and status. 3 Reply, internal note and associations.

### Handle a conversation

> **CHECK BEFORE PUBLISHING**

1. Open Messages and handle Priority and Needs reply first.
2. Read the full context and check for a related customer or order.
3. Use internal notes for information that must not be sent to the customer.
4. If an AI draft exists, verify product, price, stock, market and policy before approval.
5. After replying, mark Waiting on customer or Done as appropriate.

### Send a reply

> **CHECK BEFORE PUBLISHING**

1. Write a clear, professional message in the customer's language.
2. Do not promise stock, price, timing or refunds without confirmation in the system.
3. On send, the message is transmitted to Instagram and recorded in the conversation.

### Webhook or delivery failure

> **CONTACT JOSE FIRST**

1. Do not attempt to change tokens or technical settings.
2. Record the time, user, error text and a screenshot.
3. Contact Jose through the agreed emergency channel.

## 8. Internal invoices

Invoices lists internal commercial documents generated by the application. Filter by status and market and open the immutable PDF.

![8. Internal invoices](assets/screenshots/annotated/admin__10-invoices.jpg)

1 Filters. 2 Number, customer and order. 3 Status, total and PDF.

### View an invoice

> **CONTACT JOSE FIRST**

1. Open Invoices and filter by Issued/Failed and market.
2. Confirm number, order, customer, total and date.
3. Open PDF to review lines, VAT, subtotal, shipping and total paid.
4. If generation fails, do not create numbers manually; contact Jose.

### Phase 1 limitation

> **CHECK BEFORE PUBLISHING**

1. The current PDF is an internal commercial document for accounting support.
2. It is not a certified fiscal invoice. SWEG/FactPlus integration is a future decision.

## 9. Media library

The media library shows each image once, its assignments and alternative text. Deletion may remove it from several locations.

![9. Media library](assets/screenshots/annotated/admin__11-media-library.jpg)

1 Search and upload. 2 Preview and alt text. 3 Usage locations and deletion.

### Upload and reuse

> **SAFE ROUTINE ACTION**

1. Upload JPG, PNG or WebP within the displayed limits.
2. The application optimizes the file. Confirm sharpness and framing where it is used.
3. Before uploading an image again, search for an existing copy.
4. Use the usage list to understand where it appears.

### Delete an image

> **HIGH-IMPACT ACTION**

1. Open usage information and confirm all related products, categories or content.
2. Replace the image first wherever content must remain published.
3. Delete only after every consequence is understood.

## 10. Discounts and promotional codes

Discounts manages percentage, fixed-amount and free-delivery codes with markets, dates, limits and minimum values.

![10. Discounts and promotional codes](assets/screenshots/annotated/admin__12-discounts.jpg)

1 List and status. 2 Type and value. 3 Markets, limits and dates.

### Create a code

> **CHECK BEFORE PUBLISHING**

1. Choose New discount and enter a simple code; it is stored in uppercase.
2. Choose Percentage, Fixed amount or Free delivery.
3. Set Angola/Portugal, minimum values, dates, total limit and per-email limit.
4. Save as active only after reviewing the campaign.
5. Test in the authorized markets' checkout and confirm the summary before announcement.

### Disable instead of delete

> **HIGH-IMPACT ACTION**

1. Disable the code to end a campaign while preserving order history.
2. Delete only unused test codes with no historical value.

## 11. Articles and style guide

Articles publishes bilingual editorial content to capture demand, explain the brand and help customers choose products.

![11. Articles and style guide](assets/screenshots/annotated/admin__06-articles.jpg)

1 Draft/published. 2 Structured bilingual content. 3 SEO and market availability.

### Create and publish an article

> **CHECK BEFORE PUBLISHING**

1. Create an article and complete title, excerpt, blocks and SEO in Portuguese and English.
2. Use titled sections, paragraphs and lists. Order blocks in reading sequence.
3. Choose the markets where it should appear.
4. Keep Draft during review. Publish and open /estilo and the article on both stores.
5. Confirm title, description, structure, links and mobile readability.

## 12. Institutional content

Settings > Content controls institutional copy such as About us, FAQ, Size guide and other storefront content.

![12. Institutional content](assets/screenshots/annotated/admin__13-settings-content.jpg)

1 Content area. 2 PT/EN fields. 3 Save and verify on the public page.

### Edit public content

> **CHECK BEFORE PUBLISHING**

1. Choose the section and change only the required copy.
2. Complete Portuguese and English. Do not paste HTML or formatting from unknown sources.
3. Save and open the corresponding public page in AO and PT.
4. Confirm headings, accents, links, spacing and mobile rendering.

## 13. Markets, payment, delivery and VAT

Market settings affect checkout, methods, delivery prices, thresholds and messages. An incorrect change can block sales or charge the wrong amount.

![13. Markets, payment, delivery and VAT](assets/screenshots/annotated/admin__14-settings-markets.jpg)

1 Angola. 2 Portugal. 3 WhatsApp fallback, methods and Save.

### Change a market setting

> **CONTACT JOSE FIRST**

1. Record the current value before changing it.
2. Change one area at a time and verify the Save button.
3. Test AO and PT checkout through the summary without completing a real purchase.
4. Confirm method, currency, delivery price, free threshold and instructions.

### Enable the WhatsApp fallback

> **CONTACT JOSE FIRST**

1. The WhatsApp flow remains configured as a fallback for an AppyPay incident.
2. Enable it only with operational authorization, confirm the number and message, and perform a controlled test.
3. When AppyPay recovers, revert the setting and test again.

### Change VAT

> **CONTACT JOSE FIRST**

1. Do not change rates by trial and error. Confirm the legal obligation and applicable region.
2. Record the source, effective date and approval.
3. Test a price example and confirm subtotal excluding VAT, VAT, product total including VAT and VAT-exempt shipping.

## 14. Policies, invoicing and legal content

These areas control public policies, issuer details, VAT, payment instructions, privacy and terms.

![14. Policies, invoicing and legal content](assets/screenshots/annotated/admin__15-settings-policies.jpg)

1 Policies by market and language. 2 Invoicing data. 3 Legal content.

### Edit policies

> **CHECK BEFORE PUBLISHING**

1. Open Settings > Policies and choose the correct area.
2. Keep Portuguese and English consistent without promising anything operations cannot deliver.
3. Save and verify Help, FAQ, footer and checkout.

### Edit invoicing

> **CONTACT JOSE FIRST**

1. Verify legal name, tax ID, address, prefix, VAT and bank details against official documents.
2. Never change the prefix or sequence of issued documents without accounting and technical guidance.
3. Generate a test document and validate every line before production use.

### Edit privacy and terms

> **CONTACT JOSE FIRST**

1. Use approved wording only.
2. Keep a copy of the previous version and record the effective date.
3. Verify the public pages in both languages.

## 15. Home page

Settings > Home controls the hero, collections and featured categories. Desktop and mobile images are framed separately.

![15. Home page](assets/screenshots/annotated/admin__18-settings-home.jpg)

1 Bilingual copy and link. 2 Desktop/mobile images. 3 Category/collection selection and versions.

### Update the hero

> **CHECK BEFORE PUBLISHING**

1. Complete eyebrow, headline, subtitle and button in PT/EN.
2. Choose the button link to catalogue, category or another supported destination.
3. Upload the image and adjust desktop first, then mobile, in the editor.
4. Confirm both previews. The image is only applied when the hero is saved.
5. Open the home page on desktop and mobile before finishing.

### Manage versions

> **HIGH-IMPACT ACTION**

1. Each save retains earlier versions for the displayed area.
2. Use Restore to return to a confirmed version.
3. Delete old versions only when certain they are no longer required.

## 16. Instagram and AI assistance

Instagram selects the highlighted post and product associations. AI settings control limited message assistance, not autonomous sales decisions.

![16. Instagram and AI assistance](assets/screenshots/annotated/admin__20-settings-instagram.jpg)

1 Highlighted post. 2 Product/variant association. 3 AI status and rules.

### Highlight a post

> **CHECK BEFORE PUBLISHING**

1. Open Settings > Instagram and wait for recent posts to load.
2. Choose a post for the large tile and associate the correct products.
3. For variants, confirm the exact colour and size.
4. Save and verify Shop Instagram in AO and PT.

### Configure AI assistance

> **CONTACT JOSE FIRST**

1. Use only the available settings. Do not change tokens, models or webhooks outside the admin.
2. Keep human review for price, stock, payments, policies, complaints and sensitive data.
3. If replies appear incorrect, pause automation and contact Jose.

## 17. Troubleshooting

Perform safe first-line checks. Do not attempt direct repairs to infrastructure, database, tokens, webhooks or payments.

### A saved change does not appear

> **SAFE ROUTINE ACTION**

1. Confirm that a success message appeared.
2. Reload the admin page and verify that the value persisted.
3. Open the correct AO or PT storefront and confirm the language.
4. Refresh the storefront once. If still incorrect, record URL, time, steps and screenshot.

### An image is blurred or cropped

> **SAFE ROUTINE ACTION**

1. Confirm the original file, format and dimensions.
2. Reopen the crop editor and adjust desktop/mobile separately where available.
3. Avoid enlarging a small image to fill a large area.

### Technical error or outage

> **CONTACT JOSE FIRST**

1. Do not repeat payment, deletion or send actions.
2. Record market, URL, user, time, error message and screenshot.
3. Contact Jose through WhatsApp. Raisa has authority to pause sales when necessary.

## 18. Restricted Payload CMS use

Payload CMS at https://cms.usemewithstyle.shop/admin is the technical content and data layer. The storefront admin must be used for daily work.

### When to enter

> **CONTACT JOSE FIRST**

1. Enter only when a required task is unavailable in the storefront admin and after confirming with Jose.
2. Do not experiment with technical collections, relationships, users, settings or historical data.
3. Never perform bulk deletion, migration or infrastructure changes.

## 19. Deferred capabilities and acceptance

Phase 1 does not include robust returns, certified fiscal invoicing, final AppyPay/Paybird payments, full accounts, wishlist, loyalty, VIP, advanced campaigns or advanced roles.

### Handbook acceptance

> **CHECK BEFORE PUBLISHING**

1. Raisa completes representative tasks using only the Portuguese handbook during the recorded session.
2. Jose corrects any hesitation caused by incomplete instruction or an outdated image.
3. Jose approves technical accuracy; Raisa approves language, usability and presentation.
4. Both language versions receive the same version number and change log.
