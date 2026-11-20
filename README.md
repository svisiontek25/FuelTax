# FuelTaxPulse Enterprise — Complete Architecture, Modules 1–11 Implementation & Deliverables Guide

**Platform Brand:** **FuelTaxPulse Enterprise**  
**Technology Stack:** Python 3 (FastAPI, SQLite3, pandas, ReportLab, bcrypt, PyJWT) + React 18 (Vite, Lucide Icons)  
**Compliance Scope:** 58 IFTA Member Jurisdictions (48 Lower US States + DC + 10 Canadian Provinces) — **Diesel Only**  
**Standard Reports:** IFTA Schedule 1 Return (PDF & CSV), State DMV E-File EDI/CSV, State-Wise Vehicle Unit Summary (CSV & PDF), 4-Column Fuel Export, 6-Column Mileage Export, 4-Year Audit Defense ZIP Package  

---

## 1. Application Analysis Report

### 1.1 Existing Architecture & Technology Stack
- **Frontend Layer (`frontend/src/`):**
  - Single-Page Application built on React 18 and Vite (`http://localhost:5173`).
  - Centralized REST client in `frontend/src/api.js` handling JWT authentication, file uploads (`FormData`), and binary blob downloads (`PDF`, `CSV`, `ZIP`).
  - Core UI modules in `frontend/src/components/`:
    - `Navbar.jsx` — Multi-fleet switcher, reporting quarter selector, user role badge, and 11-tab navigation bar (Fuel Type dropdown removed; Diesel only).
    - `Dashboard.jsx` — Live KPI cards, guided 4-step workflow, compliance warnings, and dynamic top mileage corridors.
    - `CustomerDirectory.jsx` & `CustomerMasterModal.jsx` — 6-tab Customer Master (`Info`, `Accounts`, `Options`, `Notes`, `Employee Access`, `Customer Access`).
    - `FleetSummaryReport.jsx` — 17-column ProMiles-style Schedule 1 IFTA Tax Summary, quarter lock/unlock, and 1-click exports.
    - `CsvIngestionHub.jsx` — Upsert staging pipeline for Mileage & Fuel CSV/Excel files + inline Manual Entry & ZIP Distance Calculator.
    - `MileageGrid.jsx` — Dedicated ZIP-to-ZIP Mileage Calculation Utility + Multi-Row Manual Mileage Entry Grid.
    - `FuelLedger.jsx` — Manual Fuel Purchase Entry + 4-Column Fuel Purchase CSV Export.
    - `UnitSummaryReport.jsx` — Vehicle-level & State-Wise Unit Summary with Unit, State, Date Range, and Quarter filters + Unit-wise/Fleet-wide PDF export.
    - `PowerUnits.jsx` — Power Unit registration, editing (`PUT /api/vehicles/{id}`), and retirement.
    - `TripEntry.jsx` — Sequential corridor logging with BFS border adjacency validation.
    - `QuickCalculator.jsx` — Standalone IFTA tax estimation sandbox.
    - `StateRates.jsx` — 58-Jurisdiction Tax Rate Matrix with CSV/Excel upload, External API URL sync, single-state edit, and CSV template export.
- **Backend Layer (`backend/`):**
  - `main.py` — FastAPI application server (`http://localhost:8000`) exposing all REST endpoints.
  - `database.py` — SQLite connection manager, schema initialization, non-destructive `ALTER TABLE` migrations, and baseline 58-jurisdiction rate seeding (`IFTA_RATES_Q1_2026`).
  - `ifta_engine.py` — Commercial `ROUND_HALF_UP` IFTA tax calculator, KY surcharge handler, weight-distance mile tax calculator (`KY`, `NM`, `NY`, `OR`), and BFS state adjacency validator.
  - `csv_importer.py` — Pandas-based CSV/Excel parser, composite business key matcher, atomic transactional Upsert (`INSERT`, `UPDATE`, `DUPLICATE_SKIP`), and Import Summary generator.
  - `zip_distance.py` — 5-digit US ZIP code validator, coordinate resolver (exact commercial hubs + 3-digit USPS SCF interpolation), Haversine geodesic distance calculator, and `1.18` US highway circuity road mileage estimator.
  - `export_manager.py` — Generates Schedule 1 CSV, State E-File CSV, 4-Column Fuel Purchase CSV, 6-Column Mileage CSV, Unit Summary CSV, and 4-Year Audit Defense ZIP packages.
  - `pdf_generator.py` — ReportLab PDF engine for Landscape Schedule 1 Returns and State-Wise Vehicle Unit Summary PDF Reports.
  - `compliance.py` — Automated compliance engine checking date boundaries, duplicate batches, MPG anomalies (`4.0–10.0 MPG`), orphaned fuel/miles, and odometer continuity.

