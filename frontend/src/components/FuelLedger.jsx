import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Fuel, Plus, CheckCircle, Download, AlertCircle, X } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','DC','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
];

export default function FuelLedger({ quarter, currentFleetId }) {
  const [purchases, setPurchases] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // Module 5A: Manual Fuel Purchase Entry State
  const [unitNumber, setUnitNumber] = useState('Unit 101');
  const [purchaseDate, setPurchaseDate] = useState('2026-01-15');
  const [jurisdiction, setJurisdiction] = useState('AR');
  const [gallons, setGallons] = useState('');
  const [isTaxPaid, setIsTaxPaid] = useState(true);
  const [vendor, setVendor] = useState('Retail Pump');
  const [receiptNumber, setReceiptNumber] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, [quarter, currentFleetId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fuelData, vehData] = await Promise.all([
        api.getFuelPurchases(quarter, currentFleetId),
        api.getVehicles(currentFleetId)
      ]);
      setPurchases(fuelData || []);
      setVehicles(vehData || []);
      if (vehData && vehData.length > 0 && !unitNumber) {
        setUnitNumber(vehData[0].unit_number);
      }
    } catch (err) {
      console.error('Failed to load fuel ledger:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddFuel = async (e) => {
    e.preventDefault();
    setSuccessMsg(null);
    setErrorMsg(null);

    const qty = parseFloat(gallons);
    if (!unitNumber.trim()) {
      setErrorMsg('Unit Number is required.');
      return;
    }
    if (isNaN(qty) || qty <= 0) {
      setErrorMsg('Fuel Quantity (Gallons) must be greater than 0.');
      return;
    }

    try {
      await api.createFuelPurchase({
        unit_number: unitNumber.trim(),
        purchase_date: purchaseDate,
        quarter,
        jurisdiction,
        fuel_type: 'Diesel',
        gallons: qty,
        is_tax_paid: isTaxPaid,
        vendor: vendor || 'Retail Pump',
        receipt_number: receiptNumber || undefined,
        total_cost: totalCost ? parseFloat(totalCost) : undefined,
      }, currentFleetId);

      setShowModal(false);
      setGallons('');
      setReceiptNumber('');
      setTotalCost('');
      setSuccessMsg(`Fuel purchase logged: ${unitNumber} — ${qty} gal in ${jurisdiction} on ${purchaseDate}.`);
      loadData();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to record fuel transaction.');
    }
  };

  // Module 3: Export Fuel Purchase CSV containing ONLY the 4 columns:
  // Unit Number, State, Quantity, Transaction Date
  const handleExportFuelCsv = async () => {
    try {
      const url = api.exportFuelCsvUrl(quarter, currentFleetId);
      await api.downloadFile(url, `Fuel_Purchases_${quarter}.csv`);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to export Fuel Purchases CSV.');
    }
  };

  const totalGallons = purchases.reduce((sum, p) => sum + (Number(p.gallons) || 0), 0);
  const totalTaxPaid = purchases.filter((p) => p.is_tax_paid).reduce((sum, p) => sum + (Number(p.gallons) || 0), 0);

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
            Fuel Purchases & Manual Receipt Ledger (Diesel)
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Enter fuel purchases manually or export the 4-column Fuel Purchase CSV (Unit Number, State, Quantity, Transaction Date).
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleExportFuelCsv}
            className="btn btn-secondary"
            style={{ borderColor: '#1B365D', color: '#1B365D', fontWeight: '700' }}
          >
            <Download size={16} /> Export Fuel Purchases CSV (4-Column)
          </button>

          <button
            type="button"
            onClick={() => { setShowModal(true); setErrorMsg(null); }}
            className="btn btn-primary"
          >
            <Plus size={16} /> Manual Fuel Entry Modal
          </button>
        </div>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Module 5A: Inline Quick Manual Fuel Entry Card */}
      <div className="card" style={{ padding: '20px' }}>
        <div style={{ fontSize: '14px', fontWeight: '800', color: '#1B365D', marginBottom: '12px' }}>
          Quick Manual Fuel Purchase Entry
        </div>
        <form onSubmit={handleAddFuel} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
              1. Unit Number *
            </label>
            <input
              type="text"
              list="fuel-units-list"
              required
              value={unitNumber}
              onChange={(e) => setUnitNumber(e.target.value)}
              placeholder="e.g. Unit 101"
              className="form-input"
            />
            <datalist id="fuel-units-list">
              {vehicles.map((v) => (
                <option key={v.id} value={v.unit_number}>{v.make} {v.model}</option>
              ))}
            </datalist>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
              2. State *
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
              3. Quantity (Gallons) *
            </label>
            <input
              type="number"
              step="0.001"
              required
              value={gallons}
              onChange={(e) => setGallons(e.target.value)}
              placeholder="e.g. 130.5"
              className="form-input"
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
              4. Transaction Date *
            </label>
            <input
              type="date"
              required
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              className="form-input"
            />
          </div>

          <div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              <Plus size={16} /> Add Fuel Record
            </button>
          </div>
        </form>
      </div>

      {/* Fuel Summary Strip */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px'
      }}>
        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Diesel Fuel Recorded</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginTop: '4px' }} className="tabular-nums">
            {totalGallons.toLocaleString(undefined, { maximumFractionDigits: 3 })} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>gal</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Tax-Paid Fuel (Retail Pump)</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#16a34a', marginTop: '4px' }} className="tabular-nums">
            {totalTaxPaid.toLocaleString(undefined, { maximumFractionDigits: 3 })} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>gal</span>
          </div>
        </div>

        <div className="card" style={{ padding: '16px 20px' }}>
          <div style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>Total Transactions ({quarter})</div>
          <div style={{ fontSize: '24px', fontWeight: '800', color: '#1B365D', marginTop: '4px' }} className="tabular-nums">
            {purchases.length} <span style={{ fontSize: '13px', fontWeight: '500', color: '#64748b' }}>records</span>
          </div>
        </div>
      </div>

      {/* Fuel Table (Aligned with Module 3: Unit Number, State, Quantity, Transaction Date) */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Unit Number</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>State</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Quantity (Gal)</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Transaction Date</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Fuel Type</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Tax Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading fuel purchases ledger...
                  </td>
                </tr>
              ) : purchases.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No fuel transactions recorded for this quarter.
                  </td>
                </tr>
              ) : purchases.map((p) => (
                <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>{p.unit_number}</td>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#2563eb' }}>{p.jurisdiction}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700' }} className="tabular-nums">
                    {Number(p.gallons || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>{p.transaction_date || p.purchase_date}</td>
                  <td style={{ padding: '12px 16px', color: '#64748b' }}>DIESEL</td>
                  <td style={{ padding: '12px 16px' }}>
                    {p.is_tax_paid ? (
                      <span className="badge badge-success">
                        <CheckCircle size={12} /> Tax-Paid
                      </span>
                    ) : (
                      <span className="badge badge-warning">Non-Tax-Paid</span>
                    )}
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
            maxWidth: '480px',
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
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Manual Fuel Purchase Entry</h3>
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
                    Unit Number *
                  </label>
                  <input
                    type="text"
                    list="fuel-units-list"
                    required
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Transaction Date *
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
                    State *
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
                    Quantity (Gallons) *
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={gallons}
                    onChange={(e) => setGallons(e.target.value)}
                    placeholder="e.g. 150.0"
                    className="form-input"
                  />
                </div>
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
                  Save Fuel Purchase
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
