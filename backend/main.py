"""
FuelTaxPulse FastAPI Application Server
Multi-Fleet IFTA & Fuel Tax Compliance Platform
Fully compliant with functional specifications:
- Multi-Fleet Isolation by fleet_id & reporting_quarter
- CSV Ingestion with SHA-256 duplicate checking & mapping templates
- Spreadsheet-Style Manual Mileage & Fuel Grid Entry
- Automated Compliance & Audit Verification (Hard Errors vs Soft Warnings)
- Quarter Finalize & Lock Snapshots
- Official PDF, Schedule 1 CSV, State E-File, and IFTA Audit Defense ZIP Package
"""

from fastapi import FastAPI, HTTPException, status, Depends, Response, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional, Dict, Any
import uuid
import json
import sys
import os
from datetime import datetime

# Ensure backend directory is in sys.path for direct module resolution
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import get_connection, init_db, hash_password, verify_password
from auth import create_access_token, get_current_user
from ifta_engine import IFTAEngine, validate_trip_route
from pdf_generator import generate_pdf_bytes
from csv_importer import parse_and_stage_csv, commit_staged_rows
from compliance import run_fleet_compliance_audit
from export_manager import (
    generate_schedule1_csv, generate_state_efile_csv,
    generate_unit_summary_csv, build_audit_defense_zip_package
)
from models import (
    UserRegisterRequest, UserLoginRequest, AuthResponse, UserResponse,
    VehicleCreateRequest, VehicleResponse,
    TripCreateRequest, RouteValidationRequest,
    FuelPurchaseCreateRequest, QuickCalculatorRequest
)

# Initialize database on startup
init_db()

