import React, { useState, useMemo, useEffect } from 'react';
import type { Booking, User, Vehicle, PassengerCategory } from '../types';
import { CalendarIcon, ClockIcon, LocationMarkerIcon, UserGroupIcon, CheckCircleIcon, XCircleIcon, TruckIcon, EditIcon, ArrowUpCircleIcon, PaperClipIcon, RewindIcon, TrashIcon, InformationCircleIcon, UserCircleIcon, RepeatIcon, RouteIcon } from './icons/Icons';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';

interface BookingCardProps {
  booking: Booking;
  drivers?: User[];
  vehicles?: Vehicle[];
  onAssign?: (bookingId: string, driverId: string, vehicleId: string) => void;
  onEdit?: (booking: Booking) => void;
  onRestore?: (bookingId: string) => void;
  onDelete?: (bookingId: string) => void;
  onCompleteTrip?: (booking: Booking) => void;
  isAdminView: boolean;
  view?: 'dashboard' | 'archive';
  isSelectable?: boolean;
  isSelected?: boolean;
  onSelect?: (bookingId: string) => void;
}

const statusStyles: { [key in Booking['status']]: { bg: string; text: string; ring: string } } = {
  Pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', ring: 'ring-yellow-500/20' },
  Assigned: { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-500/20' },
  Confirmed: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-500/20' },
  Conflict: { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-500/20' },
  Completed: { bg: 'bg-green-100', text: 'text-green-800', ring: 'ring-green-500/20' },
  Cancelled: { bg: 'bg-red-100', text: 'text-red-800', ring: 'ring-red-500/20' },
};

const categoryAbbreviation: Record<PassengerCategory, string> = {
    'Staff': 'S',
    'Kids': 'K',
    'Teenagers': 'T',
    'Adults': 'A',
    'Others': 'O'
};

const BookingCard: React.FC<BookingCardProps> = ({ 
  booking, 
  drivers = [], 
  vehicles = [], 
  onAssign, 
  onEdit,
  onRestore,
  onDelete,
  onCompleteTrip,
  isAdminView,
  view = 'dashboard',
  isSelectable = false,
  isSelected = false,
  onSelect
}) => {
  const { updateBookingStatus, users: allUsers, vehicles: allVehles } = useAppContext();
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [isReassigning, setIsReassigning] = useState(false);
  
  const driverName = useMemo(() => allUsers.find(d => d.id === booking.driverId)?.name || 'N/A', [booking.driverId, allUsers]);
  const vehicle = useMemo(() => allVehles.find(v => v.id === booking.vehicleId) || allVehles.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase()), [booking.vehicleId, booking.vehiclePreference, allVehles]);
  
  useEffect(() => {
    setSelectedDriver(booking.driverId || '');
    setSelectedVehicle(booking.vehicleId || '');
  }, [booking.driverId, booking.vehicleId]);
  
  const handleAssign = () => {
    if (onAssign && selectedDriver && selectedVehicle) {
      onAssign(booking.id, selectedDriver, selectedVehicle);
      setIsReassigning(false);
    }
  };

  const handleDelete = () => {
    onDelete?.(booking.id);
  };
  
  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelect?.(booking.id);
  };

  const formattedDate = parseAsLocal(booking.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedTime = parseAsLocal(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedFinishTime = booking.finishDateTime ? parseAsLocal(booking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);
  const staffCount = booking.passengers.find(p => p.category === 'Staff')?.count ?? 0;
  const kidsCount = booking.passengers.find(p => p.category === 'Kids')?.count ?? 0;
  const teenagersCount = booking.passengers.find(p => p.category === 'Teenagers')?.count ?? 0;
  const passengerBreakdown = [
    staffCount > 0 ? `Staff: ${staffCount}` : '',
    kidsCount > 0 ? `Kids: ${kidsCount}` : '',
    teenagersCount > 0 ? `Teenagers: ${teenagersCount}` : ''
  ].filter(Boolean).join(', ') || 'No breakdown';

  const style = statusStyles[booking.status];
  
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden transition-all duration-200 hover:shadow-xl relative ${isSelected ? 'ring-2 ring-indigo-500' : 'ring-1 ring-transparent'}`}>
       {isSelectable && (
        <div className="absolute top-4 left-4 z-10">
          <input
            type="checkbox"
            className="h-5 w-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
            checked={isSelected}
            onChange={handleSelect}
            aria-label={`Select booking for ${booking.destination}`}
          />
        </div>
      )}

      <div className={`p-5 ${isSelectable ? 'pl-12' : ''}`}>
        <div className="flex flex-col sm:flex-row justify-between sm:items-start gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{booking.destination}</h3>
            <p className="text-md text-gray-600">{booking.purpose}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${style.bg} ${style.text} ring-1 ring-inset ${style.ring}`}>
            {booking.status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 text-sm text-gray-700">
          <div className="flex items-center space-x-2">
            <CalendarIcon className="h-5 w-5 text-gray-400" />
            <span>{formattedDate}</span>
          </div>
          <div className="flex items-center space-x-2">
            <ClockIcon className="h-5 w-5 text-gray-400" />
            <span>{formattedTime}{formattedFinishTime ? ` - ${formattedFinishTime}` : ''}</span>
          </div>
          <div className="flex items-start space-x-2">
            <ArrowUpCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1">
              <b>Pickup:</b> {getPickupLocationDisplay(booking.pickupPoint, booking.address)}
            </span>
          </div>
          <div className="flex items-start space-x-2">
            <LocationMarkerIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1"><b>Drop-off:</b> {booking.destination}</span>
          </div>
          <div className="flex items-center space-x-2">
            <UserGroupIcon className="h-5 w-5 text-gray-400" />
            <span>{totalPassengers} Passengers ({passengerBreakdown})</span>
          </div>
          <div className="flex items-center space-x-2 col-span-1 md:col-span-2">
            <span className="text-sm">
              <b>Standby Status:</b>{' '}
              <span className={`inline-block font-semibold px-2.5 py-0.5 rounded-full text-xs ${booking.shouldWait ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'}`}>
                {booking.shouldWait ? '⏳ Driver Must Standby' : '🚗 Driver Drop-off Only'}
              </span>
            </span>
          </div>
          {typeof booking.distance === 'number' && (
            <div className="flex items-center space-x-2">
                <RouteIcon className="h-5 w-5 text-gray-400" />
                <span><b>Distance:</b> {booking.distance.toLocaleString()} km</span>
            </div>
          )}
          <div className="flex items-center space-x-2 col-span-1 md:col-span-2">
            <UserCircleIcon className="h-5 w-5 text-gray-400" />
            <span>Requested by: <b>{booking.requesterName}</b></span>
          </div>
        </div>
        
        {/* Conflict Alert Banner */}
        {booking.status === 'Conflict' && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start space-x-2.5">
            <span className="text-rose-600 font-bold text-base">⚠️</span>
            <div className="text-sm flex-1">
              <p className="font-semibold text-rose-800">Booking Conflict Status:</p>
              <p className="text-rose-700 mt-0.5">{booking.conflictReason || 'No eligible driver or vehicle available for this time slot, or falls within break hours.'}</p>
              <p className="text-xs text-rose-600 mt-1">Please review and manually assign a driver or vehicle schedule.</p>
            </div>
          </div>
        )}

        {/* Warning Notes / Pre-working-hour badge */}
        {booking.warningNotes && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-medium">{booking.warningNotes}</span>
          </div>
        )}

        {/* Admin Notes / Auto-assign info */}
        {booking.adminNotes && (
          <div className="mt-3 p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700">
            <span className="font-semibold text-slate-900">System Notes:</span> {booking.adminNotes}
          </div>
        )}

        {booking.remarks && (
            <div className="mt-4 flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <InformationCircleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm flex-1">
                    <p className="font-semibold text-yellow-800">Remarks for Driver:</p>
                    <p className="text-yellow-700 whitespace-pre-wrap">{booking.remarks}</p>
                </div>
            </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {booking.calendarColor && (
              <div
                className="flex items-center px-3 py-1 rounded-full text-white text-xs font-semibold shadow-sm"
                style={{ backgroundColor: booking.calendarColor }}
              >
                Calendar: {booking.serviceType === 'Self-Drive' ? 'Self-Drive' : (driverName !== 'N/A' ? driverName : 'Scheduled')}
              </div>
            )}
            <div className={`flex items-center px-3 py-1 rounded-full text-xs ${booking.shouldWait ? 'bg-amber-100 text-amber-800 font-medium' : 'bg-gray-100 text-gray-800'}`}>
                Standby Required: {booking.shouldWait ? 'Yes (Driver Waiting)' : 'No'}
            </div>
            {booking.isPreWorkingHour && (
              <div className="flex items-center px-3 py-1 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">
                Pre-Working Hours (Early Morning)
              </div>
            )}
            {booking.recurrenceId && (
                 <div className="flex items-center px-3 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    <RepeatIcon className="h-4 w-4 mr-1.5 text-gray-500" />
                    Recurring
                </div>
            )}
        </div>
        {booking.attachmentName && booking.attachmentUrl && (
          <div className="mt-4">
            <a 
              href={booking.attachmentUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-md"
            >
              <PaperClipIcon className="h-4 w-4 mr-1.5" />
              {booking.attachmentName}
            </a>
          </div>
        )}
      </div>
      
      {/* Footer for Admins and Drivers */}
      {(isAdminView || (!isAdminView && (booking.status === 'Assigned' || booking.status === 'Confirmed'))) && (
        <div className="bg-gray-50 px-5 py-3 border-t">
          {isAdminView ? (
            <>
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                 { !isReassigning && (
                    <div className="flex items-center space-x-6 text-sm flex-grow">
                        <div className="flex items-center space-x-2 text-gray-600">
                            <UserCircleIcon className="h-5 w-5"/>
                            <span className="font-medium">Driver:</span>
                            <span>{driverName}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600">
                             {vehicle?.photoUrl ? (
                                <img src={vehicle.photoUrl} alt={vehicle.name} className="h-8 w-8 rounded-full object-cover" />
                              ) : (
                                <TruckIcon className="h-5 w-5"/>
                              )}
                            <div>
                                <span className="font-medium">Vehicle:</span>
                                <span> {vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : (booking.serviceType === 'Self-Drive' ? 'Self-Drive (Alza)' : 'Any (Driver Dispatches)')}</span>
                            </div>
                        </div>
                    </div>
                 )}
                 { isReassigning && <div className="flex-grow"><p className="text-sm font-medium text-indigo-700">Change driver and/or vehicle for this trip.</p></div> }
                 
                 {view === 'dashboard' && booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                    <div className="flex items-center space-x-2">
                        { (booking.status === 'Assigned' || booking.status === 'Confirmed') && !isReassigning && (
                           <button onClick={() => setIsReassigning(true)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Change Assignment"><EditIcon className="h-5 w-5" /></button>
                        )}
                        <button onClick={() => onEdit?.(booking)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit Trip Details"><EditIcon className="h-5 w-5" /></button>
                        <button onClick={() => updateBookingStatus(booking.id, 'Completed')} className="text-green-600 hover:text-green-800 p-1.5 rounded-full hover:bg-green-100 transition" title="Mark as Completed"><CheckCircleIcon className="h-6 w-6" /></button>
                        <button onClick={() => {
                            const reason = window.prompt('Please provide a reason for cancelling this booking (the requester will receive an email with this reason):');
                            if (reason === null) return;
                            updateBookingStatus(booking.id, 'Cancelled', reason || undefined);
                        }} className="text-red-600 hover:text-red-800 p-1.5 rounded-full hover:bg-red-100 transition" title="Cancel Booking"><XCircleIcon className="h-6 w-6"/></button>
                    </div>
                )}
                 {view === 'archive' && (
                    <div className="flex items-center space-x-2">
                        <button onClick={() => onEdit?.(booking)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit"><EditIcon className="h-5 w-5" /></button>
                        <button onClick={() => onRestore?.(booking.id)} className="text-blue-600 hover:text-blue-800 p-1.5 rounded-full hover:bg-blue-100 transition" title="Restore"><RewindIcon className="h-6 w-6" /></button>
                        <button onClick={handleDelete} className="text-red-600 hover:text-red-800 p-1.5 rounded-full hover:bg-red-100 transition" title="Delete Permanently"><TrashIcon className="h-5 w-5"/></button>
                    </div>
                )}
              </div>
              {view === 'dashboard' && (booking.status === 'Pending' || booking.status === 'Conflict' || isReassigning) && (
                 <div className="mt-4 pt-4 border-t flex flex-col sm:flex-row items-center gap-2">
                    <select value={selectedDriver} onChange={e => setSelectedDriver(e.target.value)} className="w-full sm:w-auto form-select block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      <option value="">Select Driver</option>
                      {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                    <select value={selectedVehicle} onChange={e => setSelectedVehicle(e.target.value)} className="w-full sm:w-auto form-select block pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md">
                      <option value="">Select Vehicle</option>
                      {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                    </select>
                    <button onClick={handleAssign} disabled={!selectedDriver || !selectedVehicle} className="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed">
                      {isReassigning ? 'Update' : (booking.status === 'Conflict' ? 'Resolve Conflict & Confirm' : 'Assign')}
                    </button>
                    {isReassigning && (
                       <button onClick={() => setIsReassigning(false)} className="w-full sm:w-auto bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    )}
                </div>
              )}
            </>
          ) : (
            <div className="flex justify-end">
                <button 
                    onClick={() => onCompleteTrip?.(booking)} 
                    className="inline-flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
                    aria-label="Complete Trip"
                >
                    <CheckCircleIcon className="h-5 w-5 mr-2" />
                    Complete Trip
                </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookingCard;
