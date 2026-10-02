import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { DriverSchedule } from '../types';
import { XIcon, TrashIcon, PlusIcon, CalendarIcon, ClockIcon } from './icons/Icons';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DRIVER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-900', dot: 'bg-blue-500', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-900', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { bg: 'bg-amber-100', text: 'text-amber-900', dot: 'bg-amber-500', ring: 'ring-amber-400' },
  { bg: 'bg-purple-100', text: 'text-purple-900', dot: 'bg-purple-500', ring: 'ring-purple-400' },
  { bg: 'bg-pink-100', text: 'text-pink-900', dot: 'bg-pink-500', ring: 'ring-pink-400' },
  { bg: 'bg-cyan-100', text: 'text-cyan-900', dot: 'bg-cyan-500', ring: 'ring-cyan-400' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const toTimeHHMM = (raw: string) => {
  if (!raw) return '';
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;
  const match = raw.match(/T(\d{2}):(\d{2})/);
  if (match) return `${match[1]}:${match[2]}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
  }
  return raw;
};

const toTime12H = (raw: string) => {
  if (!raw) return '';
  let hhmm = '';
  if (/^\d{1,2}:\d{2}$/.test(raw)) {
    hhmm = raw;
  } else {
    const match = raw.match(/T(\d{2}):(\d{2})/);
    if (match) {
      hhmm = `${match[1]}:${match[2]}`;
    } else {
      const d = new Date(raw);
      if (!isNaN(d.getTime())) {
        hhmm = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
      } else {
        hhmm = raw;
      }
    }
  }

  const parts = hhmm.split(':');
  if (parts.length === 2) {
    let h = Number(parts[0]);
    const m = parts[1];
    if (!isNaN(h)) {
      const ampm = h >= 12 ? 'pm' : 'am';
      h = h % 12;
      if (h === 0) h = 12;
      return `${h}:${m}${ampm}`;
    }
  }
  return raw;
};

const parseDateKeyLoose = (raw: string) => {
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return `${dmy[3]}-${pad2(Number(dmy[2]))}-${pad2(Number(dmy[1]))}`;
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return toDateKey(d);
  return raw;
};

const buildMonthGrid = (anchor: Date): Date[] => {
  const firstOfMonth = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startOffset = firstOfMonth.getDay();
  const gridStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1 - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
};

const buildWeekGrid = (anchor: Date): Date[] => {
  const startOffset = anchor.getDay();
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - startOffset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
};

type ModalState =
  | { mode: 'add'; dates: string[] }
  | { mode: 'edit'; schedule: DriverSchedule }
  | { mode: 'dayDetail'; dateKey: string; daySchedules: DriverSchedule[] }
  | { mode: 'bulkDelete'; dates: string[] }
  | null;

interface DriverScheduleManagerProps {
  readOnly?: boolean;
}

const DriverScheduleManager: React.FC<DriverScheduleManagerProps> = ({ readOnly = false }) => {
  const { users, driverSchedules, addDriverSchedule, updateDriverSchedule, deleteDriverSchedule, deleteDriverSchedulesBulk, currentUser } = useAppContext();
  
  const isEditable = !readOnly && currentUser?.role === 'admin';

  const drivers = useMemo(
    () => users.filter(u => (u.role === 'driver' || u.id === 'driver-aziz') && u.status === 'active'),
    [users]
  );
  const colorForDriver = (driverId: string) => {
    const idx = drivers.findIndex(d => d.id === driverId);
    return DRIVER_COLORS[idx >= 0 ? idx % DRIVER_COLORS.length : 0];
  };
  const driverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || 'Unknown Driver';

  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<ModalState>(null);

  const schedulesByDate = useMemo(() => {
    const map = new Map<string, DriverSchedule[]>();
    driverSchedules.forEach(s => {
      const key = parseDateKeyLoose(s.Date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    });
    return map;
  }, [driverSchedules]);

  const todayKey = toDateKey(new Date());
  const gridDays = viewMode === 'month' ? buildMonthGrid(anchor) : buildWeekGrid(anchor);

  const goPrev = () => {
    const d = new Date(anchor);
    if (viewMode === 'month') d.setMonth(d.getMonth() - 1);
    else d.setDate(d.getDate() - 7);
    setAnchor(d);
  };
  const goNext = () => {
    const d = new Date(anchor);
    if (viewMode === 'month') d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 7);
    setAnchor(d);
  };
  const goToday = () => setAnchor(new Date());

  const toggleBulkMode = () => {
    setBulkMode(prev => !prev);
    setSelectedDates(new Set());
  };

  const handleDayClick = (dateKey: string, daySchedules: DriverSchedule[]) => {
    if (bulkMode) {
      if (!isEditable) return;
      setSelectedDates(prev => {
        const next = new Set(prev);
        if (next.has(dateKey)) next.delete(dateKey);
        else next.add(dateKey);
        return next;
      });
    } else {
      setModal({ mode: 'dayDetail', dateKey, daySchedules });
    }
  };

  const openBulkAddModal = () => {
    if (!isEditable || selectedDates.size === 0) return;
    setModal({ mode: 'add', dates: Array.from(selectedDates).sort() });
  };

  const closeModal = () => {
    setModal(null);
    setSelectedDates(new Set());
    setBulkMode(false);
  };

  return (
    <div className="space-y-3 sm:space-y-5">
      {/* Top Header Card — more compact on mobile */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-xs border border-gray-200">
        <div className="min-w-0">
          <h2 className="text-base sm:text-xl font-bold text-gray-900 leading-tight">Driver Shift & Duty Roster</h2>
          <p className="text-gray-500 mt-0.5 text-[11px] sm:text-sm leading-snug">
            {isEditable 
              ? 'Tap any date to view or assign shifts.' 
              : 'Read-only shift & duty overview.'}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="bg-white border border-gray-300 rounded-lg overflow-hidden flex text-xs font-semibold shadow-xs flex-1 sm:flex-none">
            <button
              onClick={() => setViewMode('month')}
              className={`flex-1 sm:flex-none px-3 py-1.5 transition cursor-pointer ${viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >Month</button>
            <button
              onClick={() => setViewMode('week')}
              className={`flex-1 sm:flex-none px-3 py-1.5 border-l border-gray-300 transition cursor-pointer ${viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >Week</button>
          </div>
          {isEditable && (
            <button
              onClick={toggleBulkMode}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium border transition cursor-pointer whitespace-nowrap ${bulkMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
            >
              {bulkMode ? 'Cancel' : 'Multi-Select'}
            </button>
          )}
        </div>
      </div>

      {/* Calendar Navigation Bar — tighter */}
      <div className="bg-white rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-xs border border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5">
            <button onClick={goPrev} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer text-gray-700 font-bold text-sm">&larr;</button>
            <button onClick={goToday} className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-[11px] font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer">Today</button>
            <button onClick={goNext} className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition cursor-pointer text-gray-700 font-bold text-sm">&rarr;</button>
          </div>
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 text-right sm:text-left sm:ml-2">
            {viewMode === 'month' 
              ? `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}` 
              : `Week of ${gridDays[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${gridDays[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
          </h3>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500 self-start sm:self-auto">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-600 inline-block"></span> Today</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span> Active</span>
        </div>
      </div>

      {/* ========== WEEK VIEW: Vertical Day Cards (mobile-first) ========== */}
      {viewMode === 'week' ? (
        <div className="space-y-2.5">
          {gridDays.map(date => {
            const dateKey = toDateKey(date);
            const daySchedules = (schedulesByDate.get(dateKey) || []).sort((a, b) => toTimeHHMM(a.Mula).localeCompare(toTimeHHMM(b.Mula)));
            const isToday = dateKey === todayKey;
            const isSelected = selectedDates.has(dateKey);
            const dayLabel = date.toLocaleDateString('en-US', { weekday: 'short' });
            const fullDateLabel = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

            return (
              <div
                key={dateKey}
                onClick={() => handleDayClick(dateKey, daySchedules)}
                className={`bg-white rounded-xl border shadow-xs overflow-hidden transition cursor-pointer active:scale-[0.99] ${
                  isSelected
                    ? 'ring-2 ring-indigo-500 border-indigo-400 bg-indigo-50/40'
                    : isToday
                      ? 'border-indigo-300 ring-1 ring-indigo-200'
                      : 'border-gray-200 hover:border-indigo-200'
                }`}
              >
                {/* Day header */}
                <div className={`px-3.5 py-2.5 flex items-center justify-between border-b ${
                  isToday ? 'bg-indigo-50 border-indigo-100' : 'bg-gray-50/80 border-gray-100'
                }`}>
                  <div className="flex items-center gap-2.5">
                    <span className={`h-8 w-8 flex items-center justify-center rounded-full text-sm font-extrabold ${
                      isToday ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-gray-800 border border-gray-200'
                    }`}>
                      {date.getDate()}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className={`text-sm font-extrabold ${isToday ? 'text-indigo-900' : 'text-gray-900'}`}>
                          {dayLabel}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-600 text-white px-1.5 py-0.5 rounded">Today</span>
                        )}
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">{fullDateLabel}</span>
                    </div>
                  </div>
                  {daySchedules.length > 0 ? (
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                      {daySchedules.length} shift{daySchedules.length > 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-gray-400">No shifts</span>
                  )}
                </div>

                {/* Shifts list */}
                {daySchedules.length > 0 ? (
                  <div className="p-2.5 space-y-1.5">
                    {daySchedules.map(sched => {
                      const color = colorForDriver(sched.DriverId);
                      const dName = driverName(sched.DriverId);
                      return (
                        <div
                          key={sched.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setModal({ mode: 'dayDetail', dateKey, daySchedules });
                          }}
                          className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg ${color.bg} ${color.text} border border-black/5`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-extrabold text-xs truncate">{dName}</div>
                            <div className="text-[11px] font-semibold opacity-90 font-mono mt-0.5">
                              {toTime12H(sched.Mula)} – {toTime12H(sched.Tamat)}
                            </div>
                          </div>
                          <span className={`w-2 h-2 rounded-full shrink-0 ${color.dot}`}></span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="px-3.5 py-3 text-center text-[11px] text-gray-400 font-medium">
                    Tap to assign shift
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ========== MONTH VIEW: Compact Grid ========== */
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {WEEKDAY_LABELS.map(label => (
              <div key={label} className="py-1.5 sm:py-2.5 text-center text-[9px] sm:text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {gridDays.map(date => {
              const dateKey = toDateKey(date);
              const daySchedules = (schedulesByDate.get(dateKey) || []).sort((a, b) => toTimeHHMM(a.Mula).localeCompare(toTimeHHMM(b.Mula)));
              const isToday = dateKey === todayKey;
              const isCurrentMonth = date.getMonth() === anchor.getMonth();
              const isSelected = selectedDates.has(dateKey);
              // Mobile: show max 1 chip + "+N", Desktop: show up to 3
              const visibleSchedules = daySchedules.slice(0, 2);
              const hiddenCount = daySchedules.length - visibleSchedules.length;

              return (
                <div
                  key={dateKey}
                  onClick={() => handleDayClick(dateKey, daySchedules)}
                  className={`relative border-b border-r border-gray-100 p-1 sm:p-1.5 transition min-h-[4.5rem] sm:min-h-[7.5rem] ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50/70'
                  } cursor-pointer hover:bg-indigo-50/30 active:bg-indigo-50/50 ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50' : ''}`}
                  title="Tap to view shifts"
                >
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span className={`text-[10px] sm:text-xs font-extrabold h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center rounded-full ${
                      isToday ? 'bg-indigo-600 text-white shadow-xs' : isCurrentMonth ? 'text-gray-900 bg-gray-100' : 'text-gray-400'
                    }`}>
                      {date.getDate()}
                    </span>
                    {daySchedules.length > 0 && (
                      <span className="text-[8px] sm:text-[10px] font-bold px-1 sm:px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 leading-none">
                        {daySchedules.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-0.5">
                    {visibleSchedules.map(sched => {
                      const color = colorForDriver(sched.DriverId);
                      const dName = driverName(sched.DriverId);
                      const shortName = dName.includes(' ') ? dName.split(' ')[0] : dName;
                      return (
                        <div
                          key={sched.id}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setModal({ mode: 'dayDetail', dateKey, daySchedules }); 
                          }}
                          className={`w-full text-left text-[9px] sm:text-[11px] leading-tight px-1 sm:px-1.5 py-0.5 sm:py-1 rounded ${color.bg} ${color.text} border border-black/5 shadow-2xs hover:opacity-90 transition cursor-pointer`}
                          title={`${dName}: ${toTime12H(sched.Mula)} - ${toTime12H(sched.Tamat)}`}
                        >
                          <div className="font-extrabold truncate">{shortName}</div>
                          <div className="text-[8px] sm:text-[10px] font-semibold opacity-90 font-mono hidden sm:block">
                            {toTime12H(sched.Mula)}-{toTime12H(sched.Tamat)}
                          </div>
                        </div>
                      );
                    })}
                    {hiddenCount > 0 && (
                      <div className="text-[8px] sm:text-[10px] text-indigo-600 font-extrabold px-0.5 text-center bg-indigo-50/60 rounded py-0.5">
                        +{hiddenCount}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Floating bulk action bar */}
      {bulkMode && selectedDates.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full shadow-lg px-4 py-2.5 flex items-center gap-3 z-40 animate-fadeIn max-w-[95vw]">
          <span className="text-xs font-medium whitespace-nowrap">{selectedDates.size} selected</span>
          <button onClick={openBulkAddModal} className="bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition cursor-pointer">
            Set Shifts
          </button>
          <button
            type="button"
            onClick={() => {
              setModal({ mode: 'bulkDelete', dates: Array.from(selectedDates) });
            }}
            className="bg-red-600 hover:bg-red-500 text-white text-xs font-semibold px-3 py-1.5 rounded-full transition cursor-pointer"
          >
            Delete
          </button>
          <button onClick={() => setSelectedDates(new Set())} className="text-gray-300 hover:text-white text-xs cursor-pointer">
            Clear
          </button>
        </div>
      )}

      {modal && (
        <ScheduleModal
          modal={modal}
          drivers={drivers}
          isEditable={isEditable}
          onClose={closeModal}
          onSave={(entries) => {
            if (!isEditable) return;
            entries.forEach(({ date, driverId, mula, tamat }) => {
              const existing = (schedulesByDate.get(date) || []).find(s => s.DriverId === driverId);
              if (existing) {
                updateDriverSchedule(existing.id, { Mula: mula, Tamat: tamat });
              } else {
                addDriverSchedule({ Date: date, DriverId: driverId, Mula: mula, Tamat: tamat });
              }
            });
            closeModal();
          }}
          onUpdate={(schedId, mula, tamat) => {
            if (!isEditable) return;
            updateDriverSchedule(schedId, { Mula: mula, Tamat: tamat });
            closeModal();
          }}
          onDelete={(schedId) => {
            if (!isEditable) return;
            deleteDriverSchedule(schedId);
            closeModal();
          }}
          onOpenAddForDate={(dateKey) => {
            if (!isEditable) return;
            setModal({ mode: 'add', dates: [dateKey] });
          }}
          onOpenEditForSchedule={(sched) => {
            if (!isEditable) return;
            setModal({ mode: 'edit', schedule: sched });
          }}
          onDeleteBulk={(driverId, dates) => {
            if (!isEditable) return;
            const schedIdsToDelete = driverSchedules
              .filter(s => {
                const isMatchingDate = dates.includes(parseDateKeyLoose(s.Date));
                if (!isMatchingDate) return false;
                if (driverId === 'all') return true;
                return s.DriverId === driverId;
              })
              .map(s => s.id);

            if (schedIdsToDelete.length === 0) {
              alert("No driver schedules match your selection.");
              return;
            }

            const label = driverId === 'all' ? 'all drivers' : `driver ${drivers.find(d => d.id === driverId)?.name || ''}`;
            if (window.confirm(`Are you sure you want to delete shifts for ${label} (${schedIdsToDelete.length} shifts) across the selected dates?`)) {
              deleteDriverSchedulesBulk(schedIdsToDelete);
              setSelectedDates(new Set());
              setBulkMode(false);
              closeModal();
            }
          }}
        />
      )}
    </div>
  );
};

interface ScheduleModalProps {
  modal: ModalState;
  drivers: { id: string; name: string }[];
  isEditable: boolean;
  onClose: () => void;
  onSave: (entries: { date: string; driverId: string; mula: string; tamat: string }[]) => void;
  onUpdate: (schedId: string, mula: string, tamat: string) => void;
  onDelete: (schedId: string) => void;
  onOpenAddForDate?: (dateKey: string) => void;
  onOpenEditForSchedule?: (sched: DriverSchedule) => void;
  onDeleteBulk?: (driverId: string | 'all', dates: string[]) => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ 
  modal, 
  drivers, 
  isEditable,
  onClose, 
  onSave, 
  onUpdate, 
  onDelete, 
  onOpenAddForDate,
  onOpenEditForSchedule,
  onDeleteBulk 
}) => {
  const isEdit = modal?.mode === 'edit';
  const editSchedule = isEdit && modal?.mode === 'edit' ? modal.schedule : null;

  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(
    new Set(editSchedule ? [editSchedule.DriverId] : [])
  );
  const [mula, setMula] = useState(toTimeHHMM(editSchedule?.Mula || '') || '09:00');
  const [tamat, setTamat] = useState(toTimeHHMM(editSchedule?.Tamat || '') || '17:00');
  const [targetDriverId, setTargetDriverId] = useState<string>('all');

  if (!modal) return null;

  const isBulkDelete = modal.mode === 'bulkDelete';
  const isDayDetail = modal.mode === 'dayDetail';

  const toggleDriver = (id: string) => {
    if (!isEditable) return;
    setSelectedDriverIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditable) return;
    if (isBulkDelete) {
      if (onDeleteBulk) onDeleteBulk(targetDriverId, modal.dates);
      return;
    }
    if (!mula || !tamat) {
      alert('Please fill in start and end times.');
      return;
    }
    if (isEdit && editSchedule) {
      onUpdate(editSchedule.id, mula, tamat);
      return;
    }
    if (modal.mode === 'add') {
      if (selectedDriverIds.size === 0) {
        alert('Please select at least one driver.');
        return;
      }
      const entries = modal.dates.flatMap(date =>
        Array.from(selectedDriverIds).map(driverId => ({ date, driverId, mula, tamat }))
      );
      onSave(entries);
    }
  };

  const formatDateLabel = (dateKey: string) => {
    const d = new Date(dateKey + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  // DAY DETAIL MODAL
  if (isDayDetail) {
    const { dateKey, daySchedules } = modal;
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 backdrop-blur-xs">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-4 sm:p-5 border-b bg-gray-50">
            <div>
              <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
                Shift Roster Details
              </h3>
              <p className="text-xs text-indigo-600 font-bold mt-0.5">
                {formatDateLabel(dateKey)}
              </p>
            </div>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
            {daySchedules.length > 0 ? (
              <div className="space-y-2.5">
                <label className="block text-xs font-bold uppercase text-gray-400">Scheduled Drivers ({daySchedules.length})</label>
                {daySchedules.map(sched => {
                  const dName = drivers.find(d => d.id === sched.DriverId)?.name || 'Unknown Driver';
                  return (
                    <div key={sched.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">{dName}</h4>
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-bold mt-0.5">
                          <ClockIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>{toTime12H(sched.Mula)} - {toTime12H(sched.Tamat)}</span>
                        </div>
                      </div>
                      {isEditable && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              if (onOpenEditForSchedule) onOpenEditForSchedule(sched);
                            }}
                            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete shift for ${dName}?`)) {
                                onDelete(sched.id);
                              }
                            }}
                            className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-xs font-bold text-gray-500">No driver shifts scheduled for this date.</p>
              </div>
            )}

            {isEditable && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAddForDate) onOpenAddForDate(dateKey);
                  }}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Assign New Shift on This Date</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (isBulkDelete) {
    return (
      <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 backdrop-blur-xs">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          <div className="flex justify-between items-center p-4 sm:p-5 border-b bg-gray-50">
            <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
              Bulk Delete Shifts ({modal.dates.length} Dates)
            </h3>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Selected Dates</label>
              <div className="max-h-24 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-600 space-y-0.5">
                {modal.dates.map(d => <div key={d}>{formatDateLabel(d)}</div>)}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Select Driver to Delete</label>
              <select
                value={targetDriverId}
                onChange={(e) => setTargetDriverId(e.target.value)}
                className="block w-full border-gray-300 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="all">All Drivers (Delete All)</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500">
                Choose a specific driver or "All Drivers" to remove shifts.
              </p>
            </div>

            <div className="pt-4 flex items-center justify-end gap-3 border-t">
              <button type="button" onClick={onClose} className="bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md text-xs transition cursor-pointer">
                Confirm Delete
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-end sm:items-center p-0 sm:p-4 backdrop-blur-xs">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-5 border-b bg-gray-50">
          <h3 className="text-base sm:text-lg font-extrabold text-gray-900 tracking-tight">
            {isEdit ? 'Edit Shift' : modal.mode === 'add' && modal.dates.length > 1 ? `Set Shifts (${modal.dates.length} Dates)` : 'Add Shift'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer"><XIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-4 sm:p-6 space-y-4">
          {modal.mode === 'add' && (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Date</label>
              <div className="max-h-24 overflow-y-auto bg-gray-50 border border-gray-200 rounded-xl p-2.5 text-xs text-gray-600 space-y-0.5">
                {modal.dates.map(d => <div key={d}>{formatDateLabel(d)}</div>)}
              </div>
            </div>
          )}

          {isEdit && editSchedule ? (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Driver</label>
              <div className="text-sm bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 font-bold text-gray-800">
                {drivers.find(d => d.id === editSchedule.DriverId)?.name || 'Unknown Driver'}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Driver(s)</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50">
                {drivers.length === 0 && <p className="text-xs text-gray-400">No active drivers available.</p>}
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center gap-2.5 text-xs font-bold text-gray-800 cursor-pointer p-1.5 rounded-lg hover:bg-white transition">
                    <input
                      type="checkbox"
                      checked={selectedDriverIds.has(d.id)}
                      onChange={() => toggleDriver(d.id)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded cursor-pointer"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Start Time</label>
              <input type="time" value={mula} onChange={e => setMula(e.target.value)} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">End Time</label>
              <input type="time" value={tamat} onChange={e => setTamat(e.target.value)} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500"/>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between border-t">
            {isEdit && editSchedule && isEditable ? (
              <button
                type="button"
                onClick={() => onDelete(editSchedule.id)}
                className="flex items-center text-xs font-bold text-red-600 hover:text-red-800 cursor-pointer"
              >
                <TrashIcon className="h-4 w-4 mr-1" /> Delete Shift
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
              {isEditable && (
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md text-xs transition cursor-pointer">
                  {isEdit ? 'Save Changes' : 'Assign Shifts'}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverScheduleManager;
