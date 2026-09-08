import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FuelLog } from '../types';
import { XIcon, PaperClipIcon } from './icons/Icons';

interface FuelLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
}

const emptyFormData = {
  vehicleId: '',
  date: '',
  odometer: '',
  liters: '',
  cost: '',
  pricePerLiter: '',
};

type FormData = typeof emptyFormData;

const FuelLogForm: React.FC<FuelLogFormProps> = ({ isOpen, onClose, driverId }) => {
  const { addFuelLog, vehicles } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);

  const resetForm = useCallback(() => {
    setFormData({...emptyFormData, date: new Date().toISOString().split('T')[0]});
    setReceiptFile(null);
  }, []);

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setReceiptFile(e.target.files[0]);
    }
  };
  
  const removeReceipt = () => {
    setReceiptFile(null);
    const fileInput = document.getElementById('receipt-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId || !formData.date || !formData.odometer || !formData.liters || !formData.cost || !formData.pricePerLiter) {
        alert("Please fill in all required fields.");
        return;
    }

    const newLog: Omit<FuelLog, 'id'> = {
        driverId,
        vehicleId: formData.vehicleId,
        date: new Date(formData.date).toISOString(),
        odometer: Number(formData.odometer),
        liters: Number(formData.liters),
        cost: Number(formData.cost),
        pricePerLiter: Number(formData.pricePerLiter),
        receiptAttachmentName: receiptFile?.name,
        receiptAttachmentUrl: receiptFile ? URL.createObjectURL(receiptFile) : undefined,
    };
    
    addFuelLog(newLog);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Log Fuel Purchase</h2>
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
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700">Price / Liter (RM)</label>
                  <input type="number" step="0.01" name="pricePerLiter" value={formData.pricePerLiter} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 1.50"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Liters</label>
                  <input type="number" step="0.01" name="liters" value={formData.liters} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 40.5"/>
              </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700">Total Cost (RM)</label>
              <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 60.75" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Receipt (Optional)</label>
            {!receiptFile ? (
                <div className="mt-1">
                    <input id="receipt-input" type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                </div>
            ) : (
                <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-gray-50">
                    <div className="flex items-center space-x-2 truncate">
                        <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                        <span className="text-sm text-gray-700 truncate">{receiptFile?.name}</span>
                    </div>
                    <button type="button" onClick={removeReceipt} className="text-sm font-medium text-red-600 hover:text-red-800 ml-2">Remove</button>
                </div>
            )}
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

export default FuelLogForm;
