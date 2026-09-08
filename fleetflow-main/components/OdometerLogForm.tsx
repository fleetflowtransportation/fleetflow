import React, { useState, useEffect, useCallback } from 'react';
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
  odometer: '',
  purpose: '',
};

type FormData = typeof emptyFormData;

const OdometerLogForm: React.FC<OdometerLogFormProps> = ({ isOpen, onClose, driverId }) => {
  const { addOdometerLog, vehicles } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  const resetForm = useCallback(() => {
    setFormData({...emptyFormData, date: new Date().toISOString().split('T')[0]});
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.date || !formData.odometer) {
        alert("Please select a vehicle and enter the date and odometer reading.");
        return;
    }

    const newLog: Omit<OdometerLog, 'id'> = {
        driverId,
        vehicleId: formData.vehicleId,
        date: new Date(formData.date).toISOString(),
        odometer: Number(formData.odometer),
        purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
    };
    
    addOdometerLog(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Log Odometer Reading</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Vehicle</label>
            <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Odometer (km)</label>
            <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 123456" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Purpose / Summary of Day's Work (Optional)</label>
            <textarea
              name="purpose"
              value={formData.purpose}
              onChange={handleChange}
              rows={3}
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"
              placeholder="e.g., School runs, staff transport to KL Sentral, airport pickup..."
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Submit Log</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogForm;
