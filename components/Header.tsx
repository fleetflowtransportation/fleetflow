import React from 'react';
import { useAppContext } from '../context/AppContext';
import { 
    TruckIcon, 
    LogoutIcon, 
    UserCircleIcon, 
    CalendarIcon, 
    DocumentReportIcon, 
    ArchiveIcon, 
    UsersIcon, 
    ExclamationIcon, 
    ViewGridIcon, 
    ClockIcon, 
    ClipboardListIcon,
    BuildingOfficeIcon,
    AdjustmentsIcon,
    WrenchScrewdriverIcon
} from './icons/Icons';

type NavView = 'dashboard' | 'bookings' | 'reports' | 'logs' | 'archive' | 'vehicles' | 'users' | 'calendar' | 'maintenance' | 'issues' | 'schedule' | 'settings';

interface HeaderProps {
  activeView: NavView;
  setActiveView: (view: NavView) => void;
}

const NavItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
}> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex items-center px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl transition-all ${
      isActive
        ? 'bg-indigo-700 text-white shadow-sm'
        : 'text-indigo-100 hover:bg-indigo-700/60 hover:text-white'
    }`}
  >
    {icon}
    <span className="ml-2.5">{label}</span>
  </button>
);

const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
    const { currentUser, activeTenant, logout } = useAppContext();
    
    const adminNavItems = [
        { view: 'dashboard', label: 'Dashboard', icon: <ViewGridIcon className="h-4 w-4" /> },
        { view: 'bookings', label: 'Bookings', icon: <ClipboardListIcon className="h-4 w-4" /> },
        { view: 'calendar', label: 'Calendar', icon: <CalendarIcon className="h-4 w-4" /> },
        { view: 'reports', label: 'Logs', icon: <DocumentReportIcon className="h-4 w-4" /> },
        { view: 'maintenance', label: 'Maintenance', icon: <WrenchScrewdriverIcon className="h-4 w-4" /> },
        { view: 'settings', label: 'Settings', icon: <AdjustmentsIcon className="h-4 w-4" /> },
    ];

    return (
        <header className="bg-indigo-900 shadow-md border-b border-indigo-800">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 sm:h-20">
                    <div className="flex items-center">
                        <div className="flex-shrink-0 bg-indigo-700/80 p-2.5 rounded-xl border border-indigo-500/30 shadow-inner">
                            <TruckIcon className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
                        </div>
                        <div className="ml-3 sm:ml-4">
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">FleetFlow</h1>
                                <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-full bg-indigo-700/70 text-indigo-200 border border-indigo-500/40 uppercase font-semibold">
                                    Enterprise
                                </span>
                            </div>
                            {activeTenant && (
                                <div className="flex items-center gap-1.5 text-xs text-indigo-200 font-medium mt-0.5">
                                    <BuildingOfficeIcon className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0" />
                                    <span className="truncate max-w-[160px] sm:max-w-[320px] font-semibold text-white/90">
                                        {activeTenant.companyName || activeTenant.name}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center">
                        {currentUser ? (
                            <div className="flex items-center space-x-3 sm:space-x-4">
                                <div className="flex items-center text-white bg-indigo-800/60 px-3 py-1.5 rounded-xl border border-indigo-700">
                                    <UserCircleIcon className="h-5 w-5 text-indigo-300 mr-2"/>
                                    <div className="text-left">
                                        <span className="text-xs sm:text-sm font-semibold block leading-tight">{currentUser.name}</span>
                                        <span className="text-[10px] text-indigo-300 uppercase font-medium block">
                                            {currentUser.role === 'admin' ? 'System Administrator' : currentUser.role === 'driver' ? 'Driver' : 'Staff'}
                                        </span>
                                    </div>
                                </div>
                                <button
                                    onClick={logout}
                                    className="flex items-center bg-indigo-700/80 hover:bg-indigo-600 text-white font-medium p-2 sm:px-3 sm:py-2 rounded-xl text-sm transition border border-indigo-600 shadow-sm active:scale-95"
                                    aria-label="Logout"
                                    title="Log Out"
                                >
                                    <LogoutIcon className="h-5 w-5" />
                                    <span className="hidden sm:inline ml-1.5 text-xs">Log Out</span>
                                </button>
                            </div>
                        ) : (
                            <span className="text-xs sm:text-sm font-medium text-indigo-300 bg-indigo-800/60 px-3 py-1.5 rounded-xl border border-indigo-700">
                                Public View
                            </span>
                        )}
                    </div>
                </div>
                {currentUser?.role === 'admin' && (
                    <nav className="pb-3 -mt-1 flex space-x-1.5 sm:space-x-2 overflow-x-auto no-scrollbar">
                        {adminNavItems.map(item => (
                             <NavItem 
                                key={item.view}
                                icon={item.icon}
                                label={item.label}
                                isActive={activeView === item.view}
                                onClick={() => setActiveView(item.view as NavView)}
                            />
                        ))}
                    </nav>
                )}
            </div>
        </header>
    );
};

export default Header;
