import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Truck, Download, AlertTriangle, CheckCircle } from 'lucide-react';

export default function UnitSummaryReport({ currentFleetId, quarter, fuelType }) {
  const [audit, setAudit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAudit();
  }, [currentFleetId, quarter, fuelType]);

  const loadAudit = async () => {
    setLoading(true);
    try {
      const data = await api.getComplianceAudit(quarter, fuelType, currentFleetId);
      setAudit(data);
    } catch (err) {
      console.error('Failed to load unit summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const url = api.exportUnitSummaryCsvUrl(quarter, fuelType, currentFleetId);
      await api.downloadFile(url, `Vehicle_Unit_Summary_${quarter}.csv`);
    } catch (err) {
      console.error('Download failed:', err);
      // Fallback
      window.open(api.exportUnitSummaryCsvUrl(quarter, fuelType, currentFleetId), '_blank');
    }
  };

  const units = audit?.unit_breakdown || [];

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
          <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
            Vehicle-Level Unit Summary Report
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Individual truck mileage, fuel consumption, and individual unit MPG for cost accounting and maintenance.
          </p>
        </div>

        <button
          onClick={handleExportCsv}
          className="btn btn-secondary"
        >
          <Download size={16} /> Export Unit Summary CSV
        </button>
      </div>

      {/* Unit Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Power Unit #</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>Miles Logged</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>Fuel Pumped (gal)</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }}>Average MPG</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Compliance Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading vehicle summary breakdown...
                  </td>
                </tr>
              ) : units.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No vehicle records found for this quarter.
                  </td>
                </tr>
              ) : units.map((u, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={16} color="#2563eb" />
                      <span>{u.unit_number}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }} className="tabular-nums">
                    {u.miles.toLocaleString()} mi
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }} className="tabular-nums">
                    {u.gallons.toLocaleString()} gal
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '800', color: u.has_anomaly ? '#d97706' : '#0284c7' }} className="tabular-nums">
                    {u.mpg.toFixed(2)} MPG
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {u.has_anomaly ? (
                      <span className="badge badge-warning">
                        <AlertTriangle size={12} /> MPG Anomaly ({u.mpg < 4.0 ? 'Low' : 'High'})
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <CheckCircle size={12} /> Within Bounds (4.0 - 10.0)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {units.length > 0 && (
              <tfoot style={{ background: '#f8fafc', borderTop: '2px solid #0f172a', fontWeight: '800' }}>
                <tr>
                  <td style={{ padding: '12px 16px' }}>Fleet Aggregate</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }} className="tabular-nums">
                    {units.reduce((s, u) => s + u.miles, 0).toLocaleString()} mi
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }} className="tabular-nums">
                    {units.reduce((s, u) => s + u.gallons, 0).toLocaleString()} gal
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', color: '#0284c7' }} className="tabular-nums">
                    {audit?.fleet_mpg ? audit.fleet_mpg.toFixed(2) : '0.00'} MPG
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-info">Fleet Pool</span>
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
