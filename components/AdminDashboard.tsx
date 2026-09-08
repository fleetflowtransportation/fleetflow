import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import BookingForm from './BookingForm';
import BookingCard from './BookingCard';
import FilterControls from './FilterControls';
import { PlusIcon, CheckCircleIcon, XCircleIcon, XIcon, InformationCircleIcon, SearchIcon } from './icons/Icons';
import type { Booking, User } from '../types';

// --- Confirmation Modal Component ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  confirmColor?: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message, confirmText = 'Confirm', confirmColor = 'bg-indigo-600 hover:bg-indigo-700' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" aria-modal="true" role="dialog">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md flex flex-col" role="document">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close"><XIcon className="h-6 w-6" /></button>
        </div>
        <div className="p-6">
          <div className="flex items-start space-x-3">
            <InformationCircleIcon className="h-6 w-6 text-yellow-500 flex-shrink-0" />
            <p className="text-gray-700">{message}</p>
          </div>
        </div>
        <div className="p-4 bg-gray-50 flex justify-end space-x-3 rounded-b-lg">
          <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
          <button 
            type="button" 
            onClick={onConfirm}
            className={`${confirmColor} text-white font-bold py-2 px-4 rounded-lg shadow-md`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};


const AdminDashboard: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const { bookings, users, vehicles, assignToBooking, updateBookingStatus } = useAppContext();
  const [filters, setFilters] = useState({
    status: '',
    driverId: '',
    vehicleId: '',
    dateFilter: 'all',
    startDate: '',
    endDate: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);
  const activeDrivers = useMemo(() => users.filter(u => u.role === 'driver' && u.status === 'active'), [users]);


  // New state for bulk actions
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bulkAction, setBulkAction] = useState<'complete' | 'cancel' | null>(null);

  const activeBookings = useMemo(() => {
    return bookings
      .filter(b => b.status === 'Pending' || b.status === 'Assigned')
      .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Week starts on Monday
    const dayOfWeek = today.getDay(); // 0 (Sun) to 6 (Sat)
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // adjust when day is Sunday
    const startOfWeek = new Date(today.getFullYear(), today.getMonth(), diff);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23,59,59,999);


    return activeBookings.filter(booking => {
      const bookingDate = new Date(booking.dateTime);
      
      let dateMatch = true;
      if (filters.dateFilter === 'today') {
        dateMatch = bookingDate.toDateString() === today.toDateString();
      } else if (filters.dateFilter === 'week') {
        dateMatch = bookingDate >= startOfWeek && bookingDate <= endOfWeek;
      } else if (filters.dateFilter === 'month') {
        dateMatch = bookingDate >= startOfMonth && bookingDate <= endOfMonth;
      } else if (filters.dateFilter === 'custom' && filters.startDate && filters.endDate) {
        const start = new Date(filters.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        dateMatch = bookingDate >= start && bookingDate <= end;
      }
      
      const statusMatch = !filters.status || booking.status === filters.status;
      const driverMatch = !filters.driverId || booking.driverId === filters.driverId;
      const vehicleMatch = !filters.vehicleId || booking.vehicleId === filters.vehicleId;

      const searchLower = searchQuery.toLowerCase();
      const searchMatch = !searchQuery || 
        (booking.destination || '').toLowerCase().includes(searchLower) ||
        (booking.purpose || '').toLowerCase().includes(searchLower) ||
        (booking.requesterName || '').toLowerCase().includes(searchLower) ||
        (booking.escort || '').toLowerCase().includes(searchLower);

      return dateMatch && statusMatch && driverMatch && vehicleMatch && searchMatch;
    });
  }, [activeBookings, filters, searchQuery]);

  const handleCreateBooking = () => {
    setEditingBooking(null);
    setIsFormOpen(true);
  };

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBooking(null);
  };

  // Handlers for selection
  const handleToggleSelection = (bookingId: string) => {
    setSelectedBookings(prev =>
      prev.includes(bookingId)
        ? prev.filter(id => id !== bookingId)
        : [...prev, bookingId]
    );
  };

  const handleToggleSelectAll = () => {
    const allFilteredIds = filteredBookings.map(b => b.id);
    const allVisibleSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedBookings.includes(id));

    if (allVisibleSelected) {
      setSelectedBookings(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      setSelectedBookings(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };

  // Handlers for bulk actions
  const handleBulkActionRequest = (action: 'complete' | 'cancel') => {
    if (selectedBookings.length > 0) {
      setBulkAction(action);
      setIsConfirmModalOpen(true);
    }
  };

  const handleConfirmBulkAction = () => {
    if (bulkAction && selectedBookings.length > 0) {
      const newStatus = bulkAction === 'complete' ? 'Completed' : 'Cancelled';
      selectedBookings.forEach(bookingId => {
        updateBookingStatus(bookingId, newStatus);
      });
      setSelectedBookings([]);
    }
    setIsConfirmModalOpen(false);
    setBulkAction(null);
  };

  const handleCloseModal = () => {
    setIsConfirmModalOpen(false);
    setBulkAction(null);
  };
  
  const allVisibleSelected = useMemo(() => 
    filteredBookings.length > 0 && filteredBookings.every(b => selectedBookings.includes(b.id)),
    [filteredBookings, selectedBookings]
  );
  
  const modalContent = useMemo(() => {
    if (!bulkAction) return { title: '', message: '', confirmText: '', confirmColor: '' };
    const count = selectedBookings.length;
    if (bulkAction === 'complete') {
        return {
            title: 'Confirm Completion',
            message: `Are you sure you want to mark ${count} booking(s) as completed?`,
            confirmText: 'Complete',
            confirmColor: 'bg-green-600 hover:bg-green-700'
        };
    }
    return {
        title: 'Confirm Cancellation',
        message: `Are you sure you want to cancel ${count} booking(s)?`,
        confirmText: 'Cancel Bookings',
        confirmColor: 'bg-red-600 hover:bg-red-700'
    };
  }, [bulkAction, selectedBookings.length]);


  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Dashboard</h2>
        <button
          onClick={handleCreateBooking}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Booking
        </button>
      </div>

      <FilterControls
        filters={filters}
        onFilterChange={setFilters}
        drivers={drivers}
        vehicles={vehicles}
        statuses={['Pending', 'Assigned']}
      />

      {/* Search Bar */}
      <div className="mt-4">
        <label htmlFor="search-bookings" className="sr-only">Search Bookings</label>
        <div className="relative rounded-md shadow-sm">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" aria-hidden="true" />
            </div>
            <input
                type="search"
                name="search-bookings"
                id="search-bookings"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Search by destination, purpose, requester, or escort..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
            />
        </div>
      </div>

      {/* Bulk Actions UI */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center">
            <input
                id="select-all-dashboard-checkbox"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                checked={allVisibleSelected}
                onChange={handleToggleSelectAll}
                disabled={filteredBookings.length === 0}
                aria-label="Select all visible bookings"
            />
            <label htmlFor="select-all-dashboard-checkbox" className="ml-2 text-sm text-gray-700">
                Select All
            </label>
        </div>

        {selectedBookings.length > 0 && (
            <div className="flex-grow flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm font-medium text-indigo-800">
                    {selectedBookings.length} booking(s) selected.
                </p>
                <div className="flex items-center space-x-2">
                    <button
                        onClick={() => handleBulkActionRequest('complete')}
                        className="flex items-center bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded-md text-sm transition-colors"
                    >
                        <CheckCircleIcon className="h-4 w-4 mr-1.5" />
                        Complete
                    </button>
                     <button
                        onClick={() => handleBulkActionRequest('cancel')}
                        className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-md text-sm transition-colors"
                    >
                        <XCircleIcon className="h-4 w-4 mr-1.5" />
                        Cancel
                    </button>
                </div>
            </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmBulkAction}
        title={modalContent.title}
        message={modalContent.message}
        confirmText={modalContent.confirmText}
        confirmColor={modalContent.confirmColor}
      />

      <BookingForm 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        bookingToEdit={editingBooking} 
      />
      
      <div className="mt-6 space-y-4">
        {filteredBookings.length > 0 ? (
          filteredBookings.map((booking: Booking) => (
            <BookingCard 
              key={booking.id} 
              booking={booking} 
              drivers={activeDrivers} 
              vehicles={vehicles}
              onAssign={assignToBooking}
              onEdit={handleEditBooking}
              isAdminView={true}
              view="dashboard"
              isSelectable={true}
              isSelected={selectedBookings.includes(booking.id)}
              onSelect={handleToggleSelection}
            />
          ))
        ) : (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">{activeBookings.length > 0 ? "No bookings match the current filters." : "No active bookings found."}</p>
            {activeBookings.length === 0 && <p className="text-gray-400 text-sm mt-1">Create a new booking to get started.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;