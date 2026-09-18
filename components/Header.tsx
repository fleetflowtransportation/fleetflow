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

type NavView = 'dashboard' | 'reports' | 'logs' | 'archive' | 'vehicles' | 'users' | 'calendar' | 'issues' | 'schedule' | 'settings';

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
        { view: 'reports', label: 'Logs', icon: <DocumentReportIcon className="h-5 w-5" /> },
        { view: 'issues', label: 'Issues', icon: <ExclamationIcon className="h-5 w-5" /> },
        { view: 'archive', label: 'Archive', icon: <ArchiveIcon className="h-5 w-5" /> },
        { view: 'vehicles', label: 'Vehicles', icon: <TruckIcon className="h-5 w-5" /> },
        { view: 'users', label: 'Users', icon: <UsersIcon className="h-5 w-5" /> },
        { view: 'settings', label: 'Settings', icon: (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.43l-1.003.828c-.293.241-.438.613-.43.992a7.723 7.723 0 010 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.43l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 010-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ) },
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
