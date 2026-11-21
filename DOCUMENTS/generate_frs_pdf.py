"""
FRS PDF Generator for FuelTaxPulse Enterprise
Generates a dedicated, comprehensive Functional Requirement Specifications (FRS) document.
"""

import sys
from datetime import datetime

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfgen import canvas

class NumberedCanvasFRS(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        if self._pageNumber == 1:
            return

        self.saveState()
        self.setFont("Helvetica", 8)
        self.setFillColor(colors.HexColor("#475569"))

        # Header
        self.drawString(54, 752, "FuelTaxPulse Enterprise — Functional Requirement Specifications (FRS)")
        self.setStrokeColor(colors.HexColor("#CBD5E1"))
        self.setLineWidth(0.75)
        self.line(54, 744, 558, 744)

        # Footer
        self.line(54, 45, 558, 45)
        self.drawString(54, 32, "Confidential — FuelTaxPulse Enterprise Compliance Platform | FRS Document")
        page_str = f"Page {self._pageNumber} of {page_count}"
        self.drawRightString(558, 32, page_str)
        self.restoreState()


def build_frs_pdf(filename):
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        leftMargin=54,
        rightMargin=54,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    NAVY = colors.HexColor("#0F172A")
    BLUE_HEADER = colors.HexColor("#1E3A8A")
    ACCENT_BLUE = colors.HexColor("#2563EB")
    SLATE = colors.HexColor("#334155")
    MUTED = colors.HexColor("#64748B")
    LIGHT_BG = colors.HexColor("#F8FAFC")
    BORDER_COLOR = colors.HexColor("#E2E8F0")

    styles.add(ParagraphStyle(
        'CoverTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=26,
        leading=32,
        textColor=NAVY,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'CoverSubtitle',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=13,
        leading=18,
        textColor=ACCENT_BLUE,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'CoverMetaLabel',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=13,
        textColor=MUTED
    ))
    styles.add(ParagraphStyle(
        'CoverMetaValue',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=9,
        leading=13,
        textColor=SLATE
    ))
    styles.add(ParagraphStyle(
        'SectionH1',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=16,
        leading=20,
        textColor=BLUE_HEADER,
        spaceBefore=14,
        spaceAfter=6,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'SectionH2',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=12,
        leading=16,
        textColor=NAVY,
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'SectionH3',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9.5,
        leading=13,
        textColor=SLATE,
        spaceBefore=6,
        spaceAfter=2,
        keepWithNext=True
    ))
    styles.add(ParagraphStyle(
        'BodyCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=SLATE,
        spaceBefore=2,
        spaceAfter=4,
        alignment=TA_JUSTIFY
    ))
    styles.add(ParagraphStyle(
        'BulletCustom',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=12.5,
        textColor=SLATE,
        leftIndent=14,
        firstLineIndent=-10,
        spaceBefore=1,
        spaceAfter=2
    ))
    styles.add(ParagraphStyle(
        'TableHeader',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8,
        leading=11,
        textColor=colors.white,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'TableCell',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7.5,
        leading=10.5,
        textColor=SLATE,
        alignment=TA_LEFT
    ))
    styles.add(ParagraphStyle(
        'TableCellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=7.5,
        leading=10.5,
        textColor=NAVY,
        alignment=TA_LEFT
    ))

    story = []

    # COVER PAGE
    story.append(Spacer(1, 40))
    story.append(Paragraph("FuelTaxPulse Enterprise", styles['CoverSubtitle']))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Functional Requirement Specifications (FRS)", styles['CoverTitle']))
    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "Commercial IFTA & Multi-State Mileage Compliance Platform — Complete Functional Modules, "
        "User Interface Workflows, Validation Rules & Regulatory Deliverables",
        styles['CoverSubtitle']
    ))
    story.append(Spacer(1, 16))
    story.append(HRFlowable(width="100%", thickness=3, color=ACCENT_BLUE, spaceBefore=4, spaceAfter=24))

    meta_data = [
        [Paragraph("Document ID:", styles['CoverMetaLabel']), Paragraph("FTP-FRS-2026-V1.1", styles['CoverMetaValue'])],
        [Paragraph("Document Type:", styles['CoverMetaLabel']), Paragraph("Functional Requirement Specifications (FRS)", styles['CoverMetaValue'])],
        [Paragraph("Version / Edition:", styles['CoverMetaLabel']), Paragraph("1.1 Enterprise Production Release", styles['CoverMetaValue'])],
        [Paragraph("Publishing Organization:", styles['CoverMetaLabel']), Paragraph("SvisionTek — Engineering & Regulatory Compliance Division", styles['CoverMetaValue'])],
        [Paragraph("Jurisdiction Coverage:", styles['CoverMetaLabel']), Paragraph("58 IFTA Member Jurisdictions (48 Contiguous US States + DC + 10 Canadian Provinces)", styles['CoverMetaValue'])],
        [Paragraph("Fuel Classification:", styles['CoverMetaLabel']), Paragraph("Diesel Fuel Only (Standard Fuel Use Tax Classification)", styles['CoverMetaValue'])],
        [Paragraph("Publication Date:", styles['CoverMetaLabel']), Paragraph(datetime.now().strftime("%B %d, %Y"), styles['CoverMetaValue'])],
        [Paragraph("Security Classification:", styles['CoverMetaLabel']), Paragraph("Confidential — Proprietary Business Specification", styles['CoverMetaValue'])],
    ]
    meta_table = Table(meta_data, colWidths=[140, 364])
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('BACKGROUND', (0, 0), (-1, -1), LIGHT_BG),
        ('BOX', (0, 0), (-1, -1), 1, BORDER_COLOR),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#F1F5F9")),
    ]))
    story.append(meta_table)

    story.append(Spacer(1, 30))
    story.append(Paragraph(
        "<b>Document Purpose:</b> This document establishes the formal Functional Requirement Specifications (FRS) "
        "for FuelTaxPulse Enterprise. It defines user personas, business workflows, detailed module functions (Modules 1–12), "
        "data ingestion standards, automated validation rules, reporting specifications, and acceptance verification criteria.",
        styles['BodyCustom']
    ))
    story.append(PageBreak())

    # SECTION 1: BUSINESS CONTEXT & USER ROLES
    story.append(Paragraph("1. Business Context & User Personas", styles['SectionH1']))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    story.append(Paragraph("1.1 Business Objective", styles['SectionH2']))
    story.append(Paragraph(
        "The primary objective of FuelTaxPulse Enterprise is to provide commercial motor carriers and compliance consultants "
        "with an automated, accurate, and audit-proof IFTA quarterly tax filing and reporting system. It consolidates GPS/ELD "
        "mileage feeds and fuel card transactions into standardized Schedule 1 tax returns, state DMV e-file EDI files, "
        "and four-year audit defense packages while preventing duplicate records, calculations errors, and non-compliance penalties.",
        styles['BodyCustom']
    ))

    story.append(Paragraph("1.2 User Roles & Operational Responsibilities", styles['SectionH2']))
    role_data = [
        [Paragraph("User Persona", styles['TableHeader']), Paragraph("Access Scope", styles['TableHeader']), Paragraph("Functional Responsibilities", styles['TableHeader'])],
        [
            Paragraph("Carrier Fleet Manager", styles['TableCellBold']),
            Paragraph("Carrier Fleet & Vehicles", styles['TableCell']),
            Paragraph("Manages vehicle inventory, enters power units, imports monthly fuel/mileage CSVs, resolves staging errors, and reviews quarterly tax estimates.", styles['TableCell'])
        ],
        [
            Paragraph("Compliance Tax Officer", styles['TableCellBold']),
            Paragraph("Full Organization Scope", styles['TableCell']),
            Paragraph("Audits compliance warnings, finalizes/locks reporting quarters, exports official Schedule 1 PDFs/CSVs, downloads state DMV E-File packages, and manages 58-jurisdiction rates.", styles['TableCell'])
        ],
        [
            Paragraph("Data Entry Specialist", styles['TableCellBold']),
            Paragraph("Operational Data Grids", styles['TableCell']),
            Paragraph("Performs manual fuel transaction entries, calculates ZIP-to-ZIP highway distances, and enters corridor mileage records.", styles['TableCell'])
        ],
        [
            Paragraph("Auditor / State Examiner", styles['TableCellBold']),
            Paragraph("Read-Only Audit Trail", styles['TableCell']),
            Paragraph("Inspects immutable 4-year audit defense ZIP packages, raw CSV receipts, odometer continuity chains, and timestamped quarter freeze snapshots.", styles['TableCell'])
        ],
    ]
    role_table = Table(role_data, colWidths=[110, 110, 284])
    role_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE_HEADER),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(role_table)

    story.append(Spacer(1, 10))

    # SECTION 2: MODULE SPECIFICATIONS
    story.append(Paragraph("2. Detailed Functional Specifications (Modules 1–12)", styles['SectionH1']))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    # Module 1
    story.append(Paragraph("2.1 Module 1 — Customer Master & Banking Security", styles['SectionH2']))
    story.append(Paragraph("• <b>6-Tab Navigation Workflow:</b> Customer modal organized into six progressive tabs: <i>Info</i>, <i>Accounts</i>, <i>Options</i>, <i>Notes</i>, <i>Employee Access</i>, and <i>Customer Access</i>.", styles['BulletCustom']))
    story.append(Paragraph("• <b>UI Clutter Removal:</b> Removed non-operational 'Other Information' fields (Date Incorporated, State of Incorporation, Corp Number, Officer SSN/Title) from the Info tab UI while preserving database columns for historical integrity.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Customer Access Tab Gate:</b> The primary 'Save Customer' action button is disabled across tabs 1–5 and enables only when the user reaches the final Customer Access tab, guaranteeing full profile completion.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Regulatory Banking Validation:</b> Bank Routing Number is strictly validated against the 9-digit ABA numeric specification (rejecting 8- or 10-digit inputs with HTTP 400). Bank Account Number preserves leading zeros as text strings. Both fields feature password-masked inputs in the UI.", styles['BulletCustom']))

    # Module 2 & 3
    story.append(Spacer(1, 4))
    story.append(Paragraph("2.2 Modules 2 & 3 — Standardized Mileage & Fuel Purchase Ingestion", styles['SectionH2']))
    story.append(Paragraph("• <b>Standard 6-Column Mileage Format:</b> Streamlined to <code>Vehicle ID, Jurisdiction, Total Distance, Taxable Distance, Exempt Distance, Date</code>. Odometer Start/End and BOL Numbers are eliminated from standard templates.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Backward Tolerance:</b> Ingestion engine automatically detects and ignores legacy columns without throwing parse exceptions.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Standard 4-Column Fuel Format:</b> Restricted strictly to <code>Unit Number, State, Quantity, Transaction Date</code>. Extraneous merchant details, net amounts, and product columns are filtered out.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Auto-Defaulting:</b> Fuel type is hard-locked to <code>DIESEL</code> and tax status is defaulted to <code>tax_paid_at_pump = True</code>.", styles['BulletCustom']))

    # Module 4 & 5
    story.append(Spacer(1, 4))
    story.append(Paragraph("2.3 Modules 4 & 5 — ZIP-to-ZIP Highway Calculation & Manual Entry Utilities", styles['SectionH2']))
    story.append(Paragraph("• <b>5-Digit US Postal Code Validation:</b> Enforces strict 5-digit US postal code format (`^\\d{5}$`), explicitly rejecting invalid entries (e.g. `00000`, `99999`, non-numeric strings).", styles['BulletCustom']))
    story.append(Paragraph("• <b>Spatial Centroid Resolution:</b> Coordinates resolved from commercial freight hub centroids and 3-digit USPS Sectional Center Facility (SCF) prefixes.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Circuity Calculation:</b> Computes great-circle Haversine distance and applies the official FHWA 1.18x circuity factor to determine road miles.", styles['BulletCustom']))
    story.append(Paragraph("• <b>1-Click Integration:</b> Calculated distance can be committed directly into active fleet mileage data or exported as a 4-column CSV (<code>Vehicle ID, Jurisdiction, Total Distance, Date</code>).", styles['BulletCustom']))
    story.append(Paragraph("• <b>Manual Entry Grids:</b> Dedicated manual entry screens for fuel purchases and mileage records with duplicate prevention and live UI table refresh.", styles['BulletCustom']))

    # Module 6 & 7
    story.append(Spacer(1, 4))
    story.append(Paragraph("2.4 Modules 6 & 7 — Diesel Standard & Atomic CSV Upsert Pipeline", styles['SectionH2']))
    story.append(Paragraph("• <b>Single Fuel Standard:</b> Removed Fuel Type selection dropdown from the application header, locking all calculations, database queries, and exports to Diesel.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Composite Business Keys:</b> Uniquely identifies existing records to eliminate duplicate creation on re-upload:", styles['BulletCustom']))
    story.append(Paragraph("  - <i>Mileage Key:</i> <code>(fleet_id, reporting_quarter, unit_number, jurisdiction, normalized_trip_date)</code>", styles['BulletCustom']))
    story.append(Paragraph("  - <i>Fuel Key:</i> <code>(fleet_id, reporting_quarter, unit_number, jurisdiction, normalized_transaction_date)</code>", styles['BulletCustom']))
    story.append(Paragraph("• <b>Date Normalization:</b> Automatically translates multi-variant date inputs (Excel floats, `M/D/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`) into uniform ISO `YYYY-MM-DD` strings.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Taxable Distance Synchronization:</b> When Total Distance is updated, Taxable Distance automatically recalculates as <code>max(0.0, Total Distance - Exempt Distance)</code>.", styles['BulletCustom']))
    story.append(Paragraph("• <b>5-Metric Import Summary Card:</b> Displays real-time breakdown upon staging/commit: <i>Total Records</i>, <i>New Inserted</i>, <i>Existing Updated</i>, <i>Duplicate Skipped</i>, and <i>Failed Rows</i>.", styles['BulletCustom']))

    story.append(PageBreak())

    # Module 8, 9, 10, 11, 12
    story.append(Paragraph("2.5 Modules 8–12 — Surcharges, Vehicles, Reporting & Compliance", styles['SectionH2']))
    story.append(Paragraph("• <b>Module 8 (Weight-Distance Taxes):</b> Computes additional distance tax for KY ($0.0285/mi + $0.105/gal surcharge), NM ($0.04378/mi), NY ($0.0150/mi), and OR ($0.0650/mi).", styles['BulletCustom']))
    story.append(Paragraph("• <b>Module 9 (Power Unit Editing):</b> Full vehicle inventory editing via <code>PUT /api/vehicles/{id}</code> with 17-char VIN validation without altering historical fuel or mileage logs.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Module 10 (Unit Summary Reporting & PDF):</b> Multi-tier filtering by Unit Number, State, Date Range, and Quarter, paired with print-ready landscape PDF export.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Module 11 (58-Jurisdiction Rate Matrix):</b> Triple-action rate management: official IFTA CSV/Excel spreadsheet upload, external JSON/CSV API endpoint synchronization, and single-jurisdiction modal editing.", styles['BulletCustom']))
    story.append(Paragraph("• <b>Module 12 (Compliance Verification & Quarter Freeze):</b> Automated pre-filing audit checking quarter boundaries, duplicate batches, MPG anomalies (4.0–10.0 MPG), orphaned fuel/miles, and odometer continuity, with cryptographic quarter locking.", styles['BulletCustom']))

    story.append(Spacer(1, 10))

    # SECTION 3: REPORTING DELIVERABLES
    story.append(Paragraph("3. Standard Reporting Deliverables", styles['SectionH1']))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    rep_data = [
        [Paragraph("Deliverable Report", styles['TableHeader']), Paragraph("Format", styles['TableHeader']), Paragraph("Statutory / Operational Scope", styles['TableHeader'])],
        [
            Paragraph("IFTA Schedule 1 Tax Return", styles['TableCellBold']),
            Paragraph("PDF (Landscape) & CSV", styles['TableCell']),
            Paragraph("Official quarterly tax return listing all 58 member jurisdictions, total/taxable miles, taxable gallons, tax-paid gallons, net tax gallons, tax rates, surcharges, and total balance.", styles['TableCell'])
        ],
        [
            Paragraph("State DMV E-File Package", styles['TableCellBold']),
            Paragraph("EDI / CSV", styles['TableCell']),
            Paragraph("State-specific electronic filing format formatted for direct upload to state Department of Motor Vehicles / Department of Revenue portals.", styles['TableCell'])
        ],
        [
            Paragraph("State-Wise Unit Summary", styles['TableCellBold']),
            Paragraph("PDF & CSV", styles['TableCell']),
            Paragraph("Vehicle-level breakdown detailing state miles, fuel gallons, purchases, receipts, and estimated IFTA liability per power unit.", styles['TableCell'])
        ],
        [
            Paragraph("4-Column Fuel Purchases Export", styles['TableCellBold']),
            Paragraph("CSV", styles['TableCell']),
            Paragraph("Export containing Unit Number, State, Quantity, and Transaction Date for carrier accounting reconciliation.", styles['TableCell'])
        ],
        [
            Paragraph("6-Column Mileage Records Export", styles['TableCellBold']),
            Paragraph("CSV", styles['TableCell']),
            Paragraph("Export containing Vehicle ID, Jurisdiction, Total Distance, Taxable Distance, Exempt Distance, and Date.", styles['TableCell'])
        ],
        [
            Paragraph("4-Year Audit Defense Package", styles['TableCellBold']),
            Paragraph("Encrypted ZIP", styles['TableCell']),
            Paragraph("Comprehensive audit package bundling Schedule 1 PDF/CSV, raw source files, odometer verification trails, rate matrix snapshot, and immutable audit logs.", styles['TableCell'])
        ],
    ]
    rep_table = Table(rep_data, colWidths=[130, 84, 290])
    rep_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE_HEADER),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(rep_table)

    story.append(Spacer(1, 14))

    # SECTION 4: ACCEPTANCE MATRIX & SIGN-OFF
    story.append(Paragraph("4. Functional Acceptance Matrix & Approval Sign-Off", styles['SectionH1']))
    story.append(HRFlowable(width="100%", thickness=1, color=BORDER_COLOR, spaceBefore=2, spaceAfter=8))

    acc_data = [
        [Paragraph("Feature ID", styles['TableHeader']), Paragraph("Requirement Statement", styles['TableHeader']), Paragraph("Verification Condition", styles['TableHeader']), Paragraph("Sign-Off", styles['TableHeader'])],
        [Paragraph("FR-01", styles['TableCellBold']), Paragraph("Customer tab gating", styles['TableCell']), Paragraph("Save customer disabled on tabs 1-5; active on tab 6.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-02", styles['TableCellBold']), Paragraph("9-digit routing validation", styles['TableCell']), Paragraph("Strict rejection of 8 or 10 digits; accepts exact 9.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-03", styles['TableCellBold']), Paragraph("Leading zero account preservation", styles['TableCell']), Paragraph("Preserves strings like '000482910' without truncation.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-04", styles['TableCellBold']), Paragraph("6-column mileage format", styles['TableCell']), Paragraph("Omits BOL & odometers; preserves core fields.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-05", styles['TableCellBold']), Paragraph("4-column fuel format", styles['TableCell']), Paragraph("Exports Unit, State, Quantity, Date strictly.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-06", styles['TableCellBold']), Paragraph("ZIP-to-ZIP calculation", styles['TableCell']), Paragraph("Accurate Haversine + 1.18 circuity road miles.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-07", styles['TableCellBold']), Paragraph("Atomic CSV upsert", styles['TableCell']), Paragraph("Upserts matching composite keys; renders 5 cards.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-08", styles['TableCellBold']), Paragraph("Power unit metadata edit", styles['TableCell']), Paragraph("Updates unit specs without altering historical logs.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-09", styles['TableCellBold']), Paragraph("Unit summary report & PDF", styles['TableCell']), Paragraph("Multi-tier filtering and landscape PDF generation.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
        [Paragraph("FR-10", styles['TableCellBold']), Paragraph("58-jurisdiction rate matrix", styles['TableCell']), Paragraph("Tri-modal update mechanism and CSV template export.", styles['TableCell']), Paragraph("ACCEPTED", styles['TableCellBold'])],
    ]
    acc_table = Table(acc_data, colWidths=[44, 150, 240, 70])
    acc_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), BLUE_HEADER),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 2.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 2.5),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, LIGHT_BG]),
    ]))
    story.append(acc_table)

    story.append(Spacer(1, 14))
    sign_data = [
        [Paragraph("Stakeholder", styles['TableCellBold']), Paragraph("Organization", styles['TableCellBold']), Paragraph("Decision", styles['TableCellBold']), Paragraph("Date", styles['TableCellBold'])],
        [Paragraph("Lead Functional Architect", styles['TableCell']), Paragraph("SvisionTek Engineering", styles['TableCell']), Paragraph("APPROVED", styles['TableCellBold']), Paragraph(datetime.now().strftime("%Y-%m-%d"), styles['TableCell'])],
        [Paragraph("IFTA Regulatory Specialist", styles['TableCell']), Paragraph("Compliance & Operations", styles['TableCell']), Paragraph("VERIFIED", styles['TableCellBold']), Paragraph(datetime.now().strftime("%Y-%m-%d"), styles['TableCell'])],
    ]
    sign_table = Table(sign_data, colWidths=[140, 180, 94, 90])
    sign_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), LIGHT_BG),
        ('GRID', (0, 0), (-1, -1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    story.append(sign_table)

    doc.build(story, canvasmaker=NumberedCanvasFRS)
    print(f"FRS PDF successfully generated at: {filename}")

if __name__ == "__main__":
    out_path = sys.argv[1] if len(sys.argv) > 1 else "FuelTaxPulse_Functional_Requirement_Specifications_FRS.pdf"
    build_frs_pdf(out_path)
