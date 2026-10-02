import React, { useState } from 'react';
import { FeedbackModal } from './FeedbackModal';

interface FeedbackButtonProps {
  currentRoute?: string;
}

export const FeedbackButton: React.FC<FeedbackButtonProps> = ({ currentRoute = '/' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 print:hidden select-none">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="group flex items-center justify-center bg-indigo-900 hover:bg-indigo-800 text-white h-12 px-3.5 hover:px-4 rounded-full shadow-lg hover:shadow-xl border border-indigo-700/60 transition-all duration-300 ease-in-out cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 transform hover:-translate-y-0.5 active:translate-y-0"
          aria-label="Submit Feedback"
          title="Feedback"
        >
          <span className="text-xl shrink-0 transition-transform duration-300 group-hover:scale-110">
            💬
          </span>
          <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 group-hover:max-w-xs group-hover:opacity-100 group-hover:ml-2 text-xs sm:text-sm font-bold tracking-tight transition-all duration-300 ease-in-out">
            Feedback
          </span>
        </button>
      </div>

      <FeedbackModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentRoute={currentRoute}
      />
    </>
  );
};
