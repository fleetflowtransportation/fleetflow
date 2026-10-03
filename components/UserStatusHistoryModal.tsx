import React from 'react';
import { User, UserStatusLog } from '../types';
import { XIcon } from './icons/Icons';
import { parseAsLocal } from '../utils';

interface UserStatusHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User | null;
}

export const UserStatusHistoryModal: React.FC<UserStatusHistoryModalProps> = ({
  isOpen,
  onClose,
  user,
}) => {
  if (!isOpen || !user) return null;

  const history: UserStatusLog[] = user.statusHistory && user.statusHistory.length > 0
    ? [...user.statusHistory].reverse()
    : [];

  const getActionBadge = (action: UserStatusLog['action']) => {
    switch (action) {
      case 'created':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
            Account Created
          </span>
        );
      case 'deactivated':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
            Deactivated
          </span>
        );
      case 'reactivated':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            Reactivated
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200">
            Status Updated
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="min-w-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Lifecycle & Status History Audit Trail
            </span>
            <h3 className="text-base sm:text-lg font-black tracking-tight truncate">
              {user.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Current State Summary Pill */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 font-semibold">Current Status:</span>
            <span className={`font-black px-2.5 py-0.5 rounded-full text-[11px] ${
              user.status === 'active' 
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                : 'bg-rose-100 text-rose-800 border border-rose-300'
            }`}>
              {user.status === 'active' ? 'Active' : 'Inactive'}
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-slate-600 font-bold">
              {user.employmentType === 'part_time' ? 'Part-Time' : 'Full-Time'}
            </span>
          </div>
          <span className="text-[11px] text-slate-400">
            Joined: {parseAsLocal(user.joiningDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>

        {/* Timeline Log List */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {history.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <svg className="w-10 h-10 mx-auto text-slate-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-bold text-slate-600">No status transitions recorded yet</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Account was registered on {parseAsLocal(user.joiningDate).toLocaleDateString('en-GB')}.
              </p>
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-3 space-y-5">
              {history.map((log) => {
                const logTime = new Date(log.timestamp).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                });

                const effectiveDateStr = log.effectiveDate
                  ? parseAsLocal(log.effectiveDate).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : null;

                return (
                  <div key={log.id} className="relative pl-6">
                    {/* Circle Node */}
                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white bg-indigo-600 shadow-xs" />

                    <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          {getActionBadge(log.action)}
                          <span className="text-[11px] text-slate-400 font-medium">
                            {logTime}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600">
                          By: {log.performedBy || 'Admin'}
                        </span>
                      </div>

                      {effectiveDateStr && (
                        <div className="text-xs text-slate-700 font-semibold">
                          <span>Effective Date: </span>
                          <span className="font-extrabold text-slate-900">{effectiveDateStr}</span>
                        </div>
                      )}

                      {log.reason && (
                        <div className="text-xs bg-white p-2.5 rounded-xl border border-slate-200 text-slate-700">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
                            Reason / Remarks:
                          </span>
                          <p className="italic">"{log.reason}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserStatusHistoryModal;
