import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog } from '../types';
import { XIcon } from './icons/Icons';

interface OdometerLogEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  logToEdit: OdometerLog | null;
}

const emptyFormData = {
  date: '',
  fromLocation: '',
  toLocation: '',
  purpose: '',
  startOdometer: '',
  endOdometer: '',
  remarks: '',
};

type FormData = typeof emptyFormData;

const OdometerLogEditForm: React.FC<OdometerLogEditFormProps> = ({ isOpen, onClose, logToEdit }) => {
  const { updateOdometerLog } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && logToEdit) {
      setFormData({
        date: new Date(logToEdit.date).toISOString().split('T')[0],
        fromLocation: logToEdit.fromLocation || '',
        toLocation: logToEdit.toLocation || '',
        purpose: logToEdit.purpose || '',
        startOdometer: logToEdit.startOdometer !== undefined ? String(logToEdit.startOdometer) : '',
        endOdometer: String(logToEdit.odometer),
        remarks: logToEdit.remarks || '',
      });
      setError('');
    }
  }, [isOpen, logToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    if (!logToEdit) return;

    const start = formData.startOdometer ? Number(formData.startOdometer) : undefined;
    const end = Number(formData.endOdometer);

    if (isNaN(end)) {
      setError('Sila masukkan bacaan Odometer Tamat yang sah.');
      return;
    }
    if (start !== undefined && (isNaN(start) || end < start)) {
      setError('Odometer Tamat tidak boleh kurang daripada Odometer Mula.');
      return;
    }

    updateOdometerLog(logToEdit.id, {
      date: new Date(formData.date).toISOString(),
      odometer: end,
      startOdometer: start,
      distance: start !== undefined ? end - start : undefined,
      fromLocation: formData.fromLocation.trim() ? formData.fromLocation.trim() : undefined,
      toLocation: formData.toLocation.trim() ? formData.toLocation.trim() : undefined,
      purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Edit Rekod Trip / Odometer</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div>
            <label className="block text-sm font-medium text-gray-700">Tarikh</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Lokasi Dari</label>
              <input type="text" name="fromLocation" value={formData.fromLocation} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Lokasi Ke</label>
              <input type="text" name="toLocation" value={formData.toLocation} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tujuan Perjalanan</label>
            <textarea name="purpose" value={formData.purpose} onChange={handleChange} rows={2} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Odometer Mula (KM)</label>
              <input type="number" name="startOdometer" value={formData.startOdometer} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Odometer Tamat (KM)</label>
              <input type="number" name="endOdometer" value={formData.endOdometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
            </div>
          </div>
          {distance !== null && (
            <p className="text-sm text-gray-600">Jarak Perjalanan: <span className="font-semibold text-gray-900">{distance.toLocaleString()} km</span></p>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Catatan Tambahan</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Batal</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Simpan Perubahan</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogEditForm;
