import React, { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { ReplyIcon } from './icons/Icons';

const UndoToast: React.FC = () => {
  const { lastBookingChange, undoLastBookingChange } = useAppContext();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (lastBookingChange) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [lastBookingChange]);

  const handleUndo = () => {
    undoLastBookingChange();
    setIsVisible(false);
  };

  if (!lastBookingChange) {
    return null;
  }
  
  const destination = lastBookingChange.previousState.destination;

  return (
    <div 
        className={`fixed bottom-5 right-5 z-50 transform transition-all duration-300 ease-in-out ${
            isVisible ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
        }`}
        role="alert"
        aria-live="assertive"
    >
      <div className="bg-gray-800 text-white rounded-lg shadow-lg flex items-center justify-between p-3 pl-4 space-x-4">
        <span className="text-sm">
            Booking for <span className="font-semibold">{destination}</span> updated.
        </span>
        <button
          onClick={handleUndo}
          className="flex items-center text-sm font-semibold text-indigo-400 hover:text-indigo-300 px-3 py-1 rounded-md bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50"
          aria-label="Undo last booking change"
        >
          <ReplyIcon className="h-4 w-4 mr-1.5" />
          Undo
        </button>
      </div>
    </div>
  );
};

export default UndoToast;
