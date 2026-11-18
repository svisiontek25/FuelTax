import React from 'react';
import {
  Truck, ShieldCheck, ArrowRight, UploadCloud, FileSpreadsheet,
  Route, Gauge, Users, Archive, CheckCircle, Globe, Lock, Sparkles
} from 'lucide-react';

export default function LandingPage({ onNavigateAuth }) {
  const features = [
    {
      title: 'CSV & ELD Ingestion Hub',
      desc: 'Import Motive, Samsara, and WEX files with SHA-256 duplicate batch blocking and automatic Canadian Litres-to-US Gallons conversion.',
      icon: UploadCloud,
      accent: '#930031',
      bg: '#fbeaf0',
      tag: 'Audit Safe'
    },
    {
      title: '17-Column Fleet Summary',
      desc: 'Exact ProMiles mathematical parity using Decimal ROUND_HALF_UP precision, Kentucky surcharges, and weight-distance tax lines.',
      icon: FileSpreadsheet,
      accent: '#1B365D',
      bg: '#eef6fb',
      tag: 'Schedule 1'
    },
    {
      title: 'Route Adjacency & Mileage Grid',
      desc: 'Spreadsheet-style manual entry paired with 58-jurisdiction border graph validation to catch missing state-line crossings.',
      icon: Route,
      accent: '#542177',
      bg: '#f4ecf9',
      tag: '58 Borders'
    },
    {
      title: 'Unit Summary & Audit Engine',
      desc: 'Automatic detection of out-of-range truck MPG (4.0–10.0), odometer continuity gaps (>50 mi), and orphaned miles without fuel.',
      icon: Gauge,
      accent: '#CE7F20',
      bg: '#fdf4e7',
      tag: 'Pre-Audit'
    },
    {
      title: 'Customer & Permit Master',
      desc: '6-tab carrier profiles managing IFTA, KYU, NM WDT, NY HUT, OR WMT, ILLCC, IRP Fleet/Firm, and insurance expirations.',
      icon: Users,
      accent: '#5B6E2C',
      bg: '#eff4e8',
      tag: '6-Tab Master'
    },
    {
      title: '4-Year Audit Defense ZIP',
      desc: 'Freeze finalized quarters into immutable snapshots and export Landscape PDFs, State E-File EDI CSVs, and complete audit archives.',
      icon: Archive,
      accent: '#60C1E5',
      bg: '#e6f5fb',
      tag: 'Immutable'
    }
  ];

  const steps = [
    { num: '01', title: 'Setup Carrier & Units', desc: 'Configure Base Jurisdiction, IFTA permits, and qualified power units.', color: '#1B365D' },
    { num: '02', title: 'Ingest Trips & Fuel', desc: 'Upload ELD/Fuel Card CSVs or enter trips in the Mileage Grid.', color: '#542177' },
    { num: '03', title: 'Audit & Reconcile', desc: 'Resolve soft warnings, check unit MPGs, and verify tax-paid credits.', color: '#CE7F20' },
    { num: '04', title: 'Lock & File Return', desc: 'Finalize quarter and download PDF, State E-File, and Audit ZIP.', color: '#5B6E2C' }
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f3f7f6', color: '#28301C', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navbar */}
      <nav style={{
        background: '#1B365D',
        borderBottom: '3px solid #60C1E5',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 4px 16px rgba(27, 54, 93, 0.2)'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #60C1E5, #73A5CA)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={22} color="#1B365D" strokeWidth={2.4} />
            </div>
            <div>
              <div style={{ fontSize: '20px', fontWeight: '800', color: '#ffffff', letterSpacing: '-0.4px' }}>
                FuelTax<span style={{ color: '#60C1E5' }}>Pulse</span>
              </div>
              <div style={{ fontSize: '11px', color: '#9DBEB8', fontWeight: '500' }}>Enterprise IFTA Compliance</div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <a href="#features" style={{ color: '#cbd8d5', fontSize: '13.5px', fontWeight: '600', textDecoration: 'none' }}>Modules</a>
            <a href="#workflow" style={{ color: '#cbd8d5', fontSize: '13.5px', fontWeight: '600', textDecoration: 'none' }}>Workflow</a>
            <a href="#accuracy" style={{ color: '#cbd8d5', fontSize: '13.5px', fontWeight: '600', textDecoration: 'none' }}>Audit Accuracy</a>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => onNavigateAuth('login')}
                className="btn"
                style={{ background: 'transparent', color: '#60C1E5', border: '1px solid #60C1E5' }}
              >
                Sign In
              </button>
              <button
                onClick={() => onNavigateAuth('register')}
                className="btn btn-accent"
              >
                Get Started <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={{
        background: 'linear-gradient(135deg, #1B365D 0%, #28301C 100%)',
        color: '#ffffff',
        padding: '64px 24px 72px',
        borderBottom: '4px solid #73A5CA'
      }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '48px',
          alignItems: 'center'
        }}>
          {/* Left Hero Copy */}
          <div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '5px 14px',
              borderRadius: '999px',
              background: 'rgba(96, 193, 229, 0.14)',
              border: '1px solid #60C1E5',
              color: '#60C1E5',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '20px'
            }}>
              <Sparkles size={14} /> 48 U.S. States + 10 Canadian Provinces • 2026 IFTA Ready
            </div>

            <h1 style={{
              fontSize: '42px',
              fontWeight: '800',
              lineHeight: '1.15',
              letterSpacing: '-1px',
              marginBottom: '18px'
            }}>
              Quarterly IFTA & Fuel Tax Filing, <span style={{ color: '#60C1E5' }}>Automated to the Penny.</span>
            </h1>

            <p style={{ fontSize: '16px', color: '#9DBEB8', lineHeight: '1.65', marginBottom: '28px', maxWidth: '560px' }}>
              Eliminate manual spreadsheet errors, validate state-line crossings automatically, and generate DMV-ready Schedule 1 returns, State E-File CSVs, and 4-year Audit Defense ZIP packages in minutes.
            </p>

            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
              <button
                onClick={() => onNavigateAuth('login')}
                className="btn btn-accent"
                style={{ padding: '12px 24px', fontSize: '15px' }}
              >
                Launch Compliance Portal <ArrowRight size={17} />
              </button>
              <button
                onClick={() => onNavigateAuth('register')}
                className="btn"
                style={{
                  padding: '12px 22px',
                  fontSize: '15px',
                  background: 'rgba(255,255,255,0.08)',
                  color: '#ffffff',
                  border: '1px solid #73A5CA'
                }}
              >
                Create Carrier Account
              </button>
            </div>

            <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', fontSize: '13px', color: '#cbd8d5' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} color="#60C1E5" /> Decimal Half-Up Rounding
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} color="#60C1E5" /> SHA-256 Duplicate Protection
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <CheckCircle size={15} color="#60C1E5" /> Immutable Quarter Locks
              </span>
            </div>
          </div>

          {/* Right Hero Live Preview Card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '24px',
            color: '#28301C',
            boxShadow: '0 24px 48px rgba(0, 0, 0, 0.35)',
            border: '2px solid #60C1E5'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', paddingBottom: '12px', borderBottom: '1px solid #cbd8d5' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: '700', color: '#542177', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Verified Benchmark Return
                </div>
                <div style={{ fontSize: '17px', fontWeight: '800', color: '#1B365D' }}>
                  2AAB TRUCKING LLC (Base: AR)
                </div>
              </div>
              <span style={{
                padding: '4px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: '700',
                background: '#eff4e8', color: '#5B6E2C', border: '1px solid #9DBEB8'
              }}>
                Schedule 1 Verified
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
              <div style={{ padding: '10px', borderRadius: '8px', background: '#eef6fb', borderTop: '3px solid #1B365D' }}>
                <div style={{ fontSize: '11px', color: '#556663', fontWeight: '600' }}>Fleet Miles</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#1B365D' }} className="tabular-nums">276,951</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: '#eff4e8', borderTop: '3px solid #5B6E2C' }}>
                <div style={{ fontSize: '11px', color: '#556663', fontWeight: '600' }}>Fleet MPG</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#5B6E2C' }} className="tabular-nums">6.56</div>
              </div>
              <div style={{ padding: '10px', borderRadius: '8px', background: '#fbeaf0', borderTop: '3px solid #930031' }}>
                <div style={{ fontSize: '11px', color: '#556663', fontWeight: '600' }}>Net Tax Due</div>
                <div style={{ fontSize: '18px', fontWeight: '800', color: '#930031' }} className="tabular-nums">$1,109.29</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12.5px' }}>
              {[
                { st: 'IL (Illinois)', mi: '45,777 mi', gal: '+1,664 gal', amt: '$1,228.03', color: '#930031' },
                { st: 'KY (Surcharge)', mi: '4,266 mi', gal: '650 consumed', amt: '$68.25', color: '#CE7F20' },
                { st: 'AZ (Arizona Credit)', mi: '772 mi', gal: '-196 gal', amt: '($50.96)', color: '#5B6E2C' }
              ].map((r, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', borderRadius: '8px', background: '#f8fbfa', border: '1px solid #cbd8d5'
                }}>
                  <span style={{ fontWeight: '700', color: '#1B365D' }}>{r.st}</span>
                  <span style={{ color: '#556663' }}>{r.mi}</span>
                  <span style={{ color: '#556663' }}>{r.gal}</span>
                  <span style={{ fontWeight: '800', color: r.color }} className="tabular-nums">{r.amt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section id="accuracy" style={{ background: '#ffffff', borderBottom: '1px solid #cbd8d5', padding: '24px' }}>
        <div style={{
          maxWidth: '1280px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          textAlign: 'center'
        }}>
          {[
            { val: '58 Jurisdictions', lbl: '48 U.S. States + 10 Canadian Provinces', color: '#1B365D' },
            { val: '17-Column Parity', lbl: 'Matches ProMiles & State DMV Layouts', color: '#542177' },
            { val: 'SHA-256 Guard', lbl: 'Zero Duplicate ELD or Fuel Card Imports', color: '#930031' },
            { val: '4-Year Archive', lbl: '1-Click Audit Defense ZIP & Quarter Locks', color: '#5B6E2C' }
          ].map((s, i) => (
            <div key={i} style={{ padding: '8px' }}>
              <div style={{ fontSize: '22px', fontWeight: '800', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '12.5px', color: '#556663', fontWeight: '500', marginTop: '2px' }}>{s.lbl}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Core Modules Grid */}
      <section id="features" style={{ padding: '60px 24px', maxWidth: '1280px', margin: '0 auto', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span className="badge badge-plum" style={{ marginBottom: '10px' }}>ENTERPRISE COMPLIANCE SUITE</span>
          <h2 style={{ fontSize: '30px', fontWeight: '800', color: '#1B365D', letterSpacing: '-0.5px' }}>
            Everything Required for Audit-Proof IFTA Filing
          </h2>
          <p style={{ fontSize: '15px', color: '#556663', maxWidth: '640px', margin: '8px auto 0' }}>
            Purpose-built modules connecting trip routing, fuel receipts, unit diagnostics, and quarterly rate matrices into one seamless pipeline.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {features.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div key={idx} className="card" style={{ padding: '24px', borderTop: `4px solid ${f.accent}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '10px',
                    background: f.bg, color: f.accent,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Icon size={22} />
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: '700', padding: '3px 10px',
                    borderRadius: '999px', background: f.bg, color: f.accent
                  }}>
                    {f.tag}
                  </span>
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: '700', color: '#1B365D', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13.5px', color: '#556663', lineHeight: '1.55' }}>{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Workflow Section */}
      <section id="workflow" style={{ background: '#ffffff', borderTop: '1px solid #cbd8d5', borderBottom: '1px solid #cbd8d5', padding: '56px 24px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#1B365D' }}>From Raw ELD Logs to Filed Return in 4 Steps</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '18px' }}>
            {steps.map((st, idx) => (
              <div key={idx} style={{
                padding: '22px',
                borderRadius: '12px',
                background: '#f8fbfa',
                border: '1px solid #cbd8d5',
                borderLeft: `5px solid ${st.color}`
              }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: st.color, marginBottom: '6px' }}>STEP {st.num}</div>
                <div style={{ fontSize: '16px', fontWeight: '700', color: '#1B365D', marginBottom: '6px' }}>{st.title}</div>
                <div style={{ fontSize: '13px', color: '#556663' }}>{st.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section style={{ padding: '56px 24px' }}>
        <div style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '40px 32px',
          borderRadius: '16px',
          background: 'linear-gradient(135deg, #1B365D 0%, #542177 100%)',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '24px',
          boxShadow: '0 12px 28px rgba(27, 54, 93, 0.22)'
        }}>
          <div>
            <h2 style={{ fontSize: '26px', fontWeight: '800', marginBottom: '6px' }}>Ready to Simplify Your Quarterly IFTA Filing?</h2>
            <p style={{ fontSize: '14.5px', color: '#9DBEB8' }}>Sign in with our 1-click 2AAB Trucking demo or register your carrier fleet today.</p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button onClick={() => onNavigateAuth('login')} className="btn btn-accent" style={{ padding: '12px 24px', fontSize: '14.5px' }}>
              Sign In to Portal <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        background: '#1B365D',
        color: '#9DBEB8',
        padding: '24px',
        marginTop: 'auto',
        borderTop: '2px solid #60C1E5',
        fontSize: '12.5px'
      }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ffffff', fontWeight: '700' }}>
            <Truck size={16} color="#60C1E5" /> FuelTaxPulse Enterprise • Multi-Fleet IFTA Compliance Suite
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#60C1E5' }}>
              <Globe size={14} /> 58 Member Jurisdictions
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Lock size={14} /> 4-Year Audit Trail
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
