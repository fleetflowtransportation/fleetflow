import React, { useState, useMemo, useEffect } from 'react';
import type { Booking, User, Vehicle, PassengerCategory } from '../types';
import { CalendarIcon, ClockIcon, LocationMarkerIcon, UserGroupIcon, CheckCircleIcon, XCircleIcon, TruckIcon, EditIcon, ArrowUpCircleIcon, PaperClipIcon, RewindIcon, TrashIcon, InformationCircleIcon, UserCircleIcon, RepeatIcon, RouteIcon } from './icons/Icons';
import { useAppContext } from '../context/AppContext';

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
  const vehicle = useMemo(() => allVehles.find(v => v.id === booking.vehicleId), [booking.vehicleId, allVehles]);
  
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

  const formattedDate = new Date(booking.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const formattedTime = new Date(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  const formattedFinishTime = booking.finishDateTime ? new Date(booking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

  const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);
  const passengerBreakdown = booking.passengers
    .filter(p => p.count > 0)
    .map(p => `${categoryAbbreviation[p.category] || p.category.charAt(0)}:${p.count}`)
    .join(', ');

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
            <span className="flex-1"><b>Pickup:</b> {booking.pickupPoint}</span>
          </div>
          <div className="flex items-start space-x-2">
            <LocationMarkerIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
            <span className="flex-1"><b>Drop-off:</b> {booking.address}</span>
          </div>
          <div className="flex items-center space-x-2">
            <UserGroupIcon className="h-5 w-5 text-gray-400" />
            <span>{totalPassengers} Passengers ({passengerBreakdown})</span>
          </div>
           <div className="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
            <span>Escort: {booking.escort}</span>
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
        
        {booking.remarks && (
            <div className="mt-4 flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <InformationCircleIcon className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div className="text-sm flex-1">
                    <p className="font-semibold text-yellow-800">Remarks for Driver:</p>
                    <p className="text-yellow-700 whitespace-pre-wrap">{booking.remarks}</p>
                </div>
            </div>
        )}

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <div className={`flex items-center px-3 py-1 rounded-full ${booking.shouldWait ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                Driver to wait: {booking.shouldWait ? 'Yes' : 'No'}
            </div>
            <div className={`flex items-center px-3 py-1 rounded-full ${booking.returnTrip ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                Return trip: {booking.returnTrip ? 'Yes' : 'No'}
            </div>
            {booking.recurrenceId && (
                 <div className="flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-800">
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
      {(isAdminView || (!isAdminView && booking.status === 'Assigned')) && (
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
                                <span> {vehicle?.plateNumber || 'N/A'}</span>
                            </div>
                        </div>
                    </div>
                 )}
                 { isReassigning && <div className="flex-grow"><p className="text-sm font-medium text-indigo-700">Change driver and/or vehicle for this trip.</p></div> }
                 
                 {view === 'dashboard' && booking.status !== 'Completed' && booking.status !== 'Cancelled' && (
                    <div className="flex items-center space-x-2">
                        { booking.status === 'Assigned' && !isReassigning && (
                           <button onClick={() => setIsReassigning(true)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Change Assignment"><EditIcon className="h-5 w-5" /></button>
                        )}
                        <button onClick={() => onEdit?.(booking)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit Trip Details"><EditIcon className="h-5 w-5" /></button>
                        <button onClick={() => updateBookingStatus(booking.id, 'Completed')} className="text-green-600 hover:text-green-800 p-1.5 rounded-full hover:bg-green-100 transition" title="Mark as Completed"><CheckCircleIcon className="h-6 w-6" /></button>
                        <button onClick={() => updateBookingStatus(booking.id, 'Cancelled')} className="text-red-600 hover:text-red-800 p-1.5 rounded-full hover:bg-red-100 transition" title="Cancel Booking"><XCircleIcon className="h-6 w-6"/></button>
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
              {view === 'dashboard' && (booking.status === 'Pending' || isReassigning) && (
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
                      {isReassigning ? 'Update' : 'Assign'}
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