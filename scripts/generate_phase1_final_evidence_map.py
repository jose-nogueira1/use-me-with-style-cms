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
OUT = ROOT / "output/pdf/Use_Me_With_Style_Phase_1_Final_Evidence_Map.pdf"
LOGO = ROOT / "src/assets/use-me-logo-black-transparent.png"
FONT_DIR = Path("/System/Library/Fonts/Supplemental")

GOLD = colors.HexColor("#B58A25")
GOLD_DARK = colors.HexColor("#755719")
INK = colors.HexColor("#171411")
SOFT = colors.HexColor("#6D675F")
PAPER = colors.HexColor("#FBF8F1")
RULE = colors.HexColor("#DDCFB0")
GREEN = colors.HexColor("#376A46")
BLUE = colors.HexColor("#315D7A")

pdfmetrics.registerFont(TTFont("Arial", str(FONT_DIR / "Arial.ttf")))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(FONT_DIR / "Arial Bold.ttf")))

body = ParagraphStyle("body", fontName="Arial", fontSize=8.5, leading=12, textColor=INK, spaceAfter=5)
small = ParagraphStyle("small", parent=body, fontSize=7.0, leading=9.3, textColor=SOFT)
h1 = ParagraphStyle("h1", fontName="Arial-Bold", fontSize=22, leading=26, textColor=INK, spaceAfter=9)
h2 = ParagraphStyle("h2", fontName="Arial-Bold", fontSize=14, leading=17, textColor=INK, spaceBefore=6, spaceAfter=6)
label = ParagraphStyle("label", fontName="Arial-Bold", fontSize=6.8, leading=8.5, textColor=GOLD_DARK)
cover_title = ParagraphStyle("cover", fontName="Arial-Bold", fontSize=24, leading=29, alignment=TA_CENTER, textColor=INK)
cover_sub = ParagraphStyle("cover_sub", fontName="Arial-Bold", fontSize=8.5, leading=12, alignment=TA_CENTER, textColor=GOLD_DARK)


def p(text, style=body):
    return Paragraph(text, style)


def bullets(items):
    return [Table([[p("•", body), p(item, body)]], colWidths=[5 * mm, 165 * mm], style=[("VALIGN", (0, 0), (-1, -1), "TOP")]) for item in items]


def callout(title, text, tone="gold"):
    palette = {
        "gold": (PAPER, GOLD_DARK, RULE),
        "green": (colors.HexColor("#EEF6F0"), GREEN, colors.HexColor("#B8D3BF")),
        "blue": (colors.HexColor("#EDF4F8"), BLUE, colors.HexColor("#B8CAD5")),
    }
    bg, fg, border = palette[tone]
    return Table([[p(title.upper(), ParagraphStyle("co_l", parent=label, textColor=fg)), p(text, ParagraphStyle("co_b", parent=body, textColor=fg, spaceAfter=0))]], colWidths=[34 * mm, 136 * mm], style=[
        ("BACKGROUND", (0, 0), (-1, -1), bg), ("BOX", (0, 0), (-1, -1), .7, border),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ])


