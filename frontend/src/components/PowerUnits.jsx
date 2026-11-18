import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Truck, Plus, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function PowerUnits({ currentFleetId }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState(null);

  // New vehicle form
  const [unitNumber, setUnitNumber] = useState('');
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('Freightliner');
  const [model, setModel] = useState('Cascadia');
  const [modelYear, setModelYear] = useState(2024);
  const [fuelType, setFuelType] = useState('Diesel');
  const [gvw, setGvw] = useState(80000);
  const [axles, setAxles] = useState(5);

  useEffect(() => {
    loadVehicles();
  }, [currentFleetId]);

  const loadVehicles = async () => {
    setLoading(true);
    try {
      const data = await api.getVehicles(currentFleetId);
      setVehicles(data || []);
    } catch (err) {
      console.error('Failed to load vehicles:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e) => {
    e.preventDefault();
    setError(null);

    // Validate VIN
    if (vin.trim().length !== 17) {
      setError('Standard commercial VIN must be exactly 17 alphanumeric characters.');
      return;
    }

    try {
      await api.createVehicle({
        unit_number: unitNumber,
        vin: vin.trim().toUpperCase(),
        make,
        model,
        model_year: parseInt(modelYear, 10),
        fuel_type: fuelType,
        gross_vehicle_weight: parseInt(gvw, 10),
        number_of_axles: parseInt(axles, 10),
      }, currentFleetId);

      setShowModal(false);
      setUnitNumber('');
      setVin('');
      loadVehicles();
    } catch (err) {
      setError(err.message || 'Failed to add vehicle.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to retire this power unit?')) return;
    try {
      await api.deleteVehicle(id);
      loadVehicles();
    } catch (err) {
      alert(err.message || 'Failed to remove vehicle.');
    }
  };

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
            Power Units & Equipment Inventory
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Manage commercial vehicles registered for IFTA and IRP apportionment reporting.
          </p>
        </div>

        <button
          onClick={() => { setShowModal(true); setError(null); }}
          className="btn btn-primary"
        >
          <Plus size={16} /> Add Power Unit
        </button>
      </div>

      {/* Equipment Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Unit Number</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>VIN</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Make & Model</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Year</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Fuel Type</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>GVW (lbs)</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Axles</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading vehicle inventory...
                  </td>
                </tr>
              ) : vehicles.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No power units found. Click "+ Add Power Unit" to register a truck.
                  </td>
                </tr>
              ) : vehicles.map((v) => (
                <tr key={v.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Truck size={16} color="#2563eb" />
                      <span>{v.unit_number}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', color: '#334155' }}>
                    {v.vin}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {v.make} {v.model}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {v.model_year}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-info">{v.fuel_type}</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }} className="tabular-nums">
                    {v.gross_vehicle_weight.toLocaleString()} lbs
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {v.number_of_axles} Axles
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-success">
                      <CheckCircle size={12} /> Active
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button
                      onClick={() => handleDelete(v.id)}
                      title="Retire Power Unit"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#94a3b8',
                        cursor: 'pointer',
                        padding: '4px'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                      onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Power Unit Modal */}
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
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Register Power Unit</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddVehicle} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {error && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px'
                }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Unit Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={unitNumber}
                    onChange={(e) => setUnitNumber(e.target.value)}
                    placeholder="e.g. Unit 108"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Model Year
                  </label>
                  <input
                    type="number"
                    value={modelYear}
                    onChange={(e) => setModelYear(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  VIN (17 Characters) *
                </label>
                <input
                  type="text"
                  required
                  maxLength={17}
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="e.g. 1FTNE34W0EDA10108"
                  className="form-input font-mono"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Make
                  </label>
                  <input
                    type="text"
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Freightliner"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Model
                  </label>
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Cascadia"
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Fuel Type
                  </label>
                  <select
                    value={fuelType}
                    onChange={(e) => setFuelType(e.target.value)}
                    className="form-input"
                  >
                    <option value="Diesel">Diesel</option>
                    <option value="Gasoline">Gasoline</option>
                    <option value="Propane">Propane</option>
                    <option value="LNG">LNG</option>
                    <option value="CNG">CNG</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Licensed GVW (lbs)
                  </label>
                  <input
                    type="number"
                    value={gvw}
                    onChange={(e) => setGvw(e.target.value)}
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
                  Save Power Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
