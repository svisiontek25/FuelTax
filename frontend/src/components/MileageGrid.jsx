import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Layers, Plus, Trash2, CheckCircle, Save, Route, FileText } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
];

export default function MileageGrid({ currentFleetId, quarter, onDataLogged }) {
  const [mode, setMode] = useState('quick'); // 'quick' or 'envelope'
  const [vehicles, setVehicles] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);

  // Quick-Add Mode State
  const [quickUnit, setQuickUnit] = useState('');
  const [quickRows, setQuickRows] = useState([
    { jurisdiction: 'TX', total_miles: '', non_taxable_miles: 0, taxable_miles: '', trip_date: new Date().toISOString().split('T')[0] },
  ]);

  // Trip Envelope Mode State (Paper logs)
  const [envelope, setEnvelope] = useState({
    unit_number: '',
    trip_date: new Date().toISOString().split('T')[0],
    origin: '',
    destination: '',
    highways: '',
    start_odometer: '',
    end_odometer: '',
    splits: [
      { jurisdiction: 'TX', total_miles: '', taxable_miles: '' },
    ]
  });

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
      setVehicles(vehData);
      if (vehData.length > 0) {
        if (!quickUnit) setQuickUnit(vehData[0].unit_number);
        if (!envelope.unit_number) setEnvelope(prev => ({ ...prev, unit_number: vehData[0].unit_number }));
      }
      setRecords(recData);
    } catch (err) {
      console.error('Failed to load mileage records:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddQuickRow = () => {
    setQuickRows([...quickRows, { jurisdiction: 'IL', total_miles: 200, non_taxable_miles: 0, taxable_miles: 200, trip_date: '' }]);
  };

  const handleUpdateQuickRow = (idx, field, val) => {
    const copy = [...quickRows];
    copy[idx] = { ...copy[idx], [field]: val };
    // Auto-calculate taxable if total or non_taxable changes
    if (field === 'total_miles' || field === 'non_taxable_miles') {
      const tot = parseFloat(field === 'total_miles' ? val : copy[idx].total_miles) || 0;
      const nonTax = parseFloat(field === 'non_taxable_miles' ? val : copy[idx].non_taxable_miles) || 0;
      copy[idx].taxable_miles = Math.max(0, tot - nonTax);
    }
    setQuickRows(copy);
  };

  const handleRemoveQuickRow = (idx) => {
    if (quickRows.length <= 1) return;
    setQuickRows(quickRows.filter((_, i) => i !== idx));
  };

  const handleSaveQuickRows = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    try {
      const payloadRows = quickRows.map((r) => ({
        unit_number: quickUnit,
        jurisdiction: r.jurisdiction,
        total_miles: parseFloat(r.total_miles) || 0,
        taxable_miles: parseFloat(r.taxable_miles) || 0,
        non_taxable_miles: parseFloat(r.non_taxable_miles) || 0,
        trip_date: r.trip_date || undefined
      }));

      await api.quickAddMileage({
        fleet_id: currentFleetId,
        quarter,
        rows: payloadRows
      });

      setSuccessMsg(`Successfully saved ${payloadRows.length} mileage records for ${quickUnit}!`);
      loadData();
      if (onDataLogged) onDataLogged();
    } catch (err) {
      alert(err.message || 'Failed to save mileage rows.');
    }
  };

  const handleSaveEnvelope = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);

    // Validate odometer vs splits
    const odoDiff = envelope.end_odometer - envelope.start_odometer;
    const splitSum = envelope.splits.reduce((s, r) => s + (parseFloat(r.total_miles) || 0), 0);

    if (Math.abs(odoDiff - splitSum) > 5) {
      if (!window.confirm(`Notice: Odometer difference (${odoDiff} mi) does not exactly match split total (${splitSum} mi). Proceed anyway?`)) {
        return;
      }
    }

    try {
      const payloadRows = envelope.splits.map((s) => ({
        unit_number: envelope.unit_number,
        jurisdiction: s.jurisdiction,
        total_miles: parseFloat(s.total_miles) || 0,
        taxable_miles: parseFloat(s.taxable_miles) || 0,
        trip_date: envelope.trip_date,
        start_odometer: envelope.start_odometer,
        end_odometer: envelope.end_odometer
      }));

      await api.quickAddMileage({
        fleet_id: currentFleetId,
        quarter,
        rows: payloadRows
      });

      setSuccessMsg(`Trip envelope saved: ${splitSum} miles logged across ${envelope.splits.length} states.`);
      loadData();
      if (onDataLogged) onDataLogged();
    } catch (err) {
      alert(err.message || 'Failed to save trip envelope.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
          Spreadsheet-Style Mileage Grid Entry
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Rapidly enter driver state mileage splits using Quick-Add or Driver Trip Envelope Mode.
        </p>
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
          onClick={() => setMode('quick')}
          className={`btn ${mode === 'quick' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Layers size={16} /> Quick-Add Mode (Unit + State Rows)
        </button>
        <button
          type="button"
          onClick={() => setMode('envelope')}
          className={`btn ${mode === 'envelope' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <FileText size={16} /> Trip Envelope Mode (Paper Log Splitter)
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

      {/* Mode 1: Quick-Add Spreadsheet Grid */}
      {mode === 'quick' && (
        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleSaveQuickRows} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ minWidth: '220px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Target Power Unit *
                </label>
                <select
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value)}
                  className="form-input"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.unit_number}>{v.unit_number} ({v.make})</option>
                  ))}
                </select>
              </div>

              <div style={{ fontSize: '13px', color: '#64748b', marginTop: '18px' }}>
                Total Miles in Batch: <strong>{quickRows.reduce((s, r) => s + (parseFloat(r.total_miles) || 0), 0)} mi</strong>
              </div>
            </div>

            {/* Grid Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {quickRows.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
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
                    style={{ width: '80px', fontWeight: '700' }}
                  >
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>

                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={row.total_miles}
                      onChange={(e) => handleUpdateQuickRow(idx, 'total_miles', e.target.value)}
                      placeholder="Total Miles"
                      className="form-input"
                      style={{ textAlign: 'right' }}
                      required
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={row.non_taxable_miles}
                      onChange={(e) => handleUpdateQuickRow(idx, 'non_taxable_miles', e.target.value)}
                      placeholder="Non-Taxable (Off-road)"
                      className="form-input"
                      style={{ textAlign: 'right' }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <input
                      type="number"
                      value={row.taxable_miles}
                      readOnly
                      placeholder="Taxable Miles"
                      className="form-input"
                      style={{ textAlign: 'right', background: '#f1f5f9', fontWeight: '700' }}
                    />
                  </div>

                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      value={row.trip_date}
                      onChange={(e) => handleUpdateQuickRow(idx, 'trip_date', e.target.value)}
                      className="form-input"
                    />
                  </div>

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
                <Save size={16} /> Save Mileage Batch to Fleet
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Mode 2: Trip Envelope Mode */}
      {mode === 'envelope' && (
        <div className="card" style={{ padding: '24px' }}>
          <form onSubmit={handleSaveEnvelope} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Unit Number *
                </label>
                <select
                  value={envelope.unit_number}
                  onChange={(e) => setEnvelope({ ...envelope, unit_number: e.target.value })}
                  className="form-input"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.unit_number}>{v.unit_number}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Trip Date *
                </label>
                <input
                  type="date"
                  value={envelope.trip_date}
                  onChange={(e) => setEnvelope({ ...envelope, trip_date: e.target.value })}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Start Odometer
                </label>
                <input
                  type="number"
                  value={envelope.start_odometer}
                  onChange={(e) => setEnvelope({ ...envelope, start_odometer: parseInt(e.target.value, 10) || 0 })}
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  End Odometer
                </label>
                <input
                  type="number"
                  value={envelope.end_odometer}
                  onChange={(e) => setEnvelope({ ...envelope, end_odometer: parseInt(e.target.value, 10) || 0 })}
                  className="form-input"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Origin & Destination
                </label>
                <input
                  type="text"
                  value={`${envelope.origin} -> ${envelope.destination}`}
                  onChange={(e) => {}}
                  className="form-input"
                  placeholder="Dallas, TX -> Chicago, IL"
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Highways / Corridors
                </label>
                <input
                  type="text"
                  value={envelope.highways}
                  onChange={(e) => setEnvelope({ ...envelope, highways: e.target.value })}
                  className="form-input"
                  placeholder="I-30 E, I-55 N"
                />
              </div>
            </div>

            <div style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginTop: '6px' }}>
              State Mileage Splits (Hub distance: {envelope.end_odometer - envelope.start_odometer} mi)
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
              {envelope.splits.map((s, idx) => (
                <div key={idx} style={{ padding: '10px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontWeight: '700' }}>
                    <span>{s.jurisdiction}</span>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>Leg #{idx + 1}</span>
                  </div>
                  <input
                    type="number"
                    value={s.total_miles}
                    onChange={(e) => {
                      const copy = [...envelope.splits];
                      copy[idx].total_miles = parseFloat(e.target.value) || 0;
                      copy[idx].taxable_miles = parseFloat(e.target.value) || 0;
                      setEnvelope({ ...envelope, splits: copy });
                    }}
                    placeholder="Miles"
                    className="form-input"
                    style={{ textAlign: 'right', fontWeight: '700' }}
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '12px' }}
            >
              <Save size={16} /> Save Trip Envelope
            </button>
          </form>
        </div>
      )}

      {/* Raw Mileage Records Table */}
      <div className="card" style={{ padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
          Quarterly Mileage Ledger for {quarter} ({records.length} records)
        </h3>

        <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '8px 10px' }}>Unit #</th>
                <th style={{ padding: '8px 10px' }}>State</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Total Miles</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Miles</th>
                <th style={{ padding: '8px 10px', textAlign: 'right' }}>Non-Taxable</th>
                <th style={{ padding: '8px 10px' }}>Trip Date</th>
                <th style={{ padding: '8px 10px' }}>Odometer Range</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '8px 10px', fontWeight: '700' }}>{r.unit_number}</td>
                  <td style={{ padding: '8px 10px', fontWeight: '700', color: '#2563eb' }}>{r.jurisdiction}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.total_miles.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">{r.taxable_miles.toLocaleString()}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">{r.non_taxable_miles}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>{r.trip_date || '—'}</td>
                  <td style={{ padding: '8px 10px', color: '#64748b' }}>
                    {r.start_odometer && r.end_odometer ? `${r.start_odometer} - ${r.end_odometer}` : '—'}
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
