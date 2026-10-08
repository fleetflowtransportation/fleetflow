import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase, resetSupabaseConfig } from '../services/supabaseClient';
import { useAppContext } from '../context/AppContext';
import { storageService } from '../services/storage';
import { parseAsLocal } from '../utils';
import { 
  SearchIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon, 
  EyeIcon, 
  TrashIcon, 
  ExternalLinkIcon, 
  PaperClipIcon, 
  CalendarIcon, 
  ClockIcon, 
  LocationMarkerIcon, 
  XIcon, 
  ArrowUpCircleIcon, 
  InformationCircleIcon,
  TruckIcon,
  UserCircleIcon,
  CheckCircleIcon
} from './icons/Icons';

export interface ArchiveBooking {
  id: string;
  created_at?: string;
  requester_name: string;
  destination: string;
  date_time?: string;
  finish_date_time?: string;
  start_time?: string;
  end_time?: string;
  status: 'Completed' | 'Cancelled' | string;
  driver_id?: string | null;
  vehicle_id?: string | null;
  department?: string;
  service_type?: string;
}

export interface BookingDetail extends ArchiveBooking {
  purpose?: string;
  pickup_point?: string;
  address?: string;
  passengers?: { category: string; count: number }[] | any;
  remarks?: string;
  admin_notes?: string;
  attachment_name?: string;
  attachment_url?: string; // Google Drive document or attached link
  start_odometer?: number;
  end_odometer?: number;
  distance?: number;
  requester_email?: string;
  should_wait?: boolean;
}

const PAGE_SIZE = 15; // Reduces egress quota by loading only 15 records per page

