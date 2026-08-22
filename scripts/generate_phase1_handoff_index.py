from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "Use_Me_With_Style_Phase_1_Handoff_Index.pdf"
LOGO = ROOT / "src" / "assets" / "use-me-logo-black-transparent.png"

GOLD = colors.HexColor("#C99B2E")
GOLD_DARK = colors.HexColor("#7A5A19")
CREAM = colors.HexColor("#F7F0E3")
INK = colors.HexColor("#171411")
MUTED = colors.HexColor("#6D665E")
LINE = colors.HexColor("#DCCDAF")
GREEN = colors.HexColor("#E8F3EA")
BLUE = colors.HexColor("#EAF0F7")
GRAY = colors.HexColor("#F0EEEA")


pdfmetrics.registerFont(TTFont("UseMeArial", "/System/Library/Fonts/Supplemental/Arial.ttf"))
pdfmetrics.registerFont(TTFont("UseMeArialBold", "/System/Library/Fonts/Supplemental/Arial Bold.ttf"))


def p(text, style):
    return Paragraph(text, style)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.8)
    canvas.line(18 * mm, height - 16 * mm, width - 18 * mm, height - 16 * mm)
    canvas.setFont("UseMeArial", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, 10 * mm, "USE ME WITH STYLE - PHASE 1 CONTROLLED HANDOFF")
    canvas.drawRightString(width - 18 * mm, 10 * mm, f"Page {doc.page}")
    canvas.restoreState()


