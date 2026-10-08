import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, PassengerCount } from '../types';
import { DEPARTMENTS, PICKUP_POINTS } from '../types';
import { 
  XIcon, 
  PaperClipIcon, 
  ClockIcon, 
  TruckIcon, 
  UserCircleIcon, 
  BuildingOfficeIcon, 
  CalendarIcon, 
  UserGroupIcon, 
  LocationMarkerIcon, 
  XCircleIcon,
  TrashIcon
} from './icons/Icons';
import { BookingResultModal } from './BookingResultModal';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, type AutoAssignResult } from '../services/bookingEngine';
import { isOtherPickup } from '../utils';

export interface BookingFormProps {
  isOpen?: boolean;
  onClose: () => void;
  bookingToEdit?: Booking | null;
  onSuccess?: () => void;
}

const OTHER_PICKUP = 'Other Location (Please Specify)';
const FREE_VEHICLE_CHOICE = 'Any / Free Choice';

const emptyFormData = {
  requesterName: '',
  requesterEmail: '',
  department: '',
  purpose: '',
  bookingDate: '',
  startTime: '',
  endTime: '',
  destination: '',
  pickupPoint: '',
  address: '',
  staffCount: '1',
  parentsCount: '0',
  kidsCount: '0',
  teenagersCount: '0',
  serviceType: 'Perlu Driver' as 'Perlu Driver' | 'Self-Drive',
  vehiclePreference: FREE_VEHICLE_CHOICE,
  shouldWait: false,
  icNumber: '',
  remarks: '',
};

type FormData = typeof emptyFormData;

