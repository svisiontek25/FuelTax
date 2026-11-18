import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { FileSpreadsheet, Download, Search, Info, ShieldCheck, Lock, Unlock, FileArchive, FileText, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function FleetSummaryReport({ currentFleetId, quarter, fuelType, user }) {
  const [report, setReport] = useState(null);
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterSurchargesOnly, setFilterSurchargesOnly] = useState(false);
  const [selectedState, setSelectedState] = useState(null);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    loadData();
  }, [currentFleetId, quarter, fuelType]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryData, auditData] = await Promise.all([
        api.getFleetSummary(quarter, fuelType, currentFleetId),
        api.getComplianceAudit(quarter, fuelType, currentFleetId)
      ]);
      setReport(summaryData);
      setAudit(auditData);
    } catch (err) {
      console.error('Failed to load fleet summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      const url = api.exportPdfUrl(quarter, fuelType, currentFleetId);
      await api.downloadFile(url, `IFTA_Schedule1_${quarter}.pdf`);
    } catch (e) {
      window.open(api.exportPdfUrl(quarter, fuelType, currentFleetId), '_blank');
    }
  };

  const handleDownloadSchedule1Csv = async () => {
    try {
      const url = api.exportSchedule1CsvUrl(quarter, fuelType, currentFleetId);
      await api.downloadFile(url, `IFTA_Schedule1_${quarter}.csv`);
    } catch (e) {
      window.open(api.exportSchedule1CsvUrl(quarter, fuelType, currentFleetId), '_blank');
    }
  };

  const handleDownloadStateEFile = async () => {
    try {
      const url = api.exportStateEFileCsvUrl(quarter, fuelType, currentFleetId);
      await api.downloadFile(url, `IFTA_State_EFile_${quarter}.csv`);
    } catch (e) {
      window.open(api.exportStateEFileCsvUrl(quarter, fuelType, currentFleetId), '_blank');
    }
  };

  const handleDownloadAuditZip = async () => {
    try {
      const url = api.exportAuditZipUrl(quarter, fuelType, currentFleetId);
      await api.downloadFile(url, `IFTA_Audit_Defense_${quarter}.zip`);
    } catch (e) {
      window.open(api.exportAuditZipUrl(quarter, fuelType, currentFleetId), '_blank');
    }
  };

  const handleToggleLock = async () => {
    if (audit?.is_locked) {
      if (!window.confirm('Unlock quarter for amendments? This will be recorded in the IFTA audit trail.')) return;
      setLocking(true);
      try {
        await api.unlockQuarter({ fleet_id: currentFleetId, quarter, fuel_type: fuelType });
        loadData();
      } catch (err) {
        alert(err.message || 'Unlock failed.');
      } finally {
        setLocking(false);
      }
    } else {
      if (!audit?.can_lock) {
        alert(`Cannot lock return: ${audit?.hard_error_count} Hard Error(s) detected. Check the Compliance Audit panel.`);
        return;
      }
      if (!window.confirm('Finalize & Lock Quarter? This creates an immutable filing snapshot.')) return;
      setLocking(true);
      try {
        await api.lockQuarter({ fleet_id: currentFleetId, quarter, fuel_type: fuelType });
        loadData();
      } catch (err) {
        alert(err.message || 'Lock failed.');
      } finally {
        setLocking(false);
      }
    }
  };

  const rows = report?.rows || [];
  const totals = report?.totals;
  const meta = report?.metadata;

  const filteredRows = rows.filter((r) => {
    const matchesSearch = r.state.toLowerCase().includes(search.toLowerCase());
    if (filterSurchargesOnly) {
      return matchesSearch && (r.is_surcharge_row || r.approx_mile_tax_due);
    }
    return matchesSearch;
  });

  const formatNumber = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    if (typeof val === 'number') return val.toLocaleString();
    return val;
  };

  const formatCurrency = (val) => {
    if (val === "" || val === null || val === undefined) return "";
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    if (num < 0) return `($${Math.abs(num).toFixed(2)})`;
    return `$${num.toFixed(2)}`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Lock Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Fleet Fuel Tax Summary
            </h2>
            <span className="badge badge-info">Schedule 1 Layout</span>
            {audit?.is_locked ? (
              <span className="badge badge-success" style={{ padding: '4px 10px' }}>
                <Lock size={12} /> LOCKED & AUDIT FROZEN ({audit.locked_by})
              </span>
            ) : (
              <span className="badge badge-warning" style={{ padding: '4px 10px' }}>
                <Unlock size={12} /> DRAFT (UNLOCKED)
              </span>
            )}
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '2px' }}>
            Legal Entity: <strong>{meta?.company_name || '2AAB TRUCKING LLC'}</strong> • Period: <strong>{meta?.period || quarter}</strong> • Fuel: <strong>{fuelType}</strong>
          </p>
        </div>

        {/* Action Button Strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleToggleLock}
            disabled={locking}
            className={`btn ${audit?.is_locked ? 'btn-secondary' : 'btn-primary'}`}
            style={{ borderColor: audit?.is_locked ? '#cbd5e1' : 'transparent' }}
          >
            {audit?.is_locked ? <><Unlock size={16} /> Unlock for Amendment</> : <><Lock size={16} /> Finalize & Lock Quarter</>}
          </button>

          <button onClick={handleDownloadPdf} className="btn btn-secondary" title="Official Landscape PDF Return">
            <FileText size={16} /> PDF Return
          </button>

          <button onClick={handleDownloadSchedule1Csv} className="btn btn-secondary" title="Export Schedule 1 CSV">
            <FileSpreadsheet size={16} /> Schedule 1 CSV
          </button>

          <button onClick={handleDownloadStateEFile} className="btn btn-secondary" title="Export State E-File Bulk Upload CSV">
            <Download size={16} /> State E-File CSV
          </button>

          <button
            onClick={handleDownloadAuditZip}
            className="btn btn-secondary"
            style={{ background: '#f8fafc', borderColor: '#3b82f6', color: '#1d4ed8' }}
            title="Download Complete 4-Year IFTA Audit Defense Package ZIP"
          >
            <FileArchive size={16} /> Audit Defense ZIP
          </button>
        </div>
      </div>

      {/* ProMiles Totals Boxes Bar */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '12px'
      }}>
        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Trip Count</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
            {meta?.trip_count || 7}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Miles</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {meta?.total_miles ? meta.total_miles.toLocaleString() : '0'}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Total Fuel</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {meta?.total_fuel ? meta.total_fuel.toLocaleString() : '0'}
          </div>
        </div>

        <div style={{ background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase' }}>Fleet MPG</div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {meta?.fleet_mpg ? meta.fleet_mpg.toFixed(2) : '0.00'}
          </div>
        </div>

        <div style={{ background: '#fee2e2', border: '1px solid #f87171', borderRadius: '8px', padding: '12px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>Total Due</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#b91c1c', marginTop: '2px' }} className="tabular-nums">
            ${meta?.total_due ? meta.total_due.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '0.00'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff',
        padding: '10px 14px',
        borderRadius: '8px',
        border: '1px solid #e2e8f0',
        flexWrap: 'wrap',
        gap: '10px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: '1', minWidth: '240px' }}>
          <Search size={16} color="#94a3b8" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search state (e.g. CA, AR, KY, IL)..."
            style={{ border: 'none', outline: 'none', fontSize: '13px', width: '100%', background: 'transparent' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: '#475569' }}>
            <input
              type="checkbox"
              checked={filterSurchargesOnly}
              onChange={(e) => setFilterSurchargesOnly(e.target.checked)}
            />
            Show Surcharges & Weight Taxes Only
          </label>
        </div>
      </div>

      {/* 17-Column Data Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', whiteSpace: 'nowrap' }}>
            <thead style={{
              background: '#0284c7',
              color: '#ffffff',
              position: 'sticky',
              top: 0,
              zIndex: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <tr>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: '700' }}>State/Prov.</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>All Miles</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Non Toll</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Toll</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Thru Toll</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Permitted</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Off Road</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', background: '#0369a1' }}>Taxable Miles</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>All Gal</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Non-Tax Gal</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700', background: '#0369a1' }}>Tax Paid Gal</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Taxable Gal</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Net Tax Gal</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Tax Rate</th>
                <th style={{ padding: '10px 10px', textAlign: 'right', fontWeight: '700' }}>Interest</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', background: '#0c4a6e' }}>IFTA Tax Due</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: '700', background: '#0c4a6e' }}>Approx. Mile Tax</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="17" style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                    Loading Fleet Fuel Tax Summary...
                  </td>
                </tr>
              ) : filteredRows.map((r, idx) => {
                const isCredit = typeof r.ifta_tax_due === 'number' && r.ifta_tax_due < 0;
                const isSurch = r.is_surcharge_row;
                return (
                  <tr
                    key={idx}
                    onClick={() => setSelectedState(r)}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      background: isSurch ? '#f8fafc' : (idx % 2 === 0 ? '#ffffff' : '#fcfdfe'),
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseLeave={(e) => e.currentTarget.style.background = isSurch ? '#f8fafc' : (idx % 2 === 0 ? '#ffffff' : '#fcfdfe')}
                  >
                    <td style={{ padding: '8px 12px', fontWeight: '700', color: isSurch ? '#0284c7' : '#0f172a' }}>
                      {r.state} {isSurch && <span style={{ fontSize: '10px', fontWeight: '600', color: '#0369a1' }}>(Surcharge)</span>}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.all_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.non_toll_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.toll_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.thruway_toll_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.permitted_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.off_road_miles)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', background: 'rgba(2, 132, 199, 0.05)' }} className="tabular-nums">
                      {formatNumber(r.taxable_miles)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.all_gallons)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.non_tax_paid_gallons)}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '600', background: 'rgba(2, 132, 199, 0.05)' }} className="tabular-nums">
                      {formatNumber(r.tax_paid_gallons)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(r.taxable_gallons)}</td>
                    <td style={{
                      padding: '8px 10px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: typeof r.net_taxable_gallons === 'number' && r.net_taxable_gallons < 0 ? '#059669' : '#0f172a'
                    }} className="tabular-nums">
                      {typeof r.net_taxable_gallons === 'number' && r.net_taxable_gallons < 0
                        ? `(${Math.abs(r.net_taxable_gallons).toLocaleString()})`
                        : formatNumber(r.net_taxable_gallons)}
                    </td>
                    <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>{r.tax_rate}</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{r.interest}</td>
                    <td style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontWeight: '700',
                      background: 'rgba(2, 132, 199, 0.08)',
                      color: isCredit ? '#059669' : '#0f172a'
                    }} className="tabular-nums">
                      {formatCurrency(r.ifta_tax_due)}
                    </td>
                    <td style={{
                      padding: '8px 12px',
                      textAlign: 'right',
                      fontWeight: '600',
                      color: '#0284c7'
                    }} className="tabular-nums">
                      {r.approx_mile_tax_due ? `$${parseFloat(r.approx_mile_tax_due).toFixed(2)}` : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {totals && (
              <tfoot style={{
                background: '#f1f5f9',
                borderTop: '2px solid #0f172a',
                fontWeight: '800',
                position: 'sticky',
                bottom: 0,
                zIndex: 10
              }}>
                <tr>
                  <td style={{ padding: '12px', fontWeight: '800' }}>Totals</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(totals.all_miles)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(totals.non_toll_miles)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.toll_miles}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.thruway_toll_miles}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.permitted_miles}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.off_road_miles}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', background: '#e2e8f0' }} className="tabular-nums">{formatNumber(totals.taxable_miles)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(totals.all_gallons)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.non_tax_paid_gallons}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right', background: '#e2e8f0' }} className="tabular-nums">{formatNumber(totals.tax_paid_gallons)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{formatNumber(totals.taxable_gallons)}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }} className="tabular-nums">{totals.net_taxable_gallons}</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>—</td>
                  <td style={{ padding: '12px 10px', textAlign: 'right' }}>{totals.interest}</td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#0f172a', background: '#e2e8f0' }} className="tabular-nums">
                    ${totals.ifta_tax_due}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', fontSize: '13px', color: '#0284c7' }} className="tabular-nums">
                    ${totals.approx_mile_tax_due}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* State Detail Audit Modal */}
      {selectedState && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(3px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px',
              background: '#0f172a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '700' }}>
                  {selectedState.state} — Calculation Audit
                </h3>
                <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                  Quarter: {quarter} • {selectedState.is_surcharge_row ? 'Heavy Fuel Surcharge Line' : 'Base IFTA Jurisdiction'}
                </p>
              </div>
              <button
                onClick={() => setSelectedState(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Taxable Miles:</span>
                <span style={{ fontWeight: '700' }}>{formatNumber(selectedState.taxable_miles) || 'N/A (Surcharge)'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Fleet MPG Factor:</span>
                <span style={{ fontWeight: '700' }}>{meta?.fleet_mpg || 6.56} MPG</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Taxable Gallons Consumed:</span>
                <span style={{ fontWeight: '700' }}>{formatNumber(selectedState.taxable_gallons)} gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Tax-Paid Gallons Purchased:</span>
                <span style={{ fontWeight: '700' }}>{formatNumber(selectedState.tax_paid_gallons) || '0'} gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Net Taxable Gallons:</span>
                <span style={{ fontWeight: '700' }}>{formatNumber(selectedState.net_taxable_gallons) || selectedState.taxable_gallons} gal</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ color: '#64748b' }}>Applicable Tax Rate:</span>
                <span style={{ fontWeight: '700', fontFamily: 'monospace' }}>${selectedState.tax_rate} / gal</span>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '12px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1e40af',
                fontWeight: '700',
                fontSize: '14px'
              }}>
                <span>Total State Liability:</span>
                <span>{formatCurrency(selectedState.ifta_tax_due)}</span>
              </div>
            </div>

            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'right' }}>
              <button
                onClick={() => setSelectedState(null)}
                className="btn btn-secondary btn-sm"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
