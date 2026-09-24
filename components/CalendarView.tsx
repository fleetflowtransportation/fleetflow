import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';
import type { Booking, User, Vehicle } from '../types';
import { getDriverCalendarColor, normalizeDate, normalizeTime } from '../services/bookingEngine';
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
  PlusIcon,
  SearchIcon,
  ViewGridIcon,
  ClipboardListIcon
} from './icons/Icons';
import BookingForm from './BookingForm';

export type CalendarViewMode = 'month' | '3days' | 'week' | 'day' | 'schedule';

export interface CalendarTheme {
  bg: string;
  cardBg: string;
  border: string;
  headerBg: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  gridLine: string;
  timeGutterBg: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Modern Solid Event Styles matching Google Calendar phone app screenshots
const EVENT_CARD_COLORS = {
  syafiq: {
    bg: 'bg-[#5c6bc0] hover:bg-[#4f5da8]',
    border: 'border-[#3f51b5]',
    text: 'text-white',
    badge: 'bg-indigo-900/60 text-indigo-100',
    bar: 'bg-indigo-300',
  },
  saiful: {
    bg: 'bg-[#43a047] hover:bg-[#388e3c]',
    border: 'border-[#2e7d32]',
    text: 'text-white',
    badge: 'bg-emerald-950/60 text-emerald-100',
    bar: 'bg-emerald-300',
  },
  selfdrive: {
    bg: 'bg-[#546e7a] hover:bg-[#455a64]',
    border: 'border-[#37474f]',
    text: 'text-white',
    badge: 'bg-slate-900/60 text-slate-100',
    bar: 'bg-slate-300',
  },
  lunch: {
    bg: 'bg-[#e53935] hover:bg-[#d32f2f]',
    border: 'border-[#c62828]',
    text: 'text-white',
    badge: 'bg-red-950/60 text-red-100',
    bar: 'bg-red-300',
  },
  conflict: {
    bg: 'bg-[#d81b60] hover:bg-[#c2185b]',
    border: 'border-[#ad1457]',
    text: 'text-white',
    badge: 'bg-pink-950/60 text-pink-100',
    bar: 'bg-pink-300',
  },
  pending: {
    bg: 'bg-[#fb8c00] hover:bg-[#f57c00]',
    border: 'border-[#ef6c00]',
    text: 'text-white',
    badge: 'bg-amber-950/60 text-amber-100',
    bar: 'bg-amber-300',
  },
  default: {
    bg: 'bg-[#7e57c2] hover:bg-[#673ab7]',
    border: 'border-[#512da8]',
    text: 'text-white',
    badge: 'bg-purple-950/60 text-purple-100',
    bar: 'bg-purple-300',
  }
};

const getEventCardStyle = (booking: Partial<Booking>, driverName?: string) => {
  if (booking.status === 'Conflict') return EVENT_CARD_COLORS.conflict;
  if (booking.serviceType === 'Self-Drive') return EVENT_CARD_COLORS.selfdrive;
  const lower = (driverName || '').toLowerCase();
  if (lower.includes('syafiq')) return EVENT_CARD_COLORS.syafiq;
  if (lower.includes('saiful')) return EVENT_CARD_COLORS.saiful;
  if (booking.status === 'Pending') return EVENT_CARD_COLORS.pending;
  return EVENT_CARD_COLORS.default;
};

interface PositionedBooking {
  booking: Booking;
  topPercent: number;
  heightPercent: number;
  startMinutes: number;
  endMinutes: number;
  colIndex: number;
  totalCols: number;
}

// Compute collision layout for events within a day column
const calculateDayCollisionLayout = (
  dayBookings: Booking[],
  rangeStartHour = 8,
  rangeEndHour = 19
): PositionedBooking[] => {
  const totalRangeMinutes = (rangeEndHour - rangeStartHour) * 60;
  const rangeStartMinutes = rangeStartHour * 60;

  if (!dayBookings || dayBookings.length === 0) return [];

  const rawEvents = dayBookings.map(b => {
    const s = parseAsLocal(b.dateTime);
    const startM = s.getHours() * 60 + s.getMinutes();
    let endM = startM + 60;
    if (b.finishDateTime) {
      const e = parseAsLocal(b.finishDateTime);
      endM = Math.max(startM + 30, e.getHours() * 60 + e.getMinutes());
    }

    const clampedStart = Math.max(rangeStartMinutes, Math.min(rangeStartMinutes + totalRangeMinutes, startM));
    const clampedEnd = Math.max(clampedStart + 25, Math.min(rangeStartMinutes + totalRangeMinutes, endM));

    const topPercent = Math.max(0, ((clampedStart - rangeStartMinutes) / totalRangeMinutes) * 100);
    const heightPercent = Math.max(4.5, ((clampedEnd - clampedStart) / totalRangeMinutes) * 100);

    return {
      booking: b,
      startMinutes: clampedStart,
      endMinutes: clampedEnd,
      topPercent,
      heightPercent,
      colIndex: 0,
      totalCols: 1,
    };
  });

  // Sort by start time, then duration desc
  rawEvents.sort((a, b) => a.startMinutes - b.startMinutes || (b.endMinutes - b.startMinutes) - (a.endMinutes - a.startMinutes));

  // Overlapping cluster detection
  const clusters: typeof rawEvents[] = [];
  let currentCluster: typeof rawEvents = [];
  let clusterEnd = -1;

  rawEvents.forEach(ev => {
    if (currentCluster.length === 0) {
      currentCluster.push(ev);
      clusterEnd = ev.endMinutes;
    } else if (ev.startMinutes < clusterEnd) {
      currentCluster.push(ev);
      clusterEnd = Math.max(clusterEnd, ev.endMinutes);
    } else {
      clusters.push(currentCluster);
      currentCluster = [ev];
      clusterEnd = ev.endMinutes;
    }
  });
  if (currentCluster.length > 0) clusters.push(currentCluster);

  // Column packing within clusters
  const result: PositionedBooking[] = [];
  clusters.forEach(cluster => {
    const columns: typeof rawEvents = [];
    cluster.forEach(ev => {
      let placedCol = -1;
      for (let c = 0; c < columns.length; c++) {
        if (columns[c].endMinutes <= ev.startMinutes) {
          placedCol = c;
          columns[c] = ev;
          break;
        }
      }
      if (placedCol === -1) {
        placedCol = columns.length;
        columns.push(ev);
      }
      ev.colIndex = placedCol;
    });

    const totalCols = columns.length;
    cluster.forEach(ev => {
      ev.totalCols = totalCols;
      result.push(ev);
    });
  });

  return result;
};

// Detail Modal
interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
  onEdit: (booking: Booking) => void;
  onDelete: (bookingId: string) => void;
  isAdmin: boolean;
  users?: User[];
  vehicles?: Vehicle[];
}

