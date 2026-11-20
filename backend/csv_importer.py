"""
FuelTaxPulse CSV Ingestion & Upsert Pipeline (Modules 2, 3, 7)
Handles:
- Flexible CSV/Excel parsing (.csv, .xlsx, .xls)
- Module 2: Mileage Ingestion template without BOL Number, Odometer Start, Odometer End (gracefully ignores legacy extra columns)
- Module 3: Fuel Purchase template with 4 core columns: Unit Number, State, Quantity, Transaction Date (gracefully ignores extra columns)
- Module 7: Intelligent Record Matching (Upsert: INSERT new records, UPDATE existing records on business key match, SKIP exact duplicates, and consolidate legacy duplicate rows)
- Detailed Import Summary (Total Uploaded, Inserted, Updated, Duplicate Skipped, Failed, Error Details)
- Atomic DB transactions with rollback protection
"""

import io
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

FIELD_FALLBACK_ALIASES = {
    "unit_number": ["Vehicle ID", "Unit Number", "Unit #", "Unit", "Truck", "Truck ID", "unit_number", "vehicle_id"],
    "jurisdiction": ["Jurisdiction", "State", "State/Prov", "Province", "jurisdiction", "state"],
    "total_miles": ["Total Distance", "Total Miles", "Miles", "Distance", "Mileage", "total_miles", "total_distance"],
    "taxable_miles": ["Taxable Distance", "Taxable Miles", "taxable_miles", "taxable_distance"],
    "non_taxable_miles": ["Exempt Distance", "Non-Taxable Miles", "Non Taxable Miles", "Off-Road Miles", "non_taxable_miles"],
    "trip_date": ["Date", "Trip Date", "Transaction Date", "trip_date", "date"],
    "gallons": ["Quantity", "Gallons", "Fuel Quantity", "Gal", "gallons", "quantity"],
    "transaction_date": ["Transaction Date", "Date", "Purchase Date", "Receipt Date", "transaction_date", "date"],
}

def get_quarter_bounds(quarter_str: str) -> Tuple[datetime, datetime]:
    parts = quarter_str.split("-")
    year = parts[0]
    q = parts[1] if len(parts) > 1 else "Q1"
    start_suffix, end_suffix = QUARTER_DATE_BOUNDS.get(q, ("-01-01", "-03-31"))
    start_dt = datetime.strptime(f"{year}{start_suffix}", "%Y-%m-%d")
    end_dt = datetime.strptime(f"{year}{end_suffix}", "%Y-%m-%d")
    return start_dt, end_dt

def normalize_date_str(raw_dt: str) -> Optional[str]:
    """Normalizes date strings like '1/12/2026' or '2026-01-12' into ISO 'YYYY-MM-DD'."""
    if not raw_dt or str(raw_dt).strip().lower() in ("", "nan", "none", "null"):
        return None
    try:
        dt = pd.to_datetime(str(raw_dt).strip()).to_pydatetime()
        return dt.strftime("%Y-%m-%d")
    except Exception:
        return None

def compute_sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def _load_grouped_existing_records(cursor, fleet_id: str, quarter: str, import_type: str) -> Dict[Tuple[str, str, str], List[Dict]]:
    """
    Loads all existing records for (fleet_id, quarter) grouped by normalized business key:
    (unit_number, jurisdiction, normalized_iso_date).
    """
    grouped: Dict[Tuple[str, str, str], List[Dict]] = {}
    if import_type == "mileage":
        cursor.execute("""
            SELECT id, unit_number, jurisdiction, total_miles, taxable_miles, non_taxable_miles, COALESCE(trip_date, '') as trip_date
            FROM mileage_records
            WHERE fleet_id = ? AND reporting_quarter = ?
            ORDER BY created_at DESC, id DESC
        """, (fleet_id, quarter))
        for r in cursor.fetchall():
            norm_dt = normalize_date_str(r["trip_date"]) or ""
            key = (str(r["unit_number"]).strip(), str(r["jurisdiction"]).strip().upper(), norm_dt)
            grouped.setdefault(key, []).append(dict(r))
    else:
        cursor.execute("""
            SELECT id, unit_number, jurisdiction, gallons, COALESCE(transaction_date, '') as transaction_date
            FROM fuel_transactions
            WHERE fleet_id = ? AND reporting_quarter = ?
            ORDER BY created_at DESC, id DESC
        """, (fleet_id, quarter))
        for r in cursor.fetchall():
            norm_dt = normalize_date_str(r["transaction_date"]) or ""
            key = (str(r["unit_number"]).strip(), str(r["jurisdiction"]).strip().upper(), norm_dt)
            grouped.setdefault(key, []).append(dict(r))
    return grouped

