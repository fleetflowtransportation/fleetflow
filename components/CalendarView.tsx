import React, { useState, useMemo, useCallback, useEffect } from 'react';
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
  PlusIcon,
  SearchIcon,
  ViewGridIcon,
  ClipboardListIcon
} from './icons/Icons';
import BookingForm from './BookingForm';

export type CalendarViewMode = 'month' | 'week' | 'day' | 'schedule';

const DRIVER_PILL_STYLES: Record<string, { bg: string; text: string; border: string; bar: string }> = {
  syafiq: { bg: 'bg-blue-50 hover:bg-blue-100', text: 'text-blue-900', border: 'border-blue-200', bar: 'bg-blue-600' },
  saiful: { bg: 'bg-emerald-50 hover:bg-emerald-100', text: 'text-emerald-900', border: 'border-emerald-200', bar: 'bg-emerald-600' },
  selfdrive: { bg: 'bg-slate-100 hover:bg-slate-200', text: 'text-slate-800', border: 'border-slate-300', bar: 'bg-slate-600' },
  conflict: { bg: 'bg-rose-50 hover:bg-rose-100', text: 'text-rose-900', border: 'border-rose-300', bar: 'bg-rose-600' },
  pending: { bg: 'bg-amber-50 hover:bg-amber-100', text: 'text-amber-900', border: 'border-amber-200', bar: 'bg-amber-500' },
  default: { bg: 'bg-indigo-50 hover:bg-indigo-100', text: 'text-indigo-900', border: 'border-indigo-200', bar: 'bg-indigo-600' },
};

