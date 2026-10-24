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
  CalendarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ClipboardListIcon
} from './icons/Icons';
import CalendarView from './CalendarView';
import DriverScheduleManager from './DriverScheduleManager';
import DriverSpeedDial from './DriverSpeedDial';
import { FeedbackModal } from './FeedbackModal';
import { BookingDetailModal } from './BookingDetailModal';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { parseAsLocal, getPickupLocationDisplay, isOtherPickup, getRouteLabel, getStops, resolveDriver } from '../utils';

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
  const { bookings, odometerLogs, fuelLogs, updateBookingStatus, vehicles, users } = useAppContext();
  const [activeTab, setActiveTab] = useState<ActiveTab>('today');
  const [isFuelLogOpen, setIsFuelLogOpen] = useState(false);
  const [isOdometerLogOpen, setIsOdometerLogOpen] = useState(false);
  const [isIssueLogOpen, setIsIssueLogOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [selectedVehicleForOdometer, setSelectedVehicleForOdometer] = useState<string | undefined>(undefined);
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);

  // Multiple booking selection states
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  const [driverSearchQuery, setDriverSearchQuery] = useState('');
  const [isBulkCompleteConfirmOpen, setIsBulkCompleteConfirmOpen] = useState(false);
  
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleModalTab, setScheduleModalTab] = useState<'calendar' | 'schedule'>('calendar');
  const [isFleetOdoExpanded, setIsFleetOdoExpanded] = useState(false);

  // Check if any modal popup is open in the Driver portal
  const isAnyModalOpen = isScheduleModalOpen || 
    isFuelLogOpen || 
    isOdometerLogOpen || 
    isIssueLogOpen || 
    isFeedbackOpen || 
    isBulkCompleteConfirmOpen ||
    Boolean(viewingBooking);

  // Lock body scroll whenever any modal is active
  useBodyScrollLock(isAnyModalOpen);

  // Fleet vehicle odometer lookup for driver dashboard
  const fleetVehicleOdometerMap = useMemo(() => {
    const map: Record<string, { lastOdometer: number; lastDate?: string }> = {};
    vehicles.forEach(v => {
      const vLogs = odometerLogs
        .filter(l => l.vehicleId === v.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (vLogs.length > 0) {
        const maxReading = Math.max(...vLogs.map(l => Number(l.odometer) || 0));
        map[v.id] = {
          lastOdometer: maxReading,
          lastDate: vLogs[0].date
        };
      } else {
        map[v.id] = {
          lastOdometer: Number(v.currentOdometer) || 0,
          lastDate: undefined
        };
      }
    });
    return map;
  }, [vehicles, odometerLogs]);

  const getVehicleInfo = (vehicleId: string | null, serviceType?: string) => {
    if (!vehicleId) {
      if (serviceType === 'Self-Drive') return { name: 'Self-Drive (Alza)', plate: 'Self-Drive' };
      return { name: 'Any (Unassigned)', plate: 'Driver Dispatches' };
    }
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) return { name: vehicle.name, plate: vehicle.plateNumber };
    return { name: `Vehicle #${vehicleId.slice(-4).toUpperCase()}`, plate: '-' };
  };

  // Resolve legacy booking driver references (name/email/Auth UUID) to the canonical fleet user ID.
  // The admin assignment display already resolves these aliases; the Driver Dashboard must do the same.
  const isAssignedToCurrentDriver = (booking: Booking) => {
    if (!booking.driverId) return false;
    if (booking.driverId === driver.id) return true;
    return resolveDriver(users, booking.driverId, booking.calendarEventTitle)?.id === driver.id;
  };

  // Helper search predicate for driver
  const matchesSearch = (b: Booking, query: string) => {
    if (!query) return true;
    const q = query.trim().toLowerCase();
    const dt = parseAsLocal(b.dateTime);
    const dateStr = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).toLowerCase();
    const dayStr = dt.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    const pickupDisp = getPickupLocationDisplay(b.pickupPoint, b.address).toLowerCase();
    const vInfo = getVehicleInfo(b.vehicleId, b.serviceType);

    return (
      (b.requesterName && b.requesterName.toLowerCase().includes(q)) ||
      (b.destination && b.destination.toLowerCase().includes(q)) ||
      (b.stops && b.stops.some(s => (s.address || '').toLowerCase().includes(q) || (s.notes || '').toLowerCase().includes(q))) ||
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

  // 1. Current / Upcoming bookings (Today or Future, status Assigned, Confirmed, or Pending if assigned to driver)
  const currentBookings = useMemo(() => {
    return bookings
      .filter(b => isAssignedToCurrentDriver(b) && (b.status === 'Assigned' || b.status === 'Confirmed' || b.status === 'Pending') && !isPastTrip(b.dateTime))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driver.id, driverSearchQuery, users]);

  // 2. Pending Odometer bookings from past days (Past date, but not completed yet)
  const pendingOdometerBookings = useMemo(() => {
    return bookings
      .filter(b => isAssignedToCurrentDriver(b) && (b.status === 'Assigned' || b.status === 'Confirmed' || b.status === 'Pending') && isPastTrip(b.dateTime))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime()); // Most recent first
  }, [bookings, driver.id, driverSearchQuery, users]);

  // 3. History bookings (Completed with odometer or Cancelled)
  const historyBookings = useMemo(() => {
    return bookings
      .filter(b => isAssignedToCurrentDriver(b) && (b.status === 'Completed' || b.status === 'Cancelled'))
      .filter(b => matchesSearch(b, driverSearchQuery))
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
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
      return b?.status === 'Assigned' || b?.status === 'Pending';
    }).length;
  }, [selectedBookingIds, bookings]);

  // Statistics
  const completedTripsCount = useMemo(() => {
    return bookings.filter(b => isAssignedToCurrentDriver(b) && b.status === 'Completed').length;
  }, [bookings, driver.id, users]);

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
      return b?.status === 'Assigned' || b?.status === 'Pending';
    });
    if (assignedIds.length === 0) return;
    assignedIds.forEach(id => updateBookingStatus(id, 'Confirmed'));
  };

  const handleBulkCompleteJobs = () => {
    if (selectedBookingIds.length === 0) return;
    setIsBulkCompleteConfirmOpen(true);
  };

  const handleConfirmBulkComplete = () => {
    selectedBookingIds.forEach(id => updateBookingStatus(id, 'Completed'));
    setSelectedBookingIds([]);
    setIsBulkCompleteConfirmOpen(false);
  };

  const handleToggleSelectBooking = (id: string) => {
    setSelectedBookingIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleOpenOdometerForSelected = () => {
    if (selectedBookingIds.length === 0) return;
    setSelectedVehicleForOdometer(undefined);
    setIsOdometerLogOpen(true);
  };

  const handleSingleOdometerOpen = (id: string) => {
    setSelectedBookingIds([id]);
    setSelectedVehicleForOdometer(undefined);
    setIsOdometerLogOpen(true);
  };

  const handleOpenGeneralOdometer = () => {
    setSelectedBookingIds([]);
    setSelectedVehicleForOdometer(undefined);
    setIsOdometerLogOpen(true);
  };

  const formatTripDateTime = (dateTimeStr: string, finishDateTimeStr?: string) => {
    try {
      const start = parseAsLocal(dateTimeStr);
      const dateFormatted = start.toLocaleDateString('en-GB', {
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
    const isAssigned = booking.status === 'Assigned' || booking.status === 'Pending';
    const isConfirmed = booking.status === 'Confirmed';
    const isChecked = selectedBookingIds.includes(booking.id);
    const vehicleInfo = getVehicleInfo(booking.vehicleId, booking.serviceType);
    const dateTimeInfo = formatTripDateTime(booking.dateTime, booking.finishDateTime);
    const pickup = getPickupLocationDisplay(booking.pickupPoint, booking.address);

    const openDetails = () => setViewingBooking(booking);

    return (
      <div
        key={booking.id}
        role="button"
        tabIndex={0}
        onClick={openDetails}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetails();
          }
        }}
        className={`rounded-2xl border bg-white overflow-hidden transition-all duration-150 active:scale-[0.99] cursor-pointer select-none ${
          isChecked
            ? 'border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
            : isPastPending
              ? 'border-amber-400 shadow-sm'
              : isAssigned
                ? 'border-amber-300 shadow-sm'
                : 'border-emerald-300 shadow-sm'
        }`}
      >
        {/* Status strip */}
        <div
          className={`px-3.5 py-2 flex items-center justify-between gap-2 text-[11px] font-extrabold uppercase tracking-wide ${
            isPastPending
              ? 'bg-amber-50 text-amber-900 border-b border-amber-200'
              : isAssigned
                ? 'bg-amber-50 text-amber-900 border-b border-amber-100'
                : 'bg-emerald-50 text-emerald-900 border-b border-emerald-100'
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleSelectBooking(booking.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
              title="Select for batch actions"
              aria-label="Select trip"
            />
            <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
              isPastPending ? 'bg-amber-600 animate-pulse' : isAssigned ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`} />
            <span className="truncate">
              {isPastPending ? 'Pending meter' : isAssigned ? 'New job' : 'In progress'}
            </span>
          </div>
          {booking.shouldWait ? (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-amber-200/80 text-amber-950 text-[10px] font-black">
              Standby
            </span>
          ) : (
            <span className="shrink-0 px-2 py-0.5 rounded-full bg-white/80 text-slate-600 text-[10px] font-bold border border-slate-200/80">
              Drop-off
            </span>
          )}
        </div>

        {/* Compact body — date, pickup, destination, requester, vehicle */}
        <div className="p-3.5 space-y-3">
          {/* Date & time */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
              <ClockIcon className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>{dateTimeInfo.date}</span>
            </div>
            <span className="text-[11px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 whitespace-nowrap">
              {dateTimeInfo.time}
            </span>
          </div>

          {/* Route */}
          <div className="space-y-2">
            <div className="flex items-start gap-2.5">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup</span>
                <p className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">{pickup}</p>
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="mt-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-100 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {getStops(booking).length > 1 ? `Route (${getStops(booking).length})` : 'Destination'}
                </span>
                <p className="text-sm font-extrabold text-slate-900 leading-snug line-clamp-2">{getRouteLabel(booking)}</p>
              </div>
            </div>
          </div>

          {/* Requester · Vehicle · Standby row */}
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requester</span>
              <p className="text-xs font-bold text-slate-800 truncate">{booking.requesterName || '—'}</p>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle</span>
              <p className={`text-xs font-bold truncate ${!booking.vehicleId ? 'text-amber-800' : 'text-slate-800'}`}>
                {vehicleInfo.name}
              </p>
              <p className="text-[10px] font-mono font-semibold text-slate-500 truncate">{vehicleInfo.plate}</p>
            </div>
          </div>

          <p className="text-[11px] font-semibold text-indigo-600 text-center pt-0.5">
            Tap for details →
          </p>
        </div>
      </div>
    );
  };


  return (
    <div className="max-w-md md:max-w-3xl mx-auto space-y-4 px-1 sm:px-0 pb-28 relative safe-area-pb">
      
      {/* DRIVER COCKPIT PROFILE */}
      <div className="bg-slate-900 text-white p-5 rounded-2xl shadow-md border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/30 p-2 rounded-xl border border-indigo-500/40 text-indigo-300">
              <UserCircleIcon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Driver Portal</span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1 animate-pulse"></span>
                  On Duty (Online)
                </span>
              </div>
              <h2 className="text-lg font-extrabold tracking-tight text-white mt-0.5">{driver.name}</h2>
            </div>
          </div>

          <button
            onClick={() => setIsScheduleModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl shadow-md transition active:scale-95 border border-indigo-400/40 cursor-pointer"
            title="Open Driver Schedule & Calendar"
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Driver Schedule</span>
          </button>
        </div>

        {/* DRIVER METRICS STRIP */}
        <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-slate-800 text-center">
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-emerald-400">{completedTripsCount}</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Completed Trips</span>
          </div>
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-indigo-300">{totalDriverMileage.toLocaleString()} km</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Total Distance</span>
          </div>
          <div className="bg-slate-800/60 py-2 px-2 rounded-xl border border-slate-700/60">
            <span className="block text-lg font-extrabold text-amber-300">{fuelLogsCount}</span>
            <span className="block text-[10px] text-slate-400 font-medium uppercase tracking-wider">Fuel Logs</span>
          </div>
        </div>
      </div>

      {/* COLLAPSIBLE FLEET VEHICLE LAST ODOMETER REFERENCE */}
      {vehicles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden transition-all duration-200">
          {/* Collapsible Header Banner */}
          <button
            type="button"
            onClick={() => setIsFleetOdoExpanded(!isFleetOdoExpanded)}
            className="w-full px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 text-left transition hover:bg-slate-50 cursor-pointer select-none"
            aria-expanded={isFleetOdoExpanded}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-700 rounded-xl border border-indigo-100 shrink-0">
                <GaugeIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 tracking-tight">
                    Fleet Vehicle Odometers
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {vehicles.length} Vehicles
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                  Latest recorded mileage for all active fleet vehicles
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-indigo-600 text-xs font-bold shrink-0">
              <span>{isFleetOdoExpanded ? 'Hide' : 'View'}</span>
              {isFleetOdoExpanded ? (
                <ChevronUpIcon className="w-4 h-4" />
              ) : (
                <ChevronDownIcon className="w-4 h-4" />
              )}
            </div>
          </button>

          {/* Expandable Read-Only List */}
          {isFleetOdoExpanded && (
            <div className="border-t border-slate-100 p-3 sm:p-4 bg-slate-50/60 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {vehicles.map(v => {
                  const odoInfo = fleetVehicleOdometerMap[v.id];
                  const lastKm = odoInfo ? odoInfo.lastOdometer : (v.currentOdometer || 0);
                  const isMaintenance = v.vehicleStatus === 'Under Maintenance';
                  const lastUpdatedDate = odoInfo?.lastDate
                    ? parseAsLocal(odoInfo.lastDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                    : null;

                  return (
                    <div 
                      key={v.id}
                      className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="bg-slate-900 text-white font-mono font-black text-xs px-2 py-0.5 rounded shadow-2xs tracking-wider">
                            {v.plateNumber}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMaintenance ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-500 truncate mt-1">
                          {v.name}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight font-mono">
                          {lastKm.toLocaleString()} <span className="text-[10px] font-bold text-indigo-600">KM</span>
                        </div>
                        {lastUpdatedDate && (
                          <div className="text-[9px] font-semibold text-slate-400">
                            {lastUpdatedDate}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

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
            placeholder="Search bookings (requester name, destination, pickup, purpose, date, vehicle)..."
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
          />
          {driverSearchQuery && (
            <button
              onClick={() => setDriverSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Clear search"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
        {driverSearchQuery && (
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1 pt-1">
            <span>
              Showing <strong>{activeList.length}</strong> results in this tab
            </span>
            <button
              onClick={() => setDriverSearchQuery('')}
              className="text-indigo-600 font-bold hover:underline cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        )}
      </div>

      {/* TABBED INTERFACE */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* TABS HEADER */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 p-1 gap-1">
          {/* TAB 1: CURRENT & UPCOMING */}
          <button
            onClick={() => {
              setActiveTab('today');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'today' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Today & Upcoming</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'today' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {currentBookings.length}
            </span>
          </button>

          {/* TAB 2: PENDING ODOMETER (PAST TRIPS WITHOUT ODOMETER) */}
          <button
            onClick={() => {
              setActiveTab('pending');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pending' 
                ? 'bg-white text-amber-800 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Pending Odometer</span>
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

          {/* TAB 3: HISTORY */}
          <button
            onClick={() => {
              setActiveTab('history');
              setSelectedBookingIds([]);
            }}
            className={`flex-1 py-2.5 px-2 rounded-xl text-center font-bold text-[11px] sm:text-xs transition flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'history' 
                ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' 
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Trip History</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
              activeTab === 'history' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {historyBookings.length}
            </span>
          </button>
        </div>

        <div className="p-3.5 sm:p-5 space-y-4">
          {/* BULK SELECT TOOLBAR */}
          {activeList.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 border border-slate-200 px-3.5 py-2.5 rounded-xl text-xs">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-700 select-none">
                <input
                  type="checkbox"
                  checked={allActiveSelected}
                  onChange={handleToggleSelectAllActive}
                  className="h-4 w-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Select All ({activeList.length} trips in this tab)</span>
              </label>

              {selectedBookingIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full text-[11px] border border-indigo-200">
                    {selectedBookingIds.length} Selected
                  </span>
                  <button
                    onClick={() => setSelectedBookingIds([])}
                    className="text-slate-500 hover:text-slate-800 font-bold text-[11px] hover:underline cursor-pointer"
                  >
                    Clear Selection
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
                      <strong>Today & Upcoming Tasks:</strong> Focused view for today's assignments. You can check the boxes on completed trips, then click <strong>"Submit Meter"</strong> below to submit batch odometer reports.
                    </p>
                  </div>

                  {currentBookings.map((booking: Booking) => renderBookingCard(booking, false))}
                </>
              ) : (
                <div className="text-center py-10 px-4 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                  <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center mb-3 text-indigo-600">
                    <TruckIcon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">No Tasks Today / Upcoming</p>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">
                    All tasks for today are completed or have not been assigned yet. Any new trips will automatically appear here.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PENDING ODOMETER (PAST TRIPS) */}
          {activeTab === 'pending' && (
            <div className="space-y-4">
              {pendingOdometerBookings.length > 0 ? (
                <>
                  <div className="bg-amber-50 p-3.5 rounded-xl border border-amber-200 text-xs flex items-start gap-2.5 text-amber-900">
                    <span className="text-base">⚠️</span>
                    <div className="space-y-1 text-[11px] leading-relaxed">
                      <p className="font-extrabold text-amber-950">
                        {pendingOdometerBookings.length} Trips from previous days without odometer records:
                      </p>
                      <p>
                        These trips are separated here to keep today's schedule clean. You can check the boxes and report meter anytime (e.g. at end of shift or the next morning). Once reported, trips move automatically to <strong>Trip History</strong>.
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
                  <p className="text-sm font-bold text-emerald-900">Great! No Overdue Trips</p>
                  <p className="text-xs text-emerald-700 mt-1 max-w-xs leading-relaxed">
                    All past trips have completed odometer records and are archived in Trip History.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TRIP HISTORY */}
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
                            {booking.status === 'Completed' ? 'COMPLETED ✅' : 'CANCELLED ❌'}
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
                          <span className="text-indigo-900">{getRouteLabel(booking)}</span>
                        </div>
                        <p className="text-[11px] text-slate-600">
                          <strong className="text-slate-700">Purpose:</strong> {booking.purpose}
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
                  No completed trip records yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* DRIVER SCHEDULE & CALENDAR MODAL */}
      {isScheduleModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/80 backdrop-blur-sm overscroll-contain animate-in fade-in duration-150"
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) e.preventDefault();
          }}
        >
          <div className="bg-white w-full max-w-5xl h-[92vh] sm:h-auto sm:max-h-[90vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 overscroll-contain">
            {/* Modal Header */}
            <div className="shrink-0 px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl border border-indigo-200">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-extrabold text-slate-900">Driver Schedule & Calendar</h3>
                  <p className="text-xs text-slate-500 hidden sm:block">
                    Check duty schedules, shifts, and trip calendars across all vehicles
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Switch between Booking Calendar and Shift Schedule on Desktop */}
                <div className="hidden sm:flex bg-slate-200/80 p-0.5 rounded-xl text-xs font-semibold">
                  <button
                    onClick={() => setScheduleModalTab('calendar')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      scheduleModalTab === 'calendar'
                        ? 'bg-white text-indigo-700 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Booking Calendar
                  </button>
                  <button
                    onClick={() => setScheduleModalTab('schedule')}
                    className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                      scheduleModalTab === 'schedule'
                        ? 'bg-white text-indigo-700 shadow-sm font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Driver Shifts
                  </button>
                </div>

                <button
                  onClick={() => setIsScheduleModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                  title="Close Modal"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Switch on Mobile */}
            <div className="shrink-0 sm:hidden flex border-b border-slate-200 bg-slate-100 p-1 text-xs font-semibold">
              <button
                onClick={() => setScheduleModalTab('calendar')}
                className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${
                  scheduleModalTab === 'calendar'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600'
                }`}
              >
                Booking Calendar
              </button>
              <button
                onClick={() => setScheduleModalTab('schedule')}
                className={`flex-1 py-2 rounded-lg text-center transition cursor-pointer ${
                  scheduleModalTab === 'schedule'
                    ? 'bg-white text-indigo-700 shadow-sm font-bold'
                    : 'text-slate-600'
                }`}
              >
                Shift Schedule
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 p-3 sm:p-5 overflow-y-auto overscroll-contain touch-pan-y bg-slate-50/50 min-h-0">
              {scheduleModalTab === 'calendar' ? (
                <CalendarView readOnly={true} />
              ) : (
                <DriverScheduleManager readOnly={true} />
              )}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-4 py-3 bg-white border-t border-slate-200 flex justify-between items-center text-xs text-slate-500">
              <span className="font-medium">
                View: <strong className="text-slate-700">{scheduleModalTab === 'calendar' ? 'Trip & Booking Calendar' : 'Driver Shift & Duty Schedule'}</strong>
              </span>
              <button
                onClick={() => setIsScheduleModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-sm transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BOTTOM BAR FOR MULTI-TRIP (BULK / LUMPSUM) */}
      {selectedBookingIds.length > 0 && !isAnyModalOpen && (
        <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-auto md:w-[768px] bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border border-slate-700 flex flex-wrap items-center justify-between gap-3 z-30 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 text-white font-extrabold h-8 w-8 rounded-full flex items-center justify-center text-xs shadow-sm border border-indigo-400">
              {selectedBookingIds.length}
            </div>
            <div>
              <p className="text-xs font-bold text-slate-200">{selectedBookingIds.length} Trips Selected</p>
              <p className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[220px]">
                Batch actions for driver
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {selectedAssignedCount > 0 && (
              <button
                onClick={handleBulkAcceptJobs}
                className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2 px-3 rounded-xl shadow-md transition active:scale-95 text-xs flex items-center gap-1 cursor-pointer"
                title="Accept and confirm selected jobs"
              >
                <span>Accept Jobs ({selectedAssignedCount})</span>
              </button>
            )}

            <button
              onClick={handleOpenOdometerForSelected}
              className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 px-3.5 rounded-xl shadow-md transition active:scale-95 text-xs uppercase tracking-wide flex items-center gap-1 cursor-pointer"
            >
              <GaugeIcon className="w-3.5 h-3.5" />
              <span>Submit Meter ({selectedBookingIds.length})</span>
            </button>

            <button
              onClick={handleBulkCompleteJobs}
              className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-2 px-3 rounded-xl shadow-md transition active:scale-95 text-xs cursor-pointer"
            >
              Direct Complete
            </button>

            <button
              onClick={() => setSelectedBookingIds([])}
              className="text-xs font-bold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Driver Floating Speed Dial Action Button */}
      <DriverSpeedDial
        onOpenFuelLog={() => setIsFuelLogOpen(true)}
        onOpenOdometer={handleOpenGeneralOdometer}
        onOpenIssueLog={() => setIsIssueLogOpen(true)}
        onOpenFeedback={() => setIsFeedbackOpen(true)}
        className={selectedBookingIds.length > 0 ? 'bottom-28 sm:bottom-28' : ''}
        isHidden={isAnyModalOpen}
      />

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
          setSelectedBookingIds([]);
          setSelectedVehicleForOdometer(undefined);
        }}
        driverId={driver.id}
        defaultBookingIds={selectedBookingIds}
        defaultVehicleId={selectedVehicleForOdometer}
      />

      <IssueLogForm
        isOpen={isIssueLogOpen}
        onClose={() => setIsIssueLogOpen(false)}
        reporterId={driver.id}
      />

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        currentRoute="driver-portal"
      />

      {/* Driver View Booking Detail Modal */}
      <BookingDetailModal
        booking={viewingBooking}
        onClose={() => setViewingBooking(null)}
        isAdmin={false}
        users={users}
        vehicles={vehicles}
        onAcceptJob={(b) => handleAcceptJob(b.id)}
        onDirectComplete={(b) => updateBookingStatus(b.id, 'Completed')}
        onLogMeter={(b) => handleSingleOdometerOpen(b.id)}
      />

      {/* BULK COMPLETE IN-SYSTEM CONFIRMATION MODAL */}
      {isBulkCompleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-150 border border-slate-100">
            <div className="w-14 h-14 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircleIcon className="h-7 w-7" />
            </div>
            <h3 className="text-lg font-black text-slate-900">Mark Trips as Completed?</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Are you sure you want to mark <strong>{selectedBookingIds.length}</strong> selected trip(s) as Completed?
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setIsBulkCompleteConfirmOpen(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50 text-xs transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkComplete}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-200 transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircleIcon className="h-4 w-4" />
                <span>Yes, Complete</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DriverDashboard;
