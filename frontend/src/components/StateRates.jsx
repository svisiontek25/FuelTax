import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Globe, Search, RefreshCw, Edit, CheckCircle, Upload, Download, Link, AlertCircle, X } from 'lucide-react';

const STATE_NAMES = {
  AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  ON: 'Ontario (Canada)', QC: 'Quebec (Canada)', AB: 'Alberta (Canada)',
  BC: 'British Columbia (Canada)', MB: 'Manitoba (Canada)', SK: 'Saskatchewan (Canada)',
  NB: 'New Brunswick (Canada)', NL: 'Newfoundland & Labrador (Canada)',
  NS: 'Nova Scotia (Canada)', PE: 'Prince Edward Island (Canada)'
};

const SPECIAL_NOTES = {
  KY: 'Imposes an additional Heavy Equipment Surcharge ($0.1050/gal) on total fuel consumed, plus Kentucky KYU Weight-Distance Tax ($0.0285/mi) for vehicles >= 60,000 lbs.',
  NM: 'New Mexico Weight-Distance Tax (WDT) schedule applies to registered gross vehicle weight (approx. $0.04378/mi at 80,000 lbs).',
  NY: 'New York Highway Use Tax (NY HUT) applies based on gross truck weight ($0.0150/mi baseline).',
  OR: 'Oregon exempts diesel fuel from state excise tax at the pump; commercial carriers pay the Oregon Weight-Mile Tax (OR WMT) instead ($0.0650/mi).',
  CA: 'Highest base diesel tax rate ($0.9710/gal) under California SB-1 excise schedule.',
  IN: 'Special fuel tax includes motor carrier surcharge components updated semi-annually.'
};

