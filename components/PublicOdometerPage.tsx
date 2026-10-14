import React, { useState, useEffect, useMemo } from 'react';
import { storageService } from '../services/storage';
import { Tenant, Vehicle, Booking, OdometerLog, SelfDriveStaff } from '../types';
import { VEHICLES } from '../constants';
import { 
  GaugeIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  CalendarIcon, 
  TruckIcon, 
  UserCircleIcon,
  InformationCircleIcon, 
  SearchIcon,
  ChevronDownIcon
} from './icons/Icons';

interface PublicOdometerPageProps {
  tenantId: string;
}

export const PublicOdometerPage: React.FC<PublicOdometerPageProps> = ({ tenantId }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [selfDriveStaff, setSelfDriveStaff] = useState<SelfDriveStaff[]>([]);
  const [loading, setLoading] = useState(true);

  // Form State
  const [selectedBookingId, setSelectedBookingId] = useState<string>('manual');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [customStaffName, setCustomStaffName] = useState<string>('');
  
  // Single Unified Odometer: Start & End in one place
  const [startOdometer, setStartOdometer] = useState<string>('');
  const [endOdometer, setEndOdometer] = useState<string>('');
  const [date, setDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [destination, setDestination] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<any | null>(null);

  // Search filter for scheduled bookings
  const [bookingSearch, setBookingSearch] = useState('');

  // Load tenant, fleet vehicles, bookings, odometer logs & authorized self-drive staff
  useEffect(() => {
    const effectiveTenantId = tenantId || localStorage.getItem('fleetflow_tenant_id') || storageService.getTenantId() || 'yayasan-chow-kit-demo';
    storageService.setTenantId(effectiveTenantId);

    Promise.all([
      storageService.getTenant(effectiveTenantId),
      storageService.getVehicles(),
      storageService.getBookings(),
      storageService.getOdometerLogs(),
      storageService.getSelfDriveStaff(),
    ])
      .then(([t, v, b, o, s]) => {
        setTenant(t);
        const resolvedVehicles = (v && v.length > 0) ? v : VEHICLES;
        setVehicles(resolvedVehicles);
        setBookings(b || []);
        setOdometerLogs(o || []);
        setSelfDriveStaff((s || []).filter(staff => staff.status === 'active'));

        if (resolvedVehicles.length > 0) {
          // Default to Alza if available
          const alza = resolvedVehicles.find(veh => 
            (veh.name && veh.name.toLowerCase().includes('alza')) || 
            (veh.specifications && veh.specifications.toLowerCase().includes('alza'))
          );
          const chosenVehicle = alza || resolvedVehicles[0];
          setSelectedVehicleId(chosenVehicle.id);

          // Find latest known odometer reading for chosen vehicle
          const latestLog = (o || [])
            .filter(l => l.vehicleId === chosenVehicle.id)
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
          if (latestLog && latestLog.odometer) {
            setStartOdometer(String(latestLog.odometer));
          }
        }
      })
      .catch((err) => {
        console.error('Error loading data for public odometer portal:', err);
        setVehicles(VEHICLES);
        if (VEHICLES.length > 0) {
          setSelectedVehicleId(VEHICLES[0].id);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [tenantId]);

  // Selected vehicle details & latest known odometer
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId);
  }, [vehicles, selectedVehicleId]);

  const latestVehicleOdometer = useMemo(() => {
    if (!selectedVehicleId) return null;
    const logs = odometerLogs
      .filter(l => l.vehicleId === selectedVehicleId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return logs.length > 0 && logs[0].odometer ? logs[0].odometer : null;
  }, [odometerLogs, selectedVehicleId]);

  // Whenever vehicle changes, update start odometer default if empty
  const handleVehicleChange = (newVehId: string) => {
    setSelectedVehicleId(newVehId);
    const logs = odometerLogs
      .filter(l => l.vehicleId === newVehId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (logs.length > 0 && logs[0].odometer) {
      setStartOdometer(String(logs[0].odometer));
    }
  };

  // Active / Upcoming Self-Drive bookings
  const relevantBookings = useMemo(() => {
    return bookings.filter(b => {
      const isSelfDriveOrOpen = b.serviceType === 'Self-Drive' || !b.driverId;
      const isNotCancelled = b.status !== 'Cancelled';
      const matchesSearch = 
        (b.requesterName || '').toLowerCase().includes(bookingSearch.toLowerCase()) ||
        (b.purpose || '').toLowerCase().includes(bookingSearch.toLowerCase()) ||
        (b.destination || '').toLowerCase().includes(bookingSearch.toLowerCase());
      return isSelfDriveOrOpen && isNotCancelled && matchesSearch;
    });
  }, [bookings, bookingSearch]);

  // When a booking is selected, prepopulate fields
  const handleSelectBooking = (b: Booking) => {
    setSelectedBookingId(b.id);
    
    // Check if requester matches an authorized staff
    const matchingStaff = selfDriveStaff.find(
      s => s.name.trim().toLowerCase() === (b.requesterName || '').trim().toLowerCase()
    );
    if (matchingStaff) {
      setSelectedStaffId(matchingStaff.id);
      setCustomStaffName('');
    } else {
      setSelectedStaffId('other');
      setCustomStaffName(b.requesterName || '');
    }

    setPurpose(b.purpose || '');
    setDestination(b.destination || '');
    if (b.vehicleId) {
      setSelectedVehicleId(b.vehicleId);
    }
    
    if (b.startOdometer) {
      setStartOdometer(String(b.startOdometer));
    } else if (b.vehicleId) {
      const latestLog = odometerLogs
        .filter(l => l.vehicleId === b.vehicleId)
        .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
      if (latestLog && latestLog.odometer) {
        setStartOdometer(String(latestLog.odometer));
      }
    }
  };

  const handleManualChoice = () => {
    setSelectedBookingId('manual');
    setPurpose('');
    setDestination('');
  };

  // Distance calculation: End Odometer - Start Odometer
  const calculatedDistance = useMemo(() => {
    const startVal = parseFloat(startOdometer);
    const endVal = parseFloat(endOdometer);
    if (!isNaN(startVal) && !isNaN(endVal) && endVal >= startVal) {
      return Math.round((endVal - startVal) * 10) / 10;
    }
    return null;
  }, [startOdometer, endOdometer]);

  // Resolved staff name
  const effectiveStaffName = useMemo(() => {
    if (selectedStaffId === 'other') {
      return customStaffName.trim();
    }
    const staff = selfDriveStaff.find(s => s.id === selectedStaffId);
    return staff ? staff.name : customStaffName.trim();
  }, [selectedStaffId, selfDriveStaff, customStaffName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const startNum = parseFloat(startOdometer);
    const endNum = parseFloat(endOdometer);

    if (isNaN(startNum) || startNum <= 0) {
      setFormError('Please enter a valid Start Odometer reading.');
      return;
    }

    if (isNaN(endNum) || endNum <= 0) {
      setFormError('Please enter a valid End Odometer reading.');
      return;
    }

    if (endNum < startNum) {
      setFormError(`End Odometer (${endNum} km) cannot be less than Start Odometer (${startNum} km).`);
      return;
    }

    if (!selectedVehicleId) {
      setFormError('Please select a vehicle.');
      return;
    }

    if (!effectiveStaffName) {
      setFormError('Please select or specify the staff member name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const vehicle = vehicles.find(v => v.id === selectedVehicleId);
      const logId = `odo-pub-${Date.now()}`;
      const distanceTraveled = calculatedDistance !== null ? calculatedDistance : Math.round((endNum - startNum) * 10) / 10;

      // 1. Create Odometer Log (capturing both start & end odometer readings)
      const newOdoLog: OdometerLog = {
        id: logId,
        driverId: `staff-${effectiveStaffName.replace(/\s+/g, '-').toLowerCase()}`,
        staffName: effectiveStaffName,
        vehicleId: selectedVehicleId,
        date: date,
        startOdometer: startNum,
        odometer: endNum,
        distance: distanceTraveled,
        purpose: purpose || 'Official Staff Self-Drive Trip',
        toLocation: destination || undefined,
        remarks: remarks ? `${remarks} (Logged by: ${effectiveStaffName})` : `Logged by: ${effectiveStaffName}`,
        bookingId: selectedBookingId !== 'manual' ? selectedBookingId : undefined,
        tenantId,
      };

      await storageService.createOdometerLog(newOdoLog);

      // 2. If connected to a booking, update the booking state with start & end odometers
      if (selectedBookingId !== 'manual') {
        const targetBooking = bookings.find(b => b.id === selectedBookingId);
        if (targetBooking) {
          await storageService.updateBooking({
            id: targetBooking.id,
            startOdometer: startNum,
            endOdometer: endNum,
            distance: distanceTraveled,
            vehicleId: selectedVehicleId,
            status: 'Completed',
          });
        }
      }

      // 3. Save summary for confirmation view
      setSubmittedSummary({
        vehicleName: vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : 'Vehicle',
        staffName: effectiveStaffName,
        startReading: startNum,
        endReading: endNum,
        distance: distanceTraveled,
        date,
        destination,
        purpose,
      });

    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving the odometer record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetFormForNext = () => {
    setSubmittedSummary(null);
    setEndOdometer('');
    setRemarks('');
    setSelectedBookingId('manual');
    // Pre-populate new start with previous end
    if (submittedSummary && submittedSummary.endReading) {
      setStartOdometer(String(submittedSummary.endReading));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="animate-spin h-10 w-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full mx-auto" />
          <p className="text-sm font-semibold text-slate-600">Connecting to vehicle odometer portal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-xl w-full mx-auto space-y-5">
        
        {/* Organization Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 flex items-center gap-4">
          {tenant?.logoUrl ? (
            <img 
              src={tenant.logoUrl} 
              alt={tenant.companyName || tenant.name} 
              className="w-12 h-12 object-contain rounded-xl border border-slate-100" 
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-xs">
              {(tenant?.companyName || tenant?.name || 'FF').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">
              Fleet Management Portal
            </div>
            <h1 className="text-lg font-bold text-slate-900 truncate">
              {tenant?.companyName || tenant?.name || 'Self-Drive Odometer Portal'}
            </h1>
            <p className="text-xs text-slate-500">
              Record Start & End Odometer for Vehicle Trips
            </p>
          </div>
        </div>

        {/* SUBMISSION CONFIRMATION SCREEN */}
        {submittedSummary ? (
          <div className="bg-white rounded-2xl shadow-md border border-emerald-200 p-6 sm:p-8 text-center space-y-6 animate-fade-in">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-xs">
              <CheckCircleIcon className="w-10 h-10" />
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-slate-900">
                Trip Odometer Saved!
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Your trip odometer record has been logged in the fleet management database.
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-left text-xs sm:text-sm space-y-2.5">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                <span className="text-slate-500">Vehicle:</span>
                <span className="font-bold text-slate-800">{submittedSummary.vehicleName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Staff Member:</span>
                <span className="font-semibold text-slate-800">{submittedSummary.staffName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Date:</span>
                <span className="text-slate-700">{submittedSummary.date}</span>
              </div>
              {submittedSummary.destination && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Destination:</span>
                  <span className="text-slate-700">{submittedSummary.destination}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">Start Odometer:</span>
                  <span className="font-mono font-bold text-slate-800 text-sm">
                    {submittedSummary.startReading.toLocaleString()} km
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                  <span className="text-[11px] text-slate-500 block">End Odometer:</span>
                  <span className="font-mono font-bold text-indigo-700 text-sm">
                    {submittedSummary.endReading.toLocaleString()} km
                  </span>
                </div>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-emerald-800 font-bold">Total Distance Traveled:</span>
                <span className="font-mono font-extrabold text-emerald-800 text-base">
                  +{submittedSummary.distance} km
                </span>
              </div>
            </div>

            <button
              onClick={resetFormForNext}
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs sm:text-sm transition cursor-pointer shadow-sm active:scale-98"
            >
              Log Another Trip
            </button>
          </div>
        ) : (
          /* MAIN UNIFIED ODOMETER ENTRY FORM */
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Log Vehicle Odometer
                </h2>
                <p className="text-xs text-slate-500">
                  Enter starting and ending odometer readings after your trip
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                Self-Drive
              </span>
            </div>

            <div className="p-5 sm:p-6 space-y-4">
              {formError && (
                <div className="p-3.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* Booking Selection Tab (Quick Match) */}
              {relevantBookings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Match Scheduled Booking (Optional)
                    </label>
                    {selectedBookingId !== 'manual' && (
                      <button
                        type="button"
                        onClick={handleManualChoice}
                        className="text-xs text-indigo-600 hover:underline font-semibold"
                      >
                        Clear Selection
                      </button>
                    )}
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1.5 rounded-xl border border-slate-200 p-2 bg-slate-50/50">
                    <button
                      type="button"
                      onClick={handleManualChoice}
                      className={`w-full text-left p-2.5 rounded-lg text-xs font-medium transition cursor-pointer border ${
                        selectedBookingId === 'manual'
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-bold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      🚗 Direct / Unscheduled Trip (Manual Entry)
                    </button>

                    {relevantBookings.map((b) => {
                      const isSelected = selectedBookingId === b.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => handleSelectBooking(b)}
                          className={`w-full text-left p-2.5 rounded-lg text-xs transition cursor-pointer border ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-400 text-indigo-950 font-bold'
                              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-bold">{b.requesterName}</span>
                            <span className="text-[11px] text-slate-500">{b.dateTime?.split('T')[0]}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate mt-0.5">
                            {b.purpose} {b.destination ? `• to ${b.destination}` : ''}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Vehicle Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Vehicle <span className="text-rose-500">*</span>
                </label>
                
                {/* Mobile-Friendly Native Dropdown with High-contrast Chevron */}
                <div className="relative">
                  <select
                    value={selectedVehicleId}
                    onChange={(e) => handleVehicleChange(e.target.value)}
                    className="w-full px-4 py-3.5 pr-11 border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none bg-white font-semibold text-sm sm:text-base text-slate-900 cursor-pointer appearance-none -webkit-appearance-none shadow-xs transition"
                    required
                  >
                    {vehicles.length === 0 && (
                      <option value="" disabled>Loading vehicles...</option>
                    )}
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.plateNumber})
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <ChevronDownIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>

                {/* Quick 1-Tap Vehicle Selection Chips for Mobile Phones */}
                {vehicles.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2.5">
                    {vehicles.map((v) => {
                      const isSelected = v.id === selectedVehicleId;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleVehicleChange(v.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer active:scale-95 ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span>🚗</span>
                          <span>{v.name}</span>
                          <span className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-500'}`}>
                            {v.plateNumber}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {latestVehicleOdometer !== null && (
                  <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    <span>Last recorded odometer: <strong>{latestVehicleOdometer.toLocaleString()} km</strong></span>
                  </p>
                )}
              </div>

              {/* Staff Name Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Staff Member (Driver) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedStaffId}
                    onChange={(e) => setSelectedStaffId(e.target.value)}
                    required
                    className="w-full px-4 py-3.5 pr-11 border-2 border-slate-300 rounded-xl focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 outline-none bg-white font-medium text-sm sm:text-base text-slate-900 cursor-pointer appearance-none -webkit-appearance-none shadow-xs transition"
                  >
                    <option value="">-- Select Staff Member --</option>
                    {selfDriveStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} {staff.department ? `(${staff.department})` : ''}
                      </option>
                    ))}
                    <option value="other">✍️ Other Staff Member (Type Name)</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 text-slate-500">
                    <ChevronDownIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                </div>

                {/* Custom Name input if "other" or empty list */}
                {selectedStaffId === 'other' && (
                  <div className="mt-2 animate-fade-in">
                    <input
                      type="text"
                      required
                      value={customStaffName}
                      onChange={(e) => setCustomStaffName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm bg-slate-50"
                    />
                  </div>
                )}
              </div>

              {/* Unified Odometer Section (Mula & Tamat in one place) */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between pb-1 border-b border-slate-200">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Odometer Readings
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Recorded in kilometers (km)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Start Odometer (km) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={startOdometer}
                      onChange={(e) => setStartOdometer(e.target.value)}
                      placeholder="e.g. 45210"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      End Odometer (km) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      value={endOdometer}
                      onChange={(e) => setEndOdometer(e.target.value)}
                      placeholder="e.g. 45285"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm bg-white"
                    />
                  </div>
                </div>

                {calculatedDistance !== null && (
                  <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-xl text-emerald-800 border border-emerald-200 text-xs font-bold animate-fade-in">
                    <span>Computed Distance Traveled:</span>
                    <span className="font-mono text-sm">+{calculatedDistance} km</span>
                  </div>
                )}
              </div>

              {/* Date & Destination */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Trip Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Destination / Location
                  </label>
                  <input
                    type="text"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="e.g. Chow Kit to Putrajaya"
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white"
                  />
                </div>
              </div>

              {/* Purpose / Remarks */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Trip Purpose / Remarks (Optional)
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g. Outreach program, client visit, logistics"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-white"
                />
              </div>

              {/* Submit Button */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition active:scale-98 disabled:bg-indigo-300 cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                      <span>Saving Odometer Log...</span>
                    </>
                  ) : (
                    <>
                      <GaugeIcon className="w-4 h-4" />
                      <span>Record Trip Odometer</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-slate-400">
          Armada Flow Vehicle Management System • Self-Drive Odometer Portal
        </div>
      </div>
    </div>
  );
};

export default PublicOdometerPage;