export const BookingArchive: React.FC = () => {
  const { users, vehicles, bookings: allCachedBookings, activeTenant, currentUser, restoreBooking, deleteBooking } = useAppContext();

  const [bookings, setBookings] = useState<ArchiveBooking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  
  // State for On-Demand Detail Modal (Google Drive link & full payload fetched only when clicked)
  const [selectedBooking, setSelectedBooking] = useState<BookingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState<boolean>(false);

  // Confirmation Modal states
  const [confirmAction, setConfirmAction] = useState<{ type: 'delete' | 'restore'; id: string; name: string } | null>(null);
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);

  // Helper mapping for driver and vehicle names from cached AppContext
  const getDriverName = useCallback((driverId?: string | null) => {
    if (!driverId) return 'Unassigned / Self-Drive';
    const found = users.find(u => u.id === driverId);
    return found ? found.name : 'Unknown Driver';
  }, [users]);

  const getVehicleName = useCallback((vehicleId?: string | null) => {
    if (!vehicleId) return 'No Vehicle';
    const found = vehicles.find(v => v.id === vehicleId);
    return found ? `${found.name} (${found.plateNumber})` : 'Vehicle Assigned';
  }, [vehicles]);

  // Format date and time
  const formatDateTime = (dateTimeStr?: string, finishDateTimeStr?: string) => {
    if (!dateTimeStr) return { date: '-', time: '-' };
    try {
      const start = parseAsLocal(dateTimeStr);
      const dateFormatted = start.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
      const startTime = start.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      if (finishDateTimeStr) {
        const finish = parseAsLocal(finishDateTimeStr);
        const finishTime = finish.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
        return { date: dateFormatted, time: `${startTime} – ${finishTime}` };
      }
      return { date: dateFormatted, time: startTime };
    } catch {
      return { date: dateTimeStr, time: '' };
    }
  };

  // Fallback function using local cached bookings from AppContext
  const fallbackToLocalData = useCallback((from: number, to: number, search: string, status: string, tenantId?: string) => {
    const list = allCachedBookings || [];
    const tenantFiltered = list.filter(b => !tenantId || b.tenantId === tenantId);
    const statusFiltered = tenantFiltered.filter(b => {
      const st = (b.status || '').toLowerCase();
      if (status === 'ALL') return st === 'completed' || st === 'cancelled';
      if (status === 'Completed') return st === 'completed';
      if (status === 'Cancelled') return st === 'cancelled';
      return false;
    });
    const searchFiltered = statusFiltered.filter(b => {
      if (!search.trim()) return true;
      const q = search.trim().toLowerCase();
      return (
        (b.requesterName || '').toLowerCase().includes(q) ||
        (b.destination || '').toLowerCase().includes(q) ||
        (b.department || '').toLowerCase().includes(q)
      );
    });

    searchFiltered.sort((a, b) => {
      const tA = new Date(a.dateTime || 0).getTime();
      const tB = new Date(b.dateTime || 0).getTime();
      return tB - tA;
    });

    const pagedSlice = searchFiltered.slice(from, to + 1);
    const formattedData: ArchiveBooking[] = pagedSlice.map(item => ({
      id: item.id,
      requester_name: item.requesterName || 'Anonymous Requester',
      destination: item.destination || '-',
      date_time: item.dateTime,
      finish_date_time: item.finishDateTime,
      status: item.status || 'Completed',
      driver_id: item.driverId,
      vehicle_id: item.vehicleId,
      department: item.department,
      service_type: item.serviceType,
    }));
    setBookings(formattedData);
    setTotalCount(searchFiltered.length);
  }, [allCachedBookings]);

  // 1. Fetch data with Server-side Pagination & Specific Column Selection (Reduces Supabase Egress)
  const fetchArchiveData = useCallback(async (page: number, search: string, status: string) => {
    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const tenantId = activeTenant?.id || currentUser?.tenantId || storageService.getTenantId();

    try {
      // Build server query with specific columns only
      const buildQuery = (client = supabase) => {
        let q = client
          .from('bookings')
          .select(`
            id, 
            created_at, 
            requester_name, 
            destination, 
            date_time, 
            finish_date_time, 
            start_time, 
            end_time, 
            status, 
            driver_id, 
            vehicle_id, 
            department, 
            service_type
          `, { count: 'exact' })
          .order('date_time', { ascending: false, nullsFirst: false })
          .range(from, to);

        if (tenantId) {
          q = q.eq('tenant_id', tenantId);
        }
        if (status === 'ALL') {
          q = q.in('status', ['Completed', 'Cancelled', 'COMPLETED', 'CANCELLED']);
        } else if (status === 'Completed') {
          q = q.in('status', ['Completed', 'COMPLETED']);
        } else if (status === 'Cancelled') {
          q = q.in('status', ['Cancelled', 'CANCELLED']);
        }
        if (search.trim() !== '') {
          const s = search.trim();
          q = q.or(`requester_name.ilike.%${s}%,destination.ilike.%${s}%,department.ilike.%${s}%`);
        }
        return q;
      };

      let { data, count, error } = await buildQuery(supabase);

      // Self-heal: If invalid API key or auth token error, reset to master credentials and retry once
      if (error && (error.message?.includes('API key') || error.message?.includes('JWT') || error.code === 'PGRST301')) {
        console.warn('[BookingArchive] Supabase API key issue detected, auto-healing with master credentials...');
        resetSupabaseConfig();
        const retryResult = await buildQuery(supabase);
        data = retryResult.data;
        count = retryResult.count;
        error = retryResult.error;
      }

      if (error) {
        console.warn('[BookingArchive] Supabase query notice:', error.message);
        fallbackToLocalData(from, to, search, status, tenantId);
        return;
      }

      if (data) {
        const formattedData: ArchiveBooking[] = data.map((item: any) => ({
          id: item.id,
          created_at: item.created_at,
          requester_name: item.requester_name || 'Anonymous Requester',
          destination: item.destination || '-',
          date_time: item.date_time || item.created_at,
          finish_date_time: item.finish_date_time,
          start_time: item.start_time,
          end_time: item.end_time,
          status: item.status || 'Completed',
          driver_id: item.driver_id,
          vehicle_id: item.vehicle_id,
          department: item.department,
          service_type: item.service_type,
        }));
        setBookings(formattedData);
        setTotalCount(count || 0);
      }
    } catch (err: any) {
      console.warn('[BookingArchive] Network exception, using cached data:', err?.message);
      fallbackToLocalData(from, to, search, status, tenantId);
    } finally {
      setLoading(false);
    }
  }, [activeTenant?.id, currentUser?.tenantId, fallbackToLocalData]);

  // Effect to trigger fetch when page, search, or status changes (with 300ms debounce)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchArchiveData(currentPage, searchTerm, statusFilter);
    }, 300);

    return () => clearTimeout(timer);
  }, [currentPage, searchTerm, statusFilter, fetchArchiveData]);

  // 2. Fetch Full Details (Including Google Drive attachment link) ON-DEMAND only
  const handleOpenDetail = async (id: string) => {
    setLoadingDetail(true);
    setSelectedBooking(null);
    try {
      const selectFields = `
        id, 
        created_at, 
        requester_name, 
        requester_email, 
        department, 
        destination, 
        pickup_point, 
        address, 
        purpose, 
        date_time, 
        finish_date_time, 
        status, 
        service_type, 
        vehicle_preference, 
        driver_id, 
        vehicle_id, 
        passengers, 
        should_wait, 
        return_trip, 
        remarks, 
        admin_notes, 
        attachment_name, 
        attachment_url, 
        start_odometer, 
        end_odometer, 
        distance
      `;

      let { data, error } = await supabase
        .from('bookings')
        .select(selectFields)
        .eq('id', id)
        .single();

      if (error && (error.message?.includes('API key') || error.message?.includes('JWT') || error.code === 'PGRST301')) {
        resetSupabaseConfig();
        const retryResult = await supabase
          .from('bookings')
          .select(selectFields)
          .eq('id', id)
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (data) {
        setSelectedBooking(data as BookingDetail);
        return;
      }

      // If Supabase record not found or error, fall back to cached AppContext record
      const localFound = allCachedBookings?.find(b => b.id === id);
      if (localFound) {
        setSelectedBooking({
          id: localFound.id,
          requester_name: localFound.requesterName,
          requester_email: localFound.requesterEmail,
          department: localFound.department,
          destination: localFound.destination,
          pickup_point: localFound.pickupPoint,
          address: localFound.address,
          purpose: localFound.purpose,
          date_time: localFound.dateTime,
          finish_date_time: localFound.finishDateTime,
          status: localFound.status,
          service_type: localFound.serviceType,
          driver_id: localFound.driverId,
          vehicle_id: localFound.vehicleId,
          passengers: localFound.passengers,
          should_wait: localFound.shouldWait,
          remarks: localFound.remarks,
          attachment_name: localFound.attachmentName,
          attachment_url: localFound.attachmentUrl,
          start_odometer: localFound.startOdometer,
          end_odometer: localFound.endOdometer,
          distance: localFound.distance
        });
      }
    } catch (err: any) {
      console.warn('[BookingArchive] Error fetching detail, using cached record:', err?.message);
      const localFound = allCachedBookings?.find(b => b.id === id);
      if (localFound) {
        setSelectedBooking({
          id: localFound.id,
          requester_name: localFound.requesterName,
          requester_email: localFound.requesterEmail,
          department: localFound.department,
          destination: localFound.destination,
          pickup_point: localFound.pickupPoint,
          address: localFound.address,
          purpose: localFound.purpose,
          date_time: localFound.dateTime,
          finish_date_time: localFound.finishDateTime,
          status: localFound.status,
          service_type: localFound.serviceType,
          driver_id: localFound.driverId,
          vehicle_id: localFound.vehicleId,
          passengers: localFound.passengers,
          should_wait: localFound.shouldWait,
          remarks: localFound.remarks,
          attachment_name: localFound.attachmentName,
          attachment_url: localFound.attachmentUrl,
          start_odometer: localFound.startOdometer,
          end_odometer: localFound.endOdometer,
          distance: localFound.distance
        });
      }
    } finally {
      setLoadingDetail(false);
    }
  };

  // Handle Restore Booking Action
  const handleExecuteRestore = async () => {
    if (!confirmAction || confirmAction.type !== 'restore') return;
    setActionInProgress(true);
    try {
      await restoreBooking(confirmAction.id);
      setConfirmAction(null);
      // Refresh current page
      await fetchArchiveData(currentPage, searchTerm, statusFilter);
    } catch (err) {
      console.error('Failed to restore booking:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  // Handle Permanent Delete Action
  const handleExecuteDelete = async () => {
    if (!confirmAction || confirmAction.type !== 'delete') return;
    setActionInProgress(true);
    try {
      await deleteBooking(confirmAction.id);
      setConfirmAction(null);
      // Refresh current page
      await fetchArchiveData(currentPage, searchTerm, statusFilter);
    } catch (err) {
      console.error('Failed to delete booking:', err);
    } finally {
      setActionInProgress(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header & Controls Bar */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Booking Archive</h2>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                {totalCount} Total Records
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Historical records of completed trips and cancelled bookings with server-side pagination.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative flex-1 md:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <SearchIcon className="h-4 w-4" />
              </div>
              <input
                type="text"
                placeholder="Search requester, destination, dept..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1); // Reset to page 1 on search change
                }}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition font-medium"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  title="Clear search"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs sm:text-sm text-slate-700 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            >
              <option value="ALL">All Status</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="animate-spin h-8 w-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full mx-auto"></div>
            <p className="text-xs sm:text-sm font-semibold text-slate-500">Loading archived records from server...</p>
          </div>
        ) : bookings.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-2">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">No Archive Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchTerm || statusFilter !== 'ALL'
                ? 'No past trips match your current search query or filter criteria.'
                : 'Completed and cancelled vehicle trips will automatically appear in this archive.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="px-4 py-3">Requester & Dept</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Date & Time</th>
                  <th className="px-4 py-3">Driver / Vehicle</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bookings.map((booking) => {
                  const dateTimeInfo = formatDateTime(booking.date_time, booking.finish_date_time);
                  const isCompleted = booking.status.toLowerCase() === 'completed';
                  const driverDisplay = getDriverName(booking.driver_id);
                  const vehicleDisplay = getVehicleName(booking.vehicle_id);

                  return (
                    <tr key={booking.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Requester & Dept */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{booking.requester_name}</div>
                        {booking.department && (
                          <div className="text-[11px] text-slate-500 font-medium">{booking.department}</div>
                        )}
                        <span className="text-[10px] font-mono text-slate-400">
                          #{booking.id.split('-')[1] || booking.id.slice(0, 6)}
                        </span>
                      </td>

                      {/* Destination */}
                      <td className="px-4 py-3.5 max-w-xs">
                        <p className="font-semibold text-slate-800 line-clamp-2">{booking.destination}</p>
                      </td>

                      {/* Date & Time */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-slate-800">{dateTimeInfo.date}</div>
                        <div className="text-[11px] font-medium text-slate-500 mt-0.5">{dateTimeInfo.time}</div>
                      </td>

                      {/* Driver & Vehicle */}
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 truncate max-w-[180px]">{driverDisplay}</div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[180px] mt-0.5">{vehicleDisplay}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          isCompleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isCompleted ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                          {isCompleted ? 'Completed' : 'Cancelled'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          {/* View Detail Button (On-demand Fetch) */}
                          <button
                            type="button"
                            onClick={() => handleOpenDetail(booking.id)}
                            className="p-1.5 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-indigo-100"
                            title="View Trip Details & Google Drive File"
                            aria-label="View Details"
                          >
                            <EyeIcon className="w-4 h-4" />
                          </button>

                          {/* Restore Button */}
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'restore', id: booking.id, name: booking.requester_name })}
                            className="p-1.5 hover:bg-amber-50 text-slate-600 hover:text-amber-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-amber-100"
                            title="Restore booking to Pending status"
                            aria-label="Restore Booking"
                          >
                            <ArrowUpCircleIcon className="w-4 h-4" />
                          </button>

                          {/* Delete Button */}
                          <button
                            type="button"
                            onClick={() => setConfirmAction({ type: 'delete', id: booking.id, name: booking.requester_name })}
                            className="p-1.5 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-rose-100"
                            title="Permanently Delete Booking"
                            aria-label="Delete Booking"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer Pagination Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-slate-600">
          <div>
            Showing <span className="font-bold text-slate-900">{bookings.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0}</span> to <span className="font-bold text-slate-900">{Math.min(currentPage * PAGE_SIZE, totalCount)}</span> of <span className="font-bold text-slate-900">{totalCount}</span> total entries
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold cursor-pointer shadow-2xs"
              title="Previous Page"
              aria-label="Previous Page"
            >
              <ChevronLeftIcon className="w-4 h-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl shadow-2xs">
              Page {currentPage} of {totalPages || 1}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage >= totalPages || totalPages === 0 || loading}
              className="p-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition font-semibold cursor-pointer shadow-2xs"
              title="Next Page"
              aria-label="Next Page"
            >
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* On-Demand Detail Modal (Includes Google Drive File / Attachment) */}
      {(selectedBooking || loadingDetail) && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-in fade-in duration-150"
          onClick={() => {
            if (!loadingDetail) setSelectedBooking(null);
          }}
        >
          <div 
            className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 bg-gradient-to-r from-slate-900 to-indigo-950 px-6 py-4 text-white flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">Archived Booking Details</h3>
                <p className="text-xs text-indigo-200/80 mt-0.5">Full specifications and cloud attachments</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="p-1.5 text-indigo-200 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
                aria-label="Close modal"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs sm:text-sm">
              {loadingDetail ? (
                <div className="py-16 text-center space-y-2">
                  <div className="animate-spin h-7 w-7 border-3 border-indigo-200 border-t-indigo-600 rounded-full mx-auto"></div>
                  <p className="text-xs font-semibold text-slate-500">Retrieving full booking details from Supabase...</p>
                </div>
              ) : selectedBooking ? (
                <>
                  {/* Status & ID Badge */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <span className="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      ID: #{selectedBooking.id}
                    </span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                      selectedBooking.status.toLowerCase() === 'completed'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {selectedBooking.status}
                    </span>
                  </div>

                  {/* Requester Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Requester</span>
                      <p className="font-bold text-slate-900 mt-0.5">{selectedBooking.requester_name}</p>
                      {selectedBooking.requester_email && (
                        <p className="text-[11px] text-slate-500">{selectedBooking.requester_email}</p>
                      )}
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Department & Service</span>
                      <p className="font-bold text-slate-800 mt-0.5">{selectedBooking.department || 'General'}</p>
                      <p className="text-[11px] text-slate-500">{selectedBooking.service_type || 'Perlu Driver'}</p>
                    </div>
                  </div>

                  {/* Route & Schedule */}
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0 ring-2 ring-emerald-100"></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Pickup Location</span>
                        <p className="font-semibold text-slate-800">{selectedBooking.pickup_point || selectedBooking.address || 'Operations Base'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500 mt-1.5 shrink-0 ring-2 ring-rose-100"></div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Destination</span>
                        <p className="font-extrabold text-slate-900">{selectedBooking.destination}</p>
                      </div>
                    </div>
                  </div>

                  {/* Purpose */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Trip Purpose</span>
                    <p className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 text-slate-800 font-medium">
                      {selectedBooking.purpose || 'No purpose recorded.'}
                    </p>
                  </div>

                  {/* Driver & Vehicle Assigned */}
                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Driver</span>
                      <p className="font-bold text-slate-800 mt-0.5">{getDriverName(selectedBooking.driver_id)}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle</span>
                      <p className="font-bold text-slate-800 mt-0.5">{getVehicleName(selectedBooking.vehicle_id)}</p>
                    </div>
                  </div>

                  {/* Odometer metrics if available */}
                  {(selectedBooking.start_odometer !== undefined || selectedBooking.end_odometer !== undefined) && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600">Recorded Mileage:</span>
                      <span className="font-mono text-xs font-bold text-slate-900">
                        {selectedBooking.start_odometer ?? '-'} ➡️ {selectedBooking.end_odometer ?? '-'} km
                        {selectedBooking.distance !== undefined && (
                          <strong className="text-indigo-600 ml-1.5">(+{selectedBooking.distance} km)</strong>
                        )}
                      </span>
                    </div>
                  )}

                  {/* Remarks & Notes */}
                  {selectedBooking.remarks && (
                    <div>
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Remarks</span>
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        {selectedBooking.remarks}
                      </p>
                    </div>
                  )}

                  {/* 3. OPTIMIZED GOOGLE DRIVE / ATTACHMENT CARD (Fetched On-Demand) */}
                  {selectedBooking.attachment_url ? (
                    <div className="pt-3 border-t border-slate-200">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block mb-1.5">
                        Google Drive Attachment & Documentation
                      </span>
                      <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0">
                            <PaperClipIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs truncate">
                              {selectedBooking.attachment_name || 'Booking Document / Attachment'}
                            </p>
                            <span className="text-[10px] text-slate-500">Google Drive Linked File</span>
                          </div>
                        </div>

                        <a
                          href={selectedBooking.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition shrink-0 cursor-pointer"
                        >
                          <span>Open File</span>
                          <ExternalLinkIcon className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 text-slate-400 text-xs italic">
                      No Google Drive file attached for this booking.
                    </div>
                  )}
                </>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="shrink-0 px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
              {selectedBooking && (
                <button
                  type="button"
                  onClick={() => {
                    const b = selectedBooking;
                    setSelectedBooking(null);
                    setConfirmAction({ type: 'restore', id: b.id, name: b.requester_name });
                  }}
                  className="px-3 py-2 text-xs font-bold text-amber-700 hover:bg-amber-100/60 rounded-xl transition cursor-pointer"
                >
                  Restore to Pending
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedBooking(null)}
                className="ml-auto px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Action Modal (Restore or Delete) */}
      {confirmAction && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className={`p-2.5 rounded-xl ${
                confirmAction.type === 'delete' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
              }`}>
                <InformationCircleIcon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-slate-900">
                  {confirmAction.type === 'delete' ? 'Confirm Permanent Deletion' : 'Restore Booking to Pending'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {confirmAction.type === 'delete'
                    ? `Are you sure you want to permanently delete the archived booking for ${confirmAction.name}? This action cannot be reversed.`
                    : `Restore booking for ${confirmAction.name} back to 'Pending' status so it can be re-scheduled or assigned?`}
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={actionInProgress}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmAction.type === 'delete' ? handleExecuteDelete : handleExecuteRestore}
                disabled={actionInProgress}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5 ${
                  confirmAction.type === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {actionInProgress && (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                )}
                <span>{confirmAction.type === 'delete' ? 'Delete Permanently' : 'Restore Booking'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BookingArchive;
