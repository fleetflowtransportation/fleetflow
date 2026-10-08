import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';
import type { Booking, User, Vehicle } from '../types';
import { getDriverCalendarColor, normalizeDate, normalizeTime } from '../services/bookingEngine';
import { supabase, resetSupabaseConfig } from '../services/supabaseClient';
import { storageService } from '../services/storage';
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
import BookingDetailModal from './BookingDetailModal';

export type CalendarViewMode = 'month' | '3days' | 'week' | 'day' | 'schedule';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_NAMES_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Clean, soothing, professional color palette matching Armada Flow app
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
      const finishM = e.getHours() * 60 + e.getMinutes();
      if (finishM > startM) {
        endM = finishM;
      } else if (finishM === startM) {
        endM = startM + 60;
      } else {
        endM = finishM + 1440;
      }
    }

    const clampedStart = Math.max(rangeStartMinutes, Math.min(rangeStartMinutes + totalRangeMinutes, startM));
    // Allow short events like 15 minutes (e.g. 11:45am - 12:00pm)
    const clampedEnd = Math.max(clampedStart + 15, Math.min(rangeStartMinutes + totalRangeMinutes, endM));

    const topPercent = Math.max(0, ((clampedStart - rangeStartMinutes) / totalRangeMinutes) * 100);
    // Minimum 18px in a 1536px timeline (18 / 1536 * 100 = 1.17%) so 15-min event is compact & readable
    const heightPercent = Math.max(1.17, ((clampedEnd - clampedStart) / totalRangeMinutes) * 100);

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