export default function StateRates({ quarter }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusMsg, setStatusMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [editRow, setEditRow] = useState(null);

  // Upload CSV/Excel & External API Sync Controls
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [matrixFile, setMatrixFile] = useState(null);
  const [externalApiUrl, setExternalApiUrl] = useState('');
  const [customEffectiveDate, setCustomEffectiveDate] = useState('2026-01-01');

  useEffect(() => {
    loadRates();
  }, [quarter]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await api.getTaxRates(quarter);
      setRates(data || []);
    } catch (err) {
      console.error('Failed to load tax rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMatrix = async () => {
    setRefreshing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.refreshTaxRates(quarter, false);
      setStatusMsg(`${res.message} (Version: ${res.version} • Effective Date: ${res.effective_date})`);
      await loadRates();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to refresh rate matrix.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportTemplateCsv = async () => {
    try {
      const url = api.exportRatesCsvUrl(quarter);
      await api.downloadFile(url, `IFTA_58_Rates_Matrix_${quarter}.csv`);
    } catch (err) {
      window.open(api.exportRatesCsvUrl(quarter), '_blank');
    }
  };

  const handleUploadMatrixFile = async (e) => {
    e.preventDefault();
    if (!matrixFile) {
      setErrorMsg('Please select a .csv, .xlsx, or .xls rate matrix file first.');
      return;
    }
    setRefreshing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', matrixFile);
      formData.append('quarter', quarter);
      formData.append('effective_date', customEffectiveDate);
      const res = await api.uploadRatesMatrixFile(formData);
      setStatusMsg(res.message);
      setMatrixFile(null);
      await loadRates();
    } catch (err) {
      setErrorMsg(err.message || 'Rate matrix file upload failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncExternalApi = async (e) => {
    e.preventDefault();
    if (!externalApiUrl.trim()) {
      setErrorMsg('Please enter an external JSON or CSV API URL.');
      return;
    }
    setRefreshing(true);
    setStatusMsg(null);
    setErrorMsg(null);
    try {
      const res = await api.syncExternalRatesApi({
        api_url: externalApiUrl.trim(),
        quarter,
        effective_date: customEffectiveDate
      });
      setStatusMsg(res.message);
      await loadRates();
    } catch (err) {
      setErrorMsg(err.message || 'External API sync failed.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveRateEdit = async (e) => {
    e.preventDefault();
    if (!editRow) return;
    try {
      const res = await api.updateTaxRate(editRow.jurisdiction, {
        quarter,
        tax_rate: parseFloat(editRow.tax_rate) || 0,
        surcharge_rate: parseFloat(editRow.surcharge_rate) || 0,
        weight_mile_rate: parseFloat(editRow.weight_mile_rate) || 0,
        effective_date: editRow.effective_date
      });
      setStatusMsg(`Updated ${res.jurisdiction} rate to $${res.tax_rate.toFixed(4)}/gal. Dependent IFTA calculations updated.`);
      setEditRow(null);
      loadRates();
    } catch (err) {
      alert(err.message || 'Failed to update jurisdiction rate.');
    }
  };

  const filteredRates = rates.filter((r) => {
    const term = search.toLowerCase();
    const name = (STATE_NAMES[r.jurisdiction] || '').toLowerCase();
    return r.jurisdiction.toLowerCase().includes(term) || name.includes(term);
  });

  const sampleMeta = rates[0] || {};
  const effectiveDate = sampleMeta.effective_date || `${quarter.split('-')[0]}-01-01`;
  const matrixVersion = sampleMeta.version || `v${quarter} (IFTA Inc. Official Matrix)`;
  const lastUpdated = sampleMeta.updated_at || '2026-01-01 00:00:00';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Official IFTA 58-Jurisdiction Tax Rates Matrix
            </h2>
            <span className="badge badge-success">58 Member Jurisdictions (Diesel)</span>
            <span className="badge badge-info">Effective: {effectiveDate}</span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b', marginTop: '3px' }}>
            Period: <strong>{quarter}</strong> • Version: <strong>{matrixVersion}</strong> • Last Synced: <strong>{lastUpdated}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportTemplateCsv}
            className="btn btn-secondary"
            style={{ borderColor: '#1B365D', color: '#1B365D', fontWeight: '700' }}
          >
            <Download size={15} /> Export 58 Rate Matrix CSV
          </button>

          <button
            type="button"
            onClick={() => setShowImportPanel(!showImportPanel)}
            className="btn btn-secondary"
            style={{ borderColor: '#0284c7', color: '#0284c7', fontWeight: '700' }}
          >
            <Upload size={15} /> {showImportPanel ? 'Hide CSV / API Updater' : 'Upload IFTA CSV/Excel or Connect API'}
          </button>

          <button
            type="button"
            onClick={handleRefreshMatrix}
            disabled={refreshing}
            className="btn btn-primary"
          >
            <RefreshCw size={15} /> {refreshing ? 'Syncing...' : 'Refresh / Verify Matrix'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          <span>{statusMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Upload Official IFTA CSV/Excel OR Connect External API Panel */}
      {showImportPanel && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '16px' }}>
          {/* Left: Upload CSV / Excel Sheet */}
          <div className="card" style={{ padding: '20px', borderLeft: '4px solid #0284c7' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1B365D', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Upload size={16} color="#0284c7" /> Option 1: Upload Official IFTA CSV / Excel Sheet
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Upload a `.csv`, `.xlsx`, or `.xls` spreadsheet containing columns: <code>Jurisdiction, Base Diesel Rate, Surcharge Rate, Weight-Distance Rate</code>.
            </p>
            <form onSubmit={handleUploadMatrixFile} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '10px', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Select Rate Matrix File (.csv, .xlsx, .xls)
                  </label>
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={(e) => setMatrixFile(e.target.files?.[0] || null)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                    Effective Date
                  </label>
                  <input
                    type="date"
                    value={customEffectiveDate}
                    onChange={(e) => setCustomEffectiveDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>
              <button type="submit" disabled={refreshing || !matrixFile} className="btn btn-primary btn-sm" style={{ width: 'fit-content' }}>
                <Upload size={14} /> Upload & Apply Rate Matrix to {quarter}
              </button>
            </form>
          </div>

          {/* Right: Connect External JSON / CSV API URL */}
          <div className="card" style={{ padding: '20px', borderLeft: '4px solid #5B6E2C' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#1B365D', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Link size={16} color="#5B6E2C" /> Option 2: Connect External Rate API / Feed URL
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginBottom: '12px' }}>
              Enter an external HTTP/HTTPS JSON or CSV endpoint returning IFTA jurisdiction tax rates to automatically sync all 58 jurisdictions.
            </p>
            <form onSubmit={handleSyncExternalApi} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>
                  External API Endpoint URL (JSON or CSV)
                </label>
                <input
                  type="url"
                  value={externalApiUrl}
                  onChange={(e) => setExternalApiUrl(e.target.value)}
                  placeholder="https://api.your-provider.com/ifta/rates/2026-Q1.json"
                  className="form-input font-mono"
                />
              </div>
              <button type="submit" disabled={refreshing || !externalApiUrl.trim()} className="btn btn-primary btn-sm" style={{ width: 'fit-content', background: '#5B6E2C' }}>
                <RefreshCw size={14} /> Fetch & Sync from External API
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Search Input Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by jurisdiction code or state/province name (e.g. Kentucky, CA, Texas, Ontario)..."
          style={{ border: 'none', outline: 'none', fontSize: '14px', width: '100%', background: 'transparent' }}
        />
      </div>

      {/* Rates Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Code</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>State / Province Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Base Diesel Rate ($/gal)</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Surcharge Rate</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Weight-Distance Rate</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Effective Date</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Regulatory Compliance Notes</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Update</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading tax rates directory...
                  </td>
                </tr>
              ) : filteredRates.map((r) => {
                const note = SPECIAL_NOTES[r.jurisdiction];
                const hasSurcharge = r.surcharge_rate > 0;
                const hasWeightMile = r.weight_mile_rate > 0;
                return (
                  <tr key={r.jurisdiction} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '11px 16px', fontWeight: '800', color: '#2563eb' }}>
                      {r.jurisdiction}
                    </td>
                    <td style={{ padding: '11px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {STATE_NAMES[r.jurisdiction] || r.jurisdiction}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>
                      ${Number(r.tax_rate || 0).toFixed(4)}
                    </td>
                    <td style={{
                      padding: '11px 16px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: hasSurcharge ? '700' : '400',
                      color: hasSurcharge ? '#d97706' : '#64748b'
                    }}>
                      {hasSurcharge ? `$${Number(r.surcharge_rate).toFixed(4)}` : '—'}
                    </td>
                    <td style={{
                      padding: '11px 16px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: hasWeightMile ? '700' : '400',
                      color: hasWeightMile ? '#0284c7' : '#64748b'
                    }}>
                      {hasWeightMile ? `$${Number(r.weight_mile_rate).toFixed(5)}/mi` : '—'}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: '12px', color: '#475569' }}>
                      {r.effective_date || effectiveDate}
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: '12px', color: note ? '#334155' : '#94a3b8' }}>
                      {note || 'Standard IFTA Diesel reciprocity applies.'}
                    </td>
                    <td style={{ padding: '11px 16px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => setEditRow({ ...r })}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 8px', fontSize: '11.5px' }}
                      >
                        <Edit size={12} /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Rate Modal */}
      {editRow && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px'
        }}>
          <div style={{ background: '#ffffff', borderRadius: '12px', maxWidth: '460px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ padding: '16px 20px', background: '#1B365D', color: '#ffffff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0 }}>
                Update {editRow.jurisdiction} ({STATE_NAMES[editRow.jurisdiction]}) Rate — {quarter}
              </h3>
              <button onClick={() => setEditRow(null)} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSaveRateEdit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Base IFTA Diesel Rate ($/gal) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  required
                  value={editRow.tax_rate}
                  onChange={(e) => setEditRow({ ...editRow, tax_rate: e.target.value })}
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Surcharge Rate ($/gal)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={editRow.surcharge_rate}
                  onChange={(e) => setEditRow({ ...editRow, surcharge_rate: e.target.value })}
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Weight-Distance Mile Rate ($/mi)
                </label>
                <input
                  type="number"
                  step="0.00001"
                  value={editRow.weight_mile_rate}
                  onChange={(e) => setEditRow({ ...editRow, weight_mile_rate: e.target.value })}
                  className="form-input font-mono"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Effective Date
                </label>
                <input
                  type="date"
                  value={editRow.effective_date || effectiveDate}
                  onChange={(e) => setEditRow({ ...editRow, effective_date: e.target.value })}
                  className="form-input"
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button type="button" onClick={() => setEditRow(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Rate Update</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
