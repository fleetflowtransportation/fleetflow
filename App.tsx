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
import DriverScheduleManager from './components/DriverScheduleManager';
import BookingManagementList from './components/BookingManagementList';
import { AuthPage } from './components/AuthPage';
import { PublicBookingPage } from './components/PublicBookingPage';
import { SettingsView } from './components/SettingsView';

const App: React.FC = () => {
  const { currentUser, isLoading, loadError, reload } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'bookings' | 'reports' | 'logs' | 'archive' | 'vehicles' | 'users' | 'calendar' | 'issues' | 'schedule' | 'settings'>('dashboard');

  // Cek pautan borang tempahan awam (tanpa log masuk)
  const urlParams = new URLSearchParams(window.location.search);
  const isPublicBooking = urlParams.get('action') === 'book';
  const publicTenantId = urlParams.get('tenant_id');

  if (isPublicBooking && publicTenantId) {
    return <PublicBookingPage tenantId={publicTenantId} />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuatkan data dari pangkalan data...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-semibold mb-2">Gagal memuatkan data</p>
          <p className="text-gray-600 text-sm mb-4">{loadError}</p>
          <button
            onClick={reload}
            className="px-4 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700"
          >
            Cuba lagi
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
        return <BookingArchive />;
      case 'vehicles':
        return <VehicleManagement />;
      case 'users':
        return <UserManagement />;
      case 'issues':
        return <IssueManagement />;
      case 'schedule':
        return <DriverScheduleManager />;
      case 'settings':
        return <SettingsView />;
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
