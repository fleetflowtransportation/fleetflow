import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking } from '../types';
import { XIcon } from './icons/Icons';

interface TripCompletionFormProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
}

const TripCompletionForm: React.FC<TripCompletionFormProps> = ({ isOpen, onClose, booking }) => {
  const { updateBooking, bookings, odometerLogs, vehicles } = useAppContext();
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [startOdometer, setStartOdometer] = useState('');
  const [endOdometer, setEndOdometer] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (booking) {
        setSelectedVehicleId(booking.vehicleId || '');
        // If the booking already has odometer data (e.g., being re-edited), use it.
        if (typeof booking.startOdometer === 'number') {
            setStartOdometer(booking.startOdometer.toString());
            setEndOdometer(booking.endOdometer?.toString() || '');
        } else if (booking.vehicleId) {
            // Otherwise, calculate the start odometer from the last known reading.
            const vehicleBookings = bookings.filter(b => 
                b.vehicleId === booking.vehicleId && 
                b.status === 'Completed' && 
                typeof b.endOdometer === 'number'
            );
          
            vehicleBookings.sort((a, b) => new Date(b.finishDateTime || b.dateTime).getTime() - new Date(a.finishDateTime || a.dateTime).getTime());
            const lastBookingOdometer = vehicleBookings.length > 0 ? vehicleBookings[0].endOdometer! : 0;
            
            const vehicleOdometerLogs = odometerLogs.filter(log => log.vehicleId === booking.vehicleId);
            vehicleOdometerLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            const lastOdometerLog = vehicleOdometerLogs.length > 0 ? vehicleOdometerLogs[0].odometer : 0;

            const calculatedStartOdometer = Math.max(lastBookingOdometer, lastOdometerLog);
          
            setStartOdometer(calculatedStartOdometer > 0 ? String(calculatedStartOdometer) : '');
            setEndOdometer('');
        } else {
            // Fallback if no vehicleId is present
            setStartOdometer('');
            setEndOdometer('');
        }
        setError('');
    }
  }, [booking, bookings, odometerLogs, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (!booking.vehicleId && !selectedVehicleId) {
      setError('Please select the vehicle utilized for this trip.');
      return;
    }

    const start = Number(startOdometer);
    const end = Number(endOdometer);

    if (isNaN(start) || isNaN(end) || start < 0 || end < 0) {
      setError('Please enter valid odometer readings.');
      return;
    }

    if (end < start) {
      setError('End odometer cannot be less than start odometer.');
      return;
    }

    const distance = end - start;

    updateBooking(booking.id, {
      vehicleId: selectedVehicleId || booking.vehicleId,
      startOdometer: start,
      endOdometer: end,
      distance: distance,
      status: 'Completed',
    });

    onClose();
  };

  if (!isOpen || !booking) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Complete Trip: {booking.destination}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          
          {!booking.vehicleId && (
            <div>
              <label className="block text-sm font-bold text-gray-700">Select Vehicle Used *</label>
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                required
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm p-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-amber-600">This booking was submitted as "Unassigned / Flexible", please specify the vehicle used.</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Start Odometer (km)</label>
            <input 
              type="number" 
              value={startOdometer} 
              onChange={(e) => setStartOdometer(e.target.value)} 
              required 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" 
              placeholder="e.g., 123450"
            />
            <p className="mt-1 text-xs text-gray-500">Auto-filled from vehicle's last recorded reading.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">End Odometer (km)</label>
            <input 
              type="number" 
              value={endOdometer} 
              onChange={(e) => setEndOdometer(e.target.value)} 
              required 
              className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" 
              placeholder="e.g., 123550"
            />
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Confirm Completion</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TripCompletionForm;
