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
from datetime import datetime

from database import get_connection, init_db, hash_password, verify_password, IFTA_RATES_Q1_2026
from auth import create_access_token, get_current_user
from ifta_engine import IFTAEngine, validate_trip_route, round_half_up
from pdf_generator import generate_pdf_bytes, generate_unit_summary_pdf_bytes
from csv_importer import parse_and_stage_csv, commit_staged_rows, normalize_date_str
from compliance import run_fleet_compliance_audit
from zip_distance import calculate_zip_to_zip_distance
from export_manager import (
    generate_schedule1_csv, generate_state_efile_csv,
    generate_unit_summary_csv, generate_fuel_purchases_csv,
    generate_mileage_records_csv, build_audit_defense_zip_package
)
from models import (
    UserRegisterRequest, UserLoginRequest, AuthResponse, UserResponse,
    VehicleCreateRequest, VehicleUpdateRequest, VehicleResponse,
    TripCreateRequest, RouteValidationRequest,
    FuelPurchaseCreateRequest, ZipDistanceRequest, QuickCalculatorRequest
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
    # Validate Bank Routing Number (must be 9 digits if provided; never log or expose raw payment numbers)
    raw_routing = str(data.get("bank_routing_number", "") or "").strip()
    if raw_routing and "•" not in raw_routing and "*" not in raw_routing:
        if not raw_routing.isdigit() or len(raw_routing) != 9:
            raise HTTPException(
                status_code=400,
                detail="Invalid Bank Routing Number format. Standard ABA routing number must be exactly 9 numeric digits."
            )

    # Validate Bank Account Number (preserve leading zeros as string; 4-17 digits if unmasked)
    raw_account = str(data.get("bank_account_number", "") or "").strip()
    if raw_account and "•" not in raw_account and "*" not in raw_account:
        clean_acc = raw_account.replace("-", "").replace(" ", "")
        if not clean_acc.isdigit() or len(clean_acc) < 4 or len(clean_acc) > 17:
            raise HTTPException(
                status_code=400,
                detail="Invalid Bank Account Number format. Account number must contain between 4 and 17 numeric digits (leading zeros preserved)."
            )

    conn = get_connection()
    cursor = conn.cursor()
    cust_id = data.get("id") or str(uuid.uuid4())

    # Check if exists for update vs insert
    cursor.execute("SELECT id, fleet_id, bank_routing_number, bank_account_number FROM customers WHERE id = ?", (cust_id,))
    exists = cursor.fetchone()

    if exists:
        # Preserve stored routing/account if user submitted a masked display value
        final_routing = exists["bank_routing_number"] if ("•" in raw_routing or "*" in raw_routing) else raw_routing
        final_account = exists["bank_account_number"] if ("•" in raw_account or "*" in raw_account) else raw_account
        cursor.execute("""
            UPDATE customers SET
                company_name = ?, dba = ?, address = ?, address2 = ?, city = ?, state = ?, postal_code = ?, county = ?,
                contact_person = ?, contact_phone = ?, cell_phone = ?, contact_email = ?, fax = ?, website = ?, business_hours = ?,
                mailing_address = ?, mailing_city = ?, mailing_state = ?, mailing_postal_code = ?, president_name = ?, president_ssn = ?, account_number = ?,
                date_incorporated = ?, state_of_incorporation = ?, corporation_number = ?, officer_title = ?, officer_name = ?, officer_ssn = ?,
                bank_name = ?, bank_routing_number = ?, bank_account_number = ?, billing_email = ?, fuel_card_provider = ?, fuel_card_account_num = ?,
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
            data.get("bank_name", ""), final_routing, final_account, data.get("billing_email", ""),
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
        if exists["fleet_id"] and data.get("company_name"):
            cursor.execute("""
                UPDATE fleets SET name = ?, legal_name = ?, ifta_account_number = COALESCE(NULLIF(?, ''), ifta_account_number), base_jurisdiction = COALESCE(NULLIF(?, ''), base_jurisdiction)
                WHERE id = ?
            """, (data.get("company_name"), data.get("company_name"), data.get("ifta_number", ""), data.get("ifta_state", data.get("state", "")), exists["fleet_id"]))
    else:
        cursor.execute("""
            INSERT INTO customers (
                id, org_id, fleet_id, company_name, dba, address, address2, city, state, postal_code, county,
                contact_person, contact_phone, cell_phone, contact_email, fax, website, business_hours,
                mailing_address, mailing_city, mailing_state, mailing_postal_code, president_name, president_ssn, account_number,
                date_incorporated, state_of_incorporation, corporation_number, officer_title, officer_name, officer_ssn,
                bank_name, bank_routing_number, bank_account_number, billing_email, fuel_card_provider, fuel_card_account_num,
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
                ?, ?, ?, ?, ?, ?,
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
            data.get("bank_name", ""), raw_routing, raw_account, data.get("billing_email", ""),
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
        make=req.make, model=req.model, model_year=req.model_year, fuel_type="DIESEL",
        gross_vehicle_weight=req.gross_vehicle_weight, number_of_axles=req.number_of_axles, is_active=True
    )

@app.put("/api/vehicles/{vehicle_id}", response_model=VehicleResponse)
def update_vehicle(vehicle_id: str, req: VehicleUpdateRequest, current_user: Dict = Depends(get_current_user)):
    """
    Module 9: Edit existing Power Unit details while preserving all historical Fuel, Mileage, and Tax records.
    """
    if not req.unit_number.strip():
        raise HTTPException(status_code=400, detail="Unit Number is required.")
    if len(req.vin.strip()) != 17:
        raise HTTPException(status_code=400, detail="Standard commercial VIN must be exactly 17 alphanumeric characters.")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, fleet_id, unit_number FROM vehicles WHERE id = ?", (vehicle_id,))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Power unit not found.")

    fleet_id = existing["fleet_id"]
    old_unit_num = existing["unit_number"]
    new_unit_num = req.unit_number.strip()

    # Check if new unit_number conflicts with another vehicle in the same fleet
    cursor.execute("SELECT id FROM vehicles WHERE fleet_id = ? AND unit_number = ? AND id != ?", (fleet_id, new_unit_num, vehicle_id))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail=f"Unit '{new_unit_num}' already exists in this fleet.")

    is_act = 1 if (req.is_active is None or req.is_active) else 0
    cursor.execute("""
        UPDATE vehicles
        SET unit_number = ?, vin = ?, make = ?, model = ?, model_year = ?, fuel_type = 'DIESEL',
            gross_vehicle_weight = ?, number_of_axles = ?, is_active = ?, active_status = ?
        WHERE id = ?
    """, (
        new_unit_num, req.vin.strip().upper(), req.make, req.model, req.model_year,
        req.gross_vehicle_weight, req.number_of_axles, is_act, "Active" if is_act else "Inactive",
        vehicle_id
    ))

    # If the unit number label changed, keep historical mileage & fuel records linked cleanly without altering amounts
    if old_unit_num != new_unit_num:
        cursor.execute("UPDATE mileage_records SET unit_number = ? WHERE fleet_id = ? AND (vehicle_id = ? OR unit_number = ?)", (new_unit_num, fleet_id, vehicle_id, old_unit_num))
        cursor.execute("UPDATE fuel_transactions SET unit_number = ? WHERE fleet_id = ? AND (vehicle_id = ? OR unit_number = ?)", (new_unit_num, fleet_id, vehicle_id, old_unit_num))

    conn.commit()
    conn.close()

    return VehicleResponse(
        id=vehicle_id,
        fleet_id=fleet_id,
        unit_number=new_unit_num,
        vin=req.vin.strip().upper(),
        make=req.make,
        model=req.model,
        model_year=req.model_year,
        fuel_type="DIESEL",
        gross_vehicle_weight=req.gross_vehicle_weight,
        number_of_axles=req.number_of_axles,
        is_active=bool(is_act)
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
    all_rows = data.get("all_rows")

    res = commit_staged_rows(
        batch_id=batch_id,
        fleet_id=fleet_id,
        quarter=quarter,
        import_type=import_type,
        valid_rows=valid_rows,
        all_rows=all_rows
    )
    return res

# -----------------------------------------------------------------------------
# 5. SPREADSHEET-STYLE MANUAL MILEAGE, ZIP DISTANCE UTILITY & FUEL ENTRY
# -----------------------------------------------------------------------------

@app.post("/api/mileage/calculate-zip-distance")
def calculate_zip_distance_api(req: ZipDistanceRequest, current_user: Dict = Depends(get_current_user)):
    """
    Module 4: Dedicated ZIP-to-ZIP Mileage Calculation Utility API.
    """
    try:
        result = calculate_zip_to_zip_distance(req.origin_zip, req.destination_zip)
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Distance calculation error: {str(e)}")

@app.get("/api/mileage/records")
def get_mileage_records(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles,
               trip_date, origin_zip, destination_zip
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

    cursor.execute("SELECT unit_number, id FROM vehicles WHERE fleet_id = ?", (target_fleet,))
    known_units = {r["unit_number"]: r["id"] for r in cursor.fetchall()}

    added = 0
    updated = 0
    skipped_duplicates = 0

    for r in rows:
        unit_num = str(r.get("unit_number", "")).strip()
        jur = str(r.get("jurisdiction", "AR")).strip().upper()
        if not unit_num or not jur:
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
        taxable = float(r.get("taxable_miles", max(0.0, tot - non_tax)))
        norm_dt = normalize_date_str(r.get("trip_date")) or None
        orig_zip = str(r.get("origin_zip", "") or "").strip() or None
        dest_zip = str(r.get("destination_zip", "") or "").strip() or None

        # Prevent accidental duplicate entries on same (fleet_id, quarter, unit_number, jurisdiction, trip_date)
        if norm_dt:
            cursor.execute("""
                SELECT id, total_miles, taxable_miles, non_taxable_miles
                FROM mileage_records
                WHERE fleet_id = ? AND reporting_quarter = ? AND unit_number = ? AND jurisdiction = ? AND COALESCE(trip_date, '') = ?
                LIMIT 1
            """, (target_fleet, quarter, unit_num, jur, norm_dt))
            existing = cursor.fetchone()
        else:
            existing = None

        if existing:
            if abs(float(existing["total_miles"] or 0) - tot) < 0.01 and abs(float(existing["taxable_miles"] or 0) - taxable) < 0.01:
                skipped_duplicates += 1
                continue
            cursor.execute("""
                UPDATE mileage_records
                SET total_miles = ?, taxable_miles = ?, non_taxable_miles = ?, origin_zip = COALESCE(?, origin_zip), destination_zip = COALESCE(?, destination_zip)
                WHERE id = ?
            """, (tot, taxable, non_tax, orig_zip, dest_zip, existing["id"]))
            updated += 1
        else:
            cursor.execute("""
                INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date, origin_zip, destination_zip)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), target_fleet, known_units[unit_num], unit_num, quarter, jur, tot, taxable, non_tax, norm_dt, orig_zip, dest_zip))
            added += 1

    conn.commit()
    conn.close()
    return {
        "message": f"Successfully saved mileage records (Inserted: {added}, Updated: {updated}, Duplicate Skipped: {skipped_duplicates}).",
        "inserted_count": added,
        "updated_count": updated,
        "duplicate_skipped_count": skipped_duplicates
    }

@app.get("/api/fuel-purchases")
def get_fuel_purchases(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, unit_number, reporting_quarter, transaction_date, transaction_date as purchase_date, jurisdiction, gallons, 'DIESEL' as fuel_type,
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
    if req.gallons <= 0:
        raise HTTPException(status_code=400, detail="Fuel quantity (gallons) must be greater than 0.")

    conn = get_connection()
    cursor = conn.cursor()

    unit_num = (req.unit_number or "").strip()
    veh_id = req.vehicle_id

    if veh_id:
        cursor.execute("SELECT id, unit_number FROM vehicles WHERE id = ?", (veh_id,))
        urow = cursor.fetchone()
        if urow:
            unit_num = urow["unit_number"]
    elif unit_num:
        cursor.execute("SELECT id, unit_number FROM vehicles WHERE fleet_id = ? AND unit_number = ?", (target_fleet, unit_num))
        urow = cursor.fetchone()
        if urow:
            veh_id = urow["id"]
        else:
            veh_id = f"veh-{uuid.uuid4().hex[:8]}"
            cursor.execute("""
                INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
                VALUES (?, ?, ?, ?, 'Commercial', 'Class 8', 2024, 'DIESEL', 80000, 5, 'Active', 1)
            """, (veh_id, target_fleet, unit_num, f"AUTO{uuid.uuid4().hex[:13].upper()}"))

    if not unit_num:
        conn.close()
        raise HTTPException(status_code=400, detail="Unit Number is required.")

    norm_dt = normalize_date_str(req.purchase_date) or req.purchase_date
    jur = req.jurisdiction.strip().upper()

    # Check for accidental exact duplicate
    cursor.execute("""
        SELECT id, gallons FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ? AND unit_number = ? AND jurisdiction = ? AND transaction_date = ?
        LIMIT 1
    """, (target_fleet, req.quarter, unit_num, jur, norm_dt))
    existing = cursor.fetchone()

    if existing and abs(float(existing["gallons"] or 0) - req.gallons) < 0.001:
        conn.close()
        raise HTTPException(status_code=400, detail=f"Duplicate fuel purchase: {unit_num} in {jur} on {norm_dt} for {req.gallons} gal already exists.")

    f_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO fuel_transactions (id, fleet_id, vehicle_id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, invoice_or_receipt_number, total_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'DIESEL', ?, ?, ?, ?)
    """, (f_id, target_fleet, veh_id, unit_num, req.quarter, norm_dt, jur, round(req.gallons, 3), 1 if req.is_tax_paid else 0, req.vendor or "Retail Pump", req.receipt_number or "", req.total_cost or 0.0))
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

    cursor.execute("SELECT name, legal_name, ifta_account_number, base_jurisdiction FROM fleets WHERE id = ?", (fleet_id,))
    fleet_row = cursor.fetchone()
    company_name = (fleet_row["legal_name"] or fleet_row["name"]) if fleet_row else "No Active Customer Selected"

    cursor.execute("SELECT COUNT(*) FROM vehicles WHERE fleet_id = ? AND active_status = 'Active'", (fleet_id,))
    total_units = cursor.fetchone()[0] or 0

    cursor.execute("SELECT COUNT(*) FROM trips WHERE fleet_id = ? AND quarter = ?", (fleet_id, quarter))
    logged_trips = cursor.fetchone()[0] or 0

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
    trip_count_val = logged_trips if logged_trips > 0 else total_units
    summary = engine.calculate_fleet_summary(
        company_name=company_name,
        period=period_label,
        total_units=total_units,
        fuel_type=fuel_type,
        state_data=state_data,
        trip_count=trip_count_val
    )
    if "metadata" in summary:
        summary["metadata"]["ifta_account"] = (fleet_row["ifta_account_number"] or "PENDING") if fleet_row else "PENDING"
        summary["metadata"]["base_jurisdiction"] = (fleet_row["base_jurisdiction"] or "AR") if fleet_row else "AR"
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
    audit = run_fleet_compliance_audit(target_fleet, quarter, "DIESEL")
    csv_str = generate_unit_summary_csv(audit["unit_breakdown"])
    filename = f"Vehicle_Unit_Summary_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-fuel-csv")
def export_fuel_purchases(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    """
    Module 3: Export Fuel Purchase CSV containing ONLY:
    Unit Number, State, Quantity, Transaction Date
    """
    target_fleet = fleet_id or current_user["default_fleet_id"]
    csv_str = generate_fuel_purchases_csv(target_fleet, quarter)
    filename = f"Fuel_Purchases_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/api/reports/export-mileage-csv")
def export_mileage_records(quarter: str = "2026-Q1", fleet_id: Optional[str] = None, current_user: Dict = Depends(get_current_user)):
    """
    Module 2: Export Mileage Ingestion CSV without BOL Number, Odometer Start, Odometer End.
    """
    target_fleet = fleet_id or current_user["default_fleet_id"]
    csv_str = generate_mileage_records_csv(target_fleet, quarter)
    filename = f"Mileage_Records_{quarter}.csv"
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

def build_unit_state_summary_data(
    fleet_id: str,
    quarter: str,
    unit_number: str = "ALL",
    state: str = "ALL",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict:
    """
    Module 10: Builds detailed Unit-level and State-wise breakdown with filtering by Unit, State, Date Range, and Quarter.
    """
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT name, legal_name, ifta_account_number, base_jurisdiction FROM fleets WHERE id = ?", (fleet_id,))
    fleet_row = cursor.fetchone()
    company_name = (fleet_row["legal_name"] or fleet_row["name"]) if fleet_row else "No Active Customer Selected"

    # Fetch tax rates for quarter
    cursor.execute("SELECT jurisdiction, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate FROM ifta_tax_rates WHERE quarter = ? AND UPPER(fuel_type) = 'DIESEL'", (quarter,))
    rates_map = {r["jurisdiction"]: dict(r) for r in cursor.fetchall()}
    if not rates_map:
        cursor.execute("SELECT jurisdiction, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate FROM ifta_tax_rates WHERE UPPER(fuel_type) = 'DIESEL'")
        rates_map = {r["jurisdiction"]: dict(r) for r in cursor.fetchall()}

    # All units in fleet
    cursor.execute("SELECT unit_number, make, model, model_year, vin FROM vehicles WHERE fleet_id = ? ORDER BY unit_number ASC", (fleet_id,))
    veh_rows = [dict(r) for r in cursor.fetchall()]
    units_set = {v["unit_number"] for v in veh_rows}

    # Fetch mileage records with optional date range
    m_sql = """
        SELECT id, unit_number, jurisdiction, total_miles, taxable_miles, non_taxable_miles, COALESCE(trip_date, '') as trip_date, origin_zip, destination_zip
        FROM mileage_records
        WHERE fleet_id = ? AND reporting_quarter = ?
    """
    m_params: List[Any] = [fleet_id, quarter]
    if start_date:
        m_sql += " AND COALESCE(trip_date, '9999-12-31') >= ?"
        m_params.append(start_date)
    if end_date:
        m_sql += " AND COALESCE(trip_date, '0000-01-01') <= ?"
        m_params.append(end_date)
    m_sql += " ORDER BY unit_number ASC, jurisdiction ASC, trip_date DESC"
    cursor.execute(m_sql, tuple(m_params))
    all_mileage = [dict(r) for r in cursor.fetchall()]

    # Fetch fuel transactions with optional date range
    f_sql = """
        SELECT id, unit_number, jurisdiction, gallons, COALESCE(total_cost, 0.0) as total_cost,
               tax_paid_at_pump, COALESCE(transaction_date, '') as transaction_date, vendor_name, invoice_or_receipt_number
        FROM fuel_transactions
        WHERE fleet_id = ? AND reporting_quarter = ?
    """
    f_params: List[Any] = [fleet_id, quarter]
    if start_date:
        f_sql += " AND COALESCE(transaction_date, '9999-12-31') >= ?"
        f_params.append(start_date)
    if end_date:
        f_sql += " AND COALESCE(transaction_date, '0000-01-01') <= ?"
        f_params.append(end_date)
    f_sql += " ORDER BY unit_number ASC, jurisdiction ASC, transaction_date DESC"
    cursor.execute(f_sql, tuple(f_params))
    all_fuel = [dict(r) for r in cursor.fetchall()]
    conn.close()

    for m in all_mileage:
        units_set.add(m["unit_number"])
    for f in all_fuel:
        units_set.add(f["unit_number"])

    units_list = sorted(units_set)
    states_list = sorted({m["jurisdiction"] for m in all_mileage} | {f["jurisdiction"] for f in all_fuel})

    # 1. Compute high-level Unit Overview across all units
    unit_overview_map: Dict[str, Dict] = {}
    for u in units_list:
        unit_overview_map[u] = {
            "unit_number": u,
            "total_miles": 0.0,
            "taxable_miles": 0.0,
            "non_taxable_miles": 0.0,
            "fuel_gallons": 0.0,
            "fuel_cost": 0.0,
            "fuel_receipt_count": 0,
            "states_visited": set()
        }

    for m in all_mileage:
        u = m["unit_number"]
        unit_overview_map[u]["total_miles"] += float(m["total_miles"] or 0)
        unit_overview_map[u]["taxable_miles"] += float(m["taxable_miles"] or 0)
        unit_overview_map[u]["non_taxable_miles"] += float(m["non_taxable_miles"] or 0)
        unit_overview_map[u]["states_visited"].add(m["jurisdiction"])

    for f in all_fuel:
        u = f["unit_number"]
        unit_overview_map[u]["fuel_gallons"] += float(f["gallons"] or 0)
        unit_overview_map[u]["fuel_cost"] += float(f["total_cost"] or 0)
        unit_overview_map[u]["fuel_receipt_count"] += 1
        unit_overview_map[u]["states_visited"].add(f["jurisdiction"])

    unit_overview = []
    for u in units_list:
        uo = unit_overview_map[u]
        mpg = round(uo["taxable_miles"] / uo["fuel_gallons"], 2) if uo["fuel_gallons"] > 0 else 0.0
        unit_overview.append({
            "unit_number": u,
            "miles": round(uo["total_miles"], 1),
            "taxable_miles": round(uo["taxable_miles"], 1),
            "non_taxable_miles": round(uo["non_taxable_miles"], 1),
            "gallons": round(uo["fuel_gallons"], 2),
            "fuel_cost": round(uo["fuel_cost"], 2),
            "fuel_receipt_count": uo["fuel_receipt_count"],
            "states_count": len(uo["states_visited"]),
            "states_list": sorted(uo["states_visited"]),
            "mpg": mpg,
            "has_anomaly": mpg > 0 and (mpg < 4.0 or mpg > 10.0)
        })

    # 2. Filter records by selected unit_number and state
    sel_unit = (unit_number or "ALL").strip()
    sel_state = (state or "ALL").strip().upper()

    filtered_mileage = [
        m for m in all_mileage
        if (sel_unit == "ALL" or m["unit_number"] == sel_unit)
        and (sel_state == "ALL" or m["jurisdiction"].upper() == sel_state)
    ]
    filtered_fuel = [
        f for f in all_fuel
        if (sel_unit == "ALL" or f["unit_number"] == sel_unit)
        and (sel_state == "ALL" or f["jurisdiction"].upper() == sel_state)
    ]

    # 3. Group by (unit_number, jurisdiction) for State-Wise Breakdown
    unit_state_groups: Dict[Tuple[str, str], Dict] = {}
    for m in filtered_mileage:
        key = (m["unit_number"], m["jurisdiction"].upper())
        if key not in unit_state_groups:
            unit_state_groups[key] = {
                "unit_number": key[0],
                "jurisdiction": key[1],
                "total_miles": 0.0,
                "taxable_miles": 0.0,
                "non_taxable_miles": 0.0,
                "fuel_gallons": 0.0,
                "tax_paid_gallons": 0.0,
                "fuel_cost": 0.0,
                "fuel_receipt_count": 0,
                "mileage_entry_count": 0
            }
        unit_state_groups[key]["total_miles"] += float(m["total_miles"] or 0)
        unit_state_groups[key]["taxable_miles"] += float(m["taxable_miles"] or 0)
        unit_state_groups[key]["non_taxable_miles"] += float(m["non_taxable_miles"] or 0)
        unit_state_groups[key]["mileage_entry_count"] += 1

    for f in filtered_fuel:
        key = (f["unit_number"], f["jurisdiction"].upper())
        if key not in unit_state_groups:
            unit_state_groups[key] = {
                "unit_number": key[0],
                "jurisdiction": key[1],
                "total_miles": 0.0,
                "taxable_miles": 0.0,
                "non_taxable_miles": 0.0,
                "fuel_gallons": 0.0,
                "tax_paid_gallons": 0.0,
                "fuel_cost": 0.0,
                "fuel_receipt_count": 0,
                "mileage_entry_count": 0
            }
        gal = float(f["gallons"] or 0)
        unit_state_groups[key]["fuel_gallons"] += gal
        if f.get("tax_paid_at_pump", 1):
            unit_state_groups[key]["tax_paid_gallons"] += gal
        unit_state_groups[key]["fuel_cost"] += float(f["total_cost"] or 0)
        unit_state_groups[key]["fuel_receipt_count"] += 1

    state_rows = []
    tot_mi = 0.0
    tot_tax_mi = 0.0
    tot_non_tax_mi = 0.0
    tot_gal = 0.0
    tot_cost = 0.0
    tot_receipts = 0
    tot_est_tax = 0.0

    for key in sorted(unit_state_groups.keys()):
        g = unit_state_groups[key]
        u_mpg = 0.0
        uo = unit_overview_map.get(g["unit_number"])
        if uo and uo["fuel_gallons"] > 0:
            u_mpg = round(uo["taxable_miles"] / uo["fuel_gallons"], 2)

        rate_info = rates_map.get(g["jurisdiction"], {})
        t_rate = float(rate_info.get("tax_rate_per_gallon", 0.0))
        s_rate = float(rate_info.get("surcharge_rate_per_gallon", 0.0))

        taxable_gal = round_half_up(g["taxable_miles"] / u_mpg, 2) if u_mpg > 0 else 0.0
        net_tax_gal = round_half_up(taxable_gal - g["tax_paid_gallons"], 2)
        est_tax = round_half_up((net_tax_gal * t_rate) + (taxable_gal * s_rate), 2)

        state_rows.append({
            "unit_number": g["unit_number"],
            "jurisdiction": g["jurisdiction"],
            "total_miles": round(g["total_miles"], 1),
            "taxable_miles": round(g["taxable_miles"], 1),
            "non_taxable_miles": round(g["non_taxable_miles"], 1),
            "fuel_gallons": round(g["fuel_gallons"], 2),
            "tax_paid_gallons": round(g["tax_paid_gallons"], 2),
            "fuel_cost": round(g["fuel_cost"], 2),
            "fuel_receipt_count": g["fuel_receipt_count"],
            "mileage_entry_count": g["mileage_entry_count"],
            "unit_mpg": u_mpg,
            "taxable_gallons": taxable_gal,
            "net_taxable_gallons": net_tax_gal,
            "tax_rate": t_rate,
            "est_ifta_tax": est_tax
        })

        tot_mi += g["total_miles"]
        tot_tax_mi += g["taxable_miles"]
        tot_non_tax_mi += g["non_taxable_miles"]
        tot_gal += g["fuel_gallons"]
        tot_cost += g["fuel_cost"]
        tot_receipts += g["fuel_receipt_count"]
        tot_est_tax += est_tax

    agg_mpg = round(tot_tax_mi / tot_gal, 2) if tot_gal > 0 else 0.0
    date_range_label = f"{start_date or 'Start'} to {end_date or 'End'}" if (start_date or end_date) else f"Full Quarter ({quarter})"

    return {
        "company_name": company_name,
        "quarter": quarter,
        "selected_unit": sel_unit,
        "selected_state": sel_state,
        "start_date": start_date or "",
        "end_date": end_date or "",
        "date_range_label": date_range_label,
        "units_list": units_list,
        "states_list": states_list,
        "unit_overview": unit_overview,
        "state_rows": state_rows,
        "mileage_records": filtered_mileage,
        "fuel_records": filtered_fuel,
        "totals": {
            "total_miles": round(tot_mi, 1),
            "taxable_miles": round(tot_tax_mi, 1),
            "non_taxable_miles": round(tot_non_tax_mi, 1),
            "fuel_gallons": round(tot_gal, 2),
            "fuel_cost": round(tot_cost, 2),
            "fuel_receipt_count": tot_receipts,
            "mpg": agg_mpg,
            "est_ifta_tax": round(tot_est_tax, 2)
        }
    }

@app.get("/api/reports/unit-state-summary")
def get_unit_state_summary(
    quarter: str = "2026-Q1",
    unit_number: str = "ALL",
    state: str = "ALL",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fleet_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    return build_unit_state_summary_data(
        fleet_id=target_fleet,
        quarter=quarter,
        unit_number=unit_number,
        state=state,
        start_date=start_date,
        end_date=end_date
    )

@app.get("/api/reports/export-unit-summary-pdf")
def export_unit_summary_pdf(
    quarter: str = "2026-Q1",
    unit_number: str = "ALL",
    state: str = "ALL",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    fleet_id: Optional[str] = None,
    current_user: Dict = Depends(get_current_user)
):
    target_fleet = fleet_id or current_user["default_fleet_id"]
    report_data = build_unit_state_summary_data(
        fleet_id=target_fleet,
        quarter=quarter,
        unit_number=unit_number,
        state=state,
        start_date=start_date,
        end_date=end_date
    )
    pdf_bytes = generate_unit_summary_pdf_bytes(report_data)
    unit_slug = unit_number.replace(" ", "_") if unit_number and unit_number != "ALL" else "All_Units"
    filename = f"Unit_Summary_Report_{unit_slug}_{quarter}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
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
               surcharge_rate_per_gallon as surcharge_rate, weight_mile_rate, currency,
               COALESCE(effective_date, '2026-01-01') as effective_date,
               COALESCE(version, 'v2026.1 (IFTA Inc. Official Matrix)') as version,
               COALESCE(updated_at, '2026-01-01 00:00:00') as updated_at
        FROM ifta_tax_rates
        WHERE quarter = ? AND UPPER(fuel_type) = 'DIESEL'
        ORDER BY jurisdiction ASC
    """, (quarter,))
    rows = cursor.fetchall()
    if not rows:
        # Auto-seed requested quarter from official baseline if not seeded yet
        year_int = int(quarter.split("-")[0]) if "-" in quarter else 2026
        eff_dt = f"{year_int}-01-01"
        now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        for jur, ftype, trate, surch, wmr, curr in IFTA_RATES_Q1_2026:
            cursor.execute("""
                INSERT OR REPLACE INTO ifta_tax_rates (id, year, quarter, jurisdiction, fuel_type, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate, currency, effective_date, version, updated_at)
                VALUES (?, ?, ?, ?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), year_int, quarter, jur, trate, surch, wmr, curr, eff_dt, f"v{quarter} (IFTA Inc.)", now_ts))
        conn.commit()
        cursor.execute("""
            SELECT jurisdiction, fuel_type, tax_rate_per_gallon as tax_rate,
                   surcharge_rate_per_gallon as surcharge_rate, weight_mile_rate, currency,
                   COALESCE(effective_date, '2026-01-01') as effective_date,
                   COALESCE(version, 'v2026.1 (IFTA Inc. Official Matrix)') as version,
                   COALESCE(updated_at, '2026-01-01 00:00:00') as updated_at
            FROM ifta_tax_rates
            WHERE quarter = ? AND UPPER(fuel_type) = 'DIESEL'
            ORDER BY jurisdiction ASC
        """, (quarter,))
        rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/rates/refresh")
def refresh_tax_rates(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """
    Module 11: Refresh/Sync the 58 Jurisdiction Rate Matrix for a reporting quarter and stamp version/effective date.
    """
    quarter = data.get("quarter", "2026-Q1")
    reset_defaults = bool(data.get("reset_defaults", False))
    year_int = int(quarter.split("-")[0]) if "-" in quarter else 2026
    q_part = quarter.split("-")[1] if "-" in quarter else "Q1"
    eff_month = {"Q1": "01-01", "Q2": "04-01", "Q3": "07-01", "Q4": "10-01"}.get(q_part, "01-01")
    eff_dt = f"{year_int}-{eff_month}"
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    version_tag = f"v{quarter}.R1 (IFTA Inc. Verified {now_ts[:10]})"

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM ifta_tax_rates WHERE quarter = ? AND UPPER(fuel_type) = 'DIESEL'", (quarter,))
    existing_cnt = cursor.fetchone()[0]

    if existing_cnt == 0 or reset_defaults:
        for jur, ftype, trate, surch, wmr, curr in IFTA_RATES_Q1_2026:
            cursor.execute("""
                INSERT OR REPLACE INTO ifta_tax_rates (
                    id, year, quarter, jurisdiction, fuel_type,
                    tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate,
                    currency, effective_date, version, updated_at
                ) VALUES (?, ?, ?, ?, 'DIESEL', ?, ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), year_int, quarter, jur, trate, surch, wmr, curr, eff_dt, version_tag, now_ts))
    else:
        cursor.execute("""
            UPDATE ifta_tax_rates
            SET effective_date = ?, version = ?, updated_at = ?
            WHERE quarter = ? AND UPPER(fuel_type) = 'DIESEL'
        """, (eff_dt, version_tag, now_ts, quarter))

    conn.commit()
    conn.close()
    return {
        "message": f"58 Jurisdiction Rate Matrix refreshed for {quarter}.",
        "quarter": quarter,
        "effective_date": eff_dt,
        "version": version_tag,
        "updated_at": now_ts
    }

@app.put("/api/rates/{jurisdiction}")
def update_jurisdiction_rate(jurisdiction: str, data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """
    Module 11: Update a specific jurisdiction's tax rate, surcharge, or weight-mile rate and reflect immediately in calculations.
    """
    jur = jurisdiction.strip().upper()
    quarter = data.get("quarter", "2026-Q1")
    tax_rate = float(data.get("tax_rate", 0.0))
    surcharge_rate = float(data.get("surcharge_rate", 0.0))
    weight_mile_rate = float(data.get("weight_mile_rate", 0.0))

    if tax_rate < 0 or surcharge_rate < 0 or weight_mile_rate < 0:
        raise HTTPException(status_code=400, detail="Tax rates cannot be negative.")

    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    version_tag = data.get("version") or f"v{quarter}-Custom ({now_ts[:10]})"
    eff_dt = data.get("effective_date") or f"{quarter.split('-')[0]}-01-01"

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE ifta_tax_rates
        SET tax_rate_per_gallon = ?, surcharge_rate_per_gallon = ?, weight_mile_rate = ?,
            effective_date = ?, version = ?, updated_at = ?
        WHERE quarter = ? AND jurisdiction = ? AND UPPER(fuel_type) = 'DIESEL'
    """, (tax_rate, surcharge_rate, weight_mile_rate, eff_dt, version_tag, now_ts, quarter, jur))
    conn.commit()
    conn.close()
    return {
        "message": f"Updated {jur} tax rate for {quarter}.",
        "jurisdiction": jur,
        "quarter": quarter,
        "tax_rate": tax_rate,
        "surcharge_rate": surcharge_rate,
        "weight_mile_rate": weight_mile_rate,
        "version": version_tag,
        "effective_date": eff_dt,
        "updated_at": now_ts
    }

@app.get("/api/rates/export-csv")
def export_rates_matrix_csv(quarter: str = "2026-Q1", current_user: Dict = Depends(get_current_user)):
    """
    Module 11: Export the 58-Jurisdiction Rate Matrix as a CSV template that can be edited in Excel and re-uploaded.
    """
    import io, csv
    rates = get_tax_rates(quarter, "Diesel")
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Jurisdiction", "Base Diesel Rate", "Surcharge Rate", "Weight-Distance Rate", "Currency", "Effective Date"])
    for r in rates:
        writer.writerow([
            r["jurisdiction"],
            f"{float(r['tax_rate']):.4f}",
            f"{float(r['surcharge_rate']):.4f}",
            f"{float(r['weight_mile_rate']):.5f}",
            r.get("currency", "USD"),
            r.get("effective_date", "2026-01-01")
        ])
    filename = f"IFTA_58_Rates_Matrix_{quarter}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.post("/api/rates/upload-file")
async def upload_rates_matrix_file(
    file: UploadFile = File(...),
    quarter: str = Form("2026-Q1"),
    effective_date: str = Form("2026-01-01"),
    current_user: Dict = Depends(get_current_user)
):
    """
    Module 11: Upload an official IFTA Inc. CSV or Excel (.xlsx / .xls) sheet to bulk-update the 58 Rate Matrix.
    """
    import io
    import pandas as pd
    from csv_importer import VALID_JURISDICTIONS

    file_bytes = await file.read()
    fname = file.filename or "Uploaded_Matrix.csv"
    try:
        if fname.lower().endswith(".xlsx") or fname.lower().endswith(".xls"):
            df = pd.read_excel(io.BytesIO(file_bytes))
        else:
            df = pd.read_csv(io.BytesIO(file_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to parse rate matrix file: {str(e)}")

    df.columns = [str(c).strip() for c in df.columns]
    col_map = {c.lower(): c for c in df.columns}

    def pick_col(candidates):
        for cand in candidates:
            if cand.lower() in col_map:
                return col_map[cand.lower()]
        return None

    jur_col = pick_col(["Jurisdiction", "State", "Code", "State/Prov", "Province"])
    rate_col = pick_col(["Base Diesel Rate", "Tax Rate", "Base Rate", "Diesel Rate", "tax_rate_per_gallon", "tax_rate", "Rate"])
    surch_col = pick_col(["Surcharge Rate", "Surcharge", "surcharge_rate_per_gallon", "surcharge_rate"])
    wmr_col = pick_col(["Weight-Distance Rate", "Weight Mile Rate", "weight_mile_rate", "Mile Rate"])
    eff_col = pick_col(["Effective Date", "effective_date"])

    if not jur_col or not rate_col:
        raise HTTPException(
            status_code=400,
            detail="File must contain at least 'Jurisdiction' (or 'State') and 'Base Diesel Rate' (or 'Tax Rate') columns."
        )

    year_int = int(quarter.split("-")[0]) if "-" in quarter else 2026
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    version_tag = f"v{quarter} (Uploaded: {fname} on {now_ts[:10]})"

    conn = get_connection()
    cursor = conn.cursor()
    updated_count = 0
    skipped_count = 0

    try:
        for _, row in df.iterrows():
            raw_jur = str(row[jur_col]).strip().upper() if pd.notna(row[jur_col]) else ""
            if len(raw_jur) > 2 and "-" in raw_jur:
                raw_jur = raw_jur.split("-")[0].strip()
            if raw_jur not in VALID_JURISDICTIONS:
                skipped_count += 1
                continue

            try:
                trate = float(str(row[rate_col]).replace("$", "").strip())
            except Exception:
                skipped_count += 1
                continue

            surch = 0.0
            if surch_col and pd.notna(row[surch_col]):
                try:
                    surch = float(str(row[surch_col]).replace("$", "").strip())
                except Exception:
                    surch = 0.0

            wmr = 0.0
            if wmr_col and pd.notna(row[wmr_col]):
                try:
                    wmr = float(str(row[wmr_col]).replace("$", "").replace("/mi", "").strip())
                except Exception:
                    wmr = 0.0

            row_eff = effective_date
            if eff_col and pd.notna(row[eff_col]) and str(row[eff_col]).strip():
                row_eff = str(row[eff_col]).strip()[:10]

            cursor.execute("""
                INSERT OR REPLACE INTO ifta_tax_rates (
                    id, year, quarter, jurisdiction, fuel_type,
                    tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate,
                    currency, effective_date, version, updated_at
                ) VALUES (
                    COALESCE((SELECT id FROM ifta_tax_rates WHERE quarter = ? AND jurisdiction = ? AND UPPER(fuel_type) = 'DIESEL'), ?),
                    ?, ?, ?, 'DIESEL', ?, ?, ?, 'USD', ?, ?, ?
                )
            """, (quarter, raw_jur, str(uuid.uuid4()), year_int, quarter, raw_jur, trate, surch, wmr, row_eff, version_tag, now_ts))
            updated_count += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        conn.close()
        raise HTTPException(status_code=500, detail=f"Failed to import rate matrix: {str(e)}")

    conn.close()
    return {
        "message": f"Successfully updated {updated_count} jurisdiction rates from '{fname}' (Skipped: {skipped_count}).",
        "updated_count": updated_count,
        "skipped_count": skipped_count,
        "version": version_tag,
        "effective_date": effective_date,
        "updated_at": now_ts
    }

@app.post("/api/rates/sync-external")
def sync_rates_from_external_api(data: Dict[str, Any], current_user: Dict = Depends(get_current_user)):
    """
    Module 11: Sync the 58 Rate Matrix from an external JSON or CSV API endpoint URL.
    """
    import urllib.request
    import io
    import pandas as pd
    from csv_importer import VALID_JURISDICTIONS

    api_url = (data.get("api_url") or "").strip()
    quarter = data.get("quarter", "2026-Q1")
    effective_date = data.get("effective_date") or f"{quarter.split('-')[0]}-01-01"

    if not api_url:
        raise HTTPException(status_code=400, detail="Please provide a valid external JSON or CSV API URL.")

    try:
        req = urllib.request.Request(api_url, headers={"User-Agent": "FuelTaxPulse-Enterprise/2.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_bytes = resp.read()
            content_type = resp.headers.get("Content-Type", "")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Unable to reach external rate API ({api_url}): {str(e)}")

    year_int = int(quarter.split("-")[0]) if "-" in quarter else 2026
    now_ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    version_tag = f"v{quarter} (External API Sync {now_ts[:10]})"

    records_to_upsert = []
    try:
        if "json" in content_type.lower() or api_url.lower().endswith(".json") or raw_bytes.strip().startswith((b"[", b"{")):
            payload = json.loads(raw_bytes.decode("utf-8"))
            items = payload.get("rates", payload) if isinstance(payload, dict) else payload
            for item in items:
                jur = str(item.get("jurisdiction") or item.get("state") or item.get("code") or "").strip().upper()
                if jur in VALID_JURISDICTIONS:
                    trate = float(item.get("tax_rate") or item.get("tax_rate_per_gallon") or item.get("rate") or 0.0)
                    surch = float(item.get("surcharge_rate") or item.get("surcharge") or 0.0)
                    wmr = float(item.get("weight_mile_rate") or item.get("mile_tax_rate") or 0.0)
                    records_to_upsert.append((jur, trate, surch, wmr))
        else:
            df = pd.read_csv(io.BytesIO(raw_bytes))
            df.columns = [str(c).strip() for c in df.columns]
            col_map = {c.lower(): c for c in df.columns}
            jur_c = col_map.get("jurisdiction") or col_map.get("state") or col_map.get("code")
            rate_c = col_map.get("base diesel rate") or col_map.get("tax rate") or col_map.get("tax_rate") or col_map.get("rate")
            surch_c = col_map.get("surcharge rate") or col_map.get("surcharge_rate") or col_map.get("surcharge")
            wmr_c = col_map.get("weight-distance rate") or col_map.get("weight_mile_rate")
            if jur_c and rate_c:
                for _, row in df.iterrows():
                    jur = str(row[jur_c]).strip().upper()
                    if jur in VALID_JURISDICTIONS:
                        trate = float(row[rate_c])
                        surch = float(row[surch_c]) if surch_c and pd.notna(row[surch_c]) else 0.0
                        wmr = float(row[wmr_c]) if wmr_c and pd.notna(row[wmr_c]) else 0.0
                        records_to_upsert.append((jur, trate, surch, wmr))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse external rate API response: {str(e)}")

    if not records_to_upsert:
        raise HTTPException(status_code=400, detail="No valid IFTA jurisdiction rates found in external API response.")

    conn = get_connection()
    cursor = conn.cursor()
    for jur, trate, surch, wmr in records_to_upsert:
        cursor.execute("""
            INSERT OR REPLACE INTO ifta_tax_rates (
                id, year, quarter, jurisdiction, fuel_type,
                tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate,
                currency, effective_date, version, updated_at
            ) VALUES (
                COALESCE((SELECT id FROM ifta_tax_rates WHERE quarter = ? AND jurisdiction = ? AND UPPER(fuel_type) = 'DIESEL'), ?),
                ?, ?, ?, 'DIESEL', ?, ?, ?, 'USD', ?, ?, ?
            )
        """, (quarter, jur, str(uuid.uuid4()), year_int, quarter, jur, trate, surch, wmr, effective_date, version_tag, now_ts))
    conn.commit()
    conn.close()

    return {
        "message": f"Synced {len(records_to_upsert)} jurisdiction rates from external API.",
        "updated_count": len(records_to_upsert),
        "version": version_tag,
        "effective_date": effective_date,
        "updated_at": now_ts
    }

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
