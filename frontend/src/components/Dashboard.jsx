import React, { useEffect, useState } from 'react';
import { api } from '../api';
import {
  Truck, Fuel, Gauge, DollarSign, AlertTriangle, CheckCircle,
  ArrowUpRight, FileDown, Route, UploadCloud, Users, FileSpreadsheet
} from 'lucide-react';

export default function Dashboard({ setActiveTab, quarter, fuelType, user, currentFleetId }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [quarter, fuelType, currentFleetId]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const data = await api.getFleetSummary(quarter, fuelType, currentFleetId);
      setSummary(data);
    } catch (err) {
      console.error('Failed to load dashboard summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const meta = summary?.metadata;
  const warnings = meta?.audit_warnings || [];

  const workflowSteps = [
    { step: '1', title: 'Customer & Units', desc: 'Verify permits & trucks', tab: 'customers', color: '#1B365D', icon: Users },
    { step: '2', title: 'CSV / Mileage Grid', desc: 'Import ELD or enter miles', tab: 'csv-ingestion', color: '#542177', icon: UploadCloud },
    { step: '3', title: 'Fuel & Unit Audit', desc: 'Reconcile receipts & MPG', tab: 'unit-summary', color: '#CE7F20', icon: Truck },
    { step: '4', title: 'Schedule 1 & File', desc: 'Lock quarter & export ZIP', tab: 'summary', color: '#5B6E2C', icon: FileSpreadsheet },
  ];

  // Dynamically compute top corridors from active live summary rows
  const activeRows = (summary?.rows || []).filter(r => (Number(r.all_miles) || 0) > 0);
  const totalAllMiles = meta?.total_miles || activeRows.reduce((acc, r) => acc + (Number(r.all_miles) || 0), 0) || 1;
  const corridorColors = ['#1B365D', '#60C1E5', '#542177', '#73A5CA', '#5B6E2C', '#CE7F20', '#9DBEB8'];

  const dynamicCorridors = activeRows
    .sort((a, b) => (Number(b.all_miles) || 0) - (Number(a.all_miles) || 0))
    .slice(0, 5)
    .map((row, idx) => {
      const miles = Number(row.all_miles) || 0;
      const pct = totalAllMiles > 0 ? Number(((miles / totalAllMiles) * 100).toFixed(1)) : 0;
      return {
        state: `${row.state} - ${row.jurisdiction_name || row.state}`,
        miles,
        pct,
        color: corridorColors[idx % corridorColors.length]
      };
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Hero Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        borderRadius: '14px',
        background: 'linear-gradient(135deg, #1B365D 0%, #28301C 100%)',
        color: '#ffffff',
        boxShadow: '0 6px 20px rgba(27, 54, 93, 0.16)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px', color: '#ffffff' }}>
              Fleet Compliance Overview
            </h2>
            <span style={{
              fontSize: '11px', fontWeight: '700', padding: '2px 10px', borderRadius: '999px',
              background: '#60C1E5', color: '#1B365D'
            }}>
              {quarter}
            </span>
          </div>
          <p style={{ fontSize: '13.5px', color: '#9DBEB8' }}>
            Fuel Type: <strong style={{ color: '#ffffff' }}>{fuelType}</strong> • Account: <strong style={{ color: '#60C1E5' }}>{meta?.ifta_account || user?.ifta_account_number || 'PENDING'}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('trips')}
            className="btn"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', borderColor: '#73A5CA' }}
          >
            <Route size={16} color="#60C1E5" /> Log Trip Corridor
          </button>
          <button
            onClick={() => setActiveTab('fuel')}
            className="btn"
            style={{ background: 'rgba(255,255,255,0.1)', color: '#ffffff', borderColor: '#9DBEB8' }}
          >
            <Fuel size={16} color="#9DBEB8" /> Enter Fuel Receipt
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className="btn btn-accent"
          >
            <FileDown size={16} /> View 17-Col Summary
          </button>
        </div>
      </div>

      {/* Guided 4-Step Filing Workflow */}
      <div className="card" style={{ padding: '16px 20px', background: '#ffffff' }}>
        <div style={{ fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.6px', color: '#556663', marginBottom: '12px' }}>
          Guided Quarterly Filing Workflow
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '12px' }}>
          {workflowSteps.map((w) => {
            const Icon = w.icon;
            return (
              <button
                key={w.step}
                onClick={() => setActiveTab(w.tab)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd8d5',
                  background: '#f8fbfa',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#60C1E5';
                  e.currentTarget.style.background = '#eef6fb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#cbd8d5';
                  e.currentTarget.style.background = '#f8fbfa';
                }}
              >
                <div style={{
                  width: '34px', height: '34px', borderRadius: '8px',
                  background: w.color, color: '#ffffff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontWeight: '800', fontSize: '13px'
                }}>
                  <Icon size={17} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#1B365D' }}>
                    {w.step}. {w.title}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#556663' }}>{w.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px'
      }}>
        {/* Total Miles */}
        <div className="card" style={{ padding: '20px', borderTop: '4px solid #1B365D' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#556663' }}>Total Fleet Miles</span>
            <div style={{ padding: '7px', borderRadius: '8px', background: '#eef6fb', color: '#1B365D' }}>
              <Route size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#1B365D' }} className="tabular-nums">
            {loading ? '...' : (meta?.total_miles ? meta.total_miles.toLocaleString() : '0')}
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#73A5CA', marginLeft: '6px' }}>mi</span>
          </div>
          <div style={{ fontSize: '12px', color: '#5B6E2C', marginTop: '6px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle size={14} /> Reconciled across active units
          </div>
        </div>

        {/* Total Fuel */}
        <div className="card" style={{ padding: '20px', borderTop: '4px solid #5B6E2C' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#556663' }}>Total Tax-Paid Fuel</span>
            <div style={{ padding: '7px', borderRadius: '8px', background: '#eff4e8', color: '#5B6E2C' }}>
              <Fuel size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#28301C' }} className="tabular-nums">
            {loading ? '...' : (meta?.total_fuel ? meta.total_fuel.toLocaleString() : '0')}
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#5B6E2C', marginLeft: '6px' }}>gal</span>
          </div>
          <div style={{ fontSize: '12px', color: '#556663', marginTop: '6px' }}>
            Verified retail pump receipts
          </div>
        </div>

        {/* Fleet MPG */}
        <div className="card" style={{ padding: '20px', borderTop: '4px solid #CE7F20' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#556663' }}>Fleet Average MPG</span>
            <div style={{ padding: '7px', borderRadius: '8px', background: '#fdf4e7', color: '#CE7F20' }}>
              <Gauge size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#28301C' }} className="tabular-nums">
            {loading ? '...' : (meta?.fleet_mpg ? meta.fleet_mpg.toFixed(2) : '0.00')}
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#CE7F20', marginLeft: '6px' }}>MPG</span>
          </div>
          <div style={{ fontSize: '12px', color: '#556663', marginTop: '6px' }}>
            IFTA standard 2-decimal precision
          </div>
        </div>

        {/* Quarterly Balance Due */}
        <div className="card" style={{ padding: '20px', borderTop: '4px solid #930031' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#556663' }}>Quarterly Balance Due</span>
            <div style={{ padding: '7px', borderRadius: '8px', background: '#fbeaf0', color: '#930031' }}>
              <DollarSign size={18} />
            </div>
          </div>
          <div style={{ fontSize: '28px', fontWeight: '800', color: '#930031' }} className="tabular-nums">
            {loading ? '...' : (meta?.total_due != null ? (meta.total_due < 0 ? `-$${Math.abs(meta.total_due).toLocaleString(undefined, { minimumFractionDigits: 2 })} (Credit)` : `$${meta.total_due.toLocaleString(undefined, { minimumFractionDigits: 2 })}`) : '$0.00')}
          </div>
          <div style={{ fontSize: '12px', color: '#556663', marginTop: '6px' }}>
            Includes KY surcharge & weight taxes
          </div>
        </div>
      </div>

      {/* Audit & Anomaly Banner */}
      {warnings.length > 0 ? (
        <div style={{
          padding: '16px 20px',
          borderRadius: '12px',
          background: '#fdf4e7',
          border: '1px solid #CE7F20',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '14px'
        }}>
          <AlertTriangle size={22} color="#CE7F20" style={{ marginTop: '2px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#28301C' }}>
              {warnings.length} Compliance Audit Warning{warnings.length > 1 ? 's' : ''} Detected
            </div>
            <div style={{ fontSize: '13px', color: '#930031', marginTop: '4px', fontWeight: '500' }}>
              {warnings.map((w, idx) => (
                <div key={idx} style={{ marginTop: '2px' }}>• {w.message}</div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setActiveTab('summary')}
            className="btn btn-sm"
            style={{ background: '#CE7F20', color: '#ffffff' }}
          >
            Review Anomaly
          </button>
        </div>
      ) : (
        <div style={{
          padding: '12px 18px',
          borderRadius: '10px',
          background: '#eff4e8',
          border: '1px solid #9DBEB8',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <CheckCircle size={18} color="#5B6E2C" />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#28301C' }}>
            Audit Pre-Check Clean: All route segments connected with zero broken corridors.
          </span>
        </div>
      )}

      {/* Two Column Section: Top Jurisdictions & Fast Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
        gap: '20px'
      }}>
        {/* Top States Breakdown */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1B365D' }}>Top Mileage Corridors</h3>
            <button
              onClick={() => setActiveTab('summary')}
              style={{ fontSize: '13px', color: '#1B365D', background: '#e6f5fb', padding: '4px 10px', borderRadius: '6px', border: '1px solid #73A5CA', fontWeight: '600', cursor: 'pointer' }}
            >
              Full Schedule →
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dynamicCorridors.length > 0 ? (
              dynamicCorridors.map((row, idx) => (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: '600', marginBottom: '4px', color: '#28301C' }}>
                    <span>{row.state}</span>
                    <span className="tabular-nums" style={{ color: '#556663' }}>
                      {row.miles.toLocaleString()} mi ({row.pct}%)
                    </span>
                  </div>
                  <div style={{ height: '7px', background: '#e6efed', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${row.pct}%`,
                      height: '100%',
                      background: row.color,
                      borderRadius: '999px'
                    }} />
                  </div>
                </div>
              ))
            ) : (
              <div style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: '#556663',
                background: '#f8fbfa',
                borderRadius: '8px',
                border: '1px dashed #cbd8d5'
              }}>
                <Route size={26} color="#73A5CA" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1B365D' }}>
                  No Mileage Corridors Recorded
                </div>
                <div style={{ fontSize: '12px', color: '#556663', marginTop: '4px' }}>
                  Log trips or import an ELD CSV to populate quarterly state corridors.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick Operations & System Health */}
        <div className="card" style={{ padding: '20px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1B365D', marginBottom: '16px' }}>
            Quick Operations & Compliance Actions
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { title: 'Live Route Adjacency Validation', desc: 'Check sequential state border crossings and patch route hops.', tab: 'trips', accent: '#1B365D' },
              { title: 'Standalone IFTA Sandbox Calculator', desc: 'Estimate tax balances for custom routes before committing trips.', tab: 'calculator', accent: '#542177' },
              { title: 'Quarterly Tax Rates Directory', desc: 'Explore official tax rates, surcharges, and weight-distance rules.', tab: 'rates', accent: '#5B6E2C' }
            ].map((item, idx) => (
              <div
                key={idx}
                onClick={() => setActiveTab(item.tab)}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #cbd8d5',
                  borderLeft: `4px solid ${item.accent}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background 0.15s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#eef6fb'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div>
                  <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#1B365D' }}>{item.title}</div>
                  <div style={{ fontSize: '12px', color: '#556663' }}>{item.desc}</div>
                </div>
                <ArrowUpRight size={18} color={item.accent} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
