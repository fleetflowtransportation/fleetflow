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
  isHidden?: boolean;
}

export const DriverSpeedDial: React.FC<DriverSpeedDialProps> = ({
  onOpenFuelLog,
  onOpenOdometer,
  onOpenIssueLog,
  onOpenFeedback,
  className = '',
  isHidden = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Close on Escape key press (always called unconditionally)
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

  // If hidden (e.g. when any modal popup is open in Driver UI), do not render
  if (isHidden) return null;

  const handleAction = (action: () => void) => {
    setIsOpen(false);
    action();
  };

  const speedDialItems = [
    {
      id: 'fuel',
      label: 'Fuel Log',
      icon: <FuelIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
      colorClass: 'bg-gradient-to-tr from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white ring-amber-300/60 shadow-amber-500/30',
      action: onOpenFuelLog,
    },
    {
      id: 'odometer',
      label: 'Odometer Log',
      icon: <GaugeIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
      colorClass: 'bg-gradient-to-tr from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white ring-emerald-300/60 shadow-emerald-500/30',
      action: onOpenOdometer,
    },
    {
      id: 'issue',
      label: 'Report Issue',
      icon: <WrenchScrewdriverIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
      colorClass: 'bg-gradient-to-tr from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white ring-rose-300/60 shadow-rose-500/30',
      action: onOpenIssueLog,
    },
    {
      id: 'feedback',
      label: 'Feedback',
      icon: <ChatBubbleIcon className="h-5 w-5 sm:h-6 sm:w-6" />,
      colorClass: 'bg-gradient-to-tr from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white ring-indigo-300/60 shadow-indigo-500/30',
      action: onOpenFeedback,
    },
  ];

  return (
    <>
      {/* Backdrop overlay when speed dial is open */}
      {isOpen && (
        <div 
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-slate-950/50 backdrop-blur-[3px] z-35 transition-opacity duration-200 animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* Floating Speed Dial Container — above bottom bars, below modals (z-40) */}
      <div 
        className={`fixed bottom-7 right-7 sm:bottom-8 sm:right-8 z-40 flex flex-col items-end select-none print:hidden ${className}`}
      >
        {/* Speed Dial Bubbles */}
        <div 
          className={`flex flex-col items-end space-y-3.5 mb-3.5 transition-all duration-300 ease-out origin-bottom ${
            isOpen 
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' 
              : 'opacity-0 scale-75 translate-y-6 pointer-events-none invisible'
          }`}
        >
          {speedDialItems.map((item, index) => (
            <div 
              key={item.id}
              className="flex items-center gap-3.5 group cursor-pointer"
              onClick={() => handleAction(item.action)}
              style={{
                transitionDelay: isOpen ? `${index * 35}ms` : '0ms',
              }}
            >
              {/* Text Pill Label */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(item.action);
                }}
                className="bg-slate-900/95 text-white text-xs sm:text-sm font-extrabold px-3.5 py-2 rounded-xl shadow-xl border border-slate-700/80 hover:bg-slate-800 transition-all duration-150 cursor-pointer active:scale-95 flex items-center gap-1.5 whitespace-nowrap backdrop-blur-md"
              >
                <span>{item.label}</span>
              </button>

              {/* Action Bubble Button — larger and tactile */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAction(item.action);
                }}
                className={`h-12 w-12 sm:h-13 sm:w-13 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 cursor-pointer active:scale-90 hover:scale-105 ring-2 ring-white/60 ${item.colorClass}`}
                title={item.label}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            </div>
          ))}
        </div>

        {/* Primary FAB Toggle Button — larger (16x16 / 64px) with safe margin from edge */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label={isOpen ? 'Close quick actions menu' : 'Open quick actions menu'}
          title={isOpen ? 'Close' : 'Quick Actions'}
          className={`group h-16 w-16 rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 cursor-pointer focus:outline-none focus:ring-4 active:scale-95 border-2 border-white/40 ${
            isOpen 
              ? 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-500 shadow-slate-900/50' 
              : 'bg-gradient-to-tr from-indigo-700 via-indigo-600 to-indigo-500 hover:from-indigo-600 hover:to-indigo-400 text-white focus:ring-indigo-300 shadow-indigo-600/50 hover:scale-105'
          }`}
        >
          <div 
            className={`transition-transform duration-300 ease-in-out transform ${
              isOpen ? 'rotate-45' : 'rotate-0'
            }`}
          >
            <PlusIcon className="h-8 w-8 stroke-[2.75]" />
          </div>
        </button>
      </div>
    </>
  );
};

export default DriverSpeedDial;
