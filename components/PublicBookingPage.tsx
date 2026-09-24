import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { googleCalendarService } from '../services/googleCalendar';
import { DEPARTMENTS, PICKUP_POINTS, Tenant, Booking, PassengerCount } from '../types';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, getDriverCalendarColor, type AutoAssignResult } from '../services/bookingEngine';
import { isOtherPickup, getPickupLocationDisplay } from '../utils';
import { ClockIcon, PaperClipIcon, CheckCircleIcon, CalendarIcon, UserCircleIcon, TruckIcon, InformationCircleIcon, XCircleIcon } from './icons/Icons';
import CalendarView from './CalendarView';

interface PublicBookingPageProps {
  tenantId: string;
  initialTab?: 'form' | 'calendar';
}

const OTHER_PICKUP = 'Other Location (Please Specify)';
const FREE_VEHICLE_CHOICE = 'Any / Free Choice';

const colorBadgeStyle: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-300',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  grey: 'bg-gray-100 text-gray-800 border-gray-300',
  purple: 'bg-purple-100 text-purple-800 border-purple-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  teal: 'bg-teal-100 text-teal-800 border-teal-300',
};

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
  staffCount: '',
  kidsCount: '',
  teenagersCount: '',
  serviceType: '' as '' | 'Perlu Driver' | 'Self-Drive',
  vehiclePreference: FREE_VEHICLE_CHOICE,
  shouldWait: false,
  icNumber: '',
  remarks: '',
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

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({ tenantId, initialTab = 'form' }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<any[]>([]);
  
  const [activeTab, setActiveTab] = useState<'form' | 'calendar'>(initialTab);
  const [formData, setFormData] = useState(emptyFormData);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<AutoAssignResult | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize and load tenant specific data
  useEffect(() => {
    setLoading(true);
    storageService.setTenantId(tenantId);
    
    Promise.all([
      storageService.getTenant(tenantId),
      storageService.getVehicles(),
      storageService.getUsers(),
      storageService.getBookings(),
      storageService.getDriverSchedules()
    ]).then(([t, v, u, b, s]) => {
      setTenant(t);
      setVehicles(v);
      setUsers(u);
      setBookings(b);
      setDriverSchedules(s);
      setLoading(false);
    }).catch(err => {
      console.error('[PublicBooking] Failed to load tenant data:', err);
      setLoading(false);
    });
  }, [tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    const fileInput = document.getElementById('public-attachment-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading) return;

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (Number(formData.teenagersCount) > 0) passengers.push({ category: 'Teenagers', count: Number(formData.teenagersCount) });
    
    if (passengers.length === 0) {
      alert('Please enter the number of passengers (Staff, Kids, or Teenagers).');
      return;
    }

    if (!formData.serviceType) {
      alert('Please select the required Service Type.');
      return;
    }

    if (isOtherPickup(formData.pickupPoint) && !formData.address.trim()) {
      alert('Please specify the pickup address.');
      return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
      alert('Please enter IC / ID Number for driver license records.');
      return;
    }

    setIsSubmitting(true);

    const baseInput = {
      requesterName: formData.requesterName,
      requesterEmail: formData.requesterEmail,
      department: formData.department,
      bookingDate: formData.bookingDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      purpose: formData.purpose,
      destination: formData.destination,
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      staffCount: Number(formData.staffCount) || 0,
      kidsCount: Number(formData.kidsCount) || 0,
      teenagersCount: Number(formData.teenagersCount) || 0,
      serviceType: formData.serviceType,
      vehiclePreference: formData.vehiclePreference,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks,
      icNumber: formData.icNumber,
    };

    // Auto assign engine check
    const result = evaluateBookingAssignment({
      booking: baseInput,
      existingBookings: bookings,
      driverSchedules,
      users,
      vehicles,
      lastDriverAssignedId: null,
    });

    if (result.status === 'Conflict') {
      setSubmitResult(result);
      setIsSubmitting(false);
      return;
    }

    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = formData.endTime
      ? `${formData.bookingDate}T${formData.endTime}:00`
      : undefined;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      requesterName: formData.requesterName,
      requesterEmail: formData.requesterEmail,
      department: formData.department,
      purpose: formData.purpose,
      dateTime,
      finishDateTime,
      destination: formData.destination,
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      passengers,
      serviceType: formData.serviceType,
      vehiclePreference: formData.serviceType === 'Perlu Driver' ? formData.vehiclePreference : undefined,
      icNumber: formData.serviceType === 'Self-Drive' ? formData.icNumber.trim() : undefined,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
      status: result.status,
      driverId: result.driverId,
      vehicleId: result.vehicleId,
      calendarEventTitle: result.calendarEventTitle,
      calendarColor: result.calendarColor,
      calendarEventId: result.calendarEventId,
      adminNotes: result.adminNotes,
      conflictReason: result.conflictReason,
      isPreWorkingHour: result.isPreWorkingHour,
      warningNotes: result.warningNotes,
      tenantId: tenantId,
    };

    // Google script attachment upload
    if (attachmentFile) {
      newBooking.attachmentName = attachmentFile.name;
      const driveUrl = import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
      if (driveUrl) {
        try {
          const base64Str = await fileToBase64(attachmentFile);
          const response = await fetch(driveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              base64: base64Str,
              fileName: attachmentFile.name,
              mimeType: attachmentFile.type
            })
          });
          const resJson = await response.json();
          if (resJson && resJson.success && resJson.url) {
            newBooking.attachmentUrl = resJson.url;
          }
        } catch (error) {
          console.error("Failed to upload attachment to Drive, using local fallback URL", error);
          newBooking.attachmentUrl = URL.createObjectURL(attachmentFile);
        }
      } else {
        newBooking.attachmentUrl = URL.createObjectURL(attachmentFile);
      }
    }

    // Google Calendar Sync
    if (tenant) {
      try {
        const calEventId = await googleCalendarService.createEvent(tenant, newBooking);
        if (calEventId) {
          newBooking.calendarEventId = calEventId;
        }
      } catch (err) {
        console.warn('[Google Calendar] Failed to create event:', err);
      }
    }

    // Save booking
    try {
      await storageService.createBooking(newBooking);
      setBookings(prev => [newBooking, ...prev]);
      setIsSuccess(true);
      setSubmitResult(result);
    } catch (err: any) {
      alert('Error saving booking: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Please wait, loading fleet reservation portal...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Organization Not Found</h2>
          <p className="text-gray-600 text-sm mb-6">This booking link is invalid or the organization is not registered in the system.</p>
          <a href="/" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Back to Main Page</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-6 sm:py-8 px-3 sm:px-6">
      <div className={`w-full transition-all duration-300 ${activeTab === 'calendar' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        
        {/* Banner/Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-950 rounded-2xl shadow-xl p-6 sm:p-8 text-white mb-6 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 scale-150">
            <CalendarIcon className="w-48 h-48 text-white" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="bg-indigo-500/30 text-indigo-200 text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full border border-indigo-400/20">
                Smart Fleet Booking System
              </span>

              {/* View Switcher Pills */}
              <div className="flex items-center bg-indigo-900/60 p-1 rounded-xl border border-indigo-500/30 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'form'
                      ? 'bg-white text-indigo-950 shadow-sm'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📋 Reservation Form
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                    activeTab === 'calendar'
                      ? 'bg-white text-indigo-950 shadow-sm'
                      : 'text-indigo-200 hover:text-white'
                  }`}
                >
                  📅 Live Fleet Calendar
                </button>
              </div>
            </div>

            <h1 className="text-2xl sm:text-4xl font-extrabold mt-3 tracking-tight">
              {activeTab === 'calendar' ? 'Fleet Schedule & Live Calendar' : 'Vehicle Booking Request Form'}
            </h1>
            <p className="text-indigo-200 mt-2 text-sm sm:text-base max-w-xl font-medium">
              {activeTab === 'calendar'
                ? `Real-time public calendar view for ${tenant.name}. Check scheduled vehicle trips and driver availability.`
                : `Please complete the details below to request a vehicle reservation for ${tenant.name}.`}
            </p>
            
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setActiveTab(activeTab === 'form' ? 'calendar' : 'form')}
                className="inline-flex items-center bg-white hover:bg-slate-100 text-indigo-950 font-bold px-4 py-2.5 rounded-xl text-sm shadow-md transition cursor-pointer active:scale-95"
              >
                <CalendarIcon className="w-4 h-4 mr-2 text-indigo-700" />
                {activeTab === 'form' ? 'View Fleet Calendar & Availability' : 'Back to Booking Form'}
              </button>
            </div>
          </div>
        </div>

        {/* Content View: Calendar Mode vs Form Mode */}
        {activeTab === 'calendar' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900">Live Organization Calendar</h2>
                <p className="text-xs text-slate-500">Public access • Real-time vehicle schedule & trip logs</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setActiveTab('form');
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <span>+ Submit New Booking</span>
              </button>
            </div>

            <CalendarView
              isPublic={true}
              customBookings={bookings}
              customUsers={users}
              customVehicles={vehicles}
              onRequestBooking={() => {
                setIsSuccess(false);
                setActiveTab('form');
              }}
            />
          </div>
        ) : isSuccess && submitResult ? (
          /* Success / Confirmation View */
          <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden max-w-3xl mx-auto flex flex-col">
            {/* Header */}
            <div className={`p-6 flex items-start justify-between border-b ${submitResult.status === 'Confirmed' ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
              <div className="flex items-center space-x-3.5">
                {submitResult.status === 'Confirmed' ? (
                  <div className="p-2.5 bg-emerald-100 rounded-full text-emerald-600 flex-shrink-0">
                    <CheckCircleIcon className="h-8 w-8 text-emerald-600" />
                  </div>
                ) : (
                  <div className="p-2.5 bg-rose-100 rounded-full text-rose-600 flex-shrink-0">
                    <XCircleIcon className="h-8 w-8 text-rose-600" />
                  </div>
                )}
                <div>
                  <span className={`inline-block px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${submitResult.status === 'Confirmed' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                    {submitResult.status === 'Confirmed' ? 'CONFIRMED' : 'REJECTED AUTOMATICALLY'}
                  </span>
                  <h3 className="text-xl font-extrabold text-gray-900 mt-1">
                    {submitResult.status === 'Confirmed' ? 'Booking Confirmed Successfully' : 'Booking Automatically Rejected'}
                  </h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 sm:p-8 space-y-5 text-sm text-gray-700">
              {/* Main Status & Calendar Event Title */}
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
                  Google Calendar Event Title
                </div>
                <div className="font-mono text-sm font-bold text-gray-800 flex flex-wrap items-center justify-between gap-2">
                  <span className="break-all">{submitResult.calendarEventTitle}</span>
                  {submitResult.calendarColor && (
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded border ${colorBadgeStyle[submitResult.calendarColor] || 'bg-gray-100'}`}>
                      {submitResult.calendarColor.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Assignment Details Grid */}
              {submitResult.status === 'Confirmed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                    <div className="flex items-center space-x-2 text-indigo-900 font-semibold mb-1">
                      <UserCircleIcon className="h-5 w-5 text-indigo-700" />
                      <span>Assigned Driver</span>
                    </div>
                    <div className="text-gray-900 font-extrabold text-lg">
                      {submitResult.assignedDriverName || 'None (Self-Drive)'}
                    </div>
                    <div className="text-xs text-indigo-700 mt-1 font-medium">
                      {submitResult.assignedDriverName ? 'Scheduled auto-assignment' : 'Self-drive reservation'}
                    </div>
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                    <div className="flex items-center space-x-2 text-blue-900 font-semibold mb-1">
                      <TruckIcon className="h-5 w-5 text-blue-700" />
                      <span>Allocated Vehicle</span>
                    </div>
                    <div className="text-gray-900 font-extrabold text-lg">
                      {submitResult.assignedVehicleName || 'Any / Unassigned'}
                    </div>
                    <div className="text-xs text-blue-700 mt-1 font-medium">
                      {submitResult.assignedVehicleName ? 'Vehicle slot confirmed available' : 'Driver selects vehicle upon odometer check-in'}
                    </div>
                  </div>
                </div>
              )}

              {/* Pre-working-hour Warning */}
              {submitResult.isPreWorkingHour && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 text-amber-900 rounded-r-xl">
                  <div className="font-bold flex items-center space-x-2">
                    <ClockIcon className="h-5 w-5 text-amber-600" />
                    <span>Warning: Pre-Working Hour Assignment</span>
                  </div>
                  <p className="text-xs mt-1.5 text-amber-800 leading-relaxed font-medium">
                    This booking starts before official driver working hours. Please confirm manually with the on-duty driver ({submitResult.assignedDriverName}) and Head of Transportation prior to departure.
                  </p>
                </div>
              )}

              {/* System Notes */}
              {submitResult.adminNotes && (
                <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-xl border border-gray-200">
                  <span className="font-bold text-gray-800">System Notes: </span>
                  {submitResult.adminNotes}
                </div>
              )}

              {/* Trip Summary Details */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs sm:text-sm">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Reservation Summary
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-gray-700">
                  <p><b>Requester:</b> {formData.requesterName} {formData.department ? `(${formData.department})` : ''}</p>
                  <p><b>Purpose:</b> {formData.purpose}</p>
                  <p><b>Date & Time:</b> {formData.bookingDate} ({formData.startTime} - {formData.endTime || 'Completion'})</p>
                  <p><b>Pickup:</b> {getPickupLocationDisplay(formData.pickupPoint, formData.address)}</p>
                  <p className="sm:col-span-2"><b>Destination:</b> {formData.destination}</p>
                  <p><b>Passengers:</b> {formData.staffCount || 0} Staff, {formData.kidsCount || 0} Children, {formData.teenagersCount || 0} Teenagers</p>
                  <p><b>Driver Standby:</b> {formData.shouldWait ? 'Yes (Driver waiting on-site)' : 'No (Drop-off only)'}</p>
                  {attachmentFile && (
                    <p className="sm:col-span-2"><b>Attachment:</b> {attachmentFile.name}</p>
                  )}
                </div>
              </div>

              {/* Email Notification Preview */}
              {submitResult.emailNotifications && (
                <div className="pt-2 border-t border-gray-100 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                    Automated Email Dispatch
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {submitResult.emailNotifications.requester && (
                      <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-semibold text-gray-700">Requester Email:</span>
                        <span className="text-gray-600 truncate max-w-xs">{submitResult.emailNotifications.requester.to}</span>
                      </div>
                    )}
                    {submitResult.emailNotifications.driver && (
                      <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                        <span className="font-semibold text-gray-700">Driver Email:</span>
                        <span className="text-gray-600 truncate max-w-xs">{submitResult.emailNotifications.driver.to}</span>
                      </div>
                    )}
                    {submitResult.emailNotifications.admin && (
                      <div className="flex items-center justify-between p-2.5 bg-rose-50 rounded-lg border border-rose-100">
                        <span className="font-semibold text-rose-800">Admin Notification:</span>
                        <span className="text-rose-700 truncate max-w-xs">{submitResult.emailNotifications.admin.to}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-500 font-medium">
                Please contact the administrative team of {tenant.name} for any amendments.
              </p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsSuccess(false);
                    setActiveTab('calendar');
                  }}
                  className="px-4 py-2 bg-white hover:bg-slate-100 text-indigo-950 border border-indigo-200 font-semibold rounded-xl text-xs shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-3.5 h-3.5 text-indigo-700" />
                  View Fleet Calendar
                </button>
                <button
                  onClick={() => {
                    setFormData(emptyFormData);
                    setAttachmentFile(null);
                    setIsSuccess(false);
                    setSubmitResult(null);
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl shadow-md transition text-xs cursor-pointer"
                >
                  Submit Another Booking
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Main Form View */
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border">
            
            {/* Conflict Alert in-form */}
            {submitResult && submitResult.status === 'Conflict' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-950">
                <h3 className="font-extrabold text-base flex items-center gap-1.5 mb-1 text-red-800">
                  ⚠️ Schedule Conflict
                </h3>
                <p className="text-sm leading-relaxed">
                  {submitResult.conflictReason || 'All drivers or vehicles are unavailable for the selected date and time.'}
                </p>
                <p className="text-xs font-semibold mt-2 text-red-900">
                  Please select another date or time slot to avoid scheduling conflicts.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 1 & 2: Name & Department */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Requester Name</label>
                  <input
                    type="text"
                    name="requesterName"
                    value={formData.requesterName}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                    placeholder="Enter your full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value="" disabled>Select Department</option>
                    {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">Email Address</label>
                <input
                  type="email"
                  name="requesterEmail"
                  value={formData.requesterEmail}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="e.g. you@organization.org"
                />
              </div>

              {/* 3, 4, 5: Date & Time */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Date of Use</label>
                  <input
                    type="date"
                    name="bookingDate"
                    value={formData.bookingDate}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Start Time</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">End Time (Estimated)</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                  <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <span>Rest & Break Time Policy</span>
                </div>
                <div className="text-xs text-amber-950 leading-relaxed pl-7">
                  <p className="font-semibold">• Monday – Thursday & Sunday: 12:00 PM – 1:00 PM</p>
                  <p className="font-semibold">• Friday: 12:30 PM – 2:30 PM</p>
                  <p className="mt-2 text-amber-900 italic font-medium">
                    If a booking start time falls within driver rest periods, the system may reject or flag the booking to safeguard driver welfare.
                  </p>
                </div>
              </div>

              {/* Purpose */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Trip Purpose</label>
                <input
                  type="text"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="e.g. Official Meeting, Equipment Delivery, Youth Program"
                />
              </div>

              {/* Destination */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Destination / Full Address</label>
                <textarea
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="Enter detailed destination or address"
                ></textarea>
              </div>

              {/* Pickup Point */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Pickup Location</label>
                  <select
                    name="pickupPoint"
                    value={formData.pickupPoint}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value="" disabled>Select Location</option>
                    {PICKUP_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {isOtherPickup(formData.pickupPoint) && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800">Specify Pickup Address</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                      placeholder="Enter detailed pickup address"
                    />
                  </div>
                )}
              </div>

              {/* Passengers */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Passenger Count</label>
                <div className="grid grid-cols-3 gap-3 mt-1.5">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Staff</span>
                    <input
                      type="number"
                      min="0"
                      name="staffCount"
                      value={formData.staffCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Kids</span>
                    <input
                      type="number"
                      min="0"
                      name="kidsCount"
                      value={formData.kidsCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Teenagers</span>
                    <input
                      type="number"
                      min="0"
                      name="teenagersCount"
                      value={formData.teenagersCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Standby / Waiting */}
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="shouldWait"
                    checked={formData.shouldWait}
                    onChange={(e) => setFormData(prev => ({ ...prev, shouldWait: e.target.checked }))}
                    className="h-5 w-5 rounded text-amber-600 border-gray-300 focus:ring-amber-500 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900">⏳ Driver Standby Required On-Site?</span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Check this if the driver must wait on-site to provide return transport after the event completes.
                    </p>
                  </div>
                </label>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Service Type</label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                >
                  <option value="" disabled>Select Service Type</option>
                  <option value="Perlu Driver">Driver Assigned (Driven by organization driver staff)</option>
                  <option value="Self-Drive">Self-Drive (Drive yourself - Alza vehicle only)</option>
                </select>
              </div>

              {formData.serviceType === 'Perlu Driver' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Vehicle Preference</label>
                  <select
                    name="vehiclePreference"
                    value={formData.vehiclePreference}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value={FREE_VEHICLE_CHOICE}>Any / Free Choice (No preference - Driver selects upon dispatch)</option>
                    {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              )}

              {formData.serviceType === 'Self-Drive' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Driver IC / ID Number (Driving License)</label>
                  <input
                    type="text"
                    name="icNumber"
                    value={formData.icNumber}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                    placeholder="e.g. 900101-14-5566"
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Additional Notes / Remarks (Optional)</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="Enter any special instructions or notes"
                ></textarea>
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Attachment / Approval Letter (Optional)</label>
                {!attachmentFile ? (
                  <input
                    id="public-attachment-input"
                    type="file"
                    onChange={handleFileChange}
                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                  />
                ) : (
                  <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-2 truncate">
                      <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                      <span className="text-sm text-gray-700 truncate">{attachmentFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-sm font-medium text-red-600 hover:text-red-800 ml-2 cursor-pointer"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition disabled:bg-indigo-400 flex items-center justify-center space-x-2 cursor-pointer"
                >
                  {isSubmitting || isUploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Submitting Booking...</span>
                    </>
                  ) : (
                    <span>Submit Booking Request</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        <div className="text-center mt-8 text-xs text-gray-400 font-medium">
          Powered by FleetFlow Smart SaaS Transportation Platform &copy; 2026
        </div>
      </div>
    </div>
  );
};