const splitIso = (iso?: string) => {
  if (!iso) return { date: '', time: '' };
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    const date = d.toISOString().split('T')[0];
    const time = d.toTimeString().slice(0, 5);
    return { date, time };
  } catch {
    return { date: '', time: '' };
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

const BookingForm: React.FC<BookingFormProps> = ({ isOpen = true, onClose, bookingToEdit, onSuccess }) => {
  const { 
    addBooking, 
    updateBooking, 
    vehicles, 
    users, 
    driverSchedules, 
    lastDriverAssignedId, 
    bookings, 
    activeTenant 
  } = useAppContext();
  
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [isRecurring, setIsRecurring] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<AutoAssignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [recurrence, setRecurrence] = useState({
    frequency: 'weekly' as 'weekly' | 'bi-weekly' | 'monthly',
    endDate: ''
  });

  // 4. Caching Base Data (Drivers & Vehicles) efficiently to prevent redundant refetches
  const cachedDrivers = useMemo(() => {
    return (users || [])
      .filter(u => {
        const role = (u.role || '').toLowerCase();
        return role === 'driver' || role === 'pemandu' || u.isDriver;
      })
      .map(u => ({ id: u.id, name: u.name, phone: u.phone }));
  }, [users]);

  const cachedVehicles = useMemo(() => {
    return (vehicles || []).map(v => ({
      id: v.id,
      name: v.name,
      plateNumber: v.plateNumber,
      capacity: v.seatingCapacity || v.capacity || 10,
    }));
  }, [vehicles]);

  const prevIsOpenRef = React.useRef(false);
  const prevBookingIdRef = React.useRef<string | null | undefined>(undefined);

  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setIsRecurring(false);
    setRecurrence({ frequency: 'weekly', endDate: '' });
  }, []);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const bookingChanged = isOpen && (bookingToEdit ? bookingToEdit.id : null) !== prevBookingIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevBookingIdRef.current = bookingToEdit ? bookingToEdit.id : null;

    if (!isOpen) {
      return;
    }

    if (justOpened || bookingChanged) {
      if (bookingToEdit) {
        const { date, time: startTime } = splitIso(bookingToEdit.dateTime);
        const { time: endTime } = splitIso(bookingToEdit.finishDateTime);
        const staffCount = bookingToEdit.passengers?.find(p => p.category === 'Staff')?.count ?? 1;
        const parentsCount = bookingToEdit.passengers?.find(p => p.category === 'Parents')?.count ?? 0;
        const kidsCount = bookingToEdit.passengers?.find(p => p.category === 'Kids')?.count ?? 0;
        const teenagersCount = bookingToEdit.passengers?.find(p => p.category === 'Teenagers')?.count ?? 0;

        const existingVehicle = vehicles.find(v => v.id === bookingToEdit.vehicleId);
        const initialVehiclePref = bookingToEdit.vehiclePreference || existingVehicle?.name || FREE_VEHICLE_CHOICE;

        setFormData({
          requesterName: bookingToEdit.requesterName || '',
          requesterEmail: bookingToEdit.requesterEmail || '',
          department: bookingToEdit.department || '',
          purpose: bookingToEdit.purpose || '',
          bookingDate: date,
          startTime,
          endTime,
          destination: bookingToEdit.destination || '',
          pickupPoint: isOtherPickup(bookingToEdit.pickupPoint) ? OTHER_PICKUP : (bookingToEdit.pickupPoint || ''),
          address: (isOtherPickup(bookingToEdit.pickupPoint) || (bookingToEdit.address && bookingToEdit.address !== bookingToEdit.destination)) ? (bookingToEdit.address || '') : '',
          staffCount: String(staffCount),
          parentsCount: String(parentsCount),
          kidsCount: String(kidsCount),
          teenagersCount: String(teenagersCount),
          serviceType: (bookingToEdit.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Perlu Driver') as any,
          vehiclePreference: initialVehiclePref,
          shouldWait: Boolean(bookingToEdit.shouldWait),
          icNumber: bookingToEdit.icNumber || '',
          remarks: bookingToEdit.remarks || '',
        });
        setIsRecurring(false);
      } else {
        resetForm();
      }
    }
  }, [isOpen, bookingToEdit, resetForm, vehicles]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      setFormData(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const totalPassengers = useMemo(() => {
    return (Number(formData.staffCount) || 0) + (Number(formData.parentsCount) || 0) + (Number(formData.kidsCount) || 0) + (Number(formData.teenagersCount) || 0);
  }, [formData.staffCount, formData.parentsCount, formData.kidsCount, formData.teenagersCount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.parentsCount) > 0) passengers.push({ category: 'Parents', count: Number(formData.parentsCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (Number(formData.teenagersCount) > 0) passengers.push({ category: 'Teenagers', count: Number(formData.teenagersCount) });
    
    if (passengers.length === 0) {
      alert('Please specify at least one passenger (Staff, Parents, Kids, or Teenagers).');
      return;
    }

    if (!formData.serviceType) {
      alert('Please select a Service Type.');
      return;
    }

    if (isOtherPickup(formData.pickupPoint) && !formData.address.trim()) {
      alert('Please enter the specific pickup address.');
      return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
      alert('Please provide an IC/ID number for driving license verification.');
      return;
    }

    if (isRecurring && !recurrence.endDate) {
      alert('Please select an end date for the recurring booking.');
      return;
    }

    let calculatedEndTime = formData.endTime;
    if (!calculatedEndTime || calculatedEndTime <= formData.startTime) {
      const [h, m] = formData.startTime.split(':').map(Number);
      calculatedEndTime = `${String(Math.min(h + 2, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = `${formData.bookingDate}T${calculatedEndTime}:00`;

    const processedData: Partial<Booking> = {
      requesterName: formData.requesterName.trim(),
      requesterEmail: formData.requesterEmail.trim(),
      department: formData.department,
      purpose: formData.purpose.trim(),
      dateTime,
      finishDateTime,
      destination: formData.destination.trim(),
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      passengers,
      serviceType: formData.serviceType,
      vehiclePreference: formData.serviceType === 'Perlu Driver' ? formData.vehiclePreference : undefined,
      icNumber: formData.serviceType === 'Self-Drive' ? formData.icNumber.trim() : undefined,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
      recurrence: isRecurring ? recurrence : undefined,
    };

    if (bookingToEdit?.attachmentUrl) {
      processedData.attachmentName = bookingToEdit.attachmentName;
      processedData.attachmentUrl = bookingToEdit.attachmentUrl;
    }

    const baseInput = {
      requesterName: formData.requesterName.trim(),
      requesterEmail: formData.requesterEmail.trim(),
      department: formData.department,
      bookingDate: formData.bookingDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      purpose: formData.purpose.trim(),
      destination: formData.destination.trim(),
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      staffCount: Number(formData.staffCount) || 0,
      kidsCount: Number(formData.kidsCount) || 0,
      teenagersCount: Number(formData.teenagersCount) || 0,
      serviceType: formData.serviceType,
      vehiclePreference: formData.vehiclePreference,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks.trim(),
      icNumber: formData.icNumber.trim(),
    };

    if (bookingToEdit) {
      const result = evaluateBookingAssignment({
        booking: baseInput,
        existingBookings: bookings.filter(b => b.id !== bookingToEdit.id),
        driverSchedules,
        users,
        vehicles,
        lastDriverAssignedId,
      });

      if (result.status === 'Conflict') {
        const confirmConflict = window.confirm(
          `⚠️ CONFLICT DETECTED FOR THIS DATE & TIME:\n\n${result.conflictReason}\n\nDo you still want to force update this booking? (It will be flagged as Conflict).`
        );
        if (!confirmConflict) {
          return;
        }
      }

      const updatedPayload: Partial<Booking> = {
        ...processedData,
        status: result.status === 'Conflict' ? 'Conflict' : result.status,
        driverId: result.driverId || bookingToEdit.driverId,
        vehicleId: result.vehicleId || bookingToEdit.vehicleId,
        calendarEventTitle: result.calendarEventTitle || bookingToEdit.calendarEventTitle,
        calendarColor: result.calendarColor || bookingToEdit.calendarColor,
        conflictReason: result.conflictReason,
        adminNotes: result.adminNotes || `Updated via Admin Dashboard at ${new Date().toLocaleTimeString()}.`,
      };

      updateBooking(bookingToEdit.id, updatedPayload);
      if (onSuccess) onSuccess();
      onClose();
    } else {
      const newBooking: Omit<Booking, 'id'> = {
        ...(processedData as Omit<Booking, 'id' | 'status' | 'driverId' | 'vehicleId'>),
        status: 'Pending',
        driverId: null,
        vehicleId: null,
      };
      const result = addBooking(newBooking);
      setSubmissionResult(result);
      if (onSuccess) onSuccess();
    }
  };

  if (!isOpen && !submissionResult) return null;

  return (
    <>
      {isOpen && !submissionResult && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-slate-50 rounded-3xl shadow-2xl w-full max-w-3xl my-6 flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header Banner */}
            <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold uppercase tracking-wider">
                  <BuildingOfficeIcon className="w-4 h-4 text-indigo-400" />
                  <span>{activeTenant?.name || 'FleetFlow'} Transport Management</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black text-white">
                  {bookingToEdit ? 'Edit Vehicle Booking' : 'New Vehicle Booking Request'}
                </h2>
                <p className="text-xs text-slate-400">
                  {bookingToEdit 
                    ? 'Update trip details, driver allocation, and passenger logistics' 
                    : 'Submit a vehicle reservation. Smart engine checks driver schedule & fleet capacity automatically.'}
                </p>
              </div>
              <button 
                type="button"
                onClick={onClose} 
                className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            {/* Public Portal Link Quick Action */}
            {!bookingToEdit && (
              <div className="bg-indigo-50 border-b border-indigo-100 px-6 py-2.5 flex items-center justify-between text-xs text-indigo-900">
                <span className="font-medium">
                  🔗 Public Booking Portal Link:
                </span>
                <button
                  type="button"
                  onClick={() => window.open('https://armadaflow.vercel.app/?action=book&tenant_id=yck', '_blank')}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-3 py-1 rounded-lg transition shadow-xs cursor-pointer"
                >
                  Open Public Link ↗
                </button>
              </div>
            )}

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmit} className="p-5 sm:p-7 space-y-6 max-h-[82vh] overflow-y-auto">
              
              {/* CARD 1: REQUESTER PROFILE */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                    01
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Requester Profile</h3>
                    <p className="text-xs text-slate-500">Contact information for trip updates and calendar sync</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="requesterName"
                      value={formData.requesterName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Nur Ain / Ahmad Farhan"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Department <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="" disabled>Select Department</option>
                      {DEPARTMENTS.map(dep => (
                        <option key={dep} value={dep}>{dep}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Official Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="requesterEmail"
                    value={formData.requesterEmail}
                    onChange={handleChange}
                    required
                    placeholder="e.g. requester@organization.org"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                  />
                </div>
              </div>

              {/* CARD 2: TRIP & SCHEDULE DETAILS */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                    02
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Trip & Schedule Details</h3>
                    <p className="text-xs text-slate-500">Timing, pickup location, and destination</p>
                  </div>
                </div>

                {/* Date, Start Time, End Time */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Usage Date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="bookingDate"
                      value={formData.bookingDate}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Start Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Estimated End Time <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      required
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                    />
                  </div>
                </div>

                {/* Rest Hours Policy Notice */}
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2.5">
                  <ClockIcon className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block">Official Driver Rest Window Policy</span>
                    <p className="text-amber-800">
                      Rest hours: <b>12:00 PM – 1:00 PM</b> (Mon–Thu) • <b>12:30 PM – 2:30 PM</b> (Fri). Trips starting during break hours will trigger automated conflict warning.
                    </p>
                  </div>
                </div>

                {/* Purpose */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trip Purpose <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Official meetings, program logistics, patient visits"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                  />
                </div>

                {/* Destination */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Destination Address <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    required
                    rows={2}
                    placeholder="Full address, hospital, school, or venue name"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                  />
                </div>

                {/* Pickup Point & Custom Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pickup Point <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="pickupPoint"
                      value={formData.pickupPoint}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="" disabled>Select Pickup Location</option>
                      {PICKUP_POINTS.map(point => (
                        <option key={point} value={point}>{point}</option>
                      ))}
                      <option value={OTHER_PICKUP}>{OTHER_PICKUP}</option>
                    </select>
                  </div>

                  {isOtherPickup(formData.pickupPoint) && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Specific Pickup Address <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        required
                        placeholder="Enter street name, building or landmark"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* CARD 3: PASSENGER CAPACITY & LOGISTICS */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                      03
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">Passenger Capacity & Logistics</h3>
                      <p className="text-xs text-slate-500">Specify passenger counts, service type, and standby needs</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100">
                    Total: {totalPassengers} Pax
                  </span>
                </div>

                {/* Passenger Counts */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Staff
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="staffCount"
                      value={formData.staffCount}
                      onChange={handleChange}
                      className="w-full text-center py-2 px-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Parents
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="parentsCount"
                      value={formData.parentsCount}
                      onChange={handleChange}
                      className="w-full text-center py-2 px-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Children (Kids)
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="kidsCount"
                      value={formData.kidsCount}
                      onChange={handleChange}
                      className="w-full text-center py-2 px-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Teenagers
                    </label>
                    <input
                      type="number"
                      min="0"
                      name="teenagersCount"
                      value={formData.teenagersCount}
                      onChange={handleChange}
                      className="w-full text-center py-2 px-2 border border-slate-200 rounded-xl text-sm font-bold bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                </div>

                {/* Service Type Selection Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Service Type <span className="text-rose-500">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                      formData.serviceType === 'Perlu Driver' 
                        ? 'border-indigo-600 bg-indigo-50/50' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="serviceType"
                        value="Perlu Driver"
                        checked={formData.serviceType === 'Perlu Driver'}
                        onChange={handleChange}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-slate-900">
                          <UserCircleIcon className="w-4 h-4 text-indigo-600" />
                          <span>Perlu Driver (Van / Fleet)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Allocated with a professional on-duty driver based on round-robin duty schedules.
                        </p>
                      </div>
                    </label>

                    <label className={`p-4 rounded-2xl border-2 transition cursor-pointer flex items-start gap-3 ${
                      formData.serviceType === 'Self-Drive' 
                        ? 'border-indigo-600 bg-indigo-50/50' 
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}>
                      <input
                        type="radio"
                        name="serviceType"
                        value="Self-Drive"
                        checked={formData.serviceType === 'Self-Drive'}
                        onChange={handleChange}
                        className="mt-1 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <div className="flex items-center gap-1.5 font-extrabold text-xs sm:text-sm text-slate-900">
                          <TruckIcon className="w-4 h-4 text-emerald-600" />
                          <span>Self-Drive (Perodua Alza)</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                          Drive yourself using organization MPV. Key pickup requires valid driving license.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Conditional: Vehicle Preference & Driver Standby if Perlu Driver */}
                {formData.serviceType === 'Perlu Driver' && (
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Vehicle Preference
                      </label>
                      <select
                        name="vehiclePreference"
                        value={formData.vehiclePreference}
                        onChange={handleChange}
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 outline-none transition text-slate-800"
                      >
                        <option value={FREE_VEHICLE_CHOICE}>Any / Free Choice (Smart Engine Selects)</option>
                        {cachedVehicles.map(v => (
                          <option key={v.id} value={v.name}>
                            {v.name} ({v.plateNumber}) • {v.capacity} Seats
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Driver Standby Arrangement
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                          !formData.shouldWait 
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}>
                          <input
                            type="radio"
                            name="shouldWait"
                            checked={!formData.shouldWait}
                            onChange={() => setFormData(prev => ({ ...prev, shouldWait: false }))}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold">🚗 Drop-Off Only (Driver leaves after drop)</span>
                        </label>

                        <label className={`p-3 rounded-xl border transition cursor-pointer flex items-center gap-2.5 ${
                          formData.shouldWait 
                            ? 'border-indigo-600 bg-indigo-50/50 text-indigo-900' 
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}>
                          <input
                            type="radio"
                            name="shouldWait"
                            checked={formData.shouldWait}
                            onChange={() => setFormData(prev => ({ ...prev, shouldWait: true }))}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold">⏳ Standby On-Site (Driver waits throughout)</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* Conditional: IC Number if Self-Drive */}
                {formData.serviceType === 'Self-Drive' && (
                  <div className="pt-2 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Driver IC / Driving License ID <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="icNumber"
                      value={formData.icNumber}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 901230-10-5432"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Required for fleet insurance coverage and key collection authorization.
                    </p>
                  </div>
                )}
              </div>

              {/* CARD 4: ATTACHMENTS, REMARKS & RECURRING */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 sm:p-6 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="w-7 h-7 rounded-xl bg-indigo-50 text-indigo-600 font-black text-xs flex items-center justify-center">
                    04
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900">Additional Notes & Recurring Schedule</h3>
                    <p className="text-xs text-slate-500">Special instructions, client notes, and recurring frequency</p>
                  </div>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Special Instructions / Remarks (Optional)
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Specific meeting points, route instructions, or special passenger requests"
                    className="w-full px-3.5 py-2 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition bg-white"
                  />
                </div>

                {/* Recurring Booking Option (Admin Exclusive) */}
                {!bookingToEdit && (
                  <div className="pt-3 border-t border-slate-100">
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="checkbox"
                        checked={isRecurring}
                        onChange={(e) => setIsRecurring(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="text-xs font-bold text-slate-800">
                        🔁 Repeat this booking automatically (Recurring Series)
                      </span>
                    </label>

                    {isRecurring && (
                      <div className="p-4 bg-indigo-50/60 border border-indigo-200 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Frequency
                          </label>
                          <select
                            value={recurrence.frequency}
                            onChange={(e) => setRecurrence(prev => ({ ...prev, frequency: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                          >
                            <option value="weekly">Every Week (Weekly)</option>
                            <option value="bi-weekly">Every 2 Weeks (Bi-Weekly)</option>
                            <option value="monthly">Every Month (Monthly)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-700 mb-1">
                            Repeat Until Date *
                          </label>
                          <input
                            type="date"
                            value={recurrence.endDate}
                            onChange={(e) => setRecurrence(prev => ({ ...prev, endDate: e.target.value }))}
                            required={isRecurring}
                            className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-medium bg-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                >
                  <span>{bookingToEdit ? 'Save Changes' : 'Confirm & Assign Trip'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Confirmation & Assignment Result Modal */}
      {submissionResult && (
        <BookingResultModal
          isOpen={Boolean(submissionResult)}
          result={submissionResult}
          onClose={() => {
            setSubmissionResult(null);
            onClose();
          }}
        />
      )}
    </>
  );
};

export default BookingForm;