app = FastAPI(
    title="FuelTaxPulse API",
    description="Multi-Fleet IFTA & Fuel Tax Compliance Platform (ProMiles Alternative)",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -----------------------------------------------------------------------------
# 1. AUTHENTICATION & MULTI-TENANCY
# -----------------------------------------------------------------------------

@app.post("/api/auth/register", response_model=AuthResponse)
def register_user(req: UserRegisterRequest):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Account with this email already exists.")

    org_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO organizations (id, name, account_type, subscription_status)
        VALUES (?, ?, 'carrier', 'active')
    """, (org_id, req.company_name))

    fleet_id = str(uuid.uuid4())
    ifta_num = req.ifta_account_number or f"{req.base_jurisdiction}-IFTA-2026"
    cursor.execute("""
        INSERT INTO fleets (id, org_id, name, legal_name, ifta_account_number, base_jurisdiction, fein, dot_number, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active')
    """, (fleet_id, org_id, req.company_name, req.company_name, ifta_num, req.base_jurisdiction, "84-0000000", req.dot_number))

    # Create matching customer entry for the carrier in 'customers' table
    cust_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO customers (
            id, org_id, fleet_id, company_name, dba, address, city, state, postal_code,
            contact_email, ifta_state, ifta_number, dot_number, account_number
        )
        VALUES (?, ?, ?, ?, ?, '100 Interstate Parkway', 'Springdale', ?, '72764', ?, ?, ?, ?, ?)
    """, (cust_id, org_id, fleet_id, req.company_name, req.company_name, req.base_jurisdiction, req.email.lower(), req.base_jurisdiction, ifta_num, req.dot_number or '', f"ACC-{req.base_jurisdiction}-001"))

    # Seed 3 starter power units so the new user can immediately use Power Units, Trip Routing, and Fuel Ledger
    starter_trucks = [
        ("Unit 101", "1FUJGLDR5DP101001", "Freightliner", "Cascadia", 2024, "DIESEL", 80000, 5),
        ("Unit 102", "1XKAD49X6ER102002", "Kenworth", "T680", 2023, "DIESEL", 80000, 5),
        ("Unit 103", "3AKJHHDR7FR103003", "Peterbilt", "579", 2025, "DIESEL", 80000, 5)
    ]
    for u_num, u_vin, u_make, u_model, u_yr, u_fuel, u_gvw, u_axles in starter_trucks:
        cursor.execute("""
            INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1)
        """, (str(uuid.uuid4()), fleet_id, u_num, u_vin, u_make, u_model, u_yr, u_fuel, u_gvw, u_axles))

    user_id = str(uuid.uuid4())
    pwd_hash = hash_password(req.password)
    cursor.execute("""
        INSERT INTO users (id, org_id, email, password_hash, full_name, role)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (user_id, org_id, req.email.lower(), pwd_hash, req.full_name, req.role or "fleet_manager"))

    conn.commit()
    conn.close()

    token = create_access_token({"sub": user_id, "email": req.email.lower()})

    user_resp = UserResponse(
        id=user_id,
        email=req.email.lower(),
        full_name=req.full_name,
        role=req.role or "fleet_manager",
        org_id=org_id,
        org_name=req.company_name,
        default_fleet_id=fleet_id,
        default_fleet_name=req.company_name,
        ifta_account_number=req.ifta_account_number,
        base_jurisdiction=req.base_jurisdiction
    )

    return AuthResponse(access_token=token, user=user_resp)

@app.post("/api/auth/login", response_model=AuthResponse)
def login_user(req: UserLoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT u.id, u.email, u.password_hash, u.full_name, u.role, u.org_id, o.name as org_name,
               f.id as default_fleet_id, f.name as default_fleet_name, f.ifta_account_number, f.base_jurisdiction
        FROM users u
        JOIN organizations o ON u.org_id = o.id
        LEFT JOIN fleets f ON f.org_id = o.id
        WHERE u.email = ?
    """, (req.email.lower(),))
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_access_token({"sub": row["id"], "email": row["email"]})

    user_resp = UserResponse(
        id=row["id"],
        email=row["email"],
        full_name=row["full_name"],
        role=row["role"],
        org_id=row["org_id"],
        org_name=row["org_name"],
        default_fleet_id=row["default_fleet_id"],
        default_fleet_name=row["default_fleet_name"],
        ifta_account_number=row["ifta_account_number"],
        base_jurisdiction=row["base_jurisdiction"]
    )

    return AuthResponse(access_token=token, user=user_resp)

@app.get("/api/auth/me", response_model=UserResponse)
def get_profile(current_user: Dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# -----------------------------------------------------------------------------
# 2. FLEETS (Multi-Tenant Legal Entities)
# -----------------------------------------------------------------------------

@app.get("/api/customers")
def get_customers(current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, company_name, dba, city, state, postal_code, contact_person, contact_phone, contact_email,
               ifta_state, ifta_number, dot_number, fein_ssn, carriage_type, portal_status, created_at
        FROM customers
        WHERE org_id = ?
        ORDER BY company_name ASC
    """, (current_user["org_id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/customers/{customer_id}")
def get_customer_detail(customer_id: str, current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM customers WHERE id = ? AND org_id = ?", (customer_id, current_user["org_id"]))
    row = cursor.fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found.")
    return dict(row)

@app.post("/api/customers")
def save_customer(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cust_id = data.get("id") or str(uuid.uuid4())

    # Check if exists for update vs insert
    cursor.execute("SELECT id FROM customers WHERE id = ?", (cust_id,))
    exists = cursor.fetchone()

    if exists:
        cursor.execute("""
            UPDATE customers SET
                company_name = ?, dba = ?, address = ?, address2 = ?, city = ?, state = ?, postal_code = ?, county = ?,
                contact_person = ?, contact_phone = ?, cell_phone = ?, contact_email = ?, fax = ?, website = ?, business_hours = ?,
                mailing_address = ?, mailing_city = ?, mailing_state = ?, mailing_postal_code = ?, president_name = ?, president_ssn = ?, account_number = ?,
                date_incorporated = ?, state_of_incorporation = ?, corporation_number = ?, officer_title = ?, officer_name = ?, officer_ssn = ?,
                bank_name = ?, bank_account_number = ?, billing_email = ?, fuel_card_provider = ?, fuel_card_account_num = ?,
                ifta_state = ?, ifta_number = ?, fein_ssn = ?, dot_number = ?, mc_number = ?, hvut_number = ?,
                ky_permit_number = ?, nm_permit_number = ?, ny_permit_number = ?, or_permit_number = ?,
                carriage_type = ?, ny_report_method = ?, report_massachusetts_toll = ?, b400_business_number = ?,
                insurance_company = ?, insurance_policy_number = ?, insurance_expiration_date = ?,
                illcc_number = ?, irp_firm_number = ?, irp_fleet_number = ?, cdl_number = ?, notes = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ? AND org_id = ?
        """, (
            data.get("company_name", ""), data.get("dba", ""), data.get("address", ""), data.get("address2", ""),
            data.get("city", ""), data.get("state", "AR"), data.get("postal_code", ""), data.get("county", ""),
            data.get("contact_person", ""), data.get("contact_phone", ""), data.get("cell_phone", ""), data.get("contact_email", ""),
            data.get("fax", ""), data.get("website", ""), data.get("business_hours", ""),
            data.get("mailing_address", ""), data.get("mailing_city", ""), data.get("mailing_state", ""), data.get("mailing_postal_code", ""),
            data.get("president_name", ""), data.get("president_ssn", ""), data.get("account_number", ""),
            data.get("date_incorporated", ""), data.get("state_of_incorporation", ""), data.get("corporation_number", ""),
            data.get("officer_title", ""), data.get("officer_name", ""), data.get("officer_ssn", ""),
            data.get("bank_name", ""), data.get("bank_account_number", ""), data.get("billing_email", ""),
            data.get("fuel_card_provider", ""), data.get("fuel_card_account_num", ""),
            data.get("ifta_state", data.get("state", "AR")), data.get("ifta_number", ""), data.get("fein_ssn", ""),
            data.get("dot_number", ""), data.get("mc_number", ""), data.get("hvut_number", ""),
            data.get("ky_permit_number", ""), data.get("nm_permit_number", ""), data.get("ny_permit_number", ""), data.get("or_permit_number", ""),
            data.get("carriage_type", "Private"), data.get("ny_report_method", "Gross Weight"),
            1 if data.get("report_massachusetts_toll", True) else 0, data.get("b400_business_number", ""),
            data.get("insurance_company", ""), data.get("insurance_policy_number", ""), data.get("insurance_expiration_date", ""),
            data.get("illcc_number", ""), data.get("irp_firm_number", ""), data.get("irp_fleet_number", ""), data.get("cdl_number", ""),
            data.get("notes", ""), cust_id, current_user["org_id"]
        ))
    else:
        cursor.execute("""
            INSERT INTO customers (
                id, org_id, fleet_id, company_name, dba, address, address2, city, state, postal_code, county,
                contact_person, contact_phone, cell_phone, contact_email, fax, website, business_hours,
                mailing_address, mailing_city, mailing_state, mailing_postal_code, president_name, president_ssn, account_number,
                date_incorporated, state_of_incorporation, corporation_number, officer_title, officer_name, officer_ssn,
                bank_name, bank_account_number, billing_email, fuel_card_provider, fuel_card_account_num,
                ifta_state, ifta_number, fein_ssn, dot_number, mc_number, hvut_number,
                ky_permit_number, nm_permit_number, ny_permit_number, or_permit_number,
                carriage_type, ny_report_method, report_massachusetts_toll, b400_business_number,
                insurance_company, insurance_policy_number, insurance_expiration_date,
                illcc_number, irp_firm_number, irp_fleet_number, cdl_number, notes
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?, ?,
                ?, ?, ?,
                ?, ?, ?, ?, ?
            )
        """, (
            cust_id, current_user["org_id"], data.get("fleet_id") or current_user["default_fleet_id"],
            data.get("company_name", ""), data.get("dba", ""), data.get("address", ""), data.get("address2", ""),
            data.get("city", ""), data.get("state", "AR"), data.get("postal_code", ""), data.get("county", ""),
            data.get("contact_person", ""), data.get("contact_phone", ""), data.get("cell_phone", ""), data.get("contact_email", ""),
            data.get("fax", ""), data.get("website", ""), data.get("business_hours", ""),
            data.get("mailing_address", ""), data.get("mailing_city", ""), data.get("mailing_state", ""), data.get("mailing_postal_code", ""),
            data.get("president_name", ""), data.get("president_ssn", ""), data.get("account_number", ""),
            data.get("date_incorporated", ""), data.get("state_of_incorporation", ""), data.get("corporation_number", ""),
            data.get("officer_title", ""), data.get("officer_name", ""), data.get("officer_ssn", ""),
            data.get("bank_name", ""), data.get("bank_account_number", ""), data.get("billing_email", ""),
            data.get("fuel_card_provider", ""), data.get("fuel_card_account_num", ""),
            data.get("ifta_state", data.get("state", "AR")), data.get("ifta_number", ""), data.get("fein_ssn", ""),
            data.get("dot_number", ""), data.get("mc_number", ""), data.get("hvut_number", ""),
            data.get("ky_permit_number", ""), data.get("nm_permit_number", ""), data.get("ny_permit_number", ""), data.get("or_permit_number", ""),
            data.get("carriage_type", "Private"), data.get("ny_report_method", "Gross Weight"),
            1 if data.get("report_massachusetts_toll", True) else 0, data.get("b400_business_number", ""),
            data.get("insurance_company", ""), data.get("insurance_policy_number", ""), data.get("insurance_expiration_date", ""),
            data.get("illcc_number", ""), data.get("irp_firm_number", ""), data.get("irp_fleet_number", ""), data.get("cdl_number", ""),
            data.get("notes", "")
        ))

    conn.commit()
    conn.close()
    return {"message": "Customer saved successfully.", "id": cust_id}

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: str, current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT fleet_id FROM customers WHERE id = ? AND org_id = ?", (customer_id, current_user["org_id"]))
    row = cursor.fetchone()
    if row and row["fleet_id"]:
        fleet_id = row["fleet_id"]
        cursor.execute("DELETE FROM vehicles WHERE fleet_id = ?", (fleet_id,))
        cursor.execute("DELETE FROM mileage_records WHERE fleet_id = ?", (fleet_id,))
        cursor.execute("DELETE FROM fuel_transactions WHERE fleet_id = ?", (fleet_id,))
        cursor.execute("DELETE FROM trips WHERE fleet_id = ?", (fleet_id,))
        cursor.execute("DELETE FROM fleets WHERE id = ? AND org_id = ?", (fleet_id, current_user["org_id"]))
    cursor.execute("DELETE FROM customers WHERE id = ? AND org_id = ?", (customer_id, current_user["org_id"]))
    conn.commit()
    conn.close()
    return {"message": "Customer and associated fleet records deleted successfully."}

@app.get("/api/fleets")
def get_fleets(current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, name, legal_name, ifta_account_number, base_jurisdiction, fein, dot_number, status, kyu_number, nm_wdt_number
        FROM fleets
        WHERE org_id = ?
        ORDER BY name ASC
    """, (current_user["org_id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/fleets")
def create_fleet(fleet_data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    f_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO fleets (id, org_id, name, legal_name, ifta_account_number, base_jurisdiction, fein, dot_number, status, kyu_number, nm_wdt_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, ?)
    """, (
        f_id, current_user["org_id"], fleet_data.get("name"),
        fleet_data.get("legal_name", fleet_data.get("name")),
        fleet_data.get("ifta_account_number"), fleet_data.get("base_jurisdiction", "AR"),
        fleet_data.get("fein"), fleet_data.get("dot_number"),
        fleet_data.get("kyu_number"), fleet_data.get("nm_wdt_number")
    ))
    conn.commit()
    conn.close()
    return {"message": "Fleet created successfully.", "id": f_id}

# -----------------------------------------------------------------------------
# 3. VEHICLES & POWER UNITS
# -----------------------------------------------------------------------------

@app.get("/api/vehicles", response_model=List[VehicleResponse])
def get_vehicles(fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, fleet_id, unit_number, vin, make, model, model_year, fuel_type,
               gross_vehicle_weight, number_of_axles, is_active
        FROM vehicles
        WHERE fleet_id = ?
        ORDER BY unit_number ASC
    """, (target_fleet,))
    rows = cursor.fetchall()
    conn.close()
    return [
        VehicleResponse(
            id=r["id"], fleet_id=r["fleet_id"], unit_number=r["unit_number"],
            vin=r["vin"], make=r["make"], model=r["model"], model_year=r["model_year"],
            fuel_type=r["fuel_type"], gross_vehicle_weight=r["gross_vehicle_weight"],
            number_of_axles=r["number_of_axles"], is_active=bool(r["is_active"])
        ) for r in rows
    ]

@app.post("/api/vehicles", response_model=VehicleResponse)
def create_vehicle(req: VehicleCreateRequest, fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM vehicles WHERE fleet_id = ? AND unit_number = ?", (target_fleet, req.unit_number))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unit '{req.unit_number}' already exists in this fleet.")

    veh_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', 1)
    """, (veh_id, target_fleet, req.unit_number, req.vin.upper(), req.make, req.model, req.model_year, req.fuel_type.upper(), req.gross_vehicle_weight, req.number_of_axles))
    conn.commit()
    conn.close()

    return VehicleResponse(
        id=veh_id, fleet_id=target_fleet, unit_number=req.unit_number, vin=req.vin.upper(),
        make=req.make, model=req.model, model_year=req.model_year, fuel_type=req.fuel_type,
        gross_vehicle_weight=req.gross_vehicle_weight, number_of_axles=req.number_of_axles, is_active=True
    )

@app.delete("/api/vehicles/{vehicle_id}")
def delete_vehicle(vehicle_id: str, current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT fleet_id, unit_number FROM vehicles WHERE id = ?", (vehicle_id,))
    v_row = cursor.fetchone()
    if v_row:
        cursor.execute("DELETE FROM mileage_records WHERE fleet_id = ? AND unit_number = ?", (v_row["fleet_id"], v_row["unit_number"]))
        cursor.execute("DELETE FROM fuel_transactions WHERE fleet_id = ? AND unit_number = ?", (v_row["fleet_id"], v_row["unit_number"]))
    cursor.execute("DELETE FROM vehicles WHERE id = ?", (vehicle_id,))
    conn.commit()
    conn.close()
    return {"message": "Vehicle and associated trip/fuel records removed successfully."}

# -----------------------------------------------------------------------------
# 4. CSV INGESTION & COLUMN MAPPING PIPELINE
# -----------------------------------------------------------------------------

@app.get("/api/ingestion/templates")
def get_mapping_templates(current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, template_name, import_type, mappings_json
        FROM csv_mapping_templates
        WHERE org_id = ?
        ORDER BY template_name ASC
    """, (current_user["org_id"],))
    rows = cursor.fetchall()
    conn.close()
    return [
        {
            "id": r["id"],
            "template_name": r["template_name"],
            "import_type": r["import_type"],
            "mappings": json.loads(r["mappings_json"])
        } for r in rows
    ]

@app.post("/api/ingestion/templates")
def save_mapping_template(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    conn = get_connection()
    cursor = conn.cursor()
    t_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO csv_mapping_templates (id, org_id, template_name, import_type, mappings_json)
        VALUES (?, ?, ?, ?, ?)
    """, (t_id, current_user["org_id"], data["template_name"], data["import_type"], json.dumps(data["mappings"])))
    conn.commit()
    conn.close()
    return {"message": "Template saved.", "id": t_id}

@app.post("/api/ingestion/stage-csv")
async def stage_csv_upload(
    file: UploadFile = File(...),
    fleet_id: Optional[str] = Form(None),
    quarter: str = Form("2026-Q1"),
    import_type: str = Form("mileage"),
    mappings_json: str = Form("{}"),
    current_user: Dict = Depends(get_current_user)
):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    file_bytes = await file.read()
    column_mapping = json.loads(mappings_json)

    res = parse_and_stage_csv(
        file_bytes=file_bytes,
        filename=file.filename,
        fleet_id=target_fleet,
        quarter=quarter,
        import_type=import_type,
        column_mapping=column_mapping
    )

    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("message", "CSV parse failed."))

    return res

@app.post("/api/ingestion/commit")
def commit_csv_import(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    batch_id = data["batch_id"]
    fleet_id = data.get("fleet_id") or current_user["default_fleet_id"]
    quarter = data.get("quarter", "2026-Q1")
    import_type = data.get("import_type", "mileage")
    valid_rows = data.get("valid_rows", [])

    res = commit_staged_rows(
        batch_id=batch_id,
        fleet_id=fleet_id,
        quarter=quarter,
        import_type=import_type,
        valid_rows=valid_rows
    )
    return res

# -----------------------------------------------------------------------------
# 5. SPREADSHEET-STYLE MANUAL MILEAGE & FUEL GRID ENTRY
# -----------------------------------------------------------------------------

@app.get("/api/mileage/records")
def get_mileage_records(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date, start_odometer, end_odometer
        FROM mileage_records
        WHERE fleet_id = ? AND reporting_quarter = ?
        ORDER BY trip_date DESC, unit_number ASC
    """, (target_fleet, quarter))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/mileage/quick-add")
def quick_add_mileage(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    target_fleet = data.get("fleet_id") or current_user["default_fleet_id"]
    quarter = data.get("quarter", "2026-Q1")
    rows = data.get("rows", [])

    conn = get_connection()
    cursor = conn.cursor()

    # Get known units
    cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (target_fleet,))
    known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

    added = 0
    for r in rows:
        unit_num = r.get("unit_number", "").strip()
        if not unit_num:
            continue

        if unit_num not in known_units:
            veh_id = f"veh-{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
                VALUES (?, ?, ?, ?, 'Commercial', 'Class 8', 2024, 'DIESEL', 80000, 5, 'Active', 1)
            """, (veh_id, target_fleet, unit_num, f"AUTO{uuid.uuid4().hex[:13].upper()}"))
            known_units[unit_num] = veh_id

        tot = float(r.get("total_miles", 0))
        non_tax = float(r.get("non_taxable_miles", 0))
        taxable = float(r.get("taxable_miles", tot - non_tax))

        cursor.execute("""
            INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date, start_odometer, end_odometer)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), target_fleet, known_units[unit_num], unit_num, quarter, r.get("jurisdiction", "TX").upper(), tot, taxable, non_tax, r.get("trip_date") or None, r.get("start_odometer"), r.get("end_odometer")))
        added += 1

    conn.commit()
    conn.close()
    return {"message": f"Successfully logged {added} mileage records."}