def table(headers, rows, widths, font=small):
    data = [[p(x, ParagraphStyle("th", parent=label, textColor=colors.white)) for x in headers]]
    data += [[p(str(x), font) for x in row] for row in rows]
    return Table(data, colWidths=widths, repeatRows=1, style=[
        ("BACKGROUND", (0, 0), (-1, 0), INK), ("GRID", (0, 0), (-1, -1), .45, RULE),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PAPER]), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 4.5), ("RIGHTPADDING", (0, 0), (-1, -1), 4.5),
        ("TOPPADDING", (0, 0), (-1, -1), 5), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ])


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(.8)
    canvas.line(18 * mm, height - 15 * mm, width - 18 * mm, height - 15 * mm)
    canvas.setFont("Arial", 7)
    canvas.setFillColor(SOFT)
    canvas.drawString(18 * mm, 12 * mm, "USE ME WITH STYLE - PHASE 1 FINAL EVIDENCE MAP")
    canvas.drawRightString(width - 18 * mm, 12 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build_story():
    story = [
        Spacer(1, 15 * mm), Image(str(LOGO), width=58 * mm, height=30 * mm), Spacer(1, 8 * mm),
        p("CONTROLLED TECHNICAL RECORD", cover_sub), Spacer(1, 4 * mm),
        p("Phase 1 Final<br/>Evidence Map", cover_title), Spacer(1, 4 * mm),
        p("Approved, redacted evidence for closeout and client handoff", cover_sub), Spacer(1, 12 * mm),
        table(["Field", "Controlled value"], [
            ("Document", "UMWS-P1-EM-001"),
            ("Version", "1.0"),
            ("Issue date", "22 August 2026"),
            ("Owner", "Jose - project manager and QA owner"),
            ("Client approver", "Raisa"),
            ("Classification", "Client-shareable technical index; no secrets"),
            ("Storefront release", "a5ad493ed412ae21610a5ba0be726837e7b7c440"),
            ("CMS application baseline", "83bedc4e083cdc4fc5853f4efa245a6fa05a0443"),
            ("CMS documentation baseline", "1bd2feaf2e31e143b7cef0cba2a652fee79d1d7a"),
            ("Gate 6.3 status", "Evidence map issued and linked"),
        ], [48 * mm, 122 * mm]), Spacer(1, 7 * mm),
        callout("Purpose", "This map connects the accepted Phase 1 scope to authoritative tickets, controlled handoff documents, repository records and redacted operational evidence. It is an index, not a credential store or a replacement for the source artifacts.", "blue"),
        Spacer(1, 6 * mm), p("Security and disclosure boundary", h2),
    ]
    story += bullets([
        "No token, password, private key, recovery code, environment value, customer record or private access URL is reproduced.",
        "Provider evidence is referenced by public or access-controlled record identifier only; authorised operators use provider consoles for details.",
        "Secrets remain in approved provider secret stores and recovery custody locations defined in UMWS-P1-AR-001.",
        "The client-facing source of truth is the controlled Notion handoff page; Linear holds issue state and ownership.",
    ])

    story += [PageBreak(), p("1. Controlling scope and decision evidence", h1),
        table(["Control", "Authoritative evidence", "Disposition"], [
            ("Phase 1 scope and launch model", "Notion: Entrega da Fase 1 - Pacote Controlado; Linear project controlling description; JOS-52.", "WhatsApp checkout for AO/PT; accepted"),
            ("Payments", "JOS-57 and JOS-61; UMWS-P1-DR-001; Phase 1 limitations register.", "AppyPay live activation and Paybird are Phase 2; WhatsApp fallback remains"),
            ("Fiscal documents", "JOS-60; UMWS-P1-DR-001; UMWS-P1-LW-001.", "Internal non-fiscal documents accepted for Phase 1; certified providers deferred"),
            ("Returns", "Public 14-day policy; platform/docs/phase-2-returns-self-service.md; deferral register.", "14-day policy active; robust self-service workflow is Phase 2"),
            ("Authority and continuity", "UMWS-P1-AR-001; UMWS-P1-TR-001; controlled handoff page.", "Raisa operates and may pause sales; Jose owns technical response"),
            ("Client acceptance boundary", "JOS-55, JOS-56 and JOS-166; UMWS-P1-QA-001.", "Only catalogue/content, training and formal acceptance remain open"),
        ], [43 * mm, 82 * mm, 45 * mm]), Spacer(1, 7 * mm),
        callout("Precedence", "Where an older kickoff, status report or requirements page conflicts with this map, the controlled handoff page, reconciled Linear project and owner-approved closeout decisions take precedence. Historical pages remain marked as historical for traceability.", "gold"),
        p("Authoritative online records", h2),
    ]
    story += bullets([
        "Notion handoff: https://app.notion.com/p/3c4cb5a5fd7a813aaf2ef7c4a765785a",
        "Linear project: https://linear.app/joses-workspace-1/project/use-me-with-style-platform-37c7b8734a16",
        "Storefront repository: https://github.com/jose-nogueira1/use-me-with-style-platform",
        "CMS repository: https://github.com/jose-nogueira1/use-me-with-style-cms",
    ])

    story += [PageBreak(), p("2. Release and technical verification evidence", h1),
        table(["ID", "Evidence source", "What it proves"], [
            ("E01", "platform/docs/closeout/gate-1-technical-verification-2026-08-21.md", "Storefront lint, 149/149 tests, build/prerender, 30/30 browser E2E, domains and audit"),
            ("E02", "cms/docs/gate-1-technical-verification-2026-08-21.md", "CMS lint, 166 applicable tests, build, isolated PostgreSQL migration 20/20 and risk disposition"),
            ("E03", "platform/docs/closeout/gate-2-visual-qa-2026-08-21.md", "Responsive and brand QA; boundary for Raisa's final catalogue/content approval"),
            ("E04", "UMWS-P1-QA-001 - Final QA and Release Appendix", "Consolidated release IDs, tests, production snapshot, security and open sign-offs"),
            ("E05", "Vercel production release for storefront a5ad493e", "READY production deployment and AO/PT/apex aliases"),
            ("E06", "Railway/GitHub production deployment for CMS application baseline 83bedc4e", "Successful CMS production application deployment"),
            ("E07", "CMS documentation baseline 1bd2fea", "Controlled Gate 5 documents and QA appendix; no application/schema change"),
        ], [14 * mm, 81 * mm, 75 * mm]), Spacer(1, 7 * mm),
        callout("Verification summary", "The final QA appendix records storefront lint, 149/149 tests, 30/30 browser E2E, build with 80 prerendered routes, CMS lint, 166 applicable tests and 20/20 isolated PostgreSQL migration tests.", "green"),
        p("Security disposition", h2),
    ]
    story += bullets([
        "Storefront production dependency audit: zero runtime vulnerabilities.",
        "Critical and high findings were resolved before closeout.",
        "Six moderate transitive findings are confined to nested Payload migration tooling, accepted and monitored with no deployed runtime exposure.",
        "No unsafe forced dependency override was introduced.",
    ])

    story += [PageBreak(), p("3. Resilience and operations evidence", h1),
        table(["Control", "Evidence", "Result / owner"], [
            ("Transactional email", "Gate 3 production resilience record; Resend canary workflow reference.", "Delivery verified; Jose monitors now, Jose + Raisa at delivery"),
            ("Cloudflare R2 recovery", "cms/docs/closeout/gate-3-production-resilience-2026-08-21.md", "Upload/download/restore/checksum rehearsal passed; Jose"),
            ("PostgreSQL backup and restore", "Gate 3 record and encrypted backup workflow reference.", "Isolated restore passed; 64 tables / 824 rows / 205 seconds; Jose"),
            ("Inventory cleanup and heartbeat", "cms/docs/operations-observability.md; Gate 3 and Gate 4.5 records.", "45-minute freshness threshold; fail-closed alerting; Jose"),
            ("Operational monitor", "Operations monitor workflow reference and Gate 3 record.", "Production checks successful; Jose"),
            ("Incident tabletop", "cms/docs/closeout/gate-4-5-operational-tabletop-2026-08-22.md", "Outage, recovery, pause-sales and escalation paths rehearsed"),
            ("Rollback", "UMWS-P1-TR-001; platform/docs/production-domain-cutover.md", "Provider history + known-good commits + database recovery safeguards"),
            ("Credential lifecycle", "UMWS-P1-TR-001 and UMWS-P1-AR-001", "Manual rotation/recovery procedure; no secret values in documents"),
        ], [42 * mm, 83 * mm, 45 * mm]), Spacer(1, 7 * mm),
        p("Access-controlled execution records", h2),
    ]
    story += bullets([
        "Encrypted PostgreSQL backup workflow: GitHub Actions run 32548213282.",
        "Inventory heartbeat workflow: GitHub Actions run 32582540607.",
        "Operations monitor workflow: GitHub Actions run 32582636752.",
        "Email delivery canary workflow: GitHub Actions run 32563232296.",
        "Detailed logs remain within the authorised GitHub/provider account boundary and are not embedded in this PDF.",
    ])

    story += [PageBreak(), p("4. Controlled handoff artifact map", h1),
        table(["Document ID", "Controlled artifact", "Purpose / owner"], [
            ("UMWS-P1-HI-001", "Phase 1 Handoff Index", "Authoritative document list and control rules - Jose"),
            ("UMWS-P1-OG-001", "Client Operations Guide", "Portuguese client operations - Raisa / Jose"),
            ("UMWS-P1-TR-001", "Technical Production Runbook", "English deployment, recovery and incident procedures - Jose"),
            ("UMWS-P1-AR-001", "Production Account and Access Register", "No-secret account ownership and recovery metadata - Jose + Raisa"),
            ("UMWS-P1-LW-001", "Known Limitations and Workarounds Register", "Accepted limitations, owners and exit conditions - Jose + Raisa"),
            ("UMWS-P1-DR-001", "Phase 2/3 Deferral Register", "Deferred scope, dependencies and re-entry criteria - Jose + Raisa"),
            ("UMWS-P1-ATR-001", "Administrator Training Record", "Agenda, exercises, competency evidence and signatures - pending session"),
            ("UMWS-P1-QA-001", "Final QA and Release Appendix", "Technical verification, release state and exceptions - Jose"),
            ("UMWS-P1-EM-001", "Phase 1 Final Evidence Map", "This secret-free cross-reference - Jose"),
        ], [34 * mm, 65 * mm, 71 * mm]), Spacer(1, 7 * mm),
        callout("Distribution", "Approved client PDFs live on the controlled Notion handoff page. Technical sources and evidence remain in the repositories or provider consoles. Superseded records are retained and visibly labelled; they are not silently deleted.", "blue"),
        p("Record reconciliation", h2),
    ]
    story += bullets([
        "Gate 6.1: Linear reconciled on 22 August 2026. Only JOS-55, JOS-56 and JOS-166 remain open for client-owned closeout evidence.",
        "Gate 6.2: Notion reconciled on 22 August 2026. The controlled pack is the source of truth and stale pages are marked historical.",
        "Gate 6.3: this map links approved artifacts and redacted evidence without reproducing secrets.",
    ])

    story += [PageBreak(), p("5. Open approvals and final disposition", h1),
        table(["Open evidence", "Acceptance condition", "Owner"], [
            ("Production catalogue and photography", "Raisa approves active products, imagery, bilingual copy, prices, variants, stock, colour assignments and alt text.", "Raisa; JOS-166"),
            ("Final visual / brand approval", "Jose records the final visual review after client content is complete.", "Jose; JOS-55"),
            ("Administrator training", "Remote comprehensive session completed; recording, 18 exercises, competency result and signatures retained.", "Jose + Raisa; JOS-56"),
            ("Formal Phase 1 acceptance", "Raisa approves the final pack and Jose + Raisa record the commercial launch decision.", "Raisa / Jose; JOS-55"),
        ], [48 * mm, 82 * mm, 40 * mm]), Spacer(1, 7 * mm),
        callout("Gate 6.3", "ISSUED FOR ATTACHMENT - this evidence map contains only approved artifact links, repository paths, release identifiers and redacted operational references. No secret values are present.", "green"), Spacer(1, 5 * mm),
        callout("Phase 1 position", "CONDITIONAL - technical closeout is complete. Formal GO remains dependent on catalogue/content approval, completed administrator training and signed final acceptance.", "gold"),
        p("Approval record", h2),
        table(["Role", "Acknowledgement", "Date"], [
            ("Project manager / QA owner", "Jose - evidence map prepared and disclosure boundary checked", "22 Aug 2026"),
            ("Final pack approver", "Raisa - pending final handoff review", "________________"),
        ], [52 * mm, 88 * mm, 30 * mm]),
    ]
    return story


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUT), pagesize=A4, leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=21 * mm, bottomMargin=18 * mm,
        title="Use Me With Style - Phase 1 Final Evidence Map",
        author="Use Me With Style delivery team",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="normal")
    doc.addPageTemplates([PageTemplate(id="all", frames=[frame], onPage=header_footer)])
    doc.build(build_story())
    print(OUT)


if __name__ == "__main__":
    main()
