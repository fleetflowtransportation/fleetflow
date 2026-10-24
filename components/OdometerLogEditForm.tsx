import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { OdometerLog, Booking } from '../types';
import { XIcon, GaugeIcon } from './icons/Icons';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';
import { parseAsLocal, resolveDriver } from '../utils';

interface OdometerLogEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  logToEdit?: OdometerLog | null;
  initialVehicleId?: string;
  initialDriverId?: string;
  defaultBookingId?: string;
  defaultBookingIds?: string[];
  lockDriverToInitial?: boolean;
}

const emptyFormData = {
  vehicleId: '',
  driverId: '',
  date: '',
  fromLocation: '',
  toLocation: '',
  purpose: '',
  startOdometer: '',
  endOdometer: '',
  remarks: '',
};

type FormData = typeof emptyFormData;

const OdometerLogEditForm: React.FC<OdometerLogEditFormProps> = ({ 
  isOpen, 
  onClose, 
  logToEdit,
  initialVehicleId,
  initialDriverId,
  defaultBookingId,
  defaultBookingIds,
  lockDriverToInitial = false
}) => {
  const { updateOdometerLog, addOdometerLog, updateVehicle, vehicles, users, currentUser, odometerLogs, bookings, selfDriveStaff } = useAppContext();
  const [selectedBookingIds, setSelectedBookingIds] = useState<string[]>([]);
  useBodyScrollLock(isOpen);
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [driverSelection, setDriverSelection] = useState<string>('');
  const effectiveDriverId = lockDriverToInitial ? (initialDriverId || currentUser?.id || '') : driverSelection;
  const [customDriverName, setCustomDriverName] = useState<string>('');
  const [error, setError] = useState('');

  const drivers = useMemo(() => {
    return users.filter(u => u.role === 'driver' || u.role === 'admin');
  }, [users]);

  // Use the vehicle's current reading and odometer history so the default never falls behind.
  const getLatestOdoForVehicle = useCallback((vId: string) => {
    if (!vId) return 0;
    const vehicleReading = Number(vehicles.find(v => v.id === vId)?.currentOdometer) || 0;
    const logReadings = odometerLogs
      .filter(l => l.vehicleId === vId)
      .map(l => Number(l.odometer) || 0);
    return Math.max(vehicleReading, 0, ...logReadings);
  }, [odometerLogs, vehicles]);

  const prevIsOpenRef = React.useRef(false);
  const prevLogIdRef = React.useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const logChanged = isOpen && (logToEdit ? logToEdit.id : null) !== prevLogIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevLogIdRef.current = logToEdit ? logToEdit.id : null;

    if (!isOpen) return;

    if (justOpened || logChanged) {
      setError('');
      if (logToEdit) {
        setSelectedBookingIds([]);
        const isRegistered = drivers.find(d => d.id === logToEdit.driverId);
        const matchedStaff = (selfDriveStaff || []).find(s => 
          s.id === logToEdit.driverId || 
          (logToEdit.driverId && logToEdit.driverId.replace(/^staff-/, '') === s.id) ||
          (logToEdit.staffName && s.name.trim().toLowerCase() === logToEdit.staffName.trim().toLowerCase())
        );
        
        let initialCustomName = '';
        if (logToEdit.staffName && logToEdit.staffName.trim()) {
          initialCustomName = logToEdit.staffName.trim();
        } else if (logToEdit.remarks && logToEdit.remarks.includes('Logged by:')) {
          const match = logToEdit.remarks.match(/Logged by:\s*([^)]+)/i);
          if (match && match[1]) initialCustomName = match[1].trim();
        } else if (logToEdit.driverId && logToEdit.driverId.startsWith('staff-')) {
          initialCustomName = logToEdit.driverId
            .replace(/^staff-/, '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());
        } else if (!isRegistered && logToEdit.driverId) {
          initialCustomName = logToEdit.driverId;
        }

        if (isRegistered) {
          setDriverSelection(isRegistered.id);
          setCustomDriverName('');
        } else if (matchedStaff) {
          setDriverSelection(`staff-${matchedStaff.id}`);
          setCustomDriverName(matchedStaff.name);
        } else {
          setDriverSelection('__other__');
          setCustomDriverName(initialCustomName || 'Other Driver');
        }

        setFormData({
          vehicleId: logToEdit.vehicleId || '',
          driverId: isRegistered ? isRegistered.id : (matchedStaff ? `staff-${matchedStaff.id}` : '__other__'),
          date: logToEdit.date ? new Date(logToEdit.date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          fromLocation: logToEdit.fromLocation || '',
          toLocation: logToEdit.toLocation || '',
          purpose: logToEdit.purpose || '',
          startOdometer: logToEdit.startOdometer !== undefined ? String(logToEdit.startOdometer) : '',
          endOdometer: String(logToEdit.odometer),
          remarks: logToEdit.remarks || '',
        });
      } else {
        // Create mode
        let fromLoc = 'HQ / Operations Base';
        let toLoc = '';
        let purpose = '';
        let chosenVId = initialVehicleId || vehicles[0]?.id || '';
        
        const bIds = defaultBookingIds && defaultBookingIds.length > 0 ? defaultBookingIds : (defaultBookingId ? [defaultBookingId] : []);
        if (bIds.length > 0) {
          const selectedBookings = bookings.filter(b => bIds.includes(b.id));
          if (selectedBookings.length > 0) {
            const sorted = [...selectedBookings].sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
            fromLoc = sorted[0].pickupPoint || fromLoc;
            const toLocs = sorted.map(b => b.destination).filter(Boolean);
            toLoc = Array.from(new Set(toLocs)).join(', ');
            purpose = sorted.map(b => b.purpose).filter(Boolean).join(', ');
            const foundVeh = sorted.find(b => b.vehicleId)?.vehicleId;
            if (foundVeh) chosenVId = foundVeh;
          }
        }

        const defaultDId = initialDriverId || (currentUser?.role === 'driver' ? currentUser.id : (drivers[0]?.id || ''));
        const validInitialBookingIds = bIds.filter(id => {
          const booking = bookings.find(item => item.id === id);
          return booking && booking.vehicleId === chosenVId && (
            booking.driverId === defaultDId || resolveDriver(users, booking.driverId, booking.calendarEventTitle)?.id === defaultDId
          ) && ['Assigned', 'Confirmed', 'Pending'].includes(booking.status) && booking.serviceType !== 'Self-Drive';
        });
        setSelectedBookingIds(validInitialBookingIds);
        const validInitialBookings = bookings
          .filter(item => validInitialBookingIds.includes(item.id))
          .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
        if (validInitialBookings.length > 0) {
          fromLoc = validInitialBookings[0].pickupPoint || fromLoc;
          toLoc = [...new Set(validInitialBookings.map(item => item.destination?.trim()).filter(Boolean))].join('; ');
          purpose = [...new Set(validInitialBookings.map(item => item.purpose?.trim()).filter(Boolean))].join('; ');
        } else if (bIds.length > 0) {
          toLoc = '';
          purpose = '';
        }
        const isRegistered = drivers.some(d => d.id === defaultDId);
        const latestOdo = chosenVId ? getLatestOdoForVehicle(chosenVId) : 0;

        setDriverSelection(isRegistered ? defaultDId : (defaultDId ? '__other__' : (drivers[0]?.id || '__other__')));
        setCustomDriverName(isRegistered ? '' : (defaultDId || ''));

        setFormData({
          vehicleId: chosenVId,
          driverId: isRegistered ? defaultDId : '__other__',
          date: new Date().toISOString().split('T')[0],
          fromLocation: fromLoc,
          toLocation: toLoc,
          purpose: purpose,
          startOdometer: latestOdo > 0 ? String(latestOdo) : '',
          endOdometer: '',
          remarks: '',
        });
      }
    }
  }, [isOpen, logToEdit, initialVehicleId, initialDriverId, defaultBookingId, defaultBookingIds, vehicles, drivers, currentUser, bookings, users, getLatestOdoForVehicle]);

  const handleVehicleChange = (newVId: string) => {
    const suggestedStart = getLatestOdoForVehicle(newVId);
    setFormData(prev => ({
      ...prev,
      vehicleId: newVId,
      fromLocation: 'HQ / Operations Base',
      toLocation: '',
      purpose: '',
      // Always refresh the suggestion when vehicle changes; the driver can still edit it afterward.
      startOdometer: suggestedStart > 0 ? String(suggestedStart) : '',
    }));
    setSelectedBookingIds([]);
    setError('');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'vehicleId') {
      handleVehicleChange(value);
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
      setError('');
    }
  };

  // Only show unfinished, non-self-drive bookings assigned to the selected driver and vehicle.
  const eligibleDriverBookings = useMemo(() => {
    if (logToEdit || !formData.vehicleId || !effectiveDriverId || effectiveDriverId === '__other__' || effectiveDriverId.startsWith('staff-')) return [];
    return bookings.filter((booking: Booking) => {
      const activeStatus = booking.status === 'Assigned' || booking.status === 'Confirmed' || booking.status === 'Pending';
      const sameDriver = booking.driverId === effectiveDriverId || resolveDriver(users, booking.driverId, booking.calendarEventTitle)?.id === effectiveDriverId;
      // The vehicle used for the odometer log can differ from the booking's originally assigned vehicle
      // (e.g. a breakdown and replacement vehicle). Keep booking eligibility tied to driver, not vehicle.
      return activeStatus && booking.serviceType !== 'Self-Drive' && sameDriver;
    }).sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
  }, [bookings, effectiveDriverId, formData.vehicleId, logToEdit, users]);

  const handleToggleBooking = (bookingId: string) => {
    const nextIds = selectedBookingIds.includes(bookingId)
      ? selectedBookingIds.filter(id => id !== bookingId)
      : [...selectedBookingIds, bookingId];
    const selected = eligibleDriverBookings.filter(booking => nextIds.includes(booking.id));
    setSelectedBookingIds(nextIds.filter(id => eligibleDriverBookings.some(booking => booking.id === id)));
    setFormData(prev => ({
      ...prev,
      fromLocation: selected[0]?.pickupPoint || (selected.length ? prev.fromLocation : 'HQ / Operations Base'),
      toLocation: [...new Set(selected.map(booking => booking.destination?.trim()).filter(Boolean))].join('; '),
      purpose: [...new Set(selected.map(booking => booking.purpose?.trim()).filter(Boolean))].join('; '),
    }));
    setError('');
  };

  const distance = useMemo(() => {
    const start = Number(formData.startOdometer);
    const end = Number(formData.endOdometer);
    if (!formData.startOdometer || !formData.endOdometer || isNaN(start) || isNaN(end)) return null;
    return end - start;
  }, [formData.startOdometer, formData.endOdometer]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId) {
      setError('Please select a vehicle.');
      return;
    }
    const submittedDriverSelection = lockDriverToInitial ? (initialDriverId || currentUser?.id || '') : driverSelection;
    if (!submittedDriverSelection) {
      setError('Please select a driver or specify Other / Self-Drive Staff.');
      return;
    }

    let finalDriverId = submittedDriverSelection;
    let finalStaffName: string | undefined = undefined;

    if (submittedDriverSelection.startsWith('staff-')) {
      const staffMemberId = submittedDriverSelection.replace(/^staff-/, '');
      const staff = (selfDriveStaff || []).find(s => s.id === staffMemberId);
      if (staff) {
        finalStaffName = staff.name;
        finalDriverId = `staff-${staff.id}`;
      } else {
        finalDriverId = submittedDriverSelection;
        finalStaffName = customDriverName.trim() || submittedDriverSelection.replace(/^staff-/, '').replace(/-/g, ' ');
      }
    } else if (submittedDriverSelection === '__other__') {
      const trimmedName = customDriverName.trim();
      if (!trimmedName) {
        setError('Please enter the name of the other driver / self-drive staff.');
        return;
      }
      finalStaffName = trimmedName;
      // If editing an existing custom driver log, preserve its driverId if not in registered drivers
      if (logToEdit && logToEdit.driverId && !drivers.some(d => d.id === logToEdit.driverId)) {
        finalDriverId = logToEdit.driverId;
      } else {
        finalDriverId = `staff-${trimmedName.replace(/\s+/g, '-').toLowerCase()}`;
      }
    } else {
      const regUser = users.find(u => u.id === submittedDriverSelection);
      finalStaffName = regUser ? regUser.name : undefined;
      finalDriverId = submittedDriverSelection;
    }

    const start = formData.startOdometer !== '' ? Number(formData.startOdometer) : undefined;
    const end = Number(formData.endOdometer);

    if (isNaN(end) || formData.endOdometer === '') {
      setError('Please enter a valid Final Odometer reading (KM).');
      return;
    }
    if (start !== undefined && (isNaN(start) || end < start)) {
      setError('Final Odometer cannot be less than Start Odometer.');
      return;
    }

    const selectedBookings = eligibleDriverBookings.filter(booking => selectedBookingIds.includes(booking.id));
    if (!logToEdit && selectedBookings.length !== selectedBookingIds.length) {
      setError('One or more selected bookings are no longer eligible. Please refresh and select the bookings again.');
      return;
    }

    const logPayload = {
      vehicleId: formData.vehicleId,
      driverId: finalDriverId,
      staffName: finalStaffName,
      date: new Date(formData.date).toISOString(),
      odometer: end,
      startOdometer: start,
      distance: start !== undefined ? end - start : undefined,
      fromLocation: formData.fromLocation.trim() ? formData.fromLocation.trim() : undefined,
      toLocation: formData.toLocation.trim() ? formData.toLocation.trim() : undefined,
      purpose: formData.purpose.trim() ? formData.purpose.trim() : undefined,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
      bookingId: selectedBookingIds.length <= 1 ? selectedBookingIds[0] : undefined,
      bookingIds: selectedBookingIds.length > 1 ? selectedBookingIds : undefined,
    };

    if (logToEdit) {
      updateOdometerLog(logToEdit.id, logPayload);
    } else {
      addOdometerLog(logPayload as any);
      const selectedVehicle = vehicles.find(vehicle => vehicle.id === formData.vehicleId);
      if (selectedVehicle && end >= getLatestOdoForVehicle(formData.vehicleId)) {
        updateVehicle(formData.vehicleId, { currentOdometer: end });
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-2 sm:p-4 overscroll-contain animate-in fade-in duration-150"
      onTouchMove={(e) => {
        if (e.target === e.currentTarget) e.preventDefault();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden overscroll-contain animate-in fade-in zoom-in-95 duration-150">
        <div className="shrink-0 flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50/70 rounded-t-2xl">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
              <GaugeIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                {logToEdit ? 'Update Odometer Log' : 'Record New Odometer Log'}
              </h2>
              <p className="text-xs text-slate-500">
                {logToEdit ? 'Edit trip mileage and odometer records' : 'Manual trip log and mileage entry'}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 p-5 sm:p-6 space-y-4 overflow-y-auto overscroll-contain touch-pan-y">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl font-medium flex items-center">
              <span className="mr-2 font-bold">⚠️</span> {error}
            </div>
          )}

          {/* VEHICLE & DRIVER SELECTION */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle *</label>
              <select 
                name="vehicleId" 
                value={formData.vehicleId} 
                onChange={handleChange} 
                required 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
              >
                <option value="">-- Select Vehicle --</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                ))}
              </select>
            </div>
            {!lockDriverToInitial && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Driver / Staff *</label>
              <select 
                value={driverSelection} 
                onChange={(e) => {
                  setDriverSelection(e.target.value);
                  setSelectedBookingIds([]);
                  setFormData(prev => ({ ...prev, driverId: e.target.value }));
                  setError('');
                }} 
                required 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium cursor-pointer"
              >
                <option value="">-- Select Driver / Staff --</option>
                <optgroup label="Registered Fleet Drivers & Admins">
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.role === 'admin' ? '(Admin)' : ''}
                    </option>
                  ))}
                </optgroup>
                {selfDriveStaff && selfDriveStaff.filter(s => s.status === 'active').length > 0 && (
                  <optgroup label="Authorized Self-Drive Staff">
                    {selfDriveStaff
                      .filter(s => s.status === 'active')
                      .map(s => (
                        <option key={s.id} value={`staff-${s.id}`}>
                          {s.name} ({s.department || 'Self-Drive'})
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="Other Driver / Custom Name">
                  <option value="__other__">🚗 Other Driver / Custom Staff Name</option>
                </optgroup>
              </select>

              {driverSelection === '__other__' && (
                <div className="mt-2 p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl space-y-1 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <label className="block text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                      Other Driver / Staff Name *
                    </label>
                    <span className="text-[10px] text-amber-800 font-semibold bg-amber-100 px-1.5 py-0.5 rounded">
                      Self-Drive
                    </span>
                  </div>
                  <input
                    type="text"
                    value={customDriverName}
                    onChange={(e) => {
                      setCustomDriverName(e.target.value);
                      setError('');
                    }}
                    placeholder="Enter staff name (e.g. Encik Roslan)"
                    required
                    className="w-full text-xs border border-amber-300 bg-white rounded-lg p-2 focus:ring-2 focus:ring-amber-500 outline-none font-medium text-slate-800"
                  />
                  <p className="text-[10px] text-amber-800">
                    Suitable for external drivers or self-drive staff without requiring a registered system account.
                  </p>
                </div>
              )}
            </div>
            )}

          </div>

          {/* DRIVER BOOKING PICKER */}
          {!logToEdit && effectiveDriverId !== '__other__' && !effectiveDriverId.startsWith('staff-') && (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800">Bookings for this driver</h3>
                  <p className="text-[11px] text-slate-600 mt-0.5">Tick the trips covered by this odometer submission. All unfinished bookings assigned to this driver are listed, even if a different vehicle was originally assigned. Select the vehicle actually used for this trip above.</p>
                </div>
                <span className="shrink-0 rounded-full bg-indigo-100 text-indigo-700 px-2 py-1 text-[10px] font-extrabold">{selectedBookingIds.length} selected</span>
              </div>
              {eligibleDriverBookings.length > 0 ? (
                <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                  {eligibleDriverBookings.map(booking => {
                    const selected = selectedBookingIds.includes(booking.id);
                    const tripDate = parseAsLocal(booking.dateTime);
                    return (
                      <label key={booking.id} className={`flex items-start gap-2.5 rounded-lg border p-2.5 cursor-pointer transition ${selected ? 'border-indigo-300 bg-white shadow-sm' : 'border-slate-200 bg-white/70 hover:border-indigo-200'}`}>
                        <input type="checkbox" checked={selected} onChange={() => handleToggleBooking(booking.id)} className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[11px] font-extrabold text-slate-800">{booking.requesterName || 'Booking'}</span>
                            <span className="text-[10px] font-semibold text-slate-500">{tripDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} · {tripDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                          <span className="block text-[11px] text-slate-700 mt-0.5 break-words">{booking.destination || 'Destination not specified'}</span>
                          {booking.vehicleId && <span className="block text-[10px] text-slate-500 mt-0.5">Originally assigned: {vehicles.find(v => v.id === booking.vehicleId)?.name || 'Vehicle'} ({vehicles.find(v => v.id === booking.vehicleId)?.plateNumber || 'unknown plate'})</span>}
                          {booking.purpose && <span className="block text-[10px] text-slate-500 mt-0.5">{booking.purpose}</span>}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="rounded-lg bg-white/80 border border-dashed border-slate-300 p-3 text-[11px] text-slate-500">No unfinished bookings match this driver and vehicle. You can still record an odometer log without linking a booking.</p>
              )}
              {selectedBookingIds.length > 0 && <p className="text-[10px] font-semibold text-indigo-700">Submitting this log will link the selected bookings and mark them Completed.</p>}
            </section>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Trip Date *</label>
            <input 
              type="date" 
              name="date" 
              value={formData.date} 
              onChange={handleChange} 
              required 
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium" 
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Starting Location</label>
              <input 
                type="text" 
                name="fromLocation" 
                placeholder="e.g. HQ / Main Office"
                value={formData.fromLocation} 
                onChange={handleChange} 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination / Location To</label>
              <input 
                type="text" 
                name="toLocation" 
                placeholder="e.g. Hospital / Airport"
                value={formData.toLocation} 
                onChange={handleChange} 
                className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Trip Purpose</label>
            <textarea 
              name="purpose" 
              placeholder="e.g. Official document delivery / Community outreach"
              value={formData.purpose} 
              onChange={handleChange} 
              rows={2} 
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" 
            />
          </div>

          {/* ODOMETER READINGS */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Odometer Reading (KM)
            </span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Start Odometer (KM)</label>
                <input 
                  type="number" 
                  name="startOdometer" 
                  placeholder="e.g. 12450"
                  value={formData.startOdometer} 
                  onChange={handleChange} 
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">End Odometer (KM) *</label>
                <input 
                  type="number" 
                  name="endOdometer" 
                  placeholder="e.g. 12510"
                  value={formData.endOdometer} 
                  onChange={handleChange} 
                  required 
                  className="w-full text-xs font-mono font-bold border border-slate-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-indigo-500" 
                />
              </div>
            </div>

            {distance !== null && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-xs">
                <span className="text-slate-600 font-medium">Calculated Trip Distance:</span>
                <span className={`font-extrabold px-2 py-0.5 rounded-md ${
                  distance >= 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-red-100 text-red-700'
                }`}>
                  {distance >= 0 ? `+${distance.toLocaleString()} KM` : 'Error: End < Start'}
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Additional Remarks (Optional)</label>
            <textarea
              name="remarks"
              placeholder="Road conditions, service notes, etc."
              value={formData.remarks}
              onChange={handleChange}
              rows={2}
              className="w-full text-xs border border-slate-300 rounded-xl p-2.5 bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex justify-end space-x-2.5">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              {logToEdit ? 'Save Changes' : 'Record Odometer Log'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default OdometerLogEditForm;
