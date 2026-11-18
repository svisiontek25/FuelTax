import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Fuel, Plus, CheckCircle, Receipt, X } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export default function FuelLedger({ quarter, fuelType, currentFleetId }) {
  const [purchases, setPurchases] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New purchase state
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [jurisdiction, setJurisdiction] = useState('AR');
  const [gallons, setGallons] = useState('');
  const [isTaxPaid, setIsTaxPaid] = useState(true);
  const [vendor, setVendor] = useState('Love\'s Travel Stop');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [totalCost, setTotalCost] = useState('');

  useEffect(() => {
    loadData();
  }, [quarter, fuelType, currentFleetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fuelData, vehData] = await Promise.all([
        api.getFuelPurchases(quarter, currentFleetId),
        api.getVehicles(currentFleetId)
      ]);
      setPurchases(fuelData || []);
      setVehicles(vehData || []);
      if (vehData && vehData.length > 0) {
        setSelectedVehicle(vehData[0].id);
      } else {
        setSelectedVehicle('');
      }
    } catch (err) {
      console.error('Failed to load fuel ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFuel = async (e) => {
    e.preventDefault();
    try {
      await api.createFuelPurchase({
        vehicle_id: selectedVehicle || null,
        purchase_date: purchaseDate,
        quarter,
        jurisdiction,
        fuel_type: fuelType,
        gallons: parseFloat(gallons),
        is_tax_paid: isTaxPaid,
        vendor,
        receipt_number: receiptNumber || `REC-${Date.now().toString().slice(-6)}`,
        total_cost: totalCost ? parseFloat(totalCost) : undefined,
      });

      setShowModal(false);
      setGallons('');
      setReceiptNumber('');
      setTotalCost('');
      loadData();
    } catch (err) {
      alert(err.message || 'Failed to record fuel transaction.');
    }
  };

  const totalGallons = purchases.reduce((sum, p) => sum + (p.gallons || 0), 0);
  const totalTaxPaid = purchases.filter((p) => p.is_tax_paid).reduce((sum, p) => sum + (p.gallons || 0), 0);
  const totalSpend = purchases.reduce((sum, p) => sum + (p.total_cost || 0), 0);

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
            Fuel Purchases & Receipt Ledger
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Track retail pump fuel receipts and tax-paid gallons by jurisdiction for audit defense.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary"
        >
          <Plus size={16} /> Enter Fuel Receipt
        </button>
      </div>

      {/* Fuel Summary Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Fuel Recorded</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {totalGallons.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>gal</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Tax-Paid Fuel (Retail Pump)</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }} className="tabular-nums">
            {totalTaxPaid.toLocaleString()} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>gal</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Fuel Receipts Value</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            ${totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>

      {/* Fuel Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Date</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Unit</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>State</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Fuel Type</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Gallons</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Vendor / Location</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Receipt / Invoice</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Total Cost</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading fuel purchases ledger...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No fuel transactions recorded for this quarter.
                  </td>
                </tr>
              ) : purchases.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{p.purchase_date}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>{p.unit_number || 'Fleet Yard'}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563eb' }}>{p.jurisdiction}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>{p.fuel_type}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">
                    {p.gallons.toLocaleString()} gal
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.is_tax_paid ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} /> Tax-Paid
                      </span>
                    ) : (
                      <span className="badge badge-warning">Non-Tax-Paid</span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{p.vendor || 'Pilot / Flying J'}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#64748b' }}>{p.receipt_number || '—'}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }} className="tabular-nums">
                    {p.total_cost ? `$${p.total_cost.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enter Fuel Receipt Modal */}
      {showModal && (
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
            maxWidth: '500px',
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
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Enter Fuel Purchase Receipt</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddFuel} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Power Unit
                  </label>
                  <select
                    value={selectedVehicle}
                    onChange={(e) => setSelectedVehicle(e.target.value)}
                    className="form-input"
                  >
                    <option value="">
                      {vehicles.length > 0 ? `-- Select Power Unit (${vehicles.length} available) --` : '-- No Power Units in Fleet --'}
                    </option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.unit_number} ({v.make}) - {v.fuel_type || 'DIESEL'}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Purchase Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    State Purchased *
                  </label>
                  <select
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                    className="form-input"
                  >
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Gallons Purchased *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={gallons}
                    onChange={(e) => setGallons(e.target.value)}
                    placeholder="e.g. 150.000"
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Vendor Name
                  </label>
                  <input
                    type="text"
                    value={vendor}
                    onChange={(e) => setVendor(e.target.value)}
                    placeholder="Love's, Pilot, TA"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Receipt / Invoice #
                  </label>
                  <input
                    type="text"
                    value={receiptNumber}
                    onChange={(e) => setReceiptNumber(e.target.value)}
                    placeholder="REC-982104"
                    className="form-input font-mono"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Total Dollar Amount ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  placeholder="e.g. 560.50"
                  className="form-input"
                />
              </div>

              <div style={{ padding: '8px 12px', borderRadius: '6px', background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={isTaxPaid}
                    onChange={(e) => setIsTaxPaid(e.target.checked)}
                  />
                  <strong>Tax-Paid Fuel</strong> (State excise taxes paid at retail pump)
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Save Fuel Receipt
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
