import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';
import type { Booking, User, Vehicle } from '../types';
import { getDriverCalendarColor } from '../services/bookingEngine';
import { 
  CalendarIcon, 
  ClockIcon, 
  LocationMarkerIcon, 
  UserGroupIcon, 
  TruckIcon, 
  XIcon, 
  ArrowUpCircleIcon,
  EditIcon,
  TrashIcon,
  PlusIcon
} from './icons/Icons';
import BookingForm from './BookingForm';

const getBookingBadgeStyle = (booking: Booking, driverName: string) => {
  if (booking.status === 'Conflict') {
    return 'bg-rose-100 text-rose-800 border border-rose-300';
  }
  if (booking.serviceType === 'Self-Drive') {
    return 'bg-slate-200 text-slate-800 border border-slate-300';
  }
  if (driverName.toLowerCase().includes('syafiq')) {
    return 'bg-blue-100 text-blue-900 border border-blue-300';
  }
  if (driverName.toLowerCase().includes('saiful')) {
    return 'bg-emerald-100 text-emerald-900 border border-emerald-300';
  }
  if (booking.calendarColor) {
    return 'bg-indigo-100 text-indigo-900 border border-indigo-200';
  }
  if (booking.status === 'Pending') {
    return 'bg-amber-100 text-amber-800 border border-amber-300';
  }
  return 'bg-gray-100 text-gray-800 border border-gray-200';
};

interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (bookingId: string) => void;
  isAdmin: boolean;
}

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ booking, onClose, onEdit, onDelete, isAdmin }) => {
  const { users, vehicles, updateBooking } = useAppContext();
  const [isChangingDriver, setIsChangingDriver] = useState(false);
  const [newDriverId, setNewDriverId] = useState(booking?.driverId || '');
  const [isSavingDriver, setIsSavingDriver] = useState(false);

  if (!booking) return null;

  const driverName = users.find(d => d.id === booking.driverId)?.name || (booking.serviceType === 'Self-Drive' ? 'Self-Drive (Pandu Sendiri)' : 'Unassigned / Belum Ditentu');
  const vehicleInfo = vehicles.find(v => v.id === booking.vehicleId) ||
    vehicles.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);

  const staffCount = booking.passengers?.find(p => p.category === 'Staff')?.count ?? 0;
  const kidsCount = booking.passengers?.find(p => p.category === 'Kids')?.count ?? 0;
  const teenagersCount = booking.passengers?.find(p => p.category === 'Teenagers')?.count ?? 0;

  const handleConfirmDriverChange = async () => {
    setIsSavingDriver(true);
    try {
      const chosenDriver = users.find(u => u.id === newDriverId);
      const chosenDriverName = chosenDriver?.name || (booking.serviceType === 'Self-Drive' ? 'Self-Drive' : '');
      const deptStr = booking.department ? ` (${booking.department})` : '';
      const updatedTitle = chosenDriverName
        ? `(${chosenDriverName}) ${booking.requesterName}${deptStr} → ${booking.destination}`
        : `${booking.requesterName}${deptStr} → ${booking.destination}`;
      const newColor = chosenDriver ? getDriverCalendarColor(chosenDriver.name) : 'grey';

      updateBooking(booking.id, {
        driverId: newDriverId || null,
        calendarEventTitle: updatedTitle,
        calendarColor: newColor,
        status: newDriverId ? 'Confirmed' : booking.status,
        adminNotes: `Pemandu dikemaskini kepada ${chosenDriver?.name || 'Tiada Pemandu'} oleh Admin pada ${new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit' })}.`,
      });
      setIsChangingDriver(false);
    } catch (e: any) {
      alert('Ralat kemaskini pemandu: ' + (e.message || e));
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleDeleteClick = () => {
    if (window.confirm(`Adakah anda pasti mahu memadam tempahan ke "${booking.destination}"? Tindakan ini tidak boleh diundur.`)) {
      onDelete(booking.id);
      onClose();
    }
  };

  const handleEditClick = () => {
    onEdit(booking);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden transform scale-100 transition" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
              booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800' :
              booking.status === 'Pending' ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
            }`}>
              {booking.status}
            </span>
            <h2 className="text-lg font-bold text-gray-900 mt-1">{booking.destination}</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition"><XIcon className="h-6 w-6" /></button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-sm text-gray-700 overflow-y-auto max-h-[70vh]">
          {booking.calendarEventTitle && (
            <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-xs font-semibold text-slate-800 border border-slate-200">
              📅 {booking.calendarEventTitle}
            </div>
          )}

          {booking.status === 'Conflict' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
              <p className="font-bold">⚠️ STATUS: KONFLIK</p>
              <p className="mt-1">{booking.conflictReason || 'Bertembung jadual atau waktu rehat.'}</p>
              <p className="mt-1 text-rose-600 font-semibold">Sila hubungi Admin Ain untuk semakan dan penetapan manual.</p>
            </div>
          )}

          {booking.warningNotes && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 font-medium">
              ⚠️ {booking.warningNotes}
            </div>
          )}

          <div className="space-y-1">
            <span className="text-xs font-bold uppercase text-gray-400">Tujuan Perjalanan</span>
            <p className="text-sm font-semibold text-gray-800">{booking.purpose || 'Tiada tujuan dinyatakan'}</p>
          </div>

          {/* Driver Waiting Status Banner */}
          <div className={`flex items-center space-x-3 p-3.5 rounded-xl border ${
            booking.shouldWait
              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          }`}>
            <span className="text-2xl">{booking.shouldWait ? '⏳' : '🚗'}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Status Menunggu Pemandu</p>
              <p className="text-xs font-bold">
                {booking.shouldWait
                  ? 'Pemandu Perlu Menunggu (Tunggu di lokasi sehingga selesai urusan)'
                  : 'Pemandu Tidak Perlu Menunggu (Hantar / Drop-off sahaja)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-gray-100">
             <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Tarikh</p>
                  <span className="font-medium text-gray-800">{parseAsLocal(booking.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
             </div>
             <div className="flex items-center space-x-2">
                <ClockIcon className="h-5 w-5 text-indigo-500" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Masa (12H AM/PM)</p>
                  <span className="font-medium text-gray-800">
                      {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                      {booking.finishDateTime && ` - ${parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                  </span>
                </div>
             </div>
             <div className="flex items-start space-x-2">
                <ArrowUpCircleIcon className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Lokasi Pickup</p>
                  <span className="font-medium text-gray-800">
                    {getPickupLocationDisplay(booking.pickupPoint, booking.address)}
                  </span>
                </div>
             </div>
             <div className="flex items-start space-x-2">
                <LocationMarkerIcon className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400 font-bold uppercase">Alamat Drop-off / Destinasi</p>
                  <span className="font-semibold text-gray-900">{booking.destination}</span>
                </div>
             </div>
             <div className="flex items-start space-x-2 col-span-1 md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <UserGroupIcon className="h-5 w-5 text-indigo-500 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-gray-400 font-bold uppercase">Jumlah Penumpang</p>
                    <span className="font-bold text-gray-900 text-xs">{totalPassengers} Orang</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
                      Staf: <strong className="ml-1 text-indigo-600">{staffCount}</strong>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
                      Kanak-kanak: <strong className="ml-1 text-indigo-600">{kidsCount}</strong>
                    </span>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-white border border-slate-200 text-slate-700 shadow-sm">
                      Remaja: <strong className="ml-1 text-indigo-600">{teenagersCount}</strong>
                    </span>
                  </div>
                </div>
             </div>

             {/* Driver Assignment with Change Driver button */}
             <div className="col-span-1 md:col-span-2 bg-indigo-50/40 p-3 rounded-xl border border-indigo-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <TruckIcon className="h-5 w-5 text-indigo-500" />
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase">Pemandu Ditugaskan</p>
                      <span className="font-bold text-gray-900">{driverName}</span>
                    </div>
                  </div>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewDriverId(booking.driverId || '');
                        setIsChangingDriver(!isChangingDriver);
                      }}
                      className="text-xs px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded-lg shadow-sm transition flex items-center space-x-1"
                    >
                      <span>🔄</span>
                      <span>{isChangingDriver ? 'Batal Tukar' : 'Tukar Pemandu'}</span>
                    </button>
                  )}
                </div>

                {isChangingDriver && (
                  <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2 shadow-sm animate-fade-in mt-2">
                    <label className="block text-xs font-bold text-indigo-900">
                      Pilih Pemandu Baharu (Tukar Saat Akhir):
                    </label>
                    <select
                      value={newDriverId}
                      onChange={(e) => setNewDriverId(e.target.value)}
                      className="w-full text-xs p-2 border border-indigo-200 rounded-lg bg-indigo-50/30 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    >
                      <option value="">-- Tiada / Belum Ditentu --</option>
                      {users.filter(u => u.role === 'driver' || u.role === 'admin').map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role === 'admin' ? 'Admin' : 'Pemandu'})
                        </option>
                      ))}
                    </select>
                    <div className="flex justify-end space-x-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setIsChangingDriver(false)}
                        className="text-xs px-3 py-1 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                      >
                        Batal
                      </button>
                      <button
                        type="button"
                        disabled={isSavingDriver}
                        onClick={handleConfirmDriverChange}
                        className="text-xs px-3.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-sm"
                      >
                        {isSavingDriver ? 'Menyimpan...' : 'Sahkan Pertukaran'}
                      </button>
                    </div>
                  </div>
                )}
             </div>

             <div className="flex items-center space-x-2 col-span-1 md:col-span-2 bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-500 mr-1" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                <span>
                  <strong>Kenderaan:</strong>{' '}
                  {vehicleInfo
                    ? `${vehicleInfo.name} (${vehicleInfo.plateNumber})`
                    : (booking.serviceType === 'Self-Drive'
                        ? 'Perodua Alza (Pandu Sendiri)'
                        : (booking.vehiclePreference && booking.vehiclePreference !== 'Bebas'
                            ? booking.vehiclePreference
                            : 'Bebas / Belum Ditentu (Pemandu pilih van semasa trip)'))}
                </span>
             </div>
          </div>

          {booking.adminNotes && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
              <span className="font-bold block text-slate-500 uppercase text-[9px] tracking-wide mb-0.5">Nota Pentadbiran</span>
              {booking.adminNotes}
            </div>
          )}
        </div>

        {/* Admin action controls */}
        {isAdmin && (
          <div className="p-4 bg-gray-50 border-t flex items-center justify-end space-x-3">
            <button
              onClick={handleDeleteClick}
              className="flex items-center text-xs text-red-600 hover:bg-red-50 hover:text-red-700 font-bold py-2 px-3.5 border border-red-200 rounded-xl transition shadow-sm bg-white"
            >
              <TrashIcon className="h-4 w-4 mr-1.5" />
              Padam Tempahan
            </button>
            <button
              onClick={handleEditClick}
              className="flex items-center text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-4 rounded-xl transition shadow-md"
            >
              <EditIcon className="h-4 w-4 mr-1.5" />
              Kemaskini / Edit
            </button>
          </div>
        )}

      </div>
    </div>
  );
};


