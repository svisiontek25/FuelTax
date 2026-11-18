import React, { useState, useEffect } from 'react';
import { api } from '../api';
import {
  Truck, BarChart3, Users, FileSpreadsheet, UploadCloud, Layers,
  Fuel, Building, ShieldAlert, Calculator, Globe, LogOut, Settings
} from 'lucide-react';

export default function Navbar({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  quarter,
  setQuarter,
  fuelType,
  setFuelType,
  currentFleetId,
  setCurrentFleetId,
  onOpenCustomerMaster
}) {
  const [fleets, setFleets] = useState([]);

  useEffect(() => {
    loadFleets();
  }, []);

  const loadFleets = async () => {
    try {
      const data = await api.getFleets();
      setFleets(data);
      if (data.length > 0 && !currentFleetId) {
        setCurrentFleetId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to load fleets:', err);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'customers', label: 'Customer Master', icon: Users, badge: 'Master', badgeBg: '#542177' },
    { id: 'summary', label: 'Fleet Tax Summary', icon: FileSpreadsheet, badge: 'Schedule 1', badgeBg: '#5B6E2C' },
    { id: 'csv-ingestion', label: 'CSV Ingestion Hub', icon: UploadCloud, badge: 'Audit Safe', badgeBg: '#930031' },
    { id: 'mileage-grid', label: 'Mileage Grid', icon: Layers },
    { id: 'fuel', label: 'Fuel Ledger', icon: Fuel },
    { id: 'unit-summary', label: 'Unit Summary', icon: Truck },
    { id: 'units', label: 'Power Units', icon: Building },
    { id: 'trips', label: 'Trip Routing', icon: ShieldAlert },
    { id: 'calculator', label: 'IFTA Calculator', icon: Calculator },
    { id: 'rates', label: '58 Rates Matrix', icon: Globe },
  ];

  return (
    <header style={{
      background: 'linear-gradient(180deg, #1B365D 0%, #152b4b 100%)',
      borderBottom: '3px solid #60C1E5',
      color: '#ffffff',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      boxShadow: '0 4px 14px rgba(27, 54, 93, 0.2)'
    }}>
      {/* Top Bar: Brand, Multi-Fleet Switcher & Global Filters */}
      <div style={{
        maxWidth: '1440px',
        margin: '0 auto',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'nowrap',
        gap: '12px'
      }}>
        {/* Left: Brand & Fleet Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flexShrink: 1 }}>
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #60C1E5, #73A5CA)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(96, 193, 229, 0.35)',
            flexShrink: 0
          }}>
            <Truck size={20} color="#1B365D" strokeWidth={2.4} />
          </div>
          <div style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
            <div style={{ fontSize: '17px', fontWeight: '800', letterSpacing: '-0.3px', lineHeight: '1.2' }}>
              FuelTax<span style={{ color: '#60C1E5' }}>Pulse</span>
            </div>
            <div style={{ fontSize: '10px', color: '#9DBEB8', fontWeight: '500' }}>Multi-Fleet Compliance Portal</div>
          </div>

          {/* Multi-Fleet Switcher Pill */}
          <div style={{
            marginLeft: '6px',
            padding: '3px 8px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid #73A5CA',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            minWidth: 0
          }}>
            <Building size={13} color="#60C1E5" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '11px', color: '#9DBEB8', fontWeight: '600', flexShrink: 0 }}>Fleet:</span>
            <select
              value={currentFleetId || ''}
              onChange={(e) => setCurrentFleetId(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '170px',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                overflow: 'hidden'
              }}
            >
              {fleets.map((f) => (
                <option key={f.id} value={f.id} style={{ background: '#1B365D', color: '#ffffff' }}>
                  {f.legal_name || f.name} (Base: {f.base_jurisdiction})
                </option>
              ))}
            </select>

            <button
              onClick={() => onOpenCustomerMaster && onOpenCustomerMaster()}
              title="Edit Customer Information (Master Data)"
              style={{
                background: 'rgba(96, 193, 229, 0.16)',
                border: '1px solid rgba(96, 193, 229, 0.35)',
                borderRadius: '5px',
                color: '#60C1E5',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '3px 5px',
                flexShrink: 0
              }}
            >
              <Settings size={12} />
            </button>
          </div>
        </div>

        {/* Right: Global Filters (Quarter, Fuel) & System Super Administrator */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
          marginLeft: 'auto'
        }}>
          {/* Quarter Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: '#9DBEB8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Quarter:
            </span>
            <select
              value={quarter}
              onChange={(e) => setQuarter(e.target.value)}
              style={{
                width: 'auto',
                padding: '4px 8px',
                fontSize: '11.5px',
                fontWeight: '600',
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1px solid #73A5CA',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="2026-Q1" style={{ background: '#1B365D' }}>2026-Q1 (Jan - Mar)</option>
              <option value="2025-Q4" style={{ background: '#1B365D' }}>2025-Q4 (Oct - Dec)</option>
              <option value="2025-Q3" style={{ background: '#1B365D' }}>2025-Q3 (Jul - Sep)</option>
            </select>
          </div>

          {/* Fuel Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '11px', color: '#9DBEB8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              Fuel:
            </span>
            <select
              value={fuelType}
              onChange={(e) => setFuelType(e.target.value)}
              style={{
                width: 'auto',
                padding: '4px 8px',
                fontSize: '11.5px',
                fontWeight: '600',
                background: 'rgba(255,255,255,0.08)',
                color: '#ffffff',
                border: '1px solid #73A5CA',
                borderRadius: '6px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="Diesel" style={{ background: '#1B365D' }}>Diesel</option>
              <option value="Gasoline" style={{ background: '#1B365D' }}>Gasoline</option>
              <option value="Propane" style={{ background: '#1B365D' }}>Propane</option>
            </select>
          </div>

          <div style={{ height: '22px', width: '1px', background: 'rgba(157, 190, 184, 0.3)', margin: '0 2px' }} />

          {/* System Super Administrator User Profile Pill */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '3px 8px 3px 6px',
            borderRadius: '20px',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(115, 165, 202, 0.35)'
          }}>
            <div style={{
              width: '26px',
              height: '26px',
              borderRadius: '999px',
              background: 'linear-gradient(135deg, #542177, #930031)',
              border: '1.5px solid #60C1E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11.5px',
              fontWeight: '800',
              color: '#ffffff',
              boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
              flexShrink: 0
            }}>
              {user?.full_name ? user.full_name[0].toUpperCase() : 'S'}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.15', textAlign: 'left' }}>
              <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff', whiteSpace: 'nowrap' }}>
                {user?.full_name || 'System Super Administrator'}
              </span>
              <span style={{ fontSize: '9px', color: '#60C1E5', fontWeight: '600', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                System Super Administrator
              </span>
            </div>
            <button
              onClick={onLogout}
              title="Sign Out"
              style={{
                marginLeft: '2px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(157,190,184,0.25)',
                color: '#9DBEB8',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '4px',
                borderRadius: '5px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = '#E00000';
                e.currentTarget.style.borderColor = '#E00000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#9DBEB8';
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.borderColor = 'rgba(157,190,184,0.25)';
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Sub Bar: Navigation Tabs (No Horizontal Scroll) */}
      <div style={{
        background: 'rgba(15, 31, 56, 0.65)',
        borderTop: '1px solid rgba(115, 165, 202, 0.2)'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          padding: '4px 16px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '2px 4px'
        }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  fontWeight: isActive ? '700' : '500',
                  color: isActive ? '#60C1E5' : '#cbd8d5',
                  background: isActive ? 'rgba(96, 193, 229, 0.12)' : 'transparent',
                  border: 'none',
                  borderBottom: isActive ? '2.5px solid #60C1E5' : '2.5px solid transparent',
                  borderRadius: '6px 6px 0 0',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease'
                }}
              >
                <Icon size={14} color={isActive ? '#60C1E5' : '#9DBEB8'} />
                <span>{item.label}</span>
                {item.badge && (
                  <span style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    padding: '1px 6px',
                    borderRadius: '999px',
                    background: item.badgeBg || '#73A5CA',
                    color: '#ffffff',
                    letterSpacing: '0.2px'
                  }}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
