import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { CurrentUser, Booking } from '../types';
import BookingCard from './BookingCard';
import FuelLogForm from './FuelLogForm';
import OdometerLogForm from './OdometerLogForm';
import IssueLogForm from './IssueLogForm';
import { FuelIcon, WrenchScrewdriverIcon, GaugeIcon } from './icons/Icons';
import CalendarView from './CalendarView';

interface DriverDashboardProps {
  driver: CurrentUser;
}

const DriverDashboard: React.FC<DriverDashboardProps> = ({ driver }) => {
  const { bookings, updateBookingStatus } = useAppContext();
  const [isFuelLogOpen, setIsFuelLogOpen] = useState(false);
  const [isOdometerLogOpen, setIsOdometerLogOpen] = useState(false);
  const [isIssueLogOpen, setIsIssueLogOpen] = useState(false);

  const assignedBookings = useMemo(() => {
    return bookings
      .filter(b => b.driverId === driver.id && b.status === 'Assigned')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, driver.id]);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Driver Dashboard</h2>
            <p className="text-gray-600 mt-1">Welcome, {driver.name}.</p>
        </div>
        <div className="flex items-center space-x-2">
            <button
                onClick={() => setIsFuelLogOpen(true)}
                className="flex items-center bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-bold py-2 px-3 rounded-lg shadow-sm transition"
            >
                <FuelIcon className="h-5 w-5 mr-2" />
                Log Fuel
            </button>
             <button
                onClick={() => setIsOdometerLogOpen(true)}
                className="flex items-center bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-bold py-2 px-3 rounded-lg shadow-sm transition"
            >
                <GaugeIcon className="h-5 w-5 mr-2" />
                Log Odometer
            </button>
             <button
                onClick={() => setIsIssueLogOpen(true)}
                className="flex items-center bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 font-bold py-2 px-3 rounded-lg shadow-sm transition"
            >
                <WrenchScrewdriverIcon className="h-5 w-5 mr-2" />
                Report Issue
            </button>
        </div>
      </div>

      <div className="mb-8">
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Team Schedule</h3>
        <CalendarView />
      </div>

      <div>
        <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4">Your Assigned Trips</h3>
        <div className="space-y-4">
            {assignedBookings.length > 0 ? (
            assignedBookings.map(booking => (
                <BookingCard
                key={booking.id}
                booking={booking}
                isAdminView={false}
                onCompleteTrip={(bookingToComplete) => updateBookingStatus(bookingToComplete.id, 'Completed')}
                />
            ))
            ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow">
                <p className="text-gray-500">You have no assigned trips at the moment.</p>
            </div>
            )}
        </div>
      </div>

      <FuelLogForm
        isOpen={isFuelLogOpen}
        onClose={() => setIsFuelLogOpen(false)}
        driverId={driver.id}
      />
      
      <OdometerLogForm 
        isOpen={isOdometerLogOpen}
        onClose={() => setIsOdometerLogOpen(false)}
        driverId={driver.id}
      />

      <IssueLogForm
        isOpen={isIssueLogOpen}
        onClose={() => setIsIssueLogOpen(false)}
        reporterId={driver.id}
       />

    </div>
  );
};

export default DriverDashboard;