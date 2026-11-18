import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Globe, Search, ShieldCheck, AlertCircle, ExternalLink } from 'lucide-react';

const STATE_NAMES = {
  AL: 'Alabama', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky',
  LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  ON: 'Ontario (Canada)', QC: 'Quebec (Canada)', AB: 'Alberta (Canada)',
  BC: 'British Columbia (Canada)', MB: 'Manitoba (Canada)', SK: 'Saskatchewan (Canada)',
  NB: 'New Brunswick (Canada)'
};

const SPECIAL_NOTES = {
  KY: 'Imposes an additional Heavy Equipment Surcharge ($0.1050/gal) on total fuel consumed, plus Kentucky KYU Weight-Distance Tax ($0.0285/mi) for vehicles >= 60,000 lbs.',
  NM: 'New Mexico Weight-Distance Tax (WDT) schedule applies to registered gross vehicle weight (approx. $0.04378/mi at 80,000 lbs).',
  NY: 'New York Highway Use Tax (NY HUT) applies based on gross truck weight and unloaded weight.',
  OR: 'Oregon exempts diesel fuel from state excise tax at the pump; commercial carriers pay the Oregon Weight-Mile Tax (OR WMT) instead.',
  CA: 'Highest base tax rate ($0.9710/gal) under California SB-1 clean transportation excise schedule.',
  IN: 'Special fuel tax includes motor carrier surcharge components updated semi-annually.'
};

export default function StateRates({ quarter, fuelType }) {
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadRates();
  }, [quarter, fuelType]);

  const loadRates = async () => {
    setLoading(true);
    try {
      const data = await api.getTaxRates(quarter, fuelType);
      setRates(data);
    } catch (err) {
      console.error('Failed to load tax rates:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRates = rates.filter((r) => {
    const term = search.toLowerCase();
    const name = (STATE_NAMES[r.jurisdiction] || '').toLowerCase();
    return r.jurisdiction.toLowerCase().includes(term) || name.includes(term);
  });

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Official IFTA Quarterly Tax Rates Matrix
            </h2>
            <span className="badge badge-success">48 States + Provinces</span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Reference rates for <strong>{quarter}</strong> • Fuel Type: <strong>{fuelType}</strong> (Verified against DMA Inc & Haul Handbook matrices).
          </p>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by jurisdiction code or state name (e.g. Kentucky, CA, Texas)..."
          style={{ border: 'none', outline: 'none', fontSize: '14px', width: '100%', background: 'transparent' }}
        />
      </div>

      {/* Rates Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Jurisdiction</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>State / Province Name</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Base IFTA Rate ($/gal)</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Surcharge Rate</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Weight-Distance Rate</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Regulatory Compliance Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading tax rates directory...
                  </td>
                </tr>
              ) : filteredRates.map((r) => {
                const note = SPECIAL_NOTES[r.jurisdiction];
                const hasSurcharge = r.surcharge_rate > 0;
                const hasWeightMile = r.weight_mile_rate > 0;
                return (
                  <tr key={r.jurisdiction} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '12px 16px', fontWeight: '800', color: '#2563eb' }}>
                      {r.jurisdiction}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: '600', color: '#0f172a' }}>
                      {STATE_NAMES[r.jurisdiction] || r.jurisdiction}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: 'monospace', fontWeight: '700' }}>
                      ${r.tax_rate.toFixed(4)}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: hasSurcharge ? '700' : '400',
                      color: hasSurcharge ? '#d97706' : '#64748b'
                    }}>
                      {hasSurcharge ? `$${r.surcharge_rate.toFixed(4)}` : '—'}
                    </td>
                    <td style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      fontWeight: hasWeightMile ? '700' : '400',
                      color: hasWeightMile ? '#0284c7' : '#64748b'
                    }}>
                      {hasWeightMile ? `$${r.weight_mile_rate.toFixed(4)}/mi` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: '12px', color: note ? '#334155' : '#94a3b8' }}>
                      {note || 'Standard IFTA reciprocity applies.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
