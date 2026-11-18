"""
FuelTaxPulse Export & Audit Defense Package Generator
Supports:
1. Standard IFTA Schedule 1 CSV Export
2. State E-File Bulk Upload CSV Export
3. Vehicle-Level Unit Summary Report (CSV & Excel)
4. Full Audit Defense ZIP Package containing PDF, CSVs, raw files, and audit trail
"""

import io
import csv
import zipfile
import json
from datetime import datetime
from typing import List, Dict, Optional, Any
from database import get_connection
from pdf_generator import generate_pdf_bytes

def generate_schedule1_csv(report_data: dict) -> str:
    output = io.StringIO()
    writer = csv.writer(output)

    meta = report_data["metadata"]
    writer.writerow(["IFTA QUARTERLY FUEL USE TAX RETURN - SCHEDULE 1"])
    writer.writerow(["Carrier Legal Name", meta.get("company_name", "")])
    writer.writerow(["Reporting Period", meta.get("period", "")])
    writer.writerow(["Fuel Type", meta.get("fuel_type", "DIESEL")])
    writer.writerow(["Fleet Total Miles", meta.get("total_miles", 0)])
    writer.writerow(["Fleet Total Fuel (gal)", meta.get("total_fuel", 0)])
    writer.writerow(["Fleet Average MPG", f"{meta.get('fleet_mpg', 0):.2f}"])
    writer.writerow(["Total Balance Due", f"${meta.get('total_due', 0):.2f}"])
    writer.writerow([])

    headers = [
        "Jurisdiction", "Total Miles", "Taxable Miles", "Taxable Gallons Consumed",
        "Tax-Paid Gallons Purchased", "Net Taxable Gallons", "Tax Rate ($/gal)",
        "Base Tax Due ($)", "Surcharge Due ($)", "Weight-Distance Tax ($)", "Total Due / (Credit) ($)"
    ]
    writer.writerow(headers)

    for r in report_data["rows"]:
        st = r["state"]
        if r.get("is_surcharge_row"):
            st = f"{st} (Surcharge)"
        writer.writerow([
            st,
            r.get("all_miles", ""),
            r.get("taxable_miles", ""),
            r.get("taxable_gallons", ""),
            r.get("tax_paid_gallons", ""),
            r.get("net_taxable_gallons", ""),
            r.get("tax_rate", ""),
            r.get("ifta_tax_due", ""),
            r.get("surcharge_due", "") if r.get("is_surcharge_row") else "",
            r.get("approx_mile_tax_due", ""),
            r.get("ifta_tax_due", "")
        ])

    tot = report_data["totals"]
    writer.writerow([
        "TOTALS",
        tot.get("all_miles", 0),
        tot.get("taxable_miles", 0),
        tot.get("taxable_gallons", 0),
        tot.get("tax_paid_gallons", 0),
        tot.get("net_taxable_gallons", 0),
        "—",
        tot.get("ifta_tax_due", 0),
        "—",
        tot.get("approx_mile_tax_due", 0),
        meta.get("total_due", 0)
    ])

    return output.getvalue()

