import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import BookingForm from './BookingForm';
import BookingCard from './BookingCard';
import FilterControls from './FilterControls';
import type { Booking } from '../types';
import { TrashIcon, XIcon, InformationCircleIcon } from './icons/Icons';

// --- Confirmation Modal Component ---
interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
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
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg shadow-md"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};


const BookingArchive: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const { bookings, users, vehicles, restoreBooking, deleteBooking } = useAppContext();
  const [filters, setFilters] = useState({
    status: '',
    driverId: '',
    vehicleId: '',
    dateFilter: 'all',
    startDate: '',
    endDate: '',
  });
  const [selectedBookings, setSelectedBookings] = useState<string[]>([]);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [bookingToDelete, setBookingToDelete] = useState<string | null>(null);

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);

  const archivedBookings = useMemo(() => {
    return bookings
      .filter(b => b.status === 'Completed' || b.status === 'Cancelled')
      .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
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

    return archivedBookings.filter(booking => {
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
      return dateMatch && statusMatch && driverMatch && vehicleMatch;
    });
  }, [archivedBookings, filters]);

  const handleEditBooking = (booking: Booking) => {
    setEditingBooking(booking);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingBooking(null);
  };

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
      // Deselect all visible
      setSelectedBookings(prev => prev.filter(id => !allFilteredIds.includes(id)));
    } else {
      // Select all visible
      setSelectedBookings(prev => [...new Set([...prev, ...allFilteredIds])]);
    }
  };
  
  const handleSingleDeleteRequest = (id: string) => {
    setBookingToDelete(id);
    setIsConfirmModalOpen(true);
  };

  const handleBulkDeleteRequest = () => {
    if (selectedBookings.length > 0) {
      setBookingToDelete(null); // Ensure single delete mode is off
      setIsConfirmModalOpen(true);
    }
  };
  
  const handleConfirmDelete = () => {
    if (bookingToDelete) {
      deleteBooking(bookingToDelete);
    } else if (selectedBookings.length > 0) {
      selectedBookings.forEach(bookingId => {
        deleteBooking(bookingId);
      });
      setSelectedBookings([]);
    }
    setIsConfirmModalOpen(false);
    setBookingToDelete(null);
  };

  const handleCloseModal = () => {
    setIsConfirmModalOpen(false);
    setBookingToDelete(null);
  }

  const allVisibleSelected = useMemo(() => 
    filteredBookings.length > 0 && filteredBookings.every(b => selectedBookings.includes(b.id)),
    [filteredBookings, selectedBookings]
  );
  
  const modalMessage = bookingToDelete
    ? 'Are you sure you want to permanently delete this booking? This action cannot be undone.'
    : `Are you sure you want to permanently delete ${selectedBookings.length} booking(s)? This action cannot be undone.`;


  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking Archive</h2>
        <p className="text-gray-600 mt-1">View, restore, or delete past bookings.</p>
      </div>

      <FilterControls
        filters={filters}
        onFilterChange={setFilters}
        drivers={drivers}
        vehicles={vehicles}
        statuses={['Completed', 'Cancelled']}
      />

      {/* Bulk Actions UI */}
      <div className="mt-4 flex items-center gap-4">
        <div className="flex items-center">
            <input
                id="select-all-checkbox"
                type="checkbox"
                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                checked={allVisibleSelected}
                onChange={handleToggleSelectAll}
                disabled={filteredBookings.length === 0}
                aria-label="Select all visible bookings"
            />
            <label htmlFor="select-all-checkbox" className="ml-2 text-sm text-gray-700">
                Select All
            </label>
        </div>

        {selectedBookings.length > 0 && (
            <div className="flex-grow flex items-center justify-between p-2.5 bg-indigo-50 border border-indigo-200 rounded-lg">
                <p className="text-sm font-medium text-indigo-800">
                    {selectedBookings.length} booking(s) selected.
                </p>
                <button
                    onClick={handleBulkDeleteRequest}
                    className="flex items-center bg-red-600 hover:bg-red-700 text-white font-bold py-1.5 px-3 rounded-md text-sm transition-colors"
                >
                    <TrashIcon className="h-4 w-4 mr-1.5" />
                    Delete Selected
                </button>
            </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={handleCloseModal}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message={modalMessage}
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
              drivers={drivers}
              vehicles={vehicles}
              onEdit={handleEditBooking}
              onRestore={restoreBooking}
              onDelete={handleSingleDeleteRequest}
              isAdminView={true}
              view="archive"
              isSelectable={true}
              isSelected={selectedBookings.includes(booking.id)}
              onSelect={handleToggleSelection}
            />
          ))
        ) : (
           <div className="text-center py-12 bg-white rounded-lg shadow">
            <p className="text-gray-500">{archivedBookings.length > 0 ? "No bookings match the current filters." : "No archived bookings found."}</p>
            {archivedBookings.length === 0 && <p className="text-gray-400 text-sm mt-1">Completed or cancelled bookings will appear here.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingArchive;
