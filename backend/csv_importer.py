"""
FuelTaxPulse CSV Ingestion Pipeline
Handles:
- Flexible CSV/Excel parsing
- SHA-256 duplicate batch check (Hard Error)
- Saved column mapping templates (Motive, WEX, Samsara, Custom)
- Canadian liters-to-gallons auto-conversion (liters * 0.264172)
- Row-level validation & error staging (Date bounds, state codes, negative values)
- Immutable raw file retention for 4-year IFTA audit compliance
"""

import io
import csv
import hashlib
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import pandas as pd
from database import get_connection

VALID_JURISDICTIONS = {
    # 48 Lower US States + DC
    "AL", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA",
    "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA",
    "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM",
    "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD",
    "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
    # 10 Canadian Provinces
    "AB", "BC", "MB", "NB", "NL", "NS", "ON", "PE", "QC", "SK"
}

QUARTER_DATE_BOUNDS = {
    "Q1": ("-01-01", "-03-31"),
    "Q2": ("-04-01", "-06-30"),
    "Q3": ("-07-01", "-09-30"),
    "Q4": ("-10-01", "-12-31"),
}

def get_quarter_bounds(quarter_str: str) -> Tuple[datetime, datetime]:
    # e.g. '2026-Q1'
    parts = quarter_str.split("-")
    year = parts[0]
    q = parts[1] if len(parts) > 1 else "Q1"
    start_suffix, end_suffix = QUARTER_DATE_BOUNDS.get(q, ("-01-01", "-03-31"))
    start_dt = datetime.strptime(f"{year}{start_suffix}", "%Y-%m-%d")
    end_dt = datetime.strptime(f"{year}{end_suffix}", "%Y-%m-%d")
    return start_dt, end_dt

