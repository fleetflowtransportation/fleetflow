import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog } from '../types';
import { XIcon, GaugeIcon, TruckIcon, ChevronDownIcon, ChevronUpIcon } from './icons/Icons';
import { parseAsLocal } from '../utils';

interface OdometerLogFormProps {
  isOpen: boolean;
  onClose: () => void;
  driverId: string;
  defaultBookingId?: string;
  defaultBookingIds?: string[];
  defaultVehicleId?: string;
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
  defaultBookingIds,
  defaultVehicleId
}) => {
  const { addOdometerLog, vehicles, odometerLogs, bookings } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [showAllVehiclesReference, setShowAllVehiclesReference] = useState(false);

  // Accurate vehicle latest odometer lookup map
  const vehicleOdometerMap = useMemo(() => {
    const map: Record<string, { lastOdometer: number; lastDate?: string; logCount: number }> = {};
    
    vehicles.forEach(v => {
      const vLogs = odometerLogs
        .filter(l => l.vehicleId === v.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      if (vLogs.length > 0) {
        const maxReading = Math.max(...vLogs.map(l => Number(l.odometer) || 0));
        map[v.id] = {
          lastOdometer: maxReading,
          lastDate: vLogs[0].date,
          logCount: vLogs.length
        };
      } else {
        map[v.id] = {
          lastOdometer: Number(v.currentOdometer) || 0,
          lastDate: undefined,
          logCount: 0
        };
      }
    });

    return map;
  }, [vehicles, odometerLogs]);

  const resetForm = useCallback(() => {
    const initialVehicle = defaultVehicleId || '';
    const initialStart = initialVehicle && vehicleOdometerMap[initialVehicle] 
      ? String(vehicleOdometerMap[initialVehicle].lastOdometer || '') 
      : '';

    setFormData({ 
      ...emptyFormData, 
      vehicleId: initialVehicle,
      startOdometer: initialStart,
      date: new Date().toISOString().split('T')[0] 
    });
    setSelectedIds([]);
    setError('');
  }, [defaultVehicleId, vehicleOdometerMap]);

  // Filter active driver bookings
  const driverActiveBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driverId && b.status !== 'Completed' && b.status !== 'Cancelled')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driverId]);

  // Combined auto-fill logic for one or multiple bookings
  const autoFillForMultipleBookings = useCallback((ids: string[]) => {
    if (ids.length === 0) {
      setFormData(prev => ({
        ...prev,
        bookingId: '',
        fromLocation: 'YCK',
        toLocation: '',
        purpose: '',
      }));
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
    if (firstVehicleId && vehicleOdometerMap[firstVehicleId]) {
      suggestedStart = String(vehicleOdometerMap[firstVehicleId].lastOdometer || '');
    }

    setFormData(prev => ({
      ...prev,
      bookingId: ids[0],
      vehicleId: firstVehicleId || prev.vehicleId,
      date: prev.date || new Date().toISOString().split('T')[0],
      fromLocation: fromLoc,
      toLocation: combinedTo,
      purpose: combinedPurpose,
      startOdometer: suggestedStart || prev.startOdometer,
    }));
    setError('');
  }, [bookings, vehicleOdometerMap]);

  // Track previous open state so we ONLY initialize once upon modal opening.
  const prevIsOpenRef = React.useRef(false);

  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      if (defaultBookingIds && defaultBookingIds.length > 0) {
        setSelectedIds(defaultBookingIds);
        autoFillForMultipleBookings(defaultBookingIds);
      } else if (defaultBookingId) {
        setSelectedIds([defaultBookingId]);
        autoFillForMultipleBookings([defaultBookingId]);
      } else if (defaultVehicleId) {
        setSelectedIds([]);
        const lastOdo = vehicleOdometerMap[defaultVehicleId]?.lastOdometer;
        setFormData({
          ...emptyFormData,
          vehicleId: defaultVehicleId,
          startOdometer: lastOdo ? String(lastOdo) : '',
          date: new Date().toISOString().split('T')[0]
        });
      } else {
        setSelectedIds([]);
        resetForm();
      }
    }
    prevIsOpenRef.current = isOpen;
  }, [isOpen, defaultBookingId, defaultBookingIds, defaultVehicleId, autoFillForMultipleBookings, resetForm, vehicleOdometerMap]);

  // Suggest start odometer when user changes vehicle manually
  const handleVehicleSelect = (vehicleId: string) => {
    const lastOdo = vehicleOdometerMap[vehicleId]?.lastOdometer;
    setFormData(prev => ({
      ...prev,
      vehicleId,
      startOdometer: lastOdo ? String(lastOdo) : prev.startOdometer
    }));
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'vehicleId') {
      handleVehicleSelect(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setError('');
    }
  };

  const handleToggleBooking = (id: string) => {
    setError('');
    const next = selectedIds.includes(id) 
      ? selectedIds.filter(x => x !== id) 
      : [...selectedIds, id];
    setSelectedIds(next);
    autoFillForMultipleBookings(next);
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
      setError('Please fill in all required fields.');
      return;
    }

    const start = Number(formData.startOdometer);
    const end = Number(formData.endOdometer);

    if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
      setError('Please enter valid odometer readings.');
      return;
    }

    if (end < start) {
      setError('End Odometer cannot be less than Start Odometer.');
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

  const selectedVehicleInfo = vehicles.find(v => v.id === formData.vehicleId);
  const selectedVehicleOdo = formData.vehicleId ? vehicleOdometerMap[formData.vehicleId] : null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="flex justify-between items-center p-5 border-b bg-gray-50">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Odometer Check-in & Trip Completion</h2>
            <p className="text-xs text-gray-500 font-medium mt-0.5">Confirm completed assignments and record odometer readings</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-200 rounded-full transition cursor-pointer">
            <XIcon className="h-6 w-6" />
          </button>
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
            <label className="block text-xs font-bold uppercase text-gray-400 mb-2">Select Completed Assignments (Multi-select enabled)</label>
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
                        <p className="text-[10px] text-gray-500 font-medium mt-0.5">Purpose: {b.purpose} | Van: {b.vehicleId ? 'Van ' + b.vehicleId.slice(-3).toUpperCase() : 'Self-Drive'}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 bg-gray-50 p-4 rounded-xl border border-dashed text-center font-semibold">No active assignments to report.</p>
            )}
            <p className="text-[10px] text-indigo-600 font-semibold mt-1.5">💡 Selecting assignments will auto-fill location and purpose, marking all selected trips as 'Completed'.</p>
          </div>

          {/* Vehicle Dropdown with Last Odometer Info */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold uppercase text-gray-500">
                Vehicle / Van *
              </label>
              <button
                type="button"
                onClick={() => setShowAllVehiclesReference(!showAllVehiclesReference)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
              >
                <span>{showAllVehiclesReference ? 'Hide Fleet Odometer List' : 'View All Vehicles Last Odometer'}</span>
                {showAllVehiclesReference ? <ChevronUpIcon className="w-3.5 h-3.5" /> : <ChevronDownIcon className="w-3.5 h-3.5" />}
              </button>
            </div>
            
            <select 
              name="vehicleId" 
              value={formData.vehicleId} 
              onChange={handleChange} 
              required 
              className="block w-full border-gray-300 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500 text-slate-900"
            >
              <option value="">-- Select Vehicle --</option>
              {vehicles.map(v => {
                const odoInfo = vehicleOdometerMap[v.id];
                const lastKm = odoInfo ? odoInfo.lastOdometer : (v.currentOdometer || 0);
                return (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.plateNumber}) — Last Odo: {lastKm.toLocaleString()} KM
                  </option>
                );
              })}
            </select>

            {/* Selected Vehicle Quick Odometer Preview Card */}
            {selectedVehicleInfo && selectedVehicleOdo && (
              <div className="mt-2.5 p-3 bg-gradient-to-r from-indigo-50/90 to-slate-50 border border-indigo-200/80 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-600 text-white rounded-lg shadow-xs">
                    <GaugeIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-indigo-900 tracking-wider block">
                      {selectedVehicleInfo.name} ({selectedVehicleInfo.plateNumber})
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs font-black text-indigo-950">
                        Last Odometer: {selectedVehicleOdo.lastOdometer.toLocaleString()} KM
                      </span>
                      {selectedVehicleOdo.lastDate && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          (Updated {new Date(selectedVehicleOdo.lastDate).toLocaleDateString('en-GB')})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, startOdometer: String(selectedVehicleOdo.lastOdometer) }))}
                  className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-300 rounded-lg text-xs font-bold transition shadow-xs cursor-pointer whitespace-nowrap"
                  title="Copy last odometer to Start Odometer input"
                >
                  Apply Start Odo
                </button>
              </div>
            )}

            {/* Collapsible Fleet Odometer Reference Table */}
            {showAllVehiclesReference && (
              <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-700 border-b border-slate-200 pb-1.5">
                  <span>Fleet Vehicle</span>
                  <span>Last Odometer</span>
                </div>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {vehicles.map(v => {
                    const info = vehicleOdometerMap[v.id];
                    const km = info ? info.lastOdometer : (v.currentOdometer || 0);
                    const isCurrent = v.id === formData.vehicleId;
                    return (
                      <div
                        key={v.id}
                        onClick={() => handleVehicleSelect(v.id)}
                        className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer transition ${
                          isCurrent ? 'bg-indigo-100/70 text-indigo-950 font-bold' : 'hover:bg-white text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <TruckIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{v.name} ({v.plateNumber})</span>
                        </div>
                        <span className="font-mono font-bold text-indigo-700 whitespace-nowrap ml-2">
                          {km.toLocaleString()} KM
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Trip Date *</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-semibold p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" />
          </div>

          {/* Route details */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">From Location *</label>
              <input type="text" name="fromLocation" value={formData.fromLocation} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Headquarters" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Destination *</label>
              <input type="text" name="toLocation" value={formData.toLocation} onChange={handleChange} required className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Convention Center" />
            </div>
          </div>

          {/* Purpose details */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Trip Purpose *</label>
            <textarea name="purpose" value={formData.purpose} onChange={handleChange} required rows={2} className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="e.g. Staff transport or official task" />
          </div>

          {/* Odometer metrics */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-indigo-900 uppercase">Start Odometer (KM) *</label>
              </div>
              <input 
                type="number" 
                name="startOdometer" 
                value={formData.startOdometer} 
                onChange={handleChange} 
                required 
                className="block w-full border-indigo-200 rounded-xl text-sm font-extrabold p-2.5 bg-white text-indigo-950 focus:ring-indigo-500 focus:border-indigo-500" 
                placeholder="e.g. 123456" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-indigo-900 uppercase mb-1">End Odometer (KM) *</label>
              <input 
                type="number" 
                name="endOdometer" 
                value={formData.endOdometer} 
                onChange={handleChange} 
                required 
                className="block w-full border-indigo-200 rounded-xl text-sm font-extrabold p-2.5 bg-white text-indigo-950 focus:ring-indigo-500 focus:border-indigo-500" 
                placeholder="e.g. 123500" 
              />
            </div>
          </div>

          {distance !== null && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-50 rounded-xl border border-emerald-100 text-xs font-bold text-emerald-800">
              <span>TOTAL RECORDED DISTANCE</span>
              <span className="text-sm font-extrabold">{distance.toLocaleString()} KM</span>
            </div>
          )}

          {/* Remarks details */}
          <div>
            <label className="block text-xs font-bold uppercase text-gray-400 mb-1">Additional Remarks (Optional)</label>
            <textarea
              name="remarks"
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="block w-full border-gray-200 rounded-xl shadow-xs text-sm font-medium p-2.5 bg-gray-50 focus:bg-white focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="e.g. Fuel stop, waiting for passengers, etc."
            />
          </div>

          {/* Action buttons */}
          <div className="pt-4 flex justify-end space-x-3 border-t">
            <button type="button" onClick={onClose} className="bg-white py-2.5 px-4 border border-gray-300 rounded-xl shadow-xs text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2.5 px-5 rounded-xl shadow-md transition cursor-pointer">Submit Record</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogForm;
