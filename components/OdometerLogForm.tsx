import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog } from '../types';
import { XIcon } from './icons/Icons';

interface OdometerLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
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
};

type FormData = typeof emptyFormData;

const OdometerLogForm: React.FC<OdometerLogFormProps> = ({ isOpen, onClose, driverId }) => {
  const { addOdometerLog, vehicles, odometerLogs } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [error, setError] = useState('');

  const resetForm = useCallback(() => {
    setFormData({ ...emptyFormData, date: new Date().toISOString().split('T')[0] });
    setError('');
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  // Auto-cadang Odometer Mula ikut bacaan terkini kenderaan yang dipilih
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
    };

    addOdometerLog(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Rekod Trip / Odometer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Nombor Van</label>
            <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Pilih Kenderaan</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tarikh Perjalanan</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Lokasi Dari</label>
              <input type="text" name="fromLocation" value={formData.fromLocation} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="cth: YCK" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Lokasi Ke</label>
              <input type="text" name="toLocation" value={formData.toLocation} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="cth: Cheras" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tujuan Perjalanan</label>
            <textarea name="purpose" value={formData.purpose} onChange={handleChange} required rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="cth: bawa staff ambil resit" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Odometer Mula (KM)</label>
              <input type="number" name="startOdometer" value={formData.startOdometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 123456" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Odometer Tamat (KM)</label>
              <input type="number" name="endOdometer" value={formData.endOdometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 123500" />
            </div>
          </div>
          {distance !== null && (
            <p className="text-sm text-gray-600">Jarak Perjalanan: <span className="font-semibold text-gray-900">{distance.toLocaleString()} km</span></p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Catatan Tambahan (Jika Ada)</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              placeholder="cth: berhenti isi minyak, tunggu staff, dll."
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Hantar Rekod</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogForm;
