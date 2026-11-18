# FuelTaxPulse Enterprise — Multi-Fleet IFTA & Fuel Tax Compliance Platform

**Platform Brand:** **FuelTaxPulse Enterprise**  
**Architecture:** Python (FastAPI + pandas + ReportLab) Backend + React (Vite + Tailwind CSS + Lucide Icons) Frontend  
**Compliance Authority:** 58 Member Jurisdictions (US Lower 48 + DC + 10 Canadian Provinces)  
**Standard Layouts:** IFTA Schedule 1, State DMV E-File EDI/CSV, Vehicle Unit Summary, 4-Year Audit Trail Preservation  

---

## 🚀 Key Functional Modules Implemented

### 1. Multi-Fleet Scoping & Multi-Tenancy
* Strict isolation by `fleet_id` and `reporting_quarter` (YYYY-Q1 through YYYY-Q4).
* Fast Fleet Entity switcher in the top navigation bar (`2AAB TRUCKING LLC`, `MIDWEST FREIGHT LINES LLC`, etc.).
* Role-based permissions: `super_admin`, `fleet_manager`, `auditor`.

### 2. CSV Data Ingestion & Audit Staging Pipeline
* Accepts `.csv`, `.xlsx`, and `.xls` files up to 50MB.
* **SHA-256 Duplicate Batch Detection (Hard Error):** Blocks re-uploading identical files to prevent duplicate tax liabilities.
* **4-Year Audit Retention:** Retains raw uploaded files in `import_batches` linked to cryptographic batch hashes.
* **Column Mapping Templates:** Saved presets for *Motive*, *WEX Fuel Cards*, *Samsara*, and custom spreadsheets.
* **Canadian Liters Conversion:** Auto-converts liters to gallons via `liters * 0.264172`.
* **Staging Table & Pre-Check:** Row-level validation displaying `VALID`, `SOFT_WARNING`, or `HARD_ERROR` before committing.

### 3. Spreadsheet-Style Manual Mileage & Fuel Grid Entry
* **Quick-Add Mode:** Grid entry for Unit Number, Jurisdiction, Total Miles, Non-Taxable Miles, and Taxable Miles with automatic balancing (`taxable + non_taxable = total`).
* **Trip Envelope Mode:** Driver paper log envelope entry with Origin, Destination, Highways/Corridors, Beginning/Ending Odometer, and state mileage splits.

### 4. Automated Compliance & Audit Rules Engine
* **Hard Errors (Blocking):**
  - Duplicate batch detection (SHA-256 hash match).
  - Transaction date outside the active quarter date boundaries.
* **Soft Warnings (Manager Review):**
  - Fleet & Unit MPG anomalies (outside commercial heavy diesel bounds of 4.0 – 10.0 MPG).
  - Orphaned data (Miles > 0 with 0 Gallons, or Gallons > 0 with 0 Miles).
  - Odometer gaps exceeding 50 miles between sequential logs.
  - State adjacency corridor breaks (with 1-click BFS intermediate state insertion).

### 5. Finalize & Lock Quarter
* Validates zero hard errors and freezes underlying records with an immutable JSON snapshot.
* Displays "LOCKED & AUDIT PRESERVED" status badge.
* Super Admin unlock capability for state-approved amendments with full audit trail logging.

### 6. Official Reports & Output Deliverables
* **IFTA Quarterly Tax Return (Official Landscape PDF):** Print-ready Schedule 1 layout matching state DOT specifications.
* **IFTA Schedule 1 CSV:** Jurisdictional breakdown of taxable miles, fuel consumed, tax-paid credits, and net tax due.
* **State E-File Bulk Upload CSV:** EDI/CSV layout matching state portal schemas for direct filing without manual re-keying.
* **Vehicle-Level Unit Summary (CSV):** Per-truck breakdown of miles, gallons, and MPG for fleet cost accounting.
* **IFTA Audit Defense Package (ZIP):** Bundles official PDF return, unit summaries, fuel receipt ledger, raw CSVs, and timestamped audit logs into a single 1-click download.

---

## ⚡ How to Run the Platform

### 1-Click Launch (Backend + Frontend)
Double-click `run_app.bat` or run:
```cmd
run_app.bat
```

### Manual Individual Startup
* **Backend API (FastAPI on Port 8000):**
  ```powershell
  cd backend
  python main.py
  ```
  *Swagger API Docs: [http://localhost:8000/docs](http://localhost:8000/docs)*

* **Frontend UI (React + Vite on Port 5173):**
  ```powershell
  cd frontend
  npm.cmd run dev
  ```
  *Web App: [http://localhost:5173](http://localhost:5173)*

### Pre-Seeded Accounts
* **Super Admin:** `admin@fueltaxpulse.com` / `admin123`
* **Fleet Tax Manager:** `manager@fueltaxpulse.com` / `manager123`
* **Auditor:** `auditor@fueltaxpulse.com` / `auditor123`
