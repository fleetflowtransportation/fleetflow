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

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Clean, soothing, professional color palette matching the original FleetFlow app
export const EVENT_CARD_COLORS = {
  syafiq: {
    bg: 'bg-blue-50 hover:bg-blue-100/90',
    border: 'border-blue-200 border-l-4 border-l-blue-600',
    text: 'text-blue-950',
    subtext: 'text-blue-700',
    badge: 'bg-blue-200/70 text-blue-900',
    dot: 'bg-blue-600',
    monthChip: 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100',
  },
  saiful: {
    bg: 'bg-emerald-50 hover:bg-emerald-100/90',
    border: 'border-emerald-200 border-l-4 border-l-emerald-600',
    text: 'text-emerald-950',
    subtext: 'text-emerald-700',
    badge: 'bg-emerald-200/70 text-emerald-900',
    dot: 'bg-emerald-600',
    monthChip: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100',
  },
  selfdrive: {
    bg: 'bg-slate-100 hover:bg-slate-200/80',
    border: 'border-slate-300 border-l-4 border-l-slate-600',
    text: 'text-slate-900',
    subtext: 'text-slate-700',
    badge: 'bg-slate-200 text-slate-800',
    dot: 'bg-slate-600',
    monthChip: 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200',
  },
  conflict: {
    bg: 'bg-rose-50 hover:bg-rose-100/90',
    border: 'border-rose-200 border-l-4 border-l-rose-500',
    text: 'text-rose-950',
    subtext: 'text-rose-700',
    badge: 'bg-rose-200 text-rose-900',
    dot: 'bg-rose-600',
    monthChip: 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100',
  },
  pending: {
    bg: 'bg-amber-50 hover:bg-amber-100/90',
    border: 'border-amber-200 border-l-4 border-l-amber-500',
    text: 'text-amber-950',
    subtext: 'text-amber-700',
    badge: 'bg-amber-200 text-amber-900',
    dot: 'bg-amber-500',
    monthChip: 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100',
  },
  default: {
    bg: 'bg-indigo-50 hover:bg-indigo-100/90',
    border: 'border-indigo-200 border-l-4 border-l-indigo-600',
    text: 'text-indigo-950',
    subtext: 'text-indigo-700',
    badge: 'bg-indigo-200/70 text-indigo-900',
    dot: 'bg-indigo-600',
    monthChip: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100',
  }
};

