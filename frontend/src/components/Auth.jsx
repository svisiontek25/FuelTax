import React, { useState } from 'react';
import { api, setAuthToken, setStoredUser } from '../api';
import { Truck, ShieldCheck, ArrowRight, Lock, Mail, Building, MapPin, Hash, CheckCircle, AlertCircle } from 'lucide-react';

const IFTA_JURISDICTIONS = [
  'AL', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK',
  'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'ON', 'PE', 'QC', 'SK'
];

export default function Auth({ onAuthSuccess, initialMode = 'login', onBackToHome }) {
  const [isRegister, setIsRegister] = useState(initialMode === 'register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [baseJurisdiction, setBaseJurisdiction] = useState('AR');
  const [dotNumber, setDotNumber] = useState('');
  const [iftaNumber, setIftaNumber] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (isRegister) {
      if (!fullName.trim()) {
        setError('Full Name is required.');
        return;
      }
      if (!companyName.trim()) {
        setError('Company / Carrier Name is required.');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters long.');
        return;
      }
    }

    setLoading(true);

    try {
      let resp;
      if (isRegister) {
        resp = await api.register({
          email,
          password,
          full_name: fullName,
          company_name: companyName,
          base_jurisdiction: baseJurisdiction,
          dot_number: dotNumber || undefined,
          ifta_account_number: iftaNumber || `${baseJurisdiction}-IFTA-2026`,
        });
      } else {
        resp = await api.login(email, password);
      }

      setAuthToken(resp.access_token);
      setStoredUser(resp.user);
      onAuthSuccess(resp.user);
    } catch (err) {
      setError(err.message || 'Authentication failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail, demoPass) => {
    setError(null);
    setLoading(true);
    try {
      const resp = await api.login(demoEmail, demoPass);
      setAuthToken(resp.access_token);
      setStoredUser(resp.user);
      onAuthSuccess(resp.user);
    } catch (err) {
      setError(err.message || 'Demo login failed. Ensure backend server is running on port 8000.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#1B365D', color: '#f8fafc' }}>
      {/* Left Column: Brand Hero */}
      <div style={{
        flex: '1.1',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px 50px',
        background: 'linear-gradient(145deg, #1B365D 0%, #28301C 100%)',
        borderRight: '2px solid #60C1E5'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #60C1E5, #73A5CA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(96, 193, 229, 0.35)'
            }}>
              <Truck size={24} color="#1B365D" strokeWidth={2.4} />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' }}>
                FuelTax<span style={{ color: '#60C1E5' }}>Pulse</span>
              </h1>
              <p style={{ fontSize: '13px', color: '#9DBEB8' }}>Fleet Fuel Tax & IFTA Compliance Suite</p>
            </div>
          </div>

          <div style={{ maxWidth: '480px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 12px',
              borderRadius: '999px',
              background: 'rgba(96, 193, 229, 0.14)',
              border: '1px solid #60C1E5',
              color: '#60C1E5',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '20px'
            }}>
              <ShieldCheck size={14} /> Official 17-Column ProMiles Accuracy
            </div>

            <h2 style={{ fontSize: '36px', fontWeight: '800', lineHeight: '1.2', marginBottom: '16px', letterSpacing: '-1px' }}>
              Automate your quarterly fuel taxes with 100% audit confidence.
            </h2>
            <p style={{ fontSize: '15px', color: '#94a3b8', lineHeight: '1.6', marginBottom: '36px' }}>
              Eliminate spreadsheet errors, detect broken state routes with live adjacency checking, and produce official DMV-ready IFTA schedules down to the exact penny.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#10b981" />
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>48 Lower States + Canadian Provinces Quarterly Rates Matrix</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#10b981" />
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Live Graph-Based State Adjacency Corridor Validation</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#10b981" />
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>Special Heavy Fuel Surcharges (KY 0.1050) & Highway Weight Taxes (KYU, NM)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckCircle size={18} color="#10b981" />
                <span style={{ fontSize: '14px', color: '#cbd5e1' }}>1-Click Print & E-File Landscape PDF Schedules</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Benchmark Pill */}
        <div style={{
          marginTop: '40px',
          padding: '16px 20px',
          borderRadius: '12px',
          background: 'rgba(84, 33, 119, 0.35)',
          border: '1px solid #73A5CA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#9DBEB8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Verified Benchmark Return</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', marginTop: '2px' }}>2AAB TRUCKING LLC — 7 Units (276,951 Miles)</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '11px', color: '#9DBEB8' }}>Quarterly Total Due</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#60C1E5' }}>$1,109.27</div>
          </div>
        </div>
      </div>

      {/* Right Column: Sign In / Registration Form */}
      <div style={{
        flex: '0.9',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 30px',
        background: '#11223d'
      }}>
        <div style={{ width: '100%', maxWidth: '440px' }}>
          {onBackToHome && (
            <button
              type="button"
              onClick={onBackToHome}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#60C1E5',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                marginBottom: '14px',
                padding: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ← Back to Home
            </button>
          )}
          {/* Toggle Tab */}
          <div style={{
            display: 'flex',
            background: '#1B365D',
            padding: '4px',
            borderRadius: '10px',
            marginBottom: '28px',
            border: '1px solid #73A5CA'
          }}>
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '14px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                background: !isRegister ? '#60C1E5' : 'transparent',
                color: !isRegister ? '#1B365D' : '#9DBEB8',
                transition: 'all 0.15s ease'
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(null); }}
              style={{
                flex: 1,
                padding: '10px',
                fontSize: '14px',
                fontWeight: '700',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                background: isRegister ? '#60C1E5' : 'transparent',
                color: isRegister ? '#1B365D' : '#9DBEB8',
                transition: 'all 0.15s ease'
              }}
            >
              Create Account
            </button>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '24px', fontWeight: '700', marginBottom: '6px' }}>
              {isRegister ? 'Register your carrier fleet' : 'Welcome back'}
            </h3>
            <p style={{ fontSize: '14px', color: '#94a3b8' }}>
              {isRegister ? 'Set up your IFTA compliance profile in seconds.' : 'Access your active fleet reports and fuel ledgers.'}
            </p>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '20px'
            }}>
              <AlertCircle size={18} shrink={0} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegister && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                    Full Name
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Michal Doe"
                      className="form-input"
                      style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                    Company / Carrier Name
                  </label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. 2AAB TRUCKING LLC"
                    className="form-input"
                    style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                      Base State
                    </label>
                    <select
                      value={baseJurisdiction}
                      onChange={(e) => setBaseJurisdiction(e.target.value)}
                      className="form-input"
                      style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                    >
                      {IFTA_JURISDICTIONS.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                      USDOT #
                    </label>
                    <input
                      type="text"
                      value={dotNumber}
                      onChange={(e) => setDotNumber(e.target.value)}
                      placeholder="e.g. 3948210"
                      className="form-input"
                      style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                Email Address
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="form-input"
                  style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px', color: '#cbd5e1' }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="form-input"
                  style={{ background: '#1e293b', borderColor: '#334155', color: '#ffffff' }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '15px', marginTop: '6px', borderRadius: '8px' }}
            >
              {loading ? 'Processing...' : (
                <>
                  {isRegister ? 'Complete Registration' : 'Sign In to Portal'}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Logins */}
          {!isRegister && (
            <div style={{ marginTop: '28px', paddingTop: '24px', borderTop: '1px solid #1e293b' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '12px', textAlign: 'center' }}>
                ⚡ Quick Demo One-Click Access:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => handleDemoLogin('admin@fueltaxpulse.com', 'admin123')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '600' }}>2AAB TRUCKING LLC</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>admin@fueltaxpulse.com (Admin)</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Demo Sign In →</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDemoLogin('manager@fueltaxpulse.com', 'manager123')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#1e293b',
                    border: '1px solid #334155',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '600' }}>Fleet Dispatcher Account</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block' }}>manager@fueltaxpulse.com</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '600' }}>Demo Sign In →</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
