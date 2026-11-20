import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Truck, Plus, Edit, Trash2, CheckCircle, AlertCircle, X } from 'lucide-react';

export default function PowerUnits({ currentFleetId }) {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Vehicle form state
  const [unitNumber, setUnitNumber] = useState('');
  const [vin, setVin] = useState('');
  const [make, setMake] = useState('Freightliner');
  const [model, setModel] = useState('Cascadia');
  const [modelYear, setModelYear] = useState(2024);
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

  const handleOpenAdd = () => {
    setEditingVehicleId(null);
    setUnitNumber('');
    setVin('');
    setMake('Freightliner');
    setModel('Cascadia');
    setModelYear(2024);
    setGvw(80000);
    setAxles(5);
    setError(null);
    setShowModal(true);
  };

  // Module 9: Open Edit Power Unit Modal
  const handleOpenEdit = (v) => {
    setEditingVehicleId(v.id);
    setUnitNumber(v.unit_number || '');
    setVin(v.vin || '');
    setMake(v.make || 'Freightliner');
    setModel(v.model || 'Cascadia');
    setModelYear(v.model_year || 2024);
    setGvw(v.gross_vehicle_weight || 80000);
    setAxles(v.number_of_axles || 5);
    setError(null);
    setShowModal(true);
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!unitNumber.trim()) {
      setError('Unit Number is required.');
      return;
    }

    if (vin.trim().length !== 17) {
      setError('Standard commercial VIN must be exactly 17 alphanumeric characters.');
      return;
    }

    const payload = {
      unit_number: unitNumber.trim(),
      vin: vin.trim().toUpperCase(),
      make: make.trim() || 'Freightliner',
      model: model.trim() || 'Cascadia',
      model_year: parseInt(modelYear, 10) || 2024,
      fuel_type: 'Diesel',
      gross_vehicle_weight: parseInt(gvw, 10) || 80000,
      number_of_axles: parseInt(axles, 10) || 5,
    };

    try {
      if (editingVehicleId) {
        await api.updateVehicle(editingVehicleId, payload);
        setSuccessMsg(`Power Unit '${payload.unit_number}' updated. Historical Fuel, Mileage, and Tax records remain intact.`);
      } else {
        await api.createVehicle(payload, currentFleetId);
        setSuccessMsg(`Power Unit '${payload.unit_number}' registered successfully.`);
      }
      setShowModal(false);
      setEditingVehicleId(null);
      loadVehicles();
    } catch (err) {
      setError(err.message || 'Failed to save power unit.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to retire this power unit?')) return;
    try {
      await api.deleteVehicle(id);
      setSuccessMsg('Power unit removed from active fleet.');
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
            Register and edit commercial vehicles registered for IFTA and IRP apportionment reporting.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn btn-primary"
        >
          <Plus size={16} /> Add Power Unit
        </button>
      </div>

      {successMsg && (
        <div style={{ padding: '12px 16px', borderRadius: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle size={18} />
          <span>{successMsg}</span>
        </div>
      )}

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
                    <span className="badge badge-info">DIESEL</span>
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }} className="tabular-nums">
                    {Number(v.gross_vehicle_weight || 80000).toLocaleString()} lbs
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
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(v)}
                        title="Edit Power Unit Details"
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        <Edit size={13} /> Edit
                      </button>
                      <button
                        type="button"
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Power Unit Modal (Module 9) */}
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
              <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                {editingVehicleId ? 'Edit Power Unit Details' : 'Register Power Unit'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveVehicle} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {error && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '6px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{error}</span>
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
                    placeholder="e.g. Unit 101"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Model Year *
                  </label>
                  <input
                    type="number"
                    required
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
                  placeholder="e.g. 1FUJGLDR5DP101001"
                  className="form-input font-mono"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Make *
                  </label>
                  <input
                    type="text"
                    required
                    value={make}
                    onChange={(e) => setMake(e.target.value)}
                    placeholder="Freightliner"
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Model *
                  </label>
                  <input
                    type="text"
                    required
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="Cascadia"
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Fuel Type
                  </label>
                  <input
                    type="text"
                    value="Diesel"
                    readOnly
                    className="form-input"
                    style={{ background: '#f1f5f9', fontWeight: '700', color: '#334155' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Licensed GVW (lbs) *
                  </label>
                  <input
                    type="number"
                    required
                    value={gvw}
                    onChange={(e) => setGvw(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                    Axles *
                  </label>
                  <input
                    type="number"
                    required
                    min={2}
                    max={10}
                    value={axles}
                    onChange={(e) => setAxles(e.target.value)}
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
                  {editingVehicleId ? 'Save Changes' : 'Register Power Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