def generate_state_efile_csv(fleet_id: str, quarter: str, fuel_type: str, report_data: dict) -> str:
    """
    Standard state e-file EDI / CSV layout for direct import into state DMV / IFTA e-file portals.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT ifta_account_number, fein, base_jurisdiction, legal_name FROM fleets WHERE id = ?", (fleet_id,))
    f_row = cursor.fetchone()
    conn.close()

    output = io.StringIO()
    writer = csv.writer(output)

    # State E-File Standard Header
    writer.writerow(["RECORD_TYPE", "ACCOUNT_NUM", "FEIN", "BASE_STATE", "QUARTER", "FUEL_TYPE", "FLEET_MPG"])
    writer.writerow([
        "HDR",
        f_row["ifta_account_number"] if f_row else "AR-8839210-26",
        f_row["fein"] if f_row else "84-9281729",
        f_row["base_jurisdiction"] if f_row else "AR",
        quarter,
        fuel_type.upper(),
        f"{report_data['metadata'].get('fleet_mpg', 0):.2f}"
    ])

    # Detail Lines
    writer.writerow(["RECORD_TYPE", "JURISDICTION", "TOTAL_MILES", "TAXABLE_MILES", "TAX_PAID_GAL", "TAXABLE_GAL", "NET_GAL", "TAX_DUE"])
    for r in report_data["rows"]:
        if not r.get("is_surcharge_row"):
            writer.writerow([
                "DET",
                r["state"],
                r.get("all_miles", 0),
                r.get("taxable_miles", 0),
                r.get("tax_paid_gallons", 0),
                r.get("taxable_gallons", 0),
                r.get("net_taxable_gallons", 0),
                r.get("ifta_tax_due", 0)
            ])

    return output.getvalue()

def generate_unit_summary_csv(unit_breakdown: List[Dict]) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Unit Number", "Total Miles Logged", "Total Fuel Pumped (gal)", "Unit Average MPG", "Compliance Status"])
    for u in unit_breakdown:
        writer.writerow([
            u["unit_number"],
            u["miles"],
            u["gallons"],
            f"{u['mpg']:.2f}",
            "FLAGGED ANOMALY" if u["has_anomaly"] else "NORMAL"
        ])
    return output.getvalue()

def build_audit_defense_zip_package(fleet_id: str, quarter: str, fuel_type: str, report_data: dict, unit_breakdown: List[Dict]) -> bytes:
    """
    Assembles complete IFTA Audit Defense Package:
    - Official Landscape PDF
    - Schedule 1 CSV
    - State E-File CSV
    - Unit-level Breakdown CSV
    - Fuel Receipts Ledger CSV
    - Raw Ingested CSV Files
    - Audit Trail Log
    """
    buffer = io.BytesIO()

    conn = get_connection()
    cursor = conn.cursor()

    # Fetch raw import batches
    cursor.execute("""
        SELECT filename, file_sha256, raw_content, created_at
        FROM import_batches
        WHERE fleet_id = ? AND reporting_quarter = ? AND status = 'committed'
    """, (fleet_id, quarter))
    raw_batches = cursor.fetchall()

    # Fetch fuel receipts
    cursor.execute("""
        SELECT transaction_date, unit_number, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, invoice_or_receipt_number, total_cost
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ?
        ORDER BY transaction_date ASC
    """, (fleet_id, quarter))
    fuel_rows = cursor.fetchall()

    # Fetch audit logs
    cursor.execute("""
        SELECT timestamp, user_name, action, details
        FROM audit_logs
        WHERE fleet_id = ? AND quarter = ?
        ORDER BY timestamp ASC
    """, (fleet_id, quarter))
    audit_logs = cursor.fetchall()

    conn.close()

    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as z:
        # 1. PDF Return
        pdf_bytes = generate_pdf_bytes(report_data)
        z.writestr(f"IFTA_Official_Return_{quarter}_{fuel_type}.pdf", pdf_bytes)

        # 2. Schedule 1 CSV
        sched1_csv = generate_schedule1_csv(report_data)
        z.writestr(f"IFTA_Schedule1_{quarter}.csv", sched1_csv)

        # 3. State E-File CSV
        efile_csv = generate_state_efile_csv(fleet_id, quarter, fuel_type, report_data)
        z.writestr(f"State_EFile_Bulk_Upload_{quarter}.csv", efile_csv)

        # 4. Unit Summary CSV
        unit_csv = generate_unit_summary_csv(unit_breakdown)
        z.writestr(f"Vehicle_Unit_Summary_{quarter}.csv", unit_csv)

        # 5. Fuel Receipts Ledger
        f_buf = io.StringIO()
        f_writer = csv.writer(f_buf)
        f_writer.writerow(["Date", "Unit", "State", "Gallons", "Fuel Type", "Tax Paid at Pump", "Vendor", "Invoice/Receipt", "Total Cost"])
        for fr in fuel_rows:
            f_writer.writerow([fr["transaction_date"], fr["unit_number"], fr["jurisdiction"], fr["gallons"], fr["fuel_type"], bool(fr["tax_paid_at_pump"]), fr["vendor_name"], fr["invoice_or_receipt_number"], fr["total_cost"]])
        z.writestr(f"Fuel_Receipts_Ledger_{quarter}.csv", f_buf.getvalue())

        # 6. Raw Ingested CSV Files
        for rb in raw_batches:
            safe_name = f"Raw_CSVs_Retained/{rb['filename']}"
            content = rb["raw_content"] or ""
            z.writestr(safe_name, content)

        # 7. Audit Log
        log_buf = io.StringIO()
        log_buf.write(f"IFTA 4-YEAR AUDIT TRAIL LOG - QUARTER {quarter}\n")
        log_buf.write(f"Generated on {datetime.now().isoformat()}\n")
        log_buf.write("="*70 + "\n\n")
        for log in audit_logs:
            log_buf.write(f"[{log['timestamp']}] User: {log['user_name']} | Action: {log['action']} | {log['details']}\n")
        z.writestr(f"Audit_Defense_Trail_{quarter}.txt", log_buf.getvalue())

    buffer.seek(0)
    return buffer.getvalue()
