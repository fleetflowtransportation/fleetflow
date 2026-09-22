import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FuelLog } from '../types';
import { XIcon, FuelIcon, PaperClipIcon, TrashIcon } from './icons/Icons';

interface FuelLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  logToEdit?: FuelLog | null;
  initialVehicleId?: string;
  initialDriverId?: string;
}

const emptyFormData = {
  vehicleId: '',
  driverId: '',
  date: '',
  odometer: '',
  liters: '',
  cost: '',
  pricePerLiter: '2.05',
};

type FormData = typeof emptyFormData;

const FuelLogModal: React.FC<FuelLogModalProps> = ({
  isOpen,
  onClose,
  logToEdit,
  initialVehicleId,
  initialDriverId,
}) => {
  const { addFuelLog, updateFuelLog, vehicles, users, currentUser, odometerLogs } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | undefined>(undefined);
  const [existingReceiptName, setExistingReceiptName] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const drivers = useMemo(() => {
    return users.filter(u => u.role === 'driver' || u.role === 'admin');
  }, [users]);

  // Find latest odometer reading for default
  const getLatestOdoForVehicle = (vId: string) => {
    if (!vId) return 0;
    const vLogs = odometerLogs.filter(l => l.vehicleId === vId);
    if (vLogs.length > 0) {
      return Math.max(...vLogs.map(l => l.odometer));
    }
    return 0;
  };

  useEffect(() => {
    if (isOpen) {
      setError('');
      setReceiptFile(null);

      if (logToEdit) {
        setFormData({
          vehicleId: logToEdit.vehicleId || '',
          driverId: logToEdit.driverId || '',
          date: logToEdit.date ? new Date(logToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          odometer: String(logToEdit.odometer || ''),
          liters: String(logToEdit.liters || ''),
          cost: String(logToEdit.cost || ''),
          pricePerLiter: String(logToEdit.pricePerLiter || '2.05'),
        });
        setExistingReceiptUrl(logToEdit.receiptAttachmentUrl);
        setExistingReceiptName(logToEdit.receiptAttachmentName);
      } else {
        const defaultVId = initialVehicleId || vehicles[0]?.id || '';
        const defaultDId = initialDriverId || (currentUser?.role === 'driver' ? currentUser.id : (drivers[0]?.id || ''));
        const latestOdo = defaultVId ? getLatestOdoForVehicle(defaultVId) : 0;

        setFormData({
          vehicleId: defaultVId,
          driverId: defaultDId,
          date: new Date().toISOString().split('T')[0],
          odometer: latestOdo > 0 ? String(latestOdo) : '',
          liters: '',
          cost: '',
          pricePerLiter: '2.05', // Standard RON95 default
        });
        setExistingReceiptUrl(undefined);
        setExistingReceiptName(undefined);
      }
    }
  }, [isOpen, logToEdit, initialVehicleId, initialDriverId, vehicles, drivers, currentUser]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setError('');

    if (name === 'vehicleId') {
      const latestOdo = getLatestOdoForVehicle(value);
      setFormData(prev => ({
        ...prev,
        vehicleId: value,
        odometer: (!prev.odometer || prev.odometer === '0') && latestOdo > 0 ? String(latestOdo) : prev.odometer,
      }));
      return;
    }

    if (name === 'liters') {
      const litersNum = parseFloat(value);
      const priceNum = parseFloat(formData.pricePerLiter);
      const calculatedCost = (!isNaN(litersNum) && !isNaN(priceNum) && litersNum > 0 && priceNum > 0)
        ? (litersNum * priceNum).toFixed(2)
        : formData.cost;

      setFormData(prev => ({
        ...prev,
        liters: value,
        cost: calculatedCost,
      }));
      return;
    }

    if (name === 'pricePerLiter') {
      const priceNum = parseFloat(value);
      const litersNum = parseFloat(formData.liters);
      const calculatedCost = (!isNaN(litersNum) && !isNaN(priceNum) && litersNum > 0 && priceNum > 0)
        ? (litersNum * priceNum).toFixed(2)
        : formData.cost;

      setFormData(prev => ({
        ...prev,
        pricePerLiter: value,
        cost: calculatedCost,
      }));
      return;
    }

    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setReceiptFile(file);
      setExistingReceiptUrl(undefined);
      setExistingReceiptName(file.name);
    }
  };

  const removeReceipt = () => {
    setReceiptFile(null);
    setExistingReceiptUrl(undefined);
    setExistingReceiptName(undefined);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.vehicleId) {
      setError('Please select a vehicle.');
      return;
    }
    if (!formData.driverId) {
      setError('Please select a driver.');
      return;
    }
    const odoNum = Number(formData.odometer);
    const litersNum = Number(formData.liters);
    const costNum = Number(formData.cost);
    const priceNum = Number(formData.pricePerLiter);

    if (isNaN(odoNum) || odoNum < 0) {
      setError('Please enter a valid current odometer reading.');
      return;
    }
    if (isNaN(litersNum) || litersNum <= 0) {
      setError('Please enter a valid quantity of fuel (Liters).');
      return;
    }
    if (isNaN(costNum) || costNum <= 0) {
      setError('Please enter a valid total purchase cost (RM).');
      return;
    }

    let attachmentUrl = existingReceiptUrl;
    let attachmentName = existingReceiptName;

    if (receiptFile) {
      attachmentUrl = URL.createObjectURL(receiptFile);
      attachmentName = receiptFile.name;
    }

    const payload = {
      vehicleId: formData.vehicleId,
      driverId: formData.driverId,
      date: new Date(formData.date).toISOString(),
      odometer: odoNum,
      liters: litersNum,
      cost: costNum,
      pricePerLiter: priceNum || (costNum / litersNum),
      receiptAttachmentName: attachmentName,
      receiptAttachmentUrl: attachmentUrl,
    };

    if (logToEdit) {
      updateFuelLog(logToEdit.id, payload);
    } else {
      addFuelLog(payload);
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col my-8 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
              <FuelIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {logToEdit ? 'Update Fuel Log' : 'Record New Fuel Log'}
              </h2>
              <p className="text-xs text-slate-500">
                {logToEdit ? 'Edit fuel purchase details and receipt' : 'Manual entry of fuel refueling records'}
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center">
              <span className="mr-2 font-bold">⚠️</span> {error}
            </div>
          )}

          {/* Vehicle & Driver Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle *</label>
              <select
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                required
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
              >
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Driver *</label>
              <select
                name="driverId"
                value={formData.driverId}
                onChange={handleChange}
                required
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
              >
                <option value="">-- Select Driver --</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} {d.role === 'admin' ? '(Admin)' : ''}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Refuel Date *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500 font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Current Odometer (KM) *</label>
              <input
                type="number"
                name="odometer"
                placeholder="e.g. 45200"
                value={formData.odometer}
                onChange={handleChange}
                required
                className="w-full text-xs font-mono font-bold border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Pricing and Liters Panel */}
          <div className="p-4 bg-amber-50/50 border border-amber-200/70 rounded-xl space-y-3">
            <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
              Fuel Purchase Details
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Price/Liter (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  name="pricePerLiter"
                  value={formData.pricePerLiter}
                  onChange={handleChange}
                  required
                  className="w-full text-xs font-semibold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Volume (Liters) *</label>
                <input
                  type="number"
                  step="0.01"
                  name="liters"
                  placeholder="e.g. 35.5"
                  value={formData.liters}
                  onChange={handleChange}
                  required
                  className="w-full text-xs font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Total Cost (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  name="cost"
                  placeholder="e.g. 72.80"
                  value={formData.cost}
                  onChange={handleChange}
                  required
                  className="w-full text-xs font-extrabold text-amber-900 border border-amber-300 rounded-lg p-2 bg-amber-50 focus:ring-2 focus:ring-amber-500 text-center"
                />
              </div>
            </div>
            <p className="text-[11px] text-amber-800/80 italic text-center">
              * Total Cost is automatically calculated (Liters × Price/Liter) and can be adjusted to match physical receipts.
            </p>
          </div>

          {/* Receipt Attachment */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Fuel Purchase Receipt Attachment</label>
            <div className="mt-1 flex items-center space-x-3">
              <input
                ref={fileInputRef}
                type="file"
                id="receipt-file-input"
                onChange={handleFileChange}
                accept="image/*,.pdf"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center px-3.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-xs"
              >
                <PaperClipIcon className="h-4 w-4 mr-1.5 text-slate-500" />
                {receiptFile || existingReceiptName ? 'Replace Receipt' : 'Upload Receipt'}
              </button>

              {(receiptFile || existingReceiptName) && (
                <div className="flex items-center space-x-2 bg-slate-100 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700">
                  <span className="truncate max-w-[180px]">{receiptFile ? receiptFile.name : existingReceiptName}</span>
                  {(receiptFile || existingReceiptUrl) && (
                    <a
                      href={receiptFile ? URL.createObjectURL(receiptFile) : existingReceiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:underline font-bold text-[11px]"
                    >
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={removeReceipt}
                    className="text-red-500 hover:text-red-700 p-0.5"
                    title="Delete attachment"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              {logToEdit ? 'Save Changes' : 'Record Fuel Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default FuelLogModal;
