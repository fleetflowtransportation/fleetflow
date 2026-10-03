import React, { useState, useEffect } from 'react';
import { 
  PlusIcon, 
  FuelIcon, 
  GaugeIcon, 
  WrenchScrewdriverIcon, 
  ChatBubbleIcon 
} from './icons/Icons';

interface DriverSpeedDialProps {
  onOpenFuelLog: () => void;
  onOpenOdometer: () => void;
  onOpenIssueLog: () => void;
  onOpenFeedback: () => void;
  className?: string;
}

export const DriverSpeedDial: React.FC<DriverSpeedDialProps> = ({
  onOpenFuelLog,
  onOpenOdometer,
  onOpenIssueLog,
  onOpenFeedback,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const speedDialItems = [
    {
      id: 'fuel',
      label: 'Fuel Log',
      icon: <FuelIcon className="h-5 w-5" />,
      colorClass: 'bg-amber-500 hover:bg-amber-600 text-white ring-amber-300',
      action: onOpenFuelLog,
      description: 'Record fuel receipt & liters',
    },
    {
      id: 'odometer',
      label: 'Odometer Log',
      icon: <GaugeIcon className="h-5 w-5" />,
      colorClass: 'bg-emerald-600 hover:bg-emerald-700 text-white ring-emerald-300',
      action: onOpenOdometer,
      description: 'Submit odometer mileage',
    },
    {
      id: 'issue',
      label: 'Report Issue',
      icon: <WrenchScrewdriverIcon className="h-5 w-5" />,
      colorClass: 'bg-rose-500 hover:bg-rose-600 text-white ring-rose-300',
      action: onOpenIssueLog,
      description: 'Report vehicle problem & photo',
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: <ChatBubbleIcon className="h-5 w-5" />,
      colorClass: 'bg-indigo-600 hover:bg-indigo-700 text-white ring-indigo-300',
      action: onOpenFeedback,
      description: 'Share app suggestions or ideas',
    },
  ];

  return (
    <>
      {/* Backdrop overlay when speed dial is open */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-[2px] z-40 transition-opacity duration-200 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* Floating Speed Dial Container */}
      <div 
        className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end select-none print:hidden ${className}`}
      >
        {/* Speed Dial Bubbles */}
        <div 
          className={`flex flex-col items-end space-y-3 mb-3 transition-all duration-300 ease-out origin-bottom ${
            isOpen 
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 scale-75 translate-y-6 pointer-events-none invisible'
          }`}
        >
          {speedDialItems.map((item, index) => (
            <div 
              key={item.id}
              className="flex items-center gap-3 group"
              style={{
                transitionDelay: isOpen ? `${index * 35}ms` : '0ms',
              }}
            >
              {/* Text Pill Label */}
              <button
                type="button"
                onClick={() => handleAction(item.action)}
                className="bg-slate-900/90 text-white text-xs sm:text-sm font-extrabold px-3 py-1.5 rounded-xl shadow-lg border border-slate-700/80 hover:bg-slate-900 transition-all duration-150 cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md"
              >
                <span>{item.label}</span>
              </button>

              {/* Action Bubble Button */}
              <button
                type="button"
                onClick={() => handleAction(item.action)}
                className={`h-11 w-11 sm:h-12 sm:w-12 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 hover:scale-105 ring-2 ring-white/40 ${item.colorClass}`}
                title={item.label}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Primary FAB Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
          title={isOpen ? 'Close' : 'Quick Actions'}
          className={`group h-13 w-13 sm:h-14 sm:w-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none focus:ring-4 active:scale-95 border border-white/20 ${
            isOpen 
              ? 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500 shadow-slate-900/40' 
              : 'bg-indigo-600 hover:bg-indigo-500 text-white focus:ring-indigo-300 shadow-indigo-600/40 hover:scale-105'
          }`}
        >
          <div 
            className={`transition-transform duration-300 ease-in-out transform ${
              isOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            <PlusIcon className="h-6 w-6 sm:h-7 sm:w-7 stroke-[2.5]" />
          </div>
        </button>
      </div>
    </>
  );
};

export default DriverSpeedDial;