export const getEventCardStyle = (booking: Partial<Booking>, driverName?: string) => {
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

// Compute collision layout for events within a day column across full 24-hour range (0 - 24)
const calculateDayCollisionLayout = (
  dayBookings: Booking[],
  rangeStartHour = 0,
  rangeEndHour = 24
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
    const heightPercent = Math.max(3.2, ((clampedEnd - clampedStart) / totalRangeMinutes) * 100);

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

// Detail Modal - Clean white aesthetic
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
  } catch {}
  
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
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-center items-center p-3 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white text-slate-800 rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                booking.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800' :
                booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800' :
                booking.status === 'Completed' ? 'bg-blue-100 text-blue-800' :
                'bg-amber-100 text-amber-800'
              }`}>
                {booking.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-700">
                {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${driverName}`}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
              {booking.calendarEventTitle || `${booking.requesterName} → ${booking.destination}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 inline" />
              {parseAsLocal(booking.dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' • '}
              {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {booking.finishDateTime && ` – ${parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
            </p>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm text-slate-700">
          
          {/* Destination & Pickup Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <LocationMarkerIcon className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</span>
                <p className="font-bold text-slate-900 text-sm sm:text-base">{booking.destination}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/80">
              <ArrowUpCircleIcon className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup Location</span>
                <p className="font-semibold text-slate-800">{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</p>
              </div>
            </div>
          </div>

          {/* Passenger & Purpose Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>Passengers ({totalPassengers})</span>
              </div>
              <p className="font-bold text-slate-900 text-xs">
                {[
                  staffCount > 0 ? `${staffCount} Staff` : '',
                  kidsCount > 0 ? `${kidsCount} Kids` : '',
                  teenagersCount > 0 ? `${teenagersCount} Teens` : '',
                ].filter(Boolean).join(', ') || `${totalPassengers} Pax`}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Driver Standby</span>
              </div>
              <p className="font-bold text-slate-900 text-xs">
                {booking.shouldWait ? '⏳ Standby On-Site' : '🚗 Drop-Off Only'}
              </p>
            </div>
          </div>

          {/* Requester Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Requester:</span>
              <span className="font-bold text-slate-900">{booking.requesterName}</span>
            </div>
            {booking.department && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="font-semibold text-slate-800">{booking.department}</span>
              </div>
            )}
            {booking.requesterEmail && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-mono text-indigo-600 text-[11px] font-medium">{booking.requesterEmail}</span>
              </div>
            )}
            {booking.purpose && (
              <div className="pt-2 mt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Purpose</span>
                <p className="text-xs text-slate-800 mt-0.5">{booking.purpose}</p>
              </div>
            )}
            {booking.remarks && (
              <div className="pt-2 mt-2 border-t border-slate-200">
                <span className="text-[10px] text-amber-600 font-bold uppercase block">Remarks</span>
                <p className="text-xs text-amber-900 mt-0.5">{booking.remarks}</p>
              </div>
            )}
          </div>

          {/* Allocated Vehicle */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TruckIcon className="h-4 w-4 text-indigo-600 shrink-0" />
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block">Allocated Vehicle</span>
                <p className="font-bold text-slate-900 text-xs">
                  {vehicleInfo ? `${vehicleInfo.name} (${vehicleInfo.plateNumber})` : (booking.vehiclePreference || 'Any available')}
                </p>
              </div>
            </div>
          </div>

          {/* Driver Management (Admin Only) */}
          {isAdmin && (
            <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider">Driver Reassignment</span>
                {!isChangingDriver && (
                  <button
                    onClick={() => setIsChangingDriver(true)}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
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
                    className="w-full bg-white text-slate-900 rounded-lg px-3 py-2 text-xs border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-medium"
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
                      className="px-2.5 py-1 text-xs rounded bg-slate-200 hover:bg-slate-300 text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmDriverChange}
                      disabled={isSavingDriver}
                      className="px-3 py-1 text-xs font-bold rounded bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      {isSavingDriver ? 'Saving...' : 'Save Driver'}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-slate-700">
                  Current: <span className="font-bold text-slate-900">{driverName}</span>
                </p>
              )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
          {isAdmin ? (
            <>
              <button
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete</span>
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleEditClick}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  <EditIcon className="h-4 w-4" />
                  <span>Edit Trip</span>
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                onClick={onClose}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer"
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
  } catch {}

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

  const [viewMode, setViewMode] = useState<CalendarViewMode>(defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Timeline container ref for auto-scrolling to daytime (~8am or current hour)
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // 24-hour array from 0 (12:00 AM) to 23 (11:00 PM)
  const allDayHours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

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

    map.forEach(list => {
      list.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    });

    return map;
  }, [filteredBookings]);

  // Auto-scroll timeline to 07:30 AM or first booking hour on view change / date change
  useEffect(() => {
    if (viewMode === 'day' || viewMode === '3days' || viewMode === 'week') {
      const timer = setTimeout(() => {
        if (timelineScrollRef.current) {
          // Find earliest booking of current date or default to 8am (hour 8)
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          const dayBookings = bookingsByDay.get(key) || [];
          let targetHour = 8;
          if (dayBookings.length > 0) {
            const firstHour = parseAsLocal(dayBookings[0].dateTime).getHours();
            targetHour = Math.max(0, Math.min(23, firstHour - 1));
          }
          // Each hour row is ~64px
          timelineScrollRef.current.scrollTop = targetHour * 64;
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [viewMode, currentDate]);

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

  // Computed Date Arrays
  const monthLabel = MONTH_NAMES[currentDate.getMonth()];
  const yearLabel = currentDate.getFullYear();

  // 1. Month Grid Cells (7x6 matrix)
  const calendarGrid = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDay = firstDayOfMonth.getDay() - 1;
    if (startDay === -1) startDay = 6;

    const days: { date: Date; dateKey: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toDateString();

    for (let i = startDay - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isCurrentMonth: false, isToday: d.toDateString() === todayStr });
    }

    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      const d = new Date(year, month, i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({ date: d, dateKey: key, isCurrentMonth: true, isToday: d.toDateString() === todayStr });
    }

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
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
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

  // Format hour label: 0 -> 12 am, 1 -> 1 am, 12 -> 12 pm, 13 -> 1 pm, 23 -> 11 pm
  const formatHourLabel = (hour: number) => {
    if (hour === 0) return '12 am';
    if (hour < 12) return `${hour} am`;
    if (hour === 12) return '12 pm';
    return `${hour - 12} pm`;
  };

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

      {/* Main Calendar Container - Clean White FleetFlow Design */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 text-slate-800 flex flex-col overflow-hidden">
        
        {/* ========================================================
            TOP TOOLBAR
            ======================================================== */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-white">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            
            {/* Left: Month Dropdown Title & Navigation */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="relative">
                <button
                  onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                  className="flex items-center gap-1.5 text-base sm:text-xl font-bold tracking-tight px-2.5 py-1.5 rounded-xl hover:bg-slate-100 text-slate-900 transition cursor-pointer"
                >
                  <span>{monthLabel} {yearLabel}</span>
                  <span className="text-xs text-slate-400">▾</span>
                </button>

                {/* Quick Month Selector Popup */}
                {isMonthPickerOpen && (
                  <div className="absolute top-full left-0 mt-2 z-40 p-3 rounded-2xl shadow-xl border bg-white border-slate-200 text-slate-900 w-64">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Select Month</span>
                      <button onClick={() => setIsMonthPickerOpen(false)} className="text-xs text-slate-400 hover:text-slate-700">✕</button>
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
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer ${
                            currentDate.getMonth() === idx
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'hover:bg-slate-100 text-slate-700'
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
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl transition active:scale-95 cursor-pointer bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-2xs"
                >
                  Today
                </button>

                <div className="flex items-center p-0.5 rounded-xl border border-slate-200 bg-slate-50">
                  <button
                    onClick={handlePrev}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition active:scale-95 cursor-pointer"
                    title="Previous"
                  >
                    <span className="text-sm font-bold block px-1">‹</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1.5 rounded-lg hover:bg-white text-slate-600 transition active:scale-95 cursor-pointer"
                    title="Next"
                  >
                    <span className="text-sm font-bold block px-1">›</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: View Mode Switcher Pills & Action */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
              
              {/* Segmented View Switcher: Day, 3 Days, Week, Month, Schedule */}
              <div className="flex p-1 rounded-xl border border-slate-200 bg-slate-100 text-xs font-semibold overflow-x-auto">
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
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-white text-indigo-700 shadow-xs font-bold'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Primary Action Button (Add / Book) */}
              {onRequestBooking ? (
                <button
                  onClick={onRequestBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Book Vehicle</span>
                </button>
              ) : isAdmin && (
                <button
                  onClick={handleCreateNewBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Add Booking</span>
                </button>
              )}
            </div>

          </div>

          {/* Search & Filter Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
            {/* Driver Filter Chips */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
              
              <button
                onClick={() => setDriverFilter('all')}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
                  driverFilter === 'all'
                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                    : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
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
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
                      isSelected
                        ? `${dStyle.bg} ${dStyle.text} border-indigo-400 font-bold shadow-2xs`
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dStyle.dot}`} />
                    <span>{d.name.split(' ')[0]}</span>
                  </button>
                );
              })}

              <button
                onClick={() => setDriverFilter('self-drive')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
                  driverFilter === 'self-drive'
                    ? 'bg-slate-700 text-white border-slate-700 shadow-2xs'
                    : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>Self-Drive</span>
              </button>

              <button
                onClick={() => setDriverFilter('conflict')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition border cursor-pointer ${
                  driverFilter === 'conflict'
                    ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                    : 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span>Conflict</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search trip, requester, destination..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs font-medium border border-slate-200 bg-slate-50 text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">✕</button>
              )}
            </div>
          </div>

        </div>

        {/* ========================================================
            VIEW 1: 1-DAY VIEW (Scrollable 12:00 AM - 11:00 PM Timeline)
            ======================================================== */}
        {viewMode === 'day' && (
          <div className="p-3 sm:p-5">
            {/* Day Header */}
            <div className="p-3 sm:p-4 rounded-xl mb-3 flex items-center justify-between bg-slate-50 border border-slate-200">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {DAY_NAMES_FULL[currentDate.getDay()]}
                </p>
                <h3 className="text-base sm:text-xl font-extrabold text-slate-900">
                  {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
              </div>

              <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white text-indigo-700 border border-indigo-200 shadow-2xs">
                {(() => {
                  const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                  return `${(bookingsByDay.get(key) || []).length} Scheduled Trips`;
                })()}
              </span>
            </div>

            {/* Scrollable 24-Hour Timeline */}
            <div 
              ref={timelineScrollRef}
              className="relative border border-slate-200 rounded-xl overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white shadow-inner"
            >
              {(() => {
                const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const dayBookings = bookingsByDay.get(key) || [];
                // Full 24-hour range: 0 (12:00 AM) to 24 (12:00 AM next day)
                const positionedEvents = calculateDayCollisionLayout(dayBookings, 0, 24);

                return (
                  <div className="relative" style={{ height: `${24 * 64}px` }}>
                    {/* 24 Hour Rows */}
                    {allDayHours.map(hour => {
                      return (
                        <div 
                          key={hour} 
                          className="flex h-[64px] border-b border-slate-100 relative group"
                        >
                          {/* Time Gutter on Left */}
                          <div className="w-16 sm:w-20 shrink-0 p-2 text-right text-[10px] sm:text-xs font-mono font-bold select-none border-r border-slate-200 bg-slate-50/80 text-slate-500">
                            {formatHourLabel(hour)}
                          </div>

                          {/* Grid Track */}
                          <div className="flex-1 relative group-hover:bg-slate-50/40 transition" />
                        </div>
                      );
                    })}

                    {/* Render Events Side-by-Side with Collision Columns */}
                    {positionedEvents.map(item => {
                      const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                      const dName = getDriverName(booking.driverId);
                      const style = getEventCardStyle(booking, dName);
                      const startDt = parseAsLocal(booking.dateTime);
                      const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                      const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${finishDt ? ' – ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`;

                      const colWidthPercent = 100 / totalCols;
                      const leftPercent = colIndex * colWidthPercent;

                      return (
                        <div
                          key={booking.id}
                          onClick={() => setSelectedBookingId(booking.id)}
                          style={{
                            top: `${topPercent}%`,
                            height: `${heightPercent}%`,
                            left: `calc(64px + (100% - 64px) * ${leftPercent / 100} + 4px)`,
                            width: `calc((100% - 64px) * ${colWidthPercent / 100} - 8px)`,
                          }}
                          className={`absolute z-20 p-2 sm:p-2.5 rounded-xl border shadow-xs transition cursor-pointer hover:shadow-md hover:scale-[1.005] flex flex-col justify-between overflow-hidden ${style.bg} ${style.border} ${style.text}`}
                        >
                          <div className="overflow-hidden">
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded font-mono bg-white/80 border border-slate-200/60 text-slate-700">
                                {timeStr}
                              </span>
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${style.badge}`}>
                                {booking.serviceType === 'Self-Drive' ? 'Self-Drive' : dName.split(' ')[0]}
                              </span>
                            </div>

                            <p className="font-extrabold text-xs sm:text-sm leading-snug line-clamp-2">
                              {booking.requesterName}
                              {booking.department ? ` (${booking.department})` : ''}{' '}
                              <span className="font-normal text-slate-600">→</span>{' '}
                              <span className="font-bold text-slate-900">{booking.destination}</span>
                            </p>
                          </div>

                          <div className="pt-1 mt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-500">
                            <span className="truncate">{booking.purpose || 'Official Transport'}</span>
                            <span className="font-semibold shrink-0 ml-1">
                              {booking.shouldWait ? '⏳ Standby' : '🚗 Drop'}
                            </span>
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
            VIEW 2: 3-DAYS VIEW (Scrollable 12:00 AM - 11:00 PM)
            ======================================================== */}
        {viewMode === '3days' && (
          <div className="p-3 sm:p-5">
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              {/* 3 Days Column Headers */}
              <div className="grid grid-cols-4 border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                <div className="py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200">
                  Time
                </div>

                {threeDays.map(({ date, isToday }) => (
                  <div
                    key={date.toISOString()}
                    onClick={() => {
                      setCurrentDate(date);
                      setViewMode('day');
                    }}
                    className={`py-2 px-1 text-center border-r border-slate-200 transition cursor-pointer hover:bg-slate-100 ${
                      isToday ? 'bg-indigo-50/70' : ''
                    }`}
                  >
                    <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                      {DAY_NAMES_SHORT[date.getDay()]}
                    </p>
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-0.5 ${
                        isToday ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-800'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* 3-Days Hourly Scrollable Matrix */}
              <div 
                ref={timelineScrollRef}
                className="overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white divide-y divide-slate-100"
              >
                {allDayHours.map(hour => {
                  return (
                    <div key={hour} className="grid grid-cols-4 min-h-[64px]">
                      {/* Time Gutter */}
                      <div className="text-[10px] font-mono font-bold text-center pt-1.5 border-r border-slate-200 bg-slate-50/80 text-slate-400 select-none">
                        {formatHourLabel(hour)}
                      </div>

                      {/* 3 Days Columns */}
                      {threeDays.map(({ date, dateKey, isToday }, idx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const hourBookings = dayBookings.filter(b => {
                          const dt = parseAsLocal(b.dateTime);
                          return dt.getHours() === hour;
                        });

                        return (
                          <div
                            key={idx}
                            className={`border-r border-slate-100 p-1 relative transition hover:bg-slate-50/60 ${
                              isToday ? 'bg-indigo-50/20' : ''
                            }`}
                          >
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
                                  className={`p-1.5 mb-1 rounded-lg border shadow-2xs text-[10px] leading-snug cursor-pointer transition hover:shadow-xs ${style.bg} ${style.border} ${style.text}`}
                                >
                                  <div className="flex justify-between items-center text-[9px] font-semibold text-slate-600 mb-0.5">
                                    <span>{timeStr}</span>
                                    <span>{b.serviceType === 'Self-Drive' ? 'Self' : dName.split(' ')[0]}</span>
                                  </div>
                                  <p className="font-bold line-clamp-2 text-slate-900">
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
            VIEW 3: 7-DAYS WEEK VIEW (Scrollable 12:00 AM - 11:00 PM)
            ======================================================== */}
        {viewMode === 'week' && (
          <div className="p-3 sm:p-5">
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white">
              <div className="min-w-[720px]">
                {/* 7 Days Header */}
                <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                  <div className="py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200">
                    Time
                  </div>

                  {weekDays.map(({ date, isToday }) => (
                    <div
                      key={date.toISOString()}
                      onClick={() => {
                        setCurrentDate(date);
                        setViewMode('day');
                      }}
                      className={`py-2 px-1 text-center border-r border-slate-200 transition cursor-pointer hover:bg-slate-100 ${
                        isToday ? 'bg-indigo-50/70' : ''
                      }`}
                    >
                      <p className={`text-[10px] font-bold uppercase ${isToday ? 'text-indigo-600' : 'text-slate-500'}`}>
                        {DAY_NAMES_SHORT[date.getDay()]}
                      </p>
                      <span
                        className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold mt-0.5 ${
                          isToday ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-800'
                        }`}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                  ))}
                </div>

                {/* 7-Days Hourly Rows */}
                <div 
                  ref={timelineScrollRef}
                  className="overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white divide-y divide-slate-100"
                >
                  {allDayHours.map(hour => {
                    return (
                      <div key={hour} className="grid grid-cols-8 min-h-[60px]">
                        {/* Time Gutter */}
                        <div className="text-[10px] font-mono font-bold text-center pt-1.5 border-r border-slate-200 bg-slate-50/80 text-slate-400 select-none">
                          {formatHourLabel(hour)}
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
                              className={`border-r border-slate-100 p-1 relative transition cursor-pointer hover:bg-slate-50 ${
                                isToday ? 'bg-indigo-50/20' : ''
                              }`}
                            >
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
                                    className={`p-1 mb-1 rounded border text-[9px] font-medium leading-tight truncate ${style.monthChip}`}
                                    title={`${b.requesterName} → ${b.destination}`}
                                  >
                                    <span className="font-bold">
                                      {b.serviceType === 'Self-Drive' ? '[Self]' : `(${dName.split(' ')[0]})`}
                                    </span>{' '}
                                    {b.destination}
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
          </div>
        )}

        {/* ========================================================
            VIEW 4: MONTH VIEW (Original Clean FleetFlow Design)
            ======================================================== */}
        {viewMode === 'month' && (
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              {/* Day-of-week Headers */}
              <div className="grid grid-cols-7 border-b border-slate-200 text-center bg-slate-50">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => (
                  <div key={name} className="py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                    {name}
                  </div>
                ))}
              </div>

              {/* 7x6 Matrix Grid */}
              <div className="grid grid-cols-7 border-b border-slate-200 gap-px bg-slate-200">
                {calendarGrid.map(({ date, dateKey, isCurrentMonth, isToday }, idx) => {
                  const dayBookings = bookingsByDay.get(dateKey) || [];

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentDate(date);
                        setViewMode('day');
                      }}
                      className={`relative p-1 sm:p-2 min-h-[90px] sm:min-h-[115px] transition cursor-pointer ${
                        isCurrentMonth 
                          ? (isToday ? 'bg-indigo-50/60 ring-1 ring-indigo-500' : 'bg-white hover:bg-slate-50') 
                          : 'bg-slate-50/70 opacity-60'
                      }`}
                    >
                      {/* Date Header */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span
                          className={`text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full ${
                            isToday
                              ? 'bg-indigo-600 text-white font-extrabold shadow-xs'
                              : isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {dayBookings.length > 0 && (
                          <span className="sm:hidden text-[9px] font-bold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>

                      {/* Clean Event Badges */}
                      <div className="space-y-1">
                        {dayBookings.slice(0, 3).map(b => {
                          const dName = getDriverName(b.driverId);
                          const style = getEventCardStyle(b, dName);
                          const timeStr = parseAsLocal(b.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

                          return (
                            <button
                              key={b.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingId(b.id);
                              }}
                              className={`w-full text-left px-1.5 py-1 rounded-md text-[10px] leading-tight truncate border transition cursor-pointer font-medium ${style.monthChip}`}
                              title={`${b.requesterName} → ${b.destination} (${dName})`}
                            >
                              <span className="font-bold">
                                {b.serviceType === 'Self-Drive' ? '[Self]' : `(${dName.split(' ')[0]})`}
                              </span>{' '}
                              <span>{b.destination || b.requesterName}</span>
                            </button>
                          );
                        })}

                        {dayBookings.length > 3 && (
                          <div className="text-[10px] font-bold text-indigo-600 pl-1">
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
                <CalendarIcon className="h-12 w-12 mx-auto text-slate-300 mb-2" />
                <p className="font-bold text-sm text-slate-700">No Scheduled Trips Found</p>
                <p className="text-xs text-slate-400 mt-1">Try selecting another month or clearing search filters.</p>
              </div>
            ) : (
              Array.from(bookingsByDay.entries()).map(([dateKey, list]) => {
                const dateObj = new Date(dateKey);
                return (
                  <div key={dateKey} className="space-y-2">
                    <div className="flex items-center gap-2 pt-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700">
                        {DAY_NAMES_FULL[dateObj.getDay()]}, {dateObj.getDate()} {MONTH_NAMES[dateObj.getMonth()]} {dateObj.getFullYear()}
                      </h4>
                      <span className="text-xs text-slate-400">({list.length} trips)</span>
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
                            className={`p-3 rounded-xl border shadow-2xs cursor-pointer transition hover:shadow-xs ${style.bg} ${style.border} ${style.text}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-mono text-xs font-bold bg-white/80 border border-slate-200 px-2 py-0.5 rounded text-slate-700">
                                {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${style.badge}`}>
                                {b.serviceType === 'Self-Drive' ? 'Self-Drive' : dName}
                              </span>
                            </div>

                            <p className="font-bold text-sm mt-2 text-slate-900">{b.destination}</p>
                            <p className="text-xs text-slate-600 mt-0.5">
                              {b.requesterName} {b.department ? `(${b.department})` : ''}
                            </p>
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

      {/* Floating Action Button (+) for Easy Booking */}
      <button
        onClick={handleCreateNewBooking}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white shadow-xl flex items-center justify-center transition cursor-pointer"
        title="Create New Vehicle Booking"
      >
        <PlusIcon className="h-6 w-6 stroke-[2.5]" />
      </button>
    </>
  );
};

export default CalendarView;