### 1.2 Database Schema & Relationships (`backend/fueltaxpulse.db`)
1. **`organizations`**: `id (PK)`, `name`, `account_type`, `subscription_status`, `created_at`
2. **`users`**: `id (PK)`, `org_id (FK -> organizations.id)`, `email (UNIQUE)`, `password_hash`, `full_name`, `role`
3. **`fleets`**: `id (PK)`, `org_id (FK -> organizations.id)`, `name`, `legal_name`, `ifta_account_number`, `base_jurisdiction`, `fein`, `dot_number`, `status`, `kyu_number`, `nm_wdt_number`, `ny_hut_number`, `or_wmt_number`
4. **`customers`**: `id (PK)`, `org_id (FK)`, `fleet_id (FK)`, contact/address fields, regulatory permits, banking fields (`bank_name`, `bank_routing_number`, `bank_account_number`, `billing_email`, `fuel_card_provider`, `fuel_card_account_num`), `notes`, `assigned_employees`, `customer_portal_enabled`, `portal_status`
5. **`vehicles`**: `id (PK)`, `fleet_id (FK -> fleets.id)`, `unit_number`, `vin`, `make`, `model`, `model_year`, `fuel_type ('DIESEL')`, `gross_vehicle_weight`, `number_of_axles`, `active_status`, `is_active` (`UNIQUE(fleet_id, unit_number)`)
6. **`mileage_records`**: `id (PK)`, `fleet_id (FK)`, `vehicle_id (FK)`, `unit_number`, `reporting_quarter`, `jurisdiction`, `total_miles`, `taxable_miles`, `non_taxable_miles`, `trip_date`, `origin_zip`, `destination_zip`, `start_odometer`, `end_odometer`, `import_batch_id`
7. **`fuel_transactions`**: `id (PK)`, `fleet_id (FK)`, `vehicle_id (FK)`, `unit_number`, `reporting_quarter`, `transaction_date`, `jurisdiction`, `gallons`, `fuel_type ('DIESEL')`, `tax_paid_at_pump`, `vendor_name`, `invoice_or_receipt_number`, `total_cost`, `import_batch_id`
8. **`ifta_tax_rates`**: `id (PK)`, `year`, `quarter`, `jurisdiction`, `fuel_type`, `tax_rate_per_gallon`, `surcharge_rate_per_gallon`, `weight_mile_rate`, `currency`, `effective_date`, `version`, `updated_at` (`UNIQUE(year, quarter, jurisdiction, fuel_type)`)
9. **`trips`** & **`trip_segments`**: Corridor headers and sequential state border crossings.
10. **`import_batches`**, **`csv_mapping_templates`**, **`quarter_locks`**, **`audit_logs`**: Audit trail and filing freeze tables.

---

## 2. Detailed Implementation of Modules 1–11