def build():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(OUTPUT),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=22 * mm,
        bottomMargin=17 * mm,
        title="Use Me With Style Phase 1 Handoff Index",
        author="Use Me With Style delivery team",
        subject="Authoritative document-control register for Phase 1 handoff",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="main")
    doc.addPageTemplates(PageTemplate(id="controlled", frames=[frame], onPage=header_footer))

    base = getSampleStyleSheet()
    title = ParagraphStyle(
        "Title",
        parent=base["Title"],
        fontName="UseMeArialBold",
        fontSize=22,
        leading=25,
        textColor=INK,
        alignment=TA_CENTER,
        spaceAfter=4 * mm,
    )
    kicker = ParagraphStyle(
        "Kicker",
        parent=base["Normal"],
        fontName="UseMeArialBold",
        fontSize=8,
        leading=10,
        textColor=GOLD_DARK,
        alignment=TA_CENTER,
        spaceAfter=2 * mm,
    )
    h1 = ParagraphStyle(
        "H1",
        parent=base["Heading1"],
        fontName="UseMeArialBold",
        fontSize=14,
        leading=17,
        textColor=INK,
        spaceBefore=5 * mm,
        spaceAfter=2.5 * mm,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=base["Heading2"],
        fontName="UseMeArialBold",
        fontSize=10,
        leading=13,
        textColor=GOLD_DARK,
        spaceBefore=3 * mm,
        spaceAfter=1.5 * mm,
    )
    body = ParagraphStyle(
        "Body",
        parent=base["BodyText"],
        fontName="UseMeArial",
        fontSize=8.6,
        leading=12,
        textColor=INK,
        spaceAfter=2 * mm,
    )
    small = ParagraphStyle(
        "Small",
        parent=body,
        fontSize=7.2,
        leading=9.2,
        spaceAfter=0,
    )
    small_bold = ParagraphStyle("SmallBold", parent=small, fontName="UseMeArialBold")
    table_head = ParagraphStyle(
        "TableHead",
        parent=small_bold,
        textColor=colors.white,
        alignment=TA_LEFT,
    )
    callout = ParagraphStyle(
        "Callout",
        parent=body,
        fontName="UseMeArialBold",
        textColor=GOLD_DARK,
        spaceAfter=0,
    )

    story = []
    if LOGO.exists():
        logo = Image(str(LOGO), width=49 * mm, height=24 * mm)
        logo.hAlign = "CENTER"
        story.extend([logo, Spacer(1, 2 * mm)])
    story.extend(
        [
            p("CONTROLLED CLIENT HANDOFF", kicker),
            p("Phase 1 Handoff Index", title),
            p("Authoritative document-control register", kicker),
            Spacer(1, 2 * mm),
        ]
    )

    control_data = [
        [p("Document ID", small_bold), p("UMWS-P1-HI-001", small)],
        [p("Version", small_bold), p("1.0", small)],
        [p("Issue date", small_bold), p("22 August 2026", small)],
        [p("Client pack format", small_bold), p("PDF-only; authoritative client copy maintained in Notion", small)],
        [p("Client-facing language", small_bold), p("Portuguese (Portugal); technical records remain in English", small)],
        [p("Final pack approver", small_bold), p("Raisa", small)],
        [p("Document-control owner", small_bold), p("Jose / delivery and technical owner", small)],
        [p("Security classification", small_bold), p("Operational; no passwords, tokens, private keys or recovery codes", small)],
    ]
    control = Table(control_data, colWidths=[43 * mm, 120 * mm], hAlign="LEFT")
    control.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(control)

    story.extend(
        [
            p("Purpose and authority", h1),
            p(
                "This register identifies the controlled Phase 1 handoff set, its authoritative sources, document owners, current status and supersession rules. A document is complete only when its evidence is attached or linked. Historical reports remain traceable but do not override the approved closeout baseline.",
                body,
            ),
        ]
    )
    decision_box = Table(
        [[p("CONTROL RULE", small_bold), p("The Notion client handoff page is the authoritative distribution point. Repository sources remain the technical master for versioned evidence and reproducible PDF generation.", callout)]],
        colWidths=[32 * mm, 131 * mm],
    )
    decision_box.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.8, GOLD),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story.append(decision_box)

    story.extend([p("Production snapshot", h1)])
    snapshot = [
        [p("System", table_head), p("Controlled reference", table_head), p("Position", table_head)],
        [p("Storefront platform", small_bold), p("main a5ad493ed412ae21610a5ba0be726837e7b7c440", small), p("Current Phase 1 release reference", small)],
        [p("CMS and operations", small_bold), p("main d439ca2678e6a3d0340282386012d8feae11323a", small), p("Current Phase 1 release reference", small)],
        [p("Public storefronts", small_bold), p("usemewithstyle.shop; ao.usemewithstyle.shop; pt.usemewithstyle.shop", small), p("Production", small)],
        [p("CMS", small_bold), p("cms.usemewithstyle.shop", small), p("Production", small)],
        [p("Approved operating model", small_bold), p("Manual WhatsApp checkout fallback and app-generated non-fiscal commercial invoices", small), p("Phase 1 accepted limitation", small)],
    ]
    snap_table = Table(snapshot, colWidths=[38 * mm, 83 * mm, 42 * mm], repeatRows=1)
    snap_table.setStyle(table_style())
    story.append(snap_table)

    story.extend([p("Authoritative handoff register", h1)])
    rows = [
        ["A01", "Phase 1 Handoff Index", "v1.0 / 22 Aug", "Authoritative", "Jose", "This PDF; Notion client handoff page"],
        ["A02", "Phase 1 Final Closeout Action Plan", "20 Aug", "Controlling plan", "Delivery lead", "Use_Me_With_Style_Phase_1_Final_Closeout_Action_Plan.pdf"],
        ["A03", "Phase 1 closeout baseline", "20 Aug", "Authoritative scope", "Delivery lead", "platform/docs/decisions/phase-1-closeout-baseline-2026-08-20.md"],
        ["A04", "Gate 1 technical verification - platform", "21 Aug", "QA evidence", "Jose", "platform/docs/closeout/gate-1-technical-verification-2026-08-21.md"],
        ["A05", "Gate 1 technical verification - CMS", "21 Aug", "QA evidence", "Jose", "cms/docs/gate-1-technical-verification-2026-08-21.md"],
        ["A06", "Gate 2 visual QA", "21 Aug", "QA evidence", "Jose / brand approval", "platform/docs/closeout/gate-2-visual-qa-2026-08-21.md"],
        ["A07", "Gate 3 production resilience evidence", "21 Aug", "Recovery evidence", "Jose", "cms/docs/closeout/gate-3-production-resilience-2026-08-21.md"],
        ["A08", "Gate 4.5 operational tabletop", "22 Aug", "Operations evidence", "Jose", "cms/docs/closeout/gate-4-5-operational-tabletop-2026-08-22.md"],
        ["A09", "Operations observability guide", "Current", "Supporting runbook", "Jose", "cms/docs/operations-observability.md"],
        ["A10", "Production domain cutover", "Current", "Supporting runbook", "Jose", "platform/docs/production-domain-cutover.md"],
        ["A11", "Environment and secret-placement rules", "Current", "Supporting control", "Jose", "platform/docs/environments.md"],
    ]
    story.append(register_table(rows, table_head, small, small_bold))

    story.extend([p("Gate 5 documents under production", h1)])
    planned = [
        ["P01", "Client operations guide", "Gate 5.2", "Portuguese", "Raisa", "Planned"],
        ["P02", "Technical production runbook", "Gate 5.3", "English", "Jose", "Planned"],
        ["P03", "Production account and access register", "Gate 5.4", "English", "Jose + Raisa", "Owner-confirmed; PDF pending"],
        ["P04", "Known limitations and workarounds", "Gate 5.5", "Portuguese", "Jose + Raisa", "Limitations accepted; PDF pending"],
        ["P05", "Phase 2/3 deferral register", "Gate 5.6", "Portuguese", "Delivery owners", "Deferrals accepted; PDF pending"],
        ["P06", "Administrator training record", "Gate 5.7 / Gate 6", "Portuguese", "Jose + Raisa", "Meeting, recording and sign-off pending"],
        ["P07", "Final QA and release appendix", "Gate 5.8", "English", "Jose", "Pending final evidence consolidation"],
    ]
    story.append(register_table(planned, table_head, small, small_bold, headers=["ID", "Document", "Gate", "Language", "Owner", "Status"]))

    story.extend([p("Historical and superseded records", h1)])
    historical = [
        ["H01", "Original Phase 1 Delivery Checklist", "Historical", "Superseded by the 13 Aug updated checklist and 20 Aug closeout baseline"],
        ["H02", "Phase 1 Remaining Delivery Report", "Historical", "Supporting context only; later gate evidence controls completion"],
        ["H03", "Phase 1 Deep Status Update - 12 Aug", "Historical Notion snapshot", "Retain for traceability; do not use as current delivery status"],
        ["H04", "Prototype guides and early build logs", "Historical", "Product discovery context; not production operating instructions"],
        ["H05", "Earlier payment/fiscal launch assumptions", "Superseded decision", "Integrated payments and certified fiscal providers are Phase 2; current fallback is documented"],
    ]
    story.append(historical_table(historical, table_head, small, small_bold))

    story.extend(
        [
            p("Document-control rules", h1),
            p("1. The Notion handoff page distributes only approved PDFs to the client.", body),
            p("2. Repository sources and generator scripts remain internal technical masters and must be version controlled.", body),
            p("3. Every revision receives a version, issue date, owner and concise change note.", body),
            p("4. Superseded documents remain accessible and visibly marked; they are never silently deleted.", body),
            p("5. No handoff artifact may contain passwords, tokens, private keys, recovery codes or unredacted secret values.", body),
            p("6. Final acceptance references this index version and the final QA/release appendix.", body),
            p("Approval status", h1),
        ]
    )
    approval = [
        [p("Prepared by", small_bold), p("Jose - delivery and technical owner", small), p("Date", small_bold), p("22 August 2026", small)],
        [p("Client approver", small_bold), p("Raisa", small), p("Status", small_bold), p("Pending final Gate 5 pack approval", small)],
        [p("Next controlled action", small_bold), p("Gate 5.2 - Client Operations Guide", small), p("Distribution", small_bold), p("Notion client handoff page", small)],
    ]
    approval_table = Table(approval, colWidths=[31 * mm, 63 * mm, 24 * mm, 45 * mm])
    approval_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), CREAM),
                ("BOX", (0, 0), (-1, -1), 0.6, LINE),
                ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(approval_table)

    doc.build(story)
    print(OUTPUT)


