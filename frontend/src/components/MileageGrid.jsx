import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Layers, Plus, Trash2, CheckCircle, Save, Route,
  Calculator, Download, AlertCircle, MapPin
} from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','DC','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
];

export default function MileageGrid({ currentFleetId, quarter, onDataLogged }) {
  const [mode, setMode] = useState('zip-utility'); // 'zip-utility' or 'quick'
  const [vehicles, setVehicles] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Module 4: ZIP-to-ZIP Mileage Calculation Utility State
  const [zipForm, setZipForm] = useState({
    unit_number: 'Unit 101',
    jurisdiction: 'TX',
    origin_zip: '',
    destination_zip: '',
    transaction_date: '2026-01-15',
    calculated_distance: ''
  });
  const [zipResult, setZipResult] = useState(null);
  const [calculatingZip, setCalculatingZip] = useState(false);
  const [calculatedQueue, setCalculatedQueue] = useState([]);

  // Module 5B: Manual Quick-Add Mode State
  const [quickUnit, setQuickUnit] = useState('');
  const [quickRows, setQuickRows] = useState([
    { jurisdiction: 'AR', origin_zip: '', destination_zip: '', total_miles: '', non_taxable_miles: 0, taxable_miles: '', trip_date: '2026-01-15' },
  ]);

  useEffect(() => {
    loadData();
  }, [currentFleetId, quarter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehData, recData] = await Promise.all([
        api.getVehicles(currentFleetId),
        api.getMileageRecords(quarter, currentFleetId)
      ]);
      setVehicles(vehData || []);
      if (vehData && vehData.length > 0) {
        if (!quickUnit) setQuickUnit(vehData[0].unit_number);
        setZipForm((prev) => ({ ...prev, unit_number: prev.unit_number || vehData[0].unit_number }));
      }
      setRecords(recData || []);
    } catch (err) {
      console.error('Failed to load mileage records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Module 4: Calculate ZIP-to-ZIP Distance
  const handleCalculateZip = async (e) => {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!zipForm.origin_zip.trim() || !zipForm.destination_zip.trim()) {
      setErrorMsg('Please enter both Origin ZIP Code and Destination ZIP Code.');
      return;
    }

    setCalculatingZip(true);
    try {
      const res = await api.calculateZipDistance(zipForm.origin_zip.trim(), zipForm.destination_zip.trim());
      setZipResult(res);
      setZipForm((prev) => ({
        ...prev,
        calculated_distance: String(res.distance_miles),
        jurisdiction: res.recommended_jurisdiction || prev.jurisdiction
      }));
    } catch (err) {
      setZipResult(null);
      setErrorMsg(err.message || 'Invalid ZIP Code or route unavailable.');
    } finally {
      setCalculatingZip(false);
    }
  };

  // Add calculated ZIP record to the export/save queue
  const handleAddCalculatedToList = () => {
    setErrorMsg(null);
    const dist = parseFloat(zipForm.calculated_distance);
    if (!zipForm.unit_number.trim()) {
      setErrorMsg('Unit Number (Vehicle ID) is required.');
      return;
    }
    if (isNaN(dist) || dist <= 0) {
      setErrorMsg('Please calculate or confirm a valid positive distance in miles first.');
      return;
    }
    const newEntry = {
      id: Date.now().toString(),
      unit_number: zipForm.unit_number.trim(),
      jurisdiction: zipForm.jurisdiction,
      origin_zip: zipForm.origin_zip.trim(),
      destination_zip: zipForm.destination_zip.trim(),
      origin_label: zipResult ? `${zipResult.origin_city}, ${zipResult.origin_state}` : zipForm.origin_zip,
      dest_label: zipResult ? `${zipResult.destination_city}, ${zipResult.destination_state}` : zipForm.destination_zip,
      total_distance: dist,
      transaction_date: zipForm.transaction_date || new Date().toISOString().split('T')[0]
    };
    setCalculatedQueue((prev) => [...prev, newEntry]);
    setSuccessMsg(`Added ${newEntry.unit_number} (${newEntry.jurisdiction}: ${dist} mi) to Calculated Mileage Records.`);
  };

  // Directly save single or queued calculated records into active fleet mileage data
  const handleDirectlySaveCalculatedToFleet = async (itemsToSave) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const list = itemsToSave && itemsToSave.length > 0 ? itemsToSave : [
      {
        unit_number: zipForm.unit_number.trim(),
        jurisdiction: zipForm.jurisdiction,
        origin_zip: zipForm.origin_zip.trim(),
        destination_zip: zipForm.destination_zip.trim(),
        total_distance: parseFloat(zipForm.calculated_distance),
        transaction_date: zipForm.transaction_date
      }
    ];

    for (const item of list) {
      if (!item.unit_number || isNaN(item.total_distance) || item.total_distance <= 0) {
        setErrorMsg('Please calculate a valid positive distance and select a Unit Number before saving to fleet.');
        return;
      }
    }

    setLoading(true);
    try {
      const payloadRows = list.map((item) => ({
        unit_number: item.unit_number,
        jurisdiction: item.jurisdiction,
        total_miles: item.total_distance,
        taxable_miles: item.total_distance,
        non_taxable_miles: 0,
        trip_date: item.transaction_date,
        origin_zip: item.origin_zip,
        destination_zip: item.destination_zip
      }));

      const res = await api.quickAddMileage({
        fleet_id: currentFleetId,
        quarter,
        rows: payloadRows
      });
      setSuccessMsg(res.message || `Saved ${payloadRows.length} calculated mileage record(s) to fleet data.`);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save calculated mileage to fleet.');
    } finally {
      setLoading(false);
    }
  };

  // Module 4: Export calculated records in CSV format with exact required columns:
  // Vehicle ID, Jurisdiction, Total Distance, Date
  const handleExportCalculatedCsv = () => {
    const list = calculatedQueue.length > 0 ? calculatedQueue : (
      zipForm.calculated_distance && parseFloat(zipForm.calculated_distance) > 0
        ? [{
            unit_number: zipForm.unit_number.trim(),
            jurisdiction: zipForm.jurisdiction,
            total_distance: parseFloat(zipForm.calculated_distance),
            transaction_date: zipForm.transaction_date
          }]
        : []
    );

    if (list.length === 0) {
      setErrorMsg('No calculated records to export. Calculate a ZIP-to-ZIP distance first.');
      return;
    }

    const header = 'Vehicle ID,Jurisdiction,Total Distance,Date\n';
    const csvRows = list.map((r) => `${r.unit_number},${r.jurisdiction},${r.total_distance},${r.transaction_date}`).join('\n');
    const blob = new Blob([header + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Calculated_ZIP_Mileage_${quarter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Module 5B: Quick-Add Row helpers with inline ZIP calculation
  const handleAddQuickRow = () => {
    setQuickRows([...quickRows, { jurisdiction: 'AR', origin_zip: '', destination_zip: '', total_miles: '', non_taxable_miles: 0, taxable_miles: '', trip_date: '2026-01-15' }]);
  };

  const handleUpdateQuickRow = (idx, field, val) => {
    const copy = [...quickRows];
    copy[idx] = { ...copy[idx], [field]: val };
    if (field === 'total_miles' || field === 'non_taxable_miles') {
      const tot = parseFloat(field === 'total_miles' ? val : copy[idx].total_miles) || 0;
      const nonTax = parseFloat(field === 'non_taxable_miles' ? val : copy[idx].non_taxable_miles) || 0;
      copy[idx].taxable_miles = Math.max(0, Number((tot - nonTax).toFixed(1)));
    }
    setQuickRows(copy);
  };

  const handleCalculateRowZip = async (idx) => {
    const row = quickRows[idx];
    if (!row.origin_zip?.trim() || !row.destination_zip?.trim()) {
      setErrorMsg(`Row #${idx + 1}: Enter both Origin ZIP and Destination ZIP to calculate distance.`);
      return;
    }
    setErrorMsg(null);
    try {
      const res = await api.calculateZipDistance(row.origin_zip.trim(), row.destination_zip.trim());
      const copy = [...quickRows];
      const nonTax = parseFloat(copy[idx].non_taxable_miles) || 0;
      copy[idx] = {
        ...copy[idx],
        total_miles: res.distance_miles,
        taxable_miles: Math.max(0, Number((res.distance_miles - nonTax).toFixed(1))),
        jurisdiction: res.recommended_jurisdiction || copy[idx].jurisdiction
      };
      setQuickRows(copy);
      setSuccessMsg(`Row #${idx + 1}: Calculated ${res.distance_miles} miles (${res.origin_city}, ${res.origin_state} → ${res.destination_city}, ${res.destination_state}). Review and confirm before saving.`);
    } catch (err) {
      setErrorMsg(err.message || 'ZIP calculation failed.');
    }
  };

  const handleRemoveQuickRow = (idx) => {
    if (quickRows.length <= 1) return;
    setQuickRows(quickRows.filter((_, i) => i !== idx));
  };

  const handleSaveQuickRows = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const payloadRows = quickRows.map((r) => ({
        unit_number: quickUnit,
        jurisdiction: r.jurisdiction,
        total_miles: parseFloat(r.total_miles) || 0,
        taxable_miles: parseFloat(r.taxable_miles) || 0,
        non_taxable_miles: parseFloat(r.non_taxable_miles) || 0,
        trip_date: r.trip_date || undefined,
        origin_zip: r.origin_zip || undefined,
        destination_zip: r.destination_zip || undefined
      }));

      const res = await api.quickAddMileage({
        fleet_id: currentFleetId,
        quarter,
        rows: payloadRows
      });

      setSuccessMsg(res.message || `Successfully saved ${payloadRows.length} mileage records for ${quickUnit}!`);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save mileage rows.');
    }
  };

  const handleExportFleetMileageCsv = async () => {
    try {
      const url = api.exportMileageCsvUrl(quarter, currentFleetId);
      await api.downloadFile(url, `Mileage_Records_${quarter}.csv`);
    } catch (err) {
      setErrorMsg(err.message || 'Export failed.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Mileage Calculation Utility & Manual Entry Grid
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Calculate commercial road distances between US ZIP codes, export calculated CSV records, or manually log state mileage splits.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportFleetMileageCsv}
          className="btn btn-secondary"
          style={{ borderColor: '#1B365D', color: '#1B365D', fontWeight: '700' }}
        >
          <Download size={15} /> Export Quarter Mileage Template CSV
        </button>
      </div>

      {/* Mode Tabs */}
      <div style={{
        display: 'flex',
        background: '#ffffff',
        padding: '6px',
        borderRadius: '10px',
        border: '1px solid #e2e8f0',
        width: 'fit-content',
        gap: '8px'
      }}>
        <button
          type="button"
          onClick={() => setMode('zip-utility')}
          className={`btn ${mode === 'zip-utility' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Calculator size={16} /> 1. ZIP-to-ZIP Mileage Calculation Utility
        </button>
        <button
          type="button"
          onClick={() => setMode('quick')}
          className={`btn ${mode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Layers size={16} /> 2. Multi-Row Manual Mileage Entry Grid
        </button>
      </div>

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          color: '#166534',
          fontSize: '13px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{
          padding: '12px 16px',
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
          <span>{errorMsg}</span>
        </div>
      )}

      {/* MODULE 4: DEDICATED ZIP-TO-ZIP MILEAGE CALCULATION UTILITY */}
      {mode === 'zip-utility' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '800', color: '#1B365D', margin: 0 }}>
                ZIP Code Distance & Road Mileage Calculator
              </h3>
              <p style={{ fontSize: '12.5px', color: '#64748b', marginTop: '2px' }}>
                Enter Origin and Destination 5-digit US ZIP codes to compute estimated commercial highway driving distance.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCalculatedCsv}
              className="btn btn-secondary"
              style={{ borderColor: '#0284c7', color: '#0284c7', fontWeight: '700' }}
            >
              <Download size={15} /> Export Calculated CSV (Vehicle ID, Jurisdiction, Total Distance, Date)
            </button>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
            gap: '14px',
            alignItems: 'end',
            padding: '18px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0'
          }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                Unit Number (Vehicle ID) *
              </label>
              <input
                type="text"
                list="zip-utility-units"
                value={zipForm.unit_number}
                onChange={(e) => setZipForm({ ...zipForm, unit_number: e.target.value })}
                placeholder="e.g. Unit 101"
                className="form-input"
              />
              <datalist id="zip-utility-units">
                {vehicles.map((v) => (
                  <option key={v.id} value={v.unit_number}>{v.make} {v.model}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                Origin ZIP Code *
              </label>
              <input
                type="text"
                maxLength={10}
                value={zipForm.origin_zip}
                onChange={(e) => setZipForm({ ...zipForm, origin_zip: e.target.value })}
                placeholder="e.g. 72764"
                className="form-input font-mono"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                Destination ZIP Code *
              </label>
              <input
                type="text"
                maxLength={10}
                value={zipForm.destination_zip}
                onChange={(e) => setZipForm({ ...zipForm, destination_zip: e.target.value })}
                placeholder="e.g. 75201"
                className="form-input font-mono"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                Jurisdiction (State) *
              </label>
              <select
                value={zipForm.jurisdiction}
                onChange={(e) => setZipForm({ ...zipForm, jurisdiction: e.target.value })}
                className="form-input"
              >
                {US_STATES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#334155' }}>
                Transaction Date *
              </label>
              <input
                type="date"
                value={zipForm.transaction_date}
                onChange={(e) => setZipForm({ ...zipForm, transaction_date: e.target.value })}
                className="form-input"
              />
            </div>

            <div>
              <button
                type="button"
                onClick={handleCalculateZip}
                disabled={calculatingZip}
                className="btn btn-primary"
                style={{ width: '100%', padding: '10px 14px' }}
              >
                <Calculator size={16} /> {calculatingZip ? 'Calculating...' : 'Calculate Distance'}
              </button>
            </div>
          </div>

          {/* Calculation Result & Confirmation Panel */}
          <div style={{
            marginTop: '16px',
            padding: '16px 20px',
            borderRadius: '10px',
            background: zipResult ? '#eff6ff' : '#ffffff',
            border: `1px solid ${zipResult ? '#93c5fd' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div style={{ flex: 1, minWidth: '280px' }}>
              {zipResult ? (
                <>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={16} color="#0284c7" />
                    {zipResult.origin_city}, {zipResult.origin_state} ({zipResult.origin_zip}) → {zipResult.destination_city}, {zipResult.destination_state} ({zipResult.destination_zip})
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#1e40af', marginTop: '4px' }}>
                    <strong>Calculation Methodology:</strong> {zipResult.calculation_method} • Straight-Line Geodesic: <strong>{zipResult.straight_line_miles} mi</strong>
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#475569', marginTop: '3px' }}>
                    <em>Note: {zipResult.disclaimer}</em>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '13px', color: '#64748b' }}>
                  Enter Origin & Destination ZIP codes and click <strong>Calculate Distance</strong>, or enter/adjust distance manually on the right.
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
              <div style={{ width: '170px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', marginBottom: '4px', color: '#1e293b' }}>
                  Calculated Distance (Miles)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={zipForm.calculated_distance}
                  onChange={(e) => setZipForm({ ...zipForm, calculated_distance: e.target.value })}
                  placeholder="0.0"
                  className="form-input"
                  style={{ fontWeight: '800', fontSize: '15px', color: '#1B365D', textAlign: 'right' }}
                />
              </div>

              <button
                type="button"
                onClick={handleAddCalculatedToList}
                className="btn btn-secondary"
                style={{ borderColor: '#1B365D', color: '#1B365D', fontWeight: '700' }}
              >
                <Plus size={15} /> Add to Export List
              </button>

              <button
                type="button"
                onClick={() => handleDirectlySaveCalculatedToFleet()}
                disabled={loading}
                className="btn btn-primary"
                style={{ background: '#5B6E2C' }}
              >
                <Save size={15} /> Directly Use for Fleet Mileage Data
              </button>
            </div>
          </div>

          {/* Calculated Records Queue for CSV Export or Batch Save */}
          {calculatedQueue.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
                  Calculated ZIP Mileage Batch ({calculatedQueue.length} records)
                </h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleDirectlySaveCalculatedToFleet(calculatedQueue)}
                    className="btn btn-primary btn-sm"
                  >
                    <Save size={14} /> Save All to Fleet Mileage Data
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCalculatedCsv}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download size={14} /> Export Batch CSV
                  </button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
                <thead style={{ background: '#f1f5f9', borderBottom: '1px solid #cbd5e1' }}>
                  <tr>
                    <th style={{ padding: '8px 12px' }}>Vehicle ID</th>
                    <th style={{ padding: '8px 12px' }}>Jurisdiction</th>
                    <th style={{ padding: '8px 12px' }}>Origin ZIP → Destination ZIP</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Total Distance (mi)</th>
                    <th style={{ padding: '8px 12px' }}>Date</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Remove</th>
                  </tr>
                </thead>
                <tbody>
                  {calculatedQueue.map((item) => (
                    <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '8px 12px', fontWeight: '700' }}>{item.unit_number}</td>
                      <td style={{ padding: '8px 12px', fontWeight: '700', color: '#2563eb' }}>{item.jurisdiction}</td>
                      <td style={{ padding: '8px 12px', color: '#475569' }}>{item.origin_label} ({item.origin_zip}) → {item.dest_label} ({item.destination_zip})</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: '800' }} className="tabular-nums">{item.total_distance} mi</td>
                      <td style={{ padding: '8px 12px' }}>{item.transaction_date}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setCalculatedQueue(calculatedQueue.filter((q) => q.id !== item.id))}
                          style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODULE 5B: MULTI-ROW MANUAL MILEAGE ENTRY GRID (WITH INTEGRATED ZIP CALCULATOR) */}
      {mode === 'quick' && (
        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleSaveQuickRows} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '240px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Unit Number (Vehicle ID) *
                </label>
                <input
                  type="text"
                  list="quick-units-datalist"
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value)}
                  className="form-input"
                  placeholder="Select or enter Unit Number"
                  required
                />
                <datalist id="quick-units-datalist">
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.unit_number}>{v.make} {v.model}</option>
                  ))}
                </datalist>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '18px' }}>
                Total Miles in Batch: <strong>{quickRows.reduce((s, r) => s + (parseFloat(r.total_miles) || 0), 0).toFixed(1)} mi</strong>
              </div>
            </div>

            {/* Grid Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickRows.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '85px 120px 120px auto 130px 120px 120px 140px 32px',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0'
                  }}
                >
                  <select
                    value={row.jurisdiction}
                    onChange={(e) => handleUpdateQuickRow(idx, 'jurisdiction', e.target.value)}
                    className="form-input"
                    style={{ fontWeight: '700' }}
                    title="State / Jurisdiction"
                  >
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={row.origin_zip || ''}
                    onChange={(e) => handleUpdateQuickRow(idx, 'origin_zip', e.target.value)}
                    placeholder="Origin ZIP"
                    className="form-input font-mono"
                  />

                  <input
                    type="text"
                    value={row.destination_zip || ''}
                    onChange={(e) => handleUpdateQuickRow(idx, 'destination_zip', e.target.value)}
                    placeholder="Dest ZIP"
                    className="form-input font-mono"
                  />

                  <button
                    type="button"
                    onClick={() => handleCalculateRowZip(idx)}
                    className="btn btn-secondary btn-sm"
                    title="Calculate distance from Origin & Destination ZIP"
                    style={{ whiteSpace: 'nowrap', borderColor: '#0284c7', color: '#0284c7' }}
                  >
                    <Calculator size={13} /> Calc ZIP
                  </button>

                  <input
                    type="number"
                    step="0.1"
                    value={row.total_miles}
                    onChange={(e) => handleUpdateQuickRow(idx, 'total_miles', e.target.value)}
                    placeholder="Total Miles *"
                    className="form-input"
                    style={{ textAlign: 'right', fontWeight: '700' }}
                    required
                  />

                  <input
                    type="number"
                    step="0.1"
                    value={row.non_taxable_miles}
                    onChange={(e) => handleUpdateQuickRow(idx, 'non_taxable_miles', e.target.value)}
                    placeholder="Exempt Miles"
                    className="form-input"
                    style={{ textAlign: 'right' }}
                  />

                  <input
                    type="number"
                    step="0.1"
                    value={row.taxable_miles}
                    readOnly
                    placeholder="Taxable"
                    className="form-input"
                    style={{ textAlign: 'right', background: '#f1f5f9', fontWeight: '700' }}
                  />

                  <input
                    type="date"
                    value={row.trip_date}
                    onChange={(e) => handleUpdateQuickRow(idx, 'trip_date', e.target.value)}
                    className="form-input"
                  />

                  <button
                    type="button"
                    onClick={() => handleRemoveQuickRow(idx)}
                    disabled={quickRows.length <= 1}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
              <button
                type="button"
                onClick={handleAddQuickRow}
                className="btn btn-secondary btn-sm"
              >
                <Plus size={14} /> Add State Row
              </button>

              <button
                type="submit"
                className="btn btn-primary"
              >
                <Save size={16} /> Confirm & Save Mileage Batch to Fleet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Raw Mileage Records Table (Module 2: Removed Odometer Range & BOL columns) */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
          Quarterly Mileage Ledger for {quarter} ({records.length} records)
        </h3>

        <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '10px 12px' }}>Vehicle ID (Unit #)</th>
                <th style={{ padding: '10px 12px' }}>Jurisdiction</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Total Distance (mi)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Taxable Distance (mi)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Exempt Distance (mi)</th>
                <th style={{ padding: '10px 12px' }}>Transaction Date</th>
                <th style={{ padding: '10px 12px' }}>Origin / Dest ZIP</th>
              </tr>
            </thead>
            <tbody>
              {records.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No mileage records logged for {quarter}.
                  </td>
                </tr>
              ) : records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '9px 12px', fontWeight: '700' }}>{r.unit_number}</td>
                  <td style={{ padding: '9px 12px', fontWeight: '700', color: '#2563eb' }}>{r.jurisdiction}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }} className="tabular-nums">{Number(r.total_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{Number(r.taxable_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '9px 12px', textAlign: 'right' }} className="tabular-nums">{Number(r.non_taxable_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '9px 12px', color: '#334155' }}>{r.trip_date || '—'}</td>
                  <td style={{ padding: '9px 12px', color: '#64748b', fontFamily: 'monospace' }}>
                    {r.origin_zip && r.destination_zip ? `${r.origin_zip} → ${r.destination_zip}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