const getEventStyleInfo = (booking: Booking, driverName: string) => {
  if (booking.status === 'Conflict') return DRIVER_PILL_STYLES.conflict;
  if (booking.serviceType === 'Self-Drive') return DRIVER_PILL_STYLES.selfdrive;
  const lower = driverName.toLowerCase();
  if (lower.includes('syafiq')) return DRIVER_PILL_STYLES.syafiq;
  if (lower.includes('saiful')) return DRIVER_PILL_STYLES.saiful;
  if (booking.status === 'Pending') return DRIVER_PILL_STYLES.pending;
  return DRIVER_PILL_STYLES.default;
};

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

  return (
    <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-xs z-50 flex justify-center items-center p-3 sm:p-4 animate-in fade-in duration-150" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden border border-slate-200" onClick={e => e.stopPropagation()}>
        
        {/* Header - Google Calendar Style */}
        <div className="flex justify-between items-start p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex-1 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
                booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                booking.status === 'Pending' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}>
                {booking.status}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : '👤 Assigned Driver'}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 leading-snug">{booking.destination}</h2>
            {booking.requesterName && (
              <p className="text-xs text-slate-600 mt-0.5">
                By: <strong className="text-slate-800">{booking.requesterName}</strong> {booking.department ? `(${booking.department})` : ''}
              </p>
            )}
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-200 rounded-full transition cursor-pointer"
            title="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 text-sm text-slate-700 overflow-y-auto max-h-[70vh]">
          {booking.calendarEventTitle && (
            <div className="p-2.5 bg-slate-100 rounded-xl font-mono text-xs font-semibold text-slate-800 border border-slate-200">
              📅 {booking.calendarEventTitle}
            </div>
          )}

          {booking.status === 'Conflict' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900">
              <p className="font-extrabold flex items-center gap-1">⚠️ STATUS: SCHEDULE CONFLICT</p>
              <p className="mt-1">{booking.conflictReason || 'Schedule conflict with existing booking or driver break time.'}</p>
              <p className="mt-1 text-rose-700 font-semibold">Please contact Admin for review and reassignment.</p>
            </div>
          )}

          {booking.warningNotes && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-medium">
              ⚠️ {booking.warningNotes}
            </div>
          )}

          {/* Waiting Status */}
          <div className={`flex items-center space-x-3 p-3 rounded-xl border ${
            booking.shouldWait
              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
          }`}>
            <span className="text-xl sm:text-2xl">{booking.shouldWait ? '⏳' : '🚗'}</span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider opacity-80">Driver Standby Status</p>
              <p className="text-xs font-extrabold">
                {booking.shouldWait
                  ? 'Driver Must Wait (Standby on-site until event completion)'
                  : 'Driver Drop-off Only (No waiting required)'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <CalendarIcon className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Date</p>
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  {parseAsLocal(booking.dateTime).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <ClockIcon className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Trip Time</p>
                <span className="font-bold text-slate-800 text-xs sm:text-sm">
                  {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                  {booking.finishDateTime && ` – ${parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <ArrowUpCircleIcon className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Pickup Location</p>
                <span className="font-medium text-slate-800 text-xs">
                  {getPickupLocationDisplay(booking.pickupPoint, booking.address)}
                </span>
              </div>
            </div>

            <div className="flex items-start space-x-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <LocationMarkerIcon className="h-5 w-5 text-indigo-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase">Drop-off Destination</p>
                <span className="font-bold text-slate-900 text-xs">{booking.destination}</span>
              </div>
            </div>

            {/* Purpose */}
            {booking.purpose && (
              <div className="sm:col-span-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <p className="text-[10px] text-slate-400 font-bold uppercase">Purpose / Agenda</p>
                <p className="text-xs font-semibold text-slate-800 mt-0.5">{booking.purpose}</p>
              </div>
            )}

            {/* Passenger Count */}
            <div className="sm:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <UserGroupIcon className="h-4 w-4 text-indigo-600" />
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Total Passengers</p>
                </div>
                <span className="font-extrabold text-slate-900 text-xs px-2.5 py-0.5 bg-white rounded-full border border-slate-200">{totalPassengers} Pax</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700">
                  Staff: <strong className="ml-1 text-indigo-600">{staffCount}</strong>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700">
                  Kids: <strong className="ml-1 text-indigo-600">{kidsCount}</strong>
                </span>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-700">
                  Teenagers: <strong className="ml-1 text-indigo-600">{teenagersCount}</strong>
                </span>
              </div>
            </div>

            {/* Driver & Vehicle */}
            <div className="sm:col-span-2 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <TruckIcon className="h-5 w-5 text-indigo-600" />
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Assigned Driver</p>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">{driverName}</span>
                  </div>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setIsChangingDriver(!isChangingDriver)}
                    className="text-xs px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold rounded-lg shadow-xs transition cursor-pointer"
                  >
                    {isChangingDriver ? 'Cancel' : 'Change Driver'}
                  </button>
                )}
              </div>

              {isAdmin && isChangingDriver && (
                <div className="p-3 bg-white rounded-xl border border-indigo-200 space-y-2 shadow-xs animate-in fade-in">
                  <label className="block text-xs font-bold text-indigo-900">
                    Select New Driver:
                  </label>
                  <select
                    value={newDriverId}
                    onChange={(e) => setNewDriverId(e.target.value)}
                    className="w-full text-xs p-2 border border-indigo-200 rounded-lg bg-indigo-50/30 text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                  >
                    <option value="">-- None / Unassigned --</option>
                    {users.filter(u => u.role === 'driver' || u.role === 'admin').map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role === 'admin' ? 'Admin' : 'Driver'})
                      </option>
                    ))}
                  </select>
                  <div className="flex justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsChangingDriver(false)}
                      className="text-xs px-3 py-1 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isSavingDriver}
                      onClick={handleConfirmDriverChange}
                      className="text-xs px-3.5 py-1 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 shadow-xs cursor-pointer"
                    >
                      {isSavingDriver ? 'Saving...' : 'Confirm Change'}
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-indigo-100 flex items-center text-xs text-slate-700">
                <span className="font-bold text-slate-500 mr-1.5">Vehicle:</span>
                <span className="font-semibold text-slate-900">
                  {vehicleInfo
                    ? `${vehicleInfo.name} (${vehicleInfo.plateNumber})`
                    : (booking.serviceType === 'Self-Drive'
                        ? 'Perodua Alza (Self-Drive)'
                        : (booking.vehiclePreference && booking.vehiclePreference !== 'Bebas'
                            ? booking.vehiclePreference
                            : 'Any / Unassigned'))}
                </span>
              </div>
            </div>

            {booking.adminNotes && (
              <div className="sm:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700">
                <span className="font-bold block text-slate-400 uppercase text-[9px] tracking-wider mb-0.5">Admin Notes</span>
                {booking.adminNotes}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>

          {isAdmin ? (
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDeleteClick}
                className="flex items-center text-xs text-rose-600 hover:bg-rose-50 font-bold py-2 px-3 border border-rose-200 rounded-xl transition shadow-xs bg-white cursor-pointer"
              >
                <TrashIcon className="h-4 w-4 mr-1" />
                Delete
              </button>
              <button
                onClick={handleEditClick}
                className="flex items-center text-xs text-white bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-3.5 rounded-xl transition shadow-xs cursor-pointer"
              >
                <EditIcon className="h-4 w-4 mr-1" />
                Edit
              </button>
            </div>
          ) : (
            <span className="text-[11px] font-semibold text-slate-400 italic">
              Driver View Mode (Read Only)
            </span>
          )}
        </div>

      </div>
    </div>
  );
};

export interface CalendarViewProps {
  readOnly?: boolean;
  isPublic?: boolean;
  customBookings?: Booking[];
  customUsers?: User[];
  customVehicles?: Vehicle[];
  onRequestBooking?: () => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ 
  readOnly = false,
  isPublic = false,
  customBookings,
  customUsers,
  customVehicles,
  onRequestBooking
}) => {
  let context: any = null;
  try {
    context = useAppContext();
  } catch {
    // context optional
  }

  const bookings = customBookings ?? context?.bookings ?? [];
  const users = customUsers ?? context?.users ?? [];
  const vehicles = customVehicles ?? context?.vehicles ?? [];
  const currentUser = context?.currentUser ?? null;
  const deleteBooking = context?.deleteBooking ?? (async () => {});

  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // States for BookingForm
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);

  const isAdmin = useMemo(() => {
    if (readOnly || isPublic) return false;
    return currentUser?.role === 'admin';
  }, [currentUser, readOnly, isPublic]);

  const selectedBooking = useMemo(() => {
    return bookings.find(b => b.id === selectedBookingId) || null;
  }, [bookings, selectedBookingId]);

  const driversList = useMemo(() => {
    return users.filter(u => u.role === 'driver' || u.id === 'driver-aziz');
  }, [users]);

  // Filter bookings
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      if (b.status === 'Cancelled') return false;

      // Filter driver
      if (driverFilter !== 'all') {
        if (driverFilter === 'self-drive') {
          if (b.serviceType !== 'Self-Drive') return false;
        } else if (driverFilter === 'conflict') {
          if (b.status !== 'Conflict') return false;
        } else {
          if (b.driverId !== driverFilter) return false;
        }
      }

      // Filter search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const dest = (b.destination || '').toLowerCase();
        const req = (b.requesterName || '').toLowerCase();
        const purp = (b.purpose || '').toLowerCase();
        const pick = (b.pickupPoint || '').toLowerCase();
        return dest.includes(q) || req.includes(q) || purp.includes(q) || pick.includes(q);
      }

      return true;
    });
  }, [bookings, driverFilter, searchQuery]);

  // Group by Date string key (YYYY-MM-DD)
  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    filteredBookings.forEach(booking => {
      const d = parseAsLocal(booking.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(booking);
    });

    map.forEach(dayBookings => {
      dayBookings.sort((a, b) => parseAsLocal(a.dateTime).getTime() - parseAsLocal(b.dateTime).getTime());
    });
    return map;
  }, [filteredBookings]);

  // Navigation handlers
  const handlePrev = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() - 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() - 7);
      } else if (viewMode === 'day') {
        d.setDate(d.getDate() - 1);
      } else {
        d.setMonth(d.getMonth() - 1);
      }
      return d;
    });
  };

  const handleNext = () => {
    setCurrentDate(prev => {
      const d = new Date(prev);
      if (viewMode === 'month') {
        d.setMonth(d.getMonth() + 1);
      } else if (viewMode === 'week') {
        d.setDate(d.getDate() + 7);
      } else if (viewMode === 'day') {
        d.setDate(d.getDate() + 1);
      } else {
        d.setMonth(d.getMonth() + 1);
      }
      return d;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const getDriverName = useCallback((driverId: string | null) => {
    if (!driverId) return "Pending";
    return users.find(d => d.id === driverId)?.name || "Unknown";
  }, [users]);

  const handleEditBooking = (booking: Booking) => {
    if (!isAdmin) return;
    setEditingBooking(booking);
    setIsFormOpen(true);
  };

  const handleCreateNewBooking = () => {
    if (!isAdmin) return;
    setEditingBooking(null);
    setIsFormOpen(true);
  };

  // Build Month Grid
  const { calendarGrid, monthLabel, yearLabel } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthLabel = MONTH_NAMES[month];
    const yearLabel = year;

    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDayOfWeek);

    const grid: { date: Date; dateKey: string; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = new Date().toISOString().split('T')[0];

    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      grid.push({
        date: d,
        dateKey: key,
        isCurrentMonth: d.getMonth() === month,
        isToday: d.toDateString() === new Date().toDateString(),
      });
    }

    return { calendarGrid: grid, monthLabel, yearLabel };
  }, [currentDate]);

  // Build Week Grid (7 days of current week, starting Sunday)
  const weekDays = useMemo(() => {
    const current = new Date(currentDate);
    const dayOfWeek = current.getDay();
    const sunday = new Date(current);
    sunday.setDate(current.getDate() - dayOfWeek);

    const days: { date: Date; dateKey: string; isToday: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(sunday);
      d.setDate(sunday.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      days.push({
        date: d,
        dateKey: key,
        isToday: d.toDateString() === new Date().toDateString(),
      });
    }
    return days;
  }, [currentDate]);

  // Hours array for Day and Week timeline (06:00 to 22:00)
  const timelineHours = useMemo(() => {
    const hrs: number[] = [];
    for (let h = 6; h <= 22; h++) {
      hrs.push(h);
    }
    return hrs;
  }, []);

  // Title display based on view mode
  const titleDisplay = useMemo(() => {
    if (viewMode === 'month') {
      return `${monthLabel} ${yearLabel}`;
    }
    if (viewMode === 'week') {
      const start = weekDays[0].date;
      const end = weekDays[6].date;
      if (start.getMonth() === end.getMonth()) {
        return `${start.getDate()} – ${end.getDate()} ${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
      }
      return `${start.getDate()} ${MONTH_NAMES[start.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()}`;
    }
    if (viewMode === 'day') {
      return `${DAY_NAMES_FULL[currentDate.getDay()]}, ${currentDate.getDate()} ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    return `Booking Schedule (${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()})`;
  }, [viewMode, currentDate, monthLabel, yearLabel, weekDays]);

  // Current time position indicator (0-100% of the 6am-10pm timeline)
  const currentTimePercentage = useMemo(() => {
    const now = new Date();
    const hours = now.getHours();
    const mins = now.getMinutes();
    if (hours < 6 || hours > 22) return null;
    const totalMinutes = (hours - 6) * 60 + mins;
    const totalDayMinutes = (23 - 6) * 60;
    return (totalMinutes / totalDayMinutes) * 100;
  }, []);

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

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
        
        {/* GOOGLE CALENDAR STYLE TOOLBAR */}
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-white">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            {/* Left: Today, Prev/Next, Date Title */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleToday}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl shadow-2xs transition active:scale-95 cursor-pointer"
                >
                  Today
                </button>
                <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    onClick={handlePrev}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition active:scale-95 cursor-pointer"
                    title="Previous"
                  >
                    <span className="text-sm font-bold block px-1">‹</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition active:scale-95 cursor-pointer"
                    title="Next"
                  >
                    <span className="text-sm font-bold block px-1">›</span>
                  </button>
                </div>
              </div>

              <h2 className="text-sm sm:text-lg font-extrabold text-slate-900 tracking-tight">
                {titleDisplay}
              </h2>
            </div>

            {/* Right: View Switcher (Month, Week, Day, Schedule) & Admin Add */}
            <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2">
              
              {/* Segmented View Switcher */}
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold shadow-2xs">
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'month'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Month
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'week'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'day'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode('schedule')}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    viewMode === 'schedule'
                      ? 'bg-white text-indigo-600 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Schedule
                </button>
              </div>

              {/* Action Buttons */}
              {isAdmin && (
                <button
                  onClick={handleCreateNewBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Add Booking</span>
                  <span className="sm:hidden">Add</span>
                </button>
              )}

              {onRequestBooking && (
                <button
                  onClick={onRequestBooking}
                  className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Book Vehicle</span>
                </button>
              )}
            </div>

          </div>

          {/* Quick Filters Strip (Google Calendar Chips) */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mt-3 pt-3 border-t border-slate-100">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Filter:</span>
            
            <button
              onClick={() => setDriverFilter('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                driverFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              All
            </button>

            {driversList.map(driver => (
              <button
                key={driver.id}
                onClick={() => setDriverFilter(driver.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                  driverFilter === driver.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${
                  driver.name.toLowerCase().includes('syafiq') ? 'bg-blue-500' :
                  driver.name.toLowerCase().includes('saiful') ? 'bg-emerald-500' : 'bg-indigo-500'
                }`} />
                {driver.name.split(' ')[0]}
              </button>
            ))}

            <button
              onClick={() => setDriverFilter('self-drive')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                driverFilter === 'self-drive'
                  ? 'bg-slate-800 text-white border-slate-800 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-500" />
              Self-Drive
            </button>

            <button
              onClick={() => setDriverFilter('conflict')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition border cursor-pointer ${
                driverFilter === 'conflict'
                  ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                  : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Conflict
            </button>
          </div>
        </div>

        {/* ========================================================
            VIEW 1: MONTH VIEW (BULAN)
            ======================================================== */}
        {viewMode === 'month' && (
          <div className="overflow-x-auto">
            <div className="min-w-[320px]">
              {/* Weekday Header */}
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center">
                {DAY_NAMES_FULL.map((name, i) => (
                  <div key={name} className="py-2.5 text-[10px] sm:text-xs font-bold text-slate-500 uppercase tracking-wider">
                    <span className="hidden sm:inline">{name}</span>
                    <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
                  </div>
                ))}
              </div>

              {/* 7x6 Grid Calendar */}
              <div className="grid grid-cols-7 border-b border-l border-slate-200 bg-slate-200 gap-px">
                {calendarGrid.map(({ date, dateKey, isCurrentMonth, isToday }, idx) => {
                  const dayBookings = bookingsByDay.get(dateKey) || [];

                  return (
                    <div
                      key={idx}
                      onClick={() => {
                        // On mobile or when user taps empty day, quick switch to Day view
                        if (window.innerWidth < 640) {
                          setCurrentDate(date);
                          setViewMode('day');
                        }
                      }}
                      className={`relative p-1 sm:p-1.5 min-h-[90px] sm:min-h-[125px] transition ${
                        isCurrentMonth ? (isToday ? 'bg-indigo-50/25' : 'bg-white') : 'bg-slate-50/70'
                      }`}
                    >
                      {/* Date Bubble */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-[10px] sm:text-xs font-extrabold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full transition ${
                            isToday
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : isCurrentMonth
                              ? 'text-slate-800'
                              : 'text-slate-400'
                          }`}
                        >
                          {date.getDate()}
                        </span>

                        {dayBookings.length > 0 && (
                          <span className="sm:hidden text-[9px] font-extrabold px-1.5 py-0.2 bg-indigo-100 text-indigo-800 rounded-full">
                            {dayBookings.length}
                          </span>
                        )}
                      </div>

                      {/* Events List */}
                      <div className="space-y-1">
                        {dayBookings.slice(0, 3).map(booking => {
                          const dName = getDriverName(booking.driverId);
                          const style = getEventStyleInfo(booking, dName);
                          const timeStr = parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', {
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true,
                          });

                          return (
                            <button
                              key={booking.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedBookingId(booking.id);
                              }}
                              className={`w-full text-left p-1 sm:p-1.5 rounded-md text-[10px] sm:text-[11px] leading-tight border transition truncate shadow-2xs hover:shadow-xs flex items-center gap-1 cursor-pointer ${style.bg} ${style.text} ${style.border}`}
                              title={`${timeStr} - ${booking.destination} (${dName})`}
                            >
                              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.bar}`} />
                              <span className="font-bold shrink-0">{timeStr}</span>
                              <span className="truncate font-medium">{booking.destination}</span>
                            </button>
                          );
                        })}

                        {dayBookings.length > 3 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setCurrentDate(date);
                              setViewMode('day');
                            }}
                            className="w-full text-left text-[10px] font-bold text-indigo-600 hover:text-indigo-800 px-1 py-0.5 rounded transition cursor-pointer"
                          >
                            +{dayBookings.length - 3} more...
                          </button>
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
            VIEW 2: WEEK VIEW (MINGGU) - GOOGLE CALENDAR TIMELINE
            ======================================================== */}
        {viewMode === 'week' && (
          <div className="overflow-x-auto">
            <div className="min-w-[680px]">
              {/* Week Day Header */}
              <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                <div className="py-3 px-2 text-center text-[10px] font-bold text-slate-400 uppercase border-r border-slate-200">
                  Time
                </div>
                {weekDays.map(({ date, isToday }, i) => (
                  <div
                    key={i}
                    className={`py-2 px-1 text-center border-r border-slate-200 ${isToday ? 'bg-indigo-50/40' : ''}`}
                  >
                    <p className="text-[10px] font-bold text-slate-500 uppercase">{DAY_NAMES_SHORT[date.getDay()]}</p>
                    <span
                      className={`inline-flex items-center justify-center h-6 w-6 rounded-full text-xs font-extrabold mt-0.5 ${
                        isToday ? 'bg-indigo-600 text-white shadow-2xs' : 'text-slate-800'
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>
                ))}
              </div>

              {/* Hourly Grid Rows */}
              <div className="relative">
                {timelineHours.map(hour => {
                  const hourLabel = `${hour % 12 === 0 ? 12 : hour % 12} ${hour >= 12 ? 'PM' : 'AM'}`;

                  return (
                    <div key={hour} className="grid grid-cols-8 border-b border-slate-100 min-h-[56px]">
                      {/* Hour Axis */}
                      <div className="text-[10px] font-bold text-slate-400 text-center pt-1 border-r border-slate-200 bg-slate-50/40 select-none">
                        {hourLabel}
                      </div>

                      {/* 7 Days Columns */}
                      {weekDays.map(({ date, dateKey, isToday }, dayIdx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const hourBookings = dayBookings.filter(b => {
                          const dt = parseAsLocal(b.dateTime);
                          return dt.getHours() === hour;
                        });

                        return (
                          <div
                            key={dayIdx}
                            onClick={() => {
                              setCurrentDate(date);
                              setViewMode('day');
                            }}
                            className={`relative border-r border-slate-100 p-0.5 transition hover:bg-slate-50/60 cursor-pointer ${
                              isToday ? 'bg-indigo-50/10' : ''
                            }`}
                          >
                            {hourBookings.map(booking => {
                              const dName = getDriverName(booking.driverId);
                              const style = getEventStyleInfo(booking, dName);
                              const timeStr = parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', {
                                hour: 'numeric',
                                minute: '2-digit',
                                hour12: true,
                              });

                              return (
                                <button
                                  key={booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedBookingId(booking.id);
                                  }}
                                  className={`w-full text-left p-1.5 rounded-md text-[10px] font-semibold border shadow-2xs mb-1 cursor-pointer transition hover:scale-101 ${style.bg} ${style.text} ${style.border}`}
                                >
                                  <div className="font-extrabold flex items-center justify-between">
                                    <span>{timeStr}</span>
                                    {booking.status === 'Conflict' && <span>⚠️</span>}
                                  </div>
                                  <p className="font-bold truncate mt-0.5">{booking.destination}</p>
                                  <p className="opacity-80 truncate text-[9px]">{dName.split(' ')[0]}</p>
                                </button>
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
            VIEW 3: DAY VIEW (HARI) - DETAILED HOURLY TIMELINE
            ======================================================== */}
        {viewMode === 'day' && (
          <div className="p-3 sm:p-5">
            {/* Day Header Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-4 rounded-2xl shadow-sm mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">Selected Day Schedule</p>
                <h3 className="text-base sm:text-xl font-extrabold text-white mt-0.5">
                  {DAY_NAMES_FULL[currentDate.getDay()]}, {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold px-3 py-1 bg-white/10 rounded-xl border border-white/20">
                  {(() => {
                    const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                    const count = (bookingsByDay.get(key) || []).length;
                    return `${count} Scheduled Trips`;
                  })()}
                </span>
              </div>
            </div>

            {/* Hourly Grid for Day */}
            <div className="space-y-2">
              {(() => {
                const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                const dayBookings = bookingsByDay.get(key) || [];

                if (dayBookings.length === 0) {
                  return (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                      <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700 text-sm">No Bookings On This Date</p>
                      <p className="text-xs text-slate-400 mt-1">Use navigation controls or switch to Month view to select another date.</p>
                    </div>
                  );
                }

                return dayBookings.map(booking => {
                  const dName = getDriverName(booking.driverId);
                  const style = getEventStyleInfo(booking, dName);
                  const startDt = parseAsLocal(booking.dateTime);
                  const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                  const totalPassengers = booking.passengers ? booking.passengers.reduce((sum, p) => sum + p.count, 0) : 0;

                  return (
                    <div
                      key={booking.id}
                      onClick={() => setSelectedBookingId(booking.id)}
                      className={`p-3.5 sm:p-4 rounded-2xl border shadow-2xs hover:shadow-md transition cursor-pointer bg-white ${style.border}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`w-3 h-3 rounded-full ${style.bar}`} />
                          <span className="font-mono text-xs sm:text-sm font-extrabold text-slate-900">
                            {startDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                            {finishDt && ` – ${finishDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                          </span>
                          <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                            booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {booking.status}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                            {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${dName}`}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Destination</p>
                          <p className="text-sm font-extrabold text-slate-900">{booking.destination}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Pickup</p>
                          <p className="text-xs font-semibold text-slate-700">{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-700">Requester: {booking.requesterName} {booking.department ? `(${booking.department})` : ''}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-slate-800">👥 {totalPassengers} Pax</span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${booking.shouldWait ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {booking.shouldWait ? '⏳ Standby Required' : '🚗 Drop-off Only'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 4: SCHEDULE / AGENDA VIEW (JADUAL TERPERINCI)
            ======================================================== */}
        {viewMode === 'schedule' && (
          <div className="p-3 sm:p-5 space-y-4 max-h-[65vh] overflow-y-auto">
            {/* Search Bar in Schedule View */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search destination, requester name, or purpose..."
                className="w-full pl-9 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white text-slate-900 placeholder:text-slate-400"
              />
              <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 sm:top-3" />
            </div>

            {Array.from(bookingsByDay.entries()).length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200">
                <CalendarIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <p className="font-bold text-slate-700 text-sm">No Bookings Found</p>
                <p className="text-xs text-slate-400 mt-1">Try clearing your search or switching driver filter.</p>
              </div>
            ) : (
              Array.from(bookingsByDay.entries()).map(([dateKey, dayBookings]) => {
                const sampleDate = parseAsLocal(dayBookings[0].dateTime);
                const isToday = sampleDate.toDateString() === new Date().toDateString();

                return (
                  <div key={dateKey} className="space-y-2">
                    {/* Date Section Header */}
                    <div className="flex items-center gap-2 pt-2">
                      <div className={`px-3 py-1 rounded-xl text-xs font-extrabold uppercase tracking-wider ${
                        isToday ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {isToday ? 'TODAY • ' : ''}
                        {DAY_NAMES_FULL[sampleDate.getDay()]}, {sampleDate.getDate()} {MONTH_NAMES[sampleDate.getMonth()]}
                      </div>
                      <div className="h-px bg-slate-200 flex-1" />
                    </div>

                    {/* Bookings under this date */}
                    <div className="space-y-2">
                      {dayBookings.map(booking => {
                        const dName = getDriverName(booking.driverId);
                        const style = getEventStyleInfo(booking, dName);
                        const startDt = parseAsLocal(booking.dateTime);
                        const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                        const totalPassengers = booking.passengers ? booking.passengers.reduce((sum, p) => sum + p.count, 0) : 0;

                        return (
                          <div
                            key={booking.id}
                            onClick={() => setSelectedBookingId(booking.id)}
                            className="p-3 bg-white hover:bg-slate-50/80 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                          >
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                              <div className="p-2 bg-slate-100 rounded-xl text-center shrink-0 border border-slate-200 min-w-[65px]">
                                <span className="block text-[11px] font-extrabold text-slate-900 leading-tight">
                                  {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                </span>
                                {finishDt && (
                                  <span className="block text-[9px] text-slate-500 mt-0.5">
                                    to {finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                  </span>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">{booking.destination}</h4>
                                  <span className={`px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase ${
                                    booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                                  }`}>
                                    {booking.status}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 truncate mt-0.5">
                                  From: {getPickupLocationDisplay(booking.pickupPoint, booking.address)}
                                </p>
                                <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                  Requester: <strong>{booking.requesterName}</strong> {booking.department ? `(${booking.department})` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                              <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${style.bg} ${style.text} ${style.border}`}>
                                {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${dName.split(' ')[0]}`}
                              </span>
                              <span className="text-[11px] font-extrabold text-slate-700 bg-slate-100 px-2 py-1 rounded-lg">
                                👥 {totalPassengers}
                              </span>
                            </div>
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
    </>
  );
};

export default CalendarView;
