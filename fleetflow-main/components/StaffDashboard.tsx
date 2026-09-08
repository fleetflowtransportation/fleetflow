import React, { useState } from 'react';
import CalendarView from './CalendarView';
import BookingForm from './BookingForm';
import { PlusIcon, UserCircleIcon, XIcon } from './icons/Icons';
import { useAppContext } from '../context/AppContext';

// Login Modal Component defined locally
interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { login } = useAppContext();
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const success = login(name, password);
    if (success) {
      onClose();
      setName('');
      setPassword('');
    } else {
      setError('Invalid credentials. Please try again.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-sm flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Login</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            <div>
                <label className="block text-sm font-medium text-gray-700">Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. Admin or John Doe"/>
            </div>
             <div>
                <label className="block text-sm font-medium text-gray-700">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"/>
            </div>
            <div className="pt-4 flex justify-end space-x-3">
              <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Login</button>
            </div>
        </form>
      </div>
    </div>
  );
};


const StaffDashboard: React.FC = () => {
  const [isBookingFormOpen, setIsBookingFormOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking Calendar</h2>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsLoginOpen(true)}
            className="flex items-center justify-center bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-lg shadow-sm transition duration-300"
          >
            <UserCircleIcon className="h-5 w-5 mr-2" />
            Admin / Driver Login
          </button>
          <button
            onClick={() => setIsBookingFormOpen(true)}
            className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
          >
            <PlusIcon className="h-5 w-5 mr-2" />
            New Booking
          </button>
        </div>
      </div>

      <CalendarView />

      <BookingForm 
        isOpen={isBookingFormOpen} 
        onClose={() => setIsBookingFormOpen(false)} 
      />
      <LoginModal 
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </div>
  );
};

export default StaffDashboard;