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
import { FeedbackButton } from './components/FeedbackButton';
import { InactiveAccountScreen } from './components/InactiveAccountScreen';

const App: React.FC = () => {
  const { currentUser, users, isLoading, loadError, reload } = useAppContext();
  
  type NavView = 'dashboard' | 'bookings' | 'reports' | 'logs' | 'archive' | 'vehicles' | 'users' | 'self-drive' | 'calendar' | 'maintenance' | 'issues' | 'schedule' | 'settings';

  const getViewFromPath = (): NavView => {
    const path = window.location.pathname.replace(/^\/+/, '').toLowerCase();
    if (!path || path === '' || path === 'dashboard') return 'dashboard';
    if (path === 'bookings') return 'bookings';
    if (path === 'calendar') return 'calendar';
    if (path === 'reports' || path === 'fuel' || path === 'logs') return 'reports';
    if (path === 'maintenance' || path === 'issues') return 'maintenance';
    if (path === 'vehicles') return 'vehicles';
    if (path === 'users') return 'users';
    if (path === 'schedule') return 'schedule';
    if (path === 'self-drive') return 'self-drive';
    if (path === 'archive') return 'archive';
    if (path.startsWith('settings')) return 'settings';
    return 'dashboard';
  };

  const [activeView, setActiveView] = useState<NavView>(getViewFromPath);

  React.useEffect(() => {
    const handlePopState = () => {
      setActiveView(getViewFromPath());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleSetView = (view: NavView) => {
    setActiveView(view);
    const targetPath = view === 'dashboard' ? '/' : `/${view}`;
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, '', targetPath);
    }
  };

  // Check public action URLs (booking form or self-drive odometer portal)
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  const publicTenantId = urlParams.get('tenant_id') || '';

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

  const adminContent = React.useMemo(() => {
    switch (activeView) {
      case 'dashboard':
        return <AdminDashboard />;
      case 'bookings':
        return <BookingManagementList />;
      case 'calendar':
        return (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
                  <span>Fleet Calendar</span>
                  <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                    Live Schedule
                  </span>
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  Interactive multi-view calendar for vehicle trips, driver assignments, and booking schedules.
                </p>
              </div>
            </div>
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
  }, [activeView]);

  const driverContent = React.useMemo(() => {
    if (!currentUser || currentUser.role !== 'driver') return null;
    const fullDriver = users.find(u => u.id === currentUser.id);
    if (fullDriver && fullDriver.status === 'inactive') {
      return <InactiveAccountScreen user={fullDriver} />;
    }
    return <DriverDashboard driver={currentUser} />;
  }, [currentUser, users]);

  const renderContent = () => {
    switch (currentUser.role) {
      case 'admin':
        return adminContent;
      case 'driver':
        return driverContent;
      default:
        return <AuthPage />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans text-gray-800">
      <Header
        activeView={activeView}
        setActiveView={handleSetView}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {renderContent()}
      </main>
      <UndoToast />
      {currentUser?.role !== 'driver' && (
        <FeedbackButton currentRoute={currentUser?.role === 'admin' ? activeView : 'driver-portal'} />
      )}
    </div>
  );
};

const AppWrapper: React.FC = () => (
  <AppProvider>
    <App />
  </AppProvider>
);

export default AppWrapper;
