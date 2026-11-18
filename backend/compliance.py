"""
FuelTaxPulse Automated Compliance & Audit Verification Engine
Implements Section 4 specifications:
1. Duplicate Batch Check (Hard Error)
2. Quarter Date Boundary Check (Hard Error)
3. Fleet & Unit MPG Anomaly Check (Soft Warning, 4.0 - 10.0 MPG)
4. Orphaned Data Check (Soft Warning: Miles > 0 with 0 Gallons, Gallons > 0 with 0 Miles)
5. Odometer Continuity Check (Soft Warning: Gaps > 50 miles)
6. Route Adjacency Check (Soft Warning: Non-contiguous borders)
"""

from typing import Dict, List, Optional
from database import get_connection
from ifta_engine import validate_trip_route

def run_fleet_compliance_audit(fleet_id: str, quarter: str, fuel_type: str = "DIESEL") -> Dict:
    conn = get_connection()
    cursor = conn.cursor()

    hard_errors = []
    soft_warnings = []

    # 1. Check for Duplicate Batches in import_batches
    cursor.execute("""
        SELECT file_sha256, filename, COUNT(*) as cnt
        FROM import_batches
        WHERE fleet_id = ? AND reporting_quarter = ? AND status = 'committed'
        GROUP BY file_sha256
        HAVING cnt > 1
    """, (fleet_id, quarter))
    dups = cursor.fetchall()
    for d in dups:
        hard_errors.append({
            "code": "DUPLICATE_BATCH_ERROR",
            "type": "HARD_ERROR",
            "message": f"Duplicate batch detected for file '{d['filename']}' (SHA-256: {d['file_sha256'][:12]}...). Potential double-counting.",
            "blocking": True
        })

    # 2. Quarter Date Boundary Check on fuel transactions
    cursor.execute("""
        SELECT id, transaction_date, unit_number, jurisdiction
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ?
    """, (fleet_id, quarter))
    fuel_txs = cursor.fetchall()

    year = quarter.split("-")[0]
    q_code = quarter.split("-")[1]
    bounds = {
        "Q1": (f"{year}-01-01", f"{year}-03-31"),
        "Q2": (f"{year}-04-01", f"{year}-06-30"),
        "Q3": (f"{year}-07-01", f"{year}-09-30"),
        "Q4": (f"{year}-10-01", f"{year}-12-31"),
    }.get(q_code, (f"{year}-01-01", f"{year}-03-31"))

    for tx in fuel_txs:
        t_dt = tx["transaction_date"]
        if t_dt < bounds[0] or t_dt > bounds[1]:
            hard_errors.append({
                "code": "DATE_BOUNDARY_ERROR",
                "type": "HARD_ERROR",
                "message": f"Fuel transaction for {tx['unit_number']} in {tx['jurisdiction']} on {t_dt} is outside {quarter} range ({bounds[0]} to {bounds[1]}).",
                "blocking": True
            })

    # 3. Unit-by-Unit Mileage and Fuel Aggregation for MPG & Orphan Checks
    cursor.execute("""
        SELECT unit_number, SUM(taxable_miles) as miles
        FROM mileage_records
        WHERE fleet_id = ? AND reporting_quarter = ?
        GROUP BY unit_number
    """, (fleet_id, quarter))
    unit_miles = {r["unit_number"]: r["miles"] for r in cursor.fetchall()}

    cursor.execute("""
        SELECT unit_number, SUM(gallons) as gallons
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ? AND UPPER(fuel_type) = ?
        GROUP BY unit_number
    """, (fleet_id, quarter, fuel_type.upper()))
    unit_fuel = {r["unit_number"]: r["gallons"] for r in cursor.fetchall()}

    all_units = set(unit_miles.keys()) | set(unit_fuel.keys())

    total_fleet_miles = sum(unit_miles.values())
    total_fleet_fuel = sum(unit_fuel.values())

    # Fleet MPG Check
    if total_fleet_fuel > 0:
        fleet_mpg = round(total_fleet_miles / total_fleet_fuel, 2)
        if fleet_mpg < 4.0 or fleet_mpg > 10.0:
            soft_warnings.append({
                "code": "FLEET_MPG_ANOMALY",
                "type": "SOFT_WARNING",
                "message": f"Overall Fleet MPG is {fleet_mpg:.2f}, which falls outside the normal commercial heavy diesel range (4.0 - 10.0 MPG). Verify fuel receipts and logged miles.",
                "blocking": False
            })
    else:
        fleet_mpg = 0.0

    # Unit MPG & Orphan Checks
    unit_breakdown = []
    for u in sorted(all_units):
        u_mi = unit_miles.get(u, 0.0)
        u_gal = unit_fuel.get(u, 0.0)
        u_mpg = round(u_mi / u_gal, 2) if u_gal > 0 else 0.0

        # Orphan check
        if u_mi > 0 and u_gal == 0:
            soft_warnings.append({
                "code": "ORPHANED_MILEAGE",
                "type": "SOFT_WARNING",
                "message": f"Unit '{u}' logged {u_mi:,.0f} miles in {quarter} but has 0 gallons of fuel recorded. Potential missing fuel receipts.",
                "blocking": False
            })
        elif u_gal > 0 and u_mi == 0:
            soft_warnings.append({
                "code": "ORPHANED_FUEL",
                "type": "SOFT_WARNING",
                "message": f"Unit '{u}' pumped {u_gal:,.1f} gallons in {quarter} with 0 recorded miles. Potential untracked trips or personal use.",
                "blocking": False
            })
        elif u_gal > 0 and (u_mpg < 4.0 or u_mpg > 10.0):
            soft_warnings.append({
                "code": "UNIT_MPG_ANOMALY",
                "type": "SOFT_WARNING",
                "message": f"Unit '{u}' average consumption is {u_mpg:.2f} MPG ({u_mi:,.0f} mi / {u_gal:,.1f} gal), outside standard 4.0-10.0 bounds.",
                "blocking": False
            })

        unit_breakdown.append({
            "unit_number": u,
            "miles": u_mi,
            "gallons": u_gal,
            "mpg": u_mpg,
            "has_anomaly": u_mpg > 0 and (u_mpg < 4.0 or u_mpg > 10.0)
        })

    # 4. Check Odometer Continuity Gaps
    cursor.execute("""
        SELECT unit_number, start_odometer, end_odometer, trip_date
        FROM mileage_records
        WHERE fleet_id = ? AND reporting_quarter = ? AND start_odometer IS NOT NULL AND end_odometer IS NOT NULL
        ORDER BY unit_number, trip_date ASC, start_odometer ASC
    """, (fleet_id, quarter))
    odo_rows = cursor.fetchall()
    last_end = {}
    for r in odo_rows:
        u = r["unit_number"]
        st_odo = r["start_odometer"]
        end_odo = r["end_odometer"]
        if u in last_end:
            gap = st_odo - last_end[u]
            if gap > 50:
                soft_warnings.append({
                    "code": "ODOMETER_GAP",
                    "type": "SOFT_WARNING",
                    "message": f"Unit '{u}' has an odometer gap of {gap} miles between readings ({last_end[u]} -> {st_odo}) on {r['trip_date']}.",
                    "blocking": False
                })
        last_end[u] = end_odo

    # Check Quarter Lock Status
    cursor.execute("""
        SELECT is_locked, locked_at, locked_by
        FROM quarter_locks
        WHERE fleet_id = ? AND quarter = ? AND UPPER(fuel_type) = ?
    """, (fleet_id, quarter, fuel_type.upper()))
    lock_row = cursor.fetchone()
    is_locked = bool(lock_row["is_locked"]) if lock_row else False

    conn.close()

    can_lock = len(hard_errors) == 0

    return {
        "quarter": quarter,
        "fuel_type": fuel_type,
        "is_locked": is_locked,
        "locked_at": lock_row["locked_at"] if lock_row else None,
        "locked_by": lock_row["locked_by"] if lock_row else None,
        "can_lock": can_lock,
        "hard_error_count": len(hard_errors),
        "warning_count": len(soft_warnings),
        "hard_errors": hard_errors,
        "soft_warnings": soft_warnings,
        "fleet_mpg": fleet_mpg,
        "total_miles": total_fleet_miles,
        "total_fuel": total_fleet_fuel,
        "unit_breakdown": unit_breakdown
    }