def parse_and_stage_csv(
    file_bytes: bytes,
    filename: str,
    fleet_id: str,
    quarter: str,
    import_type: str, # 'mileage' or 'fuel'
    column_mapping: Dict[str, str]
) -> Dict:
    file_hash = compute_sha256(file_bytes)
    conn = get_connection()
    cursor = conn.cursor()

    try:
        if filename.lower().endswith(".xlsx") or filename.lower().endswith(".xls"):
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

    df.columns = [str(c).strip() for c in df.columns]

    cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (fleet_id,))
    known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

    existing_grouped = _load_grouped_existing_records(cursor, fleet_id, quarter, import_type)
    start_bound, end_bound = get_quarter_bounds(quarter)

    batch_id = str(uuid.uuid4())
    staged_rows = []
    hard_error_count = 0
    warning_count = 0
    insert_preview_count = 0
    update_preview_count = 0
    duplicate_preview_count = 0

    seen_in_file: Dict[Tuple[str, str, str], Dict] = {}
    col_lookup = {c.lower(): c for c in df.columns}

    for idx, row in df.iterrows():
        row_errors = []
        row_warnings = []

        def get_val(sys_field, default=None):
            mapped_col = (column_mapping.get(sys_field) or "").strip()
            candidate_cols = []
            if mapped_col:
                candidate_cols.append(mapped_col)
            for alias in FIELD_FALLBACK_ALIASES.get(sys_field, []):
                if alias not in candidate_cols:
                    candidate_cols.append(alias)
            for c_name in candidate_cols:
                actual_col = col_lookup.get(c_name.lower())
                if actual_col and actual_col in row and pd.notna(row[actual_col]):
                    val_str = str(row[actual_col]).strip()
                    if val_str.lower() not in ("", "nan", "none"):
                        return row[actual_col]
            return default

        unit_num = str(get_val("unit_number", "")).strip()
        jur = str(get_val("jurisdiction", "")).strip().upper()

        if not unit_num:
            row_errors.append("Missing required Unit Number / Vehicle ID.")
        elif unit_num not in known_units:
            row_warnings.append(f"Unit '{unit_num}' is not registered yet (will be auto-registered upon commit).")

        if not jur:
            row_errors.append("Missing required State / Jurisdiction.")
        elif jur not in VALID_JURISDICTIONS:
            row_errors.append(f"Invalid jurisdiction code '{jur}'. Must be a valid 2-letter US State or Canadian Province.")

        if import_type == "mileage":
            tot_miles_raw = get_val("total_miles", None)
            tax_miles_raw = get_val("taxable_miles", None)
            non_tax_miles_raw = get_val("non_taxable_miles", 0)
            trip_dt_raw = get_val("trip_date", "")

            if tot_miles_raw is None:
                tot_miles = 0.0
                row_errors.append("Missing required Total Distance / Miles.")
            else:
                try:
                    tot_miles = float(tot_miles_raw)
                    if tot_miles < 0:
                        row_errors.append("Total Distance cannot be negative.")
                except Exception:
                    tot_miles = 0.0
                    row_errors.append(f"Invalid Total Distance '{tot_miles_raw}'. Must be numeric.")

            try:
                non_tax = float(non_tax_miles_raw) if non_tax_miles_raw is not None else 0.0
                if non_tax < 0:
                    row_errors.append("Exempt / Non-Taxable Distance cannot be negative.")
            except Exception:
                non_tax = 0.0

            try:
                tax_miles = float(tax_miles_raw) if tax_miles_raw is not None else max(0.0, tot_miles - non_tax)
                if tax_miles < 0:
                    row_errors.append("Taxable Distance cannot be negative.")
            except Exception:
                tax_miles = max(0.0, tot_miles - non_tax)

            if not row_errors and abs((tax_miles + non_tax) - tot_miles) > 0.1:
                old_tax = tax_miles
                tax_miles = max(0.0, round(tot_miles - non_tax, 2))
                row_warnings.append(f"Taxable ({old_tax}) + Exempt ({non_tax}) auto-adjusted to {tax_miles} to match Total ({tot_miles}).")

            norm_dt = ""
            if trip_dt_raw is not None and str(trip_dt_raw).strip() != "":
                parsed_dt = normalize_date_str(str(trip_dt_raw))
                if not parsed_dt:
                    row_errors.append(f"Invalid Date format '{trip_dt_raw}'.")
                else:
                    norm_dt = parsed_dt
                    dt_obj = datetime.strptime(norm_dt, "%Y-%m-%d")
                    if dt_obj < start_bound or dt_obj > end_bound:
                        row_errors.append(f"Date {norm_dt} is outside quarter {quarter} ({start_bound.date()} to {end_bound.date()}).")

            b_key = (unit_num, jur, norm_dt)
            action = "INSERT"
            existing_id = None

            if row_errors:
                action = "FAILED"
            elif b_key in seen_in_file:
                prev = seen_in_file[b_key]
                if abs(prev["total_miles"] - tot_miles) < 0.01 and abs(prev["taxable_miles"] - tax_miles) < 0.01:
                    action = "DUPLICATE_SKIP"
                    row_warnings.append("Duplicate row within uploaded file (will be skipped).")
                else:
                    action = prev.get("action", "UPDATE")
                    existing_id = prev.get("existing_id")
                    row_warnings.append("Supersedes earlier row for same Unit/State/Date in this file.")
            elif b_key in existing_grouped:
                matches = existing_grouped[b_key]
                ex = matches[0]
                existing_id = ex["id"]
                all_identical = (
                    len(matches) == 1
                    and abs(float(ex["total_miles"] or 0) - tot_miles) < 0.01
                    and abs(float(ex["taxable_miles"] or 0) - tax_miles) < 0.01
                    and abs(float(ex["non_taxable_miles"] or 0) - non_tax) < 0.01
                )
                if all_identical:
                    action = "DUPLICATE_SKIP"
                    row_warnings.append("Exact record already exists in database (will be skipped).")
                else:
                    action = "UPDATE"
                    prev_vals = ", ".join(str(m["total_miles"]) for m in matches)
                    row_warnings.append(f"Updates existing record (was {prev_vals} mi -> now {tot_miles} mi).")

            staged_row = {
                "row_index": idx + 1,
                "unit_number": unit_num,
                "jurisdiction": jur,
                "total_miles": tot_miles,
                "taxable_miles": tax_miles,
                "non_taxable_miles": non_tax,
                "trip_date": norm_dt,
                "action": action,
                "existing_id": existing_id,
                "status": "HARD_ERROR" if row_errors else ("WARNING" if row_warnings else "VALID"),
                "errors": row_errors,
                "warnings": row_warnings
            }
            if not row_errors:
                seen_in_file[b_key] = staged_row

        else: # 'fuel'
            gal_raw = get_val("gallons", None)
            tx_dt_raw = get_val("transaction_date", "")

            if gal_raw is None:
                gallons = 0.0
                row_errors.append("Missing required Quantity (Gallons).")
            else:
                try:
                    gallons = round(float(gal_raw), 3)
                    if gallons <= 0:
                        row_errors.append("Quantity (Gallons) must be greater than 0.")
                except Exception:
                    gallons = 0.0
                    row_errors.append(f"Invalid Quantity '{gal_raw}'. Must be numeric.")

            norm_dt = ""
            if not tx_dt_raw or str(tx_dt_raw).strip() == "":
                row_errors.append("Missing required Transaction Date.")
            else:
                parsed_dt = normalize_date_str(str(tx_dt_raw))
                if not parsed_dt:
                    row_errors.append(f"Invalid Transaction Date format '{tx_dt_raw}'.")
                else:
                    norm_dt = parsed_dt
                    dt_obj = datetime.strptime(norm_dt, "%Y-%m-%d")
                    if dt_obj < start_bound or dt_obj > end_bound:
                        row_errors.append(f"Transaction Date {norm_dt} is outside quarter {quarter} ({start_bound.date()} to {end_bound.date()}).")

            b_key = (unit_num, jur, norm_dt)
            action = "INSERT"
            existing_id = None

            if row_errors:
                action = "FAILED"
            elif b_key in seen_in_file:
                prev = seen_in_file[b_key]
                if abs(prev["gallons"] - gallons) < 0.001:
                    action = "DUPLICATE_SKIP"
                    row_warnings.append("Duplicate row within uploaded file (will be skipped).")
                else:
                    action = prev.get("action", "UPDATE")
                    existing_id = prev.get("existing_id")
                    row_warnings.append("Supersedes earlier row for same Unit/State/Date in this file.")
            elif b_key in existing_grouped:
                matches = existing_grouped[b_key]
                ex = matches[0]
                existing_id = ex["id"]
                all_identical = (
                    len(matches) == 1
                    and abs(float(ex["gallons"] or 0) - gallons) < 0.001
                )
                if all_identical:
                    action = "DUPLICATE_SKIP"
                    row_warnings.append("Exact record already exists in database (will be skipped).")
                else:
                    action = "UPDATE"
                    prev_vals = ", ".join(str(m["gallons"]) for m in matches if abs(float(m["gallons"] or 0) - gallons) >= 0.001) or str(ex["gallons"])
                    row_warnings.append(f"Updates existing record (was {prev_vals} gal -> now {gallons} gal).")

            staged_row = {
                "row_index": idx + 1,
                "unit_number": unit_num,
                "jurisdiction": jur,
                "gallons": gallons,
                "fuel_type": "DIESEL",
                "transaction_date": norm_dt,
                "tax_paid_at_pump": True,
                "vendor_name": "Retail Pump",
                "invoice_or_receipt_number": "",
                "total_cost": 0.0,
                "action": action,
                "existing_id": existing_id,
                "status": "HARD_ERROR" if row_errors else ("WARNING" if row_warnings else "VALID"),
                "errors": row_errors,
                "warnings": row_warnings
            }
            if not row_errors:
                seen_in_file[b_key] = staged_row

        if row_errors:
            hard_error_count += 1
        else:
            if staged_row["action"] == "INSERT":
                insert_preview_count += 1
            elif staged_row["action"] == "UPDATE":
                update_preview_count += 1
            elif staged_row["action"] == "DUPLICATE_SKIP":
                duplicate_preview_count += 1
            if row_warnings:
                warning_count += 1

        staged_rows.append(staged_row)

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
        "insert_preview_count": insert_preview_count,
        "update_preview_count": update_preview_count,
        "duplicate_preview_count": duplicate_preview_count,
        "preview_rows": staged_rows[:100],
        "all_staged_rows": staged_rows
    }

