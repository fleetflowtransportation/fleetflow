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
  ExternalLinkIcon,
  SearchIcon,
  XIcon,
  CalendarIcon
} from './icons/Icons';
import CalendarView from './CalendarView';
import DriverScheduleManager from './DriverScheduleManager';
import { parseAsLocal, getPickupLocationDisplay, isOtherPickup } from '../utils';

interface DriverDashboardProps {
  driver: CurrentUser;
}

type ActiveTab = 'today' | 'pending' | 'history';

// Helper to determine if a trip is from a past day (strictly before today 00:00:00)
const isPastTrip = (dateTimeStr: string): boolean => {
  try {
    const tripDate = parseAsLocal(dateTimeStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tripDay = new Date(tripDate);
    tripDay.setHours(0, 0, 0, 0);
    return tripDay.getTime() < today.getTime();
  } catch {
    return false;
  }
};

const DriverDashboard: React.FC<DriverDashboardProps> = ({ driver }) => {
  const { bookings, odometerLogs, fuelLogs, updateBookingStatus, vehicles } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [isFuelLogOpen, setIsFuelLogOpen] = useState(false);
  const [isOdometerLogOpen, setIsOdometerLogOpen] = useState(false);
  const [isIssueLogOpen, setIsIssueLogOpen] = useState(false);
  
  // Multiple booking selection states
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalTab, setScheduleModalTab] = useState<'calendar' | 'schedule'>('calendar');

  const getVehicleInfo = (vehicleId: string | null, serviceType?: string) => {
    if (!vehicleId) {
      if (serviceType === 'Self-Drive') return { name: 'Self-Drive (Alza)', plate: 'Pandu Sendiri' };
      return { name: 'Bebas (Belum Ditetapkan)', plate: 'Pemandu Tentukan' };
    }
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) return { name: vehicle.name, plate: vehicle.plateNumber };
    return { name: `Kenderaan #${vehicleId.slice(-4).toUpperCase()}`, plate: '-' };
  };

  // Helper search predicate for driver
  const matchesSearch = (b: Booking, query: string) => {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    const dt = parseAsLocal(b.dateTime);
    const dateStr = dt.toLocaleDateString('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }).toLowerCase();
    const dayStr = dt.toLocaleDateString('ms-MY', { weekday: 'long' }).toLowerCase();
    const pickupDisp = getPickupLocationDisplay(b.pickupPoint, b.address).toLowerCase();
    const vInfo = getVehicleInfo(b.vehicleId, b.serviceType);

    return (
      (b.requesterName && b.requesterName.toLowerCase().includes(q)) ||
      (b.destination && b.destination.toLowerCase().includes(q)) ||
      (b.purpose && b.purpose.toLowerCase().includes(q)) ||
      (b.department && b.department.toLowerCase().includes(q)) ||
      (b.address && b.address.toLowerCase().includes(q)) ||
      pickupDisp.includes(q) ||
      (b.requesterEmail && b.requesterEmail.toLowerCase().includes(q)) ||
      (b.id && b.id.toLowerCase().includes(q)) ||
      (vInfo.name && vInfo.name.toLowerCase().includes(q)) ||
      (vInfo.plate && vInfo.plate.toLowerCase().includes(q)) ||
      dateStr.includes(q) ||
      dayStr.includes(q)
    );
  };

  // 1. Current / Upcoming bookings (Today or Future, status Assigned or Confirmed)
  const currentBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && (b.status === 'Assigned' || b.status === 'Confirmed') && !isPastTrip(b.dateTime))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driver.id, driverSearchQuery]);

  // 2. Pending Odometer bookings from past days (Past date, but not completed yet)
  const pendingOdometerBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && (b.status === 'Assigned' || b.status === 'Confirmed') && isPastTrip(b.dateTime))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()); // Most recent first
  }, [bookings, driver.id, driverSearchQuery]);

  // 3. History bookings (Completed with odometer or Cancelled)
  const historyBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && (b.status === 'Completed' || b.status === 'Cancelled'))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
  }, [bookings, driver.id, driverSearchQuery]);

  // Active items based on current tab
  const activeList = useMemo(() => {
    if (activeTab === 'today') return currentBookings;
    if (activeTab === 'pending') return pendingOdometerBookings;
    return historyBookings;
  }, [activeTab, currentBookings, pendingOdometerBookings, historyBookings]);

  // Bulk selection status in active tab
  const allActiveSelected = useMemo(() => {
    if (activeList.length === 0) return false;
    return activeList.every(b => selectedBookingIds.includes(b.id));
  }, [activeList, selectedBookingIds]);

  const handleToggleSelectAllActive = () => {
    if (allActiveSelected) {
      const activeIds = new Set(activeList.map(b => b.id));
      setSelectedBookingIds(prev => prev.filter(id => !activeIds.has(id)));
    } else {
      const combined = new Set([...selectedBookingIds, ...activeList.map(b => b.id)]);
      setSelectedBookingIds(Array.from(combined));
    }
  };

  const selectedAssignedCount = useMemo(() => {
    return selectedBookingIds.filter(id => {
      const b = bookings.find(x => x.id === id);
      return b?.status === 'Assigned';
    }).length;
  }, [selectedBookingIds, bookings]);

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

  const handleBulkAcceptJobs = () => {
    const assignedIds = selectedBookingIds.filter(id => {
      const b = bookings.find(x => x.id === id);
      return b?.status === 'Assigned';
    });
    if (assignedIds.length === 0) return;
    assignedIds.forEach(id => updateBookingStatus(id, 'Confirmed'));
  };

  const handleBulkCompleteJobs = () => {
    if (selectedBookingIds.length === 0) return;
    if (confirm(`Tandakan ${selectedBookingIds.length} trip terpilih sebagai 'Selesai'?`)) {
      selectedBookingIds.forEach(id => updateBookingStatus(id, 'Completed'));
      setSelectedBookingIds([]);
    }
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

  const renderBookingCard = (booking: Booking, isPastPending = false) => {
    const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);
    const passengerBreakdown = booking.passengers
      .filter(p => p.count > 0)
      .map(p => `${p.count} ${p.category}`)
      .join(', ');

    const isAssigned = booking.status === 'Assigned';
    const isConfirmed = booking.status === 'Confirmed';
    const isChecked = selectedBookingIds.includes(booking.id);
    const vehicleInfo = getVehicleInfo(booking.vehicleId, booking.serviceType);
    const dateTimeInfo = formatTripDateTime(booking.dateTime, booking.finishDateTime);

    return (
      <div 
        key={booking.id}
        className={`rounded-2xl border transition-all duration-200 bg-white overflow-hidden ${
          isChecked 
            ? 'border-indigo-600 ring-2 ring-indigo-500/20 shadow-md' 
            : isPastPending
              ? 'border-amber-400 hover:border-amber-500 shadow-sm'
              : isAssigned 
                ? 'border-amber-300 hover:border-amber-400 shadow-sm' 
                : 'border-emerald-300 hover:border-emerald-400 shadow-sm'
        }`}
      >
        {/* PAST TRIP NOTICE BANNER (ONLY FOR PENDING PAST TRIPS) */}
        {isPastPending && (
          <div className="bg-amber-100/90 border-b border-amber-200 px-3.5 py-1.5 flex items-center justify-between text-[11px] text-amber-950 font-bold">
            <div className="flex items-center gap-1.5">
              <span>⚠️</span>
              <span>Trip Tarikh Lepas: {dateTimeInfo.date}</span>
            </div>
            <span className="text-[10px] text-amber-900 font-extrabold bg-amber-200/80 px-2 py-0.5 rounded">
              Menunggu Meter
            </span>
          </div>
        )}

        {/* CARD HEADER BAR */}
        <div 
          onClick={() => {
            handleToggleSelectBooking(booking.id);
          }}
          className={`px-3.5 py-2.5 border-b flex items-center justify-between text-xs transition-colors cursor-pointer select-none ${
            isChecked 
              ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
              : isPastPending
                ? 'bg-amber-50/90 border-amber-200 text-amber-950'
                : isAssigned 
                  ? 'bg-amber-50/80 border-amber-100 text-amber-950' 
                  : 'bg-emerald-50/80 border-emerald-100 text-emerald-950'
          }`}
        >
          <div className="flex items-center gap-2">
            <input 
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleSelectBooking(booking.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
              title="Pilih untuk tindakan lumpsum"
            />
            <div className="flex items-center gap-1.5">
              <span className={`inline-block w-2 h-2 rounded-full ${
                isPastPending ? 'bg-amber-600 animate-pulse' : isAssigned ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}></span>
              <span className="font-extrabold uppercase tracking-wide text-[11px]">
                {isPastPending ? 'Trip Tertunggak (Belum Selesai)' : isAssigned ? 'Tugasan Baru Ditawarkan' : 'Dalam Perjalanan (Confirmed)'}
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

          {/* ROUTE SECTION */}
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
                  <p className="text-xs sm:text-sm font-bold text-slate-900 leading-tight">{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</p>
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
                  {booking.address && !isOtherPickup(booking.pickupPoint) && booking.address !== booking.destination && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">{booking.address}</p>
                  )}
                  
                  {/* QUICK NAVIGATION BUTTON FOR DRIVER */}
                  <div className="mt-1.5">
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(booking.destination)}`}
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

          {/* COMPREHENSIVE DETAILS GRID (4 CLEAN TILES) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            
            {/* VEHICLE INFO */}
            <div className={`p-2.5 rounded-xl border ${!booking.vehicleId ? 'bg-amber-50/70 border-amber-200/80' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Kenderaan</span>
              <p className={`font-extrabold mt-0.5 truncate ${!booking.vehicleId ? 'text-amber-800' : 'text-slate-800'}`}>
                {vehicleInfo.name}
              </p>
              <span className={`inline-block mt-0.5 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                !booking.vehicleId ? 'bg-amber-200/90 text-amber-900' : 'bg-slate-200/80 text-slate-700'
              }`}>
                {vehicleInfo.plate}
              </span>
            </div>

            {/* REQUESTER & DEPT */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Pemohon & Jabatan</span>
              <p className="font-bold text-slate-800 mt-0.5 truncate">{booking.requesterName}</p>
              <p className="text-[10px] text-slate-500 truncate">{booking.department || 'Am'}</p>
            </div>

            {/* PASSENGERS */}
            <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Penumpang</span>
              <p className="font-bold text-slate-800 mt-0.5">
                {totalPassengers} Orang
              </p>
              <p className="text-[10px] text-slate-500 truncate" title={passengerBreakdown || 'Tiada pecahan'}>
                {passengerBreakdown || 'Tiada pecahan'}
              </p>
            </div>

            {/* SHOULD WAIT SPEC */}
            <div className={`p-2.5 rounded-xl border ${booking.shouldWait ? 'bg-amber-50/70 border-amber-200/80' : 'bg-slate-50 border-slate-100'}`}>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Perlu Tunggu?</span>
              <p className={`font-bold mt-0.5 text-[11px] ${booking.shouldWait ? 'text-amber-800' : 'text-slate-700'}`}>
                {booking.shouldWait ? '⏳ Perlu Tunggu' : '🚀 Hantar Sahaja'}
              </p>
              <span className="text-[10px] text-slate-400">
                {booking.shouldWait ? 'Tunggu di destinasi' : 'Tidak perlu tunggu'}
              </span>
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
  };

  return (
    <div className="max-w-md md:max-w-3xl mx-auto space-y-5 pb-28 relative">
      
      {/* DRIVER COCKPIT PROFILE */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 border border-indigo-400/40 cursor-pointer"
            title="Buka Jadual Pemandu & Kalendar"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Jadual Pemandu</span>
          </button>
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <button
          onClick={() => setIsScheduleModalOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-indigo-50/70 border border-indigo-200 rounded-xl shadow-sm transition active:scale-98 text-center group cursor-pointer"
          title="Lihat jadual bertugas dan kalendar perjalanan"
        >
          <div className="p-2 bg-indigo-50 group-hover:bg-indigo-100 rounded-lg text-indigo-600 mb-1.5 border border-indigo-100 transition">
            <CalendarIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-indigo-900">Jadual Pemandu</span>
        </button>
        <button
          onClick={() => setIsFuelLogOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-amber-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center cursor-pointer"
        >
          <div className="p-2 bg-amber-50 rounded-lg text-amber-600 mb-1.5 border border-amber-100">
            <FuelIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Log Minyak</span>
        </button>
        <button
          onClick={handleOpenGeneralOdometer}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-emerald-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center cursor-pointer"
        >
          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-600 mb-1.5 border border-emerald-100">
            <GaugeIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Log Odometer</span>
        </button>
        <button
          onClick={() => setIsIssueLogOpen(true)}
          className="flex flex-col items-center justify-center p-3 bg-white hover:bg-rose-50/60 border border-slate-200 rounded-xl shadow-sm transition active:scale-98 text-center cursor-pointer"
        >
          <div className="p-2 bg-rose-50 rounded-lg text-rose-600 mb-1.5 border border-rose-100">
            <WrenchScrewdriverIcon className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700">Lapor Isu Van</span>
        </button>
      </div>

      {/* DRIVER SEARCH BAR */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm space-y-2">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <SearchIcon className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={driverSearchQuery}
            onChange={(e) => setDriverSearchQuery(e.target.value)}
            placeholder="Cari booking (nama pemohon, destinasi, pickup, tujuan, tarikh, kenderaan)..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
          />
          {driverSearchQuery && (
            <button
              onClick={() => setDriverSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              title="Kosongkan carian"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        {driverSearchQuery && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
            <span>
              Menunjukkan <strong>{activeList.length}</strong> padanan dalam tab ini
            </span>
            <button
              onClick={() => setDriverSearchQuery('')}
              className="text-indigo-600 font-bold hover:underline"
            >
              Kosongkan Carian
            </button>
          </div>
        )}
      </div>

      {/* TABBED INTERFACE (TUGASAN SEMASA, PERLU LAPOR METER, SEJARAH) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* TABS HEADER */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1">
          {/* TAB 1: TUGASAN SEMASA */}
          <button
            onClick={() => {
              setActiveTab('today');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 ${
              activeTab === 'today' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Hari Ini & Depan</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'today' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {currentBookings.length}
            </span>
          </button>

          {/* TAB 2: PERLU LAPOR METER (PAST TRIPS WITHOUT ODOMETER) */}
          <button
            onClick={() => {
              setActiveTab('pending');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pending' 
                ? 'bg-white text-amber-800 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Perlu Lapor Meter</span>
            {pendingOdometerBookings.length > 0 ? (
              <span className="bg-amber-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-extrabold animate-pulse shadow-2xs">
                {pendingOdometerBookings.length}
              </span>
            ) : (
              <span className="bg-slate-200 text-slate-500 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                0
              </span>
            )}
          </button>

          {/* TAB 3: SEJARAH TRIP */}
          <button
            onClick={() => {
              setActiveTab('history');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 ${
              activeTab === 'history' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Sejarah Trip</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'history' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {historyBookings.length}
            </span>
          </button>
        </div>

        <div className="p-3.5 sm:p-5 space-y-4">
          {/* BULK SELECT TOOLBAR (PILIH SEMUA / LUMPSUM) */}
          {activeList.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={allActiveSelected}
                  onChange={handleToggleSelectAllActive}
                  className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Pilih Semua ({activeList.length} trip dalam tab ini)</span>
              </label>

              {selectedBookingIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full text-[11px] border border-indigo-200">
                    {selectedBookingIds.length} Dipilih
                  </span>
                  <button
                    onClick={() => setSelectedBookingIds([])}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] hover:underline"
                  >
                    Batal Pilihan
                  </button>
                </div>
              )}
            </div>
          )}
          {/* TAB 1: CURRENT & UPCOMING BOOKINGS */}
          {activeTab === 'today' && (
            <div className="space-y-4">
              {currentBookings.length > 0 ? (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs flex items-start gap-2.5 text-slate-700">
                    <span className="text-sm">💡</span>
                    <p className="text-[11px] leading-relaxed">
                      <strong>Tugasan Hari Ini & Akan Datang:</strong> Paparan fokus untuk tugasan hari ini. Anda boleh tanda checkbox pada trip yang selesai, kemudian tekan butang <strong>"Hantar Meter"</strong> di bawah untuk menghantar laporan odometer sekali gus.
                    </p>
                  </div>

                  {currentBookings.map((booking: Booking) => renderBookingCard(booking, false))}
                </>
              ) : (
                <div className="text-center py-10 px-4 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mb-3 text-indigo-600">
                    <TruckIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">Tiada Tugasan Hari Ini / Akan Datang</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    Semua tugasan hari ini telah selesai atau belum ditugaskan oleh admin. Sebarang trip baru akan muncul di sini secara automatik.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING ODOMETER (TRIP TARIKH LEPAS) */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingOdometerBookings.length > 0 ? (
                <>
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs flex items-start gap-2.5 text-amber-900">
                    <span className="text-base">⚠️</span>
                    <div className="space-y-1 text-[11px] leading-relaxed">
                      <p className="font-extrabold text-amber-950">
                        {pendingOdometerBookings.length} Trip Dari Hari Lepas Belum Direkod Odometer:
                      </p>
                      <p>
                        Trip-trip ini telah dipisahkan ke sini supaya tidak mencampuradukkan jadual hari ini. Anda boleh tanda checkbox dan lapor meter bila-bila masa (seperti habis syif atau keesokan paginya). Selepas dilaporkan, trip akan automatik berpindah ke <strong>Sejarah Trip</strong>.
                      </p>
                    </div>
                  </div>

                  {pendingOdometerBookings.map((booking: Booking) => renderBookingCard(booking, true))}
                </>
              ) : (
                <div className="text-center py-10 px-4 flex flex-col items-center justify-center border border-dashed border-emerald-200 rounded-2xl bg-emerald-50/40">
                  <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center mb-3 text-emerald-600">
                    <CheckCircleIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-emerald-900">Hebat! Tiada Trip Tertunggak</p>
                  <p className="text-xs text-emerald-700 mt-1 max-w-xs leading-relaxed">
                    Semua trip tarikh lepas telah lengkap direkod bacaan odometer dan berada dalam Sejarah Trip.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SEJARAH TRIP */}
          {activeTab === 'history' && (
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
                          <span>{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</span>
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

      {/* DRIVER SCHEDULE & CALENDAR MODAL (ACCESSIBLE FROM TOP BUTTONS) */}
      {isScheduleModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/80 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Jadual Pemandu & Kalendar</h3>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Semak jadual bertugas, syif dan kalendar perjalanan semua kenderaan
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Switch between Kalendar Tempahan and Jadual Syif on Desktop */}
                <div className="hidden sm:flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setScheduleModalTab('calendar')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      scheduleModalTab === 'calendar'
                        ? 'bg-white text-indigo-700 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Kalendar Tempahan
                  </button>
                  <button
                    onClick={() => setScheduleModalTab('schedule')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      scheduleModalTab === 'schedule'
                        ? 'bg-white text-indigo-700 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Jadual Syif Pemandu
                  </button>
                </div>

                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Tutup Modal"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Switch between Kalendar Tempahan and Jadual Syif on Mobile */}
            <div className="sm:hidden flex border-b border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setScheduleModalTab('calendar')}
                className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${
                  scheduleModalTab === 'calendar'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600'
                }`}
              >
                Kalendar Tempahan
              </button>
              <button
                onClick={() => setScheduleModalTab('schedule')}
                className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${
                  scheduleModalTab === 'schedule'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600'
                }`}
              >
                Jadual Syif
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-5 overflow-y-auto flex-1 bg-slate-50/50 min-h-[350px]">
              {scheduleModalTab === 'calendar' ? (
                <CalendarView readOnly={true} />
              ) : (
                <DriverScheduleManager readOnly={true} />
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span className="font-medium">
                Paparan: <strong className="text-slate-700">{scheduleModalTab === 'calendar' ? 'Kalendar Trip & Tempahan' : 'Jadual Syif / Bertugas Pemandu'}</strong>
              </span>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BOTTOM BAR FOR MULTI-TRIP (BULK / LUMPSUM) */}
      {selectedBookingIds.length > 0 && (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-auto md:w-[768px] bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 z-40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white font-extrabold h-8 w-8 rounded-full flex items-center justify-center text-xs shadow-sm border border-indigo-400">
              {selectedBookingIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">{selectedBookingIds.length} Trip Dipilih</p>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">
                Tindakan lumpsum untuk pemandu
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedAssignedCount > 0 && (
              <button
                onClick={handleBulkAcceptJobs}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl shadow-md transition active:scale-95 text-xs flex items-center gap-1"
                title="Terima dan sahkan tugasan yang dipilih"
              >
                <span>Terima Tugasan ({selectedAssignedCount})</span>
              </button>
            )}

            <button
              onClick={handleOpenOdometerForSelected}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3.5 rounded-xl shadow-md transition active:scale-95 text-xs uppercase tracking-wide flex items-center gap-1"
              title="Isi rekod odometer sekali gus untuk trip terpilih"
            >
              <GaugeIcon className="w-3.5 h-3.5" />
              <span>Hantar Meter ({selectedBookingIds.length})</span>
            </button>

            <button
              onClick={handleBulkCompleteJobs}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl shadow-md transition active:scale-95 text-xs"
              title="Tanda selesai semua trip yang dipilih secara langsung"
            >
              Direct Selesai
            </button>

            <button
              onClick={() => setSelectedBookingIds([])}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg"
            >
              Batal
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
