import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog } from '../types';
import { XIcon } from './icons/Icons';
import { parseAsLocal } from '../utils';

interface OdometerLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  defaultBookingId?: string;
  defaultBookingIds?: string[];
}

const emptyFormData = {
  vehicleId: '',
  date: '',
  fromLocation: '',
  toLocation: '',
  purpose: '',
  startOdometer: '',
  endOdometer: '',
  remarks: '',
  bookingId: '',
};

type FormData = typeof emptyFormData;

const OdometerLogForm: React.FC<OdometerLogFormProps> = ({ 
  isOpen, 
  onClose, 
  driverId, 
  defaultBookingId,
  defaultBookingIds
}) => {
  const { addOdometerLog, vehicles, odometerLogs, bookings } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');

  const resetForm = useCallback(() => {
    setFormData({ ...emptyFormData, date: new Date().toISOString().split('T')[0] });
    setSelectedIds([]);
    setError('');
  }, []);

  // Filter active driver bookings
  const driverActiveBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driverId && b.status !== 'Completed' && b.status !== 'Cancelled')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driverId]);

  // Combined auto-fill logic for one or multiple bookings
  const autoFillForMultipleBookings = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      resetForm();
      return;
    }

    const selectedBookings = bookings.filter(b => ids.includes(b.id));
    if (selectedBookings.length === 0) return;

    // Sort chronologically
    const sorted = [...selectedBookings].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());

    const fromLoc = sorted[0].pickupPoint || 'YCK';
    const toLocs = sorted.map(b => b.destination).filter(Boolean);
    const combinedTo = Array.from(new Set(toLocs)).join(', ');
    const combinedPurpose = sorted.map(b => b.purpose).filter(Boolean).join(', ');

    // Use vehicle from first booking
    const firstVehicleId = sorted.find(b => b.vehicleId)?.vehicleId || '';

    // Search latest odometer reading for vehicle
    let suggestedStart = '';
    if (firstVehicleId) {
      const vehicleLogs = odometerLogs.filter(log => log.vehicleId === firstVehicleId);
      if (vehicleLogs.length > 0) {
        suggestedStart = String(Math.max(...vehicleLogs.map(log => log.odometer)));
      }
    }

    setFormData({
      bookingId: ids[0], // backward compatibility
      vehicleId: firstVehicleId,
      date: new Date().toISOString().split('T')[0],
      fromLocation: fromLoc,
      toLocation: combinedTo,
      purpose: combinedPurpose,
      startOdometer: suggestedStart,
      endOdometer: '',
      remarks: '',
    });
    setError('');
  }, [bookings, odometerLogs, resetForm]);

  // Monitor open states and default props
  useEffect(() => {
    if (isOpen) {
      if (defaultBookingIds && defaultBookingIds.length > 0) {
        setSelectedIds(defaultBookingIds);
        autoFillForMultipleBookings(defaultBookingIds);
      } else if (defaultBookingId) {
        setSelectedIds([defaultBookingId]);
        autoFillForMultipleBookings([defaultBookingId]);
      } else {
        setSelectedIds([]);
        resetForm();
      }
    }
  }, [isOpen, defaultBookingId, defaultBookingIds, autoFillForMultipleBookings, resetForm]);

  // Suggest start odometer when user changes vehicle manually
  useEffect(() => {
    if (!formData.vehicleId) return;
    const vehicleLogs = odometerLogs.filter(log => log.vehicleId === formData.vehicleId);
    if (vehicleLogs.length === 0) return;
    const latestOdometer = Math.max(...vehicleLogs.map(log => log.odometer));
    setFormData(prev => (prev.startOdometer ? prev : { ...prev, startOdometer: String(latestOdometer) }));
  }, [formData.vehicleId, odometerLogs]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleToggleBooking = (id: string) => {
    setError('');
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      // Run autofill in immediate next tick
      setTimeout(() => {
        autoFillForMultipleBookings(next);
      }, 0);
      return next;
    });
  };

  const distance = useMemo(() => {
    const start = Number(formData.startOdometer);
    const end = Number(formData.endOdometer);
    if (!formData.startOdometer || !formData.endOdometer || isNaN(start) || isNaN(end)) return null;
    return end - start;
  }, [formData.startOdometer, formData.endOdometer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicleId || !formData.date || !formData.fromLocation.trim() || !formData.toLocation.trim() || !formData.purpose.trim() || !formData.startOdometer || !formData.endOdometer) {
      setError('Sila isi semua ruangan wajib.');
      return;
    }

    const start = Number(formData.startOdometer);
    const end = Number(formData.endOdometer);

    if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
      setError('Sila masukkan bacaan odometer yang sah.');
      return;
    }

    if (end < start) {
      setError('Odometer Tamat tidak boleh kurang daripada Odometer Mula.');
      return;
    }

    const newLog: Omit<OdometerLog, 'id'> = {
      driverId,
      vehicleId: formData.vehicleId,
      date: new Date(formData.date).toISOString(),
      odometer: end,
      startOdometer: start,
      distance: end - start,
      fromLocation: formData.fromLocation.trim(),
      toLocation: formData.toLocation.trim(),
      purpose: formData.purpose.trim(),
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
      bookingId: selectedIds[0] || undefined,
      bookingIds: selectedIds.length > 0 ? selectedIds : undefined,
    };

    addOdometerLog(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Lapor Meter & Selesai Trip</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Sahkan tugasan yang selesai & kemas kini odometer</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition"><XIcon className="h-6 w-6" /></button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-bold">
              ⚠️ {error}
            </div>
          )}
          
          {/* MULTI-SELECT ACTIVE TRIPS */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Pilih Tugasan Yang Selesai (Boleh Pilih Banyak)</label>
            {driverActiveBookings.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-2.5 bg-gray-50">
                {driverActiveBookings.map(b => {
                  const isChecked = selectedIds.includes(b.id);
                  return (
                    <label 
                      key={b.id} 
                      className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition ${
                        isChecked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-gray-100 hover:bg-gray-50'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        checked={isChecked} 
                        onChange={() => handleToggleBooking(b.id)} 
                        className="mt-0.5 h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 mr-2.5"
                      />
                      <div className="text-xs">
                        <p className="font-extrabold text-gray-900">
                          {parseAsLocal(b.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {b.destination}
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">Tujuan: {b.purpose} | Van: {b.vehicleId ? 'Van ' + b.vehicleId.slice(-3).toUpperCase() : 'Self-Drive'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 p-4 rounded-xl border border-dashed text-center font-semibold">Tiada tugasan aktif untuk dilaporkan.</p>
            )}
            <p className="text-[10px] text-indigo-600 font-semibold mt-1.5">💡 Memilih tugasan akan auto-mengisi lokasi, tujuan, dan menukar semua status trip terpilih kepada 'Completed' serentak!</p>
          </div>

          {/* Vehicle Dropdown */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Nombor Van / Kenderaan *</label>
            <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500">
              <option value="">-- Pilih Van --</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tarikh Perjalanan *</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          {/* Route details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Mula Dari *</label>
              <input type="text" name="fromLocation" value={formData.fromLocation} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="cth: YCK" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Lokasi Ke / Destinasi *</label>
              <input type="text" name="toLocation" value={formData.toLocation} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="cth: Cheras" />
            </div>
          </div>

          {/* Purpose details */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Tujuan Perjalanan *</label>
            <textarea name="purpose" value={formData.purpose} onChange={handleChange} required rows={2} className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="cth: membawa staf atau tugas am" />
          </div>

          {/* Odometer metrics */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">Odometer Mula (KM) *</label>
              <input type="number" name="startOdometer" value={formData.startOdometer} onChange={handleChange} required className="block w-full border-indigo-200 rounded-xl text-sm font-extrabold p-2.5 bg-white text-indigo-950 focus:ring-indigo-500 focus:border-indigo-500" placeholder="cth: 123456" />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">Odometer Tamat (KM) *</label>
              <input type="number" name="endOdometer" value={formData.endOdometer} onChange={handleChange} required className="block w-full border-indigo-200 rounded-xl text-sm font-extrabold p-2.5 bg-white text-indigo-950 focus:ring-indigo-500 focus:border-indigo-500" placeholder="cth: 123500" />
            </div>
          </div>

          {distance !== null && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-800">
              <span>JUMLAH JARAK REKODED</span>
              <span className="text-sm font-extrabold">{distance.toLocaleString()} KM</span>
            </div>
          )}

          {/* Remarks details */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Catatan Tambahan (Jika Ada)</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="cth: berhenti isi minyak, tunggu staf, dll."
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex justify-end space-x-3 border-t">
            <button type="button" onClick={onClose} className="bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-bold text-gray-700 hover:bg-gray-50 transition">Batal</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition">Hantar Rekod</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogForm;
