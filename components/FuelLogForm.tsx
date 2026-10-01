import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FuelLog } from '../types';
import { XIcon, PaperClipIcon } from './icons/Icons';
import { uploadToGoogleDrive, formatFuelReceiptFileName } from '../services/googleDrive';

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
  const { addFuelLog, vehicles, activeTenant } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const prevIsOpenRef = React.useRef(false);

  const resetForm = useCallback(() => {
    setFormData({ ...emptyFormData, date: new Date().toISOString().split('T')[0] });
    setReceiptFile(null);
  }, []);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      resetForm();
    }
    prevIsOpenRef.current = isOpen;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!formData.vehicleId || !formData.date || !formData.odometer || !formData.liters || !formData.cost || !formData.pricePerLiter) {
      alert("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);

    let attachmentUrl: string | undefined = undefined;
    let attachmentName: string | undefined = undefined;

    if (receiptFile) {
      const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
      const plateNumber = selectedVehicle?.plateNumber || 'VEHICLE';
      const customFileName = formatFuelReceiptFileName(formData.date, plateNumber, receiptFile.name);

      try {
        const uploadRes = await uploadToGoogleDrive(receiptFile, {
          folderName: 'fuel_logs',
          folderPath: ['Fuel Logs', plateNumber],
          fileName: customFileName,
          tenant: activeTenant,
        });

        if (uploadRes.success && uploadRes.url) {
          attachmentUrl = uploadRes.url;
          attachmentName = uploadRes.name || customFileName;
        } else {
          attachmentUrl = URL.createObjectURL(receiptFile);
          attachmentName = customFileName;
        }
      } catch (err: any) {
        console.warn('[FuelLogForm] Upload fallback to local URL:', err);
        attachmentUrl = URL.createObjectURL(receiptFile);
        attachmentName = customFileName;
      }
    }

    const newLog: Omit<FuelLog, 'id'> = {
      driverId,
      vehicleId: formData.vehicleId,
      date: new Date(formData.date).toISOString(),
      odometer: Number(formData.odometer),
      liters: Number(formData.liters),
      cost: Number(formData.cost),
      pricePerLiter: Number(formData.pricePerLiter),
      receiptAttachmentName: attachmentName,
      receiptAttachmentUrl: attachmentUrl,
    };
    
    try {
      await addFuelLog(newLog);
      onClose();
    } catch (err: any) {
      alert('Error saving fuel log: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex justify-between items-center p-4 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
          <h2 className="text-lg font-bold text-slate-800">Log Fuel Purchase</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4 max-h-[80vh]">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Vehicle *</label>
            <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500">
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Date *</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Odometer (km) *</label>
            <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white font-mono focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 123456" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Price / Liter (RM) *</label>
              <input type="number" step="0.01" name="pricePerLiter" value={formData.pricePerLiter} onChange={handleChange} required className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 2.05"/>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Volume (Liters) *</label>
              <input type="number" step="0.01" name="liters" value={formData.liters} onChange={handleChange} required className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 40.5"/>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Total Cost (RM) *</label>
            <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleChange} required className="w-full text-xs font-bold text-amber-900 border border-amber-300 bg-amber-50 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500" placeholder="e.g. 60.75" />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Receipt (Google Drive Upload)</label>
            {!receiptFile ? (
              <div className="mt-1">
                <input id="receipt-input" type="file" onChange={handleFileChange} accept="image/*,.pdf" className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100 cursor-pointer"/>
              </div>
            ) : (
              <div className="mt-2 flex items-center justify-between p-2.5 pl-3 border border-slate-200 rounded-xl bg-slate-50">
                <div className="flex items-center space-x-2 truncate">
                  <PaperClipIcon className="h-4 w-4 text-slate-500 flex-shrink-0"/>
                  <span className="text-xs text-slate-700 font-medium truncate">{receiptFile?.name}</span>
                </div>
                <button type="button" onClick={removeReceipt} className="text-xs font-bold text-rose-600 hover:text-rose-800 ml-2 cursor-pointer">Remove</button>
              </div>
            )}
          </div>
          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="bg-white py-2 px-4 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancel</button>
            <button type="submit" disabled={isSubmitting} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-5 rounded-xl text-xs shadow-xs cursor-pointer flex items-center gap-1.5 disabled:bg-indigo-400">
              {isSubmitting ? 'Uploading to Drive...' : 'Submit Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FuelLogForm;
