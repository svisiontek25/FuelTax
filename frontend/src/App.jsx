import React, { useState, useEffect } from 'react';
import { getAuthToken, getStoredUser, removeAuthToken } from './api';
import LandingPage from './components/LandingPage';
import Auth from './components/Auth';
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import FleetSummaryReport from './components/FleetSummaryReport';
import CustomerDirectory from './components/CustomerDirectory';
import CustomerMasterModal from './components/CustomerMasterModal';
import CsvIngestionHub from './components/CsvIngestionHub';
import MileageGrid from './components/MileageGrid';
import UnitSummaryReport from './components/UnitSummaryReport';
import PowerUnits from './components/PowerUnits';
import TripEntry from './components/TripEntry';
import FuelLedger from './components/FuelLedger';
import QuickCalculator from './components/QuickCalculator';
import StateRates from './components/StateRates';
import { ShieldCheck, Truck } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(getStoredUser());
  const [token, setToken] = useState(getAuthToken());
  const [authView, setAuthView] = useState('landing'); // 'landing', 'login', 'register'

  // Global app filters
  const [currentFleetId, setCurrentFleetId] = useState(null);
  const [quarter, setQuarter] = useState('2026-Q1');
  const [fuelType, setFuelType] = useState('Diesel');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showDirectMasterModal, setShowDirectMasterModal] = useState(false);

  useEffect(() => {
    if (user?.default_fleet_id && !currentFleetId) {
      setCurrentFleetId(user.default_fleet_id);
    }
  }, [user]);

  const handleAuthSuccess = (userData) => {
    setUser(userData);
    setToken(getAuthToken());
    if (userData.default_fleet_id) {
      setCurrentFleetId(userData.default_fleet_id);
    }
  };

  const handleLogout = () => {
    removeAuthToken();
    localStorage.removeItem('fueltaxpulse_user');
    setUser(null);
    setToken(null);
  };

  // If unauthenticated, render Landing Page or Auth view
  if (!user || !token) {
    if (authView === 'landing') {
      return (
        <LandingPage
          onNavigateAuth={(mode) => setAuthView(mode || 'login')}
        />
      );
    }
    return (
      <Auth
        initialMode={authView}
        onAuthSuccess={handleAuthSuccess}
        onBackToHome={() => setAuthView('landing')}
      />
    );
  }

  return (
    <div className="app-container">
      {/* Top Navigation Bar with Fleet Switcher */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        quarter={quarter}
        setQuarter={setQuarter}
        fuelType={fuelType}
        setFuelType={setFuelType}
        currentFleetId={currentFleetId}
        setCurrentFleetId={setCurrentFleetId}
        onOpenCustomerMaster={() => setShowDirectMasterModal(true)}
      />

      {/* Main Content Workspace */}
      <main className="main-content">
        {activeTab === 'dashboard' && (
          <Dashboard
            setActiveTab={setActiveTab}
            quarter={quarter}
            fuelType={fuelType}
            user={user}
            currentFleetId={currentFleetId}
          />
        )}

        {activeTab === 'customers' && (
          <CustomerDirectory
            onSelectCustomerFleet={(id) => setCurrentFleetId(id)}
          />
        )}

        {activeTab === 'summary' && (
          <FleetSummaryReport
            currentFleetId={currentFleetId}
            quarter={quarter}
            fuelType={fuelType}
            user={user}
          />
        )}

        {activeTab === 'csv-ingestion' && (
          <CsvIngestionHub
            currentFleetId={currentFleetId}
            quarter={quarter}
            onDataImported={() => setActiveTab('summary')}
          />
        )}

        {(activeTab === 'mileage-grid' || activeTab === 'mileage') && (
          <MileageGrid
            currentFleetId={currentFleetId}
            quarter={quarter}
            onDataLogged={() => setActiveTab('summary')}
          />
        )}

        {(activeTab === 'unit-summary' || activeTab === 'units_summary') && (
          <UnitSummaryReport
            currentFleetId={currentFleetId}
            quarter={quarter}
            fuelType={fuelType}
          />
        )}

        {(activeTab === 'power-units' || activeTab === 'units') && (
          <PowerUnits
            currentFleetId={currentFleetId}
          />
        )}

        {activeTab === 'trips' && (
          <TripEntry
            quarter={quarter}
            currentFleetId={currentFleetId}
            onNavigateToUnits={() => setActiveTab('power-units')}
          />
        )}

        {activeTab === 'fuel' && (
          <FuelLedger
            quarter={quarter}
            fuelType={fuelType}
            currentFleetId={currentFleetId}
          />
        )}

        {activeTab === 'calculator' && (
          <QuickCalculator
            quarter={quarter}
            fuelType={fuelType}
          />
        )}

        {activeTab === 'rates' && (
          <StateRates
            quarter={quarter}
            fuelType={fuelType}
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{
        background: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        padding: '20px 24px',
        fontSize: '12px',
        color: '#64748b',
        marginTop: 'auto'
      }}>
        <div style={{
          maxWidth: '1440px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '20px',
              height: '20px',
              borderRadius: '6px',
              background: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Truck size={12} color="#ffffff" />
            </div>
            <span style={{ fontWeight: '700', color: '#0f172a' }}>FuelTaxPulse Enterprise</span>
            <span>• Multi-Fleet IFTA Compliance Suite</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontWeight: '600' }}>
              <ShieldCheck size={14} /> 4-Year IFTA Audit Trail Preserved
            </span>
            <span>58 Member Jurisdictions</span>
            <span>Version 2.0.0</span>
          </div>
        </div>
      </footer>
      {/* Direct Customer Master Modal */}
      {showDirectMasterModal && (
        <CustomerMasterModal
          customerId="cust-2aab-trucking"
          onClose={() => setShowDirectMasterModal(false)}
          onSaved={() => setShowDirectMasterModal(false)}
        />
      )}
    </div>
  );
}