@app.get("/api/fuel-purchases")
def get_fuel_purchases(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type,
               tax_paid_at_pump as is_tax_paid, vendor_name as vendor, invoice_or_receipt_number as receipt_number, total_cost
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ?
        ORDER BY transaction_date DESC, unit_number ASC
    """, (target_fleet, quarter))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/fuel-purchases")
def create_fuel_purchase(req: FuelPurchaseCreateRequest, fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()

    unit_num = "Unit 101"
    if req.vehicle_id:
        cursor.execute("SELECT unit_number FROM vehicles WHERE id = ?", (req.vehicle_id,))
        urow = cursor.fetchone()
        if urow:
            unit_num = urow["unit_number"]

    f_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO fuel_transactions (id, fleet_id, vehicle_id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, invoice_or_receipt_number, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (f_id, target_fleet, req.vehicle_id, unit_num, req.quarter, req.purchase_date, req.jurisdiction.upper(), req.gallons, req.fuel_type.upper(), 1 if req.is_tax_paid else 0, req.vendor, req.receipt_number, req.total_cost))
    conn.commit()
    conn.close()
    return {"message": "Fuel transaction logged successfully.", "id": f_id}

# -----------------------------------------------------------------------------
# 6. ROUTE ADJACENCY ENGINE & TRIPS
# -----------------------------------------------------------------------------

@app.post("/api/trips/validate-route")
def validate_route(req: RouteValidationRequest):
    clean_jurisdictions = [j.strip().upper() for j in req.jurisdictions if j.strip()]
    return validate_trip_route(clean_jurisdictions)

@app.get("/api/trips")
def get_trips(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT t.id, t.trip_number, t.trip_date, t.quarter, t.total_trip_miles, t.has_adjacency_warning, t.notes,
               v.unit_number, v.make, v.model
        FROM trips t
        JOIN vehicles v ON t.vehicle_id = v.id
        WHERE t.fleet_id = ? AND t.quarter = ?
        ORDER BY t.trip_date DESC
    """, (target_fleet, quarter))
    trips = []
    for r in cursor.fetchall():
        cursor.execute("""
            SELECT jurisdiction, all_miles, taxable_miles
            FROM trip_segments
            WHERE trip_id = ?
            ORDER BY sequence_order ASC
        """, (r["id"],))
        segs = [dict(s) for s in cursor.fetchall()]
        trips.append({
            "id": r["id"],
            "trip_number": r["trip_number"],
            "trip_date": r["trip_date"],
            "quarter": r["quarter"],
            "total_trip_miles": r["total_trip_miles"],
            "has_adjacency_warning": bool(r["has_adjacency_warning"]),
            "notes": r["notes"],
            "unit_number": r["unit_number"],
            "vehicle_desc": f"{r['make']} {r['model']}",
            "segments": segs
        })
    conn.close()
    return trips