### Module 1: Customer Master Enhancements & Banking Security
- **Removed *Other Information* UI Section:** Removed *Date Incorporated*, *State of Incorporation*, *Corporation Number*, *Officer Title*, *Officer Name*, and *Officer SSN* from the **Info** tab of `frontend/src/components/CustomerMasterModal.jsx`. Historical columns in the `customers` table remain intact so no historical data is lost.
- **Save Customer Tab Gate:** Added `hasReachedCustomerAccess` state in `CustomerMasterModal.jsx`. The **Save Customer** button remains disabled until the user navigates to the final **Customer Access** tab (either by clicking the tab directly or clicking the **Next Tab →** button in the modal footer).
- **Banking Security & Validation:**
  - Added masked inputs (`type="password"`) for **Bank Routing Number (9 Digits)** and **Bank Account Number (Leading Zeros Supported)** in the **Options** tab.
  - Frontend and backend (`POST /api/customers`) enforce exact 9-digit numeric ABA routing validation (rejecting 8- or 10-digit routing numbers with HTTP `400`) and 4–17 digit account number validation (preserving leading zeros as strings).
  - Raw routing and account numbers are never logged or exposed in error messages.

### Module 2: Mileage Ingestion – Excel/CSV Modifications
- **Removed Columns:** Removed `BOL Number` (`Trip / BOL Number`), `Odometer Start`, and `Odometer End` from the Mileage Ingestion column mapper, sample CSV files, and mileage export endpoint.
- **Active Columns (`sample_mileage_ingestion_2026_Q1.csv` & `GET /api/reports/export-mileage-csv`):**
  ```csv
  Vehicle ID,Jurisdiction,Total Distance,Taxable Distance,Exempt Distance,Date
  ```
- **Backward Compatibility:** If a user uploads an older Excel/CSV template that still contains `BOL Number`, `Odometer Start`, or `Odometer End`, `backend/csv_importer.py` ignores the extra columns gracefully and imports the core mileage fields without error.

### Module 3: Fuel Purchase – 4-Column Excel/CSV Modifications
- **4-Column Export & Template:** Updated `GET /api/reports/export-fuel-csv` (`generate_fuel_purchases_csv` in `backend/export_manager.py`) and `sample_fuel_purchases_2026_Q1.csv` to contain **ONLY** these 4 columns:
  1. `Unit Number`
  2. `State`
  3. `Quantity`
  4. `Transaction Date`
- **Extra Column Filtering:** When importing a Fuel CSV file that has additional columns (`Product`, `Tax Paid`, `Merchant Name`, `Net Amount`, `Invoice Number`), `backend/csv_importer.py` extracts only the 4 required columns and defaults `fuel_type = 'DIESEL'` and `tax_paid_at_pump = True`.

### Module 4: ZIP-to-ZIP Mileage Calculation Utility
- **Engine (`backend/zip_distance.py` & `POST /api/mileage/calculate-zip-distance`):**
  - Validates 5-digit US Origin and Destination ZIP codes (`^\d{5}(-\d{4})?$`, rejecting invalid codes such as `00000`, `99999`, or non-numeric strings).
  - Resolves coordinates from an embedded US commercial freight hub coordinate table and 3-digit USPS Sectional Center Facility (SCF) prefix ranges (`010`–`994`).
  - Computes **Straight-Line Geodesic Distance** (Haversine great-circle formula) and **Commercial Road Distance Estimate** ($\text{Geodesic Miles} \times 1.18$ US Highway Circuity Factor).
  - Clearly labels the calculation method and includes a compliance disclaimer so estimated distances are reviewed before official filing.
- **UI Features (`frontend/src/components/MileageGrid.jsx` & `CsvIngestionHub.jsx`):**
  - Input fields: `Unit Number (Vehicle ID)`, `Origin ZIP Code`, `Destination ZIP Code`, `Jurisdiction (State)`, `Transaction Date`, and `Calculated Distance (Miles)`.
  - **Directly Use for Fleet Mileage Data:** 1-click button saves the calculated distance directly into `mileage_records` for the active fleet and quarter.
  - **Export Calculated CSV:** Exports calculated records in CSV format with exact headers:
    ```csv
    Vehicle ID,Jurisdiction,Total Distance,Date
    ```

### Module 5: Manual Fuel and Mileage Data Entry
- **Manual Fuel Entry (`FuelLedger.jsx` & `CsvIngestionHub.jsx`):**
  - Allows manual entry of `Unit Number`, `State`, `Quantity (Gallons)`, and `Transaction Date`.
  - Validates `Quantity > 0`, prevents accidental duplicate entries for the same `(fleet_id, quarter, unit_number, jurisdiction, transaction_date, gallons)`, shows success/error notifications, and refreshes the table immediately.
