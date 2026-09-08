import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { DriverSchedule } from '../types';
import { XIcon, TrashIcon, PlusIcon } from './icons/Icons';

const WEEKDAY_LABELS = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const MONTH_LABELS = [
  'Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun',
  'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'
];

const DRIVER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', dot: 'bg-blue-500', ring: 'ring-blue-400' },
  { bg: 'bg-emerald-100', text: 'text-emerald-800', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  { bg: 'bg-amber-100', text: 'text-amber-800', dot: 'bg-amber-500', ring: 'ring-amber-400' },
  { bg: 'bg-purple-100', text: 'text-purple-800', dot: 'bg-purple-500', ring: 'ring-purple-400' },
  { bg: 'bg-pink-100', text: 'text-pink-800', dot: 'bg-pink-500', ring: 'ring-pink-400' },
  { bg: 'bg-cyan-100', text: 'text-cyan-800', dot: 'bg-cyan-500', ring: 'ring-cyan-400' },
];

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const parseDateKeyLoose = (raw: string) => {
  // Handle 'yyyy-MM-dd', full ISO string, atau 'dd/MM/yyyy' — semua di-normalize ke 'yyyy-MM-dd'
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
  | null;

const DriverScheduleManager: React.FC = () => {
  const { users, driverSchedules, addDriverSchedule, updateDriverSchedule, deleteDriverSchedule } = useAppContext();

  const drivers = useMemo(
    () => users.filter(u => u.role === 'driver' && u.status === 'active'),
    [users]
  );
  const colorForDriver = (driverId: string) => {
    const idx = drivers.findIndex(d => d.id === driverId);
    return DRIVER_COLORS[idx >= 0 ? idx % DRIVER_COLORS.length : 0];
  };
  const driverName = (driverId: string) => drivers.find(d => d.id === driverId)?.name || 'Driver Tidak Diketahui';

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

  const handleDayClick = (dateKey: string) => {
    if (bulkMode) {
      setSelectedDates(prev => {
        const next = new Set(prev);
        if (next.has(dateKey)) next.delete(dateKey);
        else next.add(dateKey);
        return next;
      });
    } else {
      setModal({ mode: 'add', dates: [dateKey] });
    }
  };

  const openBulkAddModal = () => {
    if (selectedDates.size === 0) return;
    setModal({ mode: 'add', dates: Array.from(selectedDates).sort() });
  };

  const closeModal = () => {
    setModal(null);
    setSelectedDates(new Set());
    setBulkMode(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Jadual Pemandu</h2>
          <p className="text-gray-600 mt-1 text-sm">Klik mana-mana tarikh untuk tambah shift. Klik shift sedia ada untuk edit/padam.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white border border-gray-300 rounded-md overflow-hidden flex text-sm">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 font-medium ${viewMode === 'month' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >Bulan</button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 font-medium border-l border-gray-300 ${viewMode === 'week' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >Minggu</button>
          </div>
          <button
            onClick={toggleBulkMode}
            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition ${bulkMode ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {bulkMode ? 'Batal Pilih Berbilang' : 'Pilih Berbilang Tarikh'}
          </button>
        </div>
      </div>

      {/* Navigasi tarikh */}
      <div className="flex items-center justify-between mb-3 bg-white border border-gray-200 rounded-lg px-4 py-2">
        <button onClick={goPrev} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md font-medium">‹ Sebelum</button>
        <div className="font-semibold text-gray-800">
          {viewMode === 'month'
            ? `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`
            : `${gridDays[0].getDate()} ${MONTH_LABELS[gridDays[0].getMonth()]} - ${gridDays[6].getDate()} ${MONTH_LABELS[gridDays[6].getMonth()]} ${gridDays[6].getFullYear()}`}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={goToday} className="px-3 py-1 text-sm text-indigo-600 hover:bg-indigo-50 rounded-md font-medium">Hari Ini</button>
          <button onClick={goNext} className="px-3 py-1 text-gray-600 hover:bg-gray-100 rounded-md font-medium">Selepas ›</button>
        </div>
      </div>

      {/* Legend driver */}
      {drivers.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-3 px-1">
          {drivers.map((d, idx) => (
            <div key={d.id} className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className={`h-2.5 w-2.5 rounded-full ${DRIVER_COLORS[idx % DRIVER_COLORS.length].dot}`}></span>
              {d.name}
            </div>
          ))}
        </div>
      )}

      {/* Grid kalendar */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {WEEKDAY_LABELS.map(label => (
            <div key={label} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase">{label}</div>
          ))}
        </div>
        <div className={`grid grid-cols-7 ${viewMode === 'month' ? 'auto-rows-fr' : ''}`}>
          {gridDays.map(date => {
            const dateKey = toDateKey(date);
            const daySchedules = (schedulesByDate.get(dateKey) || []).sort((a, b) => a.Mula.localeCompare(b.Mula));
            const isToday = dateKey === todayKey;
            const isCurrentMonth = viewMode === 'week' || date.getMonth() === anchor.getMonth();
            const isSelected = selectedDates.has(dateKey);
            const visibleSchedules = viewMode === 'month' ? daySchedules.slice(0, 3) : daySchedules;
            const hiddenCount = viewMode === 'month' ? daySchedules.length - visibleSchedules.length : 0;

            return (
              <div
                key={dateKey}
                onClick={() => handleDayClick(dateKey)}
                className={`relative border-b border-r border-gray-100 p-1.5 cursor-pointer transition min-h-[6.5rem] ${viewMode === 'week' ? 'min-h-[16rem]' : ''} ${
                  isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                } ${isSelected ? 'ring-2 ring-inset ring-indigo-500 bg-indigo-50' : 'hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-semibold h-5 w-5 flex items-center justify-center rounded-full ${
                    isToday ? 'bg-indigo-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-400'
                  }`}>
                    {date.getDate()}
                  </span>
                  {!bulkMode && (
                    <PlusIcon className="h-3.5 w-3.5 text-gray-300" />
                  )}
                </div>

                <div className="space-y-0.5">
                  {visibleSchedules.map(sched => {
                    const color = colorForDriver(sched.DriverId);
                    return (
                      <button
                        key={sched.id}
                        onClick={(e) => { e.stopPropagation(); if (!bulkMode) setModal({ mode: 'edit', schedule: sched }); }}
                        className={`w-full text-left text-[11px] leading-tight px-1.5 py-0.5 rounded ${color.bg} ${color.text} truncate hover:opacity-75 transition`}
                        title={`${driverName(sched.DriverId)}: ${sched.Mula} - ${sched.Tamat}`}
                      >
                        <span className="font-semibold">{driverName(sched.DriverId).split(' ')[0]}</span> {sched.Mula}-{sched.Tamat}
                      </button>
                    );
                  })}
                  {hiddenCount > 0 && (
                    <div className="text-[11px] text-gray-400 px-1.5">+{hiddenCount} lagi</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating bar bila bulk mode ada selection */}
      {bulkMode && selectedDates.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-4 z-40">
          <span className="text-sm font-medium">{selectedDates.size} tarikh dipilih</span>
          <button onClick={openBulkAddModal} className="bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-semibold px-4 py-1.5 rounded-full transition">
            Tetapkan Shift
          </button>
          <button onClick={() => setSelectedDates(new Set())} className="text-gray-300 hover:text-white text-sm">
            Kosongkan
          </button>
        </div>
      )}

      {modal && (
        <ScheduleModal
          modal={modal}
          drivers={drivers}
          onClose={closeModal}
          onSave={(entries) => {
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
            updateDriverSchedule(schedId, { Mula: mula, Tamat: tamat });
            closeModal();
          }}
          onDelete={(schedId) => {
            deleteDriverSchedule(schedId);
            closeModal();
          }}
        />
      )}
    </div>
  );
};

interface ScheduleModalProps {
  modal: ModalState;
  drivers: { id: string; name: string }[];
  onClose: () => void;
  onSave: (entries: { date: string; driverId: string; mula: string; tamat: string }[]) => void;
  onUpdate: (schedId: string, mula: string, tamat: string) => void;
  onDelete: (schedId: string) => void;
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({ modal, drivers, onClose, onSave, onUpdate, onDelete }) => {
  const isEdit = modal?.mode === 'edit';
  const editSchedule = isEdit && modal?.mode === 'edit' ? modal.schedule : null;

  const [selectedDriverIds, setSelectedDriverIds] = useState<Set<string>>(
    new Set(editSchedule ? [editSchedule.DriverId] : [])
  );
  const [mula, setMula] = useState(editSchedule?.Mula || '09:00');
  const [tamat, setTamat] = useState(editSchedule?.Tamat || '17:00');

  if (!modal) return null;

  const toggleDriver = (id: string) => {
    setSelectedDriverIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mula || !tamat) {
      alert('Sila isi masa mula dan tamat.');
      return;
    }
    if (isEdit && editSchedule) {
      onUpdate(editSchedule.id, mula, tamat);
      return;
    }
    if (modal.mode === 'add') {
      if (selectedDriverIds.size === 0) {
        alert('Sila pilih sekurang-kurangnya seorang driver.');
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
    return d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h3 className="text-lg font-bold text-gray-800">
            {isEdit ? 'Edit Shift' : modal.mode === 'add' && modal.dates.length > 1 ? `Tetapkan Shift (${modal.dates.length} Tarikh)` : 'Tambah Shift'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-5 space-y-4">
          {modal.mode === 'add' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tarikh</label>
              <div className="max-h-24 overflow-y-auto bg-gray-50 border border-gray-200 rounded-md p-2 text-sm text-gray-600 space-y-0.5">
                {modal.dates.map(d => <div key={d}>{formatDateLabel(d)}</div>)}
              </div>
            </div>
          )}

          {isEdit && editSchedule ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <div className="text-sm bg-gray-50 border border-gray-200 rounded-md px-3 py-2 text-gray-700">
                {drivers.find(d => d.id === editSchedule.DriverId)?.name || 'Driver Tidak Diketahui'}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
              <div className="space-y-1.5">
                {drivers.length === 0 && <p className="text-sm text-gray-400">Tiada driver aktif.</p>}
                {drivers.map(d => (
                  <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selectedDriverIds.has(d.id)}
                      onChange={() => toggleDriver(d.id)}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
                    />
                    {d.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Masa Mula</label>
              <input type="time" value={mula} onChange={e => setMula(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Masa Tamat</label>
              <input type="time" value={tamat} onChange={e => setTamat(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            {isEdit && editSchedule ? (
              <button
                type="button"
                onClick={() => onDelete(editSchedule.id)}
                className="flex items-center text-sm font-medium text-red-600 hover:text-red-800"
              >
                <TrashIcon className="h-4 w-4 mr-1" /> Padam Shift
              </button>
            ) : <span />}
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md text-sm">
                {isEdit ? 'Simpan' : 'Tetapkan Shift'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default DriverScheduleManager;