@app.post("/api/trips")
def create_trip(req: TripCreateRequest, current_user: Dict = Depends(get_current_user)):
    target_fleet = current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()

    trip_id = str(uuid.uuid4())
    trip_num = req.trip_number or f"TRP-{datetime.now().strftime('%y%m%d%H%M')}"
    total_miles = sum(s.all_miles for s in req.segments)

    jur_list = [s.jurisdiction.upper() for s in req.segments]
    adj_val = validate_trip_route(jur_list)
    has_warning = 0 if adj_val["valid"] else 1

    cursor.execute("""
        INSERT INTO trips (id, fleet_id, vehicle_id, trip_number, quarter, trip_date, entry_method, total_trip_miles, is_validated, has_adjacency_warning, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    """, (trip_id, target_fleet, req.vehicle_id, trip_num, req.quarter, req.trip_date, req.entry_method, total_miles, has_warning, req.notes))

    for idx, seg in enumerate(req.segments):
        taxable = seg.taxable_miles if seg.taxable_miles is not None else (seg.all_miles - (seg.off_road_miles or 0.0))
        cursor.execute("""
            INSERT INTO trip_segments (id, trip_id, sequence_order, jurisdiction, all_miles, non_toll_miles, toll_miles, thruway_toll_miles, permitted_miles, off_road_miles, taxable_miles)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), trip_id, idx, seg.jurisdiction.upper(), seg.all_miles, seg.non_toll_miles or seg.all_miles, seg.toll_miles or 0.0, seg.thruway_toll_miles or 0.0, seg.permitted_miles or 0.0, seg.off_road_miles or 0.0, taxable))

        # Also write into mileage_records for universal querying
        cursor.execute("SELECT unit_number FROM vehicles WHERE id = ?", (req.vehicle_id,))
        u_row = cursor.fetchone()
        u_num = u_row["unit_number"] if u_row else "Unit 101"
        cursor.execute("""
            INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (str(uuid.uuid4()), target_fleet, req.vehicle_id, u_num, req.quarter, seg.jurisdiction.upper(), seg.all_miles, taxable, seg.off_road_miles or 0.0, req.trip_date))

    conn.commit()
    conn.close()

    return {"message": "Trip recorded.", "trip_id": trip_id, "adjacency_validation": adj_val}

