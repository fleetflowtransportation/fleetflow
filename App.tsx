import React, { useState } from 'react';
import { AppProvider, useAppContext } from './context/AppContext';
import Header from './components/Header';
import AdminDashboard from './components/AdminDashboard';
import DriverDashboard from './components/DriverDashboard';
import Reports from './components/Reports';
import UndoToast from './components/UndoToast';
import BookingArchive from './components/BookingArchive';
import VehicleManagement from './components/VehicleManagement';
import UserManagement from './components/UserManagement';
import CalendarView from './components/CalendarView';
import IssueManagement from './components/IssueManagement';
import MaintenanceManagement from './components/MaintenanceManagement';
import DriverScheduleManager from './components/DriverScheduleManager';
import BookingManagementList from './components/BookingManagementList';
import { AuthPage } from './components/AuthPage';
import { PublicBookingPage } from './components/PublicBookingPage';
import { PublicOdometerPage } from './components/PublicOdometerPage';
import { SettingsView } from './components/SettingsView';

const App: React.FC = () => {
  const { currentUser, isLoading, loadError, reload } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'bookings' | 'reports' | 'logs' | 'archive' | 'vehicles' | 'users' | 'self-drive' | 'calendar' | 'maintenance' | 'issues' | 'schedule' | 'settings'>('dashboard');

  // Check public action URLs (booking form or self-drive odometer portal)
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const publicTenantId = urlParams.get('tenant_id') || 'yayasan-chow-kit';

  if (action === 'book') {
    return <PublicBookingPage tenantId={publicTenantId} initialTab="form" />;
  }

  if (action === 'calendar') {
    return <PublicBookingPage tenantId={publicTenantId} initialTab="calendar" />;
  }

  if (action === 'odometer') {
    return <PublicOdometerPage tenantId={publicTenantId} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading fleet data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-semibold mb-2">Failed to load data</p>
          <p className="text-gray-600 text-sm mb-4">{loadError}</p>
          <button
            onClick={reload}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthPage />;
  }

  const renderAdminContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'bookings':
        return <BookingManagementList />;
      case 'calendar':
        return (
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Booking Calendar</h2>
            <CalendarView />
          </div>
        );
      case 'reports':
      case 'logs':
        return <Reports />;
      case 'archive':
        return <SettingsView initialSubTab="archive" />;
      case 'vehicles':
        return <SettingsView initialSubTab="vehicles" />;
      case 'users':
        return <SettingsView initialSubTab="users" />;
      case 'self-drive':
        return <SettingsView initialSubTab="self-drive" />;
      case 'maintenance':
      case 'issues':
        return <MaintenanceManagement />;
      case 'schedule':
        return <SettingsView initialSubTab="schedule" />;
      case 'settings':
        return <SettingsView initialSubTab="profile" />;
      default:
        return <AdminDashboard />;
    }
  };

  const renderContent = () => {
    switch (currentUser.role) {
      case 'admin':
        return renderAdminContent();
      case 'driver':
        return <DriverDashboard driver={currentUser} />;
      default:
        return <AuthPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <Header
        activeView={activeView}
        setActiveView={(view) => {
          setActiveView(view);
          if (currentUser?.role !== 'admin') {
              // Reset to a default view if a non-admin somehow tries to switch views
          }
        }}
      />
      <main className="p-4 sm:p-6 lg:p-8">
        {renderContent()}
      </main>
      <UndoToast />
    </div>
  );
};

const AppWrapper: React.FC = () => (
  <AppProvider>
    <App />
  </AppProvider>
);

export default AppWrapper;
