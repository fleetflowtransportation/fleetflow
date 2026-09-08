
import React, { useState, useEffect } from 'react';
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
  odometer: 0,
  purpose: '',
};

type FormData = typeof emptyFormData;

const OdometerLogEditForm: React.FC<OdometerLogEditFormProps> = ({ isOpen, onClose, logToEdit }) => {
  const { updateOdometerLog } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  useEffect(() => {
    if (isOpen && logToEdit) {
      setFormData({
        date: new Date(logToEdit.date).toISOString().split('T')[0],
        odometer: logToEdit.odometer,
        purpose: logToEdit.purpose || '',
      });
    }
  }, [isOpen, logToEdit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logToEdit) return;

    updateOdometerLog(logToEdit.id, {
      date: new Date(formData.date).toISOString(),
      odometer: Number(formData.odometer),
      purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Edit Odometer Log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Odometer (km)</label>
            <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
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
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogEditForm;
