import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import ProfileSettings from './ProfileSettings';
import DriverScheduleManager from './DriverScheduleManager';
import UserManagement from './UserManagement';
import VehicleManagement from './VehicleManagement';
import BookingArchive from './BookingArchive';
import IntegrationsSettings from './IntegrationsSettings';
import { 
  BuildingOfficeIcon,
  ClockIcon,
  UsersIcon,
  TruckIcon,
  ArchiveIcon,
  AdjustmentsIcon,
  SparklesIcon
} from './icons/Icons';

export type SettingsSubTab = 'profile' | 'schedule' | 'users' | 'vehicles' | 'archive' | 'integrations';

export interface SettingsViewProps {
  initialSubTab?: SettingsSubTab;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSubTab = 'profile' }) => {
  const [activeSubTab, setActiveSubTab] = useState<SettingsSubTab>(initialSubTab);
  const { users, vehicles, bookings, driverSchedules } = useAppContext();

  useEffect(() => {
    if (initialSubTab) {
      setActiveSubTab(initialSubTab);
    }
  }, [initialSubTab]);

  const archivedCount = bookings.filter(b => b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'Rejected').length;
  const userCount = users.length;
  const vehicleCount = vehicles.length;
  const scheduleCount = driverSchedules.length;

  const tabs: { id: SettingsSubTab; label: string; icon: React.ReactNode; badge?: string | number; description: string }[] = [
    {
      id: 'profile',
      label: 'Organization Profile',
      icon: <BuildingOfficeIcon className="w-4 h-4" />,
      description: 'Company name, address, contact numbers & official organization details',
    },
    {
      id: 'schedule',
      label: 'Driver Schedules',
      icon: <ClockIcon className="w-4 h-4" />,
      badge: scheduleCount > 0 ? scheduleCount : undefined,
      description: 'Shift management, driver availability, on-duty hours & weekly rosters',
    },
    {
      id: 'users',
      label: 'Users & Drivers',
      icon: <UsersIcon className="w-4 h-4" />,
      badge: userCount,
      description: 'Administrative staff accounts, roles, and driver profiles',
    },
    {
      id: 'vehicles',
      label: 'Vehicles',
      icon: <TruckIcon className="w-4 h-4" />,
      badge: vehicleCount,
      description: 'Fleet vehicle assets, seating capacity, plate numbers & specifications',
    },
    {
      id: 'archive',
      label: 'Booking Archive',
      icon: <ArchiveIcon className="w-4 h-4" />,
      badge: archivedCount,
      description: 'Historical trip logs, past booking records & archived requests',
    },
    {
      id: 'integrations',
      label: 'Integrations & System',
      icon: <AdjustmentsIcon className="w-4 h-4" />,
      description: 'Google Calendar, Drive, Apps Script Webhook & public booking link',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white rounded-2xl p-6 shadow-sm border border-gray-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1">
            <SparklesIcon className="w-4 h-4" />
            <span>Admin Control Center</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Settings & System Management</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage organization profile, driver schedules, users, vehicles, booking archives, and cloud integrations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100">
            6 Management Modules
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="bg-white rounded-2xl p-2 shadow-sm border border-gray-200">
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto no-scrollbar py-1">
          {tabs.map((tab) => {
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-200 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200 transform scale-[1.02]'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-gray-400'}>{tab.icon}</span>
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full transition ${
                      isActive ? 'bg-indigo-700 text-indigo-100' : 'bg-gray-200 text-gray-700'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sub-Module Content */}
      <div className="transition-all duration-300 ease-in-out">
        {activeSubTab === 'profile' && <ProfileSettings />}
        {activeSubTab === 'schedule' && (
          <div className="space-y-4">
            <DriverScheduleManager readOnly={false} />
          </div>
        )}
        {activeSubTab === 'users' && <UserManagement />}
        {activeSubTab === 'vehicles' && <VehicleManagement />}
        {activeSubTab === 'archive' && <BookingArchive />}
        {activeSubTab === 'integrations' && <IntegrationsSettings />}
      </div>
    </div>
  );
};

export default SettingsView;