def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def parse_and_stage_csv(
    file_bytes: bytes,
    filename: str,
    fleet_id: str,
    quarter: str,
    import_type: str, # 'mileage' or 'fuel'
    column_mapping: Dict[str, str] # e.g. {'unit_number': 'Truck', 'jurisdiction': 'State'}
) -> Dict:
    file_hash = compute_sha256(file_bytes)
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Hard Error Check: Duplicate Batch
    cursor.execute("""
        SELECT id, filename, created_at FROM import_batches
        WHERE fleet_id = ? AND file_sha256 = ? AND status = 'committed'
    """, (fleet_id, file_hash))
    dup = cursor.fetchone()
    if dup:
        conn.close()
        return {
            "success": False,
            "hard_error": "DUPLICATE_BATCH_ERROR",
            "message": f"This identical file was already imported on {dup['created_at']} (Batch ID: {dup['id']}). Duplicate imports are blocked to prevent double-counting.",
            "file_sha256": file_hash
        }

    # Parse file into DataFrame
    try:
        if filename.endswith(".xlsx") or filename.endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        conn.close()
        return {
            "success": False,
            "hard_error": "FILE_CORRUPT_ERROR",
            "message": f"Unable to parse file: {str(e)}"
        }

    # Fetch active fleet units for validation
    cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (fleet_id,))
    known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

    start_bound, end_bound = get_quarter_bounds(quarter)

    batch_id = str(uuid.uuid4())
    staged_rows = []
    hard_error_count = 0
    warning_count = 0

    # Invert mapping: system_field -> csv_column
    # e.g. {'unit_number': 'Truck ID', 'jurisdiction': 'State Code', 'total_miles': 'Miles'}
    for idx, row in df.iterrows():
        row_errors = []
        row_warnings = []

        def get_val(sys_field, default=None):
            col_name = column_mapping.get(sys_field)
            if col_name and col_name in row and pd.notna(row[col_name]):
                return row[col_name]
            return default

        unit_num = str(get_val("unit_number", "")).strip()
        jur = str(get_val("jurisdiction", "")).strip().upper()

        # Check Unit Number
        if not unit_num:
            row_errors.append("Missing required unit_number.")
        elif unit_num not in known_units:
            row_warnings.append(f"Unit '{unit_num}' is not registered in this fleet (will be auto-created upon commit).")

        # Check Jurisdiction
        if not jur:
            row_errors.append("Missing required jurisdiction.")
        elif jur not in VALID_JURISDICTIONS:
            row_errors.append(f"Invalid jurisdiction code '{jur}'. Must be valid 2-letter state or province.")

        if import_type == "mileage":
            tot_miles_raw = get_val("total_miles", 0)
            tax_miles_raw = get_val("taxable_miles", None)
            non_tax_miles_raw = get_val("non_taxable_miles", 0)
            trip_dt_str = str(get_val("trip_date", "")).strip()

            try:
                tot_miles = float(tot_miles_raw)
                if tot_miles < 0:
                    row_errors.append("total_miles cannot be negative.")
            except Exception:
                tot_miles = 0.0
                row_errors.append("total_miles must be a valid number.")

            try:
                non_tax = float(non_tax_miles_raw) if non_tax_miles_raw else 0.0
            except Exception:
                non_tax = 0.0

            try:
                tax_miles = float(tax_miles_raw) if tax_miles_raw is not None else (tot_miles - non_tax)
                if tax_miles < 0:
                    row_errors.append("taxable_miles cannot be negative.")
            except Exception:
                tax_miles = tot_miles

            # Validate taxable + non_taxable = total
            if abs((tax_miles + non_tax) - tot_miles) > 0.1:
                row_warnings.append(f"Mileage mismatch: taxable ({tax_miles}) + non-taxable ({non_tax}) != total ({tot_miles}).")

            # Check trip date bounds if provided
            if trip_dt_str and trip_dt_str != "nan":
                try:
                    dt = pd.to_datetime(trip_dt_str).to_pydatetime()
                    if dt < start_bound or dt > end_bound:
                        row_errors.append(f"Date {trip_dt_str} is outside reporting quarter {quarter} ({start_bound.date()} to {end_bound.date()}).")
                except Exception:
                    row_warnings.append(f"Unable to parse trip_date '{trip_dt_str}'.")

            staged_row = {
                "row_index": idx + 1,
                "unit_number": unit_num,
                "jurisdiction": jur,
                "total_miles": tot_miles,
                "taxable_miles": tax_miles,
                "non_taxable_miles": non_tax,
                "trip_date": trip_dt_str if trip_dt_str != "nan" else "",
                "status": "HARD_ERROR" if row_errors else ("WARNING" if row_warnings else "VALID"),
                "errors": row_errors,
                "warnings": row_warnings
            }

        else: # 'fuel'
            gal_raw = get_val("gallons", 0)
            liters_raw = get_val("liters", None)
            tx_dt_str = str(get_val("transaction_date", "")).strip()
            fuel_type = str(get_val("fuel_type", "DIESEL")).strip().upper()
            tax_paid_val = get_val("tax_paid_at_pump", True)
            vendor = str(get_val("vendor_name", "")).strip()
            inv = str(get_val("invoice_or_receipt_number", "")).strip()
            cost_raw = get_val("total_cost", 0)

            # Auto-convert Canadian liters if present or if jur is Canadian province and liters provided
            try:
                if liters_raw is not None and pd.notna(liters_raw):
                    gallons = round(float(liters_raw) * 0.264172, 3)
                else:
                    gallons = float(gal_raw)

                if gallons <= 0:
                    row_errors.append("gallons must be greater than 0.")
            except Exception:
                gallons = 0.0
                row_errors.append("gallons must be a valid number.")

            # Date Boundary Check (Hard Error)
            if not tx_dt_str or tx_dt_str == "nan":
                row_errors.append("Missing transaction_date.")
            else:
                try:
                    dt = pd.to_datetime(tx_dt_str).to_pydatetime()
                    if dt < start_bound or dt > end_bound:
                        row_errors.append(f"Fuel receipt date {tx_dt_str} is outside reporting quarter {quarter} ({start_bound.date()} to {end_bound.date()}).")
                except Exception:
                    row_errors.append(f"Invalid transaction_date format '{tx_dt_str}'.")

            try:
                cost = float(cost_raw) if cost_raw else 0.0
            except Exception:
                cost = 0.0

            staged_row = {
                "row_index": idx + 1,
                "unit_number": unit_num,
                "jurisdiction": jur,
                "gallons": gallons,
                "fuel_type": fuel_type,
                "transaction_date": tx_dt_str,
                "tax_paid_at_pump": bool(tax_paid_val),
                "vendor_name": vendor if vendor != "nan" else "Retail Pump",
                "invoice_or_receipt_number": inv if inv != "nan" else "",
                "total_cost": cost,
                "status": "HARD_ERROR" if row_errors else ("WARNING" if row_warnings else "VALID"),
                "errors": row_errors,
                "warnings": row_warnings
            }

        if row_errors:
            hard_error_count += 1
        elif row_warnings:
            warning_count += 1

        staged_rows.append(staged_row)

    # Store batch record as staged
    raw_text = file_bytes.decode("utf-8", errors="ignore")
    cursor.execute("""
        INSERT INTO import_batches (id, fleet_id, reporting_quarter, import_type, filename, file_sha256, raw_content, row_count, error_count, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'staged')
    """, (batch_id, fleet_id, quarter, import_type, filename, file_hash, raw_text, len(staged_rows), hard_error_count))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "batch_id": batch_id,
        "filename": filename,
        "file_sha256": file_hash,
        "import_type": import_type,
        "total_rows": len(staged_rows),
        "hard_error_count": hard_error_count,
        "warning_count": warning_count,
        "preview_rows": staged_rows[:100], # return first 100 preview rows
        "all_staged_rows": staged_rows
    }

