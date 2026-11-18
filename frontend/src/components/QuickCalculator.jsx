import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { Calculator, Plus, Trash2, ArrowRight, CheckCircle, RefreshCw } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export default function QuickCalculator({ quarter, fuelType }) {
  const [rows, setRows] = useState([
    { state: 'TX', miles: 1200, gallons: 200 },
    { state: 'AR', miles: 850, gallons: 110 },
    { state: 'TN', miles: 600, gallons: 80 },
    { state: 'KY', miles: 450, gallons: 60 },
  ]);

  const [calculation, setCalculation] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    runEvaluation();
  }, [rows, quarter, fuelType]);

  const runEvaluation = async () => {
    setLoading(true);
    try {
      const payload = {
        quarter,
        fuel_type: fuelType,
        state_data: rows.map((r) => ({
          state: r.state,
          miles: parseFloat(r.miles) || 0,
          gallons: parseFloat(r.gallons) || 0,
        })),
      };
      const res = await api.evaluateQuickCalculator(payload);
      setCalculation(res);
    } catch (err) {
      console.error('Calculation evaluation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = () => {
    setRows([...rows, { state: 'IL', miles: 300, gallons: 50 }]);
  };

  const handleUpdateRow = (idx, field, val) => {
    const copy = [...rows];
    copy[idx] = { ...copy[idx], [field]: val };
    setRows(copy);
  };

  const handleRemoveRow = (idx) => {
    if (rows.length <= 1) return;
    setRows(rows.filter((_, i) => i !== idx));
  };

  const meta = calculation?.metadata;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            IFTA Quick Sandbox Calculator
          </h2>
          <span className="badge badge-info">Zero-Commit Sandbox</span>
        </div>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Estimate fuel taxes and test route scenarios on the fly using official quarterly IFTA rates.
        </p>
      </div>

      {/* Calculated Results Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px'
      }}>
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Estimated Fleet Miles</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {meta?.total_miles ? meta.total_miles.toLocaleString() : '0'} mi
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Fuel Pumped</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {meta?.total_fuel ? meta.total_fuel.toLocaleString() : '0'} gal
          </div>
        </div>

        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Estimated MPG</div>
          <div style={{ fontSize: '22px', fontWeight: '800', color: '#0284c7', marginTop: '4px' }} className="tabular-nums">
            {meta?.fleet_mpg ? meta.fleet_mpg.toFixed(2) : '0.00'} MPG
          </div>
        </div>

        <div className="card" style={{ padding: '16px', background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e40af' }}>Net Estimated Balance</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1d4ed8', marginTop: '2px' }} className="tabular-nums">
            ${meta?.total_due ? meta.total_due.toFixed(2) : '0.00'}
          </div>
        </div>
      </div>

      {/* Interactive Input Grid & Output Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
        gap: '24px'
      }}>
        {/* Left: Input Rows */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>
              Jurisdiction Fuel & Miles Inputs
            </h3>
            <button
              onClick={handleAddRow}
              className="btn btn-secondary btn-sm"
            >
              <Plus size={14} /> Add State
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0'
                }}
              >
                <select
                  value={row.state}
                  onChange={(e) => handleUpdateRow(idx, 'state', e.target.value)}
                  className="form-input"
                  style={{ width: '80px', fontWeight: '700' }}
                >
                  {US_STATES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={row.miles}
                    onChange={(e) => handleUpdateRow(idx, 'miles', e.target.value)}
                    placeholder="Miles"
                    className="form-input"
                    style={{ textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>mi</span>
                </div>

                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    type="number"
                    value={row.gallons}
                    onChange={(e) => handleUpdateRow(idx, 'gallons', e.target.value)}
                    placeholder="Gallons"
                    className="form-input"
                    style={{ textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '11px', color: '#64748b' }}>gal</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveRow(idx)}
                  disabled={rows.length <= 1}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: rows.length <= 1 ? '#cbd5e1' : '#94a3b8',
                    cursor: rows.length <= 1 ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Real-time Evaluation Summary */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '14px' }}>
            Instant Mathematical Breakdown
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', color: '#64748b' }}>
                  <th style={{ padding: '8px 10px' }}>State</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Taxable Gal</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Net Gal</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Rate</th>
                  <th style={{ padding: '8px 10px', textAlign: 'right' }}>Tax Due ($)</th>
                </tr>
              </thead>
              <tbody>
                {calculation?.rows?.map((r, i) => {
                  const isCredit = typeof r.ifta_tax_due === 'number' && r.ifta_tax_due < 0;
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '8px 10px', fontWeight: '700' }}>
                        {r.state} {r.is_surcharge_row && <span style={{ color: '#0284c7' }}>(Surcharge)</span>}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">
                        {r.taxable_gallons}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right' }} className="tabular-nums">
                        {r.net_taxable_gallons !== "" ? r.net_taxable_gallons : '—'}
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'monospace' }}>
                        ${r.tax_rate}
                      </td>
                      <td style={{
                        padding: '8px 10px',
                        textAlign: 'right',
                        fontWeight: '700',
                        color: isCredit ? '#059669' : '#0f172a'
                      }} className="tabular-nums">
                        {r.ifta_tax_due < 0 ? `($${Math.abs(r.ifta_tax_due).toFixed(2)})` : `$${parseFloat(r.ifta_tax_due).toFixed(2)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