- **Manual Mileage Entry (`MileageGrid.jsx` & `CsvIngestionHub.jsx`):**
  - Allows manual entry of `Unit Number`, `Origin ZIP Code` (with inline **Calc ZIP** button), `Destination ZIP Code`, `State`, `Total Mileage`, `Exempt Miles`, and `Transaction Date`.

### Module 6: Remove Fuel Type Dropdown (Diesel Only)
- Removed the **Fuel Type** dropdown from the top-right application header in `frontend/src/components/Navbar.jsx`.
- Maintained `Diesel` (`DIESEL`) across all underlying API calls, tax calculations, forms, and exports.

### Module 7: Critical Bug Fix – CSV Import Update (Upsert) & Import Summary
- **Root Cause Identified:** Previously, `csv_importer.py` blocked re-uploads or performed append-only `INSERT` queries, and mixed Excel (`1/12/2026`) vs ISO (`2026-01-12`) date formats caused SQL `WHERE transaction_date = ?` lookups to miss older rows during commit. Additionally, editing `Total Distance` in Excel without editing `Taxable Distance` left `Taxable Miles` out of sync with `All Miles`.
- **Upsert Solution (`backend/csv_importer.py`):**
  - Both `parse_and_stage_csv` and `commit_staged_rows` use the shared `_load_grouped_existing_records()` matcher, which normalizes all dates (`1/12/2026` and `2026-01-12`) to ISO `YYYY-MM-DD` and matches uploaded rows against existing database records using composite business keys:
    - **Mileage Business Key:** `(fleet_id, reporting_quarter, unit_number, jurisdiction, normalized_trip_date)`
    - **Fuel Business Key:** `(fleet_id, reporting_quarter, unit_number, jurisdiction, normalized_transaction_date)`
  - **Automatic Taxable Distance Sync:** When `Total Distance` is updated in a Mileage CSV, `Taxable Distance` automatically recalculates as `max(0.0, Total Distance - Exempt Distance)` so `All Miles` and `Taxable Miles` remain balanced.
  - **Legacy Duplicate Consolidation:** If multiple legacy rows exist for the same `(unit_number, jurisdiction, normalized_date)`, `commit_staged_rows` updates the primary record by `id` and deletes any extra unnormalized duplicate rows.
  - Within an atomic database transaction (`try ... conn.commit() except ... conn.rollback()`):
    - **`INSERT`:** Inserts genuinely new records when no business key match exists.
    - **`UPDATE`:** Updates `total_miles`, `taxable_miles`, `non_taxable_miles` (or `gallons`) when a matching record exists with updated values.
    - **`DUPLICATE_SKIP`:** Skips rows that already exist in the database (or earlier in the same CSV file) with identical values.
    - **`FAILED`:** Records row-level validation failures without corrupting valid rows.
  - **How Updates Appear in Schedule 1 vs. Fuel Ledger:**
    - **Fuel Ledger Tab:** Displays every individual fuel purchase row by Unit Number, State, Quantity, and Transaction Date (e.g., `Unit 101, TX, 1.0 gal on 2026-01-12`).
    - **Fleet Tax Summary (Schedule 1) Tab:** Aggregates (sums) all transactions by State across all units and dates in the quarter (e.g., for `TX`: `1 gal (1/12) + 140 gal (1/21) + 150 gal (2/1) = 291 gal`).
- **Import Summary UI (`frontend/src/components/CsvIngestionHub.jsx`):**
  - Displays a 5-card Import Summary report after every commit (**Total Records Uploaded**, **New Records Inserted**, **Existing Records Updated**, **Duplicate Records Skipped**, **Failed Records & Error Details**) and updates the commit button to `✓ Committed to Database`.

### Module 8: Approximate Miles Tax – Business Logic Analysis
- **Current Formula (`backend/ifta_engine.py`, line 249):**
  $$\text{Approx. Mile Tax Due} = \text{round\_half\_up}(\text{Taxable Miles} \times \text{Weight-Mile Rate}, 2)$$
