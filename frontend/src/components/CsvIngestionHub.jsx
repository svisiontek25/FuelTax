import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, AlertCircle,
  Database, Layers, Download, Plus, Calculator, RefreshCw
} from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','DC','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
];

export default function CsvIngestionHub({ currentFleetId, quarter, onDataImported }) {
  const [importType, setImportType] = useState('mileage'); // 'mileage' or 'fuel'
  const [entryMode, setEntryMode] = useState('csv'); // 'csv' or 'manual'
  const [file, setFile] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  const [stagingResult, setStagingResult] = useState(null);
  const [error, setError] = useState(null);
  const [commitResult, setCommitResult] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  // Manual Entry State (Module 5)
  const [manualUnit, setManualUnit] = useState('Unit 101');
  const [manualState, setManualState] = useState('AR');
  const [manualDate, setManualDate] = useState('2026-01-15');
  const [manualMiles, setManualMiles] = useState('');
  const [manualNonTaxMiles, setManualNonTaxMiles] = useState('0');
  const [manualOriginZip, setManualOriginZip] = useState('');
  const [manualDestZip, setManualDestZip] = useState('');
  const [zipCalcInfo, setZipCalcInfo] = useState(null);
  const [zipCalculating, setZipCalculating] = useState(false);
  const [manualGallons, setManualGallons] = useState('');
  const [manualVendor, setManualVendor] = useState('Retail Pump');
  const [manualReceipt, setManualReceipt] = useState('');
  const [manualCost, setManualCost] = useState('');
  const [manualMsg, setManualMsg] = useState(null);
  const [manualErr, setManualErr] = useState(null);

  // Module 2 & 3 Compliant Column Mappings
  const [mappings, setMappings] = useState({
    unit_number: 'Vehicle ID',
    jurisdiction: 'Jurisdiction',
    total_miles: 'Total Distance',
    taxable_miles: 'Taxable Distance',
    non_taxable_miles: 'Exempt Distance',
    trip_date: 'Date'
  });

  useEffect(() => {
    loadTemplates();
    loadVehicles();
  }, [currentFleetId]);

  useEffect(() => {
    if (importType === 'mileage') {
      // Module 2: Removed BOL Number, Odometer Start, Odometer End
      setMappings({
        unit_number: 'Vehicle ID',
        jurisdiction: 'Jurisdiction',
        total_miles: 'Total Distance',
        taxable_miles: 'Taxable Distance',
        non_taxable_miles: 'Exempt Distance',
        trip_date: 'Date'
      });
    } else {
      // Module 3: ONLY 4 required columns for Fuel Purchases
      setMappings({
        unit_number: 'Unit Number',
        jurisdiction: 'State',
        gallons: 'Quantity',
        transaction_date: 'Transaction Date'
      });
    }
    setStagingResult(null);
    setCommitResult(null);
    setError(null);
    setManualMsg(null);
    setManualErr(null);
  }, [importType]);

  const loadTemplates = async () => {
    try {
      const data = await api.getTemplates();
      setTemplates(data || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const loadVehicles = async () => {
    try {
      const data = await api.getVehicles(currentFleetId);
      setVehicles(data || []);
      if (data && data.length > 0) {
        setManualUnit(data[0].unit_number);
      }
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    }
  };

  const handleApplyTemplate = (templateId) => {
    setSelectedTemplate(templateId);
    const tmpl = templates.find((t) => t.id === templateId);
    if (tmpl && tmpl.mappings) {
      setMappings(tmpl.mappings);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setStagingResult(null);
      setCommitResult(null);
      setError(null);
    }
  };

  const handleStageCsv = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a CSV or Excel file to upload.');
      return;
    }

    setLoading(true);
    setError(null);
    setStagingResult(null);
    setCommitResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('fleet_id', currentFleetId || '');
    formData.append('quarter', quarter);
    formData.append('import_type', importType);
    formData.append('mappings_json', JSON.stringify(mappings));

    try {
      const res = await api.stageCsv(formData);
      setStagingResult(res);
    } catch (err) {
      setError(err.message || 'File staging failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitBatch = async () => {
    if (!stagingResult || !stagingResult.batch_id) return;

    const validRows = stagingResult.all_staged_rows.filter((r) => r.status !== 'HARD_ERROR');
    if (validRows.length === 0 && stagingResult.all_staged_rows.length > 0) {
      setError('Cannot commit batch: 0 valid rows found. Please resolve blocking errors first.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.commitCsv({
        batch_id: stagingResult.batch_id,
        fleet_id: currentFleetId,
        quarter,
        import_type: importType,
        valid_rows: validRows,
        all_rows: stagingResult.all_staged_rows
      });
      setCommitResult(res);
      // Mark staging preview rows as committed so the UI reflects the updated database state immediately
      setStagingResult((prev) => prev ? {
        ...prev,
        is_committed: true,
        insert_preview_count: res.inserted_count,
        update_preview_count: res.updated_count,
        duplicate_preview_count: res.duplicate_skipped_count
      } : prev);
      loadVehicles();
    } catch (err) {
      setError(err.message || 'Commit failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCurrentCsv = async () => {
    try {
      if (importType === 'mileage') {
        const url = api.exportMileageCsvUrl(quarter, currentFleetId);
        await api.downloadFile(url, `Mileage_Records_${quarter}.csv`);
      } else {
        const url = api.exportFuelCsvUrl(quarter, currentFleetId);
        await api.downloadFile(url, `Fuel_Purchases_${quarter}.csv`);
      }
    } catch (err) {
      setError(err.message || 'Export failed.');
    }
  };

  // ZIP Distance Calculation inside Manual Mileage Entry (Module 4 & 5)
  const handleCalculateZipForManual = async () => {
    if (!manualOriginZip.trim() || !manualDestZip.trim()) {
      setManualErr('Please enter both Origin ZIP Code and Destination ZIP Code.');
      return;
    }
    setZipCalculating(true);
    setManualErr(null);
    try {
      const res = await api.calculateZipDistance(manualOriginZip.trim(), manualDestZip.trim());
      setZipCalcInfo(res);
      setManualMiles(String(res.distance_miles));
      if (res.recommended_jurisdiction) {
        setManualState(res.recommended_jurisdiction);
      }
    } catch (err) {
      setManualErr(err.message || 'ZIP distance calculation failed.');
    } finally {
      setZipCalculating(false);
    }
  };

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setManualMsg(null);
    setManualErr(null);

    if (!manualUnit.trim()) {
      setManualErr('Unit Number is required.');
      return;
    }

    setLoading(true);
    try {
      if (importType === 'mileage') {
        const tot = parseFloat(manualMiles);
        if (isNaN(tot) || tot <= 0) {
          throw new Error('Mileage must be a positive number.');
        }
        const nonTax = parseFloat(manualNonTaxMiles) || 0;
        const taxable = Math.max(0, tot - nonTax);
        const res = await api.quickAddMileage({
          fleet_id: currentFleetId,
          quarter,
          rows: [{
            unit_number: manualUnit.trim(),
            jurisdiction: manualState,
            total_miles: tot,
            taxable_miles: taxable,
            non_taxable_miles: nonTax,
            trip_date: manualDate,
            origin_zip: manualOriginZip.trim() || undefined,
            destination_zip: manualDestZip.trim() || undefined
          }]
        });
        setManualMsg(res.message || `Saved mileage entry for ${manualUnit} (${tot} mi in ${manualState}).`);
        setManualMiles('');
        setZipCalcInfo(null);
      } else {
        const gal = parseFloat(manualGallons);
        if (isNaN(gal) || gal <= 0) {
          throw new Error('Fuel quantity (gallons) must be greater than 0.');
        }
        await api.createFuelPurchase({
          unit_number: manualUnit.trim(),
          purchase_date: manualDate,
          quarter,
          jurisdiction: manualState,
          fuel_type: 'Diesel',
          gallons: gal,
          is_tax_paid: true,
          vendor: manualVendor || 'Retail Pump',
          receipt_number: manualReceipt || undefined,
          total_cost: manualCost ? parseFloat(manualCost) : undefined
        }, currentFleetId);
        setManualMsg(`Saved fuel purchase for ${manualUnit} (${gal} gal in ${manualState} on ${manualDate}).`);
        setManualGallons('');
        setManualReceipt('');
        setManualCost('');
      }
      loadVehicles();
    } catch (err) {
      setManualErr(err.message || 'Failed to save manual entry.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Data Ingestion, Upsert & Manual Entry Hub
            </h2>
            <span className="badge badge-success">Upsert & Duplicate Safe</span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Import or update Mileage & Fuel CSV/Excel files (automatically updates existing matching records & skips duplicates) or enter records manually.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCurrentCsv}
          className="btn btn-secondary"
          style={{ borderColor: '#1B365D', color: '#1B365D', fontWeight: '700' }}
        >
          <Download size={15} /> Export Active {importType === 'mileage' ? 'Mileage CSV (6-Col)' : 'Fuel Purchases CSV (4-Col)'}
        </button>
      </div>

      {/* Top Controls: Data Type (Mileage vs Fuel) & Entry Method (CSV Upload vs Manual Entry) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{
          display: 'flex',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={() => setImportType('mileage')}
            className={`btn ${importType === 'mileage' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Layers size={16} /> 1. Mileage Data (Vehicle ID, State, Distance, Date)
          </button>
          <button
            type="button"
            onClick={() => setImportType('fuel')}
            className={`btn ${importType === 'fuel' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Database size={16} /> 2. Fuel Purchases (Unit, State, Quantity, Date)
          </button>
        </div>

        <div style={{
          display: 'flex',
          background: '#ffffff',
          padding: '6px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          gap: '8px'
        }}>
          <button
            type="button"
            onClick={() => setEntryMode('csv')}
            className={`btn ${entryMode === 'csv' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Upload size={15} /> CSV / Excel File Import & Update
          </button>
          <button
            type="button"
            onClick={() => setEntryMode('manual')}
            className={`btn ${entryMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
          >
            <Plus size={15} /> Manual {importType === 'mileage' ? 'Mileage (+ ZIP Calculator)' : 'Fuel Purchase'} Entry
          </button>
        </div>
      </div>

      {/* MODE A: MANUAL ENTRY FORM (Module 4 & Module 5) */}
      {entryMode === 'manual' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '800', color: '#1B365D', marginBottom: '6px' }}>
            {importType === 'mileage' ? 'Manual Mileage Entry (with Optional ZIP-to-ZIP Distance Calculator)' : 'Manual Fuel Purchase Entry (Diesel)'}
          </h3>
          <p style={{ fontSize: '12.5px', color: '#64748b', marginBottom: '16px' }}>
            {importType === 'mileage'
              ? 'Enter state mileage directly or calculate driving distance from Origin and Destination 5-digit US ZIP codes before saving.'
              : 'Enter a manual diesel fuel purchase receipt. Duplicate entries for the same Unit, State, Date, and Quantity are prevented.'}
          </p>

          {manualMsg && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle size={18} />
              <span>{manualMsg}</span>
            </div>
          )}

          {manualErr && (
            <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={18} />
              <span>{manualErr}</span>
            </div>
          )}

          {importType === 'mileage' && (
            <div style={{ padding: '16px', borderRadius: '10px', background: '#f8fafc', border: '1px solid #cbd5e1', marginBottom: '18px' }}>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B365D', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calculator size={16} color="#0284c7" /> ZIP-to-ZIP Distance Helper (Optional)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Origin ZIP Code
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={manualOriginZip}
                    onChange={(e) => setManualOriginZip(e.target.value)}
                    placeholder="e.g. 72764 (Springdale, AR)"
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Destination ZIP Code
                  </label>
                  <input
                    type="text"
                    maxLength={10}
                    value={manualDestZip}
                    onChange={(e) => setManualDestZip(e.target.value)}
                    placeholder="e.g. 75201 (Dallas, TX)"
                    className="form-input font-mono"
                  />
                </div>
                <div>
                  <button
                    type="button"
                    onClick={handleCalculateZipForManual}
                    disabled={zipCalculating}
                    className="btn btn-secondary"
                    style={{ width: '100%', borderColor: '#0284c7', color: '#0284c7', fontWeight: '700' }}
                  >
                    <Calculator size={15} /> {zipCalculating ? 'Calculating...' : 'Calculate ZIP Distance'}
                  </button>
                </div>
              </div>
              {zipCalcInfo && (
                <div style={{ marginTop: '10px', padding: '10px 12px', borderRadius: '6px', background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: '12px', color: '#1e3a8a' }}>
                  <div>
                    <strong>Route:</strong> {zipCalcInfo.origin_city}, {zipCalcInfo.origin_state} ({zipCalcInfo.origin_zip}) → {zipCalcInfo.destination_city}, {zipCalcInfo.destination_state} ({zipCalcInfo.destination_zip})
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <strong>Estimated Road Distance:</strong> {zipCalcInfo.road_distance_miles} miles (Straight-line geodesic: {zipCalcInfo.straight_line_miles} mi) • <em>Method: {zipCalcInfo.calculation_method}</em>
                  </div>
                  <div style={{ marginTop: '2px', color: '#475569', fontSize: '11px' }}>
                    {zipCalcInfo.disclaimer}
                  </div>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleManualSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                Unit Number (Vehicle ID) *
              </label>
              <input
                type="text"
                list="fleet-units-list"
                required
                value={manualUnit}
                onChange={(e) => setManualUnit(e.target.value)}
                placeholder="e.g. Unit 101"
                className="form-input"
              />
              <datalist id="fleet-units-list">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.unit_number}>{v.make} {v.model}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                State / Jurisdiction *
              </label>
              <select
                value={manualState}
                onChange={(e) => setManualState(e.target.value)}
                className="form-input"
              >
                {US_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            {importType === 'mileage' ? (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Total Mileage (Miles) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={manualMiles}
                    onChange={(e) => setManualMiles(e.target.value)}
                    placeholder="e.g. 420.5"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Exempt / Non-Taxable Miles
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={manualNonTaxMiles}
                    onChange={(e) => setManualNonTaxMiles(e.target.value)}
                    className="form-input"
                  />
                </div>
              </>
            ) : (
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Quantity (Gallons) *
                </label>
                <input
                  type="number"
                  step="0.001"
                  required
                  value={manualGallons}
                  onChange={(e) => setManualGallons(e.target.value)}
                  placeholder="e.g. 125.5"
                  className="form-input"
                />
              </div>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                Transaction Date *
              </label>
              <input
                type="date"
                required
                value={manualDate}
                onChange={(e) => setManualDate(e.target.value)}
                className="form-input"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 16px' }}
              >
                <Plus size={16} /> {loading ? 'Saving...' : `Save ${importType === 'mileage' ? 'Mileage' : 'Fuel'} Record`}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODE B: CSV / EXCEL FILE UPLOAD & COLUMN MAPPER (Modules 2, 3, 7) */}
      {entryMode === 'csv' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
          gap: '24px'
        }}>
          {/* Left: File Upload & Template Picker */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', margin: 0 }}>
                Upload File (.csv, .xlsx, .xls)
              </h3>
              <a
                href={importType === 'mileage' ? '/sample_data/sample_mileage_ingestion_2026_Q1.csv' : '/sample_data/sample_fuel_purchases_2026_Q1.csv'}
                download={importType === 'mileage' ? 'sample_mileage_ingestion_2026_Q1.csv' : 'sample_fuel_purchases_2026_Q1.csv'}
                className="btn btn-secondary"
                style={{ fontSize: '11.5px', padding: '4px 10px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '5px', borderColor: '#73A5CA', color: '#1B365D' }}
              >
                <Download size={13} color="#60C1E5" /> Download Sample {importType === 'mileage' ? 'Mileage' : 'Fuel (4-Col)'} CSV
              </a>
            </div>

            <form onSubmit={handleStageCsv} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Named Mapping Template
                </label>
                <select
                  value={selectedTemplate}
                  onChange={(e) => handleApplyTemplate(e.target.value)}
                  className="form-input"
                >
                  <option value="">Default Standard Mapping...</option>
                  {templates
                    .filter((t) => t.import_type === importType)
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.template_name}</option>
                    ))}
                </select>
              </div>

              <div style={{
                border: '2px dashed #cbd5e1',
                borderRadius: '10px',
                padding: '28px 20px',
                textAlign: 'center',
                background: '#f8fafc',
                cursor: 'pointer'
              }}>
                <Upload size={32} color="#2563eb" style={{ margin: '0 auto 10px' }} />
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>
                  {file ? file.name : 'Choose a file or drag & drop here'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {importType === 'mileage'
                    ? 'Columns: Vehicle ID, Jurisdiction, Total Distance, Taxable Distance, Exempt Distance, Date'
                    : 'Columns: Unit Number, State, Quantity, Transaction Date (extra columns are ignored)'}
                </div>
                <input
                  type="file"
                  accept=".csv, .xlsx, .xls"
                  onChange={handleFileChange}
                  style={{ marginTop: '12px', fontSize: '12px' }}
                />
              </div>

              {error && (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={18} />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !file}
                className="btn btn-primary"
                style={{ padding: '12px', fontSize: '14px' }}
              >
                {loading ? 'Analyzing & Matching Records...' : '1. Upload & Analyze Record Matching'}
              </button>
            </form>
          </div>

          {/* Right: Column Mapper */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '6px' }}>
              Column Mapper ({importType === 'mileage' ? 'Mileage Template Fields' : '4 Required Fuel Columns'})
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '16px' }}>
              {importType === 'mileage'
                ? 'BOL Number, Odometer Start, and Odometer End have been removed. Legacy files with those columns are handled automatically.'
                : 'Only Unit Number, State, Quantity, and Transaction Date are fetched. Any extra columns in your file are safely ignored.'}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.keys(mappings).map((field) => (
                <div key={field} style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#334155', textTransform: 'capitalize' }}>
                    {field.replace(/_/g, ' ')}:
                  </span>
                  <input
                    type="text"
                    value={mappings[field] || ''}
                    onChange={(e) => setMappings({ ...mappings, [field]: e.target.value })}
                    placeholder="Header name in CSV"
                    className="form-input"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODULE 7: DETAILED IMPORT SUMMARY CARD */}
      {commitResult && (
        <div className="card" style={{ padding: '22px 24px', borderLeft: '5px solid #16a34a', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <CheckCircle size={22} color="#16a34a" />
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  CSV Import & Upsert Summary Report
                </h3>
                <p style={{ fontSize: '12.5px', color: '#475569', margin: 0 }}>
                  Database records have been atomically updated and synchronized for quarter <strong>{quarter}</strong>.
                </p>
              </div>
            </div>
            {onDataImported && (
              <button
                type="button"
                onClick={() => onDataImported()}
                className="btn btn-primary btn-sm"
              >
                View Updated Tax Summary →
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))', gap: '12px' }}>
            <div style={{ background: '#ffffff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Records Uploaded</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>{commitResult.total_uploaded ?? 0}</div>
            </div>
            <div style={{ background: '#f0fdf4', padding: '12px 14px', borderRadius: '8px', border: '1px solid #86efac', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>New Records Inserted</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#15803d', marginTop: '4px' }}>{commitResult.inserted_count ?? 0}</div>
            </div>
            <div style={{ background: '#eff6ff', padding: '12px 14px', borderRadius: '8px', border: '1px solid #93c5fd', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase' }}>Existing Records Updated</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#1d4ed8', marginTop: '4px' }}>{commitResult.updated_count ?? 0}</div>
            </div>
            <div style={{ background: '#fefce8', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fde047', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#854d0e', textTransform: 'uppercase' }}>Duplicate Records Skipped</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#a16207', marginTop: '4px' }}>{commitResult.duplicate_skipped_count ?? 0}</div>
            </div>
            <div style={{ background: '#fef2f2', padding: '12px 14px', borderRadius: '8px', border: '1px solid #fca5a5', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>Failed Records</div>
              <div style={{ fontSize: '22px', fontWeight: '800', color: '#dc2626', marginTop: '4px' }}>{commitResult.failed_count ?? 0}</div>
            </div>
          </div>

          {commitResult.error_details && commitResult.error_details.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', borderRadius: '8px', background: '#fff1f2', border: '1px solid #fecdd3', fontSize: '12px', color: '#9f1239' }}>
              <strong>Error Details ({commitResult.error_details.length}):</strong>
              <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
                {commitResult.error_details.map((ed, idx) => (
                  <li key={idx}>{ed}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Staging & Upsert Preview Table */}
      {stagingResult && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Staging & Upsert Matching Preview
                </h3>
                <span className="badge badge-info">{stagingResult.total_rows} Total Uploaded</span>
                <span className="badge badge-success">{stagingResult.insert_preview_count ?? 0} New Insert</span>
                <span className="badge badge-info" style={{ background: '#dbeafe', color: '#1e40af' }}>{stagingResult.update_preview_count ?? 0} Existing Update</span>
                <span className="badge badge-warning">{stagingResult.duplicate_preview_count ?? 0} Duplicate Skip</span>
                {stagingResult.hard_error_count > 0 && (
                  <span className="badge badge-danger">{stagingResult.hard_error_count} Failed / Blocking</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }} className="font-mono">
                File: {stagingResult.filename} • SHA-256: {stagingResult.file_sha256}
              </div>
            </div>

            <button
              onClick={handleCommitBatch}
              disabled={loading || stagingResult.is_committed || (stagingResult.hard_error_count === stagingResult.total_rows && stagingResult.total_rows > 0)}
              className={`btn ${stagingResult.is_committed ? 'btn-secondary' : 'btn-primary'}`}
            >
              <CheckCircle size={16} /> {stagingResult.is_committed ? '✓ Committed to Database' : '2. Commit Updates & Inserts to Database'}
            </button>
          </div>

          <div style={{ overflowX: 'auto', maxHeight: '450px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                <tr>
                  <th style={{ padding: '8px 10px' }}>Row</th>
                  <th style={{ padding: '8px 10px' }}>Upsert Action</th>
                  <th style={{ padding: '8px 10px' }}>Unit #</th>
                  <th style={{ padding: '8px 10px' }}>State</th>
                  {importType === 'mileage' ? (
                    <>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Distance</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Distance</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Exempt Distance</th>
                      <th style={{ padding: '8px 10px' }}>Date</th>
                    </>
                  ) : (
                    <>
                      <th style={{ padding: '8px 10px', textAlign: 'right' }}>Quantity (Gal)</th>
                      <th style={{ padding: '8px 10px' }}>Transaction Date</th>
                    </>
                  )}
                  <th style={{ padding: '8px 10px' }}>Matching & Validation Details</th>
                </tr>
              </thead>
              <tbody>
                {stagingResult.preview_rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '8px 10px', color: '#64748b' }}>#{r.row_index}</td>
                    <td style={{ padding: '8px 10px' }}>
                      {r.status === 'HARD_ERROR' ? (
                        <span className="badge badge-danger">FAILED</span>
                      ) : r.action === 'UPDATE' ? (
                        <span className="badge badge-info" style={{ background: '#dbeafe', color: '#1d4ed8' }}>UPDATE EXISTING</span>
                      ) : r.action === 'DUPLICATE_SKIP' ? (
                        <span className="badge badge-warning">DUPLICATE SKIP</span>
                      ) : (
                        <span className="badge badge-success">NEW INSERT</span>
                      )}
                    </td>
                    <td style={{ padding: '8px 10px', fontWeight: '700' }}>{r.unit_number}</td>
                    <td style={{ padding: '8px 10px', fontWeight: '700', color: '#2563eb' }}>{r.jurisdiction}</td>

                    {importType === 'mileage' ? (
                      <>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{r.total_miles}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.taxable_miles}</td>
                        <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.non_taxable_miles}</td>
                        <td style={{ padding: '8px 10px' }}>{r.trip_date || '—'}</td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{r.gallons}</td>
                        <td style={{ padding: '8px 10px' }}>{r.transaction_date}</td>
                      </>
                    )}

                    <td style={{ padding: '8px 10px', fontSize: '11px' }}>
                      {r.errors?.map((err, errI) => (
                        <span key={errI} style={{ color: '#dc2626', display: 'block' }}>• {err}</span>
                      ))}
                      {r.warnings?.map((warn, warnI) => (
                        <span key={warnI} style={{ color: '#0369a1', display: 'block' }}>• {warn}</span>
                      ))}
                      {!r.errors?.length && !r.warnings?.length && (
                        <span style={{ color: '#16a34a' }}>New record ready to insert</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