const CalendarView: React.FC = () => {
  const { bookings, users, currentUser, deleteBooking } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);

  const selectedBooking = useMemo(() => {
    return bookings.find(b => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  // States for BookingForm
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const isAdmin = useMemo(() => currentUser?.role === 'admin', [currentUser]);

  const { calendarGrid, monthName, year } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const firstDayOfMonth = new Date(year, month, 1);

    const calendarGrid: { date: Date; isCurrentMonth: boolean }[] = [];
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      calendarGrid.push({
        date,
        isCurrentMonth: date.getMonth() === month,
      });
    }

    return { calendarGrid, monthName, year };
  }, [currentDate]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(booking => {
        if (booking.status === 'Cancelled') return;
        const dateKey = parseAsLocal(booking.dateTime).toDateString();
        if (!map.has(dateKey)) {
            map.set(dateKey, []);
        }
        map.get(dateKey)!.push(booking);
    });
    map.forEach(dayBookings => {
        dayBookings.sort((a, b) => parseAsLocal(a.dateTime).getTime() - parseAsLocal(b.dateTime).getTime());
    });
    return map;
  }, [bookings]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const getDriverName = useCallback((driverId: string | null) => {
    if (!driverId) return "Pending";
    return users.find(d => d.id === driverId)?.name || "Unknown";
  }, [users]);

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setIsFormOpen(true);
  };

  const handleCreateNewBooking = () => {
    setEditingBooking(null);
    setIsFormOpen(true);
  };

  return (
    <>
      <BookingDetailModal 
        booking={selectedBooking} 
        onClose={() => setSelectedBookingId(null)} 
        onEdit={handleEditBooking}
        onDelete={deleteBooking}
        isAdmin={isAdmin}
      />

      <BookingForm
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingBooking(null);
        }}
        bookingToEdit={editingBooking}
      />

      <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-md border border-gray-100">
        
        {/* Calendar top controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
          <div className="flex items-center space-x-1 bg-gray-50 border rounded-xl p-1">
            <button onClick={() => changeMonth(-1)} className="p-2 font-bold hover:bg-white rounded-lg transition-colors text-gray-700">&lt;</button>
            <h3 className="text-base sm:text-lg font-extrabold text-gray-800 px-3">{monthName} {year}</h3>
            <button onClick={() => changeMonth(1)} className="p-2 font-bold hover:bg-white rounded-lg transition-colors text-gray-700">&gt;</button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                onClick={handleCreateNewBooking}
                className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md transition"
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                Tambah Booking Baru
              </button>
            )}
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-2 text-xs mb-4 pb-4 border-b border-gray-100">
          <span className="text-xs font-bold text-gray-400 uppercase mr-1">Petunjuk Van:</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-900 border border-blue-100 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span> Syafiq
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-100 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span> Saiful
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600"></span> Pandu Sendiri
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-50 text-rose-800 border border-rose-100 font-bold">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span> Konflik
          </span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100 font-medium">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600"></span> Menunggu
          </span>
        </div>

        {/* Grid Calendar */}
        <div className="grid grid-cols-7 gap-px text-center text-xs font-bold text-gray-500 border-t border-l border-gray-200 bg-gray-200 rounded-xl overflow-hidden">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2.5 bg-gray-50 border-b border-r border-gray-200 tracking-wider uppercase text-[10px] text-gray-400">{day}</div>
          ))}
          {calendarGrid.map(({ date, isCurrentMonth }, idx) => {
            const dayBookings = bookingsByDay.get(date.toDateString()) || [];
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                className={`relative min-h-[135px] p-1.5 border-b border-r border-gray-200 transition-colors ${
                  isCurrentMonth ? (isToday ? 'bg-indigo-50/20' : 'bg-white') : 'bg-gray-50/50'
                }`}
              >
                <span className={`absolute top-1.5 right-1.5 text-[10px] font-extrabold ${
                  isToday ? 'bg-indigo-600 text-white rounded-full h-5.5 w-5.5 flex items-center justify-center shadow-sm' : ''
                } ${!isCurrentMonth ? 'text-gray-300' : 'text-gray-700'}`}>
                  {date.getDate()}
                </span>
                <div className="mt-7 space-y-1">
                  {dayBookings.map(booking => {
                    const dName = getDriverName(booking.driverId);
                    const isConflict = booking.status === 'Conflict';
                    return (
                      <button
                        key={booking.id}
                        onClick={() => setSelectedBookingId(booking.id)}
                        className={`w-full text-left p-1.5 rounded-xl text-[11px] truncate cursor-pointer transition shadow-xs hover:shadow-md hover:scale-102 flex flex-col ${getBookingBadgeStyle(booking, dName)}`}
                        title={booking.calendarEventTitle || `${booking.destination} (${dName})`}
                      >
                        <p className="font-extrabold text-[9px] tracking-tight flex items-center justify-between w-full opacity-90">
                          <span>{parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                          {isConflict && <span className="text-xs font-bold text-rose-700 animate-pulse">⚠️</span>}
                        </p>
                        <p className="font-bold truncate w-full mt-0.5 text-gray-900">{booking.destination}</p>
                        <p className="opacity-80 truncate text-[9px] w-full">{booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${dName.split(' ')[0]}`}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CalendarView;
