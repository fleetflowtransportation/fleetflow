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

// Clean, soothing, modern glassmorphic enterprise palette with dark/light adaptive accents
export const EVENT_CARD_COLORS = {
  syafiq: {
    bg: 'bg-sky-50/90 hover:bg-sky-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(14,165,233,0.08)]',
    border: 'border-sky-200/90 border-l-[3.5px] border-l-sky-600',
    text: 'text-sky-950',
    subtext: 'text-sky-700',
    badge: 'bg-sky-100/90 text-sky-900 border border-sky-200/80 font-bold',
    dot: 'bg-sky-600 shadow-[0_0_8px_rgba(2,132,199,0.5)]',
    monthChip: 'bg-sky-50/95 text-sky-950 border-sky-200/90 hover:bg-sky-100/95 hover:border-sky-300 shadow-2xs backdrop-blur-xs',
  },
  saiful: {
    bg: 'bg-emerald-50/90 hover:bg-emerald-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(16,185,129,0.08)]',
    border: 'border-emerald-200/90 border-l-[3.5px] border-l-emerald-600',
    text: 'text-emerald-950',
    subtext: 'text-emerald-700',
    badge: 'bg-emerald-100/90 text-emerald-900 border border-emerald-200/80 font-bold',
    dot: 'bg-emerald-600 shadow-[0_0_8px_rgba(5,150,105,0.5)]',
    monthChip: 'bg-emerald-50/95 text-emerald-950 border-emerald-200/90 hover:bg-emerald-100/95 hover:border-emerald-300 shadow-2xs backdrop-blur-xs',
  },
  selfdrive: {
    bg: 'bg-slate-50/90 hover:bg-slate-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(100,116,139,0.08)]',
    border: 'border-slate-300/90 border-l-[3.5px] border-l-slate-700',
    text: 'text-slate-900',
    subtext: 'text-slate-700',
    badge: 'bg-slate-200/90 text-slate-800 border border-slate-300/80 font-bold',
    dot: 'bg-slate-700 shadow-[0_0_8px_rgba(51,65,85,0.4)]',
    monthChip: 'bg-slate-100/95 text-slate-900 border-slate-300/90 hover:bg-slate-200/95 hover:border-slate-400 shadow-2xs backdrop-blur-xs',
  },
  conflict: {
    bg: 'bg-rose-50/90 hover:bg-rose-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(244,63,94,0.08)]',
    border: 'border-rose-200/90 border-l-[3.5px] border-l-rose-600',
    text: 'text-rose-950',
    subtext: 'text-rose-700',
    badge: 'bg-rose-100/90 text-rose-900 border border-rose-200/80 font-bold',
    dot: 'bg-rose-600 animate-pulse shadow-[0_0_8px_rgba(225,29,72,0.6)]',
    monthChip: 'bg-rose-50/95 text-rose-950 border-rose-200/90 hover:bg-rose-100/95 hover:border-rose-300 shadow-2xs backdrop-blur-xs',
  },
  pending: {
    bg: 'bg-amber-50/90 hover:bg-amber-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(245,158,11,0.08)]',
    border: 'border-amber-200/90 border-l-[3.5px] border-l-amber-500',
    text: 'text-amber-950',
    subtext: 'text-amber-700',
    badge: 'bg-amber-100/90 text-amber-900 border border-amber-200/80 font-bold',
    dot: 'bg-amber-500 shadow-[0_0_8px_rgba(217,119,6,0.5)]',
    monthChip: 'bg-amber-50/95 text-amber-950 border-amber-200/90 hover:bg-amber-100/90 hover:border-amber-300 shadow-2xs backdrop-blur-xs',
  },
  default: {
    bg: 'bg-indigo-50/90 hover:bg-indigo-100/95 backdrop-blur-md shadow-[0_2px_10px_rgba(99,102,241,0.08)]',
    border: 'border-indigo-200/90 border-l-[3.5px] border-l-indigo-600',
    text: 'text-indigo-950',
    subtext: 'text-indigo-700',
    badge: 'bg-indigo-100/90 text-indigo-900 border border-indigo-200/80 font-bold',
    dot: 'bg-indigo-600 shadow-[0_0_8px_rgba(79,70,229,0.5)]',
    monthChip: 'bg-indigo-50/95 text-indigo-950 border-indigo-200/90 hover:bg-indigo-100/95 hover:border-indigo-300 shadow-2xs backdrop-blur-xs',
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
    // Ensure short events (15-30 mins) have comfortable breathing room (minimum 30 minutes visual span)
    const durationMinutes = Math.max(30, endM - startM);
    const clampedEnd = Math.max(clampedStart + 30, Math.min(rangeStartMinutes + totalRangeMinutes, clampedStart + durationMinutes));

    const topPercent = Math.max(0, ((clampedStart - rangeStartMinutes) / totalRangeMinutes) * 100);
    // Minimum 2.15% (~33px in a 1536px timeline) so 15-30 min events have comfortable breathing room
    const heightPercent = Math.max(2.15, ((clampedEnd - clampedStart) / totalRangeMinutes) * 100);

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

// Adaptive Event Card component optimized for short duration events (15–30 min)
// Adaptive Event Card component optimized for short duration events (15–30 min) and mobile responsiveness
interface TimelineEventCardProps {
  booking: Booking;
  topPercent: number;
  heightPercent: number;
  leftPercent: number;
  colWidthPercent: number;
  driverName: string;
  onClick: () => void;
  variant?: 'day' | '3days' | 'week';
}

const TimelineEventCard: React.FC<TimelineEventCardProps> = ({
  booking,
  topPercent,
  heightPercent,
  leftPercent,
  colWidthPercent,
  driverName,
  onClick,
  variant = 'day',
}) => {
  const style = getEventCardStyle(booking, driverName);
  const startDt = parseAsLocal(booking.dateTime);
  const finishDt = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : null;
  const timeStr = `${startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}${
    finishDt ? ' – ' + finishDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : ''
  }`;
  const startTimeSimple = startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  const isUltraShort = heightPercent < 3.0; // 15–30 min
  const isShort = heightPercent >= 3.0 && heightPercent < 5.0; // 30–55 min
  const isTall = heightPercent >= 5.0; // 1 hour+

  const horizontalInset = variant === 'week' ? '1px' : '3px';
  const widthReduction = variant === 'week' ? '2px' : '6px';
  const minHeightPx = isUltraShort ? (variant === 'week' ? '30px' : '34px') : isShort ? '44px' : '58px';

  return (
    <div
      onClick={onClick}
      style={{
        top: `${topPercent}%`,
        height: `${heightPercent}%`,
        left: `calc(${leftPercent}% + ${horizontalInset})`,
        width: `calc(${colWidthPercent}% - ${widthReduction})`,
        minHeight: minHeightPx,
      }}
      className={`absolute z-20 rounded-xl border shadow-xs transition-all duration-150 cursor-pointer hover:shadow-lg hover:scale-[1.01] hover:z-30 overflow-hidden ${style.bg} ${style.border} ${style.text}`}
      title={`${timeStr} | ${booking.serviceType === 'Self-Drive' ? 'Self-Drive' : driverName} | ${booking.requesterName} → ${booking.destination}`}
    >
      {isUltraShort ? (
        // Ultra-compact card for 15–30 min events: flexible micro-layout with breathing room
        <div className="flex items-center gap-1.5 px-2 py-0.5 h-full overflow-hidden leading-tight select-none">
          <span className={`w-2 h-2 rounded-full shrink-0 ${style.dot}`} />
          <span className="font-mono text-[9px] sm:text-[10px] text-slate-800 font-extrabold shrink-0 bg-white/70 px-1 py-0.2 rounded shadow-2xs">
            {startTimeSimple}
          </span>
          <span className="text-slate-300 shrink-0 select-none hidden xs:inline">·</span>
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
            <span className="truncate text-[10px] sm:text-[11px] font-black text-slate-900">
              {booking.destination}
            </span>
            {variant !== 'week' && (
              <span className="hidden md:inline text-[9.5px] text-slate-500 font-medium truncate shrink-0">
                ({booking.requesterName})
              </span>
            )}
          </div>
          <span className={`ml-auto text-[8px] sm:text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md shrink-0 shadow-2xs ${style.badge}`}>
            {booking.serviceType === 'Self-Drive' ? 'Self' : driverName.split(' ')[0]}
          </span>
        </div>
      ) : isShort ? (
        // Short duration card (30–55 min): balanced 2-line layout without vertical cramming
        <div className="p-1.5 sm:p-2 h-full flex flex-col justify-between overflow-hidden select-none">
          <div className="flex items-center justify-between gap-1 leading-none">
            <div className="flex items-center gap-1 truncate font-mono text-[9px] sm:text-[10px] font-bold text-slate-800 bg-white/70 px-1.5 py-0.5 rounded shadow-2xs">
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
              <span>{startTimeSimple}</span>
            </div>
            <span className={`text-[8px] sm:text-[8.5px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-2xs ${style.badge}`}>
              {booking.serviceType === 'Self-Drive' ? 'Self-Drive' : driverName.split(' ')[0]}
            </span>
          </div>
          <div className="truncate text-[10.5px] sm:text-xs font-black text-slate-900 leading-snug mt-0.5">
            {booking.destination}
          </div>
          {variant !== 'week' && (
            <div className="hidden sm:block truncate text-[9.5px] text-slate-600 font-medium leading-none">
              {booking.requesterName}
            </div>
          )}
        </div>
      ) : (
        // Standard full card (55+ min): complete trip logistics & standby status
        <div className="p-2 sm:p-2.5 h-full flex flex-col justify-between overflow-hidden select-none">
          <div className="overflow-hidden">
            <div className="flex items-center justify-between gap-1 mb-1">
              <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-white/90 border border-slate-200/80 text-slate-800 shadow-2xs">
                {timeStr}
              </span>
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-2xs ${style.badge}`}>
                {booking.serviceType === 'Self-Drive' ? 'Self-Drive' : driverName.split(' ')[0]}
              </span>
            </div>
            <p className="font-black text-xs sm:text-sm leading-snug line-clamp-2 text-slate-900">
              {booking.destination}
            </p>
            <p className="text-[10px] text-slate-600 truncate mt-0.5 font-medium">
              {booking.requesterName} {booking.department ? `· ${booking.department}` : ''}
            </p>
          </div>

          {isTall && (
            <div className="pt-1 mt-1 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-600">
              <span className="truncate">{booking.purpose || 'Official Transport'}</span>
              <span className="font-semibold shrink-0 ml-1">
                {booking.shouldWait ? '⏳ Standby' : '🚗 Drop-off'}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Shimmer Skeleton for Month View
const MonthViewSkeleton: React.FC = () => (
  <div className="overflow-x-auto animate-pulse">
    <div className="min-w-[320px]">
      <div className="grid grid-cols-7 border-b border-slate-200/90 bg-slate-50/90 backdrop-blur-xs">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <div key={day} className="py-2.5 text-center text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-slate-200/80">
        {Array.from({ length: 35 }).map((_, i) => (
          <div key={i} className="bg-white/90 p-2 min-h-[95px] sm:min-h-[120px] flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <div className="w-5 h-5 rounded-full bg-slate-200/80" />
              {i % 3 === 0 && <div className="w-5 h-2 rounded-full bg-indigo-100/70" />}
            </div>
            <div className="space-y-1.5 mt-2">
              {i % 2 === 0 && (
                <div className="h-4 rounded-lg bg-gradient-to-r from-sky-100/70 via-sky-200/50 to-sky-100/70 border border-sky-100/60" />
              )}
              {i % 3 === 0 && (
                <div className="h-4 rounded-lg bg-gradient-to-r from-emerald-100/70 via-emerald-200/50 to-emerald-100/70 border border-emerald-100/60 w-5/6" />
              )}
              {i % 4 === 0 && (
                <div className="h-4 rounded-lg bg-gradient-to-r from-indigo-100/70 via-indigo-200/50 to-indigo-100/70 border border-indigo-100/60 w-3/4" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

// High-End Shimmer Skeleton for Timeline Views (Day, 3-Days, Week)
const TimelineViewSkeleton: React.FC<{ columns?: number }> = ({ columns = 1 }) => {
  const colClass = columns === 7 ? 'grid-cols-7' : columns === 3 ? 'grid-cols-3' : 'grid-cols-1';

  return (
    <div className="relative border border-slate-200/90 rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl max-h-[640px] sm:max-h-[720px] animate-pulse shadow-xs">
      {/* Column Headers Shimmer */}
      <div className="flex border-b border-slate-200/80 bg-slate-50/90 sticky top-0 z-20">
        <div className="w-14 sm:w-16 shrink-0 py-2.5 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200/80">
          Time
        </div>
        <div className={`flex-1 grid ${colClass} divide-x divide-slate-200/80`}>
          {Array.from({ length: columns }).map((_, idx) => (
            <div key={idx} className="py-2.5 px-2 flex flex-col items-center justify-center gap-1">
              <div className="w-8 h-2 rounded bg-slate-200/80" />
              <div className="w-6 h-6 rounded-full bg-slate-200/90" />
            </div>
          ))}
        </div>
      </div>

      {/* Timeline Rows Shimmer */}
      <div className="flex relative" style={{ height: '700px' }}>
        {/* Left Time Gutter */}
        <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200/80 bg-slate-50/70 divide-y divide-slate-100">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="h-[64px] p-2 flex items-center justify-center">
              <div className="w-8 h-2.5 rounded bg-slate-200/70" />
            </div>
          ))}
        </div>

        {/* Column Lanes with Shimmer Event Cards */}
        <div className={`flex-1 grid ${colClass} divide-x divide-slate-100 relative`}>
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="relative h-full divide-y divide-slate-100 p-2 space-y-3">
              {Array.from({ length: 11 }).map((_, rowIdx) => (
                <div key={rowIdx} className="h-[64px] relative" />
              ))}
              
              {/* Shimmer Event Cards positioned inside lane */}
              {colIdx % 2 === 0 && (
                <div className="absolute top-12 left-2 right-2 h-14 rounded-xl bg-gradient-to-r from-sky-50 via-sky-100/70 to-sky-50 border border-sky-200/80 shadow-xs" />
              )}
              {colIdx % 3 === 0 && (
                <div className="absolute top-36 left-2 right-2 h-20 rounded-xl bg-gradient-to-r from-emerald-50 via-emerald-100/70 to-emerald-50 border border-emerald-200/80 shadow-xs" />
              )}
              {colIdx === 0 && (
                <div className="absolute top-72 left-2 right-2 h-16 rounded-xl bg-gradient-to-r from-indigo-50 via-indigo-100/70 to-indigo-50 border border-indigo-200/80 shadow-xs" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Shimmer Skeleton for Schedule Agenda View
const ScheduleViewSkeleton: React.FC = () => (
  <div className="p-3 sm:p-5 space-y-6 animate-pulse">
    {Array.from({ length: 3 }).map((_, i) => (
      <div key={i} className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" />
          <div className="w-44 h-4 rounded-md bg-slate-200" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="p-4 rounded-2xl border border-slate-200/90 bg-white/90 backdrop-blur-md space-y-3 shadow-xs">
              <div className="flex justify-between items-center">
                <div className="w-20 h-4 rounded-md bg-slate-200" />
                <div className="w-14 h-4 rounded-full bg-slate-200" />
              </div>
              <div className="w-4/5 h-4 rounded bg-slate-200" />
              <div className="w-1/2 h-3 rounded bg-slate-100" />
              <div className="pt-2 border-t border-slate-100 flex justify-between">
                <div className="w-24 h-3 rounded bg-slate-100" />
                <div className="w-16 h-3 rounded bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
);

// High-End Visual Empty State with Modern Glassmorphism
interface CalendarEmptyStateProps {
  title?: string;
  description?: string;
  onResetFilter?: () => void;
  onAction?: () => void;
  actionLabel?: string;
}

const CalendarEmptyState: React.FC<CalendarEmptyStateProps> = ({
  title = 'No Bookings Scheduled',
  description = 'There are no vehicle reservations recorded for this date range or filter.',
  onResetFilter,
  onAction,
  actionLabel = 'Book a Vehicle'
}) => (
  <div className="p-8 sm:p-14 text-center flex flex-col items-center justify-center max-w-md mx-auto animate-in fade-in zoom-in-95 duration-200">
    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-50 to-indigo-100/70 border border-indigo-200/70 flex items-center justify-center text-indigo-600 shadow-sm mb-4">
      <CalendarIcon className="w-8 h-8 text-indigo-500" />
    </div>
    <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mb-1.5">
      {title}
    </h3>
    <p className="text-xs sm:text-sm text-slate-500 max-w-sm mb-6 leading-relaxed">
      {description}
    </p>
    <div className="flex flex-wrap items-center justify-center gap-2.5">
      {onResetFilter && (
        <button
          onClick={onResetFilter}
          className="px-3.5 py-2 rounded-xl text-xs font-bold border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
        >
          Reset Filters
        </button>
      )}
      {onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  </div>
);

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

      {/* Main Calendar Container - Modern SaaS Enterprise Glassmorphism Design */}
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-slate-200/90 text-slate-800 flex flex-col overflow-hidden relative transition-all">
        
        {/* Subtle Gradient Accent Header Hairline */}
        <div className="h-1 w-full bg-gradient-to-r from-indigo-600 via-sky-500 to-indigo-600" />

        {/* Live Revalidation / Loading Progress Bar */}
        {loading && (
          <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-sky-400 to-indigo-500 animate-pulse" />
        )}
        
        {/* ========================================================
            TOP TOOLBAR
            ======================================================== */}
        <div className="p-3 sm:p-5 border-b border-slate-200/80 bg-slate-50/70 backdrop-blur-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
            
            {/* Left: Month Dropdown Title & Navigation */}
            <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
              <div className="relative">
                <button
                  onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                  className="flex items-center gap-2 text-base sm:text-xl font-black tracking-tight px-3 py-1.5 rounded-2xl hover:bg-white/80 text-slate-900 border border-transparent hover:border-slate-200/70 transition cursor-pointer shadow-2xs hover:shadow-xs"
                >
                  <span>{monthLabel} {yearLabel}</span>
                  <span className="text-xs text-slate-400 transition-transform duration-200">▾</span>
                  {loading && (
                    <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin shrink-0" title="Syncing schedule..." />
                  )}
                </button>

                {/* Quick Month Selector Popup with Frosted Glass */}
                {isMonthPickerOpen && (
                  <div className="absolute top-full left-0 mt-2 z-50 p-4 rounded-3xl shadow-2xl border bg-white/95 backdrop-blur-2xl border-slate-200/90 text-slate-900 w-72 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-slate-100">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Select Month</span>
                      <button onClick={() => setIsMonthPickerOpen(false)} className="text-xs text-slate-400 hover:text-slate-700 p-1 rounded-lg">✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {MONTH_NAMES.map((m, idx) => (
                        <button
                          key={m}
                          onClick={() => {
                            const d = new Date(currentDate);
                            d.setMonth(idx);
                            setCurrentDate(d);
                            setIsMonthPickerOpen(false);
                          }}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            currentDate.getMonth() === idx
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'hover:bg-slate-100 text-slate-700 hover:text-slate-900'
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
                  className="px-3.5 py-1.5 text-xs font-bold rounded-xl transition active:scale-95 cursor-pointer bg-white/90 hover:bg-white text-slate-700 border border-slate-200/80 shadow-2xs hover:shadow-xs"
                >
                  Today
                </button>

                <div className="flex items-center p-0.5 rounded-xl border border-slate-200/80 bg-white/80 shadow-2xs">
                  <button
                    onClick={handlePrev}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition active:scale-95 cursor-pointer"
                    title="Previous"
                  >
                    <span className="text-sm font-bold block px-1">‹</span>
                  </button>
                  <button
                    onClick={handleNext}
                    className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition active:scale-95 cursor-pointer"
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
              <div className="flex p-1 rounded-2xl border border-slate-200/80 bg-slate-200/50 backdrop-blur-xs text-xs font-semibold overflow-x-auto shadow-inner">
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
                      className={`px-3 py-1.5 rounded-xl transition-all duration-150 cursor-pointer shrink-0 ${
                        isActive
                          ? 'bg-white text-indigo-700 shadow-xs font-black scale-[1.02]'
                          : 'text-slate-600 hover:text-slate-900 font-semibold'
                      }`}
                    >
                      {labels[mode]}
                    </button>
                  );
                })}
              </div>

              {/* Primary Action Button (Add / Book) */}
              {!isPublic && (
                onRequestBooking ? (
                  <button
                    onClick={onRequestBooking}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
                  >
                    <PlusIcon className="h-4 w-4" />
                    <span>Book Vehicle</span>
                  </button>
                ) : isAdmin ? (
                  <button
                    onClick={handleCreateNewBooking}
                    className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition active:scale-95 cursor-pointer ml-auto sm:ml-0"
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
            <div className="p-3 sm:p-4 rounded-2xl mb-3 flex items-center justify-between bg-white/90 backdrop-blur-xs border border-slate-200/80 shadow-2xs">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                  {DAY_NAMES_FULL[currentDate.getDay()]}
                </p>
                <h3 className="text-base sm:text-xl font-black text-slate-900">
                  {currentDate.getDate()} {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h3>
              </div>

              <span className="px-3.5 py-1.5 rounded-xl text-xs font-black bg-indigo-50/90 text-indigo-700 border border-indigo-200/80 shadow-2xs">
                {(() => {
                  const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                  return `${(bookingsByDay.get(key) || []).length} Scheduled Trips`;
                })()}
              </span>
            </div>

            {loading ? (
              <TimelineViewSkeleton columns={1} />
            ) : (
              /* Scrollable 24-Hour Timeline */
              <div 
                ref={timelineScrollRef}
                className="relative border border-slate-200/80 rounded-2xl overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white shadow-inner"
              >
                {(() => {
                  const key = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                  const dayBookings = bookingsByDay.get(key) || [];
                  const positionedEvents = calculateDayCollisionLayout(dayBookings, 0, 24);
                  const isDayToday = currentDate.toDateString() === currentTime.toDateString();

                  return (
                    <div className="flex relative" style={{ height: `${24 * 64}px` }}>
                      {/* Time Gutter on Left */}
                      <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200 bg-slate-50/70 relative select-none">
                        {allDayHours.map(hour => (
                          <div 
                            key={hour} 
                            className="h-[64px] border-b border-slate-100 p-2 text-right text-[10px] sm:text-xs font-mono font-bold text-slate-500"
                          >
                            {formatHourLabel(hour)}
                          </div>
                        ))}

                        {isDayToday && (
                          <div
                            style={{ top: `${currentPercent}%` }}
                            className="absolute right-0 -mt-2.5 bg-red-600 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded-l shadow-xs z-30"
                          >
                            {currentTimeLabel}
                          </div>
                        )}
                      </div>

                      {/* Event Track */}
                      <div className="flex-1 relative">
                        {allDayHours.map(hour => (
                          <div 
                            key={hour} 
                            className="h-[64px] border-b border-slate-100 hover:bg-slate-50/30 transition" 
                          />
                        ))}

                        {isDayToday && (
                          <div
                            style={{ top: `${currentPercent}%` }}
                            className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[5px]"
                          >
                            <div className="h-2.5 w-2.5 rounded-full bg-red-600 shadow-sm -ml-1.5 shrink-0" />
                            <div className="h-[2px] bg-red-500 w-full shadow-2xs" />
                          </div>
                        )}

                        {dayBookings.length === 0 && (
                          <div className="absolute inset-x-4 sm:inset-x-12 top-20 z-20 flex justify-center">
                            <div className="w-full max-w-sm p-6 rounded-3xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_12px_36px_rgba(0,0,0,0.06)] text-center animate-in fade-in zoom-in-95 duration-200">
                              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-2xs">
                                <CalendarIcon className="w-6 h-6 text-indigo-500" />
                              </div>
                              <h4 className="text-sm sm:text-base font-black text-slate-900 mb-1">
                                No Trips Scheduled For This Day
                              </h4>
                              <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                                No vehicle reservations recorded for this date.
                              </p>
                              <div className="flex items-center justify-center gap-2">
                                {(driverFilter !== 'all' || searchQuery) && (
                                  <button
                                    onClick={() => { setDriverFilter('all'); setSearchQuery(''); }}
                                    className="px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200/90 bg-white hover:bg-slate-50 text-slate-700 transition cursor-pointer shadow-2xs"
                                  >
                                    Reset Filters
                                  </button>
                                )}
                                {!isPublic && (
                                  <button
                                    onClick={onRequestBooking || handleCreateNewBooking}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer flex items-center gap-1.5"
                                  >
                                    <PlusIcon className="w-3.5 h-3.5" />
                                    <span>Book Vehicle</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {positionedEvents.map(item => {
                          const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                          const dName = getDriverName(booking.driverId);
                          const colWidthPercent = 100 / totalCols;
                          const leftPercent = colIndex * colWidthPercent;

                          return (
                            <TimelineEventCard
                              key={booking.id}
                              booking={booking}
                              topPercent={topPercent}
                              heightPercent={heightPercent}
                              leftPercent={leftPercent}
                              colWidthPercent={colWidthPercent}
                              driverName={dName}
                              onClick={() => handleSelectBooking(booking.id)}
                              variant="day"
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ========================================================
            VIEW 2: 3-DAYS VIEW (Google Calendar Continuous Matrix)
            ======================================================== */}
        {viewMode === '3days' && (
          <div className="p-3 sm:p-5">
            {loading ? (
              <TimelineViewSkeleton columns={3} />
            ) : (
              <div className="border border-slate-200/80 rounded-2xl overflow-x-auto bg-white shadow-xs">
                <div className="min-w-[640px]">
                  {/* 3 Days Column Headers */}
                  <div className="flex border-b border-slate-200/80 bg-slate-50/90 sticky top-0 z-30 backdrop-blur-xs">
                    <div className="w-14 sm:w-16 shrink-0 py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200/80">
                      Time
                    </div>

                    <div className="flex-1 grid grid-cols-3 divide-x divide-slate-200/80">
                      {threeDays.map(({ date, isToday }) => (
                        <div
                          key={date.toISOString()}
                          onClick={() => {
                            setCurrentDate(date);
                            setViewMode('day');
                          }}
                          className={`py-2 px-1 text-center transition cursor-pointer hover:bg-slate-100/80 ${
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
                      <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200/80 bg-slate-50/70 relative select-none">
                        {allDayHours.map(hour => (
                          <div
                            key={hour}
                            className="h-[64px] border-b border-slate-100 text-[10px] font-mono font-bold text-center pt-1 text-slate-400"
                          >
                            {formatHourLabel(hour)}
                          </div>
                        ))}
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
                        {threeDays.every(d => (bookingsByDay.get(d.dateKey) || []).length === 0) && (
                          <div className="absolute inset-x-8 top-20 z-20 flex justify-center pointer-events-none">
                            <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] text-center max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
                              <CalendarIcon className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                              <h5 className="text-xs sm:text-sm font-black text-slate-900">No Trips In This 3-Day Window</h5>
                              <p className="text-[11px] text-slate-500 mt-0.5 mb-3">No vehicle bookings recorded across these 3 days.</p>
                              {!isPublic && (
                                <button
                                  onClick={onRequestBooking || handleCreateNewBooking}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <PlusIcon className="w-3.5 h-3.5" />
                                  <span>Book Vehicle</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {threeDays.map(({ dateKey, isToday }, idx) => {
                          const dayBookings = bookingsByDay.get(dateKey) || [];
                          const positioned = calculateDayCollisionLayout(dayBookings, 0, 24);

                          return (
                            <div
                              key={idx}
                              className={`relative h-full transition hover:bg-slate-50/20 ${
                                isToday ? 'bg-indigo-50/15' : ''
                              }`}
                            >
                              {allDayHours.map(hour => (
                                <div
                                  key={hour}
                                  className="h-[64px] border-b border-slate-100"
                                />
                              ))}

                              {isToday && (
                                <div
                                  style={{ top: `${currentPercent}%` }}
                                  className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[4px]"
                                >
                                  <div className="h-2 w-2 rounded-full bg-red-600 shadow-sm -ml-1 shrink-0" />
                                  <div className="h-[2px] bg-red-500 w-full" />
                                </div>
                              )}

                              {positioned.map(item => {
                                const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                                const dName = getDriverName(booking.driverId);
                                const colWidthPercent = 100 / totalCols;
                                const leftPercent = colIndex * colWidthPercent;

                                return (
                                  <TimelineEventCard
                                    key={booking.id}
                                    booking={booking}
                                    topPercent={topPercent}
                                    heightPercent={heightPercent}
                                    leftPercent={leftPercent}
                                    colWidthPercent={colWidthPercent}
                                    driverName={dName}
                                    onClick={() => handleSelectBooking(booking.id)}
                                    variant="3days"
                                  />
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
            )}
          </div>
        )}

        {/* ========================================================
            VIEW 3: 7-DAYS WEEK VIEW (Google Calendar Continuous Grid)
            ======================================================== */}
        {viewMode === 'week' && (
          <div className="p-3 sm:p-5">
            {loading ? (
              <TimelineViewSkeleton columns={7} />
            ) : (
              <div className="border border-slate-200/80 rounded-2xl overflow-x-auto bg-white shadow-xs">
                <div className="min-w-[840px]">
                  {/* 7 Days Header */}
                  <div className="flex border-b border-slate-200/80 bg-slate-50/90 sticky top-0 z-30 backdrop-blur-xs">
                    <div className="w-14 sm:w-16 shrink-0 py-2.5 px-2 text-center text-[10px] font-bold uppercase text-slate-400 border-r border-slate-200/80 bg-slate-50">
                      Time
                    </div>

                    <div className="flex-1 grid grid-cols-7 divide-x divide-slate-200/80">
                      {weekDays.map(({ date, isToday }) => (
                        <div
                          key={date.toISOString()}
                          onClick={() => {
                            setCurrentDate(date);
                            setViewMode('day');
                          }}
                          className={`py-2 px-1 text-center transition cursor-pointer hover:bg-slate-100/80 ${
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

                  {/* 7-Days Continuous Scrollable Grid */}
                  <div 
                    ref={timelineScrollRef}
                    className="overflow-y-auto max-h-[640px] sm:max-h-[720px] bg-white relative"
                  >
                    <div className="flex relative" style={{ height: `${24 * 64}px` }}>
                      {/* Time Gutter on Left */}
                      <div className="w-14 sm:w-16 shrink-0 border-r border-slate-200/80 bg-slate-50/70 relative select-none">
                        {allDayHours.map(hour => (
                          <div
                            key={hour}
                            className="h-[64px] border-b border-slate-100 text-[10px] font-mono font-bold text-center pt-1 text-slate-400"
                          >
                            {formatHourLabel(hour)}
                          </div>
                        ))}
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
                        {weekDays.every(d => (bookingsByDay.get(d.dateKey) || []).length === 0) && (
                          <div className="absolute inset-x-8 top-20 z-20 flex justify-center pointer-events-none">
                            <div className="p-5 rounded-2xl bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] text-center max-w-sm pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
                              <CalendarIcon className="w-8 h-8 text-indigo-500 mx-auto mb-2" />
                              <h5 className="text-xs sm:text-sm font-black text-slate-900">No Trips Scheduled This Week</h5>
                              <p className="text-[11px] text-slate-500 mt-0.5 mb-3">No vehicle bookings recorded for this 7-day period.</p>
                              {!isPublic && (
                                <button
                                  onClick={onRequestBooking || handleCreateNewBooking}
                                  className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
                                >
                                  <PlusIcon className="w-3.5 h-3.5" />
                                  <span>Book Vehicle</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                        {weekDays.map(({ dateKey, isToday }, idx) => {
                          const dayBookings = bookingsByDay.get(dateKey) || [];
                          const positioned = calculateDayCollisionLayout(dayBookings, 0, 24);

                          return (
                            <div
                              key={idx}
                              className={`relative h-full transition hover:bg-slate-50/20 ${
                                isToday ? 'bg-indigo-50/15' : ''
                              }`}
                            >
                              {allDayHours.map(hour => (
                                <div
                                  key={hour}
                                  className="h-[64px] border-b border-slate-100"
                                />
                              ))}

                              {isToday && (
                                <div
                                  style={{ top: `${currentPercent}%` }}
                                  className="absolute left-0 right-0 z-40 pointer-events-none flex items-center -mt-[4px]"
                                >
                                  <div className="h-2 w-2 rounded-full bg-red-600 shadow-sm -ml-1 shrink-0" />
                                  <div className="h-[2px] bg-red-500 w-full" />
                                </div>
                              )}

                              {positioned.map(item => {
                                const { booking, topPercent, heightPercent, colIndex, totalCols } = item;
                                const dName = getDriverName(booking.driverId);
                                const colWidthPercent = 100 / totalCols;
                                const leftPercent = colIndex * colWidthPercent;

                                return (
                                  <TimelineEventCard
                                    key={booking.id}
                                    booking={booking}
                                    topPercent={topPercent}
                                    heightPercent={heightPercent}
                                    leftPercent={leftPercent}
                                    colWidthPercent={colWidthPercent}
                                    driverName={dName}
                                    onClick={() => handleSelectBooking(booking.id)}
                                    variant="week"
                                  />
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
            )}
          </div>
        )}

        {/* ========================================================
            VIEW 4: MONTH VIEW (Clean Armada Flow Design)
            ======================================================== */}
        {viewMode === 'month' && (
          <div className="overflow-x-auto">
            {loading ? (
              <MonthViewSkeleton />
            ) : (
              <div className="min-w-[320px]">
                {/* Day-of-week Headers */}
                <div className="grid grid-cols-7 border-b border-slate-200/80 text-center bg-slate-50/90 backdrop-blur-xs">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(name => (
                    <div key={name} className="py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500">
                      {name}
                    </div>
                  ))}
                </div>

                {filteredBookings.length === 0 && (
                  <div className="p-3 mx-3 my-2 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs shadow-2xs animate-in fade-in duration-150">
                    <div className="flex items-center gap-2 text-indigo-900 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                      <span>No vehicle reservations found matching your current filter in this month.</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(driverFilter !== 'all' || searchQuery) && (
                        <button
                          onClick={() => { setDriverFilter('all'); setSearchQuery(''); }}
                          className="px-2.5 py-1 rounded-lg text-xs font-bold bg-white text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition cursor-pointer shadow-2xs"
                        >
                          Reset Filters
                        </button>
                      )}
                      {!isPublic && (
                        <button
                          onClick={onRequestBooking || handleCreateNewBooking}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition cursor-pointer shadow-2xs flex items-center gap-1"
                        >
                          <PlusIcon className="w-3 h-3" />
                          <span>Book Trip</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 7x6 Matrix Grid */}
                <div className="grid grid-cols-7 border-b border-slate-200/80 gap-px bg-slate-200/80">
                  {calendarGrid.map(({ date, dateKey, isCurrentMonth, isToday }, idx) => {
                    const dayBookings = bookingsByDay.get(dateKey) || [];

                    return (
                      <div
                        key={idx}
                        onClick={() => {
                          setCurrentDate(date);
                          setViewMode('day');
                        }}
                        className={`relative p-1.5 sm:p-2 min-h-[95px] sm:min-h-[120px] transition cursor-pointer ${
                          isCurrentMonth 
                            ? (isToday ? 'bg-indigo-50/60 ring-1.5 ring-indigo-500 ring-inset' : 'bg-white hover:bg-slate-50/80') 
                            : 'bg-slate-50/60 opacity-60'
                        }`}
                      >
                        {/* Date Header */}
                        <div className="flex items-center justify-between mb-1.5">
                          <span
                            className={`text-xs font-bold h-6 w-6 flex items-center justify-center rounded-full transition ${
                              isToday
                                ? 'bg-indigo-600 text-white font-black shadow-xs'
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

                            return (
                              <button
                                key={b.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectBooking(b.id);
                                }}
                                className={`w-full text-left px-2 py-1 rounded-lg text-[10px] leading-tight truncate border transition-all duration-150 cursor-pointer font-bold ${style.monthChip}`}
                                title={`${b.requesterName} → ${b.destination} (${dName})`}
                              >
                                <span className="opacity-75">
                                  {b.serviceType === 'Self-Drive' ? '[Self]' : `(${dName.split(' ')[0]})`}
                                </span>{' '}
                                <span className="text-slate-900">{b.destination || b.requesterName}</span>
                              </button>
                            );
                          })}

                          {dayBookings.length > 3 && (
                            <div className="text-[10px] font-black text-indigo-600 pl-1 pt-0.5">
                              +{dayBookings.length - 3} more
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

        {/* ========================================================
            VIEW 5: SCHEDULE / AGENDA LIST VIEW
            ======================================================== */}
        {viewMode === 'schedule' && (
          <div className="p-3 sm:p-5 space-y-4">
            {loading ? (
              <ScheduleViewSkeleton />
            ) : Array.from(bookingsByDay.entries()).length === 0 ? (
              <CalendarEmptyState
                title="No Scheduled Trips Found"
                description={searchQuery || driverFilter !== 'all' ? "No bookings match your current search or driver filter." : "There are no vehicle bookings scheduled for this period."}
                onResetFilter={searchQuery || driverFilter !== 'all' ? () => { setSearchQuery(''); setDriverFilter('all'); } : undefined}
                onAction={!isPublic ? (onRequestBooking || handleCreateNewBooking) : undefined}
                actionLabel={onRequestBooking ? "Book Vehicle" : "Add Booking"}
              />
            ) : (
              Array.from(bookingsByDay.entries()).map(([dateKey, list]) => {
                const dateObj = new Date(dateKey);
                return (
                  <div key={dateKey} className="space-y-2.5">
                    <div className="flex items-center gap-2 pt-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-600" />
                      <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700">
                        {DAY_NAMES_FULL[dateObj.getDay()]}, {dateObj.getDate()} {MONTH_NAMES[dateObj.getMonth()]} {dateObj.getFullYear()}
                      </h4>
                      <span className="text-xs text-slate-400">({list.length} {list.length === 1 ? 'trip' : 'trips'})</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {list.map(b => {
                        const dName = getDriverName(b.driverId);
                        const style = getEventCardStyle(b, dName);
                        const startDt = parseAsLocal(b.dateTime);

                        return (
                          <div
                            key={b.id}
                            onClick={() => handleSelectBooking(b.id)}
                            className={`p-3.5 rounded-2xl border shadow-2xs cursor-pointer transition-all duration-150 hover:shadow-xs hover:scale-[1.005] ${style.bg} ${style.border} ${style.text}`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-mono text-xs font-bold bg-white/90 border border-slate-200/80 px-2 py-0.5 rounded-md text-slate-700 shadow-2xs">
                                {startDt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                              </span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${style.badge}`}>
                                {b.serviceType === 'Self-Drive' ? 'Self-Drive' : dName}
                              </span>
                            </div>

                            <p className="font-black text-sm mt-2 text-slate-900">{b.destination}</p>
                            <p className="text-xs text-slate-600 mt-0.5 font-medium">
                              {b.requesterName} {b.department ? `· ${b.department}` : ''}
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
