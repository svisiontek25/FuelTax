import React, { useEffect, useState } from 'react';
import { api } from '../api';
import { Route, Plus, CheckCircle, AlertTriangle, ArrowRight, Trash2, ShieldCheck, Zap } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
];

export default function TripEntry({ quarter, currentFleetId, onNavigateToUnits }) {
  const [vehicles, setVehicles] = useState([]);
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // New trip form state
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [tripDate, setTripDate] = useState(new Date().toISOString().split('T')[0]);
  const [tripNumber, setTripNumber] = useState('');
  const [entryMethod, setEntryMethod] = useState('distance');
  const [notes, setNotes] = useState('');

  // Corridor segments: [{ jurisdiction: 'AR', all_miles: '' }]
  const [segments, setSegments] = useState([
    { jurisdiction: 'AR', all_miles: '' },
  ]);

  // Live adjacency validation state
  const [validation, setValidation] = useState({ valid: true, errors: [] });
  const [validating, setValidating] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);

  useEffect(() => {
    loadData();
  }, [quarter, currentFleetId]);

  useEffect(() => {
    checkAdjacency();
  }, [segments]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [vehData, tripData] = await Promise.all([
        api.getVehicles(currentFleetId),
        api.getTrips(quarter, currentFleetId)
      ]);
      setVehicles(vehData || []);
      if (vehData && vehData.length > 0) {
        setSelectedVehicle(vehData[0].id);
      } else {
        setSelectedVehicle('');
      }
      setTrips(tripData || []);
    } catch (err) {
      console.error('Failed to load trip entry data:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkAdjacency = async () => {
    const jurisdictions = segments.map((s) => s.jurisdiction).filter(Boolean);
    if (jurisdictions.length <= 1) {
      setValidation({ valid: true, errors: [] });
      return;
    }

    setValidating(true);
    try {
      const res = await api.validateRoute(jurisdictions);
      setValidation(res);
    } catch (err) {
      console.error('Validation error:', err);
    } finally {
      setValidating(false);
    }
  };

  const handleAddSegment = () => {
    const lastState = segments[segments.length - 1]?.jurisdiction || 'TX';
    setSegments([...segments, { jurisdiction: lastState, all_miles: 150 }]);
  };

  const handleUpdateSegment = (idx, field, val) => {
    const copy = [...segments];
    copy[idx] = { ...copy[idx], [field]: val };
    setSegments(copy);
  };

  const handleRemoveSegment = (idx) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter((_, i) => i !== idx));
  };

  const handleAutoInsertMissing = (suggestedStates, insertIdx) => {
    // Inserts the missing intermediate states between segment insertIdx and insertIdx+1
    const newSegments = [...segments];
    const statesToInsert = suggestedStates.map((st) => ({ jurisdiction: st, all_miles: 100 }));
    newSegments.splice(insertIdx + 1, 0, ...statesToInsert);
    setSegments(newSegments);
  };

  const handleSubmitTrip = async (e) => {
    e.preventDefault();
    setSubmitMsg(null);

    if (!selectedVehicle) {
      alert('Please select a power unit.');
      return;
    }

    try {
      const payload = {
        vehicle_id: selectedVehicle,
        trip_number: tripNumber || `TRP-${Date.now().toString().slice(-6)}`,
        trip_date: tripDate,
        quarter,
        entry_method: entryMethod,
        segments: segments.map((s) => ({
          jurisdiction: s.jurisdiction,
          all_miles: parseFloat(s.all_miles) || 0,
        })),
        notes,
      };

      await api.createTrip(payload);
      setSubmitMsg({ type: 'success', text: 'Trip successfully recorded and validated against state borders!' });
      setTripNumber('');
      loadData();
    } catch (err) {
      setSubmitMsg({ type: 'error', text: err.message || 'Failed to record trip.' });
    }
  };

  const totalTripMiles = segments.reduce((sum, s) => sum + (parseFloat(s.all_miles) || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
          Quarterly Trip Logging & Route Validation
        </h2>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          Log sequential highway corridors with automated border adjacency checks to prevent audit gaps.
        </p>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
        gap: '24px'
      }}>
        {/* Left: New Trip Entry Form */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
            New Trip Corridor Entry
          </h3>

          {submitMsg && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '8px',
              marginBottom: '16px',
              fontSize: '13px',
              background: submitMsg.type === 'success' ? '#f0fdf4' : '#fef2f2',
              border: submitMsg.type === 'success' ? '1px solid #bbf7d0' : '1px solid #fecaca',
              color: submitMsg.type === 'success' ? '#166534' : '#991b1b'
            }}>
              {submitMsg.text}
            </div>
          )}

          <form onSubmit={handleSubmitTrip} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#475569' }}>
                    Power Unit *
                  </label>
                  {vehicles.length === 0 && (
                    <span style={{ fontSize: '11px', color: '#E00000', fontWeight: '600' }}>
                      No units found
                    </span>
                  )}
                </div>
                <select
                  value={selectedVehicle}
                  onChange={(e) => setSelectedVehicle(e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">
                    {vehicles.length > 0 ? `-- Select Power Unit (${vehicles.length} available) --` : '-- No Power Units in Fleet --'}
                  </option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.unit_number} ({v.make} {v.model}) - {v.fuel_type || 'DIESEL'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Trip Date *
                </label>
                <input
                  type="date"
                  value={tripDate}
                  onChange={(e) => setTripDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Trip / BOL Number
                </label>
                <input
                  type="text"
                  value={tripNumber}
                  onChange={(e) => setTripNumber(e.target.value)}
                  placeholder="e.g. TRP-2026-042"
                  className="form-input"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '700', marginBottom: '4px', color: '#475569' }}>
                  Input Mode
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setEntryMethod('distance')}
                    className={`btn btn-sm ${entryMethod === 'distance' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    Distance (Miles)
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryMethod('odometer')}
                    className={`btn btn-sm ${entryMethod === 'odometer' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                  >
                    Odometer Hub
                  </button>
                </div>
              </div>
            </div>

            {/* Sequential Corridor Segment List */}
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                  Sequential State Corridors ({segments.length} Legs)
                </span>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#2563eb' }} className="tabular-nums">
                  Total: {totalTripMiles.toLocaleString()} miles
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {segments.map((seg, idx) => (
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
                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', width: '20px' }}>
                      #{idx + 1}
                    </span>

                    <select
                      value={seg.jurisdiction}
                      onChange={(e) => handleUpdateSegment(idx, 'jurisdiction', e.target.value)}
                      className="form-input"
                      style={{ width: '80px', fontWeight: '700' }}
                    >
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>

                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <input
                        type="number"
                        min="1"
                        value={seg.all_miles}
                        onChange={(e) => handleUpdateSegment(idx, 'all_miles', e.target.value)}
                        placeholder="Miles"
                        className="form-input"
                        style={{ textAlign: 'right' }}
                        required
                      />
                      <span style={{ fontSize: '12px', color: '#64748b' }}>mi</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveSegment(idx)}
                      disabled={segments.length <= 1}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: segments.length <= 1 ? '#cbd5e1' : '#94a3b8',
                        cursor: segments.length <= 1 ? 'not-allowed' : 'pointer',
                        padding: '4px'
                      }}
                      onMouseEnter={(e) => segments.length > 1 && (e.currentTarget.style.color = '#ef4444')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddSegment}
                className="btn btn-secondary btn-sm"
                style={{ marginTop: '10px', width: '100%' }}
              >
                <Plus size={14} /> Add Next Border Crossing
              </button>
            </div>

            {/* Live State Adjacency Validation Status */}
            <div style={{
              padding: '14px',
              borderRadius: '8px',
              background: validation.valid ? '#f0fdf4' : '#fffbeb',
              border: validation.valid ? '1px solid #bbf7d0' : '1px solid #fde68a',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {validation.valid ? (
                  <>
                    <CheckCircle size={18} color="#16a34a" />
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#166534' }}>
                        Valid Contiguous Route
                      </div>
                      <div style={{ fontSize: '12px', color: '#15803d' }}>
                        All consecutive jurisdictions share direct land borders.
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={18} color="#d97706" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: '#92400e' }}>
                        Non-Adjacent Border Hop Detected!
                      </div>
                      {validation.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: '12px', color: '#b45309', marginTop: '4px' }}>
                          • {err.message}
                          {err.suggested_intermediate_states?.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              <button
                                type="button"
                                onClick={() => handleAutoInsertMissing(err.suggested_intermediate_states, err.segment_index)}
                                className="btn btn-sm"
                                style={{
                                  background: '#d97706',
                                  color: '#ffffff',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  borderRadius: '4px',
                                  marginTop: '2px'
                                }}
                              >
                                <Zap size={12} /> Auto-Insert Missing: {err.suggested_intermediate_states.join(' → ')}
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '12px', fontSize: '14px', marginTop: '8px' }}
            >
              Save Trip & Recompute Fleet Taxes
            </button>
          </form>
        </div>

        {/* Right: Quarter's Existing Trips */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', marginBottom: '16px' }}>
            Logged Trips for {quarter} ({trips.length} entries)
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '560px', overflowY: 'auto' }}>
            {trips.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>
                No trips logged yet for this quarter.
              </div>
            ) : trips.map((t) => (
              <div
                key={t.id}
                style={{
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#0f172a' }}>
                    {t.trip_number} • {t.unit_number}
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: '#2563eb' }} className="tabular-nums">
                    {t.total_trip_miles.toLocaleString()} mi
                  </div>
                </div>

                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px' }}>
                  Date: {t.trip_date} • {t.vehicle_desc}
                </div>

                {/* State badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {t.segments?.map((seg, sIdx) => (
                    <span
                      key={sIdx}
                      style={{
                        padding: '2px 8px',
                        borderRadius: '4px',
                        background: '#f1f5f9',
                        fontSize: '11px',
                        fontWeight: '600',
                        color: '#334155'
                      }}
                    >
                      {seg.jurisdiction} ({seg.all_miles} mi)
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
