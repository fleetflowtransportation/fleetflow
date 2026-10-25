import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Booking, BookingStop, Tenant } from '../types';
import { MAX_BOOKING_STOPS } from '../types';
import { getSupabase } from '../services/supabaseClient';
import { storageService } from '../services/storage';
import { googleCalendarService } from '../services/googleCalendar';
import { deriveDestination, normalizeStopsForSave } from '../utils';

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
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [notice, setNotice] = useState('');

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
    () => stops.map(stop => stop.name.trim() || stop.address.trim()).filter(Boolean).join(' → '),
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
      setErrorMessage('Please enter a reason for cancellation.');
      return;
    }
    if (!window.confirm('Cancel this booking? This action cannot be undone from this link.')) return;

    setCancelling(true);
    setErrorMessage('');
    setNotice('');
    try {
      const data = await invoke({ action: 'cancel', reason: cancelReason.trim() });
      if (!data.booking) throw new Error('The cancellation status could not be confirmed.');

      // Delete the calendar event and send the existing cancellation email when configured.
      try {
        const tenant = await storageService.getTenant(tenantId);
        if (tenant && booking.calendarEventId) {
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
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-extrabold">Destination & Stops</h2>
                      <p className="mt-1 text-sm text-slate-500">Only route addresses, stop names and stop order can be changed. Date, time, driver and vehicle assignment cannot be edited here.</p>
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
                    <span className="mb-1 block text-xs font-bold text-slate-600">Reason for cancellation <span className="text-rose-600">*</span></span>
                    <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} maxLength={500} rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-100" placeholder="e.g. Meeting postponed" />
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
