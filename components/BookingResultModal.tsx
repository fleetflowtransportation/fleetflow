import React from 'react';
import type { AutoAssignResult } from '../services/bookingEngine';
import { CheckCircleIcon, XCircleIcon, InformationCircleIcon, ClockIcon, CalendarIcon, TruckIcon, UserCircleIcon, XIcon } from './icons/Icons';

interface BookingResultModalProps {
  isOpen: boolean;
  result: AutoAssignResult | null;
  onClose: () => void;
}

const colorBadgeStyle = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  grey: 'bg-gray-100 text-gray-800 border-gray-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
};

export const BookingResultModal: React.FC<BookingResultModalProps> = ({ isOpen, result, onClose }) => {
  if (!isOpen || !result) return null;

  const isConfirmed = result.status === 'Confirmed';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto flex flex-col border border-gray-100">
        {/* Header */}
        <div className={`p-5 flex items-start justify-between border-b ${isConfirmed ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
          <div className="flex items-center space-x-3">
            {isConfirmed ? (
              <div className="p-2 bg-emerald-100 rounded-full">
                <CheckCircleIcon className="h-7 w-7 text-emerald-600" />
              </div>
            ) : (
              <div className="p-2 bg-rose-100 rounded-full">
                <XCircleIcon className="h-7 w-7 text-rose-600" />
              </div>
            )}
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${isConfirmed ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                {isConfirmed ? 'CONFIRMED' : 'REJECTED AUTOMATICALLY'}
              </span>
              <h3 className="text-lg font-bold text-gray-900 mt-1">
                {isConfirmed ? 'Tempahan Berjaya Disahkan' : 'Tempahan Ditolak Secara Automatik'}
              </h3>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm text-gray-700">
          {/* Main Status & Calendar Event Title */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">
              Tajuk Google Calendar Event
            </div>
            <div className="font-mono text-sm font-semibold text-gray-800 flex items-center justify-between">
              <span>{result.calendarEventTitle}</span>
              <span className={`px-2 py-0.5 text-xs font-medium rounded border ${colorBadgeStyle[result.calendarColor] || 'bg-gray-100'}`}>
                {result.calendarColor.toUpperCase()}
              </span>
            </div>
          </div>

          {/* If Conflict: Show clear reason and next steps */}
          {!isConfirmed && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg space-y-2">
              <div className="font-semibold text-rose-800 flex items-center space-x-2">
                <InformationCircleIcon className="h-5 w-5 text-rose-600 flex-shrink-0" />
                <span>Sebab Penolakan:</span>
              </div>
              <p className="text-rose-700 leading-relaxed font-medium">
                {result.conflictReason || result.adminNotes}
              </p>
              <div className="pt-2 mt-2 border-t border-rose-200 text-xs text-rose-800 space-y-1">
                <p>• Notifikasi emel penolakan automatik telah dihantar terus kepada pemohon (<b>{result.emailNotifications.requester.to}</b>).</p>
                <p>• Tempahan ini <b>TIDAK</b> disimpan ke dalam pangkalan data dan <b>TIDAK</b> dimasukkan ke dalam kalendar.</p>
              </div>
            </div>
          )}

          {/* If Confirmed: Show Assignment Details */}
          {isConfirmed && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                <div className="flex items-center space-x-2 text-indigo-900 font-semibold mb-1">
                  <UserCircleIcon className="h-4 w-4" />
                  <span>Pemandu Ditugaskan</span>
                </div>
                <div className="text-gray-900 font-bold text-base">
                  {result.assignedDriverName || 'Tiada (Self-Drive)'}
                </div>
                <div className="text-xs text-indigo-700 mt-1">
                  {result.assignedDriverName ? 'Auto-assign berjadual' : 'Pandu sendiri'}
                </div>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-center space-x-2 text-blue-900 font-semibold mb-1">
                  <TruckIcon className="h-4 w-4" />
                  <span>Kenderaan Diperuntukkan</span>
                </div>
                <div className="text-gray-900 font-bold text-base">
                  {result.assignedVehicleName || 'Perodua Alza'}
                </div>
                <div className="text-xs text-blue-700 mt-1">
                  Slot masa disahkan bebas
                </div>
              </div>
            </div>
          )}

          {/* Pre-working-hour Warning */}
          {result.isPreWorkingHour && (
            <div className="p-3 bg-amber-50 border-l-4 border-amber-500 text-amber-800 rounded-r-md">
              <div className="font-semibold flex items-center space-x-1.5">
                <ClockIcon className="h-4 w-4 text-amber-600" />
                <span>Amaran: Pra-Waktu Kerja (Pre-working-hour)</span>
              </div>
              <p className="text-xs mt-1 text-amber-700">
                Tempahan ini bermula sebelum waktu kerja rasmi pemandu. Sila buat pengesahan manual bersama pemandu bertugas ({result.assignedDriverName}) dan Head of Transportation sebelum bertolak.
              </p>
            </div>
          )}

          {/* Admin System Notes */}
          <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <span className="font-semibold text-gray-700">Catatan Sistem: </span>
            {result.adminNotes}
          </div>

          {/* Email Notification Preview */}
          <div className="pt-2 border-t border-gray-100 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Penghantaran Emel Automatik
            </div>
            <div className="space-y-1 text-xs">
              <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span className="font-medium text-gray-700">Emel Pemohon:</span>
                <span className="text-gray-600 truncate max-w-xs">{result.emailNotifications.requester.to}</span>
              </div>
              {result.emailNotifications.driver && (
                <div className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="font-medium text-gray-700">Emel Pemandu:</span>
                  <span className="text-gray-600 truncate max-w-xs">{result.emailNotifications.driver.to}</span>
                </div>
              )}
              {result.emailNotifications.admin && (
                <div className="flex items-center justify-between p-2 bg-rose-50 rounded">
                  <span className="font-medium text-rose-800">Emel Admin Ain:</span>
                  <span className="text-rose-700 truncate max-w-xs">{result.emailNotifications.admin.to}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-gray-50 border-t flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm transition"
          >
            Faham & Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
