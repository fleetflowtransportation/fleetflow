import React, { useState, useEffect, useMemo } from 'react';
import { storageService } from '../services/storage';
import { Tenant, Vehicle, Booking, OdometerLog, FuelLog, SelfDriveStaff } from '../types';
import { 
  GaugeIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  CalendarIcon, 
  TruckIcon, 
  UserCircleIcon,
  InformationCircleIcon, 
  SearchIcon 
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

  // Fuel top-up (Clean, direct inputs without tick box)
  const [fuelLiters, setFuelLiters] = useState('');
  const [fuelCost, setFuelCost] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<any | null>(null);

  // Search filter for scheduled bookings
  const [bookingSearch, setBookingSearch] = useState('');

  // Load tenant, fleet vehicles, bookings, odometer logs & authorized self-drive staff
  useEffect(() => {
    storageService.setTenantId(tenantId);
    Promise.all([
      storageService.getTenant(tenantId),
      storageService.getVehicles(),
      storageService.getBookings(),
      storageService.getOdometerLogs(),
      storageService.getSelfDriveStaff(),
    ])
      .then(([t, v, b, o, s]) => {
        setTenant(t);
        setVehicles(v);
        setBookings(b);
        setOdometerLogs(o);
        setSelfDriveStaff(s.filter(staff => staff.status === 'active'));

        if (v.length > 0) {
          // Default to Alza if available
          const alza = v.find(veh => 
            (veh.name && veh.name.toLowerCase().includes('alza')) || 
            (veh.specifications && veh.specifications.toLowerCase().includes('alza'))
          );
          const chosenVehicle = alza || v[0];
          setSelectedVehicleId(chosenVehicle.id);

          // Find latest known odometer reading for chosen vehicle
          const latestLog = o
            .filter(l => l.vehicleId === chosenVehicle.id)
            .sort((x, y) => new Date(y.date).getTime() - new Date(x.date).getTime())[0];
          if (latestLog && latestLog.odometer) {
            setStartOdometer(String(latestLog.odometer));
          }
        }
      })
      .catch((err) => {
        console.error('Error loading data for public odometer portal:', err);
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
      setFormError('Please enter a valid Start Odometer reading (Km Mula).');
      return;
    }

    if (isNaN(endNum) || endNum <= 0) {
      setFormError('Please enter a valid End Odometer reading (Km Tamat).');
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

      // 3. Optional Fuel Log (no tickbox required, saved if values are provided)
      if (fuelLiters.trim() && fuelCost.trim()) {
        const litersNum = parseFloat(fuelLiters);
        const costNum = parseFloat(fuelCost);
        if (!isNaN(litersNum) && !isNaN(costNum) && litersNum > 0 && costNum > 0) {
          const fuelLog: FuelLog = {
            id: `fuel-pub-${Date.now()}`,
            vehicleId: selectedVehicleId,
            driverId: `staff-${effectiveStaffName.replace(/\s+/g, '-').toLowerCase()}`,
            date: date,
            odometer: endNum,
            liters: litersNum,
            cost: costNum,
            pricePerLiter: Math.round((costNum / litersNum) * 100) / 100,
            tenantId,
          };
          await storageService.createFuelLog(fuelLog);
        }
      }

      // 4. Save summary for confirmation view
      setSubmittedSummary({
        vehicleName: vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : 'Vehicle',
        staffName: effectiveStaffName,
        startReading: startNum,
        endReading: endNum,
        distance: distanceTraveled,
        date,
        destination,
        purpose,
        fuelLiters: fuelLiters ? parseFloat(fuelLiters) : null,
        fuelCost: fuelCost ? parseFloat(fuelCost) : null,
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
    setFuelLiters('');
    setFuelCost('');
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
              {submittedSummary.fuelLiters && (
                <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-amber-900">
                  <span>Fuel Refueled:</span>
                  <span className="font-medium">
                    {submittedSummary.fuelLiters} L (RM {submittedSummary.fuelCost?.toFixed(2)})
                  </span>
                </div>
              )}
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
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Vehicle <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => handleVehicleChange(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-xs sm:text-sm"
                  required
                >
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} - {v.plateNumber}
                    </option>
                  ))}
                </select>
                {latestVehicleOdometer !== null && (
                  <p className="text-[11px] text-slate-500 mt-1">
                    Last recorded odometer: <strong>{latestVehicleOdometer.toLocaleString()} km</strong>
                  </p>
                )}
              </div>

              {/* Staff Name Dropdown */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Staff Member (Driver) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium text-xs sm:text-sm"
                >
                  <option value="">-- Select Staff Member --</option>
                  {selfDriveStaff.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} {staff.department ? `(${staff.department})` : ''}
                    </option>
                  ))}
                  <option value="other">✍️ Other Staff Member (Type Name)</option>
                </select>

                {/* Custom Name input if "other" or empty list */}
                {selectedStaffId === 'other' && (
                  <div className="mt-2 animate-fade-in">
                    <input
                      type="text"
                      required
                      value={customStaffName}
                      onChange={(e) => setCustomStaffName(e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-xs sm:text-sm bg-slate-50"
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

              {/* Fuel Entry (Direct & Optional - Tick box removed) */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Fuel Top-Up (Optional)
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Fill only if you refueled
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/70 rounded-xl border border-amber-200">
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                      Fuel Liters (L)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={fuelLiters}
                      onChange={(e) => setFuelLiters(e.target.value)}
                      placeholder="e.g. 35.5"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-amber-900 uppercase mb-1">
                      Total Cost (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={fuelCost}
                      onChange={(e) => setFuelCost(e.target.value)}
                      placeholder="e.g. 72.80"
                      className="w-full px-3 py-2 border border-amber-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-amber-500 outline-none font-mono"
                    />
                  </div>
                </div>
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
          FleetFlow Vehicle Management System • Self-Drive Odometer Portal
        </div>
      </div>
    </div>
  );
};

export default PublicOdometerPage;
