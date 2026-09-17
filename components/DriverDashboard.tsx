import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { CurrentUser, Booking } from '../types';
import FuelLogForm from './FuelLogForm';
import OdometerLogForm from './OdometerLogForm';
import IssueLogForm from './IssueLogForm';
import { 
  FuelIcon, 
  WrenchScrewdriverIcon, 
  GaugeIcon, 
  CalendarIcon, 
  ClockIcon, 
  LocationMarkerIcon, 
  UserGroupIcon, 
  TruckIcon, 
  CheckCircleIcon,
  UserCircleIcon,
  RouteIcon,
  ArrowUpCircleIcon,
  PlusIcon
} from './icons/Icons';
import CalendarView from './CalendarView';
import { parseAsLocal } from '../utils';

interface DriverDashboardProps {
  driver: CurrentUser;
}

type ActiveTab = 'active' | 'history';

const DriverDashboard: React.FC<DriverDashboardProps> = ({ driver }) => {
  const { bookings, odometerLogs, fuelLogs, updateBookingStatus, vehicles } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('active');
  const [isFuelLogOpen, setIsFuelLogOpen] = useState(false);
  const [isOdometerLogOpen, setIsOdometerLogOpen] = useState(false);
  const [isIssueLogOpen, setIsIssueLogOpen] = useState(false);
  
  // Multiple booking selection states
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  
  const [showCalendar, setShowCalendar] = useState(false);

  // Active bookings (Assigned or Confirmed)
  const assignedBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && (b.status === 'Assigned' || b.status === 'Confirmed'))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driver.id]);

  // History bookings (Completed or Cancelled)
  const historyBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && (b.status === 'Completed' || b.status === 'Cancelled'))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [bookings, driver.id]);

  // Statistics
  const completedTripsCount = useMemo(() => {
    return bookings.filter(b => b.driverId === driver.id && b.status === 'Completed').length;
  }, [bookings, driver.id]);

  const totalDriverMileage = useMemo(() => {
    const logs = odometerLogs.filter(log => log.driverId === driver.id);
    return logs.reduce((sum, log) => sum + (log.distance || 0), 0);
  }, [odometerLogs, driver.id]);

  const fuelLogsCount = useMemo(() => {
    return fuelLogs.filter(log => log.driverId === driver.id).length;
  }, [fuelLogs, driver.id]);

  const handleAcceptJob = (bookingId: string) => {
    updateBookingStatus(bookingId, 'Confirmed');
  };

  const handleToggleSelectBooking = (id: string) => {
    setSelectedBookingIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenOdometerForSelected = () => {
    if (selectedBookingIds.length === 0) return;
    setIsOdometerLogOpen(true);
  };

  const handleSingleOdometerOpen = (id: string) => {
    setSelectedBookingIds([id]);
    setIsOdometerLogOpen(true);
  };

  const handleOpenGeneralOdometer = () => {
    setSelectedBookingIds([]);
    setIsOdometerLogOpen(true);
  };

  return (
    <div className="max-w-md md:max-w-2xl mx-auto space-y-6 pb-28 relative">
      
      {/* GRAB-STYLE DRIVER PROFILE */}
      <div className="bg-indigo-900 text-white p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-10 translate-y-10 opacity-10">
          <TruckIcon className="h-44 w-44" />
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="bg-white/10 p-2 rounded-full border border-white/20">
              <UserCircleIcon className="h-10 w-10 text-indigo-200" />
            </div>
            <div>
              <p className="text-xs text-indigo-200 font-medium tracking-wide uppercase">Rakan Pemandu</p>
              <h2 className="text-xl font-extrabold tracking-tight">{driver.name}</h2>
            </div>
          </div>
          <div className="flex items-center space-x-2 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 rounded-full">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="text-[10px] font-bold text-emerald-300 uppercase tracking-wider">Online</span>
          </div>
        </div>

        {/* DRIVER STATS CARD */}
        <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-white/10 text-center">
          <div className="bg-white/5 py-2.5 px-1.5 rounded-xl border border-white/5">
            <span className="block text-xl sm:text-2xl font-extrabold text-emerald-300">{completedTripsCount}</span>
            <span className="block text-[9px] text-indigo-200 uppercase font-bold mt-1 tracking-wide">Trip Selesai</span>
          </div>
          <div className="bg-white/5 py-2.5 px-1.5 rounded-xl border border-white/5">
            <span className="block text-xl sm:text-2xl font-extrabold text-indigo-100">{totalDriverMileage.toLocaleString()} km</span>
            <span className="block text-[9px] text-indigo-200 uppercase font-bold mt-1 tracking-wide">Jumlah Jarak</span>
          </div>
          <div className="bg-white/5 py-2.5 px-1.5 rounded-xl border border-white/5">
            <span className="block text-xl sm:text-2xl font-extrabold text-indigo-100">{fuelLogsCount}</span>
            <span className="block text-[9px] text-indigo-200 uppercase font-bold mt-1 tracking-wide">Log Minyak</span>
          </div>
        </div>
      </div>

      {/* QUICK UTILITY ACTIONS */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={() => setIsFuelLogOpen(true)}
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-indigo-50/50 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition duration-200"
        >
          <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600 mb-2">
            <FuelIcon className="h-6 w-6" />
          </div>
          <span className="text-xs font-extrabold text-gray-700">Log Minyak</span>
        </button>
        <button
          onClick={handleOpenGeneralOdometer}
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-indigo-50/50 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition duration-200"
        >
          <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600 mb-2">
            <GaugeIcon className="h-6 w-6" />
          </div>
          <span className="text-xs font-extrabold text-gray-700">Log Odometer</span>
        </button>
        <button
          onClick={() => setIsIssueLogOpen(true)}
          className="flex flex-col items-center justify-center p-3.5 bg-white hover:bg-red-50/50 border border-gray-100 rounded-2xl shadow-sm hover:shadow-md transition duration-200"
        >
          <div className="p-2.5 bg-red-50 rounded-xl text-red-600 mb-2">
            <WrenchScrewdriverIcon className="h-6 w-6" />
          </div>
          <span className="text-xs font-extrabold text-gray-700">Lapor Isu Van</span>
        </button>
      </div>

      {/* TABBED INTERFACE (ACTIVE JOBS VS HISTORY) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-4 text-center font-extrabold text-sm border-b-2 transition ${
              activeTab === 'active' 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Tugasan Aktif ({assignedBookings.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setSelectedBookingIds([]); // clear selection when moving to history
            }}
            className={`flex-1 py-4 text-center font-extrabold text-sm border-b-2 transition ${
              activeTab === 'history' 
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/10' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📜 Sejarah Trip ({historyBookings.length})
          </button>
        </div>

        <div className="p-4 sm:p-5">
          {activeTab === 'active' ? (
            /* TAB: ACTIVE JOBS */
            <div className="space-y-4">
              {assignedBookings.length > 0 ? (
                <>
                  <div className="bg-indigo-50 p-3.5 rounded-xl border border-indigo-100 flex items-start space-x-2.5">
                    <span className="text-lg">💡</span>
                    <p className="text-[11px] text-indigo-950 font-semibold leading-relaxed">
                      Selesaikan trip dengan menanda checkbox pada kad trip yang telah selesai, kemudian tekan <strong>"Selesaikan Trip Serentak"</strong> di bawah untuk melapor odometer sekali gus!
                    </p>
                  </div>

                  {assignedBookings.map((booking: Booking) => {
                    const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);
                    const passengerBreakdown = booking.passengers
                      .filter(p => p.count > 0)
                      .map(p => `${p.count} ${p.category}`)
                      .join(', ');

                    const isAssigned = booking.status === 'Assigned';
                    const isConfirmed = booking.status === 'Confirmed';
                    const isChecked = selectedBookingIds.includes(booking.id);

                    return (
                      <div 
                        key={booking.id}
                        className={`rounded-2xl border-2 overflow-hidden transition relative ${
                          isChecked 
                            ? 'border-indigo-600 bg-indigo-50/10' 
                            : isAssigned 
                              ? 'border-amber-400 bg-white' 
                              : 'border-emerald-500 bg-white'
                        }`}
                      >
                        {/* Header Banner */}
                        <div className={`px-4 py-2.5 flex items-center justify-between text-xs font-bold ${
                          isChecked 
                            ? 'bg-indigo-100 text-indigo-900'
                            : isAssigned 
                              ? 'bg-amber-100 text-amber-900' 
                              : 'bg-emerald-100 text-emerald-900'
                        }`}>
                          <div className="flex items-center">
                            {isConfirmed && (
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectBooking(booking.id)}
                                className="h-4.5 w-4.5 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 mr-2 cursor-pointer"
                              />
                            )}
                            <span className="uppercase tracking-wider flex items-center">
                              <span className={`w-2 h-2 rounded-full mr-2 ${isAssigned ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                              {isAssigned ? 'Tugasan Ditawarkan' : 'Trip Sedang Berjalan'}
                            </span>
                          </div>
                          <span>#{booking.id.split('-')[1] || booking.id.slice(0, 4)}</span>
                        </div>

                        {/* Content */}
                        <div className="p-4 space-y-4">
                          {/* Route indicators */}
                          <div className="relative pl-7 space-y-4">
                            <div className="absolute left-[9px] top-2.5 bottom-2.5 w-0.5 border-l-2 border-dashed border-gray-300"></div>

                            {/* Pickup */}
                            <div className="relative">
                              <span className="absolute left-[-23px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                                <span className="h-1.5 w-1.5 rounded-full bg-white"></span>
                              </span>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Pickup Lokasi</p>
                              <p className="text-sm font-extrabold text-gray-800">{booking.pickupPoint}</p>
                            </div>

                            {/* Drop-off */}
                            <div className="relative">
                              <span className="absolute left-[-24px] top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-500 text-white">
                                <LocationMarkerIcon className="h-3 w-3" />
                              </span>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Destinasi</p>
                              <p className="text-sm font-extrabold text-gray-900">{booking.destination}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{booking.address}</p>
                            </div>
                          </div>

                          {/* Time & Vehicle */}
                          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 text-xs">
                            <div className="flex items-center space-x-2 text-gray-700 bg-gray-50 px-2.5 py-2 rounded-xl border border-gray-100">
                              <ClockIcon className="h-4.5 w-4.5 text-indigo-500 flex-shrink-0" />
                              <div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Masa Perjalanan</p>
                                <p className="font-extrabold">
                                  {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-700 bg-gray-50 px-2.5 py-2 rounded-xl border border-gray-100">
                              <TruckIcon className="h-4.5 w-4.5 text-indigo-500 flex-shrink-0" />
                              <div>
                                <p className="text-[9px] text-gray-400 font-bold uppercase">Van Ditugaskan</p>
                                <p className="font-extrabold truncate max-w-[100px]">
                                  {booking.vehicleId ? 'Van ' + (booking.vehicleId.slice(-3).toUpperCase()) : 'Pandu Sendiri'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Details Summary Drawer */}
                          <div className="bg-slate-50 rounded-2xl p-3 text-xs space-y-2 text-gray-700 border border-slate-100">
                            <div>
                              <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wide">Tujuan</span>
                              <p className="font-bold text-slate-800">{booking.purpose}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                              <div>
                                <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wide">Pemohon</span>
                                <p className="font-semibold text-slate-800 truncate">{booking.requesterName}</p>
                              </div>
                              <div>
                                <span className="font-bold text-slate-400 block text-[9px] uppercase tracking-wide">Pengiring</span>
                                <p className="font-semibold text-slate-800 truncate">{booking.escort || 'Tiada'}</p>
                              </div>
                            </div>
                            <div className="pt-1.5 flex items-center space-x-1.5 text-[11px] text-slate-600 border-t border-slate-200/50">
                              <UserGroupIcon className="h-4 w-4 text-slate-400" />
                              <span>Penumpang: <strong className="text-slate-800">{totalPassengers} orang</strong> ({passengerBreakdown})</span>
                            </div>
                          </div>

                          {/* Individual actions */}
                          <div className="pt-1">
                            {isAssigned && (
                              <button
                                onClick={() => handleAcceptJob(booking.id)}
                                className="w-full flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-md transition duration-150 active:scale-98 text-xs sm:text-sm uppercase tracking-wide"
                              >
                                <CheckCircleIcon className="h-5 w-5 mr-2" />
                                Terima Tugasan Ini
                              </button>
                            )}
                            {isConfirmed && (
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleSingleOdometerOpen(booking.id)}
                                  className="flex-1 flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 px-3 rounded-xl shadow-md transition duration-150 active:scale-98 text-xs uppercase tracking-wide"
                                >
                                  <GaugeIcon className="h-4.5 w-4.5 mr-1.5" />
                                  Lapor Meter & Selesai
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Tandakan selesai trip ini secara terus tanpa log odometer?")) {
                                      updateBookingStatus(booking.id, 'Completed');
                                    }
                                  }}
                                  className="py-3 px-3.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl transition font-extrabold text-xs uppercase"
                                  title="Selesai Serta-merta"
                                >
                                  Direct Selesai
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </>
              ) : (
                <div className="text-center py-12 px-6 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <div className="relative w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                    <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-indigo-400 opacity-20"></span>
                    <TruckIcon className="h-7 w-7 text-indigo-600" />
                  </div>
                  <p className="text-sm font-extrabold text-gray-800">Menunggu Tugasan Seterusnya...</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">Tiada trip aktif buat masa sekarang. Admin akan memberikan tugas van baru di sini.</p>
                </div>
              )}
            </div>
          ) : (
            /* TAB: TRIP HISTORY */
            <div className="space-y-3.5">
              {historyBookings.length > 0 ? (
                historyBookings.map((booking: Booking) => {
                  const isCompleted = booking.status === 'Completed';
                  const vehicle = vehicles.find(v => v.id === booking.vehicleId);

                  return (
                    <div 
                      key={booking.id}
                      className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {booking.status === 'Completed' ? 'SELESAI ✅' : 'BATAL ❌'}
                          </span>
                          <span className="font-bold text-gray-400 font-mono">#{booking.id.split('-')[1] || booking.id.slice(0, 4)}</span>
                        </div>
                        <p className="text-sm font-extrabold text-gray-800">{booking.pickupPoint} ➡️ {booking.destination}</p>
                        <p className="text-gray-500 font-semibold">Tujuan: {booking.purpose}</p>
                        
                        {/* Render odometer log metrics from linkage */}
                        {isCompleted && booking.startOdometer !== undefined && booking.endOdometer !== undefined && (
                          <div className="p-2 bg-white rounded-lg border border-gray-100 font-mono text-[10px] text-indigo-950 inline-block">
                            🚗 Meter: {booking.startOdometer} km - {booking.endOdometer} km (<strong>+{booking.distance} km</strong>)
                          </div>
                        )}
                      </div>

                      <div className="text-left sm:text-right flex-shrink-0 border-t sm:border-t-0 pt-2.5 sm:pt-0 border-gray-100">
                        <p className="font-extrabold text-gray-700">
                          {parseAsLocal(booking.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                        <p className="text-[10px] text-gray-400 font-medium mt-1">
                          Van: {vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : 'Self-Drive'}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-10 text-gray-400 font-semibold text-xs border border-dashed rounded-xl">
                  Tiada rekod perjalanan selesai lagi.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TEAM SCHEDULE CALENDAR ACCORDION */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <button 
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full px-5 py-4 flex items-center justify-between text-left font-bold text-gray-800 focus:outline-none hover:bg-gray-50 transition"
        >
          <span className="flex items-center text-sm font-extrabold">
            <RouteIcon className="h-5 w-5 mr-2.5 text-indigo-600" />
            Jadual Semua Pemandu / Kalendar
          </span>
          <span className="text-indigo-600 text-xs font-extrabold">{showCalendar ? 'Tutup ▲' : 'Papar ▼'}</span>
        </button>
        {showCalendar && (
          <div className="p-4 border-t border-gray-100 overflow-x-auto bg-gray-50/50">
            <CalendarView />
          </div>
        )}
      </div>

      {/* FLOATING ACTION BOTTOM BAR FOR MULTI-TRIP LOGGING */}
      {selectedBookingIds.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-auto md:w-[640px] bg-indigo-950 text-white p-4 rounded-2xl shadow-2xl border border-indigo-800 flex items-center justify-between animate-slide-up z-40 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white font-extrabold h-9 w-9 rounded-full flex items-center justify-center text-sm shadow-md border border-indigo-400">
              {selectedBookingIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-indigo-200">Trip Dipilih</p>
              <p className="text-xs text-indigo-100 font-semibold truncate max-w-[180px] sm:max-w-[300px]">
                Sedia untuk diselesaikan bersama-sama
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedBookingIds([])}
              className="text-xs font-bold text-indigo-300 hover:text-white px-3 py-2 rounded-xl"
            >
              Reset
            </button>
            <button
              onClick={handleOpenOdometerForSelected}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold py-2.5 px-4 rounded-xl shadow-lg transition duration-150 active:scale-95 text-xs uppercase"
            >
              Hantar Meter & Selesai
            </button>
          </div>
        </div>
      )}

      {/* Forms & Modals */}
      <FuelLogForm
        isOpen={isFuelLogOpen}
        onClose={() => setIsFuelLogOpen(false)}
        driverId={driver.id}
      />
      
      <OdometerLogForm 
        isOpen={isOdometerLogOpen}
        onClose={() => {
          setIsOdometerLogOpen(false);
          setSelectedBookingIds([]); // reset selection upon close
        }}
        driverId={driver.id}
        defaultBookingIds={selectedBookingIds}
      />

      <IssueLogForm
        isOpen={isIssueLogOpen}
        onClose={() => setIsIssueLogOpen(false)}
        reporterId={driver.id}
      />

    </div>
  );
};

export default DriverDashboard;
