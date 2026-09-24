import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, getPickupLocationDisplay, isOtherPickup } from '../utils';
import type { Booking } from '../types';
import BookingForm from './BookingForm';
import { 
  SearchIcon, 
  PlusIcon, 
  TrashIcon, 
  EditIcon, 
  CheckCircleIcon, 
  XIcon, 
  InformationCircleIcon, 
  DocumentDownloadIcon, 
  TruckIcon, 
  UserCircleIcon, 
  TableIcon, 
  ViewGridIcon, 
  ClockIcon, 
  LocationMarkerIcon, 
  CalendarIcon,
  ExternalLinkIcon
} from './icons/Icons';

export const BookingManagementList: React.FC = () => {
  const { 
    bookings, 
    users, 
    vehicles, 
    deleteBooking, 
    deleteBookingsBulk, 
    updateBookingsStatusBulk, 
    assignBookingsBulk,
    updateBookingStatus
  } = useAppContext();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [driverFilter, setDriverFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [datePreset, setDatePreset] = useState<string>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<Booking | null>(null);

  // Bulk Assign Modal State
  const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
  const [bulkAssignDriverId, setBulkAssignDriverId] = useState('');
  const [bulkAssignVehicleId, setBulkAssignVehicleId] = useState('');

  // Delete Confirm Modal State
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    isBulk: boolean;
    bookingId?: string;
  }>({ isOpen: false, isBulk: false });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const drivers = useMemo(() => users.filter(u => u.role === 'driver' || u.id === 'driver-aziz'), [users]);

  // Statistics Summary
  const stats = useMemo(() => {
    return {
      total: bookings.length,
      confirmed: bookings.filter(b => b.status === 'Confirmed').length,
      assigned: bookings.filter(b => b.status === 'Assigned').length,
      pending: bookings.filter(b => b.status === 'Pending').length,
      completed: bookings.filter(b => b.status === 'Completed').length,
      conflict: bookings.filter(b => b.status === 'Conflict').length,
      cancelled: bookings.filter(b => b.status === 'Cancelled').length,
    };
  }, [bookings]);

  // Filtered Bookings
  const filteredBookings = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    // Monday of current week
    const dayOfWeek = today.getDay();
    const diffToMonday = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diffToMonday));
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    return bookings.filter(booking => {
      // 1. Search Query
      if (query) {
        const driver = users.find(u => u.id === booking.driverId);
        const vehicle = vehicles.find(v => v.id === booking.vehicleId);
        const driverName = driver?.name || '';
        const vehicleName = vehicle ? `${vehicle.name} ${vehicle.plateNumber}` : '';
        const pickupDisp = getPickupLocationDisplay(booking.pickupPoint, booking.address);

        const match = 
          (booking.requesterName && booking.requesterName.toLowerCase().includes(query)) ||
          (booking.destination && booking.destination.toLowerCase().includes(query)) ||
          (booking.purpose && booking.purpose.toLowerCase().includes(query)) ||
          (booking.department && booking.department.toLowerCase().includes(query)) ||
          (booking.address && booking.address.toLowerCase().includes(query)) ||
          (pickupDisp && pickupDisp.toLowerCase().includes(query)) ||
          (booking.requesterPhone && booking.requesterPhone.toLowerCase().includes(query)) ||
          (booking.requesterEmail && booking.requesterEmail.toLowerCase().includes(query)) ||
          (booking.id && booking.id.toLowerCase().includes(query)) ||
          (booking.status && booking.status.toLowerCase().includes(query)) ||
          driverName.toLowerCase().includes(query) ||
          vehicleName.toLowerCase().includes(query);

        if (!match) return false;
      }

      // 2. Status Filter
      if (statusFilter !== 'all' && booking.status !== statusFilter) {
        return false;
      }

      // 3. Driver Filter
      if (driverFilter !== 'all') {
        if (driverFilter === 'unassigned') {
          if (booking.driverId) return false;
        } else if (booking.driverId !== driverFilter) {
          return false;
        }
      }

      // 4. Vehicle Filter
      if (vehicleFilter !== 'all') {
        if (vehicleFilter === 'unassigned') {
          if (booking.vehicleId) return false;
        } else if (booking.vehicleId !== vehicleFilter) {
          return false;
        }
      }

      // 5. Service Type Filter
      if (serviceFilter !== 'all' && booking.serviceType !== serviceFilter) {
        return false;
      }

      // 6. Date Presets
      if (datePreset !== 'all') {
        const bookingDate = parseAsLocal(booking.dateTime);
        const bookingDay = new Date(bookingDate);
        bookingDay.setHours(0, 0, 0, 0);

        if (datePreset === 'today') {
          const tDay = new Date();
          tDay.setHours(0, 0, 0, 0);
          if (bookingDay.getTime() !== tDay.getTime()) return false;
        } else if (datePreset === 'week') {
          if (bookingDate < startOfWeek || bookingDate > endOfWeek) return false;
        } else if (datePreset === 'month') {
          if (bookingDate < startOfMonth || bookingDate > endOfMonth) return false;
        } else if (datePreset === 'upcoming') {
          const tDay = new Date();
          tDay.setHours(0, 0, 0, 0);
          if (bookingDay.getTime() < tDay.getTime()) return false;
        } else if (datePreset === 'past') {
          const tDay = new Date();
          tDay.setHours(0, 0, 0, 0);
          if (bookingDay.getTime() >= tDay.getTime()) return false;
        } else if (datePreset === 'custom' && customStartDate && customEndDate) {
          const s = new Date(customStartDate);
          s.setHours(0, 0, 0, 0);
          const e = new Date(customEndDate);
          e.setHours(23, 59, 59, 999);
          if (bookingDate < s || bookingDate > e) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sort newest date first
      return parseAsLocal(b.dateTime).getTime() - parseAsLocal(a.dateTime).getTime();
    });
  }, [
    bookings, 
    searchQuery, 
    statusFilter, 
    driverFilter, 
    vehicleFilter, 
    serviceFilter, 
    datePreset, 
    customStartDate, 
    customEndDate, 
    users, 
    vehicles
  ]);

  // Paginated Results
  const totalPages = Math.ceil(filteredBookings.length / pageSize) || 1;
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredBookings.slice(start, start + pageSize);
  }, [filteredBookings, currentPage, pageSize]);

  // Select / Deselect Logic
  const allCurrentPageSelected = useMemo(() => {
    if (paginatedBookings.length === 0) return false;
    return paginatedBookings.every(b => selectedIds.includes(b.id));
  }, [paginatedBookings, selectedIds]);

  const handleToggleSelectAll = () => {
    if (allCurrentPageSelected) {
      // Unselect only current page items
      const pageIds = new Set(paginatedBookings.map(b => b.id));
      setSelectedIds(prev => prev.filter(id => !pageIds.has(id)));
    } else {
      // Select all current page items
      const newIds = new Set([...selectedIds, ...paginatedBookings.map(b => b.id)]);
      setSelectedIds(Array.from(newIds));
    }
  };

  const handleSelectAllFiltered = () => {
    setSelectedIds(filteredBookings.map(b => b.id));
  };

  const handleToggleSelectOne = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Bulk Actions
  const handleBulkStatusChange = async (status: Booking['status']) => {
    if (selectedIds.length === 0) return;
    if (confirm(`Change status of ${selectedIds.length} selected booking(s) to '${status}'?`)) {
      await updateBookingsStatusBulk(selectedIds, status);
      handleClearSelection();
    }
  };

  const handleBulkAssignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkAssignDriverId || !bulkAssignVehicleId) {
      alert('Please select both a Driver and a Vehicle.');
      return;
    }
    await assignBookingsBulk(selectedIds, bulkAssignDriverId, bulkAssignVehicleId);
    setIsBulkAssignOpen(false);
    setBulkAssignDriverId('');
    setBulkAssignVehicleId('');
    handleClearSelection();
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirmState.isBulk) {
      await deleteBookingsBulk(selectedIds);
      handleClearSelection();
    } else if (deleteConfirmState.bookingId) {
      deleteBooking(deleteConfirmState.bookingId);
    }
    setDeleteConfirmState({ isOpen: false, isBulk: false });
  };

  // CSV Export
  const handleExportCSV = (exportSelectedOnly = false) => {
    const listToExport = exportSelectedOnly 
      ? filteredBookings.filter(b => selectedIds.includes(b.id))
      : filteredBookings;

    if (listToExport.length === 0) {
      alert('No data to export.');
      return;
    }

    const headers = [
      'Booking ID',
      'Date',
      'Start Time',
      'End Time',
      'Requester Name',
      'Phone Number',
      'Email',
      'Department',
      'Pickup Location',
      'Detailed Address',
      'Destination',
      'Purpose',
      'Passenger Count',
      'Assigned Driver',
      'Vehicle',
      'Plate Number',
      'Service Type',
      'Status',
      'Notes'
    ];

    const escapeCSV = (str: any) => {
      if (str === null || str === undefined) return '""';
      const clean = String(str).replace(/"/g, '""');
      return `"${clean}"`;
    };

    const rows = listToExport.map(b => {
      const dt = parseAsLocal(b.dateTime);
      const finishDt = b.finishDateTime ? parseAsLocal(b.finishDateTime) : null;
      const dateStr = dt.toLocaleDateString('en-GB');
      const timeStr = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
      const finishTimeStr = finishDt ? finishDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '';

      const driver = users.find(u => u.id === b.driverId);
      const vehicle = vehicles.find(v => v.id === b.vehicleId);
      const totalPax = b.passengers.reduce((sum, p) => sum + p.count, 0);

      return [
        escapeCSV(b.id),
        escapeCSV(dateStr),
        escapeCSV(timeStr),
        escapeCSV(finishTimeStr),
        escapeCSV(b.requesterName),
        escapeCSV(b.requesterPhone || ''),
        escapeCSV(b.requesterEmail || ''),
        escapeCSV(b.department || ''),
        escapeCSV(getPickupLocationDisplay(b.pickupPoint, b.address)),
        escapeCSV(b.address || ''),
        escapeCSV(b.destination),
        escapeCSV(b.purpose),
        escapeCSV(totalPax),
        escapeCSV(driver?.name || 'Unassigned'),
        escapeCSV(vehicle?.name || ''),
        escapeCSV(vehicle?.plateNumber || ''),
        escapeCSV(b.serviceType || 'Chauffeur'),
        escapeCSV(b.status),
        escapeCSV(b.remarks || '')
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `FleetFlow_Bookings_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const getStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">Confirmed</span>;
      case 'Assigned':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Assigned</span>;
      case 'Pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">Pending</span>;
      case 'Completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200">Completed</span>;
      case 'Conflict':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">Conflict</span>;
      case 'Cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-200">Cancelled</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">{status}</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* TOP HEADER & TITLE */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
            <span>Booking Management</span>
            <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
              {filteredBookings.length} records
            </span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Search, filter, inspect details, and perform bulk operations (bulk select / update / assign) on fleet bookings.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => handleExportCSV(false)}
            className="inline-flex items-center px-3.5 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition"
            title="Export list to CSV Excel file"
          >
            <DocumentDownloadIcon className="h-4 w-4 mr-2 text-gray-500" />
            Export CSV
          </button>
        </div>
      </div>

      {/* QUICK STATUS METRIC BADGES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2.5 text-xs">
        <button
          onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'all' 
              ? 'bg-gray-900 text-white border-gray-900 shadow' 
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          }`}
        >
          <span className="text-[11px] opacity-80">All</span>
          <span className="text-lg font-extrabold mt-1">{stats.total}</span>
        </button>

        <button
          onClick={() => { setStatusFilter('Confirmed'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Confirmed' 
              ? 'bg-emerald-700 text-white border-emerald-700 shadow' 
              : 'bg-white text-emerald-800 border-emerald-200 hover:bg-emerald-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Confirmed</span>
          <span className="text-lg font-extrabold mt-1 text-emerald-600 group-hover:text-emerald-700">
            {stats.confirmed}
          </span>
        </button>

        <button
          onClick={() => { setStatusFilter('Assigned'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Assigned' 
              ? 'bg-blue-700 text-white border-blue-700 shadow' 
              : 'bg-white text-blue-800 border-blue-200 hover:bg-blue-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Assigned</span>
          <span className="text-lg font-extrabold mt-1 text-blue-600">{stats.assigned}</span>
        </button>

        <button
          onClick={() => { setStatusFilter('Pending'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Pending' 
              ? 'bg-amber-600 text-white border-amber-600 shadow' 
              : 'bg-white text-amber-800 border-amber-200 hover:bg-amber-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Pending</span>
          <span className="text-lg font-extrabold mt-1 text-amber-600">{stats.pending}</span>
        </button>

        <button
          onClick={() => { setStatusFilter('Completed'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Completed' 
              ? 'bg-purple-700 text-white border-purple-700 shadow' 
              : 'bg-white text-purple-800 border-purple-200 hover:bg-purple-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Completed</span>
          <span className="text-lg font-extrabold mt-1 text-purple-600">{stats.completed}</span>
        </button>

        <button
          onClick={() => { setStatusFilter('Conflict'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Conflict' 
              ? 'bg-rose-700 text-white border-rose-700 shadow' 
              : 'bg-white text-rose-800 border-rose-200 hover:bg-rose-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Conflict</span>
          <span className="text-lg font-extrabold mt-1 text-rose-600">{stats.conflict}</span>
        </button>

        <button
          onClick={() => { setStatusFilter('Cancelled'); setCurrentPage(1); }}
          className={`p-2.5 rounded-xl border text-left transition font-semibold flex flex-col justify-between ${
            statusFilter === 'Cancelled' 
              ? 'bg-slate-700 text-white border-slate-700 shadow' 
              : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span className="text-[11px] opacity-80">Cancelled</span>
          <span className="text-lg font-extrabold mt-1 text-slate-600">{stats.cancelled}</span>
        </button>
      </div>

      {/* FILTER & SEARCH TOOLBAR */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* SEARCH INPUT */}
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
              <SearchIcon className="h-5 w-5" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              placeholder="Search bookings (requester name, destination, pickup, purpose, phone, driver)..."
              className="w-full pl-11 pr-10 py-2.5 text-sm bg-gray-50/70 border border-gray-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* VIEW SWITCHER */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200 self-start">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'table' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Full Table View"
            >
              <TableIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                viewMode === 'cards' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
              }`}
              title="Compact Card View"
            >
              <ViewGridIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Cards</span>
            </button>
          </div>
        </div>

        {/* DETAILED FILTERS ROW */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Status Dropdown */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Assigned">Assigned</option>
              <option value="Pending">Pending</option>
              <option value="Completed">Completed</option>
              <option value="Conflict">Conflict</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          {/* Date Preset */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Date Range</label>
            <select
              value={datePreset}
              onChange={(e) => { setDatePreset(e.target.value); setCurrentPage(1); }}
              className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="upcoming">Upcoming</option>
              <option value="past">Past Records</option>
              <option value="custom">Custom Range...</option>
            </select>
          </div>

          {/* Driver */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Driver</label>
            <select
              value={driverFilter}
              onChange={(e) => { setDriverFilter(e.target.value); setCurrentPage(1); }}
              className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Drivers</option>
              <option value="unassigned">⚠️ Unassigned</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>

          {/* Vehicle */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Vehicle</label>
            <select
              value={vehicleFilter}
              onChange={(e) => { setVehicleFilter(e.target.value); setCurrentPage(1); }}
              className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Vehicles</option>
              <option value="unassigned">⚠️ Unassigned</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
              ))}
            </select>
          </div>

          {/* Service */}
          <div>
            <label className="block font-bold text-gray-700 mb-1">Service Type</label>
            <select
              value={serviceFilter}
              onChange={(e) => { setServiceFilter(e.target.value); setCurrentPage(1); }}
              className="w-full py-2 px-3 bg-white border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="all">All Services</option>
              <option value="Chauffeur">Chauffeur (Driver Required)</option>
              <option value="Self-Drive">Self-Drive</option>
            </select>
          </div>
        </div>

        {/* Custom Date Range Picker when datePreset === 'custom' */}
        {datePreset === 'custom' && (
          <div className="pt-2 border-t border-gray-100 flex items-center gap-3 text-xs">
            <span className="font-bold text-gray-700">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
              className="py-1.5 px-3 border border-gray-300 rounded-md"
            />
            <span className="font-bold text-gray-700">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
              className="py-1.5 px-3 border border-gray-300 rounded-md"
            />
          </div>
        )}

        {/* Reset Filter Action */}
        {(searchQuery || statusFilter !== 'all' || driverFilter !== 'all' || vehicleFilter !== 'all' || serviceFilter !== 'all' || datePreset !== 'all') && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
            <span>Showing <strong>{filteredBookings.length}</strong> of {bookings.length} total records</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setDriverFilter('all');
                setVehicleFilter('all');
                setServiceFilter('all');
                setDatePreset('all');
                setCustomStartDate('');
                setCustomEndDate('');
                setCurrentPage(1);
              }}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              Reset All Filters
            </button>
          </div>
        )}
      </div>

      {/* FLOATING BULK SELECTION ACTION BAR */}
      {selectedIds.length > 0 && (
        <div className="sticky top-4 z-30 bg-gray-900 text-white rounded-2xl p-4 shadow-xl border border-gray-800 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3">
            <span className="bg-indigo-600 text-white font-mono font-bold text-xs px-3 py-1 rounded-full">
              {selectedIds.length} Selected
            </span>
            <span className="text-sm font-semibold text-gray-200">
              Bulk Actions:
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* BULK ASSIGN */}
            <button
              onClick={() => setIsBulkAssignOpen(true)}
              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5"
            >
              <UserCircleIcon className="h-4 w-4" />
              Assign Driver & Vehicle
            </button>

            {/* BULK CONFIRM */}
            <button
              onClick={() => handleBulkStatusChange('Confirmed')}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition"
            >
              Mark Confirmed
            </button>

            {/* BULK COMPLETE */}
            <button
              onClick={() => handleBulkStatusChange('Completed')}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition"
            >
              Mark Completed
            </button>

            {/* BULK CSV EXPORT */}
            <button
              onClick={() => handleExportCSV(true)}
              className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
            >
              <DocumentDownloadIcon className="h-4 w-4" />
              Export ({selectedIds.length})
            </button>

            {/* BULK DELETE */}
            <button
              onClick={() => setDeleteConfirmState({ isOpen: true, isBulk: true })}
              className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1"
            >
              <TrashIcon className="h-4 w-4" />
              Delete Selected
            </button>

            {/* DESELECT */}
            <button
              onClick={handleClearSelection}
              className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold rounded-lg transition"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* BOOKING LIST CONTENT */}
      {filteredBookings.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-3">
            <SearchIcon className="h-6 w-6" />
          </div>
          <h3 className="text-base font-bold text-gray-800">No Bookings Found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            No booking records match your current filters or search keywords. Try adjusting your query or resetting filters.
          </p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE VIEW */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3.5 pl-4 pr-2 w-10">
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleToggleSelectAll}
                      className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      title="Select all on this page"
                    />
                  </th>
                  <th className="py-3.5 px-3">Date & Time</th>
                  <th className="py-3.5 px-3">Requester & Dept</th>
                  <th className="py-3.5 px-3">Route / Trip</th>
                  <th className="py-3.5 px-3">Passengers</th>
                  <th className="py-3.5 px-3">Driver & Vehicle</th>
                  <th className="py-3.5 px-3">Status</th>
                  <th className="py-3.5 pr-4 pl-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-150 text-gray-700">
                {paginatedBookings.map(b => {
                  const isChecked = selectedIds.includes(b.id);
                  const dt = parseAsLocal(b.dateTime);
                  const finishDt = b.finishDateTime ? parseAsLocal(b.finishDateTime) : null;
                  
                  const dateFormatted = dt.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                  });
                  const startTime = dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const endTime = finishDt ? finishDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : null;

                  const driver = users.find(u => u.id === b.driverId);
                  const vehicle = vehicles.find(v => v.id === b.vehicleId);
                  const totalPax = b.passengers.reduce((sum, p) => sum + p.count, 0);
                  const isOther = isOtherPickup(b.pickupPoint);
                  const pickupDisplay = getPickupLocationDisplay(b.pickupPoint, b.address);

                  return (
                    <tr 
                      key={b.id}
                      onClick={() => handleToggleSelectOne(b.id)}
                      className={`transition cursor-pointer ${
                        isChecked ? 'bg-indigo-50/80 hover:bg-indigo-50' : 'hover:bg-gray-50/70'
                      }`}
                    >
                      {/* CHECKBOX */}
                      <td className="py-3.5 pl-4 pr-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectOne(b.id)}
                          className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      {/* DATE & TIME */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{dateFormatted}</div>
                        <div className="text-gray-500 font-medium flex items-center gap-1 mt-0.5">
                          <ClockIcon className="h-3.5 w-3.5 text-gray-400" />
                          <span>{startTime}{endTime ? ` – ${endTime}` : ''}</span>
                        </div>
                      </td>

                      {/* REQUESTER */}
                      <td className="py-3.5 px-3">
                        <div className="font-bold text-gray-900">{b.requesterName}</div>
                        {b.department && (
                          <div className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md inline-block mt-0.5 border border-indigo-100">
                            {b.department}
                          </div>
                        )}
                        {b.requesterPhone && (
                          <div className="text-gray-400 text-[11px] font-mono mt-0.5">{b.requesterPhone}</div>
                        )}
                      </td>

                      {/* ROUTE */}
                      <td className="py-3.5 px-3 max-w-xs">
                        <div className="flex items-start gap-1">
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-100">
                            From
                          </span>
                          <span className="font-semibold text-gray-800 line-clamp-1" title={pickupDisplay}>
                            {pickupDisplay}
                          </span>
                        </div>
                        <div className="flex items-start gap-1 mt-1">
                          <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-100">
                            To
                          </span>
                          <span className="font-bold text-gray-900 line-clamp-1" title={b.destination}>
                            {b.destination}
                          </span>
                        </div>
                        {b.purpose && (
                          <p className="text-[11px] text-gray-400 italic line-clamp-1 mt-0.5">
                            {b.purpose}
                          </p>
                        )}
                      </td>

                      {/* PASSENGERS */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        <span className="font-bold text-gray-800">{totalPax} pax</span>
                        <div className="text-[10px] text-gray-400">
                          {b.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Chauffeur'}
                        </div>
                      </td>

                      {/* DRIVER & VEHICLE */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {driver ? (
                          <div className="flex items-center gap-1.5 font-bold text-gray-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span>{driver.name}</span>
                          </div>
                        ) : (
                          <span className="text-amber-600 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[11px]">
                            Unassigned
                          </span>
                        )}
                        <div className="text-gray-500 text-[11px] font-medium mt-0.5">
                          {vehicle ? (
                            <span>{vehicle.name} <strong className="font-mono text-gray-700">({vehicle.plateNumber})</strong></span>
                          ) : (
                            <span className="text-gray-400">No vehicle</span>
                          )}
                        </div>
                      </td>

                      {/* STATUS */}
                      <td className="py-3.5 px-3 whitespace-nowrap">
                        {getStatusBadge(b.status)}
                      </td>

                      {/* ACTIONS */}
                      <td className="py-3.5 pr-4 pl-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setDetailsBooking(b)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                            title="View Full Details"
                          >
                            <InformationCircleIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingBooking(b);
                              setIsFormOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                            title="Edit Booking"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDeleteConfirmState({ isOpen: true, isBulk: false, bookingId: b.id })}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Delete Booking"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARDS GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedBookings.map(b => {
            const isChecked = selectedIds.includes(b.id);
            const dt = parseAsLocal(b.dateTime);
            const finishDt = b.finishDateTime ? parseAsLocal(b.finishDateTime) : null;
            const driver = users.find(u => u.id === b.driverId);
            const vehicle = vehicles.find(v => v.id === b.vehicleId);
            const totalPax = b.passengers.reduce((sum, p) => sum + p.count, 0);
            const pickupDisplay = getPickupLocationDisplay(b.pickupPoint, b.address);

            return (
              <div
                key={b.id}
                onClick={() => handleToggleSelectOne(b.id)}
                className={`bg-white rounded-2xl border p-4 shadow-sm transition flex flex-col justify-between cursor-pointer ${
                  isChecked ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/20' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleSelectOne(b.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded text-indigo-600 border-gray-300 focus:ring-indigo-500 cursor-pointer"
                      />
                      <span className="font-mono text-xs font-bold text-gray-500">#{b.id.slice(-5).toUpperCase()}</span>
                    </div>
                    {getStatusBadge(b.status)}
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Date & Time</span>
                      <p className="font-bold text-gray-900 mt-0.5">
                        {dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        <span className="font-normal text-gray-500 ml-1">
                          ({dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                          {finishDt ? ` – ${finishDt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''})
                        </span>
                      </p>
                    </div>

                    <div>
                      <span className="text-gray-400 font-bold block text-[10px] uppercase">Requester</span>
                      <p className="font-bold text-gray-800">
                        {b.requesterName} {b.department ? `(${b.department})` : ''}
                      </p>
                    </div>

                    <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1">
                      <p className="text-gray-600 font-medium">
                        <strong className="text-emerald-700 font-bold">Pickup:</strong> {pickupDisplay}
                      </p>
                      <p className="text-gray-800 font-bold">
                        <strong className="text-blue-700 font-bold">Destination:</strong> {b.destination}
                      </p>
                      {b.purpose && (
                        <p className="text-gray-400 italic text-[11px]">Purpose: {b.purpose}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-gray-500 font-semibold">{totalPax} Passengers</span>
                      <span className="font-bold text-gray-700">
                        {driver ? `Driver: ${driver.name}` : '⚠️ Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setDetailsBooking(b)}
                    className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => {
                      setEditingBooking(b);
                      setIsFormOpen(true);
                    }}
                    className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirmState({ isOpen: true, isBulk: false, bookingId: b.id })}
                    className="px-2.5 py-1 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* PAGINATION BAR */}
      {filteredBookings.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
          <div className="text-gray-600 font-medium">
            Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to <strong>{Math.min(currentPage * pageSize, filteredBookings.length)}</strong> of <strong>{filteredBookings.length}</strong> bookings
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-500 font-semibold">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="py-1 px-2 border border-gray-300 rounded-md bg-white font-bold"
              >
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <span className="px-3 py-1 font-bold text-gray-800">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                className="px-3 py-1.5 border border-gray-300 rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK ASSIGN MODAL */}
      {isBulkAssignOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <UserCircleIcon className="h-6 w-6 text-indigo-600" />
                <h3 className="font-extrabold text-gray-900">Assign Driver & Vehicle</h3>
              </div>
              <button onClick={() => setIsBulkAssignOpen(false)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBulkAssignSubmit} className="p-5 space-y-4 text-xs">
              <p className="text-gray-600">
                You are assigning <strong>{selectedIds.length}</strong> selected booking(s) to the chosen driver and vehicle.
              </p>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Select Driver</label>
                <select
                  value={bulkAssignDriverId}
                  onChange={(e) => setBulkAssignDriverId(e.target.value)}
                  required
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                >
                  <option value="">-- Select Driver --</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name} ({d.phone || 'No phone'})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-gray-700 mb-1.5">Select Vehicle</label>
                <select
                  value={bulkAssignVehicleId}
                  onChange={(e) => setBulkAssignVehicleId(e.target.value)}
                  required
                  className="w-full py-2.5 px-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 font-medium text-sm"
                >
                  <option value="">-- Select Vehicle --</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBulkAssignOpen(false)}
                  className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition"
                >
                  Assign & Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteConfirmState.isOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 text-center animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-4">
              <TrashIcon className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-extrabold text-gray-900">Confirm Deletion</h3>
            <p className="text-xs text-gray-500 mt-2">
              {deleteConfirmState.isBulk
                ? `Are you sure you want to delete ${selectedIds.length} selected booking(s)? This action will remove the record(s) from storage and the calendar.`
                : `Are you sure you want to delete this booking? This action cannot be undone.`}
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmState({ isOpen: false, isBulk: false })}
                className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50 text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs shadow-md"
              >
                Yes, Delete Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING DETAILS MODAL */}
      {detailsBooking && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/60">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-gray-900 text-base">Booking Details</span>
                <span className="font-mono text-xs font-bold text-gray-500">#{detailsBooking.id.slice(-6).toUpperCase()}</span>
                {getStatusBadge(detailsBooking.status)}
              </div>
              <button onClick={() => setDetailsBooking(null)} className="text-gray-400 hover:text-gray-600">
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-bold uppercase text-[10px] block">Requester</span>
                  <p className="text-sm font-extrabold text-gray-900 mt-0.5">{detailsBooking.requesterName}</p>
                  <p className="text-gray-600 mt-0.5">{detailsBooking.department || 'No department'}</p>
                  <p className="font-mono text-gray-500 mt-1">{detailsBooking.requesterPhone || 'No phone'}</p>
                  <p className="text-gray-500">{detailsBooking.requesterEmail || 'No email'}</p>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                  <span className="text-gray-400 font-bold uppercase text-[10px] block">Date & Time</span>
                  <p className="text-sm font-extrabold text-gray-900 mt-0.5">
                    {parseAsLocal(detailsBooking.dateTime).toLocaleDateString('en-GB', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-indigo-600 font-bold mt-1">
                    {parseAsLocal(detailsBooking.dateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                    {detailsBooking.finishDateTime && ` – ${parseAsLocal(detailsBooking.finishDateTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`}
                  </p>
                </div>
              </div>

              {/* LOCATION */}
              <div className="bg-indigo-50/40 p-4 rounded-xl border border-indigo-100 space-y-2">
                <div>
                  <span className="text-emerald-700 font-bold uppercase text-[10px] block">Pickup Location</span>
                  <p className="font-extrabold text-gray-900 text-sm mt-0.5">
                    {getPickupLocationDisplay(detailsBooking.pickupPoint, detailsBooking.address)}
                  </p>
                </div>
                <div className="pt-2 border-t border-indigo-100/60">
                  <span className="text-blue-700 font-bold uppercase text-[10px] block">Destination</span>
                  <p className="font-extrabold text-gray-900 text-sm mt-0.5">{detailsBooking.destination}</p>
                  {detailsBooking.purpose && (
                    <p className="text-gray-600 mt-1">Purpose: {detailsBooking.purpose}</p>
                  )}
                </div>
              </div>

              {/* DRIVER ASSIGNMENT */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl border border-gray-200">
                  <span className="text-gray-400 font-bold uppercase text-[10px] block">Assigned Driver</span>
                  {detailsBooking.driverId ? (
                    <div className="mt-1">
                      <p className="font-extrabold text-gray-900 text-sm">
                        {users.find(u => u.id === detailsBooking.driverId)?.name || 'Driver'}
                      </p>
                      <p className="text-gray-500">{users.find(u => u.id === detailsBooking.driverId)?.phone || ''}</p>
                    </div>
                  ) : (
                    <p className="text-amber-600 font-bold mt-1">Unassigned</p>
                  )}
                </div>

                <div className="p-3.5 rounded-xl border border-gray-200">
                  <span className="text-gray-400 font-bold uppercase text-[10px] block">Vehicle</span>
                  {detailsBooking.vehicleId ? (
                    <div className="mt-1">
                      <p className="font-extrabold text-gray-900 text-sm">
                        {vehicles.find(v => v.id === detailsBooking.vehicleId)?.name || 'Vehicle'}
                      </p>
                      <p className="font-mono text-gray-700 font-bold">
                        {vehicles.find(v => v.id === detailsBooking.vehicleId)?.plateNumber || ''}
                      </p>
                    </div>
                  ) : (
                    <p className="text-gray-400 font-medium mt-1">No vehicle assigned</p>
                  )}
                </div>
              </div>

              {/* PASSENGERS & REMARKS */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <span className="font-bold text-gray-700">Total Passengers:</span>
                  <span className="font-extrabold text-gray-900">
                    {detailsBooking.passengers.reduce((sum, p) => sum + p.count, 0)} pax
                  </span>
                </div>
                {detailsBooking.remarks && (
                  <div className="p-3 rounded-xl bg-amber-50/60 border border-amber-200 text-amber-950">
                    <strong className="block text-[10px] uppercase tracking-wider font-extrabold">Requester Notes:</strong>
                    <p className="mt-0.5">{detailsBooking.remarks}</p>
                  </div>
                )}
                {detailsBooking.adminNotes && (
                  <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200 text-blue-950">
                    <strong className="block text-[10px] uppercase tracking-wider font-extrabold">Admin Notes:</strong>
                    <p className="mt-0.5">{detailsBooking.adminNotes}</p>
                  </div>
                )}
                {detailsBooking.attachmentUrl && (
                  <div className="p-3 rounded-xl bg-gray-50 border border-gray-200 flex items-center justify-between">
                    <span className="font-bold text-gray-700">Attachment / Document:</span>
                    <a
                      href={detailsBooking.attachmentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-600 font-bold hover:underline flex items-center gap-1"
                    >
                      Open Document <ExternalLinkIcon className="h-3.5 w-3.5" />
                    </a>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setDetailsBooking(null)}
                className="px-4 py-2 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const b = detailsBooking;
                  setDetailsBooking(null);
                  setEditingBooking(b);
                  setIsFormOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md"
              >
                Edit Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOOKING EDIT / ADD FORM MODAL */}
      {isFormOpen && (
        <BookingForm
          isOpen={isFormOpen}
          bookingToEdit={editingBooking}
          onClose={() => {
            setIsFormOpen(false);
            setEditingBooking(null);
          }}
        />
      )}
    </div>
  );
};

export default BookingManagementList;
