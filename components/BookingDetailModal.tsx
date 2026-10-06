import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, User, Vehicle } from '../types';
import { 
  LocationMarkerIcon, 
  ArrowUpCircleIcon, 
  UserGroupIcon, 
  ClockIcon, 
  EditIcon, 
  TrashIcon, 
  XIcon, 
  TruckIcon 
} from './icons/Icons';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';
import { getDriverCalendarColor } from '../services/bookingEngine';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

export interface BookingDetailModalProps {
  booking: Booking | null;
  onClose: () => void;
  onEdit?: (booking: Booking) => void;
  onDelete?: (bookingId: string) => void;
  isAdmin?: boolean;
  users?: User[];
  vehicles?: Vehicle[];
}

export const BookingDetailModal: React.FC<BookingDetailModalProps> = ({ 
  booking, 
  onClose, 
  onEdit, 
  onDelete, 
  isAdmin = false,
  users: propUsers,
  vehicles: propVehicles 
}) => {
  // Lock body scroll on mobile whenever modal is open
  useBodyScrollLock(Boolean(booking));

  let context: any = null;
  try {
    context = useAppContext();
  } catch {}
  
  const users = (propUsers && propUsers.length > 0) ? propUsers : (context?.users || []);
  const vehicles = (propVehicles && propVehicles.length > 0) ? propVehicles : (context?.vehicles || []);
  const updateBooking = context?.updateBooking || (async () => {});

  const [isChangingAssignment, setIsChangingAssignment] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [selectedServiceType, setSelectedServiceType] = useState<'Perlu Driver' | 'Self-Drive'>('Perlu Driver');
  const [isSavingAssignment, setIsSavingAssignment] = useState(false);
  const [assignmentFeedback, setAssignmentFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (booking?.id) {
      setSelectedDriverId(booking.driverId || '');
      setSelectedVehicleId(booking.vehicleId || '');
      setSelectedServiceType(booking.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Perlu Driver');
      setIsChangingAssignment(false);
      setAssignmentFeedback(null);
    }
  }, [booking?.id]);

  if (!booking) return null;

  const currentDriver = users.find((d: User) => d.id === (booking.driverId || ''));
  const driverName = currentDriver?.name || (booking.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Unassigned');
  
  const currentVehicle = vehicles.find((v: Vehicle) => v.id === booking.vehicleId) ||
    vehicles.find((v: Vehicle) => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  
  const vehicleDisplayName = currentVehicle 
    ? `${currentVehicle.name} (${currentVehicle.plateNumber})` 
    : (booking.vehiclePreference || '🚗 No Preference / Driver Choice');

  const totalPassengers = booking.passengers ? booking.passengers.reduce((sum, p) => sum + p.count, 0) : 0;
  const staffCount = booking.passengers?.find(p => p.category === 'Staff')?.count ?? 0;
  const kidsCount = booking.passengers?.find(p => p.category === 'Kids')?.count ?? 0;
  const teenagersCount = booking.passengers?.find(p => p.category === 'Teenagers')?.count ?? 0;

  const availableDrivers = users.filter((u: User) => {
    const r = (u.role || '').toLowerCase();
    return r === 'driver' || r === 'staff' || u.id === 'driver-aziz';
  });

  const handleConfirmAssignmentChange = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!isAdmin) return;
    setIsSavingAssignment(true);
    setAssignmentFeedback(null);
    try {
      const isSelfDrive = selectedDriverId === 'self-drive' || selectedServiceType === 'Self-Drive';
      const chosenDriver = !isSelfDrive ? users.find((u: User) => u.id === selectedDriverId) : null;
      const driverLabel = isSelfDrive ? 'Self-Drive' : (chosenDriver?.name || '');
      
      const deptStr = booking.department ? ` (${booking.department})` : '';
      const updatedTitle = driverLabel
        ? `(${driverLabel}) ${booking.requesterName}${deptStr} → ${booking.destination}`
        : `${booking.requesterName}${deptStr} → ${booking.destination}`;
      
      const newColor = isSelfDrive ? 'grey' : (chosenDriver ? getDriverCalendarColor(chosenDriver.name) : 'grey');

      const chosenVehicle = selectedVehicleId ? vehicles.find((v: Vehicle) => v.id === selectedVehicleId) : null;
      const newVehiclePref = chosenVehicle ? chosenVehicle.name : 'No Preference / Driver Choice';

      await updateBooking(booking.id, {
        driverId: isSelfDrive ? null : (selectedDriverId || null),
        vehicleId: selectedVehicleId || null,
        serviceType: isSelfDrive ? 'Self-Drive' : 'Perlu Driver',
        vehiclePreference: newVehiclePref,
        calendarEventTitle: updatedTitle,
        calendarColor: newColor,
        adminNotes: `Reassigned by Admin on ${new Date().toLocaleDateString('en-GB')} to ${driverLabel || 'Unassigned'} / ${chosenVehicle?.name || 'No Vehicle'}`
      });

      setAssignmentFeedback('Assignment updated successfully!');
      setTimeout(() => {
        setIsChangingAssignment(false);
        setAssignmentFeedback(null);
      }, 1200);
    } catch (err: any) {
      console.error('Failed to change driver assignment:', err);
      alert('Failed to update assignment: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSavingAssignment(false);
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onEdit) {
      onEdit(booking);
      onClose();
    }
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete && window.confirm(`Are you sure you want to delete booking "${booking.requesterName} → ${booking.destination}"?`)) {
      onDelete(booking.id);
      onClose();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex justify-center items-center p-2 sm:p-4 overscroll-contain animate-in fade-in duration-150" 
      onClick={onClose}
      onTouchMove={(e) => {
        // Prevent background touch scrolling if touch starts on backdrop
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div 
        className="bg-white text-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 overscroll-contain" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-slate-50 border-b border-slate-200 flex justify-between items-start">
          <div className="flex-1 pr-3 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                booking.status === 'Confirmed' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                booking.status === 'Conflict' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                booking.status === 'Completed' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                booking.status === 'Cancelled' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                'bg-amber-100 text-amber-800 border border-amber-200'
              }`}>
                {booking.status}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                {booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : `👤 ${driverName}`}
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug break-words">
              {booking.calendarEventTitle || `${booking.requesterName} → ${booking.destination}`}
            </h3>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-medium">
              <ClockIcon className="h-3.5 w-3.5 shrink-0 text-slate-400 inline" />
              {parseAsLocal(booking.dateTime).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              {' • '}
              {parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
              {booking.finishDateTime && ` – ${parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && (
              <>
                <button 
                  type="button"
                  onClick={handleEditClick}
                  title="Edit Booking" 
                  className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                >
                  <EditIcon className="h-4 w-4" />
                </button>
                <button 
                  type="button"
                  onClick={handleDeleteClick}
                  title="Delete Booking" 
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </>
            )}
            <button 
              type="button" 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }} 
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 transition cursor-pointer ml-1"
              title="Close"
            >
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content Body with isolated mobile scrolling */}
        <div className="flex-1 p-4 sm:p-6 space-y-4 overflow-y-auto overscroll-contain touch-pan-y text-xs sm:text-sm text-slate-700">
          
          {/* DRIVER & VEHICLE REASSIGNMENT CARD */}
          <div className="p-3.5 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                  <TruckIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-[11px] font-extrabold text-indigo-950 uppercase tracking-wider block">
                    Driver & Vehicle Assignment
                  </span>
                  <span className="text-[10px] text-indigo-700 font-medium">
                    {isAdmin ? 'Manage driver allocation and assigned fleet vehicle' : 'Assigned driver & vehicle details'}
                  </span>
                </div>
              </div>

              {isAdmin && !isChangingAssignment && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsChangingAssignment(true);
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-100 border border-indigo-300 rounded-lg shadow-2xs transition cursor-pointer"
                >
                  ✏️ Change
                </button>
              )}
            </div>

            {assignmentFeedback && (
              <div className="p-2 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-bold text-center">
                ✓ {assignmentFeedback}
              </div>
            )}

            {isChangingAssignment && isAdmin ? (
              <div className="space-y-3 pt-2 border-t border-indigo-100 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Select Driver or Service Type
                  </label>
                  <select
                    value={selectedServiceType === 'Self-Drive' ? 'self-drive' : selectedDriverId}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'self-drive') {
                        setSelectedServiceType('Self-Drive');
                        setSelectedDriverId('self-drive');
                        const alza = vehicles.find((v: Vehicle) => v.name.toLowerCase().includes('alza'));
                        if (alza) setSelectedVehicleId(alza.id);
                      } else {
                        setSelectedServiceType('Perlu Driver');
                        setSelectedDriverId(val);
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- Unassigned (No Driver Assigned) --</option>
                    <optgroup label="Available Fleet Drivers">
                      {availableDrivers.map((d: User) => (
                        <option key={d.id} value={d.id}>
                          👤 {d.name} ({d.phone || d.email})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Special / Self-Drive">
                      <option value="self-drive">🚗 Self-Drive (Staff Drive Themselves - Alza)</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Assign Fleet Vehicle
                  </label>
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => setSelectedVehicleId(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">-- No Preference / Driver Choice --</option>
                    <optgroup label="Available Fleet Vehicles">
                      {vehicles.map((v: Vehicle) => (
                        <option key={v.id} value={v.id}>
                          🚐 {v.name} ({v.plateNumber}){v.vehicleType ? ` • ${v.vehicleType}` : ''}{v.vehicleStatus ? ` • ${v.vehicleStatus}` : ''}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    💡 Select "No Preference" so the assigned driver can select any suitable available vehicle upon departure.
                  </p>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsChangingAssignment(false);
                      setSelectedDriverId(booking.driverId || '');
                      setSelectedVehicleId(booking.vehicleId || '');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAssignmentChange}
                    disabled={isSavingAssignment}
                    className="px-3.5 py-1.5 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition cursor-pointer"
                  >
                    {isSavingAssignment ? 'Saving...' : 'Save Assignment'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Driver</span>
                  <p className="font-bold text-slate-900 mt-0.5">{driverName}</p>
                </div>
                <div className="bg-white/80 p-2.5 rounded-lg border border-indigo-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Vehicle</span>
                  <p className="font-bold text-slate-900 mt-0.5">{vehicleDisplayName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Destination & Pickup Card */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <LocationMarkerIcon className="h-4 w-4 text-rose-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Destination</span>
                <p className="font-bold text-slate-900 text-sm sm:text-base">{booking.destination}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5 pt-2 border-t border-slate-200/80">
              <ArrowUpCircleIcon className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pickup Location</span>
                <p className="font-semibold text-slate-800">{getPickupLocationDisplay(booking.pickupPoint, booking.address)}</p>
              </div>
            </div>
          </div>

          {/* Passenger & Purpose Card */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <UserGroupIcon className="h-3.5 w-3.5" />
                <span>Passengers ({totalPassengers})</span>
              </div>
              <p className="font-bold text-slate-900 text-xs">
                {[
                  staffCount > 0 ? `${staffCount} Staff` : '',
                  kidsCount > 0 ? `${kidsCount} Kids` : '',
                  teenagersCount > 0 ? `${teenagersCount} Teens` : '',
                ].filter(Boolean).join(', ') || `${totalPassengers} Pax`}
              </p>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-slate-500 text-[10px] font-bold uppercase mb-1">
                <ClockIcon className="h-3.5 w-3.5" />
                <span>Driver Standby</span>
              </div>
              <p className="font-bold text-slate-900 text-xs">
                {booking.shouldWait ? '⏳ Standby On-Site' : '🚗 Drop-Off Only'}
              </p>
            </div>
          </div>

          {/* Requester Details */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 font-medium">Requester:</span>
              <span className="font-bold text-slate-900">{booking.requesterName}</span>
            </div>
            {booking.department && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Department:</span>
                <span className="font-semibold text-slate-800">{booking.department}</span>
              </div>
            )}
            {booking.requesterEmail && (
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">Email:</span>
                <span className="font-mono text-indigo-600 text-[11px] font-medium">{booking.requesterEmail}</span>
              </div>
            )}
            {booking.purpose && (
              <div className="pt-2 mt-2 border-t border-slate-200">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">Purpose</span>
                <p className="text-xs text-slate-800 mt-0.5">{booking.purpose}</p>
              </div>
            )}
            {booking.remarks && (
              <div className="pt-2 mt-2 border-t border-slate-200">
                <span className="text-[10px] text-amber-600 font-bold uppercase block">Remarks</span>
                <p className="text-xs text-amber-900 mt-0.5">{booking.remarks}</p>
              </div>
            )}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center gap-2">
          {isAdmin ? (
            <>
              <button
                type="button"
                onClick={handleDeleteClick}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Delete</span>
              </button>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleEditClick}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition cursor-pointer"
                >
                  <EditIcon className="h-4 w-4" />
                  <span>Edit Full Booking</span>
                </button>
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </>
          ) : (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClose(); }}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer"
              >
                Close
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default BookingDetailModal;
