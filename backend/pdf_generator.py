"""
FuelTaxPulse PDF Tax Schedule Generator
Generates print-ready landscape PDF schedules replicating ProMiles FuelTaxOnline specifications.
"""

import io
from reportlab.lib.pagesizes import letter, landscape
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
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

    # Title
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

    # Metadata Header
    meta_data = [
        [
            Paragraph(f"<b>Company:</b> {meta.get('company_name', '')}", styles['Normal']),
            Paragraph(f"<b>Period:</b> {meta.get('period', '')}", styles['Normal']),
            Paragraph(f"<b>Total Units:</b> {meta.get('total_units', '')}", styles['Normal']),
            Paragraph(f"<b>Fuel Type:</b> {meta.get('fuel_type', 'Diesel')}", styles['Normal']),
        ]
    ]
    meta_table = Table(meta_data, colWidths=[200, 180, 150, 150])
    meta_table.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,-1), 2),
        ('TOPPADDING', (0,0), (-1,-1), 2),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 8))

    # KPI Summary Boxes
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

    # 17-Column Table
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

    # Totals Row
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
