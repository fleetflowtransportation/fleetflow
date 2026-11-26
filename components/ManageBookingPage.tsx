import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Booking, BookingStop, Tenant } from '../types';
import { MAX_BOOKING_STOPS } from '../types';
import { getSupabase } from '../services/supabaseClient';
import { storageService } from '../services/storage';
import { googleCalendarService, buildEmailHtml } from '../services/googleCalendar';
import { normalizeStopsForSave } from '../utils';

interface ManageBookingPageProps {
  tenantId: string;
  token: string;
}

interface ManageResponse {
  booking?: Booking;
  canManage?: boolean;
  error?: string;
}

const stopId = () => `stop-${crypto.randomUUID()}`;

const toLocalDate = (value?: string) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.replace('T', ' ');
  return date.toLocaleString('en-MY', {
    timeZone: 'Asia/Kuala_Lumpur',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const ManageBookingPage: React.FC<ManageBookingPageProps> = ({ tenantId, token }) => {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [stops, setStops] = useState<BookingStop[]>([]);
  const [pickupTime, setPickupTime] = useState('');
  const [returnTime, setReturnTime] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelRemarks, setCancelRemarks] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [parkingInfo, setParkingInfo] = useState<{ location: string; updatedAt?: string; vehicleName?: string } | null>(null);

  const invoke = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await getSupabase().functions.invoke('manage-booking', { body: { ...body, tenantId, token } });
    if (error) throw new Error(data?.error || error.message || 'Unable to manage this booking.');
    if (data?.error) throw new Error(data.error);
    return data as ManageResponse & { token?: string; cancelled?: boolean };
  }, [tenantId, token]);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const data = await invoke({ action: 'get' });
      if (!data.booking) throw new Error('Booking details are unavailable.');
      setBooking(data.booking);
      setParkingInfo(null);
      if (data.booking.serviceType === 'Self-Drive' && data.booking.vehicleId) {
        try {
          const [vehicles, logResult] = await Promise.all([
            storageService.getVehicles(),
            getSupabase().from('odometer_logs').select('parking_location, created_at, date').eq('tenant_id', tenantId).eq('vehicle_id', data.booking.vehicleId).not('parking_location', 'is', null).order('created_at', { ascending: false }).limit(1),
          ]);
          const vehicle = vehicles.find(v => v.id === data.booking!.vehicleId && v.enableParkingLocation);
          const latest = logResult.data?.[0];
          if (vehicle && latest?.parking_location) setParkingInfo({ location: latest.parking_location, updatedAt: latest.created_at || latest.date, vehicleName: `${vehicle.name} (${vehicle.plateNumber})` });
        } catch (parkingError) { console.warn('Unable to load last parking location for manage booking:', parkingError); }
      }
      setPickupTime((data.booking.dateTime || '').match(/T(\d{2}:\d{2})/)?.[1] || '');
      setReturnTime((data.booking.finishDateTime || '').match(/T(\d{2}:\d{2})/)?.[1] || '');
      setStops((data.booking.stops || []).map((stop, index) => ({
        ...stop,
        id: stop.id || stopId(),
        sequence: index + 1,
        name: stop.name || '',
        address: stop.address || '',
      })));
      setCanManage(Boolean(data.canManage));
    } catch (error: any) {
      setBooking(null);
      setCanManage(false);
      setErrorMessage(error?.message || 'This management link is invalid or no longer available.');
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => { void loadBooking(); }, [loadBooking]);

  const routePreview = useMemo(
    () => stops.map(stop => (stop.name || '').trim() || stop.address.trim()).filter(Boolean).join(' → '),
    [stops]
  );

  const changeStop = (index: number, field: 'name' | 'address' | 'notes', value: string) => {
    setStops(current => current.map((stop, i) => i === index ? { ...stop, [field]: value } : stop));
  };

  const moveStop = (index: number, direction: -1 | 1) => {
    setStops(current => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((stop, i) => ({ ...stop, sequence: i + 1 }));
    });
  };

  const addStop = () => {
    if (stops.length >= MAX_BOOKING_STOPS) return;
    setStops(current => [...current, { id: stopId(), sequence: current.length + 1, name: '', address: '', notes: '' }]);
  };

  const removeStop = (index: number) => {
    setStops(current => current.filter((_, i) => i !== index).map((stop, i) => ({ ...stop, sequence: i + 1 })));
  };

  const saveTimes = async () => {
    if (!booking || !canManage) return;
    if (!pickupTime || !returnTime || returnTime <= pickupTime) {
      setErrorMessage('Return time must be later than pickup time on the same date.');
      return;
    }
    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      const data = await invoke({ action: 'update_times', pickupTime, returnTime });
      if (!data.booking) throw new Error('The updated booking was not returned.');
      const updated = data.booking;
      setBooking(updated);
      setPickupTime((updated.dateTime || '').match(/T(\d{2}:\d{2})/)?.[1] || pickupTime);
      setReturnTime((updated.finishDateTime || '').match(/T(\d{2}:\d{2})/)?.[1] || returnTime);
      try {
        const tenant = await storageService.getTenant(tenantId);
        if (tenant) {
          const [users, vehicles] = await Promise.all([storageService.getUsers(), storageService.getVehicles()]);
          await googleCalendarService.updateEvent(tenant, updated, vehicles, users, window.location.href, true);
          const email = buildEmailHtml(updated, 'UPDATED', vehicles, users, window.location.href);
          const sent = await googleCalendarService.sendNotificationEmail(tenant, updated.requesterEmail, email.subject, email.html, updated.requesterName);
          setNotice(sent
            ? 'Your pickup and return times have been updated. A confirmation email has been sent.'
            : 'Your pickup and return times have been updated, but the email notification could not be sent. Please contact the administrator.');
        } else {
          setNotice('Your pickup and return times have been updated.');
        }
      } catch (syncError) {
        console.warn('[ManageBookingPage] Time saved, but calendar/email sync could not be completed:', syncError);
        setNotice('Your pickup and return times have been updated, but calendar or email notification could not be completed. Please contact the administrator.');
      }
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to update the booking times.');
      await loadBooking();
    } finally {
      setSaving(false);
    }
  };

  const saveRoute = async () => {
    if (!booking || !canManage) return;
    const cleaned = normalizeStopsForSave(stops);
    if (!cleaned.length || cleaned.length !== stops.length) {
      setErrorMessage('Please provide a full address for every stop.');
      return;
    }
    if (cleaned.length > MAX_BOOKING_STOPS) {
      setErrorMessage(`You can add up to ${MAX_BOOKING_STOPS} stops.`);
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setNotice('');
    try {
      const data = await invoke({ action: 'update', stops: cleaned });
      if (!data.booking) throw new Error('The updated booking was not returned.');
      const updated = data.booking;
      setBooking(updated);
      setStops((updated.stops || []).map((stop, index) => ({ ...stop, sequence: index + 1 })));
      setCanManage(Boolean(data.canManage));

      // Keep the linked calendar event and existing email notification workflow in sync.
      try {
        const tenant = await storageService.getTenant(tenantId);
        if (tenant) {
          const [users, vehicles] = await Promise.all([storageService.getUsers(), storageService.getVehicles()]);
          await googleCalendarService.updateEvent(tenant, updated, vehicles, users, window.location.href);
        }
      } catch (syncError) {
        console.warn('[ManageBookingPage] Route saved, but calendar/email sync could not be completed:', syncError);
      }
      setNotice('Your destination and stops have been updated.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to update this booking.');
      await loadBooking();
    } finally {
      setSaving(false);
    }
  };

  const cancelBooking = async () => {
    if (!booking || !canManage) return;
    if (!cancelReason.trim()) {
      setErrorMessage('Please select a cancellation reason.');
      return;
    }
    if (cancelReason === 'Others' && !cancelRemarks.trim()) {
      setErrorMessage('Please provide remarks when selecting Others.');
      return;
    }
    if (!window.confirm('Cancel this booking? This action cannot be undone from this link.')) return;

    setCancelling(true);
    setErrorMessage('');
    setNotice('');
    try {
      const fullReason = `${cancelReason}${cancelRemarks.trim() ? ` — ${cancelRemarks.trim()}` : ''}`;
      const data = await invoke({ action: 'cancel', reason: fullReason });
      if (!data.booking) throw new Error('The cancellation status could not be confirmed.');

      // Delete the calendar event and send the existing cancellation email when configured.
      try {
        const tenant = await storageService.getTenant(tenantId);
        if (tenant) {
          await googleCalendarService.deleteEvent(tenant, booking.calendarEventId, booking);
        }
      } catch (syncError) {
        console.warn('[ManageBookingPage] Booking cancelled, but calendar/email sync could not be completed:', syncError);
      }

      setBooking(data.booking);
      setCanManage(false);
      setNotice('This booking has been cancelled. Its slot is now released.');
    } catch (error: any) {
      setErrorMessage(error?.message || 'Unable to cancel this booking.');
      await loadBooking();
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-indigo-900 to-slate-900 px-6 py-7 text-white shadow-lg">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">FleetFlow • Public Booking</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">Manage Your Booking</h1>
          <p className="mt-2 max-w-xl text-sm text-indigo-100">Update your destination addresses, add or reorder stops, or cancel your booking without signing in.</p>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">Checking your secure booking link…</div>
        ) : errorMessage && !booking ? (
          <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
            <h2 className="text-lg font-bold text-rose-800">Booking link unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{errorMessage}</p>
            <p className="mt-4 text-xs text-slate-500">For security, this link cannot be used after the booking starts or is marked Completed.</p>
          </div>
        ) : booking ? (
          <div className="space-y-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Booking ID</p>
                  <p className="mt-1 break-all font-mono text-sm font-bold">{booking.id}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${booking.status === 'Cancelled' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {booking.status}
                </span>
              </div>
              <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-2">
                <div><p className="text-xs font-semibold text-slate-500">Requester</p><p className="mt-1 font-bold">{booking.requesterName}</p></div>
                <div><p className="text-xs font-semibold text-slate-500">Department</p><p className="mt-1 font-bold">{booking.department || '—'}</p></div>
                <div><p className="text-xs font-semibold text-slate-500">Start</p><p className="mt-1 font-bold">{toLocalDate(booking.dateTime)}</p></div>
                <div><p className="text-xs font-semibold text-slate-500">End</p><p className="mt-1 font-bold">{toLocalDate(booking.finishDateTime)}</p></div>
              </div>
            </section>

            {parkingInfo && <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-100 text-teal-700 text-xl">📍</div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-teal-800">Last Known Parking Location</p>
                  <h2 className="mt-1 text-xl font-black text-teal-950">{parkingInfo.location}</h2>
                  {parkingInfo.vehicleName && <p className="mt-1 text-sm font-semibold text-teal-900">{parkingInfo.vehicleName}</p>}
                  {parkingInfo.updatedAt && <p className="mt-2 text-xs text-teal-700">Last updated: {toLocalDate(parkingInfo.updatedAt)}</p>}
                  <p className="mt-2 text-xs text-teal-800">This is the latest location recorded by the previous user. The vehicle may have moved since then.</p>
                </div>
              </div>
            </section>}

            {notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div>}
            {errorMessage && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{errorMessage}</div>}

            {booking.status === 'Cancelled' ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
                <h2 className="font-extrabold text-rose-900">This booking has been cancelled</h2>
                <p className="mt-1 text-sm text-rose-800">The driver slot is no longer reserved by this booking.</p>
              </div>
            ) : canManage ? (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-extrabold">Change Pickup & Return Time</h2>
                  <p className="mt-1 text-sm text-slate-500">The original booking date cannot be changed. New times will be checked against the driver or vehicle schedule before they are saved. If the time conflicts, your booking will remain unchanged.</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-slate-600">Pickup time</span>
                      <input type="time" value={pickupTime} onChange={e => setPickupTime(e.target.value)} disabled={saving || cancelling} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs font-bold text-slate-600">Return time</span>
                      <input type="time" value={returnTime} onChange={e => setReturnTime(e.target.value)} disabled={saving || cancelling} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
                    </label>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Need a different date? Please submit a new booking.</p>
                  <div className="mt-5 flex justify-end">
                    <button type="button" onClick={() => void saveTimes()} disabled={saving || cancelling || !pickupTime || !returnTime} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Checking & saving…' : 'Save New Time'}</button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold">Destination & Stops</h2>
                      <p className="mt-1 text-sm text-slate-500">Only route addresses, stop names and stop order can be changed here. The booking date, driver and vehicle assignment remain unchanged.</p>
                    </div>
                    <span className="rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">{stops.length}/{MAX_BOOKING_STOPS} stops</span>
                  </div>

                  <div className="mt-5 space-y-4">
                    {stops.map((stop, index) => (
                      <div key={stop.id} className="rounded-xl border border-slate-200 p-4">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="font-bold">Stop {index + 1}</h3>
                          <div className="flex items-center gap-1">
                            <button type="button" disabled={index === 0 || saving} onClick={() => moveStop(index, -1)} className="rounded-md border border-slate-300 px-2.5 py-1 text-sm disabled:opacity-40" aria-label={`Move stop ${index + 1} up`}>↑</button>
                            <button type="button" disabled={index === stops.length - 1 || saving} onClick={() => moveStop(index, 1)} className="rounded-md border border-slate-300 px-2.5 py-1 text-sm disabled:opacity-40" aria-label={`Move stop ${index + 1} down`}>↓</button>
                            <button type="button" disabled={stops.length <= 1 || saving} onClick={() => removeStop(index)} className="rounded-md border border-rose-200 px-2.5 py-1 text-sm font-semibold text-rose-700 disabled:opacity-40">Remove</button>
                          </div>
                        </div>
                        <label className="mb-3 block">
                          <span className="mb-1 block text-xs font-bold text-slate-600">Place name</span>
                          <input value={stop.name || ''} onChange={e => changeStop(index, 'name', e.target.value)} maxLength={160} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="e.g. Mydin Sinar Kota" />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-bold text-slate-600">Full address <span className="text-rose-600">*</span></span>
                          <textarea value={stop.address} onChange={e => changeStop(index, 'address', e.target.value)} maxLength={1000} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Enter the full destination address" />
                        </label>
                        <label className="mt-3 block">
                          <span className="mb-1 block text-xs font-bold text-slate-600">Stop notes (optional)</span>
                          <input value={stop.notes || ''} onChange={e => changeStop(index, 'notes', e.target.value)} maxLength={500} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" placeholder="Optional access or arrival notes" />
                        </label>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <button type="button" onClick={addStop} disabled={stops.length >= MAX_BOOKING_STOPS || saving} className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-bold text-indigo-700 disabled:opacity-40">+ Add stop</button>
                    <p className="text-xs text-slate-500">Route preview: {routePreview || '—'}</p>
                  </div>
                  <div className="mt-6 flex justify-end">
                    <button type="button" onClick={() => void saveRoute()} disabled={saving || cancelling} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving route…' : 'Save Destination & Stops'}</button>
                  </div>
                </section>

                <section className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm sm:p-7">
                  <h2 className="text-lg font-extrabold text-rose-800">Cancel Booking</h2>
                  <p className="mt-1 text-sm text-slate-600">Cancel only if you no longer need this vehicle. This link cannot cancel a booking once its start time has arrived.</p>
                  <label className="mt-4 block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">Cancellation reason <span className="text-rose-600">*</span></span>
                    <select value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900">
                      <option value="">Select a reason</option>
                      <option value="Meeting / program cancelled">Meeting / program cancelled</option>
                      <option value="Travel no longer required">Travel no longer required</option>
                      <option value="Date or time changed">Date or time changed</option>
                      <option value="Vehicle no longer required">Vehicle no longer required</option>
                      <option value="Booking made by mistake">Booking made by mistake</option>
                      <option value="Others">Others</option>
                    </select>
                  </label>
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-bold text-slate-600">Additional remarks <span className="text-slate-400">(optional)</span></span>
                    <textarea value={cancelRemarks} onChange={e => setCancelRemarks(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" placeholder="Add context if needed" />
                  </label>
                  <div className="mt-4 flex justify-end">
                    <button type="button" onClick={() => void cancelBooking()} disabled={cancelling || saving} className="rounded-xl bg-rose-600 px-5 py-3 text-sm font-extrabold text-white hover:bg-rose-700 disabled:opacity-50">{cancelling ? 'Cancelling…' : 'Cancel Booking'}</button>
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h2 className="font-extrabold text-amber-900">Management is no longer available</h2>
                <p className="mt-1 text-sm text-amber-800">This booking can no longer be edited or cancelled through this link.</p>
              </div>
            )}
          </div>
        ) : null}

        <p className="mt-6 text-center text-xs text-slate-500">Keep this private link secure. Anyone who has it may manage this booking while it remains eligible.</p>
      </div>
    </main>
  );
};

export default ManageBookingPage;
