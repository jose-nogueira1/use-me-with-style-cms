# Phase 1 Administration Handbook — Controlled Production Evidence Record

**Date:** 22 August 2026  
**Technical owner:** José  
**Purpose:** Controlled creation of fictional training records, screenshot capture, bilingual handbook production, and complete production cleanup.

## Recovery point

- Workflow: `PostgreSQL encrypted backup`
- GitHub Actions run: `32597143623`
- Result: success
- Evidence: https://github.com/jose-nogueira1/use-me-with-style-cms/actions/runs/32597143623

## Controlled data set

- Marker: `HANDBOOK-TRAINING-2026-08-22`
- Four fictional orders, four fictional customers, three fictional messages, one internal invoice, one product, one category, one coupon and one article.
- All customer addresses used the reserved `example.com` domain.
- Existing media was referenced; no protected media record was deleted.
- No real customer or external recipient was contacted.
- No transactional email was sent during documentation capture.

## Cleanup sequence

1. Validated every target by both fixed identifier and training marker/value.
2. Deleted the generated invoice object from Cloudflare R2.
3. Deleted invoice lines and invoice record.
4. Deleted messages, order histories/items, orders and fictional customers.
5. Deleted the training article, coupon, product and category in dependency order.
6. Queried all operational and protected baseline counts.
7. Confirmed that no training marker, slug, code, customer or invoice object remained.
8. Confirmed HTTP availability of both storefronts and Payload CMS.

## Verified post-cleanup baseline

| Entity | Verified count |
|---|---:|
| Orders | 0 |
| Order items | 0 |
| Order status history | 0 |
| Customers | 0 |
| Messages | 0 |
| Invoices | 0 |
| Invoice lines | 0 |
| Returns | 0 |
| Products | 21 |
| Media | 17 |
| Categories | 5 |
| Coupons | 2 |
| Colours | 8 |
| Articles | 3 |
| Users | 2 |

## Residual and health checks

- Training product/category/coupon/article/customer/message residuals: `0`
- Training invoice objects in Cloudflare R2: `0`
- Angola storefront: HTTP `200`
- Portugal storefront: HTTP `200`
- Payload CMS admin: HTTP `200`

## Documentation outputs

- Portuguese handbook: `Use_Me_With_Style_Manual_Administracao_Fase_1_PT.pdf`
- English handbook: `Use_Me_With_Style_Phase_1_Administration_Handbook_EN.pdf`
- Portuguese Notion page: https://app.notion.com/p/3c4cb5a5fd7a81928dfad740b8764112
- English Notion page: https://app.notion.com/p/3c4cb5a5fd7a81f98dcad99658283ed1

## Acceptance status

- Technical accuracy and cleanup evidence: prepared for José's approval.
- Language, usability and presentation: pending Raisa's recorded training session and sign-off.