def table_style():
    return TableStyle(
        [
            ("BACKGROUND", (0, 0), (-1, 0), INK),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, CREAM]),
            ("BOX", (0, 0), (-1, -1), 0.6, LINE),
            ("INNERGRID", (0, 0), (-1, -1), 0.3, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]
    )


def register_table(rows, head_style, cell_style, bold_style, headers=None):
    headers = headers or ["ID", "Document", "Version/date", "Status", "Owner", "Source/location"]
    data = [[p(value, head_style) for value in headers]]
    for row in rows:
        data.append([p(row[0], bold_style)] + [p(value, cell_style) for value in row[1:]])
    table = Table(data, colWidths=[12 * mm, 41 * mm, 24 * mm, 27 * mm, 25 * mm, 34 * mm], repeatRows=1)
    table.setStyle(table_style())
    return table


def historical_table(rows, head_style, cell_style, bold_style):
    data = [[p(value, head_style) for value in ["ID", "Record", "Classification", "Control note"]]]
    for row in rows:
        data.append([p(row[0], bold_style)] + [p(value, cell_style) for value in row[1:]])
    table = Table(data, colWidths=[13 * mm, 45 * mm, 36 * mm, 69 * mm], repeatRows=1)
    table.setStyle(table_style())
    return table


if __name__ == "__main__":
    build()
