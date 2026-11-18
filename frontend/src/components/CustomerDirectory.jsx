import React, { useState, useEffect } from 'react';
import { api } from '../api';
import CustomerMasterModal from './CustomerMasterModal';
import { Building, Plus, Edit, Trash2, Search, CheckCircle, ExternalLink, Phone, Mail, MapPin } from 'lucide-react';

export default function CustomerDirectory({ onSelectCustomerFleet }) {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editCustomerId, setEditCustomerId] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const data = await api.getCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customer directory:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setEditCustomerId(null);
    setShowModal(true);
  };

  const handleOpenEdit = (id) => {
    setEditCustomerId(id);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer master record?')) return;
    try {
      await api.deleteCustomer(id);
      loadCustomers();
    } catch (err) {
      alert(err.message || 'Failed to delete customer.');
    }
  };

  const filtered = customers.filter((c) => {
    const term = search.toLowerCase();
    return (
      c.company_name?.toLowerCase().includes(term) ||
      c.ifta_number?.toLowerCase().includes(term) ||
      c.contact_person?.toLowerCase().includes(term) ||
      c.city?.toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '-0.5px' }}>
              Customer Master Data
            </h2>
            <span className="badge badge-info">Carrier Tax Profiles</span>
          </div>
          <p style={{ fontSize: '13px', color: '#64748b' }}>
            Manage carrier entities, permit numbers (KYU, NM WDT, NY HUT, OR WMT), officers, and contact info.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="btn btn-primary"
        >
          <Plus size={16} /> Add Customer
        </button>
      </div>

      {/* Search Bar */}
      <div className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Search size={18} color="#94a3b8" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customer by company name, IFTA account #, or contact person..."
          style={{ border: 'none', outline: 'none', fontSize: '14px', width: '100%', background: 'transparent' }}
        />
      </div>

      {/* Customer Master Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
              <tr>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Company Name / DBA</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Base State</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>IFTA Account #</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>USDOT #</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Primary Contact</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Phone / Email</th>
                <th style={{ padding: '12px 16px', fontWeight: '700' }}>Carriage</th>
                <th style={{ padding: '12px 16px', fontWeight: '700', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    Loading customer profiles...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                    No customer records found. Click "+ Add Customer" to create one.
                  </td>
                </tr>
              ) : filtered.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: '700', color: '#0f172a' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Building size={16} color="#0284c7" />
                      <div>
                        <div>{c.company_name}</div>
                        {c.dba && <div style={{ fontSize: '11px', color: '#64748b', fontWeight: '400' }}>DBA: {c.dba}</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-info">{c.ifta_state || c.state || 'AR'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: '600' }}>
                    {c.ifta_number || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {c.dot_number || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', color: '#334155' }}>
                    {c.contact_person || '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '12px', color: '#64748b' }}>
                    {c.contact_phone && <div>{c.contact_phone}</div>}
                    {c.contact_email && <div style={{ color: '#0284c7' }}>{c.contact_email}</div>}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span className="badge badge-success">{c.carriage_type || 'Private'}</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                      <button
                        onClick={() => handleOpenEdit(c.id)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Edit Master Customer Information"
                      >
                        <Edit size={14} /> Edit Master
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="btn btn-sm"
                        style={{ padding: '4px 6px', background: 'transparent', border: 'none', color: '#94a3b8' }}
                        title="Delete Customer"
                        onMouseEnter={(e) => e.currentTarget.style.color = '#ef4444'}
                        onMouseLeave={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer Master Information Modal */}
      {showModal && (
        <CustomerMasterModal
          customerId={editCustomerId}
          onClose={() => setShowModal(false)}
          onSaved={loadCustomers}
        />
      )}
    </div>
  );
}
