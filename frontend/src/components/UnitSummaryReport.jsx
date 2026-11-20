import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Truck, Download, FileText, AlertTriangle, CheckCircle, Filter, RotateCcw } from 'lucide-react';

export default function UnitSummaryReport({ currentFleetId, quarter }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  // Module 10 Filters: Unit Number, State, Date Range, Reporting Period (quarter)
  const [selectedUnit, setSelectedUnit] = useState('ALL');
  const [selectedState, setSelectedState] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    loadUnitStateReport();
  }, [currentFleetId, quarter, selectedUnit, selectedState, startDate, endDate]);

  const loadUnitStateReport = async () => {
    setLoading(true);
    try {
      const data = await api.getUnitStateSummary({
        quarter,
        unitNumber: selectedUnit,
        state: selectedState,
        startDate,
        endDate,
        fleetId: currentFleetId
      });
      setReport(data);
    } catch (err) {
      console.error('Failed to load unit state summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedUnit('ALL');
    setSelectedState('ALL');
    setStartDate('');
    setEndDate('');
  };

  const handleExportCsv = async () => {
    try {
      const url = api.exportUnitSummaryCsvUrl(quarter, 'Diesel', currentFleetId);
      await api.downloadFile(url, `Vehicle_Unit_Summary_${quarter}.csv`);
    } catch (err) {
      window.open(api.exportUnitSummaryCsvUrl(quarter, 'Diesel', currentFleetId), '_blank');
    }
  };

  // Module 10E: Export PDF (Unit-Wise or Whole Fleet)
  const handleExportPdf = async (overrideUnit = null) => {
    const targetUnit = overrideUnit || selectedUnit || 'ALL';
    const unitSlug = targetUnit === 'ALL' ? 'All_Units' : targetUnit.replace(/\s+/g, '_');
    const url = api.exportUnitSummaryPdfUrl({
      quarter,
      unitNumber: targetUnit,
      state: selectedState,
      startDate,
      endDate,
      fleetId: currentFleetId
    });
    try {
      await api.downloadFile(url, `Unit_Summary_Report_${unitSlug}_${quarter}.pdf`);
    } catch (err) {
      window.open(url, '_blank');
    }
  };

  const unitsList = report?.units_list || [];
  const statesList = report?.states_list || [];
  const unitOverview = report?.unit_overview || [];
  const stateRows = report?.state_rows || [];
  const totals = report?.totals || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Export Actions */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Vehicle-Level & State-Wise Unit Summary Report
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Select any Power Unit (e.g. Unit 101) to inspect its complete state-by-state mileage, fuel purchases, and tax summary or export to PDF.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => handleExportPdf()}
            className="btn btn-primary"
          >
            <FileText size={16} /> Export {selectedUnit === 'ALL' ? 'All Units' : selectedUnit} PDF Report
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="btn btn-secondary"
          >
            <Download size={16} /> Export Unit Summary CSV
          </button>
        </div>
      </div>

      {/* Module 10C: Filter Bar (Unit Number, State, Date Range, Reporting Period) */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '14px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              Power Unit Number
            </label>
            <select
              value={selectedUnit}
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="form-input"
              style={{ fontWeight: '700', color: '#1B365D' }}
            >
              <option value="ALL">All Power Units ({unitsList.length})</option>
              {unitsList.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              State / Jurisdiction
            </label>
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="form-input"
            >
              <option value="ALL">All Jurisdictions ({statesList.length})</option>
              {statesList.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <button
              type="button"
              onClick={handleResetFilters}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              <RotateCcw size={14} /> Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* High-Level Fleet Unit Overview Cards/Table (Click any unit row to select it) */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1B365D', margin: 0 }}>
            1. Power Unit Fleet Overview (Click any unit to filter its State-Wise Breakdown)
          </h3>
          <span style={{ fontSize: '12px', color: '#64748b' }}>Period: <strong>{quarter}</strong></span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Power Unit #</th>
                <th style={{ padding: '11px 16px', fontWeight: '700' }}>States Operated</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Total Miles</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Taxable Miles</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Fuel Pumped (Gal)</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Fuel Cost ($)</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Average MPG</th>
                <th style={{ padding: '11px 16px', fontWeight: '700' }}>Compliance Status</th>
                <th style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }}>Unit PDF</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    Loading vehicle summary breakdown...
                  </td>
                </tr>
              ) : unitOverview.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '24px', textAlign: 'center', color: '#64748b' }}>
                    No vehicle records found for this quarter.
                  </td>
                </tr>
              ) : unitOverview.map((u, i) => {
                const isSelected = selectedUnit === u.unit_number;
                return (
                  <tr
                    key={i}
                    onClick={() => setSelectedUnit(isSelected ? 'ALL' : u.unit_number)}
                    style={{
                      borderBottom: '1px solid #f1f5f9',
                      background: isSelected ? '#eff6ff' : '#ffffff',
                      cursor: 'pointer'
                    }}
                  >
                    <td style={{ padding: '11px 16px', fontWeight: '800', color: '#0f172a' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Truck size={16} color={isSelected ? '#1d4ed8' : '#2563eb'} />
                        <span>{u.unit_number}</span>
                        {isSelected && <span className="badge badge-info">Selected</span>}
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', color: '#475569', fontSize: '12px' }}>
                      {u.states_list?.join(', ') || '—'} ({u.states_count || 0})
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">
                      {Number(u.miles || 0).toLocaleString()} mi
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }} className="tabular-nums">
                      {Number(u.taxable_miles || 0).toLocaleString()} mi
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '600' }} className="tabular-nums">
                      {Number(u.gallons || 0).toLocaleString()} gal
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }} className="tabular-nums">
                      ${Number(u.fuel_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontWeight: '800', color: u.has_anomaly ? '#d97706' : '#0284c7' }} className="tabular-nums">
                      {Number(u.mpg || 0).toFixed(2)} MPG
                    </td>
                    <td style={{ padding: '11px 16px' }}>
                      {u.has_anomaly ? (
                        <span className="badge badge-warning">
                          <AlertTriangle size={12} /> MPG Anomaly
                        </span>
                      ) : (
                        <span className="badge badge-success">
                          <CheckCircle size={12} /> Normal
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleExportPdf(u.unit_number)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '11.5px', borderColor: '#0284c7', color: '#0284c7' }}
                      >
                        <FileText size={12} /> PDF
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Module 10B & 10D: State-Wise Summary Breakdown Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', background: '#f8fafc' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: '800', color: '#0f172a', margin: 0 }}>
              2. Detailed State-Wise Breakdown — {selectedUnit === 'ALL' ? 'All Power Units' : selectedUnit}
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
              Showing state-by-state Total Miles, Taxable Miles, Non-Taxable Miles, Fuel Quantity, Fuel Purchases, and Estimated IFTA Tax.
            </p>
          </div>
          <span className="badge badge-info">{stateRows.length} State Row(s)</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px', textAlign: 'left' }}>
            <thead style={{ background: '#1B365D', color: '#ffffff' }}>
              <tr>
                <th style={{ padding: '10px 14px', fontWeight: '700' }}>Unit Number</th>
                <th style={{ padding: '10px 12px', fontWeight: '700' }}>State</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Total Miles</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Taxable Miles</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Non-Taxable Miles</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Fuel Quantity (Gal)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Fuel Purchases ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: '700' }}>Receipts</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Taxable Gal</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Net Tax Gal</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }}>Tax Rate</th>
                <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700' }}>Est. IFTA Tax</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading state-wise breakdown...
                  </td>
                </tr>
              ) : stateRows.length === 0 ? (
                <tr>
                  <td colSpan="12" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No state-wise records match the selected filters.
                  </td>
                </tr>
              ) : stateRows.map((r, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#fcfdfe' }}>
                  <td style={{ padding: '10px 14px', fontWeight: '700', color: '#0f172a' }}>{r.unit_number}</td>
                  <td style={{ padding: '10px 12px', fontWeight: '800', color: '#2563eb' }}>{r.jurisdiction}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600' }} className="tabular-nums">{Number(r.total_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{Number(r.taxable_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }} className="tabular-nums">{Number(r.non_taxable_miles || 0).toLocaleString()}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', color: '#15803d' }} className="tabular-nums">{Number(r.fuel_gallons || 0).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }} className="tabular-nums">${Number(r.fuel_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>{r.fuel_receipt_count || 0}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }} className="tabular-nums">{Number(r.taxable_gallons || 0).toFixed(2)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '600', color: r.net_taxable_gallons < 0 ? '#15803d' : '#0f172a' }} className="tabular-nums">
                    {Number(r.net_taxable_gallons || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>${Number(r.tax_rate || 0).toFixed(4)}</td>
                  <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: '700', color: r.est_ifta_tax < 0 ? '#15803d' : '#0f172a' }} className="tabular-nums">
                    {r.est_ifta_tax < 0 ? `($${Math.abs(r.est_ifta_tax).toFixed(2)})` : `$${Number(r.est_ifta_tax || 0).toFixed(2)}`}
                  </td>
                </tr>
              ))}
            </tbody>
            {stateRows.length > 0 && (
              <tfoot style={{ background: '#f1f5f9', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                <tr>
                  <td style={{ padding: '12px 14px' }}>Filtered Totals</td>
                  <td style={{ padding: '12px 12px' }}>{stateRows.length} States</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }} className="tabular-nums">{Number(totals.total_miles || 0).toLocaleString()} mi</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }} className="tabular-nums">{Number(totals.taxable_miles || 0).toLocaleString()} mi</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }} className="tabular-nums">{Number(totals.non_taxable_miles || 0).toLocaleString()} mi</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right', color: '#15803d' }} className="tabular-nums">{Number(totals.fuel_gallons || 0).toLocaleString()} gal</td>
                  <td style={{ padding: '12px 12px', textAlign: 'right' }} className="tabular-nums">${Number(totals.fuel_cost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td style={{ padding: '12px 12px', textAlign: 'center' }}>{totals.fuel_receipt_count || 0}</td>
                  <td colSpan="3" style={{ padding: '12px 12px', textAlign: 'right', color: '#0284c7' }}>Avg MPG: {Number(totals.mpg || 0).toFixed(2)}</td>
                  <td style={{ padding: '12px 14px', textAlign: 'right', color: totals.est_ifta_tax < 0 ? '#15803d' : '#b91c1c' }} className="tabular-nums">
                    {totals.est_ifta_tax < 0 ? `($${Math.abs(totals.est_ifta_tax).toFixed(2)})` : `$${Number(totals.est_ifta_tax || 0).toFixed(2)}`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
