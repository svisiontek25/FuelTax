"""
FuelTaxPulse PDF Tax Schedule & Unit Summary Generator
Generates:
1. Official Landscape IFTA Schedule 1 Fleet Fuel Tax Summary PDF
2. Vehicle-Level State-Wise Unit Summary PDF Report (Module 10 - Single Unit or All Units)
"""

import io
from datetime import datetime
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

def generate_pdf_bytes(report_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=0.35 * inch,
        rightMargin=0.35 * inch,
        topMargin=0.35 * inch,
        bottomMargin=0.35 * inch
    )

    styles = getSampleStyleSheet()
    meta = report_data["metadata"]
    rows = report_data["rows"]
    totals = report_data["totals"]

    story = []

    title_style = ParagraphStyle(
        'RepTitle',
        parent=styles['Heading1'],
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#0f172a'),
        fontName='Helvetica-Bold'
    )
    story.append(Paragraph("Fleet Fuel Tax Summary", title_style))
    story.append(Spacer(1, 4))

    meta_data = [
        [
            Paragraph(f"<b>Company:</b> {meta.get('company_name', '')}", styles['Normal']),
            Paragraph(f"<b>Period:</b> {meta.get('period', '')}", styles['Normal']),
            Paragraph(f"<b>Total Units:</b> {meta.get('total_units', 0)}", styles['Normal']),
            Paragraph("<b>Fuel Type:</b> Diesel", styles['Normal']),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[220, 180, 140, 140])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    box_w = 110
    kpi_headers = ["Trip Count", "Total Miles", "Total Fuel (gal)", "Fleet MPG", "Total Due"]
    kpi_values = [
        str(meta.get("trip_count", 0)),
        f"{meta.get('total_miles', 0):,}",
        f"{meta.get('total_fuel', 0):,}",
        f"{meta.get('fleet_mpg', 0):.2f}",
        f"${meta.get('total_due', 0):,.2f}"
    ]
    kpi_table_data = [
        [Paragraph(f"<b>{h}</b>", styles['Normal']) for h in kpi_headers],
        [Paragraph(f"<b>{v}</b>", styles['Normal']) for v in kpi_values]
    ]
    kpi_table = Table(kpi_table_data, colWidths=[box_w]*5)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-2,0), colors.HexColor('#f1f5f9')),
        ('BACKGROUND', (-1,0), (-1,0), colors.HexColor('#fee2e2')),
        ('BACKGROUND', (-1,1), (-1,1), colors.HexColor('#fff1f2')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#cbd5e1')),
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('FONTSIZE', (0,1), (-1,1), 12),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 10))

    table_headers = [
        "State", "All\nMiles", "Non Toll\nMiles", "Toll\nMiles", "Thru\nToll",
        "Permit\nMiles", "Off\nRoad", "Taxable\nMiles", "All\nGal", "Non-Tax\nGal",
        "Tax Paid\nGal", "Taxable\nGal", "Net Tax\nGal", "Tax\nRate", "Interest",
        "IFTA Tax\nDue ($)", "Mile Tax\nDue ($)"
    ]

    col_w = [34, 44, 44, 34, 34, 38, 34, 46, 40, 42, 44, 44, 44, 42, 38, 52, 52]
    table_data = [[Paragraph(f"<b>{h.replace(chr(10), '<br/>')}</b>", styles['Normal']) for h in table_headers]]

    for r in rows:
        def fmt_curr(val):
            if val == "" or val is None:
                return ""
            try:
                num = float(val)
                if num < 0:
                    return f"({abs(num):.2f})"
                return f"{num:.2f}"
            except Exception:
                return str(val)

        row_cells = [
            r["state"],
            f"{r['all_miles']:,}" if isinstance(r['all_miles'], int) and r['all_miles'] != "" else str(r['all_miles']),
            f"{r['non_toll_miles']:,}" if isinstance(r['non_toll_miles'], int) and r['non_toll_miles'] != "" else str(r['non_toll_miles']),
            str(r['toll_miles']),
            str(r['thruway_toll_miles']),
            str(r['permitted_miles']),
            str(r['off_road_miles']),
            f"{r['taxable_miles']:,}" if isinstance(r['taxable_miles'], int) and r['taxable_miles'] != "" else str(r['taxable_miles']),
            f"{r['all_gallons']:,}" if isinstance(r['all_gallons'], int) and r['all_gallons'] != "" else str(r['all_gallons']),
            str(r['non_tax_paid_gallons']),
            f"{r['tax_paid_gallons']:,}" if isinstance(r['tax_paid_gallons'], int) and r['tax_paid_gallons'] != "" else str(r['tax_paid_gallons']),
            f"{r['taxable_gallons']:,}" if isinstance(r['taxable_gallons'], int) and r['taxable_gallons'] != "" else str(r['taxable_gallons']),
            f"{r['net_taxable_gallons']:,}" if isinstance(r['net_taxable_gallons'], int) and r['net_taxable_gallons'] != "" else str(r['net_taxable_gallons']),
            str(r['tax_rate']),
            str(r['interest']),
            fmt_curr(r['ifta_tax_due']),
            fmt_curr(r['approx_mile_tax_due'])
        ]
        table_data.append([Paragraph(str(c), styles['Normal']) for c in row_cells])

    tot_cells = [
        "Totals",
        f"{totals['all_miles']:,}",
        f"{totals['non_toll_miles']:,}",
        str(totals['toll_miles']),
        str(totals['thruway_toll_miles']),
        str(totals['permitted_miles']),
        str(totals['off_road_miles']),
        f"{totals['taxable_miles']:,}",
        f"{totals['all_gallons']:,}",
        str(totals['non_tax_paid_gallons']),
        f"{totals['tax_paid_gallons']:,}",
        f"{totals['taxable_gallons']:,}",
        f"{totals['net_taxable_gallons']:,}",
        "",
        str(totals['interest']),
        str(totals['ifta_tax_due']),
        str(totals['approx_mile_tax_due'])
    ]
    table_data.append([Paragraph(f"<b>{c}</b>", styles['Normal']) for c in tot_cells])

    report_table = Table(table_data, colWidths=col_w, repeatRows=1)
    report_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0284c7')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 7),
        ('ALIGN', (0,0), (0,-1), 'LEFT'),
        ('ALIGN', (1,0), (-1,-1), 'RIGHT'),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
        ('LINEABOVE', (0,-1), (-1,-1), 1.5, colors.HexColor('#0f172a')),
        ('TOPPADDING', (0,0), (-1,-1), 2),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(report_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()


def generate_unit_summary_pdf_bytes(unit_report: dict) -> bytes:
    """
    Module 10: Generates print-ready Landscape PDF for Vehicle-Level State-Wise Unit Summary Report.
    Includes:
    - Company / Application Name
    - Report Title
    - Selected Unit Number (e.g., 'Unit 101' or 'All Power Units')
    - Reporting Period & Filters
    - State-Wise Details Table
    - Total Mileage, Fuel, and Tax Summary
    - Report Generation Date
    """
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(letter),
        leftMargin=0.4 * inch,
        rightMargin=0.4 * inch,
        topMargin=0.4 * inch,
        bottomMargin=0.4 * inch
    )

    styles = getSampleStyleSheet()
    story = []

    title_style = ParagraphStyle(
        'UnitRepTitle',
        parent=styles['Heading1'],
        fontSize=16,
        leading=20,
        textColor=colors.HexColor('#1B365D'),
        fontName='Helvetica-Bold'
    )
    sub_style = ParagraphStyle(
        'UnitRepSub',
        parent=styles['Normal'],
        fontSize=9,
        leading=12,
        textColor=colors.HexColor('#475569')
    )

    company_name = unit_report.get("company_name", "FuelTaxPulse Enterprise Carrier")
    selected_unit = unit_report.get("selected_unit") or "ALL"
    unit_label = "All Power Units (Fleet-Wide State Breakdown)" if selected_unit == "ALL" else f"Power Unit: {selected_unit}"
    quarter = unit_report.get("quarter", "2026-Q1")
    state_filter = unit_report.get("selected_state") or "ALL"
    date_range = unit_report.get("date_range_label", f"Full Quarter ({quarter})")
    gen_date = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    story.append(Paragraph("FuelTaxPulse Enterprise — Vehicle-Level State-Wise Unit Summary Report", title_style))
    story.append(Paragraph(f"Generated on: {gen_date} • Fuel Type: Diesel • IFTA Compliance Audit Report", sub_style))
    story.append(Spacer(1, 8))

    # Metadata Header Table
    meta_data = [
        [
            Paragraph(f"<b>Company / Carrier:</b> {company_name}", styles['Normal']),
            Paragraph(f"<b>Selected Unit:</b> {unit_label}", styles['Normal']),
            Paragraph(f"<b>Reporting Period:</b> {quarter}", styles['Normal']),
            Paragraph(f"<b>State / Date Filter:</b> {state_filter} ({date_range})", styles['Normal']),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[200, 200, 130, 190])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), colors.HexColor('#f8fafc')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 10))

    # KPI Summary Strip
    totals = unit_report.get("totals", {})
    kpi_headers = ["Total Miles", "Taxable Miles", "Non-Taxable Miles", "Fuel Quantity (Gal)", "Fuel Cost ($)", "Average MPG", "Est. Net IFTA Tax"]
    kpi_values = [
        f"{totals.get('total_miles', 0):,.1f} mi",
        f"{totals.get('taxable_miles', 0):,.1f} mi",
        f"{totals.get('non_taxable_miles', 0):,.1f} mi",
        f"{totals.get('fuel_gallons', 0):,.2f} gal",
        f"${totals.get('fuel_cost', 0):,.2f}",
        f"{totals.get('mpg', 0):.2f} MPG",
        f"${totals.get('est_ifta_tax', 0):,.2f}"
    ]
    kpi_table = Table([
        [Paragraph(f"<b>{h}</b>", styles['Normal']) for h in kpi_headers],
        [Paragraph(f"<b>{v}</b>", styles['Normal']) for v in kpi_values]
    ], colWidths=[102]*7)
    kpi_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#e2e8f0')),
        ('BACKGROUND', (0,1), (-1,1), colors.white),
        ('GRID', (0,0), (-1,-1), 0.75, colors.HexColor('#94a3b8')),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(kpi_table)
    story.append(Spacer(1, 12))

    # State-Wise Details Table
    headers = [
        "Unit Number", "State", "Total Miles", "Taxable Miles", "Non-Taxable",
        "Fuel Qty (Gal)", "Fuel Purchases ($)", "Receipts", "Tax Rate", "Est. IFTA Tax ($)"
    ]
    col_widths = [78, 52, 74, 74, 68, 76, 86, 54, 66, 86]
    table_rows = [[Paragraph(f"<b>{h}</b>", styles['Normal']) for h in headers]]

    state_rows = unit_report.get("state_rows", [])
    for r in state_rows:
        table_rows.append([
            Paragraph(str(r.get("unit_number", "")), styles['Normal']),
            Paragraph(f"<b>{r.get('jurisdiction', '')}</b>", styles['Normal']),
            Paragraph(f"{float(r.get('total_miles', 0)):,.1f}", styles['Normal']),
            Paragraph(f"{float(r.get('taxable_miles', 0)):,.1f}", styles['Normal']),
            Paragraph(f"{float(r.get('non_taxable_miles', 0)):,.1f}", styles['Normal']),
            Paragraph(f"{float(r.get('fuel_gallons', 0)):,.2f}", styles['Normal']),
            Paragraph(f"${float(r.get('fuel_cost', 0)):,.2f}", styles['Normal']),
            Paragraph(str(r.get("fuel_receipt_count", 0)), styles['Normal']),
            Paragraph(f"${float(r.get('tax_rate', 0)):.4f}", styles['Normal']),
            Paragraph(f"${float(r.get('est_ifta_tax', 0)):,.2f}", styles['Normal']),
        ])

    # Footer Totals row
    table_rows.append([
        Paragraph("<b>TOTALS</b>", styles['Normal']),
        Paragraph(f"<b>{len(state_rows)} rows</b>", styles['Normal']),
        Paragraph(f"<b>{totals.get('total_miles', 0):,.1f}</b>", styles['Normal']),
        Paragraph(f"<b>{totals.get('taxable_miles', 0):,.1f}</b>", styles['Normal']),
        Paragraph(f"<b>{totals.get('non_taxable_miles', 0):,.1f}</b>", styles['Normal']),
        Paragraph(f"<b>{totals.get('fuel_gallons', 0):,.2f}</b>", styles['Normal']),
        Paragraph(f"<b>${totals.get('fuel_cost', 0):,.2f}</b>", styles['Normal']),
        Paragraph(f"<b>{totals.get('fuel_receipt_count', 0)}</b>", styles['Normal']),
        Paragraph("<b>—</b>", styles['Normal']),
        Paragraph(f"<b>${totals.get('est_ifta_tax', 0):,.2f}</b>", styles['Normal']),
    ])

    det_table = Table(table_rows, colWidths=col_widths, repeatRows=1)
    det_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1B365D')),
        ('TEXTCOLOR', (0,0), (-1,0), colors.white),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f1f5f9')),
        ('LINEABOVE', (0,-1), (-1,-1), 1.5, colors.HexColor('#0f172a')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
    ]))
    story.append(det_table)

    doc.build(story)
    buffer.seek(0)
    return buffer.getvalue()