def commit_staged_rows(batch_id: str, fleet_id: str, quarter: str, import_type: str, valid_rows: List[Dict]) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()

    # Fetch vehicles
    cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (fleet_id,))
    known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

    committed_count = 0
    auto_created_units = []

    for r in valid_rows:
        unit_num = r.get("unit_number", "").strip()
        if not unit_num:
            continue

        # Auto-create vehicle if missing
        if unit_num not in known_units:
            veh_id = f"veh-{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
                VALUES (?, ?, ?, ?, 'Commercial', 'Class 8', 2024, 'DIESEL', 80000, 5, 'Active', 1)
            """, (veh_id, fleet_id, unit_num, f"AUTO{uuid.uuid4().hex[:13].upper()}"))
            known_units[unit_num] = veh_id
            auto_created_units.append(unit_num)

        veh_id = known_units[unit_num]
        jur = r.get("jurisdiction", "").strip().upper()

        if import_type == "mileage":
            cursor.execute("""
                INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date, import_batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), fleet_id, veh_id, unit_num, quarter, jur, r.get("total_miles", 0), r.get("taxable_miles", 0), r.get("non_taxable_miles", 0), r.get("trip_date") or None, batch_id))
            committed_count += 1
        else: # 'fuel'
            cursor.execute("""
                INSERT INTO fuel_transactions (id, fleet_id, vehicle_id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, vendor_city, invoice_or_receipt_number, total_cost, import_batch_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), fleet_id, veh_id, unit_num, quarter, r.get("transaction_date"), jur, r.get("gallons", 0), r.get("fuel_type", "DIESEL"), 1 if r.get("tax_paid_at_pump", True) else 0, r.get("vendor_name"), r.get("vendor_city"), r.get("invoice_or_receipt_number"), r.get("total_cost", 0), batch_id))
            committed_count += 1

    # Mark batch committed
    cursor.execute("UPDATE import_batches SET status = 'committed' WHERE id = ?", (batch_id,))

    # Log action
    cursor.execute("""
        INSERT INTO audit_logs (id, fleet_id, quarter, user_name, action, details)
        VALUES (?, ?, ?, 'Fleet Tax Manager', 'CSV_BATCH_COMMITTED', ?)
    """, (str(uuid.uuid4()), fleet_id, quarter, f"Committed {committed_count} {import_type} records from Batch {batch_id}"))

    conn.commit()
    conn.close()

    return {
        "success": True,
        "committed_count": committed_count,
        "auto_created_units": auto_created_units
    }