- **Relationship Between Mileage Fields:**
  - $\text{Taxable Miles} = \text{Total Miles} - \text{Non-Taxable (Off-Road / Exempt) Miles}$
  - State-wise `Taxable Miles` is used both for IFTA fuel consumption ($\text{Taxable Gallons} = \text{round\_half\_up}(\text{Taxable Miles} / \text{Fleet MPG}, 0)$) and for Weight-Distance Approximate Mile Tax in the 4 weight-distance jurisdictions seeded in `backend/database.py`:
    - **KY (Kentucky KYU):** $\$0.0285 / \text{mi}$ (plus $\$0.1050 / \text{gal}$ KY Heavy Equipment Surcharge)
    - **NM (New Mexico WDT):** $\$0.04378 / \text{mi}$
    - **NY (New York HUT):** $\$0.0150 / \text{mi}$
    - **OR (Oregon WMT):** $\$0.0650 / \text{mi}$ (Oregon exempts diesel at the pump; base IFTA rate is $\$0.0000 / \text{gal}$)
- **Preservation Note:** Existing tax formulas and rates are preserved without modification until any GVW/axle-bracket table changes are confirmed by the business team.

### Module 9: Power Unit Details (Edit Functionality)
- Added `PUT /api/vehicles/{vehicle_id}` in `backend/main.py` and an **Edit** button/modal on every row in `frontend/src/components/PowerUnits.jsx`.
- Validates mandatory fields (`Unit Number`, 17-character `VIN`, `Make`, `Model`, `Model Year`, `Licensed GVW`, `Axles`).
- Saves updates to the `vehicles` table and refreshes the inventory table while keeping all historical Fuel, Mileage, and Tax records intact.

### Module 10: Unit Summary – Detailed State-Wise Reporting & PDF Export
- **Enhancements in `frontend/src/components/UnitSummaryReport.jsx` & `backend/main.py`:**
  - **Filters:** Filter by **Power Unit Number** (`All Power Units` or a specific unit such as `Unit 101`), **State / Jurisdiction**, **Start Date**, **End Date**, and **Reporting Period (Quarter)**.
  - **Interactive Drill-Down:** Clicking any unit row in the top Fleet Overview table selects that unit and filters the **Detailed State-Wise Breakdown** table below.
  - **State-Wise Metrics Displayed:** `Unit Number`, `State`, `Total Miles`, `Taxable Miles`, `Non-Taxable Miles`, `Fuel Quantity (Gal)`, `Fuel Purchases ($)`, `Receipts`, `Taxable Gal`, `Net Tax Gal`, `Tax Rate`, and `Est. IFTA Tax`.
  - **Unit-Wise or Fleet-Wide PDF Export (`GET /api/reports/export-unit-summary-pdf`):** Generates a print-ready landscape PDF via `generate_unit_summary_pdf_bytes` in `backend/pdf_generator.py` for either the selected unit (e.g., `Unit 101`) or all units (`ALL`).

### Module 11: 58 Rate Matrix – Data Source, CSV/Excel Upload & External API Sync
- **Data Origination & Storage:**
  - Baseline rates originate in `IFTA_RATES_Q1_2026` in `backend/database.py` and are stored in the SQLite table `ifta_tax_rates` with metadata columns `effective_date`, `version`, and `updated_at`.
  - Dependent modules (`FleetSummaryReport`, `Dashboard`, `UnitSummaryReport`, `QuickCalculator`) read live rates from `ifta_tax_rates`.