export { BookingDetailModal };

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

  const users = customUsers || context?.users || [];
  const vehicles = customVehicles || context?.vehicles || [];
  const currentUser = context?.currentUser || null;
  const deleteBooking = context?.deleteBooking || (() => {});

  const isAdmin = useMemo(() => {
    if (isPublic) return false;
    if (!currentUser) return false;
    const roleLower = (currentUser.role || '').toLowerCase();
    return roleLower === 'admin' || roleLower === 'superadmin' || !!currentUser.isOwner;
  }, [isPublic, currentUser]);

  const [viewMode, setViewMode] = useState<CalendarViewMode>(defaultView);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // Server-side lightweight date-range bookings state
  const [serverBookings, setServerBookings] = useState<Booking[]>([]);
  const [hasFetched, setHasFetched] = useState(false);
  const [loading, setLoading] = useState(false);

  // In-memory cache for full on-demand detail payloads (prevents redundant fetches)
  const detailsCacheRef = useRef<Map<string, Booking>>(new Map());

  // WebSocket channel ref for leak-free unmount cleanup
  const realtimeChannelRef = useRef<any>(null);

  // 1. Calculate Date Range (Start & End Date) based on current ViewMode
  const getDateRange = useCallback(() => {
    const d = new Date(currentDate);
    let start = new Date(d);
    let end = new Date(d);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === '3days') {
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 2);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start = new Date(start.setDate(diff));
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'schedule') {
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 30);
      end.setHours(23, 59, 59, 999);
    } else {
      // Month: Ensure 7x6 matrix coverage (tail of prev month, head of next month)
      const year = d.getFullYear();
      const month = d.getMonth();
      start = new Date(year, month - 1, 20, 0, 0, 0, 0);
      end = new Date(year, month + 1, 15, 23, 59, 59, 999);
    }

    const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}T00:00:00`;
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}T23:59:59`;

    return { startStr, endStr, start, end };
  }, [currentDate, viewMode]);

  // Fallback function to extract bookings from context within the active date range
  const fallbackToContextBookings = useCallback((rangeStart: Date, rangeEnd: Date) => {
    const allContext = context?.bookings || [];
    const tenantId = context?.activeTenant?.id || currentUser?.tenantId || storageService.getTenantId();
    const startTime = rangeStart.getTime();
    const endTime = rangeEnd.getTime();

    const filtered = allContext.filter((b: Booking) => {
      if (tenantId && b.tenantId && b.tenantId !== tenantId) return false;
      const t = new Date(b.dateTime).getTime();
      return t >= startTime && t <= endTime;
    });

    setServerBookings(filtered);
    setHasFetched(true);
  }, [context?.bookings, context?.activeTenant?.id, currentUser?.tenantId]);

  // 2. Fetch Lightweight Data based on Date Range & Specific Column Selection (Reduces Supabase Egress)
  const fetchCalendarBookings = useCallback(async () => {
    if (customBookings) {
      setServerBookings(customBookings);
      setHasFetched(true);
      return;
    }

    setLoading(true);
    const { startStr, endStr, start, end } = getDateRange();
    const tenantId = context?.activeTenant?.id || currentUser?.tenantId || storageService.getTenantId();

    try {
      const buildQuery = (client = supabase) => {
        let q = client
          .from('bookings')
          .select(`
            id,
            destination,
            purpose,
            date_time,
            finish_date_time,
            pickup_point,
            status,
            driver_id,
            vehicle_id,
            requester_name,
            requester_email,
            department,
            service_type,
            calendar_event_title,
            calendar_color,
            tenant_id
          `)
          .gte('date_time', startStr)
          .lte('date_time', endStr);

        if (tenantId) {
          q = q.eq('tenant_id', tenantId);
        }
        return q;
      };

      let { data, error } = await buildQuery(supabase);

      // Self-heal: If invalid API key or auth token error, reset to master credentials and retry once
      if (error && (error.message?.includes('API key') || error.message?.includes('JWT') || error.code === 'PGRST301')) {
        console.warn('[CalendarView] API key error detected, resetting Supabase credentials and retrying...');
        resetSupabaseConfig();
        const retryResult = await buildQuery(supabase);
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) {
        console.warn('[CalendarView] Date-range query notice:', error.message);
        fallbackToContextBookings(start, end);
        return;
      }

      if (data) {
        const lightweightList: Booking[] = data.map((row: any) => ({
          id: row.id,
          destination: row.destination || '',
          purpose: row.purpose || '',
          dateTime: row.date_time,
          finishDateTime: row.finish_date_time || undefined,
          pickupPoint: row.pickup_point || '',
          address: '',
          passengers: [],
          shouldWait: false,
          status: (row.status || 'Pending') as Booking['status'],
          driverId: row.driver_id || null,
          vehicleId: row.vehicle_id || null,
          requesterName: row.requester_name || '',
          requesterEmail: row.requester_email || '',
          department: row.department || '',
          serviceType: (row.service_type || 'Perlu Driver') as Booking['serviceType'],
          calendarEventTitle: row.calendar_event_title || undefined,
          calendarColor: row.calendar_color || undefined,
          tenantId: row.tenant_id || tenantId,
        }));
        setServerBookings(lightweightList);
        setHasFetched(true);
      }
    } catch (err: any) {
      console.warn('[CalendarView] Network exception:', err?.message);
      fallbackToContextBookings(start, end);
    } finally {
      setLoading(false);
    }
  }, [customBookings, getDateRange, fallbackToContextBookings, context?.activeTenant?.id, currentUser?.tenantId]);

  // 3. Realtime WebSocket Subscription with Leak-Free Cleanup
  useEffect(() => {
    fetchCalendarBookings();

    // Clean up any existing channel before setting up a new one
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    // Subscribe to live database changes
    const channel = supabase
      .channel(`calendar-db-sync-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          fetchCalendarBookings();
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    // CLEANUP: Ensure channel is unsubscribed when component unmounts or date/view changes
    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [fetchCalendarBookings]);

  // 4. Fetch Full Detail On-Demand (Google Drive URL, Passengers, Notes) only when clicked
  const handleSelectBooking = useCallback(async (bookingId: string) => {
    setSelectedBookingId(bookingId);

    // 1. Check in-memory cache first
    if (detailsCacheRef.current.has(bookingId)) {
      setSelectedBooking(detailsCacheRef.current.get(bookingId)!);
      return;
    }

    // 2. Set initial preview immediately from lightweight loaded bookings or context
    const preview = serverBookings.find(b => b.id === bookingId) || context?.bookings?.find(b => b.id === bookingId);
    if (preview) {
      setSelectedBooking(preview);
    }

    // 3. Fetch full payload on-demand
    setLoadingDetail(true);
    try {
      let { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('id', bookingId)
        .single();

      if (error && (error.message?.includes('API key') || error.message?.includes('JWT') || error.code === 'PGRST301')) {
        resetSupabaseConfig();
        const retryRes = await supabase
          .from('bookings')
          .select('*')
          .eq('id', bookingId)
          .single();
        data = retryRes.data;
        error = retryRes.error;
      }

      if (data) {
        const fullBooking: Booking = {
          id: data.id,
          destination: data.destination || '',
          purpose: data.purpose || '',
          dateTime: data.date_time,
          finishDateTime: data.finish_date_time || undefined,
          pickupPoint: data.pickup_point || '',
          address: data.address || '',
          passengers: data.passengers || [],
          escort: data.escort || undefined,
          shouldWait: Boolean(data.should_wait),
          returnTrip: data.return_trip !== undefined ? Boolean(data.return_trip) : undefined,
          status: (data.status || 'Pending') as Booking['status'],
          driverId: data.driver_id || null,
          vehicleId: data.vehicle_id || null,
          attachmentName: data.attachment_name || undefined,
          attachmentUrl: data.attachment_url || undefined,
          remarks: data.remarks || undefined,
          requesterName: data.requester_name || '',
          requesterEmail: data.requester_email || '',
          department: data.department || '',
          serviceType: (data.service_type || 'Perlu Driver') as Booking['serviceType'],
          vehiclePreference: data.vehicle_preference || undefined,
          icNumber: data.ic_number || undefined,
          recurrenceId: data.recurrence_id || undefined,
          recurrence: data.recurrence || undefined,
          startOdometer: data.start_odometer ? Number(data.start_odometer) : undefined,
          endOdometer: data.end_odometer ? Number(data.end_odometer) : undefined,
          distance: data.distance ? Number(data.distance) : undefined,
          calendarEventId: data.calendar_event_id || undefined,
          calendarEventTitle: data.calendar_event_title || undefined,
          calendarColor: data.calendar_color || undefined,
          adminNotes: data.admin_notes || undefined,
          conflictReason: data.conflict_reason || undefined,
          isPreWorkingHour: Boolean(data.is_pre_working_hour),
          warningNotes: data.warning_notes || undefined,
          tenantId: data.tenant_id,
        };

        detailsCacheRef.current.set(bookingId, fullBooking);
        setSelectedBooking(fullBooking);
      }
    } catch (err: any) {
      console.warn('[CalendarView] Detail fetch notice:', err?.message);
    } finally {
      setLoadingDetail(false);
    }
  }, [serverBookings, context?.bookings]);

  const handleCloseDetail = useCallback(() => {
    setSelectedBookingId(null);
    setSelectedBooking(null);
  }, []);

  // Effective bookings to render in calendar views
  const bookings = useMemo(() => {
    if (customBookings) return customBookings;
    if (hasFetched) return serverBookings;
    return context?.bookings || [];
  }, [customBookings, hasFetched, serverBookings, context?.bookings]);

  // Timeline container ref for auto-scrolling to daytime (~8am or current hour)
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);

  // 24-hour array from 0 (12:00 AM) to 23 (11:00 PM)
  const allDayHours = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => i);
  }, []);

  // Live current time indicator that updates and moves every 15 seconds
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  const currentPercent = (currentMinutes / 1440) * 100;
  const currentTimeLabel = currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  // Filtered drivers list
  const driversList = useMemo(() => {
    return users.filter(u => {
      const r = (u.role || '').toLowerCase();
      return r === 'driver' || r === 'staff' || u.id === 'driver-aziz';
    });
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
          const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
          const dayBookings = bookingsByDay.get(key) || [];
          let targetHour = 8;
          if (dayBookings.length > 0) {
            const firstHour = parseAsLocal(dayBookings[0].dateTime).getHours();
            targetHour = Math.max(0, Math.min(23, firstHour - 1));
          }
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
    window.open('https://armadaflow.vercel.app/?action=book&tenant_id=yck', '_blank');
  };

  const handleEditBooking = (b: Booking) => {
    if (isAdmin) {
      setEditingBooking(b);
      setIsFormOpen(true);
    }
  };

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
        onClose={handleCloseDetail} 
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

      {/* Main Calendar Container - Clean White Armada Flow Design */}
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
                  {loading && (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" title="Loading calendar events..."></div>
                  )}
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

              {/* Primary Action Button (Add / Book) - hidden in public view to avoid duplicate with page header */}
              {!isPublic && (
                onRequestBooking ? (
                  <button
                    onClick={onRequestBooking}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Book Vehicle</span>
                  </button>
                ) : isAdmin ? (
                  <button
                    onClick={handleCreateNewBooking}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3.5 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Add Booking</span>
                  </button>
                ) : null
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
                const positionedEvents = calculateDayCollisionLayout(dayBookings, 0, 24);
                const isDayToday = currentDate.toDateString() === currentTime.toDateString();

                return (
                  <div className="flex relative" style={{ height: `${24 * 64}px` }}>
                    {/* Time Gutter on Left (Dedicated Flex Child - will NOT be encroached by events) */}
                    <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200 bg-slate-50/70 relative select-none">
                      {allDayHours.map(hour => (
                        <div 
                          key={hour} 
                          className="h-[64px] border-b border-slate-100 p-2 text-right text-[10px] sm:text-xs font-mono font-bold text-slate-500"
                        >
                          {formatHourLabel(hour)}
                        </div>
                      ))}

                      {/* Live current time indicator marker on gutter if today */}
                      {isDayToday && (
                        <div
                          style={{ top: `${currentPercent}%` }}
                          className="absolute right-0 -mt-2.5 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-l shadow-xs z-30"
                        >
                          {currentTimeLabel}
                        </div>
                      )}
                    </div>

                    {/* Event Track (Dedicated Flex Child - 100% physically clean & separated) */}
                    <div className="flex-1 relative">
                      {/* 24 Hour Grid Lines */}
                      {allDayHours.map(hour => (
                        <div 
                          key={hour} 
                          className="h-[64px] border-b border-slate-100 hover:bg-slate-50/30 transition" 
                        />
                      ))}

                      {/* Live Moving Horizontal Red Line if Today */}
                      {isDayToday && (
                        <div
                          style={{ top: `${currentPercent}%` }}
                          className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[5px]"
                        >
                          <div className="h-2.5 w-2.5 rounded-full bg-red-600 shadow-sm -ml-1.5 shrink-0" />
                          <div className="h-[2px] bg-red-500 w-full shadow-2xs" />
                        </div>
                      )}

                      {/* Render Events */}
                      {positionedEvents.map(item => {
                        const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                        const dName = getDriverName(booking.driverId);
                        const style = getEventCardStyle(booking, dName);
                        const startDt = parseAsLocal(booking.dateTime);
                        const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                        const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${finishDt ? ' – ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`;

                        const colWidthPercent = 100 / totalCols;
                        const leftPercent = colIndex * colWidthPercent;
                        const isShort = heightPercent < 2.5; // < ~36px (e.g. 15-30 min)

                        return (
                          <div
                            key={booking.id}
                            onClick={() => handleSelectBooking(booking.id)}
                            style={{
                              top: `${topPercent}%`,
                              height: `${heightPercent}%`,
                              left: `calc(${leftPercent}% + 4px)`,
                              width: `calc(${colWidthPercent}% - 8px)`,
                            }}
                            className={`absolute z-20 rounded-xl border shadow-xs transition cursor-pointer hover:shadow-md hover:scale-[1.005] overflow-hidden ${style.bg} ${style.border} ${style.text}`}
                            title={`${timeStr} | ${booking.requesterName} → ${booking.destination}`}
                          >
                            {isShort ? (
                              <div className="flex items-center justify-between gap-1.5 px-2 h-full overflow-hidden leading-none select-none text-[10px] font-bold">
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="font-mono text-[9px] px-1 py-0.2 rounded bg-white/80 border border-slate-200/60 text-slate-700 shrink-0">
                                    {timeStr}
                                  </span>
                                  <span className="truncate">
                                    <span className="font-extrabold text-slate-900">
                                      {booking.serviceType === 'Self-Drive' ? '[Self-Drive]' : `(${dName.split(' ')[0]})`}
                                    </span>{' '}
                                    {booking.requesterName} → {booking.destination}
                                  </span>
                                </div>
                                <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase shrink-0 ${style.badge}`}>
                                  {booking.serviceType === 'Self-Drive' ? 'Self' : dName.split(' ')[0]}
                                </span>
                              </div>
                            ) : (
                              <div className="p-2 sm:p-2.5 h-full flex flex-col justify-between overflow-hidden">
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

                                {heightPercent >= 4.5 && (
                                  <div className="pt-1 mt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-500">
                                    <span className="truncate">{booking.purpose || 'Official Transport'}</span>
                                    <span className="font-semibold shrink-0 ml-1">
                                      {booking.shouldWait ? '⏳ Standby' : '🚗 Drop'}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 2: 3-DAYS VIEW (Google Calendar Continuous Matrix)
            ======================================================== */}
        {viewMode === '3days' && (
          <div className="p-3 sm:p-5">
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
              <div className="min-w-[640px]">
                {/* 3 Days Column Headers */}
                <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                  <div className="w-14 sm:w-16 shrink-0 py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200">
                    Time
                  </div>

                  <div className="flex-1 grid grid-cols-3 divide-x divide-slate-200">
                    {threeDays.map(({ date, isToday }) => (
                      <div
                        key={date.toISOString()}
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('day');
                        }}
                        className={`py-2 px-1 text-center transition cursor-pointer hover:bg-slate-100 ${
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
                </div>

                {/* 3-Days Continuous Scrollable Timeline */}
                <div 
                  ref={timelineScrollRef}
                  className="overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white relative"
                >
                  <div className="flex relative" style={{ height: `${24 * 64}px` }}>
                    {/* Time Gutter on Left */}
                    <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200 bg-slate-50/70 relative select-none">
                      {allDayHours.map(hour => (
                        <div
                          key={hour}
                          className="h-[64px] border-b border-slate-100 text-[10px] font-mono font-bold text-center pt-1 text-slate-400"
                        >
                          {formatHourLabel(hour)}
                        </div>
                      ))}
                      {/* Current time marker badge on gutter if any of 3 days is today */}
                      {threeDays.some(d => d.isToday) && (
                        <div
                          style={{ top: `${currentPercent}%` }}
                          className="absolute right-0 -mt-2 bg-red-600 text-white font-mono text-[8px] font-bold px-1 py-0.5 rounded-l shadow-xs z-30"
                        >
                          {currentTimeLabel}
                        </div>
                      )}
                    </div>

                    {/* 3 Days Event Columns */}
                    <div className="flex-1 grid grid-cols-3 divide-x divide-slate-100 relative">
                      {threeDays.map(({ date, dateKey, isToday }, idx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const positioned = calculateDayCollisionLayout(dayBookings, 0, 24);

                        return (
                          <div
                            key={idx}
                            className={`relative h-full transition hover:bg-slate-50/20 ${
                              isToday ? 'bg-indigo-50/15' : ''
                            }`}
                          >
                            {/* Background Hour Lines */}
                            {allDayHours.map(hour => (
                              <div
                                key={hour}
                                className="h-[64px] border-b border-slate-100"
                              />
                            ))}

                            {/* Live moving red line if today */}
                            {isToday && (
                              <div
                                style={{ top: `${currentPercent}%` }}
                                className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[4px]"
                              >
                                <div className="h-2 w-2 rounded-full bg-red-600 shadow-sm -ml-1 shrink-0" />
                                <div className="h-[2px] bg-red-500 w-full" />
                              </div>
                            )}

                            {/* Events */}
                            {positioned.map(item => {
                              const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                              const dName = getDriverName(booking.driverId);
                              const style = getEventCardStyle(booking, dName);
                              const startDt = parseAsLocal(booking.dateTime);
                              const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                              const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${finishDt ? ' – ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`;

                              const colWidthPercent = 100 / totalCols;
                              const leftPercent = colIndex * colWidthPercent;
                              const isShort = heightPercent < 2.5;

                              return (
                                <div
                                  key={booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectBooking(booking.id);
                                  }}
                                  style={{
                                    top: `${topPercent}%`,
                                    height: `${heightPercent}%`,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    width: `calc(${colWidthPercent}% - 4px)`,
                                  }}
                                  className={`absolute z-20 rounded-md border shadow-2xs transition cursor-pointer hover:shadow-md hover:scale-[1.01] overflow-hidden ${style.bg} ${style.border} ${style.text}`}
                                  title={`${timeStr} | ${booking.requesterName} → ${booking.destination}`}
                                >
                                  {isShort ? (
                                    <div className="flex items-center gap-1 px-1 h-full overflow-hidden leading-none select-none text-[9px] font-bold">
                                      <span className="shrink-0 text-slate-600 font-mono">
                                        {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                      </span>
                                      <span className="truncate">
                                        {booking.serviceType === 'Self-Drive' ? '[Self]' : `(${dName.split(' ')[0]})`}{' '}
                                        {booking.destination}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="p-1 sm:p-1.5 flex flex-col justify-between h-full overflow-hidden">
                                      <div className="overflow-hidden">
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                          <span className="text-[8px] font-bold font-mono px-1 py-0.1 rounded bg-white/80 border border-slate-200/60 text-slate-700 truncate">
                                            {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                          </span>
                                          <span className={`text-[8px] font-bold px-1 py-0.1 rounded uppercase shrink-0 ${style.badge}`}>
                                            {booking.serviceType === 'Self-Drive' ? 'Self' : dName.split(' ')[0]}
                                          </span>
                                        </div>
                                        <p className="font-extrabold text-[10px] sm:text-xs leading-tight line-clamp-2">
                                          {booking.destination}
                                        </p>
                                        <p className="text-[9px] text-slate-600 truncate mt-0.5">
                                          {booking.requesterName}
                                        </p>
                                      </div>
                                    </div>
                                  )}
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
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 3: 7-DAYS WEEK VIEW (Google Calendar Continuous Grid)
            ======================================================== */}
        {viewMode === 'week' && (
          <div className="p-3 sm:p-5">
            <div className="border border-slate-200 rounded-xl overflow-x-auto bg-white shadow-xs">
              <div className="min-w-[840px]">
                {/* 7 Days Header */}
                <div className="flex border-b border-slate-200 bg-slate-50 sticky top-0 z-30">
                  <div className="w-14 sm:w-16 shrink-0 py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200 bg-slate-50">
                    Time
                  </div>

                  <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200">
                    {weekDays.map(({ date, isToday }) => (
                      <div
                        key={date.toISOString()}
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('day');
                        }}
                        className={`py-2 px-1 text-center transition cursor-pointer hover:bg-slate-100 ${
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
                </div>

                {/* 7-Days Continuous Scrollable Grid (Proportional Box Height) */}
                <div 
                  ref={timelineScrollRef}
                  className="overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white relative"
                >
                  <div className="flex relative" style={{ height: `${24 * 64}px` }}>
                    {/* Time Gutter on Left */}
                    <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200 bg-slate-50/70 relative select-none">
                      {allDayHours.map(hour => (
                        <div
                          key={hour}
                          className="h-[64px] border-b border-slate-100 text-[10px] font-mono font-bold text-center pt-1 text-slate-400"
                        >
                          {formatHourLabel(hour)}
                        </div>
                      ))}
                      {/* Live current time badge on gutter if any day of week is today */}
                      {weekDays.some(w => w.isToday) && (
                        <div
                          style={{ top: `${currentPercent}%` }}
                          className="absolute right-0 -mt-2 bg-red-600 text-white font-mono text-[8px] font-bold px-1 py-0.5 rounded-l shadow-xs z-30"
                        >
                          {currentTimeLabel}
                        </div>
                      )}
                    </div>

                    {/* 7 Days Columns */}
                    <div className="flex-1 grid grid-cols-7 divide-x divide-slate-100 relative">
                      {weekDays.map(({ date, dateKey, isToday }, idx) => {
                        const dayBookings = bookingsByDay.get(dateKey) || [];
                        const positioned = calculateDayCollisionLayout(dayBookings, 0, 24);

                        return (
                          <div
                            key={idx}
                            className={`relative h-full transition hover:bg-slate-50/20 ${
                              isToday ? 'bg-indigo-50/15' : ''
                            }`}
                          >
                            {/* Background Hour Lines */}
                            {allDayHours.map(hour => (
                              <div
                                key={hour}
                                className="h-[64px] border-b border-slate-100"
                              />
                            ))}

                            {/* Live moving red line if today */}
                            {isToday && (
                              <div
                                style={{ top: `${currentPercent}%` }}
                                className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[4px]"
                              >
                                <div className="h-2 w-2 rounded-full bg-red-600 shadow-sm -ml-1 shrink-0" />
                                <div className="h-[2px] bg-red-500 w-full" />
                              </div>
                            )}

                            {/* Positioned Events for this day - stretched accurately by booking time! */}
                            {positioned.map(item => {
                              const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                              const dName = getDriverName(booking.driverId);
                              const style = getEventCardStyle(booking, dName);
                              const startDt = parseAsLocal(booking.dateTime);
                              const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
                              const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${finishDt ? ' – ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''}`;

                              const colWidthPercent = 100 / totalCols;
                              const leftPercent = colIndex * colWidthPercent;
                              const isShort = heightPercent < 2.5;

                              return (
                                <div
                                  key={booking.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectBooking(booking.id);
                                  }}
                                  style={{
                                    top: `${topPercent}%`,
                                    height: `${heightPercent}%`,
                                    left: `calc(${leftPercent}% + 2px)`,
                                    width: `calc(${colWidthPercent}% - 4px)`,
                                  }}
                                  className={`absolute z-20 rounded-md border shadow-2xs transition cursor-pointer hover:shadow-md hover:scale-[1.01] overflow-hidden ${style.bg} ${style.border} ${style.text}`}
                                  title={`${timeStr} | ${booking.requesterName} → ${booking.destination}`}
                                >
                                  {isShort ? (
                                    <div className="flex items-center gap-1 px-1 h-full overflow-hidden leading-none select-none text-[9px] font-bold">
                                      <span className="shrink-0 text-slate-600 font-mono">
                                        {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                      </span>
                                      <span className="truncate">
                                        {booking.serviceType === 'Self-Drive' ? '[Self]' : `(${dName.split(' ')[0]})`}{' '}
                                        {booking.destination}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="p-1 sm:p-1.5 flex flex-col justify-between h-full overflow-hidden">
                                      <div className="overflow-hidden">
                                        <div className="flex items-center justify-between gap-1 mb-0.5">
                                          <span className="text-[8px] font-bold font-mono px-1 py-0.1 rounded bg-white/80 border border-slate-200/60 text-slate-700 truncate">
                                            {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                          </span>
                                          <span className={`text-[8px] font-bold px-1 py-0.1 rounded uppercase shrink-0 ${style.badge}`}>
                                            {booking.serviceType === 'Self-Drive' ? 'Self' : dName.split(' ')[0]}
                                          </span>
                                        </div>
                                        <p className="font-extrabold text-[10px] sm:text-xs leading-tight line-clamp-2">
                                          {booking.destination}
                                        </p>
                                        <p className="text-[9px] text-slate-600 truncate mt-0.5">
                                          {booking.requesterName}
                                        </p>
                                      </div>
                                      {heightPercent >= 5 && (
                                        <div className="text-[8px] text-slate-500 truncate pt-0.5 border-t border-slate-200/50 flex items-center justify-between">
                                          <span className="truncate">{booking.purpose || 'Official'}</span>
                                          <span>{booking.shouldWait ? '⏳' : '🚗'}</span>
                                        </div>
                                      )}
                                    </div>
                                  )}
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
            </div>
          </div>
        )}

        {/* ========================================================
            VIEW 4: MONTH VIEW (Clean Armada Flow Design)
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
                                handleSelectBooking(b.id);
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
                            onClick={() => handleSelectBooking(b.id)}
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
    </>
  );
};

export default CalendarView;
