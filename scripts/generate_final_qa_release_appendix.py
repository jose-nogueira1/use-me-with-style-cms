from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, Image, PageBreak, PageTemplate, Paragraph, Spacer, Table


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/pdf/Use_Me_With_Style_Final_QA_and_Release_Appendix.pdf"
LOGO = ROOT / "src/assets/use-me-logo-black-transparent.png"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GOLD = colors.HexColor("#B58A25")
GOLD_DARK = colors.HexColor("#755719")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6D675F")
PAPER = colors.HexColor("#FBF8F1")
RULE = colors.HexColor("#DDCFB0")
GREEN = colors.HexColor("#376A46")
RED = colors.HexColor("#9B3B32")
BLUE = colors.HexColor("#315D7A")

pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))

body = ParagraphStyle("body", fontName="Arial", fontSize=8.6, leading=12.2, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.05, leading=9.45, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14.5, leading=18, textColor=INK, spaceBefore=7, spaceAfter=6)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=6.8, leading=8.5, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=24, leading=29, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=GOLD_DARK)


def P(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    return [Table([[P("•", body), P(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]) for item in items]


def callout(title, text, tone="gold"):
    palette = {
        "gold": (PAPER, GOLD_DARK, RULE),
        "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")),
        "red": (colors.HexColor("#FBEFEE"), RED, colors.HexColor("#DEB8B4")),
        "blue": (colors.HexColor("#EDF4F8"), BLUE, colors.HexColor("#B8CAD5")),
    }
    bg, fg, border = palette[tone]
    return Table([[P(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), P(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[34 * mm, 136 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), .7, border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])


def table(headers, rows, widths, font=small):
    data = [[P(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[P(str(x), font) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState(); w, h = A4
    canvas.setStrokeColor(GOLD); canvas.setLineWidth(.8); canvas.line(18 * mm, h - 15 * mm, w - 18 * mm, h - 15 * mm)
    canvas.setFont("Arial", 7); canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - FINAL QA AND RELEASE APPENDIX")
    canvas.drawRightString(w - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    s = [Spacer(1, 15 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
         P("CONTROLLED TECHNICAL RECORD", cover_sub), Spacer(1, 4 * mm),
         P("Final QA and<br/>Release Appendix", cover_title), Spacer(1, 4 * mm),
         P("Phase 1 evidence baseline and release disposition", cover_sub), Spacer(1, 12 * mm)]
    s += [table(["Field", "Controlled value"], [
        ("Document", "UMWS-P1-QA-001"), ("Version", "1.0"), ("Evidence date", "22 August 2026"),
        ("QA / release owner", "Jose"), ("Final pack approver", "Raisa"),
        ("Storefront release", "a5ad493ed412ae21610a5ba0be726837e7b7c440"),
        ("CMS documentation release", "83bedc4e083cdc4fc5853f4efa245a6fa05a0443"),
        ("Gate 5.8 status", "Technical evidence complete"),
        ("Overall delivery status", "Conditional - client catalogue approval and administrator training remain open"),
    ], [48 * mm, 122 * mm]), Spacer(1, 7 * mm),
        callout("Decision", "The Phase 1 technical release baseline is healthy and reproducible. This appendix does not convert open client-owned approval or training evidence into a pass. Formal GO remains a later delivery decision.", "blue"),
        Spacer(1, 6 * mm), P("Evidence scope", h2)]
    s += bullets([
        "Final repository commits and production deployment references.",
        "Lint, unit/integration, browser E2E, build, prerender, environment and domain checks.",
        "Skipped PostgreSQL test disposition and dependency vulnerability disposition.",
        "Production service, backup, heartbeat, monitor and email-canary snapshot.",
        "Evidence references, accepted exceptions and open sign-offs.",
    ])
    s += [PageBreak(), P("1. Release identifiers and repository state", h1),
          table(["Component", "Release evidence", "Result"], [
              ("Storefront / admin SPA", "main a5ad493ed412ae21610a5ba0be726837e7b7c440; commit dated 21 Aug 2026; 'Fix mobile size guide and document Gate 2 QA'.", "Clean and synced"),
              ("CMS / API", "main 83bedc4e083cdc4fc5853f4efa245a6fa05a0443; merge PR #46 dated 22 Aug 2026; controlled handoff records only after 7e35e07 application baseline.", "Clean except preserved user-owned untracked script"),
              ("Preserved local item", "cms/scripts/.tmp-update-14-day-policy.ts was present before Gate 5 work and remains untouched/uncommitted.", "Excluded from release"),
              ("Release method", "One focused feature branch per repository, pull request, verified merge to main and post-merge evidence capture.", "Applied"),
          ], [42 * mm, 98 * mm, 30 * mm]), Spacer(1, 7 * mm),
          P("Production deployment references", h2),
          table(["Service", "Deployment / release", "Observed state"], [
              ("Vercel storefront", "Deployment dpl_BX5EwuYNMUm1tuXoCwwFEBdPTyPL; created 21 Aug 2026 13:40 WAT; release a5ad493e; aliases apex, www, AO and PT.", "READY / production"),
              ("Railway CMS", "GitHub deployment 6038387095; environment 'amused-analysis / production'; release 83bedc4e; status recorded 22 Aug 2026 15:39 UTC.", "SUCCESS"),
              ("Rollback basis", "Provider deployment history plus known-good Git commits; database recovery requires isolated restore validation before production change.", "Documented"),
          ], [38 * mm, 102 * mm, 30 * mm]), Spacer(1, 7 * mm),
          callout("Release boundary", "The CMS commits after the application baseline add only controlled PDF generators and documents. No storefront, API, schema, payment, order or inventory behavior changed during Gate 5 documentation.", "green")]
    s += [PageBreak(), P("2. Final automated verification", h1),
          P("Commands were rerun locally on 22 August 2026 against the exact main revisions listed in this appendix.", body),
          table(["Component / check", "Command", "Outcome"], [
              ("Storefront lint", "npm run lint", "PASS - zero errors"),
              ("Storefront tests", "npm test", "PASS - 149/149; zero skipped"),
              ("Storefront build/prerender", "npm run build", "PASS - Vite production build; 80 AO/PT pages prerendered and verified"),
              ("Storefront browser E2E", "npm run test:e2e", "PASS - 30/30 Chrome tests; checkout, filters and WCAG AA theme coverage"),
              ("Storefront runtime audit", "npm audit --omit=dev", "PASS - zero vulnerabilities"),
              ("Production env contract", "npm run env:check:production", "PASS - required public environment keys present"),
              ("Production domains", "npm run domain:check", "PASS - apex/www redirect; AO/PT/CMS responsive"),
              ("CMS lint", "npm run lint", "PASS - zero errors"),
              ("CMS standard tests", "npm test", "PASS - 166 passed; 20 PostgreSQL-only cases skipped by design"),
              ("CMS production build", "npm run build", "PASS - Payload import map and Next.js 16.2.12 build"),
              ("CMS runtime audit", "npm audit --omit=dev", "REVIEWED - six moderate transitive tooling advisories; accepted disposition"),
          ], [43 * mm, 48 * mm, 79 * mm]), Spacer(1, 7 * mm),
          callout("Functional coverage", "The 30-test browser suite passed light/dark accessibility for home, catalogue, product, cart, checkout, help, about, order lookup and 404, together with coupon, delivery and catalogue-filter flows.", "green")]
    s += [PageBreak(), P("3. Skipped tests and migration disposition", h1),
          P("The CMS standard suite deliberately skips migration cases unless TEST_POSTGRES_URL points to a disposable PostgreSQL instance. This avoids creating or dropping databases on an unknown developer or production server.", body),
          table(["Evidence", "Disposition"], [
              ("22 Aug standard suite", "166 passed; 20 skipped. The skip condition is expected and visible, not hidden or counted as a pass."),
              ("21 Aug isolated PostgreSQL suite", "20/20 passed against a temporary isolated PostgreSQL cluster. Each test created and dropped its own uniquely named database."),
              ("Production protection", "No development or production database was accessed by the migration suite. The temporary cluster was stopped and removed after validation."),
              ("Release relevance", "Gate 5 documentation commits contain no schema change. The latest application/schema baseline remains covered by the isolated pass."),
              ("Future trigger", "Run the isolated migration suite again before any schema-heavy release, migration change, or database-engine upgrade."),
          ], [48 * mm, 122 * mm]), Spacer(1, 7 * mm),
          callout("Disposition", "The 20 skipped cases are accepted for this local final rerun because equivalent isolated PostgreSQL execution passed 20/20 on 21 August and Gate 5 introduced no schema change.", "blue"),
          P("Migration evidence reference", h2),
          P("CMS: docs/gate-1-technical-verification-2026-08-21.md. The record includes the isolated-cluster method, result and cleanup boundary.", body)]
    s += [PageBreak(), P("4. Dependency and security disposition", h1),
          table(["Component", "Finding", "Disposition"], [
              ("Storefront", "npm audit --omit=dev: zero vulnerabilities.", "Closed"),
              ("CMS", "Six moderate entries from @payloadcms/db-postgres / db-sqlite -> drizzle-kit -> @esbuild-kit -> esbuild 0.18.20.", "Accepted and monitored"),
              ("Affected behavior", "Advisory concerns an exposed esbuild development server accepting cross-site requests.", "Not the deployed Next.js/Payload HTTP server"),
              ("Exposure control", "Nested copy is used by Payload database migration tooling. Migration/development tooling must remain trusted/local and must not be exposed publicly.", "Operational mitigation"),
              ("Remediation status", "Payload packages are on 3.88.0; npm offers no supported automatic fix for the transitive chain. A forced override could break migration tooling.", "No unsafe override"),
              ("Review trigger", "Re-run audit during maintenance and upgrade when Payload replaces the chain; re-evaluate immediately if tooling becomes remotely exposed.", "Jose owns review"),
          ], [34 * mm, 91 * mm, 45 * mm]), Spacer(1, 7 * mm),
          callout("Risk decision", "Accepted as a monitored tooling risk, not a production runtime exposure. It does not block Phase 1 under the approved Gate 1 disposition, but it remains visible in the limitations register.", "gold"),
          P("Security boundaries retained", h2)]
    s += bullets([
        "No secrets are recorded in this appendix or the client handoff page.",
        "Meta webhook HMAC verification remains enforced.",
        "Production recovery uses provider secret stores and the approved runbook.",
        "No destructive production mutation was used to prepare this appendix.",
    ])
    s += [PageBreak(), P("5. Production snapshot", h1),
          table(["Control", "Latest evidence captured 22 Aug 2026", "State"], [
              ("Public routing", "usemewithstyle.shop 307; www 307; ao 200; pt 200; cms 200.", "PASS"),
              ("Vercel production", "Deployment dpl_BX5EwuYNMUm1tuXoCwwFEBdPTyPL with all production aliases.", "READY"),
              ("Railway CMS", "Deployment 6038387095 for 83bedc4e; production environment status success.", "SUCCESS"),
              ("Encrypted PostgreSQL backup", "GitHub Actions run 32548213282; completed successfully at 03:11 UTC; controlled 14-day retention.", "SUCCESS"),
              ("Inventory heartbeat", "GitHub Actions run 32582540607; completed successfully at 15:43 UTC.", "SUCCESS"),
              ("Operations monitor", "GitHub Actions run 32582636752; completed successfully at 15:45 UTC.", "SUCCESS"),
              ("Email delivery canary", "GitHub Actions run 32563232296; completed successfully at 08:48 UTC.", "SUCCESS"),
              ("R2 recovery", "Gate 3 rehearsal: upload, download, second-key restore and checksum comparison passed; exact cleanup completed.", "PROVEN 21 AUG"),
              ("PostgreSQL restore", "Gate 3 isolated restore: 64 tables, 824 rows, 205 seconds; encrypted evidence retained.", "PROVEN 21 AUG"),
          ], [43 * mm, 102 * mm, 25 * mm]), Spacer(1, 7 * mm),
          callout("Operational targets", "Database operational RPO is 24 hours and RTO is 30 minutes. The inventory freshness threshold is 45 minutes, reflecting observed GitHub scheduling delays while remaining fail-closed.", "blue")]
    s += [PageBreak(), P("6. Evidence index", h1),
          table(["ID", "Evidence source", "Purpose"], [
              ("E01", "platform/docs/closeout/gate-1-technical-verification-2026-08-21.md", "Storefront tests, build, domains, audit and production reads"),
              ("E02", "cms/docs/gate-1-technical-verification-2026-08-21.md", "CMS tests, isolated migrations, build and risk disposition"),
              ("E03", "platform/docs/closeout/gate-2-visual-qa-2026-08-21.md", "Responsive/brand QA and remaining client catalogue approval"),
              ("E04", "platform/output/gate2-visual-qa-2026-08-21/", "Local screenshot set for AO/PT and PT/EN breakpoints"),
              ("E05", "cms/docs/closeout/gate-3-production-resilience-2026-08-21.md", "Email, R2, PostgreSQL, heartbeat, alerts and ownership proof"),
              ("E06", "cms/docs/closeout/gate-4-5-operational-tabletop-2026-08-22.md", "Incident tabletop and corrected heartbeat threshold"),
              ("E07", "GitHub Actions runs 32548213282, 32582540607, 32582636752, 32563232296", "Backup, heartbeat, monitor and email-canary execution logs"),
              ("E08", "Vercel deployment dpl_BX5EwuYNMUm1tuXoCwwFEBdPTyPL", "Production frontend deployment and aliases"),
              ("E09", "GitHub deployment 6038387095", "Railway production CMS success for 83bedc4e"),
              ("E10", "UMWS-P1-OG/TR/AR/LW/DR/ATR controlled PDFs", "Operations, recovery, access, limitations, deferrals and training assets"),
          ], [14 * mm, 99 * mm, 57 * mm]), Spacer(1, 7 * mm),
          P("External log links", h2)]
    s += bullets([
        "Backup: https://github.com/jose-nogueira1/use-me-with-style-cms/actions/runs/32548213282",
        "Heartbeat: https://github.com/jose-nogueira1/use-me-with-style-cms/actions/runs/32582540607",
        "Monitor: https://github.com/jose-nogueira1/use-me-with-style-cms/actions/runs/32582636752",
        "Email canary: https://github.com/jose-nogueira1/use-me-with-style-cms/actions/runs/32563232296",
    ])
    s += [PageBreak(), P("7. Exceptions, approvals and release position", h1),
          table(["Open / accepted item", "Current disposition", "Owner / closure"], [
              ("Final catalogue, photography, product copy and brand approval", "Gate 2 technical QA passed; client-owned catalogue/content checks remain open.", "Raisa completes at delivery; Jose records final visual approval"),
              ("Administrator training", "Training record and exercises prepared; session, recording, competency assessment and signatures not yet completed.", "Jose + Raisa; Gate 5.7"),
              ("Integrated payments", "Deferred; manual WhatsApp checkout remains the approved Phase 1 model and future fallback.", "AppyPay/legal readiness; Phase 2"),
              ("Certified fiscal providers", "Deferred; app-generated internal non-fiscal documents are the approved interim model.", "Provider/accounting decision; Phase 2"),
              ("CMS moderate tooling advisories", "Accepted and monitored under the Gate 1 risk disposition.", "Jose; maintenance review"),
              ("Persistent staging", "Deferred to the start of Phase 2; focused branches/PRs and provider previews are the current control.", "Jose; Phase 2 environment gate"),
          ], [52 * mm, 78 * mm, 40 * mm]), Spacer(1, 7 * mm),
          callout("Gate 5.8", "COMPLETE - final technical QA and release evidence is consolidated, traceable and current as of 22 August 2026.", "green"), Spacer(1, 5 * mm),
          callout("Phase 1 release position", "CONDITIONAL - do not mark formal GO until Raisa completes the catalogue/content approval, Gate 5.7 training evidence is signed, and the later delivery review records the accepted exceptions and support window.", "gold"),
          P("Technical record approval", h2),
          table(["Role", "Name / acknowledgement", "Date"], [
              ("QA and release owner", "Jose - technical evidence prepared", "22 Aug 2026"),
              ("Final pack approver", "Raisa - pending final handoff review", "________________"),
          ], [52 * mm, 88 * mm, 30 * mm])]
    return s


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm, topMargin=21 * mm, bottomMargin=18 * mm,
                          title="Use Me With Style - Final QA and Release Appendix", author="Use Me With Style delivery team")
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