- **How to Update the 58 Rate Matrix (3 Built-In Methods in `StateRates.jsx`):**
  1. **Upload Official IFTA Inc. CSV / Excel Sheet (`POST /api/rates/upload-file`):**
     - Click **"Export 58 Rate Matrix CSV"** (`GET /api/rates/export-csv`) on the **58 Rates Matrix** tab to download the template:
       `Jurisdiction,Base Diesel Rate,Surcharge Rate,Weight-Distance Rate,Currency,Effective Date`
     - Click **"Upload IFTA CSV/Excel or Connect API"**, select your `.csv`, `.xlsx`, or `.xls` spreadsheet, choose the **Effective Date**, and click **"Upload & Apply Rate Matrix"**.
  2. **Connect External Rate API / Feed URL (`POST /api/rates/sync-external`):**
     - Paste an external HTTP/HTTPS JSON or CSV endpoint URL returning IFTA jurisdiction rates and click **"Fetch & Sync from External API"**.
  3. **Single-Jurisdiction UI Edit (`PUT /api/rates/{jurisdiction}`):**
     - Click **"Edit"** on any jurisdiction row in the table to update its Base Diesel Rate, Surcharge Rate, Weight-Distance Rate, or Effective Date.

---

## 3. Complete List of Modified & Created Files

### Created Files
- `backend/zip_distance.py` — ZIP-to-ZIP validation, coordinate lookup, and road/geodesic distance calculation utility.
- `DOCUMENTS/APPLICATION_ANALYSIS_AND_DELIVERABLES.md` — Dedicated architectural analysis and deliverables specification document.

### Modified Backend Files
- `backend/database.py` — Non-destructive `ALTER TABLE` migrations for `bank_routing_number`, `origin_zip`, `destination_zip`, `effective_date`, `version`, and `updated_at`.
- `backend/models.py` — Added `VehicleUpdateRequest`, `ZipDistanceRequest`, and enhanced `FuelPurchaseCreateRequest`.
- `backend/csv_importer.py` — Composite business key matching, atomic Upsert (`INSERT`, `UPDATE`, `DUPLICATE_SKIP`), extra column filtering, and Import Summary reporting.
- `backend/export_manager.py` — Added 4-column `generate_fuel_purchases_csv` and 6-column `generate_mileage_records_csv`.
- `backend/pdf_generator.py` — Added `generate_unit_summary_pdf_bytes` for unit-specific and fleet-wide state-wise PDF exports.
- `backend/main.py` — Added/updated API endpoints across Modules 1–11.

### Modified Frontend Files
- `frontend/src/api.js`
- `frontend/src/components/Navbar.jsx`
- `frontend/src/components/CustomerMasterModal.jsx`
- `frontend/src/components/CsvIngestionHub.jsx`
- `frontend/src/components/MileageGrid.jsx`
- `frontend/src/components/FuelLedger.jsx`
- `frontend/src/components/PowerUnits.jsx`
- `frontend/src/components/UnitSummaryReport.jsx`
- `frontend/src/components/StateRates.jsx`
- `frontend/src/components/Dashboard.jsx`
- `frontend/src/components/FleetSummaryReport.jsx`
- `frontend/public/sample_data/sample_mileage_ingestion_2026_Q1.csv`
- `frontend/public/sample_data/sample_fuel_purchases_2026_Q1.csv`
- `sample_fuel_purchases_2026_Q1.csv`

---

## 4. API Endpoints Reference