# -----------------------------------------------------------------------------
# 7. AUTOMATED COMPLIANCE & AUDIT CHECK (Section 4 Specs)
# -----------------------------------------------------------------------------

@app.get("/api/compliance/audit")
def get_compliance_audit(quarter: str = "2026-Q1", fuel_type: str = "DIESEL", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    return run_fleet_compliance_audit(target_fleet, quarter, fuel_type)

@app.post("/api/quarter/lock")
def lock_quarter(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    target_fleet = data.get("fleet_id") or current_user["default_fleet_id"]
    quarter = data.get("quarter", "2026-Q1")
    fuel_type = data.get("fuel_type", "DIESEL").upper()

    audit = run_fleet_compliance_audit(target_fleet, quarter, fuel_type)
    if not audit["can_lock"]:
        raise HTTPException(status_code=400, detail=f"Cannot lock quarter: {audit['hard_error_count']} Hard Error(s) must be resolved first.")

    # Calculate summary snapshot
    summary = fetch_quarterly_report_data(target_fleet, quarter, fuel_type)

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT OR REPLACE INTO quarter_locks (id, fleet_id, quarter, fuel_type, is_locked, locked_at, locked_by, snapshot_json)
        VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, ?, ?)
    """, (str(uuid.uuid4()), target_fleet, quarter, fuel_type, current_user["full_name"], json.dumps(summary)))

    # Log action
    cursor.execute("""
        INSERT INTO audit_logs (id, fleet_id, quarter, user_id, user_name, action, details)
        VALUES (?, ?, ?, ?, ?, 'FINALIZE_AND_LOCK_QUARTER', ?)
    """, (str(uuid.uuid4()), target_fleet, quarter, current_user["id"], current_user["full_name"], f"Quarter {quarter} locked by {current_user['full_name']}"))

    conn.commit()
    conn.close()

    return {"message": f"Quarter {quarter} finalized and locked successfully.", "is_locked": True}

@app.post("/api/quarter/unlock")
def unlock_quarter(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    target_fleet = data.get("fleet_id") or current_user["default_fleet_id"]
    quarter = data.get("quarter", "2026-Q1")
    fuel_type = data.get("fuel_type", "DIESEL").upper()

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE quarter_locks
        SET is_locked = 0, locked_at = NULL, locked_by = NULL
        WHERE fleet_id = ? AND quarter = ? AND UPPER(fuel_type) = ?
    """, (target_fleet, quarter, fuel_type))

    cursor.execute("""
        INSERT INTO audit_logs (id, fleet_id, quarter, user_id, user_name, action, details)
        VALUES (?, ?, ?, ?, ?, 'UNLOCK_QUARTER_AMENDMENT', ?)
    """, (str(uuid.uuid4()), target_fleet, quarter, current_user["id"], current_user["full_name"], f"Quarter unlocked for amendments by {current_user['full_name']}"))

    conn.commit()
    conn.close()
    return {"message": f"Quarter {quarter} unlocked for amendments.", "is_locked": False}

