"""
FuelTaxPulse Database Module (Updated for Full Functional Specifications)
Supports:
- Multi-Fleet data scoping by fleet_id & reporting_quarter
- Master Tables: Fleets, Vehicles, 58 Jurisdiction Tax Rate Matrix (US + Canadian Provinces)
- CSV Import Batches (SHA-256 duplicate detection & 4-year audit retention)
- Column Mapping Templates (e.g. Motive, WEX, Samsara, Comdata)
- Mileage Records (taxable + non-taxable = total, odometer)
- Fuel Transactions (liters-to-gallons conversion, tax-paid pump flag)
- Quarter Freeze & Lock Snapshots
- Audit Logs
"""

import sqlite3
import os
import uuid
import hashlib
from typing import Dict, List, Optional
import bcrypt

DB_PATH = os.environ.get(
    "DATABASE_PATH",
    "/tmp/fueltaxpulse.db" if (os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))
    else os.path.join(os.path.dirname(__file__), "fueltaxpulse.db")
)

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# -----------------------------------------------------------------------------
# OFFICIAL IFTA 2026-Q1 RATES MATRIX (All 48 Lower US States + DC + 10 Canadian Provinces)
# -----------------------------------------------------------------------------
IFTA_RATES_Q1_2026 = [
    # US Lower 48 States + DC
    ("AL", "Diesel", 0.3200, 0.0000, 0.0000, "USD"),
    ("AZ", "Diesel", 0.2600, 0.0000, 0.0000, "USD"),
    ("AR", "Diesel", 0.2850, 0.0000, 0.0000, "USD"),
    ("CA", "Diesel", 0.9710, 0.0000, 0.0000, "USD"),
    ("CO", "Diesel", 0.2050, 0.0000, 0.0000, "USD"),
    ("CT", "Diesel", 0.4920, 0.0000, 0.0000, "USD"),
    ("DE", "Diesel", 0.2200, 0.0000, 0.0000, "USD"),
    ("DC", "Diesel", 0.2350, 0.0000, 0.0000, "USD"),
    ("FL", "Diesel", 0.3780, 0.0000, 0.0000, "USD"),
    ("GA", "Diesel", 0.3580, 0.0000, 0.0000, "USD"),
    ("ID", "Diesel", 0.3200, 0.0000, 0.0000, "USD"),
    ("IL", "Diesel", 0.7380, 0.0000, 0.0000, "USD"),
    ("IN", "Diesel", 0.6100, 0.0000, 0.0000, "USD"),
    ("IA", "Diesel", 0.3250, 0.0000, 0.0000, "USD"),
    ("KS", "Diesel", 0.2600, 0.0000, 0.0000, "USD"),
    ("KY", "Diesel", 0.2200, 0.1050, 0.0285, "USD"), # 0.1050 Surcharge, 0.0285 KYU
    ("LA", "Diesel", 0.2000, 0.0000, 0.0000, "USD"),
    ("ME", "Diesel", 0.3120, 0.0000, 0.0000, "USD"),
    ("MD", "Diesel", 0.4775, 0.0000, 0.0000, "USD"),
    ("MA", "Diesel", 0.2400, 0.0000, 0.0000, "USD"),
    ("MI", "Diesel", 0.5040, 0.0000, 0.0000, "USD"),
    ("MN", "Diesel", 0.2850, 0.0000, 0.0000, "USD"),
    ("MS", "Diesel", 0.1800, 0.0000, 0.0000, "USD"),
    ("MO", "Diesel", 0.2950, 0.0000, 0.0000, "USD"),
    ("MT", "Diesel", 0.2975, 0.0000, 0.0000, "USD"),
    ("NE", "Diesel", 0.2940, 0.0000, 0.0000, "USD"),
    ("NV", "Diesel", 0.2700, 0.0000, 0.0000, "USD"),
    ("NH", "Diesel", 0.2220, 0.0000, 0.0000, "USD"),
    ("NJ", "Diesel", 0.5050, 0.0000, 0.0000, "USD"),
    ("NM", "Diesel", 0.2100, 0.0000, 0.04378, "USD"), # 0.04378 WDT
    ("NY", "Diesel", 0.3955, 0.0000, 0.0150, "USD"),
    ("NC", "Diesel", 0.4040, 0.0000, 0.0000, "USD"),
    ("ND", "Diesel", 0.2300, 0.0000, 0.0000, "USD"),
    ("OH", "Diesel", 0.4700, 0.0000, 0.0000, "USD"),
    ("OK", "Diesel", 0.1900, 0.0000, 0.0000, "USD"),
    ("OR", "Diesel", 0.0000, 0.0000, 0.0650, "USD"), # Oregon diesel is exempt at pump, paid via weight-mile
    ("PA", "Diesel", 0.7850, 0.0000, 0.0000, "USD"),
    ("RI", "Diesel", 0.3700, 0.0000, 0.0000, "USD"),
    ("SC", "Diesel", 0.2800, 0.0000, 0.0000, "USD"),
    ("SD", "Diesel", 0.2800, 0.0000, 0.0000, "USD"),
    ("TN", "Diesel", 0.2700, 0.0000, 0.0000, "USD"),
    ("TX", "Diesel", 0.2000, 0.0000, 0.0000, "USD"),
    ("UT", "Diesel", 0.3640, 0.0000, 0.0000, "USD"),
    ("VT", "Diesel", 0.3200, 0.0000, 0.0000, "USD"),
    ("VA", "Diesel", 0.3080, 0.0000, 0.0000, "USD"),
    ("WA", "Diesel", 0.4940, 0.0000, 0.0000, "USD"),
    ("WV", "Diesel", 0.3570, 0.0000, 0.0000, "USD"),
    ("WI", "Diesel", 0.3290, 0.0000, 0.0000, "USD"),
    ("WY", "Diesel", 0.2400, 0.0000, 0.0000, "USD"),
    # Canadian Provinces (10 member provinces)
    ("AB", "Diesel", 0.3900, 0.0000, 0.0000, "USD"),
    ("BC", "Diesel", 0.6200, 0.0000, 0.0000, "USD"),
    ("MB", "Diesel", 0.4100, 0.0000, 0.0000, "USD"),
    ("NB", "Diesel", 0.5600, 0.0000, 0.0000, "USD"),
    ("NL", "Diesel", 0.5400, 0.0000, 0.0000, "USD"),
    ("NS", "Diesel", 0.5800, 0.0000, 0.0000, "USD"),
    ("ON", "Diesel", 0.5200, 0.0000, 0.0000, "USD"),
    ("PE", "Diesel", 0.5500, 0.0000, 0.0000, "USD"),
    ("QC", "Diesel", 0.5800, 0.0000, 0.0000, "USD"),
    ("SK", "Diesel", 0.4300, 0.0000, 0.0000, "USD"),
]

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Organizations
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS organizations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL DEFAULT 'carrier',
        subscription_status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Users (Super Admin, Fleet Tax Manager, Auditor)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'fleet_manager', -- 'super_admin', 'fleet_manager', 'auditor'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 3. Fleets (Multi-fleet scoped legal entities)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fleets (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        legal_name TEXT NOT NULL,
        ifta_account_number TEXT NOT NULL,
        base_jurisdiction TEXT NOT NULL DEFAULT 'AR',
        fein TEXT,
        dot_number TEXT,
        status TEXT NOT NULL DEFAULT 'Active', -- 'Active', 'Inactive'
        kyu_number TEXT,
        nm_wdt_number TEXT,
        ny_hut_number TEXT,
        or_wmt_number TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Vehicles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS vehicles (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        unit_number TEXT NOT NULL,
        vin TEXT NOT NULL,
        make TEXT,
        model TEXT,
        model_year INTEGER,
        fuel_type TEXT NOT NULL DEFAULT 'DIESEL', -- DIESEL, GASOLINE, LNG, CNG, PROPANE
        gross_vehicle_weight INTEGER NOT NULL DEFAULT 80000,
        number_of_axles INTEGER DEFAULT 5,
        active_status TEXT NOT NULL DEFAULT 'Active', -- Active, Inactive
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(fleet_id, unit_number)
    );
    """)

    # 5. Quarterly IFTA Tax Rate Matrix (58 Jurisdictions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ifta_tax_rates (
        id TEXT PRIMARY KEY,
        year INTEGER NOT NULL,
        quarter TEXT NOT NULL,               -- e.g. '2026-Q1'
        jurisdiction TEXT NOT NULL,          -- 2-letter state/province
        fuel_type TEXT NOT NULL,             -- 'DIESEL', 'GASOLINE', etc.
        tax_rate_per_gallon REAL NOT NULL,
        surcharge_rate_per_gallon REAL NOT NULL DEFAULT 0.0,
        weight_mile_rate REAL NOT NULL DEFAULT 0.0,
        currency TEXT NOT NULL DEFAULT 'USD',
        split_rate_effective_date TEXT,
        UNIQUE(year, quarter, jurisdiction, fuel_type)
    );
    """)

    # 6. CSV Import Batches (SHA-256 duplicate checking & 4-year audit preservation)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS import_batches (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        reporting_quarter TEXT NOT NULL,
        import_type TEXT NOT NULL,          -- 'mileage' or 'fuel'
        filename TEXT NOT NULL,
        file_sha256 TEXT NOT NULL,
        raw_content TEXT,
        row_count INTEGER NOT NULL DEFAULT 0,
        error_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'staged', -- 'staged', 'committed', 'rejected'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 7. Saved Column Mapping Templates (e.g. Motive, WEX, Samsara)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS csv_mapping_templates (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        template_name TEXT NOT NULL,        -- 'Motive IFTA Export', 'WEX Fuel Card CSV'
        import_type TEXT NOT NULL,          -- 'mileage' or 'fuel'
        mappings_json TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8. Mileage Records (Spreadsheet Grid & CSV Ingestion)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mileage_records (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
        unit_number TEXT NOT NULL,
        reporting_quarter TEXT NOT NULL,    -- '2026-Q1'
        jurisdiction TEXT NOT NULL,         -- 2-letter code
        total_miles REAL NOT NULL DEFAULT 0.0,
        taxable_miles REAL NOT NULL DEFAULT 0.0,
        non_taxable_miles REAL NOT NULL DEFAULT 0.0,
        trip_date TEXT,
        start_odometer INTEGER,
        end_odometer INTEGER,
        import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 8b. Trips & Route Adjacency Segments
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trips (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        vehicle_id TEXT REFERENCES vehicles(id) ON DELETE CASCADE,
        trip_number TEXT NOT NULL,
        trip_date TEXT NOT NULL,
        quarter TEXT NOT NULL DEFAULT '2026-Q1',
        total_trip_miles REAL NOT NULL DEFAULT 0.0,
        has_adjacency_warning INTEGER DEFAULT 0,
        notes TEXT,
        entry_method TEXT DEFAULT 'distance',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS trip_segments (
        id TEXT PRIMARY KEY,
        trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
        sequence_order INTEGER NOT NULL DEFAULT 1,
        jurisdiction TEXT NOT NULL,
        all_miles REAL NOT NULL DEFAULT 0.0,
        taxable_miles REAL NOT NULL DEFAULT 0.0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 9. Fuel Transactions (Receipts & CSV Ingestion)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS fuel_transactions (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        vehicle_id TEXT REFERENCES vehicles(id) ON DELETE SET NULL,
        unit_number TEXT NOT NULL,
        reporting_quarter TEXT NOT NULL,    -- '2026-Q1'
        transaction_date TEXT NOT NULL,
        jurisdiction TEXT NOT NULL,
        gallons REAL NOT NULL,
        fuel_type TEXT NOT NULL DEFAULT 'DIESEL',
        tax_paid_at_pump INTEGER NOT NULL DEFAULT 1,
        vendor_name TEXT,
        vendor_city TEXT,
        invoice_or_receipt_number TEXT,
        total_cost REAL,
        import_batch_id TEXT REFERENCES import_batches(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 10. Quarter Finalize & Lock Status (Immutable Snapshot)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS quarter_locks (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL REFERENCES fleets(id) ON DELETE CASCADE,
        quarter TEXT NOT NULL,
        fuel_type TEXT NOT NULL,
        is_locked INTEGER NOT NULL DEFAULT 0,
        locked_at TIMESTAMP,
        locked_by TEXT,
        snapshot_json TEXT,
        UNIQUE(fleet_id, quarter, fuel_type)
    );
    """)

    # 11. Audit Logs (Timestamped user actions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        fleet_id TEXT NOT NULL,
        quarter TEXT NOT NULL,
        user_id TEXT,
        user_name TEXT,
        action TEXT NOT NULL,
        details TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 12. Customers Master Data (Exact replica of ProMiles / TruckDues Customer Information Modal)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        fleet_id TEXT REFERENCES fleets(id) ON DELETE CASCADE,
        
        -- TAB 1: INFO
        company_name TEXT NOT NULL,
        dba TEXT,
        address TEXT,
        address2 TEXT,
        city TEXT,
        state TEXT,
        postal_code TEXT,
        county TEXT,
        contact_person TEXT,
        contact_phone TEXT,
        cell_phone TEXT,
        contact_email TEXT,
        fax TEXT,
        website TEXT,
        business_hours TEXT,
        mailing_address TEXT,
        mailing_city TEXT,
        mailing_state TEXT,
        mailing_postal_code TEXT,
        president_name TEXT,
        president_ssn TEXT,
        account_number TEXT,
        -- Other Information
        date_incorporated TEXT,
        state_of_incorporation TEXT,
        corporation_number TEXT,
        officer_title TEXT,
        officer_name TEXT,
        officer_ssn TEXT,

        -- TAB 2: ACCOUNTS
        bank_name TEXT,
        bank_account_number TEXT,
        billing_email TEXT,
        fuel_card_provider TEXT,
        fuel_card_account_num TEXT,

        -- TAB 3: OPTIONS
        ifta_state TEXT,
        ifta_number TEXT,
        fein_ssn TEXT,
        dot_number TEXT,
        mc_number TEXT,
        hvut_number TEXT,
        ky_permit_number TEXT,
        nm_permit_number TEXT,
        ny_permit_number TEXT,
        or_permit_number TEXT,
        carriage_type TEXT DEFAULT 'Private',
        ny_report_method TEXT DEFAULT 'Gross Weight',
        report_massachusetts_toll INTEGER DEFAULT 1,
        b400_business_number TEXT,
        insurance_company TEXT,
        insurance_policy_number TEXT,
        insurance_expiration_date TEXT,
        illcc_number TEXT,
        irp_firm_number TEXT,
        irp_fleet_number TEXT,
        cdl_number TEXT,

        -- TAB 4: NOTES
        notes TEXT,

        -- TAB 5: EMPLOYEE ACCESS
        assigned_employees TEXT,

        -- TAB 6: CUSTOMER ACCESS
        customer_portal_enabled INTEGER DEFAULT 1,
        portal_username TEXT,
        portal_password_hash TEXT,
        portal_status TEXT DEFAULT 'Active',

        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    conn.commit()

    # -------------------------------------------------------------------------
    # SEEDING INITIAL MASTER DATA
    # -------------------------------------------------------------------------
    # 1. Seed Tax Rates (58 Jurisdictions)
    cursor.execute("SELECT COUNT(*) FROM ifta_tax_rates WHERE quarter = '2026-Q1'")
    if cursor.fetchone()[0] == 0:
        for jur, ftype, trate, surch, wmr, curr in IFTA_RATES_Q1_2026:
            cursor.execute("""
            INSERT OR REPLACE INTO ifta_tax_rates (id, year, quarter, jurisdiction, fuel_type, tax_rate_per_gallon, surcharge_rate_per_gallon, weight_mile_rate, currency)
            VALUES (?, 2026, '2026-Q1', ?, ?, ?, ?, ?, ?)
            """, (str(uuid.uuid4()), jur, ftype.upper(), trate, surch, wmr, curr))
        conn.commit()

    # 2. Seed Default Organization & Multiple Fleets
    cursor.execute("SELECT COUNT(*) FROM organizations WHERE name = 'TransNational Logistics Group'")
    if cursor.fetchone()[0] == 0:
        org_id = "org-main-transnational"
        cursor.execute("""
        INSERT INTO organizations (id, name, account_type, subscription_status)
        VALUES (?, 'TransNational Logistics Group', 'carrier', 'active')
        """, (org_id,))

        # Fleet 1: 2AAB TRUCKING LLC (Benchmark Parity)
        fleet1_id = "fleet-2aab-trucking-id"
        cursor.execute("""
        INSERT INTO fleets (id, org_id, name, legal_name, ifta_account_number, base_jurisdiction, fein, dot_number, status, kyu_number, nm_wdt_number)
        VALUES (?, ?, '2AAB TRUCKING LLC', '2AAB TRUCKING LLC', 'AR-8839210-26', 'AR', '84-9281729', '3948210', 'Active', 'KYU-49102', 'NM-83921')
        """, (fleet1_id, org_id))

        # Fleet 2: MIDWEST FREIGHT LINES (Demonstrating Multi-Fleet Scoping)
        fleet2_id = "fleet-midwest-lines-id"
        cursor.execute("""
        INSERT INTO fleets (id, org_id, name, legal_name, ifta_account_number, base_jurisdiction, fein, dot_number, status)
        VALUES (?, ?, 'MIDWEST FREIGHT LINES LLC', 'Midwest Freight Lines Incorporated', 'IL-7749102-26', 'IL', '36-4820194', '2819401', 'Active')
        """, (fleet2_id, org_id))

        # Seed Users:
        # Super Admin, Fleet Tax Manager, Auditor
        cursor.execute("""
        INSERT INTO users (id, org_id, email, password_hash, full_name, role)
        VALUES 
        (?, ?, 'admin@fueltaxpulse.com', ?, 'System Super Administrator', 'super_admin'),
        (?, ?, 'manager@fueltaxpulse.com', ?, 'Senior Fleet Tax Manager', 'fleet_manager'),
        (?, ?, 'auditor@fueltaxpulse.com', ?, 'State DOT Auditor', 'auditor')
        """, (
            str(uuid.uuid4()), org_id, hash_password("admin123"),
            str(uuid.uuid4()), org_id, hash_password("manager123"),
            str(uuid.uuid4()), org_id, hash_password("auditor123")
        ))

        # Seed Vehicles for Fleet 1 (7 Power Units)
        units = [
            ("Unit 101", "1FTNE34W0EDA10101", "Freightliner", "Cascadia", 2024),
            ("Unit 102", "1FTNE34W0EDA10102", "Freightliner", "Cascadia", 2023),
            ("Unit 103", "1FTNE34W0EDA10103", "Kenworth", "T680", 2024),
            ("Unit 104", "1FTNE34W0EDA10104", "Peterbilt", "579", 2023),
            ("Unit 105", "1FTNE34W0EDA10105", "Volvo", "VNL 860", 2024),
            ("Unit 106", "1FTNE34W0EDA10106", "International", "LT625", 2023),
            ("Unit 107", "1FTNE34W0EDA10107", "Mack", "Anthem", 2024),
        ]
        created_vehicle_ids = []
        for u_num, vin, make, model, year in units:
            veh_id = f"veh-{u_num.replace(' ', '').lower()}"
            created_vehicle_ids.append(veh_id)
            cursor.execute("""
            INSERT INTO vehicles (id, fleet_id, unit_number, vin, make, model, model_year, fuel_type, gross_vehicle_weight, number_of_axles, active_status, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'DIESEL', 80000, 5, 'Active', 1)
            """, (veh_id, fleet1_id, u_num, vin, make, model, year))

        # Seed Mileage Records for Fleet 1 (matching 2AAB Trucking 276,951 miles)
        raw_state_data = [
            ("AR", 70452, 10672),
            ("AZ", 772, 314),
            ("CA", 555, 0),
            ("IL", 45777, 5314),
            ("IN", 31143, 4139),
            ("KY", 4266, 634),
            ("MO", 18358, 3654),
            ("NM", 735, 316),
            ("OH", 21401, 4123),
            ("OK", 650, 0),
            ("TN", 4464, 687),
            ("TX", 78378, 12363),
        ]

        for idx, (st, miles, gal) in enumerate(raw_state_data):
            assigned_unit = f"Unit 10{(idx % 7) + 1}"
            assigned_veh_id = created_vehicle_ids[idx % len(created_vehicle_ids)]

            cursor.execute("""
            INSERT INTO mileage_records (id, fleet_id, vehicle_id, unit_number, reporting_quarter, jurisdiction, total_miles, taxable_miles, non_taxable_miles, trip_date)
            VALUES (?, ?, ?, ?, '2026-Q1', ?, ?, ?, 0.0, '2026-02-15')
            """, (str(uuid.uuid4()), fleet1_id, assigned_veh_id, assigned_unit, st, miles, miles))

            if gal > 0:
                cursor.execute("""
                INSERT INTO fuel_transactions (id, fleet_id, vehicle_id, unit_number, reporting_quarter, transaction_date, jurisdiction, gallons, fuel_type, tax_paid_at_pump, vendor_name, vendor_city, invoice_or_receipt_number, total_cost)
                VALUES (?, ?, ?, ?, '2026-Q1', '2026-02-15', ?, ?, 'DIESEL', 1, 'Pilot Flying J / Love''s', 'West Memphis', ?, ?)
                """, (str(uuid.uuid4()), fleet1_id, assigned_veh_id, assigned_unit, st, gal, f"REC-{st}-2026", round(gal * 3.85, 2)))

        # Seed Pre-Configured Column Mapping Templates
        motive_mapping = '{"unit_number":"Vehicle ID","jurisdiction":"Jurisdiction","total_miles":"Total Distance","taxable_miles":"Taxable Distance","trip_date":"Date"}'
        wex_fuel_mapping = '{"unit_number":"Unit Number","jurisdiction":"State","gallons":"Quantity","transaction_date":"Transaction Date","fuel_type":"Product","total_cost":"Net Amount"}'
        samsara_mapping = '{"unit_number":"Vehicle Name","jurisdiction":"State/Province","total_miles":"Total GPS Miles","taxable_miles":"Taxable Miles"}'

        cursor.execute("""
        INSERT INTO csv_mapping_templates (id, org_id, template_name, import_type, mappings_json)
        VALUES 
        (?, ?, 'Motive IFTA Mileage Export', 'mileage', ?),
        (?, ?, 'WEX Commercial Fuel Card CSV', 'fuel', ?),
        (?, ?, 'Samsara Telematics State Miles', 'mileage', ?)
        """, (
            str(uuid.uuid4()), org_id, motive_mapping,
            str(uuid.uuid4()), org_id, wex_fuel_mapping,
            str(uuid.uuid4()), org_id, samsara_mapping
        ))

        # Seed Customer Master Profile for 2AAB TRUCKING LLC
        cust_id = "cust-2aab-trucking"
        cursor.execute("""
        INSERT OR REPLACE INTO customers (
            id, org_id, fleet_id, company_name, dba, address, address2, city, state, postal_code, county,
            contact_person, contact_phone, cell_phone, contact_email, fax, website, business_hours,
            mailing_address, mailing_city, mailing_state, mailing_postal_code, president_name, president_ssn, account_number,
            date_incorporated, state_of_incorporation, corporation_number, officer_title, officer_name, officer_ssn,
            bank_name, bank_account_number, billing_email, fuel_card_provider, fuel_card_account_num,
            ifta_state, ifta_number, fein_ssn, dot_number, mc_number, hvut_number,
            ky_permit_number, nm_permit_number, ny_permit_number, or_permit_number,
            carriage_type, ny_report_method, report_massachusetts_toll, b400_business_number,
            insurance_company, insurance_policy_number, insurance_expiration_date,
            illcc_number, irp_firm_number, irp_fleet_number, cdl_number, notes, assigned_employees
        ) VALUES (
            ?, ?, ?, '2AAB TRUCKING LLC', '2AAB Express Freight', '104 Commerce Way', 'Suite 200', 'Little Rock', 'AR', '72201', 'Pulaski',
            'Ahmed Al-Bayati', '(501) 555-0192', '(501) 555-8831', 'compliance@2aabtrucking.com', '(501) 555-0199', 'https://2aabtrucking.com', 'Mon-Fri 8:00 AM - 5:00 PM CST',
            'P.O. Box 49102', 'Little Rock', 'AR', '72203', 'Ahmed Al-Bayati', 'XXX-XX-4819', 'ACT-2AAB-001',
            '2018-05-12', 'AR', 'CORP-883921', 'Managing Partner', 'Fatima Al-Bayati', 'XXX-XX-9102',
            'First National Bank of Arkansas', '••••••••4810', 'billing@2aabtrucking.com', 'WEX / EFS Fleet Card', 'WEX-88391',
            'AR', 'AR-8839210-26', '84-9281729', '3948210', 'MC-1049281', 'HVUT-2026-99',
            'KYU-49102', 'NM-83921', 'NY-HUT-44810', 'OR-WMT-921',
            'Private', 'Gross Weight', 1, 'B400-CAN-8819',
            'Great West Casualty Company', 'POL-GW-8839210', '2026-12-31',
            'ILLCC-88391', 'IRP-AR-991', 'FLEET-01', 'CDL-AR-993821',
            'Active Class 8 fleet hauling interstate dry van and refrigerated freight across Lower 48 states.',
            '["Compliance Administrator", "Senior Fleet Tax Manager"]'
        )
        """, (cust_id, org_id, fleet1_id))

        conn.commit()

    conn.close()

if __name__ == "__main__":
    init_db()
    print("FuelTaxPulse Advanced Specifications Database initialized successfully!")
