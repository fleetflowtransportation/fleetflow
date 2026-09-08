import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
// FIX: The type 'Driver' does not exist; 'User' is the correct type for driver data.
import type { Booking, User, Vehicle } from '../types';
import { CalendarIcon, ClockIcon, LocationMarkerIcon, UserGroupIcon, TruckIcon, XIcon, ArrowUpCircleIcon } from './icons/Icons';

const driverColors = [
  'bg-blue-200 text-blue-800', 'bg-green-200 text-green-800', 'bg-yellow-200 text-yellow-800',
  'bg-purple-200 text-purple-800', 'bg-pink-200 text-pink-800', 'bg-indigo-200 text-indigo-800',
  'bg-teal-200 text-teal-800', 'bg-red-200 text-red-800',
];
const unassignedColor = 'bg-gray-200 text-gray-800';

const getDriverColor = (driverId: string | null) => {
  if (!driverId) return unassignedColor;
  const hash = driverId.split('').reduce((acc, char) => char.charCodeAt(0) + ((acc << 5) - acc), 0);
  return driverColors[Math.abs(hash) % driverColors.length];
};

const BookingDetailModal: React.FC<{ booking: Booking | null; onClose: () => void }> = ({ booking, onClose }) => {
  // FIX: The application context provides a 'users' array, not 'drivers'.
  const { users, vehicles } = useAppContext();

  if (!booking) return null;

  // FIX: Find the driver from the 'users' array.
  const driverName = users.find(d => d.id === booking.driverId)?.name || 'Unassigned';
  const vehicleInfo = vehicles.find(v => v.id === booking.vehicleId);
  const totalPassengers = booking.passengers.reduce((sum, p) => sum + p.count, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{booking.destination}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-700">
          <p><strong>Purpose:</strong> {booking.purpose}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="flex items-center space-x-2">
                <CalendarIcon className="h-5 w-5 text-gray-400" />
                <span>{new Date(booking.dateTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
             </div>
             <div className="flex items-center space-x-2">
                <ClockIcon className="h-5 w-5 text-gray-400" />
                <span>
                    {new Date(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    {booking.finishDateTime && ` - ${new Date(booking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                </span>
             </div>
             <div className="flex items-start space-x-2">
                <ArrowUpCircleIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span><strong>Pickup:</strong> {booking.pickupPoint}</span>
             </div>
             <div className="flex items-start space-x-2">
                <LocationMarkerIcon className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
                <span><strong>Drop-off:</strong> {booking.address}</span>
             </div>
             <div className="flex items-center space-x-2">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                <span>{totalPassengers} Passengers</span>
             </div>
             <div className="flex items-center space-x-2">
                <TruckIcon className="h-5 w-5 text-gray-400" />
                <span><strong>Driver:</strong> {driverName}</span>
             </div>
             <div className="flex items-center space-x-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" /></svg>
                <span><strong>Vehicle:</strong> {vehicleInfo ? `${vehicleInfo.name} (${vehicleInfo.plateNumber})` : 'Unassigned'}</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};


const CalendarView: React.FC = () => {
  // FIX: The application context provides a 'users' array, not 'drivers'.
  const { bookings, users } = useAppContext();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

  const { calendarGrid, monthName, year } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const calendarGrid: { date: Date; isCurrentMonth: boolean }[] = [];
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfMonth.getDay());

    for (let i = 0; i < 42; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      calendarGrid.push({
        date,
        isCurrentMonth: date.getMonth() === month,
      });
    }

    return { calendarGrid, monthName, year };
  }, [currentDate]);

  const bookingsByDay = useMemo(() => {
    const map = new Map<string, Booking[]>();
    bookings.forEach(booking => {
        if(booking.status === 'Cancelled') return;
        const dateKey = new Date(booking.dateTime).toDateString();
        if (!map.has(dateKey)) {
            map.set(dateKey, []);
        }
        map.get(dateKey)!.push(booking);
    });
    // Sort bookings within each day
    map.forEach(dayBookings => {
        dayBookings.sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
    });
    return map;
  }, [bookings]);

  const changeMonth = (offset: number) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + offset);
      return newDate;
    });
  };

  const getDriverName = useCallback((driverId: string | null) => {
    if (!driverId) return "Pending";
    // FIX: Find the driver from the 'users' array and update dependency.
    return users.find(d => d.id === driverId)?.name || "Unknown";
  }, [users]);

  return (
    <>
      <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      <div className="bg-white p-4 sm:p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <button onClick={() => changeMonth(-1)} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-800">{monthName} {year}</h3>
          <button onClick={() => changeMonth(1)} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-px text-center text-sm font-medium text-gray-600 border-t border-l border-gray-200">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-2 bg-gray-50 border-b border-r border-gray-200">{day}</div>
          ))}
          {calendarGrid.map(({ date, isCurrentMonth }, idx) => {
            const dayBookings = bookingsByDay.get(date.toDateString()) || [];
            const isToday = date.toDateString() === new Date().toDateString();

            return (
              <div
                key={idx}
                className={`relative min-h-[120px] p-1.5 border-b border-r border-gray-200 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50'}`}
              >
                <span className={`absolute top-1.5 right-1.5 text-xs font-semibold ${isToday ? 'bg-indigo-600 text-white rounded-full h-6 w-6 flex items-center justify-center' : ''} ${!isCurrentMonth ? 'text-gray-400' : ''}`}>
                  {date.getDate()}
                </span>
                <div className="mt-7 space-y-1">
                  {dayBookings.map(booking => (
                    <button
                      key={booking.id}
                      onClick={() => setSelectedBooking(booking)}
                      className={`w-full text-left p-1 rounded-md text-xs truncate cursor-pointer transition-transform hover:scale-105 ${getDriverColor(booking.driverId)}`}
                    >
                      <p className="font-semibold">{new Date(booking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
                      <p>{booking.destination}</p>
                      <p className="font-medium opacity-80">{getDriverName(booking.driverId)}</p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default CalendarView;