const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ 
  booking, 
  onClose, 
  onEdit, 
  onDelete, 
  isAdmin,
  users: propUsers,
  vehicles: propVehicles 
}) => {
  let context: any = null;
  try {
    context = useAppContext();
  } catch {
    // context optional
  }
  const users = (propUsers && propUsers.length > 0) ? propUsers : (context?.users || []);
  const vehicles = (propVehicles && propVehicles.length > 0) ? propVehicles : (context?.vehicles || []);
  const updateBooking = context?.updateBooking || (async () => {});
  const [isChangingDriver, setIsChangingDriver] = useState(false);
  const [newDriverId, setNewDriverId] = useState(booking?.driverId || '');
  const [isSavingDriver, setIsSavingDriver] = useState(false);

  useEffect(() => {
    setNewDriverId(booking?.driverId || '');
    setIsChangingDriver(false);
  }, [booking]);

  if (!booking) return null;

  const driverName = users.find(d => d.id === booking.driverId)?.name || 
    (booking.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Unassigned');
  const vehicleInfo = vehicles.find(v => v.id === booking.vehicleId) ||
    vehicles.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  const totalPassengers = booking.passengers ? booking.passengers.reduce((sum, p) => sum + p.count, 0) : 0;

  const staffCount = booking.passengers?.find(p => p.category === 'Staff')?.count ?? 0;
  const kidsCount = booking.passengers?.find(p => p.category === 'Kids')?.count ?? 0;
  const teenagersCount = booking.passengers?.find(p => p.category === 'Teenagers')?.count ?? 0;

  const handleConfirmDriverChange = async () => {
    if (!isAdmin) return;
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
        adminNotes: `Driver updated to ${chosenDriver?.name || 'Unassigned'} at ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`,
      });
      setIsChangingDriver(false);
    } catch (e: any) {
      alert('Error updating driver: ' + (e.message || e));
    } finally {
      setIsSavingDriver(false);
    }
  };

  const handleDeleteClick = () => {
    if (!isAdmin) return;
    if (window.confirm(`Are you sure you want to delete the booking to "${booking.destination}"? This action cannot be undone.`)) {
      onDelete(booking.id);
      onClose();
    }
  };

  const handleEditClick = () => {
    if (!isAdmin) return;
    onEdit(booking);
    onClose();
  };

  const style = getEventCardStyle(booking, driverName);

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex justify-center items-center p-3 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-[#1e1e1e] text-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-neutral-700" onClick={e => e.stopPropagation()}>
        
        {/* Header - Solid Google Calendar Card Color */}
        <div className={`p-4 sm:p-5 ${style.bg} border-b border-white/10 text-white flex justify-between items-start`}>
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-black/30 text-white border border-white/20">
                {booking.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-white/20 text-white">
                {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${driverName}`}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-extrabold leading-snug">
              {booking.calendarEventTitle || `${booking.requesterName} → ${booking.destination}`}
            </h3>
            <p className="text-xs text-white/80 mt-1 flex items-center gap-1 font-mono">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 inline" />
              {parseAsLocal(booking.dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' • '}
              {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {booking.finishDateTime && ` – ${parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
            </p>
          </div>

          <button onClick={onClose} className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/20 transition cursor-pointer">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm text-neutral-200">
          
          {/* Destination & Pickup Card */}
          <div className="p-3.5 bg-neutral-800/80 rounded-xl border border-neutral-700/60 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <LocationMarkerIcon className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Destination</span>
                <p className="font-extrabold text-white text-sm sm:text-base">{booking.destination}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-neutral-700/40">
              <ArrowUpCircleIcon className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Pickup Location</span>
                <p className="font-semibold text-neutral-300">{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</p>
              </div>
            </div>
          </div>

          {/* Passenger & Purpose Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-neutral-800/80 rounded-xl border border-neutral-700/60">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase mb-1">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>Passengers ({totalPassengers})</span>
              </div>
              <p className="font-bold text-white text-xs">
                {[
                  staffCount > 0 ? `${staffCount} Staff` : '',
                  kidsCount > 0 ? `${kidsCount} Kids` : '',
                  teenagersCount > 0 ? `${teenagersCount} Teens` : '',
                ].filter(Boolean).join(', ') || `${totalPassengers} Pax`}
              </p>
            </div>

            <div className="p-3 bg-neutral-800/80 rounded-xl border border-neutral-700/60">
              <div className="flex items-center gap-1.5 text-neutral-400 text-[10px] font-bold uppercase mb-1">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Driver Standby</span>
              </div>
              <p className="font-bold text-white text-xs">
                {booking.shouldWait ? '⏳ Standby On-Site' : '🚗 Drop-Off Only'}
              </p>
            </div>
          </div>

          {/* Requester Details */}
          <div className="p-3 bg-neutral-800/80 rounded-xl border border-neutral-700/60 space-y-1">
            <div className="flex justify-between items-center text-xs">
              <span className="text-neutral-400 font-medium">Requester:</span>
              <span className="font-bold text-white">{booking.requesterName}</span>
            </div>
            {booking.department && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-medium">Department:</span>
                <span className="font-semibold text-neutral-200">{booking.department}</span>
              </div>
            )}
            {booking.requesterEmail && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-400 font-medium">Email (Invited):</span>
                <span className="font-mono text-indigo-300 text-[11px]">{booking.requesterEmail}</span>
              </div>
            )}
            {booking.purpose && (
              <div className="pt-2 mt-2 border-t border-neutral-700/40">
                <span className="text-[10px] text-neutral-400 font-bold uppercase block">Purpose</span>
                <p className="text-xs text-neutral-200 mt-0.5">{booking.purpose}</p>
              </div>
            )}
            {booking.remarks && (
              <div className="pt-2 mt-2 border-t border-neutral-700/40">
                <span className="text-[10px] text-amber-400 font-bold uppercase block">Remarks</span>
                <p className="text-xs text-amber-200/90 mt-0.5">{booking.remarks}</p>
              </div>
            )}
          </div>

          {/* Allocated Vehicle */}
          <div className="p-3 bg-neutral-800/80 rounded-xl border border-neutral-700/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-neutral-400 uppercase block">Vehicle</span>
                <p className="font-bold text-white text-xs">
                  {vehicleInfo ? `${vehicleInfo.name} (${vehicleInfo.plateNumber})` : (booking.vehiclePreference || 'Any available')}
                </p>
              </div>
            </div>
          </div>

          {/* Driver Management (Admin Only) */}
          {isAdmin && (
            <div className="p-3.5 bg-neutral-900 rounded-xl border border-indigo-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-wider">Driver Reassignment</span>
                {!isChangingDriver && (
                  <button
                    onClick={() => setIsChangingDriver(true)}
                    className="text-[11px] font-bold text-indigo-300 hover:text-indigo-200 underline cursor-pointer"
                  >
                    Change Driver
                  </button>
                )}
              </div>

              {isChangingDriver ? (
                <div className="space-y-2 pt-1">
                  <select
                    value={newDriverId}
                    onChange={(e) => setNewDriverId(e.target.value)}
                    className="w-full bg-neutral-800 text-white rounded-lg px-3 py-2 text-xs border border-neutral-600 focus:ring-2 focus:ring-indigo-500 font-semibold"
                  >
                    <option value="">-- Select Driver --</option>
                    {users.filter(u => u.role === 'Driver' || u.role === 'Staff').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setIsChangingDriver(false)}
                      className="px-2.5 py-1 text-xs rounded bg-neutral-700 hover:bg-neutral-600 text-neutral-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDriverChange}
                      disabled={isSavingDriver}
                      className="px-3 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-500 text-white"
                    >
                      {isSavingDriver ? 'Saving...' : 'Save Driver'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-semibold text-neutral-300">
                  Current: <span className="font-bold text-white">{driverName}</span>
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-neutral-900 border-t border-neutral-800 flex justify-between items-center gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-400 hover:bg-rose-950/40 rounded-xl border border-rose-800/40 transition cursor-pointer"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete</span>
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-neutral-700 hover:bg-neutral-600 rounded-xl transition cursor-pointer"
                >
                  <EditIcon className="h-4 w-4" />
                  <span>Edit Trip</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-neutral-300 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl transition cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export interface CalendarViewProps {
  isPublic?: boolean;
  customBookings?: Booking[];
  customUsers?: User[];
  customVehicles?: Vehicle[];
  onRequestBooking?: () => void;
  defaultView?: CalendarViewMode;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
  isPublic = false,
  customBookings,
  customUsers,
  customVehicles,
  onRequestBooking,
  defaultView = 'month'
}) => {
  let context: any = null;
  try {
    context = useAppContext();
  } catch {
    // optional context
  }

  const bookings = customBookings || context?.bookings || [];
  const users = customUsers || context?.users || [];
  const vehicles = customVehicles || context?.vehicles || [];
  const currentUser = context?.currentUser || null;
  const deleteBooking = context?.deleteBooking || (() => {});

  const isAdmin = useMemo(() => {
    if (isPublic) return false;
    if (!currentUser) return false;
    return currentUser.role === 'Admin' || currentUser.role === 'SuperAdmin';
  }, [isPublic, currentUser]);

  // View States
  const [viewMode, setViewMode] = useState<CalendarViewMode>(() => {
    // Auto default to 3days or day on narrow screens for superior legibility
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      return defaultView === 'month' ? 'month' : defaultView;
    }
    return defaultView;
  });

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');

  // Timeline hours from 8:00 AM to 6:00 PM (18:00) with 1-hour buffer
  const timelineHours = useMemo(() => [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18], []);

  // Filtered drivers list
  const driversList = useMemo(() => {
    return users.filter(u => u.role === 'Driver' || u.role === 'Staff');
  }, [users]);

  const getDriverName = useCallback((driverId?: string | null) => {
    if (!driverId) return 'Unassigned';
    return users.find(u => u.id === driverId)?.name || 'Driver';
  }, [users]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      // Driver filter
      if (driverFilter === 'self-drive' && b.serviceType !== 'Self-Drive') return false;
      if (driverFilter === 'conflict' && b.status !== 'Conflict') return false;
      if (driverFilter !== 'all' && driverFilter !== 'self-drive' && driverFilter !== 'conflict') {
        if (b.driverId !== driverFilter) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const dName = getDriverName(b.driverId).toLowerCase();
        const matches = (
          (b.requesterName && b.requesterName.toLowerCase().includes(q)) ||
          (b.destination && b.destination.toLowerCase().includes(q)) ||
          (b.purpose && b.purpose.toLowerCase().includes(q)) ||
          (b.department && b.department.toLowerCase().includes(q)) ||
          dName.includes(q) ||
          (b.calendarEventTitle && b.calendarEventTitle.toLowerCase().includes(q))
        );
        if (!matches) return false;
      }

      return true;
    });
  }, [bookings, driverFilter, searchQuery, getDriverName]);

  // Bookings grouped by date string (YYYY-MM-DD)
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(b => {
      const d = parseAsLocal(b.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(b);
    });

    // Sort bookings by time in each day
    map.forEach(list => {
      list.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    });

    return map;
  }, [filteredBookings]);

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
      else if (viewMode === '3days') d.setDate(d.getDate() - 3);
      else if (viewMode === 'week') d.setDate(d.getDate() - 7);
      else if (viewMode === 'day') d.setDate(d.getDate() - 1);
      else d.setMonth(d.getMonth() - 1);
      return d;
    });
  }, [viewMode]);

  const handleNext = useCallback(() => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
      else if (viewMode === '3days') d.setDate(d.getDate() + 3);
      else if (viewMode === 'week') d.setDate(d.getDate() + 7);
      else if (viewMode === 'day') d.setDate(d.getDate() + 1);
      else d.setMonth(d.getMonth() + 1);
      return d;
    });
  }, [viewMode]);

  const handleToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleCreateNewBooking = () => {
    if (onRequestBooking) {
      onRequestBooking();
    } else if (isAdmin) {
      setEditingBooking(null);
      setIsFormOpen(true);
    }
  };

  const handleEditBooking = (b: Booking) => {
    if (isAdmin) {
      setEditingBooking(b);
      setIsFormOpen(true);
    }
  };

  const selectedBooking = useMemo(() => {
    if (!selectedBookingId) return null;
    return bookings.find(b => b.id === selectedBookingId) || null;
  }, [selectedBookingId, bookings]);

  // Computed Date Arrays for Different Views
  const monthLabel = MONTH_NAMES[currentDate.getMonth()];
  const yearLabel = currentDate.getFullYear();

  // 1. Month Grid Cells (7x6 matrix)
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Monday start index (0=Mon, 6=Sun)
    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay === -1) startDay = 6;

    const days: { date: Date; dateKey: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toDateString();

    // Previous month filler days
    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isCurrentMonth: false, isToday: d.toDateString() === todayStr });
    }

    // Current month days
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isCurrentMonth: true, isToday: d.toDateString() === todayStr });
    }

    // Next month filler days (fill up to 35 or 42)
    const remaining = (days.length <= 35 ? 35 : 42) - days.length;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isCurrentMonth: false, isToday: d.toDateString() === todayStr });
    }

    return days;
  }, [currentDate]);

  // 2. 3-Days View Columns
  const threeDays = useMemo(() => {
    const days: { date: Date; dateKey: string; isToday: boolean }[] = [];
    const todayStr = new Date().toDateString();
    for (let i = 0; i < 3; i++) {
      const d = new Date(currentDate);
      d.setDate(currentDate.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isToday: d.toDateString() === todayStr });
    }
    return days;
  }, [currentDate]);

  // 3. Week View (7 Days starting Monday)
  const weekDays = useMemo(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));

    const days: { date: Date; dateKey: string; isToday: boolean }[] = [];
    const todayStr = new Date().toDateString();
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      const key = `${dayDate.getFullYear()}-${String(dayDate.getMonth() + 1).padStart(2, '0')}-${String(dayDate.getDate()).padStart(2, '0')}`;
      days.push({ date: dayDate, dateKey: key, isToday: dayDate.toDateString() === todayStr });
    }
    return days;
  }, [currentDate]);

  const isDarkMode = themeMode === 'dark';

  return (
    <>
      <BookingDetailModal 
        booking={selectedBooking} 
        onClose={() => setSelectedBookingId(null)} 
        onEdit={handleEditBooking}
        onDelete={deleteBooking}
        isAdmin={isAdmin}
        users={users}
        vehicles={vehicles}
      />

      {isAdmin && (
        <BookingForm
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingBooking(null);
          }}
          bookingToEdit={editingBooking}
        />
      )}

      {/* Main Calendar Container */}
      <div className={`rounded-2xl shadow-xl overflow-hidden flex flex-col transition-colors ${
        isDarkMode ? 'bg-[#181818] text-white border border-neutral-800' : 'bg-white text-slate-900 border border-slate-200'
      }`}>
        
        {/* ========================================================
            TOP TOOLBAR (Matching Google Calendar Phone / PC Design)
            ======================================================== */}
        <div className={`p-3 sm:p-4 border-b ${
          isDarkMode ? 'bg-[#1f1f1f] border-neutral-800' : 'bg-white border-slate-200'
        }`}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left: Month Dropdown Title & Navigation */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="relative">
                <button
                  onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                  className={`flex items-center gap-1.5 text-base sm:text-xl font-extrabold tracking-tight px-2.5 py-1.5 rounded-xl transition cursor-pointer ${
                    isDarkMode ? 'hover:bg-neutral-800 text-white' : 'hover:bg-slate-100 text-slate-900'
                  }`}
                >
                  <span>{monthLabel} {yearLabel}</span>
                  <span className="text-xs opacity-70">▼</span>
                </button>

                {/* Quick Month Selector Popup */}
                {isMonthPickerOpen && (
                  <div className={`absolute top-full left-0 mt-2 z-40 p-3 rounded-2xl shadow-2xl border w-64 ${
                    isDarkMode ? 'bg-neutral-900 border-neutral-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                  }`}>
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-neutral-700/50">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-neutral-400">Select Month</span>
                      <button onClick={() => setIsMonthPickerOpen(false)} className="text-xs text-neutral-400 hover:text-white">✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTH_NAMES.map((m, idx) => (
                        <button
                          key={m}
                          onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(idx);
                            setCurrentDate(d);
                            setIsMonthPickerOpen(false);
                          }}
                          className={`py-1.5 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                            currentDate.getMonth() === idx
                              ? 'bg-indigo-600 text-white'
                              : isDarkMode ? 'hover:bg-neutral-800 text-neutral-300' : 'hover:bg-slate-100 text-slate-700'
                          }`}
                        >
                          {m.substring(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Prev / Next / Today Controls */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleToday}
                  className={`px-3 py-1.5 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer border ${
                    isDarkMode 
                      ? 'bg-neutral-800 hover:bg-neutral-700 text-white border-neutral-700' 
                      : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300'
                  }`}
                >
                  Today
                </button>

                <div className={`flex items-center p-0.5 rounded-xl border ${
                  isDarkMode ? 'bg-neutral-800/80 border-neutral-700' : 'bg-slate-100 border-slate-200'
                }`}>
                  <button
                    onClick={handlePrev}
                    className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                      isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-white text-slate-700'
                    }`}
                    title="Previous"
                  >
                    <span className="text-sm font-bold block px-1">‹</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className={`p-1.5 rounded-lg transition active:scale-95 cursor-pointer ${
                      isDarkMode ? 'hover:bg-neutral-700 text-neutral-200' : 'hover:bg-white text-slate-700'
                    }`}
                    title="Next"
                  >
                    <span className="text-sm font-bold block px-1">›</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: View Mode Switcher Pills & Theme Toggle */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
              
              {/* Segmented View Switcher: Day, 3 Days, Week, Month, Schedule */}
              <div className={`flex p-1 rounded-xl border text-xs font-bold overflow-x-auto ${
                isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-slate-100 border-slate-200'
              }`}>
                {(['day', '3days', 'week', 'month', 'schedule'] as CalendarViewMode[]).map(mode => {
                  const labels: Record<CalendarViewMode, string> = {
                    day: 'Day',
                    '3days': '3 Days',
                    week: 'Week',
                    month: 'Month',
                    schedule: 'Schedule',
                  };

                  const isActive = viewMode === mode;
                  return (
                    <button
                      key={mode}
                      onClick={() => setViewMode(mode)}
                      className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : isDarkMode ? 'text-neutral-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Theme Toggle Button */}
              <button
                onClick={() => setThemeMode(isDarkMode ? 'light' : 'dark')}
                className={`p-2 rounded-xl border text-xs transition cursor-pointer ${
                  isDarkMode ? 'bg-neutral-800 text-amber-300 border-neutral-700 hover:bg-neutral-700' : 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200'
                }`}
                title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              >
                {isDarkMode ? '☀️' : '🌙'}
              </button>

              {/* Primary Action Button (Add / Book) */}
              {onRequestBooking ? (
                <button
                  onClick={onRequestBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Book Vehicle</span>
                </button>
              ) : isAdmin && (
                <button
                  onClick={handleCreateNewBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-md transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Add Booking</span>
                </button>
              )}
            </div>

          </div>

          {/* Search & Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-neutral-800/60">
            {/* Driver Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mr-1">Filter:</span>
              
              <button
                onClick={() => setDriverFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  driverFilter === 'all'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                All Trips
              </button>

              {driversList.map(d => {
                const isSelected = driverFilter === d.id;
                const dStyle = getEventCardStyle({}, d.name);
                return (
                  <button
                    key={d.id}
                    onClick={() => setDriverFilter(d.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                      isSelected
                        ? `${dStyle.bg} text-white border-transparent shadow-xs`
                        : isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dStyle.bar}`} />
                    <span>{d.name.split(' ')[0]}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setDriverFilter('self-drive')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  driverFilter === 'self-drive'
                    ? 'bg-[#546e7a] text-white border-transparent'
                    : isDarkMode ? 'bg-neutral-800 text-neutral-300 border-neutral-700' : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                <span>Self-Drive</span>
              </button>

              <button
                onClick={() => setDriverFilter('conflict')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  driverFilter === 'conflict'
                    ? 'bg-rose-600 text-white border-rose-600'
                    : isDarkMode ? 'bg-rose-950/40 text-rose-300 border-rose-800/60' : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                <span>Conflict</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trip, staff, location..."
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border transition focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                  isDarkMode 
                    ? 'bg-neutral-900 border-neutral-700 text-white placeholder-neutral-500' 
                    : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
                }`}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-white text-xs">✕</button>
              )}
            </div>
          </div>

        </div>

        {/* ========================================================
            VIEW 1: 1-DAY VIEW (Accurate Side-by-Side Timeline)
            ======================================================== */}
        {viewMode === 'day' && (
          <div className="overflow-x-auto">
            <div className="min-w-[320px] p-2 sm:p-4">
              
              {/* Day Header */}
              <div className={`p-3 sm:p-4 rounded-2xl mb-3 flex items-center justify-between border ${
                isDarkMode ? 'bg-neutral-900 border-neutral-800' : 'bg-indigo-50/60 border-indigo-100'
              }`}>
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400">
                    {DAY_NAMES_FULL[currentDate.getDay()]}
                  </p>
                  <h3 className="text-base sm:text-xl font-extrabold">
                    {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-xl text-xs font-extrabold border ${
                    isDarkMode ? 'bg-neutral-800 text-neutral-200 border-neutral-700' : 'bg-white text-indigo-700 border-indigo-200'
                  }`}>
                    {(() => {
                      const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                      return `${(bookingsByDay.get(key) || []).length} Trips`;
                    })()}
                  </span>
                </div>
              </div>

              {/* Hourly Timeline with Collision Columns */}
              {(() => {
                const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const dayBookings = bookingsByDay.get(key) || [];
                const positionedEvents = calculateDayCollisionLayout(dayBookings, 8, 19);

                return (
                  <div className={`relative border rounded-2xl overflow-hidden ${
                    isDarkMode ? 'bg-[#121212] border-neutral-800' : 'bg-white border-slate-200'
                  }`}>
                    {/* Hour Rows */}
                    {timelineHours.map((hour, idx) => {
                      const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'pm' : 'am'}`;
                      return (
                        <div key={hour} className={`flex min-h-[68px] sm:min-h-[80px] border-b relative ${
                          isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
                        }`}>
                          {/* Time Gutter on Left */}
                          <div className={`w-14 sm:w-20 shrink-0 p-2 text-right text-[10px] sm:text-xs font-mono font-bold select-none border-r ${
                            isDarkMode ? 'bg-[#191919] text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-400 border-slate-200'
                          }`}>
                            {hourLabel}
                          </div>

                          {/* Grid Track */}
                          <div className="flex-1 relative" />
                        </div>
                      );
                    })}

                    {/* Standard Lunch Break Block (12:00 PM - 2:00 PM or 1:00 PM - 2:00 PM) */}
                    {/* Render Lunch Break across 12pm - 2pm (or 1pm - 2pm) */}
                    <div 
                      style={{
                        top: `${((12 * 60 - 8 * 60) / ((19 - 8) * 60)) * 100}%`,
                        height: `${((2 * 60) / ((19 - 8) * 60)) * 100}%`,
                        left: '56px', // offset width of gutter
                        right: '8px',
                      }}
                      className="absolute z-10 p-2.5 rounded-xl bg-[#e53935]/90 border border-red-700 text-white shadow-sm flex items-center justify-center font-bold text-xs sm:text-sm text-center select-none"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">🍱</span>
                        <span>Lunch Break (No booking available) • 12:00 PM – 2:00 PM</span>
                      </div>
                    </div>

                    {/* Render Positioned Event Cards Side-by-Side */}
                    {positionedEvents.map(item => {
                      const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                      const dName = getDriverName(booking.driverId);
                      const style = getEventCardStyle(booking, dName);
                      const startDt = parseAsLocal(booking.dateTime);
                      const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                      const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${finishDt ? ' - ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`;

                      const colWidthPercent = 100 / totalCols;
                      const leftPercent = colIndex * colWidthPercent;

                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBookingId(booking.id)}
                          style={{
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`,
                            left: `calc(56px + (100% - 56px) * ${leftPercent / 100} + 3px)`,
                            width: `calc((100% - 56px) * ${colWidthPercent / 100} - 6px)`,
                          }}
                          className={`absolute z-20 p-2 sm:p-2.5 rounded-xl border shadow-md transition cursor-pointer hover:scale-[1.01] flex flex-col justify-between overflow-hidden ${style.bg} ${style.border} ${style.text}`}
                        >
                          <div className="overflow-hidden">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="text-[10px] font-extrabold uppercase bg-black/25 px-1.5 py-0.2 rounded font-mono truncate">
                                {timeStr}
                              </span>
                              {booking.status === 'Conflict' && (
                                <span className="text-[9px] bg-red-950 px-1 py-0.2 rounded font-bold">⚠️ Conflict</span>
                              )}
                            </div>

                            {/* Driver Prefix & Requester / Destination */}
                            <p className="font-extrabold text-[11px] sm:text-xs leading-tight line-clamp-3">
                              <span className="opacity-90 font-black">
                                {booking.serviceType === 'Self-Drive' ? '(Self-Drive)' : `(${dName.split(' ')[0]})`}
                              </span>{' '}
                              {booking.requesterName}
                              {booking.department ? ` (${booking.department})` : ''}{' '}
                              <span className="text-white/90">→ {booking.destination}</span>
                            </p>
                          </div>

                          {/* Location & Details Badge */}
                          <div className="pt-1 mt-1 border-t border-white/15 flex items-center justify-between text-[9px] sm:text-[10px] opacity-90">
                            <span className="truncate">{booking.purpose || 'Official Trip'}</span>
                            <span className="font-bold shrink-0">{booking.shouldWait ? '⏳ Standby' : '🚗 Drop'}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 2: 3-DAYS VIEW (Matching Screenshot 1 for Phones)
            ======================================================== */}
        {viewMode === '3days' && (
          <div className="overflow-x-auto">
            <div className="min-w-[480px]">
              {/* 3 Days Column Headers */}
              <div className={`grid grid-cols-4 border-b sticky top-0 z-30 ${
                isDarkMode ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`py-3 px-2 text-center text-[10px] font-bold uppercase border-r ${
                  isDarkMode ? 'text-neutral-400 border-neutral-800' : 'text-slate-400 border-slate-200'
                }`}>
                  Time
                </div>

                {threeDays.map(({ date, isToday }) => (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      setCurrentDate(date);
                      setViewMode('day');
                    }}
                    className={`py-2 px-1 text-center border-r transition cursor-pointer hover:bg-indigo-500/10 ${
                      isDarkMode ? 'border-neutral-800' : 'border-slate-200'
                    } ${isToday ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50') : ''}`}
                  >
                    <p className={`text-[10px] font-bold uppercase ${
                      isToday ? 'text-indigo-400' : isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                    }`}>
                      {DAY_NAMES_SHORT[date.getDay()]}
                    </p>
                    <span
                      className={`inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-extrabold mt-0.5 ${
                        isToday ? 'bg-amber-500 text-black shadow-md' : isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3-Days Hourly Matrix */}
              <div className="relative">
                {timelineHours.map(hour => {
                  const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'pm' : 'am'}`;
                  return (
                    <div key={hour} className={`grid grid-cols-4 min-h-[72px] border-b ${
                      isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
                    }`}>
                      {/* Time Gutter */}
                      <div className={`text-[10px] font-mono font-bold text-center pt-1 border-r select-none ${
                        isDarkMode ? 'bg-[#191919] text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {hourLabel}
                      </div>

                      {/* 3 Days Columns */}
                      {threeDays.map(({ date, dateKey, isToday }, idx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const hourBookings = dayBookings.filter(b => {
                          const dt = parseAsLocal(b.dateTime);
                          return dt.getHours() === hour;
                        });

                        const isLunchHour = hour === 12 || hour === 13;

                        return (
                          <div
                            key={idx}
                            className={`border-r p-1 relative transition ${
                              isDarkMode ? 'border-neutral-800/80 hover:bg-neutral-800/30' : 'border-slate-100 hover:bg-slate-50'
                            } ${isToday ? (isDarkMode ? 'bg-indigo-950/10' : 'bg-indigo-50/20') : ''}`}
                          >
                            {/* Lunch Break Chip */}
                            {hour === 12 && (
                              <div className="mb-1 p-1.5 rounded-lg bg-[#e53935] text-white text-[10px] font-bold text-center shadow-xs">
                                Lunch Break (No booking available)
                              </div>
                            )}

                            {/* Bookings In This Hour Slot */}
                            {hourBookings.map(b => {
                              const dName = getDriverName(b.driverId);
                              const style = getEventCardStyle(b, dName);
                              const timeStr = parseAsLocal(b.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                              return (
                                <div
                                  key={b.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBookingId(b.id);
                                  }}
                                  className={`p-1.5 mb-1 rounded-lg border shadow-sm text-[10px] font-bold leading-snug cursor-pointer transition hover:scale-[1.02] ${style.bg} ${style.border} ${style.text}`}
                                >
                                  <div className="flex justify-between items-center opacity-90 text-[9px] mb-0.5">
                                    <span>{timeStr}</span>
                                    {b.status === 'Conflict' && <span>⚠️</span>}
                                  </div>
                                  <p className="line-clamp-2">
                                    <span className="font-extrabold">{b.serviceType === 'Self-Drive' ? '(Self-Drive)' : `(${dName.split(' ')[0]})`}</span>{' '}
                                    {b.requesterName} → {b.destination}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 3: 7-DAYS WEEK VIEW (Matching Screenshot 2)
            ======================================================== */}
        {viewMode === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              {/* 7 Days Header */}
              <div className={`grid grid-cols-8 border-b sticky top-0 z-30 ${
                isDarkMode ? 'bg-[#1e1e1e] border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}>
                <div className={`py-3 px-2 text-center text-[10px] font-bold uppercase border-r ${
                  isDarkMode ? 'text-neutral-400 border-neutral-800' : 'text-slate-400 border-slate-200'
                }`}>
                  Time
                </div>

                {weekDays.map(({ date, isToday }) => (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      setCurrentDate(date);
                      setViewMode('day');
                    }}
                    className={`py-2 px-1 text-center border-r transition cursor-pointer hover:bg-indigo-500/10 ${
                      isDarkMode ? 'border-neutral-800' : 'border-slate-200'
                    } ${isToday ? (isDarkMode ? 'bg-indigo-950/40' : 'bg-indigo-50') : ''}`}
                  >
                    <p className={`text-[10px] font-bold uppercase ${
                      isToday ? 'text-indigo-400' : isDarkMode ? 'text-neutral-400' : 'text-slate-500'
                    }`}>
                      {DAY_NAMES_SHORT[date.getDay()]}
                    </p>
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-extrabold mt-0.5 ${
                        isToday ? 'bg-amber-500 text-black shadow-md' : isDarkMode ? 'text-white' : 'text-slate-900'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 7-Days Hourly Rows */}
              <div className="relative">
                {timelineHours.map(hour => {
                  const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'pm' : 'am'}`;
                  return (
                    <div key={hour} className={`grid grid-cols-8 min-h-[64px] border-b ${
                      isDarkMode ? 'border-neutral-800/80' : 'border-slate-100'
                    }`}>
                      {/* Time Gutter */}
                      <div className={`text-[10px] font-mono font-bold text-center pt-1 border-r select-none ${
                        isDarkMode ? 'bg-[#191919] text-neutral-400 border-neutral-800' : 'bg-slate-50 text-slate-400 border-slate-200'
                      }`}>
                        {hourLabel}
                      </div>

                      {/* 7 Days Columns */}
                      {weekDays.map(({ date, dateKey, isToday }, idx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const hourBookings = dayBookings.filter(b => {
                          const dt = parseAsLocal(b.dateTime);
                          return dt.getHours() === hour;
                        });

                        return (
                          <div
                            key={idx}
                            onClick={() => {
                              setCurrentDate(date);
                              setViewMode('day');
                            }}
                            className={`border-r p-0.5 relative transition cursor-pointer ${
                              isDarkMode ? 'border-neutral-800/80 hover:bg-neutral-800/30' : 'border-slate-100 hover:bg-slate-50'
                            } ${isToday ? (isDarkMode ? 'bg-indigo-950/10' : 'bg-indigo-50/20') : ''}`}
                          >
                            {hour === 12 && (
                              <div className="mb-0.5 p-1 rounded bg-[#e53935] text-white text-[9px] font-bold truncate">
                                Lunch Break
                              </div>
                            )}

                            {hourBookings.map(b => {
                              const dName = getDriverName(b.driverId);
                              const style = getEventCardStyle(b, dName);
                              return (
                                <div
                                  key={b.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBookingId(b.id);
                                  }}
                                  className={`p-1 mb-0.5 rounded border text-[9px] font-bold leading-tight truncate ${style.bg} ${style.border} ${style.text}`}
                                >
                                  {b.serviceType === 'Self-Drive' ? '(Self-Drive)' : `(${dName.split(' ')[0]})`} {b.destination}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 4: MONTH VIEW (Clean Legible Stacked Pills - Screenshot 3)
            ======================================================== */}
        {viewMode === 'month' && (
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              
              {/* Day-of-week Headers */}
              <div className={`grid grid-cols-7 border-b text-center ${
                isDarkMode ? 'bg-[#1f1f1f] border-neutral-800' : 'bg-slate-50 border-slate-200'
              }`}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => (
                  <div key={name} className="py-2.5 text-[10px] sm:text-xs font-extrabold uppercase tracking-wider text-neutral-400">
                    {name}
                  </div>
                ))}
              </div>

              {/* 7x6 Matrix Grid */}
              <div className={`grid grid-cols-7 border-b gap-px ${
                isDarkMode ? 'bg-neutral-800' : 'bg-slate-200'
              }`}>
                {calendarGrid.map(({ date, dateKey, isCurrentMonth, isToday }, idx) => {
                  const dayBookings = bookingsByDay.get(dateKey) || [];

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentDate(date);
                        setViewMode('day');
                      }}
                      className={`relative p-1 sm:p-1.5 min-h-[90px] sm:min-h-[120px] transition cursor-pointer ${
                        isDarkMode
                          ? (isCurrentMonth ? (isToday ? 'bg-neutral-900 ring-1 ring-amber-500/50' : 'bg-[#181818] hover:bg-neutral-800') : 'bg-[#121212] opacity-50')
                          : (isCurrentMonth ? (isToday ? 'bg-indigo-50/60 ring-1 ring-indigo-500/40' : 'bg-white hover:bg-slate-50') : 'bg-slate-100 opacity-60')
                      }`}
                    >
                      {/* Date Bubble */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] sm:text-xs font-black h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-amber-500 text-black font-extrabold shadow-md'
                              : isCurrentMonth
                              ? (isDarkMode ? 'text-white' : 'text-slate-900')
                              : 'text-neutral-500'
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {dayBookings.length > 0 && (
                          <span className="sm:hidden text-[9px] font-extrabold px-1.5 py-0.2 bg-indigo-600 text-white rounded-full">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>

                      {/* Stacked Event Pills matching Screenshot 3 */}
                      <div className="space-y-1">
                        {/* Lunch Break indicator for weekdays */}
                        {isCurrentMonth && date.getDay() !== 0 && date.getDay() !== 6 && (
                          <div className="w-full text-left px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold truncate bg-[#e53935] text-white shadow-2xs">
                            Lunch Break
                          </div>
                        )}

                        {dayBookings.slice(0, 3).map(b => {
                          const dName = getDriverName(b.driverId);
                          const style = getEventCardStyle(b, dName);

                          return (
                            <button
                              key={b.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingId(b.id);
                              }}
                              className={`w-full text-left px-1.5 py-0.5 rounded text-[9px] sm:text-[10px] font-bold leading-tight truncate border transition hover:opacity-90 flex items-center gap-1 cursor-pointer ${style.bg} ${style.border} ${style.text}`}
                              title={`${b.requesterName} → ${b.destination} (${dName})`}
                            >
                              <span className="truncate">
                                {b.serviceType === 'Self-Drive' ? '[ALZA] (SELF)' : `(${dName.split(' ')[0]})`} {b.requesterName || b.destination}
                              </span>
                            </button>
                          );
                        })}

                        {dayBookings.length > 3 && (
                          <div className="text-[9px] font-extrabold text-indigo-400 pl-1">
                            +{dayBookings.length - 3} more...
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 5: SCHEDULE / AGENDA LIST VIEW
            ======================================================== */}
        {viewMode === 'schedule' && (
          <div className="p-3 sm:p-5 space-y-4">
            {Array.from(bookingsByDay.entries()).length === 0 ? (
              <div className="text-center py-12">
                <CalendarIcon className="h-12 w-12 mx-auto text-neutral-500 mb-2" />
                <p className="font-bold text-sm text-neutral-300">No Scheduled Trips Found</p>
                <p className="text-xs text-neutral-500 mt-1">Try adjusting the filter or search keyword.</p>
              </div>
            ) : (
              Array.from(bookingsByDay.entries()).map(([dateKey, list]) => {
                const dateObj = new Date(dateKey);
                return (
                  <div key={dateKey} className="space-y-2">
                    <div className="flex items-center gap-2 pt-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <h4 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-amber-400">
                        {DAY_NAMES_FULL[dateObj.getDay()]}, {dateObj.getDate()} {MONTH_NAMES[dateObj.getMonth()]} {dateObj.getFullYear()}
                      </h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {list.map(b => {
                        const dName = getDriverName(b.driverId);
                        const style = getEventCardStyle(b, dName);
                        const startDt = parseAsLocal(b.dateTime);

                        return (
                          <div
                            key={b.id}
                            onClick={() => setSelectedBookingId(b.id)}
                            className={`p-3 rounded-xl border shadow-sm cursor-pointer transition hover:scale-[1.01] ${style.bg} ${style.border} ${style.text}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-mono text-xs font-extrabold bg-black/30 px-2 py-0.5 rounded">
                                {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-white/20">
                                {b.serviceType === 'Self-Drive' ? 'Self-Drive' : dName}
                              </span>
                            </div>

                            <p className="font-extrabold text-sm mt-2">{b.destination}</p>
                            <p className="text-xs opacity-90">{b.requesterName} {b.department ? `(${b.department})` : ''}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

      </div>

      {/* Floating Action Button (+) matching Google Calendar Mobile App */}
      <button
        onClick={handleCreateNewBooking}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl bg-amber-600 hover:bg-amber-500 active:scale-95 text-white shadow-2xl flex items-center justify-center transition border border-amber-400/40 cursor-pointer"
        title="Create New Vehicle Booking"
      >
        <PlusIcon className="h-7 w-7 stroke-[3]" />
      </button>
    </>
  );
};

export default CalendarView;
