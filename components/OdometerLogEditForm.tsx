import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog } from '../types';
import { XIcon, GaugeIcon } from './icons/Icons';

interface OdometerLogEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  logToEdit?: OdometerLog | null;
  initialVehicleId?: string;
  initialDriverId?: string;
}

const emptyFormData = {
  vehicleId: '',
  driverId: '',
  date: '',
  fromLocation: '',
  toLocation: '',
  purpose: '',
  startOdometer: '',
  endOdometer: '',
  remarks: '',
};

type FormData = typeof emptyFormData;

const OdometerLogEditForm: React.FC<OdometerLogEditFormProps> = ({ 
  isOpen, 
  onClose, 
  logToEdit,
  initialVehicleId,
  initialDriverId
}) => {
  const { updateOdometerLog, addOdometerLog, vehicles, users, currentUser, odometerLogs } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [error, setError] = useState('');

  const drivers = useMemo(() => {
    return users.filter(u => u.role === 'driver' || u.role === 'admin');
  }, [users]);

  // Helper to find latest odometer reading for a vehicle
  const getLatestOdoForVehicle = useCallback((vId: string) => {
    if (!vId) return 0;
    const vLogs = odometerLogs.filter(l => l.vehicleId === vId);
    if (vLogs.length > 0) {
      return Math.max(...vLogs.map(l => l.odometer));
    }
    return 0;
  }, [odometerLogs]);

  useEffect(() => {
    if (isOpen) {
      setError('');
      if (logToEdit) {
        setFormData({
          vehicleId: logToEdit.vehicleId || '',
          driverId: logToEdit.driverId || '',
          date: logToEdit.date ? new Date(logToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          fromLocation: logToEdit.fromLocation || '',
          toLocation: logToEdit.toLocation || '',
          purpose: logToEdit.purpose || '',
          startOdometer: logToEdit.startOdometer !== undefined ? String(logToEdit.startOdometer) : '',
          endOdometer: String(logToEdit.odometer),
          remarks: logToEdit.remarks || '',
        });
      } else {
        // Create mode
        const defaultVId = initialVehicleId || vehicles[0]?.id || '';
        const defaultDId = initialDriverId || (currentUser?.role === 'driver' ? currentUser.id : (drivers[0]?.id || ''));
        const latestOdo = defaultVId ? getLatestOdoForVehicle(defaultVId) : 0;

        setFormData({
          vehicleId: defaultVId,
          driverId: defaultDId,
          date: new Date().toISOString().split('T')[0],
          fromLocation: 'HQ / Pusat Operasi',
          toLocation: '',
          purpose: '',
          startOdometer: latestOdo > 0 ? String(latestOdo) : '',
          endOdometer: '',
          remarks: '',
        });
      }
    }
  }, [isOpen, logToEdit, initialVehicleId, initialDriverId, vehicles, drivers, currentUser, getLatestOdoForVehicle]);

  const handleVehicleChange = (newVId: string) => {
    setFormData(prev => {
      // If startOdometer is currently empty or matches old vehicle latest odo, suggest new vehicle's latest
      const suggestedStart = getLatestOdoForVehicle(newVId);
      return {
        ...prev,
        vehicleId: newVId,
        startOdometer: (!prev.startOdometer || prev.startOdometer === '0') && suggestedStart > 0 
          ? String(suggestedStart) 
          : prev.startOdometer
      };
    });
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'vehicleId') {
      handleVehicleChange(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setError('');
    }
  };

  const distance = useMemo(() => {
    const start = Number(formData.startOdometer);
    const end = Number(formData.endOdometer);
    if (!formData.startOdometer || !formData.endOdometer || isNaN(start) || isNaN(end)) return null;
    return end - start;
  }, [formData.startOdometer, formData.endOdometer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId) {
      setError('Sila pilih kenderaan.');
      return;
    }
    if (!formData.driverId) {
      setError('Sila pilih pemandu.');
      return;
    }

    const start = formData.startOdometer !== '' ? Number(formData.startOdometer) : undefined;
    const end = Number(formData.endOdometer);

    if (isNaN(end) || formData.endOdometer === '') {
      setError('Sila masukkan bacaan Odometer Tamat (KM) yang sah.');
      return;
    }
    if (start !== undefined && (isNaN(start) || end < start)) {
      setError('Odometer Tamat tidak boleh kurang daripada Odometer Mula.');
      return;
    }

    const logPayload = {
      vehicleId: formData.vehicleId,
      driverId: formData.driverId,
      date: new Date(formData.date).toISOString(),
      odometer: end,
      startOdometer: start,
      distance: start !== undefined ? end - start : undefined,
      fromLocation: formData.fromLocation.trim() ? formData.fromLocation.trim() : undefined,
      toLocation: formData.toLocation.trim() ? formData.toLocation.trim() : undefined,
      purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
    };

    if (logToEdit) {
      updateOdometerLog(logToEdit.id, logPayload);
    } else {
      addOdometerLog(logPayload);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col my-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <GaugeIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {logToEdit ? 'Kemaskini Log Odometer' : 'Daftar Log Odometer Baru'}
              </h2>
              <p className="text-xs text-slate-500">
                {logToEdit ? 'Ubah butiran rekod odometer perjalanan' : 'Kemasukan rekod perjalanan & bacaan meter'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center">
              <span className="mr-2 font-bold">⚠️</span> {error}
            </div>
          )}

          {/* VEHICLE & DRIVER SELECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Kenderaan *</label>
              <select 
                name="vehicleId" 
                value={formData.vehicleId} 
                onChange={handleChange} 
                required 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Pilih Kenderaan --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pemandu *</label>
              <select 
                name="driverId" 
                value={formData.driverId} 
                onChange={handleChange} 
                required 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Pilih Pemandu --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.role === 'admin' ? '(Admin)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tarikh Perjalanan *</label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              required 
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Dari</label>
              <input 
                type="text" 
                name="fromLocation" 
                placeholder="Cth: HQ / Pejabat"
                value={formData.fromLocation} 
                onChange={handleChange} 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lokasi Ke / Destinasi</label>
              <input 
                type="text" 
                name="toLocation" 
                placeholder="Cth: Hospital / KLIA"
                value={formData.toLocation} 
                onChange={handleChange} 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Tujuan Perjalanan</label>
            <textarea 
              name="purpose" 
              placeholder="Cth: Penghantaran dokumen rasmi / Mengiringi VIP"
              value={formData.purpose} 
              onChange={handleChange} 
              rows={2} 
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>

          {/* ODOMETER READINGS */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Bacaan Meter Kenderaan (KM)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meter Mula (KM)</label>
                <input 
                  type="number" 
                  name="startOdometer" 
                  placeholder="Cth: 12450"
                  value={formData.startOdometer} 
                  onChange={handleChange} 
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Meter Tamat (KM) *</label>
                <input 
                  type="number" 
                  name="endOdometer" 
                  placeholder="Cth: 12510"
                  value={formData.endOdometer} 
                  onChange={handleChange} 
                  required 
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
            </div>

            {distance !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Jarak Perjalanan Dikira:</span>
                <span className={`font-extrabold px-2 py-0.5 rounded-md ${
                  distance >= 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-700'
                }`}>
                  {distance >= 0 ? `+${distance.toLocaleString()} KM` : 'Ralat: Tamat < Mula'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Catatan Tambahan (Pilihan)</label>
            <textarea
              name="remarks"
              placeholder="Catatan servis, keadaan jalan, dsb."
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Batal
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              {logToEdit ? 'Simpan Perubahan' : 'Daftar Log Odometer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogEditForm;
