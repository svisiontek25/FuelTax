import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { X, Save, AlertCircle, Building, ShieldCheck, Sliders, FileText, Users, Key } from 'lucide-react';

const US_STATES = [
  'AL','AZ','AR','CA','CO','CT','DE','FL','GA','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK',
  'OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'AB','BC','MB','NB','NL','NS','ON','PE','QC','SK'
];

export default function CustomerMasterModal({ customerId, onClose, onSaved }) {
  const [activeTab, setActiveTab] = useState('info'); // 'info', 'accounts', 'options', 'notes', 'employee', 'customer'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Form State matching all fields from Screenshots 154-157
  const [form, setForm] = useState({
    id: '',
    // Tab 1: Info (Left)
    company_name: '',
    dba: '',
    address: '',
    address2: '',
    city: '',
    state: '',
    postal_code: '',
    county: '',
    mailing_address: '',
    mailing_city: '',
    mailing_state: '',
    mailing_postal_code: '',
    // Tab 1: Info (Right)
    contact_person: '',
    contact_phone: '',
    cell_phone: '',
    contact_email: '',
    fax: '',
    website: '',
    business_hours: '',
    president_name: '',
    president_ssn: '',
    account_number: '',
    // Tab 1: Other Information
    date_incorporated: '',
    state_of_incorporation: '',
    corporation_number: '',
    officer_title: '',
    officer_name: '',
    officer_ssn: '',

    // Tab 2: Accounts (Regulatory & Tax Permits - Screenshots 156 & 157)
    ifta_state: '',
    ifta_number: '',
    fein_ssn: '',
    dot_number: '0',
    mc_number: '0',
    hvut_number: '',
    ky_permit_number: '',
    nm_permit_number: '',
    ny_permit_number: '',
    or_permit_number: '',
    carriage_type: 'Private',
    ny_report_method: 'Gross Weight',
    report_massachusetts_toll: true,
    b400_business_number: '',
    insurance_company: '',
    insurance_policy_number: '',
    insurance_expiration_date: '',
    illcc_number: '',
    irp_firm_number: '',
    irp_fleet_number: '',
    cdl_number: '',

    // Tab 3: Options (Carrier Configuration, Banking & Fuel Cards)
    default_fuel_type: 'Diesel',
    min_mpg_bound: '4.0',
    max_mpg_bound: '10.0',
    odometer_gap_tolerance: '50',
    strict_adjacency: true,
    auto_liters_conversion: true,
    bank_name: '',
    bank_account_number: '',
    billing_email: '',
    fuel_card_provider: '',
    fuel_card_account_num: '',

    // Tab 4: Notes
    notes: '',

    // Tab 5: Employee Access
    assigned_employees: '["Compliance Administrator", "Senior Fleet Tax Manager"]',

    // Tab 6: Customer Access
    customer_portal_enabled: 1,
    portal_username: '',
    portal_status: 'Active'
  });

  useEffect(() => {
    if (customerId) {
      loadCustomer(customerId);
    }
  }, [customerId]);

  const loadCustomer = async (id) => {
    setLoading(true);
    try {
      const data = await api.getCustomerDetail(id);
      setForm(prev => ({
        ...prev,
        ...data,
        report_massachusetts_toll: Boolean(data.report_massachusetts_toll)
      }));
    } catch (err) {
      console.error('Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    setError(null);

    if (!form.company_name.trim()) {
      setError('Company Name is required.');
      setActiveTab('info');
      setSaving(false);
      return;
    }

    try {
      await api.saveCustomer(form);
      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save customer master data.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'accounts', label: 'Accounts' },
    { id: 'options', label: 'Options' },
    { id: 'notes', label: 'Notes' },
    { id: 'employee', label: 'Employee Access' },
    { id: 'customer', label: 'Customer Access' },
  ];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(3px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '16px'
    }}>
      <div style={{
        background: '#ffffff',
        borderRadius: '8px',
        maxWidth: '1040px',
        width: '96%',
        maxHeight: '92vh',
        minHeight: '620px',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        border: '1px solid #cbd5e1'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff',
          flexShrink: 0
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', margin: 0 }}>
            Customer Information
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Navigation Strip (Screenshots 154 & 156 exact replica) */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          borderBottom: '1px solid #d1d5db',
          padding: '0 20px',
          background: '#f8fafc',
          flexShrink: 0,
          minHeight: '44px',
          gap: '2px',
          overflowX: 'auto'
        }}>
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '9px 18px',
                  fontSize: '14px',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#1e293b' : '#0284c7', // Screenshot 154/156: Active is dark, inactive are blue links
                  background: isActive ? '#ffffff' : 'transparent',
                  border: isActive ? '1px solid #d1d5db' : '1px solid transparent',
                  borderBottom: isActive ? '1px solid #ffffff' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  borderRadius: '4px 4px 0 0',
                  marginBottom: isActive ? '-1px' : '0',
                  position: 'relative',
                  zIndex: isActive ? 2 : 1,
                  lineHeight: '1.4',
                  outline: 'none',
                  transition: 'color 0.1s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Modal Body / Scrollable Content Area */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1, background: '#ffffff' }}>
          {error && (
            <div style={{
              padding: '12px 14px',
              borderRadius: '6px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: INFO (Screenshots 154 & 155) */}
          {activeTab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
                {/* Left Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={form.company_name}
                      onChange={(e) => handleChange('company_name', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      DBA
                    </label>
                    <input
                      type="text"
                      value={form.dba}
                      onChange={(e) => handleChange('dba', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Address
                    </label>
                    <input
                      type="text"
                      value={form.address}
                      onChange={(e) => handleChange('address', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Address 2
                    </label>
                    <input
                      type="text"
                      value={form.address2}
                      onChange={(e) => handleChange('address2', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      City
                    </label>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      State
                    </label>
                    <select
                      value={form.state}
                      onChange={(e) => handleChange('state', e.target.value)}
                      className="form-input"
                    >
                      <option value="">Select...</option>
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={form.postal_code}
                      onChange={(e) => handleChange('postal_code', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      County
                    </label>
                    <input
                      type="text"
                      value={form.county}
                      onChange={(e) => handleChange('county', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Mailing Address
                    </label>
                    <input
                      type="text"
                      value={form.mailing_address}
                      onChange={(e) => handleChange('mailing_address', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Mailing City
                    </label>
                    <input
                      type="text"
                      value={form.mailing_city}
                      onChange={(e) => handleChange('mailing_city', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Mailing State
                    </label>
                    <select
                      value={form.mailing_state}
                      onChange={(e) => handleChange('mailing_state', e.target.value)}
                      className="form-input"
                    >
                      <option value="">Select...</option>
                      {US_STATES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Mailing Postal Code
                    </label>
                    <input
                      type="text"
                      value={form.mailing_postal_code}
                      onChange={(e) => handleChange('mailing_postal_code', e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Right Column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={form.contact_person}
                      onChange={(e) => handleChange('contact_person', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={form.contact_phone}
                      onChange={(e) => handleChange('contact_phone', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Cell Phone
                    </label>
                    <input
                      type="text"
                      value={form.cell_phone}
                      onChange={(e) => handleChange('cell_phone', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={form.contact_email}
                      onChange={(e) => handleChange('contact_email', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Fax
                    </label>
                    <input
                      type="text"
                      value={form.fax}
                      onChange={(e) => handleChange('fax', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Website
                    </label>
                    <input
                      type="text"
                      value={form.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Business Hours
                    </label>
                    <input
                      type="text"
                      value={form.business_hours}
                      onChange={(e) => handleChange('business_hours', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      President Name
                    </label>
                    <input
                      type="text"
                      value={form.president_name}
                      onChange={(e) => handleChange('president_name', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      President SSN
                    </label>
                    <input
                      type="password"
                      value={form.president_ssn}
                      onChange={(e) => handleChange('president_ssn', e.target.value)}
                      className="form-input font-mono"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Account #
                    </label>
                    <input
                      type="text"
                      value={form.account_number}
                      onChange={(e) => handleChange('account_number', e.target.value)}
                      className="form-input font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-section: Other Information (Screenshot 155) */}
              <div style={{ marginTop: '12px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', marginBottom: '16px' }}>
                  Other Information
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        Date Incorporated
                      </label>
                      <input
                        type="date"
                        value={form.date_incorporated}
                        onChange={(e) => handleChange('date_incorporated', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        Corporation Number
                      </label>
                      <input
                        type="text"
                        value={form.corporation_number}
                        onChange={(e) => handleChange('corporation_number', e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        Officer Name
                      </label>
                      <input
                        type="text"
                        value={form.officer_name}
                        onChange={(e) => handleChange('officer_name', e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        State of Incorporation
                      </label>
                      <select
                        value={form.state_of_incorporation}
                        onChange={(e) => handleChange('state_of_incorporation', e.target.value)}
                        className="form-input"
                      >
                        <option value="">Select...</option>
                        {US_STATES.map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        Officer Title
                      </label>
                      <input
                        type="text"
                        value={form.officer_title}
                        onChange={(e) => handleChange('officer_title', e.target.value)}
                        placeholder="e.g. Managing Partner, President"
                        className="form-input"
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                        Officer SSN
                      </label>
                      <input
                        type="password"
                        value={form.officer_ssn}
                        onChange={(e) => handleChange('officer_ssn', e.target.value)}
                        className="form-input font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ACCOUNTS (Screenshots 156 & 157 - Regulatory & Tax Permits) */}
          {activeTab === 'accounts' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
              {/* Left Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    IFTA State
                  </label>
                  <select
                    value={form.ifta_state}
                    onChange={(e) => handleChange('ifta_state', e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select...</option>
                    {US_STATES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    FEIN/SSN
                  </label>
                  <input
                    type="text"
                    value={form.fein_ssn}
                    onChange={(e) => handleChange('fein_ssn', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    DOT #
                  </label>
                  <input
                    type="text"
                    value={form.dot_number}
                    onChange={(e) => handleChange('dot_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    MC #
                  </label>
                  <input
                    type="text"
                    value={form.mc_number}
                    onChange={(e) => handleChange('mc_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    HVUT #
                  </label>
                  <input
                    type="text"
                    value={form.hvut_number}
                    onChange={(e) => handleChange('hvut_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Carriage Type
                  </label>
                  <select
                    value={form.carriage_type}
                    onChange={(e) => handleChange('carriage_type', e.target.value)}
                    className="form-input"
                  >
                    <option value="Private">Private</option>
                    <option value="For-Hire">For-Hire</option>
                    <option value="Exempt">Exempt</option>
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                  <input
                    type="checkbox"
                    id="maTollCheck"
                    checked={form.report_massachusetts_toll}
                    onChange={(e) => handleChange('report_massachusetts_toll', e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <label htmlFor="maTollCheck" style={{ fontSize: '13px', color: '#1e293b', cursor: 'pointer', margin: 0 }}>
                    Report Massachusetts Toll on IFTA
                  </label>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    B400 Fuel Charge Return Business #
                  </label>
                  <input
                    type="text"
                    value={form.b400_business_number}
                    onChange={(e) => handleChange('b400_business_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Insurance Company
                  </label>
                  <input
                    type="text"
                    value={form.insurance_company}
                    onChange={(e) => handleChange('insurance_company', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Insurance Policy #
                  </label>
                  <input
                    type="text"
                    value={form.insurance_policy_number}
                    onChange={(e) => handleChange('insurance_policy_number', e.target.value)}
                    className="form-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Insurance Expiration Date
                  </label>
                  <input
                    type="date"
                    value={form.insurance_expiration_date}
                    onChange={(e) => handleChange('insurance_expiration_date', e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Right Column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    IFTA #
                  </label>
                  <input
                    type="text"
                    value={form.ifta_number}
                    onChange={(e) => handleChange('ifta_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    KY Permit #
                  </label>
                  <input
                    type="text"
                    value={form.ky_permit_number}
                    onChange={(e) => handleChange('ky_permit_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    NM Permit #
                  </label>
                  <input
                    type="text"
                    value={form.nm_permit_number}
                    onChange={(e) => handleChange('nm_permit_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    NY Permit#
                  </label>
                  <input
                    type="text"
                    value={form.ny_permit_number}
                    onChange={(e) => handleChange('ny_permit_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    OR Permit #
                  </label>
                  <input
                    type="text"
                    value={form.or_permit_number}
                    onChange={(e) => handleChange('or_permit_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    NY Report Method
                  </label>
                  <select
                    value={form.ny_report_method}
                    onChange={(e) => handleChange('ny_report_method', e.target.value)}
                    className="form-input"
                  >
                    <option value="Gross Weight">Gross Weight</option>
                    <option value="Unloaded Weight">Unloaded Weight</option>
                  </select>
                </div>

                <div style={{ height: '32px' }} />

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    ILLCC#
                  </label>
                  <input
                    type="text"
                    value={form.illcc_number}
                    onChange={(e) => handleChange('illcc_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    IRP Firm#
                  </label>
                  <input
                    type="text"
                    value={form.irp_firm_number}
                    onChange={(e) => handleChange('irp_firm_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    IRP Fleet#
                  </label>
                  <input
                    type="text"
                    value={form.irp_fleet_number}
                    onChange={(e) => handleChange('irp_fleet_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    CDL#
                  </label>
                  <input
                    type="text"
                    value={form.cdl_number}
                    onChange={(e) => handleChange('cdl_number', e.target.value)}
                    className="form-input font-mono"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: OPTIONS (Carrier Configuration, Banking & Fuel Cards) */}
          {activeTab === 'options' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                  IFTA Compliance & Audit Settings
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Default Fleet Fuel Type
                    </label>
                    <select
                      value={form.default_fuel_type}
                      onChange={(e) => handleChange('default_fuel_type', e.target.value)}
                      className="form-input"
                    >
                      <option value="Diesel">Diesel (DI)</option>
                      <option value="Gasoline">Gasoline (GA)</option>
                      <option value="Propane">Propane (LPG)</option>
                      <option value="CNG">Compressed Natural Gas (CNG)</option>
                      <option value="LNG">Liquefied Natural Gas (LNG)</option>
                      <option value="Biodiesel">Biodiesel (BD)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Odometer Gap Tolerance (Miles)
                    </label>
                    <input
                      type="number"
                      value={form.odometer_gap_tolerance}
                      onChange={(e) => handleChange('odometer_gap_tolerance', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Target Fleet Minimum MPG Bound
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.min_mpg_bound}
                      onChange={(e) => handleChange('min_mpg_bound', e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Target Fleet Maximum MPG Bound
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={form.max_mpg_bound}
                      onChange={(e) => handleChange('max_mpg_bound', e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#1e293b', marginBottom: '12px' }}>
                  Banking & Fuel Card Accounts
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Bank Name
                    </label>
                    <input
                      type="text"
                      value={form.bank_name}
                      onChange={(e) => handleChange('bank_name', e.target.value)}
                      placeholder="e.g. JPMorgan Chase"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Bank Account Number
                    </label>
                    <input
                      type="text"
                      value={form.bank_account_number}
                      onChange={(e) => handleChange('bank_account_number', e.target.value)}
                      placeholder="••••••••4810"
                      className="form-input font-mono"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Billing & Remittance Email
                    </label>
                    <input
                      type="email"
                      value={form.billing_email}
                      onChange={(e) => handleChange('billing_email', e.target.value)}
                      placeholder="billing@carrier.com"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Fuel Card Provider
                    </label>
                    <input
                      type="text"
                      value={form.fuel_card_provider}
                      onChange={(e) => handleChange('fuel_card_provider', e.target.value)}
                      placeholder="WEX / Comdata / EFS / Fleet One"
                      className="form-input"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                      Fuel Card Account #
                    </label>
                    <input
                      type="text"
                      value={form.fuel_card_account_num}
                      onChange={(e) => handleChange('fuel_card_account_num', e.target.value)}
                      placeholder="WEX-883910"
                      className="form-input font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: NOTES */}
          {activeTab === 'notes' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '6px' }}>
                Customer Compliance & Filing Notes
              </label>
              <textarea
                rows={10}
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                placeholder="Enter audit defense notes, state e-file login credentials, inspection notes, or special fuel tax instructions..."
                className="form-input"
                style={{ fontFamily: 'sans-serif' }}
              />
            </div>
          )}

          {/* TAB 5: EMPLOYEE ACCESS */}
          {activeTab === 'employee' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontSize: '13px', color: '#64748b' }}>
                Assign internal compliance personnel and dispatchers with permissions to manage this carrier:
              </div>

              {[
                { name: 'Compliance Administrator (Super Admin)', email: 'admin@fueltaxpulse.com' },
                { name: 'Senior Fleet Tax Manager', email: 'manager@fueltaxpulse.com' },
                { name: 'State DOT Auditor', email: 'auditor@fueltaxpulse.com' },
              ].map((emp, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '6px', border: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <input type="checkbox" defaultChecked id={`emp-${i}`} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  <label htmlFor={`emp-${i}`} style={{ fontSize: '13px', color: '#1e293b', cursor: 'pointer', flex: 1, margin: 0 }}>
                    <strong>{emp.name}</strong> — <span style={{ color: '#64748b' }}>{emp.email}</span>
                  </label>
                </div>
              ))}
            </div>
          )}

          {/* TAB 6: CUSTOMER ACCESS */}
          {activeTab === 'customer' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="portalToggle"
                  checked={form.customer_portal_enabled === 1}
                  onChange={(e) => handleChange('customer_portal_enabled', e.target.checked ? 1 : 0)}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="portalToggle" style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', cursor: 'pointer', margin: 0 }}>
                  Enable External Carrier Self-Service Portal Access
                </label>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 28px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Portal Username / Login Email
                  </label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => handleChange('contact_email', e.target.value)}
                    className="form-input"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: '#1e293b', marginBottom: '4px' }}>
                    Account Status
                  </label>
                  <select
                    value={form.portal_status}
                    onChange={(e) => handleChange('portal_status', e.target.value)}
                    className="form-input"
                  >
                    <option value="Active">Active</option>
                    <option value="Suspended">Suspended</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer (Screenshots 155 & 157 style: Blue 'Save Customer' + Gray 'Close') */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#ffffff',
          flexShrink: 0
        }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              background: '#0284c7', // Exact blue color from Screenshot (157).png
              color: '#ffffff',
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '4px',
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            {saving ? 'Saving...' : 'Save Customer'}
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#64748b', // Exact gray color from Screenshot (157).png
              color: '#ffffff',
              padding: '8px 24px',
              fontSize: '14px',
              fontWeight: '600',
              borderRadius: '4px',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
