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
  ClockIcon, 
  LocationMarkerIcon, 
  UserGroupIcon, 
  TruckIcon, 
  CheckCircleIcon,
  UserCircleIcon,
  RouteIcon,
  ExternalLinkIcon
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

  const getVehicleInfo = (vehicleId: string | null) => {
    if (!vehicleId) return { name: 'Pandu Sendiri', plate: 'Tiada' };
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) return { name: vehicle.name, plate: vehicle.plateNumber };
    return { name: `Kenderaan #${vehicleId.slice(-4).toUpperCase()}`, plate: '-' };
  };

  const formatTripDateTime = (dateTimeStr: string, finishDateTimeStr?: string) => {
    try {
      const start = parseAsLocal(dateTimeStr);
      const dateFormatted = start.toLocaleDateString('ms-MY', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      const startTime = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });

      if (finishDateTimeStr) {
        const end = parseAsLocal(finishDateTimeStr);
        const endTime = end.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        return { date: dateFormatted, time: `${startTime} – ${endTime}` };
      }

      return { date: dateFormatted, time: startTime };
    } catch {
      return { date: dateTimeStr, time: '' };
    }
  };

  return (
    <div className="max-w-md md:max-w-3xl mx-auto space-y-5 pb-28 relative">
      
      {/* DRIVER COCKPIT PROFILE */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/30 p-2 rounded-xl border border-indigo-500/40 text-indigo-300">
              <UserCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Portal Pemandu</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  Bertugas (Online)
                </span>
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">{driver.name}</h2>
            </div>
          </div>
        </div>

        {/* DRIVER METRICS STRIP */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-800 text-center">
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-emerald-400">{completedTripsCount}</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Trip Selesai</span>
          </div>
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-indigo-300">{totalDriverMileage.toLocaleString()} km</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Jumlah Jarak</span>
          </div>
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-amber-300">{fuelLogsCount}</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Log Minyak</span>
          </div>
        </div>
      </div>

      {/* REFINED COMPACT QUICK UTILITY ACTIONS */}
      <div className="grid grid-cols-3 gap-2.5">
        <button
          onClick={() => setIsFuelLogOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center"
        >
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 mb-1.5 border border-amber-100">
            <FuelIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Log Minyak</span>
        </button>
        <button
          onClick={handleOpenGeneralOdometer}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-indigo-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center"
        >
          <div className="p-2 bg-indigo-50 rounded-lg text-indigo-600 mb-1.5 border border-indigo-100">
            <GaugeIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Log Odometer</span>
        </button>
        <button
          onClick={() => setIsIssueLogOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-rose-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center"
        >
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600 mb-1.5 border border-rose-100">
            <WrenchScrewdriverIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Lapor Isu Van</span>
        </button>
      </div>

      {/* TABBED INTERFACE (ACTIVE JOBS VS HISTORY) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-1">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 py-2.5 rounded-xl text-center font-bold text-xs sm:text-sm transition ${
              activeTab === 'active' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Tugasan Aktif ({assignedBookings.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('history');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 rounded-xl text-center font-bold text-xs sm:text-sm transition ${
              activeTab === 'history' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Sejarah Trip ({historyBookings.length})
          </button>
        </div>

        <div className="p-3.5 sm:p-5">
          {activeTab === 'active' ? (
            /* TAB: ACTIVE JOBS */
            <div className="space-y-4">
              {assignedBookings.length > 0 ? (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-start gap-2.5 text-slate-700">
                    <span className="text-sm">💡</span>
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tip Pemandu:</strong> Anda boleh menanda checkbox pada trip yang selesai, kemudian tekan butang <strong>"Hantar Meter & Selesai"</strong> di bawah untuk menghantar laporan odometer sekali gus bagi beberapa perjalanan berturut-turut.
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
                    const vehicleInfo = getVehicleInfo(booking.vehicleId);
                    const dateTimeInfo = formatTripDateTime(booking.dateTime, booking.finishDateTime);

                    return (
                      <div 
                        key={booking.id}
                        className={`rounded-2xl border transition-all duration-200 bg-white overflow-hidden ${
                          isChecked 
                            ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md' 
                            : isAssigned 
                              ? 'border-amber-300 hover:border-amber-400 shadow-sm' 
                              : 'border-emerald-300 hover:border-emerald-400 shadow-sm'
                        }`}
                      >
                        {/* CARD HEADER BAR */}
                        <div className={`px-3.5 py-2.5 border-b flex items-center justify-between text-xs ${
                          isChecked 
                            ? 'bg-indigo-50/80 border-indigo-100 text-indigo-950'
                            : isAssigned 
                              ? 'bg-amber-50/80 border-amber-100 text-amber-950' 
                              : 'bg-emerald-50/80 border-emerald-100 text-emerald-950'
                        }`}>
                          <div className="flex items-center gap-2">
                            {isConfirmed && (
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleSelectBooking(booking.id)}
                                className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                                title="Pilih untuk selesai sekali gus"
                              />
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block w-2 h-2 rounded-full ${isAssigned ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                              <span className="font-extrabold uppercase tracking-wide text-[11px]">
                                {isAssigned ? 'Tugasan Baru Ditawarkan' : 'Dalam Perjalanan (Confirmed)'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-mono font-bold bg-white/80 px-2 py-0.5 rounded border border-slate-200/60 text-slate-700">
                              #{booking.id.split('-')[1] || booking.id.slice(0, 5)}
                            </span>
                          </div>
                        </div>

                        {/* CARD BODY CONTENT */}
                        <div className="p-4 space-y-3.5">
                          
                          {/* DATE & TIME BANNER */}
                          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200/70 px-3 py-2 rounded-xl text-xs">
                            <div className="flex items-center gap-1.5 text-slate-800 font-bold">
                              <ClockIcon className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                              <span>{dateTimeInfo.date}</span>
                            </div>
                            <div className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 text-[11px]">
                              {dateTimeInfo.time}
                            </div>
                          </div>

                          {/* REFINED SLEEK ROUTE SECTION (NO OVERSIZED BULKY ICONS) */}
                          <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-3">
                            <div className="flex flex-col space-y-3">
                              
                              {/* PICKUP */}
                              <div className="flex items-start gap-2.5">
                                <div className="mt-1 flex flex-col items-center">
                                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100"></div>
                                  <div className="w-0.5 h-6 border-l border-dashed border-slate-300 mt-1"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lokasi Ambil (Pickup)</span>
                                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">{booking.pickupPoint}</p>
                                </div>
                              </div>

                              {/* DROP-OFF */}
                              <div className="flex items-start gap-2.5">
                                <div className="mt-1 flex flex-col items-center">
                                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-rose-100"></div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lokasi Hantar (Destinasi)</span>
                                  <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-tight">{booking.destination}</p>
                                  {booking.address && (
                                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{booking.address}</p>
                                  )}
                                  
                                  {/* QUICK NAVIGATION BUTTON FOR DRIVER */}
                                  <div className="mt-1.5">
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((booking.address ? booking.address + ', ' : '') + booking.destination)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-indigo-50 text-indigo-700 hover:text-indigo-800 rounded-lg text-[11px] font-bold border border-slate-200 shadow-2xs transition"
                                    >
                                      <LocationMarkerIcon className="w-3 h-3 text-indigo-600" />
                                      <span>Buka Google Maps</span>
                                      <ExternalLinkIcon className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
                                    </a>
                                  </div>
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* PURPOSE SECTION */}
                          <div className="p-3 bg-indigo-50/40 border border-indigo-100/70 rounded-xl text-xs">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-900/60 block mb-0.5">Tujuan Perjalanan</span>
                            <p className="font-bold text-slate-900 leading-snug">{booking.purpose}</p>
                          </div>

                          {/* COMPREHENSIVE DETAILS GRID (EVERY SINGLE SPECIFICATION SHOWN) */}
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                            
                            {/* VEHICLE INFO */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kenderaan</span>
                              <p className="font-extrabold text-slate-800 mt-0.5 truncate">{vehicleInfo.name}</p>
                              <span className="inline-block mt-0.5 text-[10px] font-mono font-bold bg-slate-200/80 px-1.5 py-0.2 rounded text-slate-700">
                                {vehicleInfo.plate}
                              </span>
                            </div>

                            {/* REQUESTER & DEPT */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pemohon & Jabatan</span>
                              <p className="font-bold text-slate-800 mt-0.5 truncate">{booking.requesterName}</p>
                              <p className="text-[10px] text-slate-500 truncate">{booking.department || 'Am'}</p>
                            </div>

                            {/* ESCORT */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pengiring</span>
                              <p className="font-bold text-slate-800 mt-0.5 truncate">
                                {booking.escort ? booking.escort : 'Tiada Pengiring'}
                              </p>
                              <span className="text-[10px] text-slate-400">Pegawai Pengiring</span>
                            </div>

                            {/* PASSENGERS */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Penumpang</span>
                              <p className="font-bold text-slate-800 mt-0.5">
                                {totalPassengers} Orang
                              </p>
                              <p className="text-[10px] text-slate-500 truncate" title={passengerBreakdown || 'Tiada pecahan'}>
                                {passengerBreakdown || 'Tiada'}
                              </p>
                            </div>

                            {/* SHOULD WAIT SPEC */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Perlu Tunggu?</span>
                              <p className={`font-bold mt-0.5 text-[11px] ${booking.shouldWait ? 'text-amber-700' : 'text-slate-700'}`}>
                                {booking.shouldWait ? '⏳ Perlu Tunggu' : '🚀 Hantar Sahaja'}
                              </p>
                              <span className="text-[10px] text-slate-400">Di lokasi destinasi</span>
                            </div>

                            {/* RETURN TRIP SPEC */}
                            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Hala Perjalanan</span>
                              <p className="font-bold text-slate-800 mt-0.5 text-[11px]">
                                {booking.returnTrip ? '🔄 Pergi-Balik (2-Hala)' : '➡️ Satu Hala'}
                              </p>
                              <span className="text-[10px] text-slate-400">{booking.serviceType || 'Perlu Driver'}</span>
                            </div>

                          </div>

                          {/* OPTIONAL REMARKS / ADMIN NOTES */}
                          {booking.remarks && (
                            <div className="p-2.5 bg-amber-50/70 border border-amber-200/60 rounded-xl text-xs text-amber-900">
                              <span className="font-extrabold text-[10px] uppercase tracking-wide block text-amber-800 mb-0.5">Catatan Pemohon:</span>
                              <p className="leading-snug">{booking.remarks}</p>
                            </div>
                          )}

                          {booking.adminNotes && (
                            <div className="p-2.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-900">
                              <span className="font-extrabold text-[10px] uppercase tracking-wide block text-blue-800 mb-0.5">Nota Arahan Admin:</span>
                              <p className="leading-snug">{booking.adminNotes}</p>
                            </div>
                          )}

                          {/* ACTION BUTTONS */}
                          <div className="pt-1.5 border-t border-slate-100">
                            {isAssigned && (
                              <button
                                onClick={() => handleAcceptJob(booking.id)}
                                className="w-full flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-3 px-4 rounded-xl shadow-sm transition active:scale-98 text-xs sm:text-sm uppercase tracking-wider"
                              >
                                <CheckCircleIcon className="h-4 w-4" />
                                <span>Terima Tugasan Ini</span>
                              </button>
                            )}

                            {isConfirmed && (
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSingleOdometerOpen(booking.id)}
                                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-2.5 px-3 rounded-xl shadow-sm transition active:scale-98 text-xs uppercase tracking-wide"
                                >
                                  <GaugeIcon className="h-4 w-4" />
                                  <span>Lapor Meter & Selesai</span>
                                </button>
                                <button
                                  onClick={() => {
                                    if (window.confirm("Tandakan selesai trip ini secara terus tanpa log odometer?")) {
                                      updateBookingStatus(booking.id, 'Completed');
                                    }
                                  }}
                                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition font-bold text-xs uppercase tracking-wider"
                                  title="Selesai Serta-merta tanpa mengisi odometer"
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
                <div className="text-center py-10 px-4 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mb-3 text-indigo-600">
                    <TruckIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Menunggu Tugasan Seterusnya</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Tiada trip aktif yang ditugaskan buat masa ini. Sebarang trip baru dari admin akan muncul di sini secara automatik.
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* TAB: TRIP HISTORY */
            <div className="space-y-3">
              {historyBookings.length > 0 ? (
                historyBookings.map((booking: Booking) => {
                  const isCompleted = booking.status === 'Completed';
                  const vehicleInfo = getVehicleInfo(booking.vehicleId);
                  const dateTimeInfo = formatTripDateTime(booking.dateTime, booking.finishDateTime);

                  return (
                    <div 
                      key={booking.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-2xs text-xs space-y-2.5"
                    >
                      {/* HISTORY HEADER */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {booking.status === 'Completed' ? 'SELESAI ✅' : 'DIBATALKAN ❌'}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400 font-bold">
                            #{booking.id.split('-')[1] || booking.id.slice(0, 5)}
                          </span>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600">
                          {dateTimeInfo.date} • {dateTimeInfo.time}
                        </span>
                      </div>

                      {/* HISTORY ROUTE & PURPOSE */}
                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span>{booking.pickupPoint}</span>
                          <span className="text-slate-400">➡️</span>
                          <span className="text-indigo-900">{booking.destination}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          <strong className="text-slate-700">Tujuan:</strong> {booking.purpose}
                        </p>
                      </div>

                      {/* HISTORY METRICS & DETAILS */}
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                        <div>
                          <span className="text-slate-400 font-medium">Van:</span>{' '}
                          <strong className="text-slate-800">{vehicleInfo.name} ({vehicleInfo.plate})</strong>
                        </div>

                        {/* Odometer metrics */}
                        {isCompleted && booking.startOdometer !== undefined && booking.endOdometer !== undefined && (
                          <div className="px-2 py-0.5 bg-indigo-50 rounded border border-indigo-100 font-mono text-[10px] text-indigo-950">
                            Meter: {booking.startOdometer} ➡️ {booking.endOdometer} km (<strong className="text-indigo-700">+{booking.distance} km</strong>)
                          </div>
                        )}
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400 font-semibold text-xs border border-dashed rounded-xl">
                  Tiada rekod perjalanan selesai lagi.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TEAM SCHEDULE CALENDAR ACCORDION */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <button 
          onClick={() => setShowCalendar(!showCalendar)}
          className="w-full px-4 py-3 flex items-center justify-between text-left font-bold text-slate-800 focus:outline-none hover:bg-slate-50 transition"
        >
          <span className="flex items-center text-xs sm:text-sm font-extrabold text-slate-800">
            <RouteIcon className="h-4 w-4 mr-2 text-indigo-600" />
            Jadual Semua Pemandu & Kalendar
          </span>
          <span className="text-indigo-600 text-xs font-bold">{showCalendar ? 'Tutup ▲' : 'Papar ▼'}</span>
        </button>
        {showCalendar && (
          <div className="p-3.5 border-t border-slate-100 overflow-x-auto bg-slate-50/50">
            <CalendarView />
          </div>
        )}
      </div>

      {/* FLOATING ACTION BOTTOM BAR FOR MULTI-TRIP LOGGING */}
      {selectedBookingIds.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-auto md:w-[768px] bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex items-center justify-between z-40 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white font-extrabold h-8 w-8 rounded-full flex items-center justify-center text-xs shadow-sm border border-indigo-400">
              {selectedBookingIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">{selectedBookingIds.length} Trip Dipilih</p>
              <p className="text-[11px] text-slate-400 truncate max-w-[160px] sm:max-w-[320px]">
                Sedia untuk dilaporkan sekali gus
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedBookingIds([])}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg"
            >
              Batal
            </button>
            <button
              onClick={handleOpenOdometerForSelected}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3.5 rounded-xl shadow-md transition active:scale-95 text-xs uppercase tracking-wide flex items-center gap-1"
            >
              <GaugeIcon className="w-3.5 h-3.5" />
              <span>Hantar Meter ({selectedBookingIds.length})</span>
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
