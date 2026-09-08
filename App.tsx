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
import StaffDashboard from './components/StaffDashboard';
import CalendarView from './components/CalendarView';
import IssueManagement from './components/IssueManagement';
import DriverScheduleManager from './components/DriverScheduleManager';

const App: React.FC = () => {
  const { currentUser, isLoading, loadError, reload } = useAppContext();
  const [activeView, setActiveView] = useState<'dashboard' | 'reports' | 'archive' | 'vehicles' | 'users' | 'calendar' | 'issues' | 'schedule'>('dashboard');

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Memuatkan data dari Google Sheet...</p>
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

  const renderAdminContent = () => {
    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'calendar':
        return (
          <div className="max-w-7xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Booking Calendar</h2>
            <CalendarView />
          </div>
        );
      case 'reports':
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
      default:
        return <AdminDashboard />;
    }
  };

  const renderContent = () => {
    if (!currentUser) {
      return <StaffDashboard />;
    }
    switch (currentUser.role) {
      case 'admin':
        return renderAdminContent();
      case 'driver':
        return <DriverDashboard driver={currentUser} />;
      default:
        return <StaffDashboard />; // Fallback to public view
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