def commit_staged_rows(
    batch_id: str,
    fleet_id: str,
    quarter: str,
    import_type: str,
    valid_rows: List[Dict],
    all_rows: Optional[List[Dict]] = None
) -> Dict:
    """
    Atomically commits staged CSV rows with full Upsert logic:
    - Matches existing records using normalized ISO date strings (handles both '1/12/2026' and '2026-01-12')
    - Updates existing matching records when values changed and consolidates any legacy duplicate rows
    - Inserts genuinely new records
    - Skips exact duplicate records
    """
    conn = get_connection()
    cursor = conn.cursor()

    rows_to_process = all_rows if all_rows is not None else valid_rows
    total_uploaded = len(rows_to_process)
    inserted_count = 0
    updated_count = 0
    duplicate_skipped_count = 0
    failed_count = 0
    error_details = []
    auto_created_units = []

    try:
        cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (fleet_id,))
        known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

        # Group all existing records in Python by normalized business key so '1/12/2026' and '2026-01-12' match identically
        existing_grouped = _load_grouped_existing_records(cursor, fleet_id, quarter, import_type)
        committed_in_tx: Dict[Tuple[str, str, str], str] = {}

        for r in rows_to_process:
            row_idx = r.get("row_index", "?")
            if r.get("status") == "HARD_ERROR" or r.get("errors"):
                failed_count += 1
                errs = "; ".join(r.get("errors", ["Validation error"]))
                error_details.append(f"Row #{row_idx}: {errs}")
                continue

            unit_num = str(r.get("unit_number", "")).strip()
            jur = str(r.get("jurisdiction", "")).strip().upper()
            if not unit_num or not jur:
                failed_count += 1
                error_details.append(f"Row #{row_idx}: Missing Unit Number or Jurisdiction.")
                continue

            if unit_num not in known_units:
                veh_id = f"veh-{uuid.uuid4().hex[:8]}"
                cursor.execute("""
                    INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
                    VALUES (?, ?, ?, ?, 'Commercial', 'Class 8', 2024, 'DIESEL', 80000, 5, 'Active', 1)
                """, (veh_id, fleet_id, unit_num, f"AUTO{uuid.uuid4().hex[:13].upper()}"))
                known_units[unit_num] = veh_id
                auto_created_units.append(unit_num)

            veh_id = known_units[unit_num]

            if import_type == "mileage":
                norm_dt = normalize_date_str(r.get("trip_date")) or ""
                b_key = (unit_num, jur, norm_dt)
                tot_mi = float(r.get("total_miles", 0))
                tax_mi = float(r.get("taxable_miles", tot_mi))
                non_tax_mi = float(r.get("non_taxable_miles", max(0.0, tot_mi - tax_mi)))

                if b_key in committed_in_tx:
                    rec_id = committed_in_tx[b_key]
                    cursor.execute("SELECT total_miles, taxable_miles, non_taxable_miles FROM mileage_records WHERE id = ?", (rec_id,))
                    cur_row = cursor.fetchone()
                    if cur_row and abs(float(cur_row["total_miles"] or 0) - tot_mi) < 0.01 and abs(float(cur_row["taxable_miles"] or 0) - tax_mi) < 0.01:
                        duplicate_skipped_count += 1
                    else:
                        cursor.execute("""
                            UPDATE mileage_records
                            SET vehicle_id = ?, total_miles = ?, taxable_miles = ?, non_taxable_miles = ?, trip_date = ?, import_batch_id = ?
                            WHERE id = ?
                        """, (veh_id, tot_mi, tax_mi, non_tax_mi, norm_dt or None, batch_id, rec_id))
                    continue

                matches = existing_grouped.get(b_key, [])
                if matches:
                    primary = matches[0]
                    extra_dups = matches[1:]
                    # Remove any legacy duplicate rows for this business key
                    for dup_row in extra_dups:
                        cursor.execute("DELETE FROM mileage_records WHERE id = ?", (dup_row["id"],))

                    all_identical = (
                        len(matches) == 1
                        and abs(float(primary["total_miles"] or 0) - tot_mi) < 0.01
                        and abs(float(primary["taxable_miles"] or 0) - tax_mi) < 0.01
                        and abs(float(primary["non_taxable_miles"] or 0) - non_tax_mi) < 0.01
                    )
                    if all_identical:
                        # Still normalize trip_date format if needed
                        if primary["trip_date"] != norm_dt and norm_dt:
                            cursor.execute("UPDATE mileage_records SET trip_date = ? WHERE id = ?", (norm_dt, primary["id"]))
                        duplicate_skipped_count += 1
                    else:
                        cursor.execute("""
                            UPDATE mileage_records
                            SET vehicle_id = ?, total_miles = ?, taxable_miles = ?, non_taxable_miles = ?, trip_date = ?, import_batch_id = ?
                            WHERE id = ?
                        """, (veh_id, tot_mi, tax_mi, non_tax_mi, norm_dt or None, batch_id, primary["id"]))
                        updated_count += 1
                    committed_in_tx[b_key] = primary["id"]
                else:
                    new_id = str(uuid.uuid4())
                    cursor.execute("""
                        INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date, import_batch_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (new_id, fleet_id, veh_id, unit_num, quarter, jur, tot_mi, tax_mi, non_tax_mi, norm_dt or None, batch_id))
                    inserted_count += 1
                    committed_in_tx[b_key] = new_id

            else: # 'fuel'
                norm_dt = normalize_date_str(r.get("transaction_date")) or ""
                b_key = (unit_num, jur, norm_dt)
                gallons = round(float(r.get("gallons", 0)), 3)

                if b_key in committed_in_tx:
                    rec_id = committed_in_tx[b_key]
                    cursor.execute("SELECT gallons FROM fuel_transactions WHERE id = ?", (rec_id,))
                    cur_row = cursor.fetchone()
                    if cur_row and abs(float(cur_row["gallons"] or 0) - gallons) < 0.001:
                        duplicate_skipped_count += 1
                    else:
                        cursor.execute("""
                            UPDATE fuel_transactions
                            SET vehicle_id = ?, gallons = ?, transaction_date = ?, fuel_type = 'DIESEL', import_batch_id = ?
                            WHERE id = ?
                        """, (veh_id, gallons, norm_dt, batch_id, rec_id))
                    continue

                matches = existing_grouped.get(b_key, [])
                if matches:
                    primary = matches[0]
                    extra_dups = matches[1:]
                    # Remove any legacy duplicate rows for this business key
                    for dup_row in extra_dups:
                        cursor.execute("DELETE FROM fuel_transactions WHERE id = ?", (dup_row["id"],))

                    all_identical = (
                        len(matches) == 1
                        and abs(float(primary["gallons"] or 0) - gallons) < 0.001
                    )
                    if all_identical:
                        if primary["transaction_date"] != norm_dt and norm_dt:
                            cursor.execute("UPDATE fuel_transactions SET transaction_date = ? WHERE id = ?", (norm_dt, primary["id"]))
                        duplicate_skipped_count += 1
                    else:
                        cursor.execute("""
                            UPDATE fuel_transactions
                            SET vehicle_id = ?, gallons = ?, transaction_date = ?, fuel_type = 'DIESEL', import_batch_id = ?
                            WHERE id = ?
                        """, (veh_id, gallons, norm_dt, batch_id, primary["id"]))
                        updated_count += 1
                    committed_in_tx[b_key] = primary["id"]
                else:
                    new_id = str(uuid.uuid4())
                    cursor.execute("""
                        INSERT INTO fuel_transactions (id, fleet_id, vehicle_id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, invoice_or_receipt_number, total_cost, import_batch_id)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DIESEL', 1, ?, ?, ?, ?)
                    """, (new_id, fleet_id, veh_id, unit_num, quarter, norm_dt, jur, gallons, r.get("vendor_name", "Retail Pump"), r.get("invoice_or_receipt_number", ""), r.get("total_cost", 0.0), batch_id))
                    inserted_count += 1
                    committed_in_tx[b_key] = new_id

        cursor.execute("UPDATE import_batches SET status = 'committed' WHERE id = ?", (batch_id,))

        cursor.execute("""
            INSERT INTO audit_logs (id, fleet_id, quarter, user_name, action, details)
            VALUES (?, ?, ?, 'Fleet Tax Manager', 'CSV_BATCH_COMMITTED', ?)
        """, (
            str(uuid.uuid4()),
            fleet_id,
            quarter,
            f"CSV Import ({import_type}): Uploaded={total_uploaded}, Inserted={inserted_count}, Updated={updated_count}, Skipped={duplicate_skipped_count}, Failed={failed_count}"
        ))

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

    conn.close()

    return {
        "success": True,
        "committed_count": inserted_count + updated_count,
        "total_uploaded": total_uploaded,
        "inserted_count": inserted_count,
        "updated_count": updated_count,
        "duplicate_skipped_count": duplicate_skipped_count,
        "failed_count": failed_count,
        "error_details": error_details,
        "auto_created_units": auto_created_units
    }
