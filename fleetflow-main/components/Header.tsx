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
    ClockIcon
} from './icons/Icons';

type NavView = 'dashboard' | 'reports' | 'archive' | 'vehicles' | 'users' | 'calendar' | 'issues' | 'schedule';

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
    className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
      isActive
        ? 'bg-indigo-700 text-white'
        : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'
    }`}
  >
    {icon}
    <span className="ml-3">{label}</span>
  </button>
);


const Header: React.FC<HeaderProps> = ({ activeView, setActiveView }) => {
    const { currentUser, logout } = useAppContext();
    
    const adminNavItems = [
        { view: 'dashboard', label: 'Dashboard', icon: <ViewGridIcon className="h-5 w-5" /> },
        { view: 'calendar', label: 'Calendar', icon: <CalendarIcon className="h-5 w-5" /> },
        { view: 'schedule', label: 'Jadual Pemandu', icon: <ClockIcon className="h-5 w-5" /> },
        { view: 'reports', label: 'Reports', icon: <DocumentReportIcon className="h-5 w-5" /> },
        { view: 'issues', label: 'Issues', icon: <ExclamationIcon className="h-5 w-5" /> },
        { view: 'archive', label: 'Archive', icon: <ArchiveIcon className="h-5 w-5" /> },
        { view: 'vehicles', label: 'Vehicles', icon: <TruckIcon className="h-5 w-5" /> },
        { view: 'users', label: 'Users', icon: <UsersIcon className="h-5 w-5" /> },
    ];

    return (
        <header className="bg-indigo-800 shadow-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center">
                        <div className="flex-shrink-0">
                            <TruckIcon className="h-8 w-8 text-indigo-300" />
                        </div>
                        <div className="ml-4">
                            <h1 className="text-xl font-bold text-white">FleetFlow</h1>
                        </div>
                    </div>

                    <div className="flex items-center">
                        {currentUser ? (
                            <div className="flex items-center space-x-4">
                                <div className="flex items-center text-white">
                                    <UserCircleIcon className="h-6 w-6 text-indigo-300 mr-2"/>
                                    <span className="text-sm font-medium">{currentUser.name}</span>
                                </div>
                                <button
                                    onClick={logout}
                                    className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-3 rounded-md text-sm transition"
                                    aria-label="Logout"
                                >
                                    <LogoutIcon className="h-5 w-5" />
                                </button>
                            </div>
                        ) : (
                            <span className="text-sm font-medium text-indigo-300">Public View</span>
                        )}
                    </div>
                </div>
                {currentUser?.role === 'admin' && (
                    <nav className="pb-3 -mt-1 flex space-x-2 overflow-x-auto">
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