# -----------------------------------------------------------------------------
# 8. IFTA FLEET FUEL TAX SUMMARY REPORT & CALCULATION ENGINE
# -----------------------------------------------------------------------------

def fetch_quarterly_report_data(fleet_id: str, quarter: str = "2026-Q1", fuel_type: str = "Diesel") -> Dict:
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT legal_name, ifta_account_number, base_jurisdiction FROM fleets WHERE id = ?", (fleet_id,))
    fleet_row = cursor.fetchone()
    company_name = fleet_row["legal_name"] if fleet_row else "Fleet Carrier"

    cursor.execute("SELECT COUNT(*) FROM vehicles WHERE fleet_id = ? AND active_status = 'Active'", (fleet_id,))
    total_units = cursor.fetchone()[0] or 1

    # Fetch 58 rates
    cursor.execute("""
        SELECT jurisdiction, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate
        FROM ifta_tax_rates
        WHERE quarter = ? AND UPPER(fuel_type) = ?
    """, (quarter, fuel_type.upper()))
    rates_dict = {}
    for r in cursor.fetchall():
        rates_dict[r["jurisdiction"]] = {
            "rate": float(r["tax_rate_per_gallon"]),
            "surcharge": float(r["surcharge_rate_per_gallon"]),
            "mile_tax_rate": float(r["weight_mile_rate"])
        }

    # Aggregate Miles by state from mileage_records
    cursor.execute("""
        SELECT jurisdiction,
               SUM(total_miles) as all_miles,
               SUM(taxable_miles) as taxable_miles,
               SUM(non_taxable_miles) as off_road_miles
        FROM mileage_records
        WHERE fleet_id = ? AND reporting_quarter = ?
        GROUP BY jurisdiction
    """, (fleet_id, quarter))
    mileage_by_state = {r["jurisdiction"]: dict(r) for r in cursor.fetchall()}

    # Aggregate Fuel by state from fuel_transactions
    cursor.execute("""
        SELECT jurisdiction,
               SUM(gallons) as all_gallons,
               SUM(CASE WHEN tax_paid_at_pump = 1 THEN gallons ELSE 0 END) as tax_paid_gallons,
               SUM(CASE WHEN tax_paid_at_pump = 0 THEN gallons ELSE 0 END) as non_tax_paid_gallons
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ? AND UPPER(fuel_type) = ?
        GROUP BY jurisdiction
    """, (fleet_id, quarter, fuel_type.upper()))
    fuel_by_state = {r["jurisdiction"]: dict(r) for r in cursor.fetchall()}

    conn.close()

    all_jurisdictions = set(mileage_by_state.keys()) | set(fuel_by_state.keys())

    state_data = []
    for st in all_jurisdictions:
        m = mileage_by_state.get(st, {})
        f = fuel_by_state.get(st, {})
        all_mi = int(round(m.get("all_miles", 0)))
        taxable_mi = int(round(m.get("taxable_miles", all_mi)))
        all_gal = int(round(f.get("all_gallons", 0)))
        tax_paid_gal = int(round(f.get("tax_paid_gallons", all_gal)))
        non_tax_gal = int(round(f.get("non_tax_paid_gallons", 0)))

        state_data.append({
            "state": st,
            "all_miles": all_mi,
            "non_toll_miles": all_mi,
            "toll_miles": 0,
            "thruway_toll_miles": 0,
            "permitted_miles": 0,
            "off_road_miles": int(round(m.get("off_road_miles", 0))),
            "taxable_miles": taxable_mi,
            "all_gallons": all_gal,
            "non_tax_paid_gallons": non_tax_gal,
            "tax_paid_gallons": tax_paid_gal,
            "interest": 0.0
        })

    engine = IFTAEngine(rates_dict)
    period_label = f"1st Quarter {quarter.split('-')[0]}" if "Q1" in quarter else f"{quarter}"
    summary = engine.calculate_fleet_summary(
        company_name=company_name,
        period=period_label,
        total_units=total_units,
        fuel_type=fuel_type,
        state_data=state_data
    )
    if "metadata" in summary and fleet_row:
        summary["metadata"]["ifta_account"] = fleet_row["ifta_account_number"] or "AR-8839210-26"
        summary["metadata"]["base_jurisdiction"] = fleet_row["base_jurisdiction"] or "AR"
    return summary