| Method | Endpoint | Module | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/customers` | Module 1 & 11 | Save Customer Master with 9-digit routing & leading-zero account validation |
| `PUT` | `/api/vehicles/{vehicle_id}` | Module 9 | Edit Power Unit details while preserving historical records |
| `POST` | `/api/mileage/calculate-zip-distance` | Module 4 | Calculate geodesic & road mileage between Origin and Destination US ZIP codes |
| `POST` | `/api/mileage/quick-add` | Module 4 & 5 | Manual/ZIP mileage entry with duplicate prevention & upsert |
| `POST` | `/api/fuel-purchases` | Module 5 | Manual Diesel fuel purchase entry with duplicate prevention |
| `POST` | `/api/ingestion/stage-csv` | Module 2, 3, 7 | Parse CSV/Excel and preview `INSERT`, `UPDATE`, `DUPLICATE_SKIP`, and `FAILED` rows |
| `POST` | `/api/ingestion/commit` | Module 7 | Atomically commit staged CSV rows and return full Import Summary |
| `GET` | `/api/reports/export-fuel-csv` | Module 3 | Export 4-column Fuel Purchase CSV (`Unit Number,State,Quantity,Transaction Date`) |
| `GET` | `/api/reports/export-mileage-csv` | Module 2 | Export 6-column Mileage CSV (without BOL Number, Odometer Start/End) |
| `GET` | `/api/reports/unit-state-summary` | Module 10 | Detailed state-wise summary filtered by Unit, State, Date Range, and Quarter |
| `GET` | `/api/reports/export-unit-summary-pdf` | Module 10 | Export landscape PDF report for a selected Unit (e.g. `Unit 101`) or `ALL` units |
| `GET` | `/api/rates` | Module 11 | Fetch 58-jurisdiction rate matrix with `effective_date`, `version`, and `updated_at` |
| `POST` | `/api/rates/refresh` | Module 11 | Refresh/verify 58 rate matrix for a reporting quarter |
| `PUT` | `/api/rates/{jurisdiction}` | Module 11 | Update an individual jurisdiction's base rate, surcharge, or weight-mile rate |
| `GET` | `/api/rates/export-csv` | Module 11 | Export 58-jurisdiction rate matrix CSV template |
| `POST` | `/api/rates/upload-file` | Module 11 | Upload official IFTA `.csv`, `.xlsx`, or `.xls` sheet to bulk-update 58 rates |
| `POST` | `/api/rates/sync-external` | Module 11 | Sync 58 rate matrix from an external HTTP/HTTPS JSON or CSV API URL |

---

## 5. Test Cases & Verification Results

| # | Test Scenario | Input / Verification Details | Status |
| :--- | :--- | :--- | :--- |
| 1 | **Customer Master Tab Gate & UI** | *Other Information* removed; *Save Customer* disabled until reaching *Customer Access* tab | **PASS** |
| 2 | **Routing Numbers (8, 9, 10 Digits)** | `12345678` → HTTP `400`; `1234567890` → HTTP `400`; `021000021` (9 digits) → HTTP `200` | **PASS** |
| 3 | **Account Numbers with Leading Zeros** | `000482910` saved as exact string preserving leading zeros; masked in UI | **PASS** |
| 4 | **Mileage 6-Column CSV Export** | Exported header verified as `Vehicle ID,Jurisdiction,Total Distance,Taxable Distance,Exempt Distance,Date` | **PASS** |
| 5 | **Fuel Purchase 4-Column CSV Export** | Exported header verified strictly as `Unit Number,State,Quantity,Transaction Date` | **PASS** |
| 6 | **Valid & Invalid ZIP Distance Calc** | `72764` → `75201` calculated `330.8 mi`; invalid `00000` / `ABCDE` rejected with HTTP `400` | **PASS** |
| 7 | **CSV Import (New + Updated + Duplicate + Invalid)** | Verified atomic Upsert: 1 new row inserted, 1 existing row updated (`500` → `625 mi`), 1 duplicate row skipped, 1 invalid row reported | **PASS** |
| 8 | **Power Unit Editing** | Updated `Unit 101` model to `Cascadia Evolution` via `PUT /api/vehicles/{id}`; historical mileage/fuel unchanged | **PASS** |
| 9 | **Unit 101 State-Wise Report & PDF** | Filtered `Unit 101` across 6 states; generated valid `%PDF` binary (`3,390 bytes`) | **PASS** |
| 10 | **58 Rate Matrix CSV Upload & Refresh** | Exported 59 rows via `/api/rates/export-csv` and re-uploaded via `/api/rates/upload-file` (`updated_count: 59`) | **PASS** |

---

## 6. Deployment & Startup Instructions

### Local 1-Click Startup
```cmd
run_app.bat
```

### Manual Startup
1. **Backend Server (Port 8000):**
   ```powershell
   python -m uvicorn main:app --app-dir backend --host 0.0.0.0 --port 8000 --reload
   ```
2. **Frontend Development Server (Port 5173):**
   ```powershell
   cd frontend
   npm.cmd run dev
   ```
3. **Production Frontend Build:**
   ```powershell
   cd frontend
   npm.cmd run build
   ```
