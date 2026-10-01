import React, { useState, useEffect, useMemo } from 'react';
import { storageService } from '../services/storage';
import { googleCalendarService } from '../services/googleCalendar';
import { DEPARTMENTS, PICKUP_POINTS, Tenant, Booking, PassengerCount } from '../types';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, type AutoAssignResult } from '../services/bookingEngine';
import { isOtherPickup, getPickupLocationDisplay } from '../utils';
import { 
  ClockIcon, 
  PaperClipIcon, 
  CheckCircleIcon, 
  CalendarIcon, 
  UserCircleIcon, 
  TruckIcon, 
  XCircleIcon,
  LocationMarkerIcon,
  ArrowUpCircleIcon,
  UserGroupIcon,
  BuildingOfficeIcon,
  DocumentTextIcon
} from './icons/Icons';
import CalendarView from './CalendarView';

interface PublicBookingPageProps {
  tenantId: string;
  initialTab?: 'form' | 'calendar';
}

const OTHER_PICKUP = 'Other Location (Please Specify)';
const FREE_VEHICLE_CHOICE = 'Any / Free Choice';

const colorBadgeStyle: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
  green: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  grey: 'bg-slate-100 text-slate-800 border-slate-200',
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  teal: 'bg-teal-100 text-teal-800 border-teal-200',
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
  staffCount: 1,
  kidsCount: 0,
  teenagersCount: 0,
  serviceType: 'Perlu Driver' as 'Perlu Driver' | 'Self-Drive',
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<AutoAssignResult | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Initialize and load tenant data
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

  const updatePassengerCount = (field: 'staffCount' | 'kidsCount' | 'teenagersCount', delta: number) => {
    setFormData(prev => {
      const current = Number(prev[field]) || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [field]: updated };
    });
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

  const totalPassengers = useMemo(() => {
    return (Number(formData.staffCount) || 0) + (Number(formData.kidsCount) || 0) + (Number(formData.teenagersCount) || 0);
  }, [formData.staffCount, formData.kidsCount, formData.teenagersCount]);

  // Check if start time falls into driver break hours
  const breakTimeWarning = useMemo(() => {
    if (!formData.bookingDate || !formData.startTime) return null;
    try {
      const dayOfWeek = new Date(`${formData.bookingDate}T00:00:00`).getDay();
      const isFriday = dayOfWeek === 5;
      const start = normalizeTime(formData.startTime);

      if (isFriday) {
        if (start >= '12:30' && start < '14:30') {
          return 'Friday prayer & lunch break (12:30 PM - 2:30 PM). Bookings during this period may clash with driver availability.';
        }
      } else {
        if (start >= '12:00' && start < '13:00') {
          return 'Official lunch break (12:00 PM - 1:00 PM). System will prioritize driver welfare or flag for review.';
        }
      }
    } catch {
      return null;
    }
    return null;
  }, [formData.bookingDate, formData.startTime]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (Number(formData.teenagersCount) > 0) passengers.push({ category: 'Teenagers', count: Number(formData.teenagersCount) });
    
    if (passengers.length === 0) {
      alert('Please enter at least 1 passenger (Staff, Children, or Teenagers).');
      return;
    }

    if (!formData.serviceType) {
      alert('Please select the required Service Type (Driver Assigned or Self-Drive).');
      return;
    }

    if (isOtherPickup(formData.pickupPoint) && !formData.address.trim()) {
      alert('Please specify the detailed pickup address.');
      return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
      alert('Please enter IC / Driving License ID Number for self-drive authorization.');
      return;
    }

    setIsSubmitting(true);

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

    // Evaluate auto assignment engine
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = formData.endTime
      ? `${formData.bookingDate}T${formData.endTime}:00`
      : undefined;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
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
        const calEventId = await googleCalendarService.createEvent(tenant, newBooking, vehicles, users);
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
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      alert('Error saving booking: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-6">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto mb-4"></div>
          <h3 className="text-base font-bold text-slate-800">Loading Reservation Portal...</h3>
          <p className="text-xs text-slate-500 mt-1">Connecting to fleet database & schedule engine</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl text-center max-w-md border border-slate-200">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl inline-block mb-3">
            <XCircleIcon className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-black text-slate-900 mb-2">Organization Not Found</h2>
          <p className="text-slate-600 text-xs sm:text-sm mb-6 leading-relaxed">
            This reservation link is invalid or the organization ID parameter (<code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">{tenantId}</code>) is missing from the system.
          </p>
          <a 
            href="/" 
            className="inline-block px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-xs hover:bg-indigo-700 transition shadow-xs"
          >
            Back to Armada Flow
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100 flex flex-col items-center py-6 sm:py-10 px-3 sm:px-6">
      <div className={`w-full transition-all duration-300 ${activeTab === 'calendar' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        
        {/* ========================================================================= */}
        {/* TOP BRANDING & TAB BAR                                                    */}
        {/* ========================================================================= */}
        <div className="bg-slate-900 rounded-3xl shadow-xl border border-slate-800 p-5 sm:p-7 text-white mb-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-5 pointer-events-none">
            <TruckIcon className="w-64 h-64 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold tracking-wide uppercase">
                <BuildingOfficeIcon className="w-4 h-4 text-indigo-400" />
                <span>{tenant.companyName || tenant.name}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Transportation Portal</span>
              </div>
              
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {activeTab === 'calendar' ? 'Live Fleet Schedule & Availability' : 'Official Vehicle Booking Request'}
              </h1>
              
              <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed">
                {activeTab === 'calendar'
                  ? `Real-time availability schedule for ${tenant.name}. Check confirmed trips and driver allocations.`
                  : `Submit your vehicle reservation request. Our smart schedule engine handles driver and fleet assignment automatically.`}
              </p>
            </div>

            {/* Interactive View Switcher Tabs */}
            <div className="flex items-center bg-slate-800/90 p-1.5 rounded-2xl border border-slate-700/80 shadow-inner self-start md:self-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('form');
                  setIsSuccess(false);
                }}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'form'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <DocumentTextIcon className="w-4 h-4" />
                <span>Booking Form</span>
              </button>
              
              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <CalendarIcon className="w-4 h-4" />
                <span>Live Calendar</span>
              </button>
            </div>
          </div>

          {/* Quick policy bar */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <ClockIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Driver Rest Hours: 12:00 PM – 1:00 PM (Mon-Thu) • 12:30 PM – 2:30 PM (Fri)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPolicyModal(true)}
              className="text-indigo-300 hover:text-indigo-200 underline font-semibold cursor-pointer"
            >
              View Rest Policy Details
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CALENDAR VIEW                                                      */}
        {/* ========================================================================= */}
        {activeTab === 'calendar' ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  Fleet Vehicle & Driver Schedule
                </h2>
                <p className="text-xs text-slate-500">
                  Showing all active bookings for {tenant.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsSuccess(false);
                  setActiveTab('form');
                }}
                className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <span>+ Make a Reservation</span>
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
          /* ========================================================================= */
          /* SUCCESS CONFIRMATION RECEIPT SCREEN                                       */
          /* ========================================================================= */
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden max-w-3xl mx-auto animate-fadeIn">
            {/* Header banner */}
            <div className={`p-6 sm:p-8 flex items-start gap-4 border-b ${
              submitResult.status === 'Confirmed' 
                ? 'bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 border-emerald-100' 
                : 'bg-gradient-to-r from-rose-50 via-amber-50 to-rose-50 border-rose-100'
            }`}>
              <div className={`p-3 rounded-2xl shrink-0 ${
                submitResult.status === 'Confirmed' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'bg-rose-600 text-white shadow-sm'
              }`}>
                {submitResult.status === 'Confirmed' ? (
                  <CheckCircleIcon className="h-7 w-7 text-white" />
                ) : (
                  <XCircleIcon className="h-7 w-7 text-white" />
                )}
              </div>
              <div className="space-y-1">
                <span className={`inline-block px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wider ${
                  submitResult.status === 'Confirmed' 
                    ? 'bg-emerald-200/80 text-emerald-900' 
                    : 'bg-rose-200/80 text-rose-900'
                }`}>
                  {submitResult.status === 'Confirmed' ? '✓ Booking Confirmed & Scheduled' : '⚠️ Action Required / Conflict'}
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-slate-900">
                  {submitResult.status === 'Confirmed' 
                    ? 'Reservation Successfully Confirmed!' 
                    : 'Booking Request Flagged'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  {submitResult.status === 'Confirmed'
                    ? 'Your trip has been registered and synced with Google Calendar.'
                    : submitResult.conflictReason || 'Please review the schedule conflict details below.'}
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700">
              {/* Event Title pill */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-1">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider block">
                  Calendar Event Entry
                </span>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-sm font-bold text-slate-900 break-all">
                    {submitResult.calendarEventTitle}
                  </p>
                  {submitResult.calendarColor && (
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-lg border ${colorBadgeStyle[submitResult.calendarColor] || 'bg-slate-100'}`}>
                      {submitResult.calendarColor.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* Assignment Grid */}
              {submitResult.status === 'Confirmed' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="p-4 bg-indigo-50/70 border border-indigo-100 rounded-2xl space-y-1">
                    <div className="flex items-center gap-1.5 text-indigo-900 font-bold text-xs">
                      <UserCircleIcon className="h-4 w-4 text-indigo-600" />
                      <span>Assigned Driver</span>
                    </div>
                    <p className="text-slate-900 font-extrabold text-base">
                      {submitResult.assignedDriverName || (formData.serviceType === 'Self-Drive' ? '🚗 Self-Drive (Pandu Sendiri)' : 'Unassigned')}
                    </p>
                    <p className="text-[11px] text-indigo-700 font-medium">
                      {submitResult.assignedDriverName ? 'Auto-allocated by duty schedule' : 'Kakitangan memandu sendiri (Perodua Alza)'}
                    </p>
                  </div>

                  <div className="p-4 bg-teal-50/70 border border-teal-100 rounded-2xl space-y-1">
                    <div className="flex items-center gap-1.5 text-teal-900 font-bold text-xs">
                      <TruckIcon className="h-4 w-4 text-teal-600" />
                      <span>Allocated Vehicle</span>
                    </div>
                    <p className="text-slate-900 font-extrabold text-base">
                      {submitResult.assignedVehicleName || 'Any / Driver Selection'}
                    </p>
                    <p className="text-[11px] text-teal-700 font-medium">
                      {submitResult.assignedVehicleName ? 'Vehicle slot reserved' : 'Pemandu memilih kenderaan semasa pelepasan'}
                    </p>
                  </div>
                </div>
              )}

              {/* Pre-working warning */}
              {submitResult.isPreWorkingHour && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-xs">
                    <ClockIcon className="h-4 w-4 text-amber-600" />
                    <span>Advisory: Pre-Working Hour Departure</span>
                  </div>
                  <p className="text-xs text-amber-800 leading-relaxed font-medium">
                    This trip starts before standard working hours. Please confirm directly with driver ({submitResult.assignedDriverName}) and admin office prior to departure.
                  </p>
                </div>
              )}

              {/* Trip Summary Card */}
              <div className="p-4 sm:p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <span className="text-[11px] font-extrabold uppercase text-slate-500 tracking-wider block">
                  Trip Summary Details
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium block">Requester PIC:</span>
                    <p className="font-bold text-slate-900">{formData.requesterName} {formData.department ? `(${formData.department})` : ''}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Date & Timing:</span>
                    <p className="font-bold text-slate-900">{formData.bookingDate} • {formData.startTime} {formData.endTime ? `– ${formData.endTime}` : ''}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Pickup Point:</span>
                    <p className="font-bold text-slate-900">{getPickupLocationDisplay(formData.pickupPoint, formData.address)}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Destination:</span>
                    <p className="font-bold text-slate-900">{formData.destination}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Passengers:</span>
                    <p className="font-bold text-slate-900">{totalPassengers} Pax ({[
                      formData.staffCount ? `${formData.staffCount} Staff` : '',
                      formData.kidsCount ? `${formData.kidsCount} Children` : '',
                      formData.teenagersCount ? `${formData.teenagersCount} Teens` : '',
                    ].filter(Boolean).join(', ')})</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium block">Driver Standby:</span>
                    <p className="font-bold text-slate-900">{formData.shouldWait ? '⏳ Standby On-Site' : '🚗 Drop-Off Only'}</p>
                  </div>
                </div>

                {formData.remarks && (
                  <div className="pt-2 border-t border-slate-200">
                    <span className="text-slate-400 font-medium block text-[11px]">Special Instructions:</span>
                    <p className="text-slate-700 italic text-xs mt-0.5">{formData.remarks}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="p-5 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500 font-medium">
                Notification emails sent to requester & assigned driver.
              </p>
              
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setIsSuccess(false);
                    setActiveTab('calendar');
                  }}
                  className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-bold rounded-xl text-xs shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                >
                  <CalendarIcon className="w-4 h-4 text-indigo-600" />
                  <span>View Fleet Calendar</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setFormData(emptyFormData);
                    setAttachmentFile(null);
                    setIsSuccess(false);
                    setSubmitResult(null);
                  }}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition text-xs cursor-pointer"
                >
                  + Make Another Booking
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ========================================================================= */
          /* MAIN FORM VIEW (4 SECTIONED CARDS)                                       */
          /* ========================================================================= */
          <div className="space-y-6">
            
            {/* Conflict Alert Banner */}
            {submitResult && submitResult.status === 'Conflict' && (
              <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-950 space-y-2 animate-fadeIn">
                <div className="flex items-center gap-2 text-rose-800 font-extrabold text-sm sm:text-base">
                  <XCircleIcon className="w-5 h-5 text-rose-600 shrink-0" />
                  <span>Schedule Conflict Detected</span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-rose-900 font-medium">
                  {submitResult.conflictReason || 'No drivers or vehicles are available during the requested time window.'}
                </p>
                <p className="text-xs font-bold text-rose-700 pt-1">
                  💡 Please adjust your date, start time, or choose Self-Drive option to avoid conflicts.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              
              {/* ------------------------------------------------------------- */}
              {/* CARD 1: REQUESTER PROFILE                                     */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs">
                    01
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Requester Profile (Maklumat Pemohon)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Enter your official contact details for schedule invites & updates
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name (Nama Pemohon) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="requesterName"
                      value={formData.requesterName}
                      onChange={handleChange}
                      required
                      placeholder="e.g. Nur Ain / Ahmad Farhan"
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Department (Jabatan / Unit) <span className="text-rose-500">*</span>
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
                    placeholder="e.g. ain@yck.org.my"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Google Calendar invitations and booking confirmation will be dispatched here.
                  </p>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* CARD 2: TRIP SCHEDULE & TIMING                                */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs">
                    02
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Date & Schedule (Tarikh & Masa Perjalanan)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Define your departure date and estimated trip duration
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Date of Use <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      name="bookingDate"
                      value={formData.bookingDate}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Start Time (Masa Mula) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="time"
                      name="startTime"
                      value={formData.startTime}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Estimated End Time (Masa Tamat)
                    </label>
                    <input
                      type="time"
                      name="endTime"
                      value={formData.endTime}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                    />
                  </div>
                </div>

                {/* Realtime Break Time Warning Notice */}
                {breakTimeWarning && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-2.5 text-amber-900 animate-fadeIn">
                    <ClockIcon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                    <div className="text-xs space-y-0.5">
                      <span className="font-extrabold uppercase tracking-wide text-[10px] text-amber-800 block">
                        Driver Break Time Warning
                      </span>
                      <p className="font-medium leading-relaxed">{breakTimeWarning}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------------------------------------- */}
              {/* CARD 3: ROUTE & LOCATIONS                                     */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-4">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs">
                    03
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Destination & Route (Destinasi & Pengambilan)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Specify pickup point and target destination
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Trip Purpose (Tujuan Perjalanan) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="purpose"
                    value={formData.purpose}
                    onChange={handleChange}
                    required
                    placeholder="e.g. Program Komuniti, Penghantaran Bantuan, Mesyuarat Rasmi"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Pickup Point (Lokasi Pengambilan) <span className="text-rose-500">*</span>
                    </label>
                    <select
                      name="pickupPoint"
                      value={formData.pickupPoint}
                      onChange={handleChange}
                      required
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value="" disabled>Select Pickup Point</option>
                      {PICKUP_POINTS.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>

                  {isOtherPickup(formData.pickupPoint) ? (
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
                        placeholder="Enter full pickup address"
                        className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 flex items-center gap-2 text-slate-600 text-xs font-medium">
                      <ArrowUpCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{formData.pickupPoint ? `Pickup: ${formData.pickupPoint}` : 'Select a pickup point on the left'}</span>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Destination / Full Address (Destinasi Lengkap) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    name="destination"
                    value={formData.destination}
                    onChange={handleChange}
                    required
                    rows={2}
                    placeholder="e.g. Pusat Komuniti Chow Kit, Kuala Lumpur / Dewan Serbaguna"
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition resize-y"
                  ></textarea>
                </div>
              </div>

              {/* ------------------------------------------------------------- */}
              {/* CARD 4: SERVICE TYPE, CAPACITY & PASSENGERS                   */}
              {/* ------------------------------------------------------------- */}
              <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-5 sm:p-7 space-y-5">
                <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl font-black text-xs">
                    04
                  </div>
                  <div>
                    <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                      Service Type & Passengers (Jenis Servis & Penumpang)
                    </h2>
                    <p className="text-xs text-slate-500">
                      Choose driver allocation mode and passenger numbers
                    </p>
                  </div>
                </div>

                {/* Interactive Service Type Cards */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Service Option <span className="text-rose-500">*</span>
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Option 1: Perlu Driver */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, serviceType: 'Perlu Driver' }))}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3.5 ${
                        formData.serviceType === 'Perlu Driver'
                          ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        formData.serviceType === 'Perlu Driver' 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <UserCircleIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                          Perlu Driver (Driver Assigned)
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Pemandu rasmi yayasan akan diperuntukkan mengikut jadual tugas.
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Self Drive */}
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, serviceType: 'Self-Drive' }))}
                      className={`p-4 rounded-2xl border text-left transition cursor-pointer flex items-start gap-3.5 ${
                        formData.serviceType === 'Self-Drive'
                          ? 'bg-teal-50/80 border-teal-500 ring-2 ring-teal-500/20 shadow-xs'
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl shrink-0 ${
                        formData.serviceType === 'Self-Drive' 
                          ? 'bg-teal-600 text-white' 
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        <TruckIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="font-extrabold text-xs sm:text-sm text-slate-900 block">
                          Self-Drive (Pandu Sendiri)
                        </span>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                          Kakitangan pandu kenderaan yayasan (Perodua Alza) sendiri.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Sub-option depending on Service Type */}
                {formData.serviceType === 'Perlu Driver' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Vehicle Preference (Pilihan Kenderaan)
                    </label>
                    <select
                      name="vehiclePreference"
                      value={formData.vehiclePreference}
                      onChange={handleChange}
                      className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition text-slate-800"
                    >
                      <option value={FREE_VEHICLE_CHOICE}>
                        🚗 Any / Free Choice (Pemandu tentukan kenderaan semasa tugasan)
                      </option>
                      <optgroup label="Dedicated Fleet">
                        {vehicles.map(v => (
                          <option key={v.id} value={v.name}>
                            🚐 {v.name} ({v.plateNumber}) {v.vehicleType ? `- ${v.vehicleType}` : ''}
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>
                ) : (
                  <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-2xl space-y-2 animate-fadeIn">
                    <label className="block text-xs font-bold text-teal-950 uppercase tracking-wider">
                      Staff Driver IC / ID Number (No. Kad Pengenalan) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      name="icNumber"
                      value={formData.icNumber}
                      onChange={handleChange}
                      required
                      placeholder="e.g. 920815-10-5432"
                      className="w-full px-3.5 py-2.5 border border-teal-200 rounded-xl text-xs sm:text-sm font-mono bg-white text-slate-900 focus:ring-2 focus:ring-teal-500 outline-none"
                    />
                    <p className="text-[11px] text-teal-800 font-medium">
                      ⚠️ Diperlukan untuk rekod lesen memandu dan pengesahan kunci kenderaan Perodua Alza.
                    </p>
                  </div>
                )}

                {/* Passenger Steppers */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Passenger Breakdown (Pecahan Penumpang)
                    </label>
                    <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Total: {totalPassengers} Pax
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Staff Stepper */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                      <span className="text-xs font-extrabold text-slate-700 block">Kakitangan (Staff)</span>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('staffCount', -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          name="staffCount"
                          value={formData.staffCount}
                          onChange={handleChange}
                          className="w-14 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg py-1 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('staffCount', 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Kids Stepper */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                      <span className="text-xs font-extrabold text-slate-700 block">Kanak-kanak (Kids)</span>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('kidsCount', -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          name="kidsCount"
                          value={formData.kidsCount}
                          onChange={handleChange}
                          className="w-14 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg py-1 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('kidsCount', 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    {/* Teens Stepper */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-2">
                      <span className="text-xs font-extrabold text-slate-700 block">Remaja (Teenagers)</span>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('teenagersCount', -1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min="0"
                          name="teenagersCount"
                          value={formData.teenagersCount}
                          onChange={handleChange}
                          className="w-14 text-center font-bold text-sm bg-white border border-slate-300 rounded-lg py-1 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => updatePassengerCount('teenagersCount', 1)}
                          className="w-8 h-8 rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold flex items-center justify-center cursor-pointer active:scale-95 transition"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Driver Standby / Waiting toggle card */}
                <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      name="shouldWait"
                      checked={formData.shouldWait}
                      onChange={(e) => setFormData(prev => ({ ...prev, shouldWait: e.target.checked }))}
                      className="h-5 w-5 rounded text-amber-600 border-slate-300 focus:ring-amber-500 mt-0.5 cursor-pointer"
                    />
                    <div>
                      <span className="text-xs sm:text-sm font-extrabold text-amber-950 block">
                        ⏳ Driver Standby On-Site (Pemandu Tunggu di Lokasi)
                      </span>
                      <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                        Tandakan sekiranya pemandu perlu menunggu di lokasi program untuk perjalanan pulang. Jika tidak, pemandu hanya akan menghantar dan dilepaskan (*Drop-off only*).
                      </p>
                    </div>
                  </label>
                </div>

                {/* Additional Notes / Remarks */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Special Instructions / Notes (Nota Tambahan - Pilihan)
                  </label>
                  <textarea
                    name="remarks"
                    value={formData.remarks}
                    onChange={handleChange}
                    rows={2}
                    placeholder="Contoh: Bawa peralatan program, peserta berkerusi roda, dll."
                    className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition resize-y"
                  ></textarea>
                </div>

                {/* Modern File Attachment Dropzone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Supporting Document / Surat Kelulusan (Pilihan)
                  </label>
                  
                  {!attachmentFile ? (
                    <div className="p-4 border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-indigo-50/30 rounded-2xl text-center transition cursor-pointer relative">
                      <input
                        id="public-attachment-input"
                        type="file"
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                      <PaperClipIcon className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs font-bold text-slate-700">Click to browse or drop file</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">PDF, PNG, JPG up to 10MB</p>
                    </div>
                  ) : (
                    <div className="p-3 bg-indigo-50 rounded-2xl border border-indigo-200 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        <PaperClipIcon className="w-5 h-5 text-indigo-600 shrink-0" />
                        <span className="text-xs font-bold text-indigo-950 truncate">{attachmentFile.name}</span>
                        <span className="text-[10px] text-indigo-600 font-mono">({(attachmentFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                      <button
                        type="button"
                        onClick={removeAttachment}
                        className="text-xs font-extrabold text-rose-600 hover:text-rose-800 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

              </div>

              {/* ------------------------------------------------------------- */}
              {/* SUBMIT BUTTON                                                 */}
              {/* ------------------------------------------------------------- */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black py-4 px-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 disabled:bg-slate-400 flex items-center justify-center gap-2 cursor-pointer active:scale-98 text-sm sm:text-base"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Processing & Auto-Assigning Schedule...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Vehicle Reservation Request</span>
                      <span className="text-indigo-400">→</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-8 text-xs text-slate-400 font-medium">
          Armada Flow Smart Fleet Platform • {tenant.companyName || tenant.name} &copy; 2026
        </div>
      </div>

      {/* Policy Modal */}
      {showPolicyModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <ClockIcon className="w-5 h-5 text-amber-500" />
                <span>Driver Rest & Welfare Policy</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700 leading-relaxed">
              <p>
                To ensure driver road safety and welfare, the following break times are observed:
              </p>
              
              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 font-medium space-y-1.5 text-amber-950">
                <p>• <b>Monday – Thursday:</b> 12:00 PM – 1:00 PM (Lunch Break)</p>
                <p>• <b>Friday:</b> 12:30 PM – 2:30 PM (Friday Prayer & Rest)</p>
              </div>

              <p className="text-slate-500 text-[11px]">
                Bookings starting during these slots may require special manual admin clearance. Please schedule departures outside rest periods whenever possible.
              </p>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPolicyModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