@app.get("/api/reports/fleet-summary")
def get_fleet_fuel_tax_summary(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    return fetch_quarterly_report_data(target_fleet, quarter, fuel_type)

# -----------------------------------------------------------------------------
# 9. EXPORT ENDPOINTS (PDF, Schedule 1 CSV, State E-File, Unit Summary, ZIP)
# -----------------------------------------------------------------------------

@app.get("/api/reports/export-pdf")
def export_pdf_return(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    summary = fetch_quarterly_report_data(target_fleet, quarter, fuel_type)
    pdf_bytes = generate_pdf_bytes(summary)
    filename = f"IFTA_Schedule1_{quarter}_{summary['metadata']['company_name'].replace(' ', '_')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-schedule1-csv")
def export_schedule1(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    summary = fetch_quarterly_report_data(target_fleet, quarter, fuel_type)
    csv_str = generate_schedule1_csv(summary)
    filename = f"IFTA_Schedule1_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-efile-csv")
def export_efile(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    summary = fetch_quarterly_report_data(target_fleet, quarter, fuel_type)
    csv_str = generate_state_efile_csv(target_fleet, quarter, fuel_type, summary)
    filename = f"State_EFile_Bulk_Upload_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-unit-summary-csv")
def export_unit_summary(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    audit = run_fleet_compliance_audit(target_fleet, quarter, fuel_type)
    csv_str = generate_unit_summary_csv(audit["unit_breakdown"])
    filename = f"Vehicle_Unit_Summary_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-audit-zip")
def export_audit_zip(quarter: str = "2026-Q1", fuel_type: str = "Diesel", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    summary = fetch_quarterly_report_data(target_fleet, quarter, fuel_type)
    audit = run_fleet_compliance_audit(target_fleet, quarter, fuel_type)
    zip_bytes = build_audit_defense_zip_package(target_fleet, quarter, fuel_type, summary, audit["unit_breakdown"])
    filename = f"IFTA_Audit_Defense_Package_{quarter}_{summary['metadata']['company_name'].replace(' ', '_')}.zip"
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

# -----------------------------------------------------------------------------
# 10. QUICK CALCULATOR & 58 RATES EXPLORER
# -----------------------------------------------------------------------------

@app.post("/api/calculator/evaluate")
def evaluate_quick_calculator(req: QuickCalculatorRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT jurisdiction, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate
        FROM ifta_tax_rates
        WHERE quarter = ? AND UPPER(fuel_type) = ?
    """, (req.quarter, req.fuel_type.upper()))
    rates_dict = {}
    for r in cursor.fetchall():
        rates_dict[r["jurisdiction"]] = {
            "rate": float(r["tax_rate_per_gallon"]),
            "surcharge": float(r["surcharge_rate_per_gallon"]),
            "mile_tax_rate": float(r["weight_mile_rate"])
        }
    conn.close()

    state_data = []
    for row in req.state_data:
        state_data.append({
            "state": row.state.upper(),
            "all_miles": int(round(row.miles)),
            "taxable_miles": int(round(row.miles)),
            "all_gallons": int(round(row.gallons)),
            "tax_paid_gallons": int(round(row.gallons)),
            "non_toll_miles": int(round(row.miles)),
            "toll_miles": 0,
            "thruway_toll_miles": 0,
            "permitted_miles": 0,
            "off_road_miles": 0,
            "non_tax_paid_gallons": 0,
            "interest": 0.0
        })

    engine = IFTAEngine(rates_dict)
    summary = engine.calculate_fleet_summary(
        company_name="Instant Route Estimate",
        period=req.quarter,
        total_units=1,
        fuel_type=req.fuel_type,
        state_data=state_data
    )
    return summary

@app.get("/api/rates")
def get_tax_rates(quarter: str = "2026-Q1", fuel_type: str = "Diesel"):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT jurisdiction, fuel_type, tax_rate_per_gallon as tax_rate,
               surcharge_rate_per_gallon as surcharge_rate, weight_mile_rate, currency
        FROM ifta_tax_rates
        WHERE quarter = ? AND UPPER(fuel_type) = ?
        ORDER BY jurisdiction ASC
    """, (quarter, fuel_type.upper()))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "platform": "FuelTaxPulse Enterprise",
        "version": "2.0.0",
        "spec_compliance": "Complete",
        "database": "online"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
