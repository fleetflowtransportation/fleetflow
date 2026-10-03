import React from 'react';
import { User } from '../types';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal } from '../utils';

interface InactiveAccountScreenProps {
  user: User;
}

export const InactiveAccountScreen: React.FC<InactiveAccountScreenProps> = ({ user }) => {
  const { logout, tenantProfile, users } = useAppContext();

  // Find organization contact info or primary administrator
  const primaryAdmin = users.find(u => u.isOwner) || users.find(u => u.role === 'admin');
  const contactPhone = tenantProfile?.whatsapp || tenantProfile?.phone || primaryAdmin?.phone || '';
  const contactEmail = tenantProfile?.email || primaryAdmin?.email || '';
  const cleanPhone = contactPhone.replace(/[^0-9]/g, '');

  const formattedTerminationDate = user.terminationDate
    ? parseAsLocal(user.terminationDate).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-lg w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Top Warning Banner */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="w-16 h-16 mx-auto mb-3 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <span className="inline-block px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-black/25 backdrop-blur-xs text-white border border-white/20 mb-2">
            Access Restricted
          </span>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight">
            Account Inactive
          </h1>
          <p className="text-xs sm:text-sm text-white/90 mt-1 max-w-sm mx-auto">
            Your driver profile is currently deactivated. You cannot access trip schedules or submit logs.
          </p>
        </div>

        {/* User Profile Card Summary */}
        <div className="p-6 space-y-5">
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Driver Name
                </span>
                <h2 className="text-base font-extrabold text-slate-900 truncate">
                  {user.name}
                </h2>
                <span className="text-xs text-slate-500 block">
                  {user.email || user.phone}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                {user.employmentType === 'part_time' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-purple-100 text-purple-800 border border-purple-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-600"></span>
                    Part-Time Driver
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600"></span>
                    Full-Time Driver
                  </span>
                )}
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200">
                  Status: Inactive
                </span>
              </div>
            </div>

            {/* Termination or Inactive Details */}
            {(formattedTerminationDate || user.terminationReason) && (
              <div className="mt-4 pt-3 border-t border-slate-200/60 space-y-2">
                {formattedTerminationDate && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-semibold">Service / Contract End:</span>
                    <span className="font-extrabold text-slate-800">{formattedTerminationDate}</span>
                  </div>
                )}
                {user.terminationReason && (
                  <div className="text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                      Notice / Remarks
                    </span>
                    <p className="text-slate-700 font-medium italic">
                      "{user.terminationReason}"
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Contact Administrator Section */}
          <div className="space-y-3">
            <div className="text-center">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                Need to reactivate your access?
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Please contact the fleet administrator or dispatch supervisor to reactivate your driver profile.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {cleanPhone && (
                <a
                  href={`https://wa.me/${cleanPhone.startsWith('6') ? cleanPhone : '60' + cleanPhone.replace(/^0/, '')}?text=Salam%20Admin,%20saya%20(${encodeURIComponent(user.name)})%20ingin%20memohon%20pengaktifan%20semula%20akaun%20pemandu.`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                  </svg>
                  <span>WhatsApp Admin</span>
                </a>
              )}

              {contactPhone ? (
                <a
                  href={`tel:${contactPhone}`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span>Call Admin ({contactPhone})</span>
                </a>
              ) : contactEmail ? (
                <a
                  href={`mailto:${contactEmail}?subject=Driver%20Account%20Reactivation%20Request%20-%20${encodeURIComponent(user.name)}`}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-md transition active:scale-95"
                >
                  <span>Email Admin</span>
                </a>
              ) : null}
            </div>
          </div>

          {/* Logout / Switch Account Button */}
          <div className="pt-2 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer active:scale-98"
            >
              Sign Out / Switch Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InactiveAccountScreen;
