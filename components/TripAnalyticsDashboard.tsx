import React, { useCallback, useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal, resolveDriver } from '../utils';
import type { Booking, OdometerLog } from '../types';
import {
  ChartBarIcon,
  CheckCircleIcon,
  ClockIcon,
  DocumentDownloadIcon,
  ExclamationIcon,
  GaugeIcon,
  LocationMarkerIcon,
  PlusIcon,
  PencilIcon,
  PrinterIcon,
  RouteIcon,
  SearchIcon,
  TruckIcon,
  UserCircleIcon,
  UsersIcon,
  XIcon,
} from './icons/Icons';

export interface DerivedTrip {
  id: string;
  date: string;
  timestamp: number;
  vehicleId: string;
  driverId: string | null;
  vehicleName: string;
  plateNumber: string;
  driverName: string;
  fromLocation: string;
  toLocation: string;
  purpose: string;
  distance: number | null;
  startOdometer?: number;
  endOdometer?: number;
  serviceType: 'Perlu Driver' | 'Self-Drive' | 'Unknown';
  department: string;
  passengerCount: number;
  source: 'odometer' | 'booking';
  bookingId?: string;
  remarks?: string;
  isLongHaul: boolean;
  missingMileage: boolean;
}

declare global {
  interface Window {
    jspdf: any;
  }
}

type SortField = keyof Pick<
  DerivedTrip,
  'date' | 'vehicleName' | 'driverName' | 'purpose' | 'distance' | 'passengerCount' | 'serviceType'
>;

type DatePreset = 'all' | '30d' | '90d' | 'year' | 'custom';
type ServiceFilter = 'all' | 'driver' | 'self-drive';

interface TripAnalyticsDashboardProps {
  onOpenOdoModal?: (log?: OdometerLog | null) => void;
}

const passengerTotal = (booking?: Booking | null): number => {
  if (!booking?.passengers?.length) return 0;
  return booking.passengers.reduce((sum, p) => sum + (p.count || 0), 0);
};

const resolveDistance = (log: OdometerLog, booking?: Booking | null): number | null => {
  if (typeof log.distance === 'number' && log.distance > 0) return log.distance;
  if (typeof log.startOdometer === 'number' && typeof log.odometer === 'number') {
    const delta = log.odometer - log.startOdometer;
    if (delta > 0) return delta;
  }
  if (typeof booking?.distance === 'number' && booking.distance > 0) return booking.distance;
  return null;
};

const formatKm = (value: number | null | undefined, digits = 0): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })} km`;
};

export const TripAnalyticsDashboard: React.FC<TripAnalyticsDashboardProps> = ({ onOpenOdoModal }) => {
  const { odometerLogs, bookings, vehicles, users } = useAppContext();

  const [selectedVehicleId, setSelectedVehicleId] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState('all');
  const [serviceFilter, setServiceFilter] = useState<ServiceFilter>('all');
  const [dateRangePreset, setDateRangePreset] = useState<DatePreset>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [tableSearchQuery, setTableSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortAsc, setSortAsc] = useState(false);
  const [mileageFilter, setMileageFilter] = useState<'all' | 'with_km' | 'missing_km'>('all');

  // UX: section tabs, pagination, mobile filters
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [filtersOpen, setFiltersOpen] = useState<boolean>(false);

  const drivers = useMemo(
    () => users.filter(u => u.role === 'driver' || u.role === 'admin'),
    [users]
  );

  const getVehicle = useCallback(
    (vehicleId?: string | null) =>
      vehicles.find(v => v.id === vehicleId) || { name: 'Unknown Vehicle', plateNumber: '-' },
    [vehicles]
  );

  const getDriverName = useCallback(
    (driverId?: string | null, staffName?: string | null) => {
      if (staffName && staffName.trim()) return staffName.trim();
      if (driverId) {
        const user = resolveDriver(users, driverId);
        if (user) return user.name;
        if (driverId.startsWith('staff-')) {
          const clean = driverId.replace(/^staff-/, '').replace(/-/g, ' ');
          return clean.replace(/\b\w/g, c => c.toUpperCase());
        }
        return driverId;
      }
      return 'Unassigned';
    },
    [users]
  );

  const bookingById = useMemo(() => {
    const map = new Map<string, Booking>();
    bookings.forEach(b => map.set(b.id, b));
    return map;
  }, [bookings]);

  const allDerivedTrips = useMemo(() => {
    const coveredBookingIds = new Set<string>();
    const trips: DerivedTrip[] = [];

    odometerLogs.forEach(log => {
      const linkedIds = [
        ...(log.bookingId ? [log.bookingId] : []),
        ...(log.bookingIds || []),
      ];
      linkedIds.forEach(id => coveredBookingIds.add(id));
      const booking = linkedIds.map(id => bookingById.get(id)).find(Boolean);

      const vehicle = getVehicle(log.vehicleId);
      const distance = resolveDistance(log, booking);
      const serviceType = booking?.serviceType
        || (log.driverId ? 'Perlu Driver' : 'Self-Drive');
      const toLocation = log.toLocation || booking?.destination || '—';
      const fromLocation = log.fromLocation || booking?.pickupPoint || '—';
      const purpose = log.purpose || booking?.purpose || '—';
      const dateObj = parseAsLocal(log.date);

      trips.push({
        id: log.id,
        date: log.date,
        timestamp: dateObj.getTime(),
        vehicleId: log.vehicleId,
        driverId: log.driverId || booking?.driverId || null,
        vehicleName: vehicle.name,
        plateNumber: vehicle.plateNumber,
        driverName: getDriverName(log.driverId || booking?.driverId, log.staffName),
        fromLocation,
        toLocation,
        purpose,
        distance,
        startOdometer: log.startOdometer,
        endOdometer: log.odometer,
        serviceType,
        department: booking?.department || '',
        passengerCount: passengerTotal(booking),
        source: 'odometer',
        bookingId: linkedIds[0],
        remarks: log.remarks,
        isLongHaul: (distance || 0) >= 80,
        missingMileage: distance === null,
      });
    });

    bookings
      .filter(b => b.status === 'Completed' && !coveredBookingIds.has(b.id))
      .forEach(booking => {
        const vehicle = getVehicle(booking.vehicleId);
        const distance = typeof booking.distance === 'number' && booking.distance > 0
          ? booking.distance
          : null;
        const dateObj = parseAsLocal(booking.dateTime);

        trips.push({
          id: `booking-${booking.id}`,
          date: booking.dateTime,
          timestamp: dateObj.getTime(),
          vehicleId: booking.vehicleId || '',
          driverId: booking.driverId,
          vehicleName: booking.vehicleId ? vehicle.name : 'Unassigned / Self-Drive',
          plateNumber: booking.vehicleId ? vehicle.plateNumber : '-',
          driverName: getDriverName(booking.driverId),
          fromLocation: booking.pickupPoint || '—',
          toLocation: booking.destination || '—',
          purpose: booking.purpose || '—',
          distance,
          startOdometer: booking.startOdometer,
          endOdometer: booking.endOdometer,
          serviceType: booking.serviceType || 'Unknown',
          department: booking.department || '',
          passengerCount: passengerTotal(booking),
          source: 'booking',
          bookingId: booking.id,
          remarks: booking.remarks,
          isLongHaul: (distance || 0) >= 80,
          missingMileage: distance === null,
        });
      });

    return trips;
  }, [odometerLogs, bookings, bookingById, getVehicle, getDriverName]);

  const inDateRange = useCallback(
    (rawDate: string) => {
      const itemDate = parseAsLocal(rawDate);
      if (Number.isNaN(itemDate.getTime())) return false;
      const now = new Date();

      if (dateRangePreset === '30d') {
        return itemDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (dateRangePreset === '90d') {
        return itemDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      }
      if (dateRangePreset === 'year') {
        return itemDate >= new Date(now.getFullYear(), 0, 1);
      }
      if (dateRangePreset === 'custom') {
        if (customStartDate && parseAsLocal(customStartDate) > itemDate) return false;
        if (customEndDate) {
          const end = parseAsLocal(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (end < itemDate) return false;
        }
      }
      return true;
    },
    [dateRangePreset, customStartDate, customEndDate]
  );

  const filteredTrips = useMemo(() => {
    return allDerivedTrips.filter(trip => {
      if (selectedVehicleId !== 'all' && trip.vehicleId !== selectedVehicleId) return false;
      if (selectedDriverId !== 'all') {
        if (selectedDriverId === 'unknown') {
          if (trip.driverId) return false;
        } else if (trip.driverId !== selectedDriverId) {
          return false;
        }
      }
      if (serviceFilter === 'driver' && trip.serviceType === 'Self-Drive') return false;
      if (serviceFilter === 'self-drive' && trip.serviceType !== 'Self-Drive') return false;
      if (!inDateRange(trip.date)) return false;
      if (mileageFilter === 'with_km' && trip.missingMileage) return false;
      if (mileageFilter === 'missing_km' && !trip.missingMileage) return false;

      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase().trim();
        const haystack = [
          trip.vehicleName,
          trip.plateNumber,
          trip.driverName,
          trip.fromLocation,
          trip.toLocation,
          trip.purpose,
          trip.department,
          trip.remarks || '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    allDerivedTrips,
    selectedVehicleId,
    selectedDriverId,
    serviceFilter,
    inDateRange,
    mileageFilter,
    tableSearchQuery,
  ]);

  const kpis = useMemo(() => {
    const withKm = filteredTrips.filter(t => t.distance && t.distance > 0);
    const totalDistance = withKm.reduce((sum, t) => sum + (t.distance || 0), 0);
    const totalTrips = filteredTrips.length;
    const avgKm = withKm.length > 0 ? totalDistance / withKm.length : 0;
    const uniqueVehicles = new Set(filteredTrips.map(t => t.vehicleId).filter(Boolean)).size;
    const uniqueDrivers = new Set(filteredTrips.map(t => t.driverName).filter(n => n && n !== 'Unassigned')).size;
    const uniqueDestinations = new Set(
      filteredTrips.map(t => t.toLocation).filter(d => d && d !== '—')
    ).size;
    const missingMileage = filteredTrips.filter(t => t.missingMileage).length;
    const selfDriveCount = filteredTrips.filter(t => t.serviceType === 'Self-Drive').length;
    const longHaulCount = filteredTrips.filter(t => t.isLongHaul).length;
    const passengerTotalCount = filteredTrips.reduce((sum, t) => sum + t.passengerCount, 0);

    const timestamps = filteredTrips.map(t => t.timestamp).filter(t => !Number.isNaN(t));
    const spanDays = timestamps.length > 1
      ? Math.max(1, Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / (1000 * 60 * 60 * 24)))
      : 1;
    const avgDailyKm = spanDays > 0 ? totalDistance / spanDays : totalDistance;

    return {
      totalTrips,
      totalDistance,
      avgKm,
      uniqueVehicles,
      uniqueDrivers,
      uniqueDestinations,
      missingMileage,
      missingPct: totalTrips > 0 ? (missingMileage / totalTrips) * 100 : 0,
      selfDriveCount,
      longHaulCount,
      passengerTotalCount,
      avgDailyKm,
      withKmCount: withKm.length,
    };
  }, [filteredTrips]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, { trips: number; km: number }>();
    filteredTrips.forEach(trip => {
      const d = parseAsLocal(trip.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, { trips: 0, km: 0 });
      const cur = map.get(key)!;
      cur.trips += 1;
      cur.km += trip.distance || 0;
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([monthKey, val]) => {
        const [y, m] = monthKey.split('-');
        const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-GB', {
          month: 'short',
          year: '2-digit',
        });
        return { monthKey, label, ...val };
      });
  }, [filteredTrips]);

  const dayOfWeekDistribution = useMemo(() => {
    const days = [
      { key: 1, label: 'Mon', fullDay: 'Monday', trips: 0, km: 0 },
      { key: 2, label: 'Tue', fullDay: 'Tuesday', trips: 0, km: 0 },
      { key: 3, label: 'Wed', fullDay: 'Wednesday', trips: 0, km: 0 },
      { key: 4, label: 'Thu', fullDay: 'Thursday', trips: 0, km: 0 },
      { key: 5, label: 'Fri', fullDay: 'Friday', trips: 0, km: 0 },
      { key: 6, label: 'Sat', fullDay: 'Saturday', trips: 0, km: 0 },
      { key: 0, label: 'Sun', fullDay: 'Sunday', trips: 0, km: 0 },
    ];
    filteredTrips.forEach(trip => {
      const idx = parseAsLocal(trip.date).getDay();
      const row = days.find(d => d.key === idx);
      if (!row) return;
      row.trips += 1;
      row.km += trip.distance || 0;
    });
    const maxTrips = Math.max(...days.map(d => d.trips), 1);
    return days.map(d => ({ ...d, relativeHeight: Math.round((d.trips / maxTrips) * 100) }));
  }, [filteredTrips]);

  const vehicleRanking = useMemo(() => {
    const map = new Map<string, { name: string; plate: string; trips: number; km: number }>();
    filteredTrips.forEach(trip => {
      const key = trip.vehicleId || trip.vehicleName;
      if (!map.has(key)) {
        map.set(key, { name: trip.vehicleName, plate: trip.plateNumber, trips: 0, km: 0 });
      }
      const cur = map.get(key)!;
      cur.trips += 1;
      cur.km += trip.distance || 0;
    });
    const rows = Array.from(map.values()).sort((a, b) => b.km - a.km || b.trips - a.trips);
    const maxKm = Math.max(...rows.map(r => r.km), 1);
    return rows.slice(0, 8).map(r => ({ ...r, pct: Math.round((r.km / maxKm) * 100) }));
  }, [filteredTrips]);

  const driverRanking = useMemo(() => {
    const map = new Map<string, { name: string; trips: number; km: number }>();
    filteredTrips.forEach(trip => {
      const key = trip.driverName || 'Unassigned';
      if (!map.has(key)) map.set(key, { name: key, trips: 0, km: 0 });
      const cur = map.get(key)!;
      cur.trips += 1;
      cur.km += trip.distance || 0;
    });
    const rows = Array.from(map.values()).sort((a, b) => b.trips - a.trips || b.km - a.km);
    const maxTrips = Math.max(...rows.map(r => r.trips), 1);
    return rows.slice(0, 8).map(r => ({ ...r, pct: Math.round((r.trips / maxTrips) * 100) }));
  }, [filteredTrips]);

  const topDestinations = useMemo(() => {
    const map = new Map<string, { name: string; trips: number; km: number }>();
    filteredTrips.forEach(trip => {
      const name = trip.toLocation && trip.toLocation !== '—' ? trip.toLocation : 'Unspecified';
      if (!map.has(name)) map.set(name, { name, trips: 0, km: 0 });
      const cur = map.get(name)!;
      cur.trips += 1;
      cur.km += trip.distance || 0;
    });
    return Array.from(map.values())
      .sort((a, b) => b.trips - a.trips)
      .slice(0, 6);
  }, [filteredTrips]);

  const peakDay = useMemo(() => {
    return dayOfWeekDistribution.reduce(
      (prev, curr) => (curr.trips > prev.trips ? curr : prev),
      dayOfWeekDistribution[0]
    );
  }, [dayOfWeekDistribution]);

  const sortedTableData = useMemo(() => {
    const copy = [...filteredTrips];
    copy.sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (sortField === 'date') {
        return sortAsc ? a.timestamp - b.timestamp : b.timestamp - a.timestamp;
      }
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      const as = String(av ?? '').toLowerCase();
      const bs = String(bv ?? '').toLowerCase();
      if (as < bs) return sortAsc ? -1 : 1;
      if (as > bs) return sortAsc ? 1 : -1;
      return 0;
    });
    return copy;
  }, [filteredTrips, sortField, sortAsc]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(field === 'date' ? false : true);
    }
    setCurrentPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(sortedTableData.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTableData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return sortedTableData.slice(start, start + pageSize);
  }, [sortedTableData, safePage, pageSize]);

  const handlePrint = () => {
    const node = document.getElementById('trip-analytics-printable');
    if (!node) return;
    const printContainer = document.createElement('div');
    printContainer.id = 'print-container';
    printContainer.innerHTML = node.innerHTML;
    document.body.appendChild(printContainer);
    document.body.classList.add('is-printing');
    window.print();
    document.body.removeChild(printContainer);
    document.body.classList.remove('is-printing');
  };

  const handleExportCSV = () => {
    const headers = [
      'Date',
      'Vehicle',
      'Plate',
      'Driver',
      'From',
      'To',
      'Purpose',
      'Distance (km)',
      'Start Odo',
      'End Odo',
      'Service Type',
      'Department',
      'Passengers',
      'Source',
      'Missing Mileage',
    ];
    const rows = sortedTableData.map(t => [
      `"${parseAsLocal(t.date).toLocaleDateString('en-GB')}"`,
      `"${t.vehicleName}"`,
      `"${t.plateNumber}"`,
      `"${t.driverName}"`,
      `"${(t.fromLocation || '').replace(/"/g, '""')}"`,
      `"${(t.toLocation || '').replace(/"/g, '""')}"`,
      `"${(t.purpose || '').replace(/"/g, '""')}"`,
      `"${t.distance ?? ''}"`,
      `"${t.startOdometer ?? ''}"`,
      `"${t.endOdometer ?? ''}"`,
      `"${t.serviceType}"`,
      `"${t.department}"`,
      `"${t.passengerCount || ''}"`,
      `"${t.source}"`,
      `"${t.missingMileage ? 'Yes' : 'No'}"`,
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Fleet_Trip_Analytics_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const handleExportPDF = () => {
    if (sortedTableData.length === 0) {
      alert('No trip data available to export.');
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Armada Flow — Fleet Trip Analytics', 14, 14);
    doc.setFontSize(9);
    doc.text(
      `${kpis.totalTrips} trips · ${kpis.totalDistance.toLocaleString()} km · Generated ${new Date().toLocaleDateString('en-GB')}`,
      14,
      20
    );
    doc.autoTable({
      startY: 26,
      head: [['Date', 'Vehicle', 'Driver', 'Route', 'Purpose', 'Km', 'Type']],
      body: sortedTableData.map(t => [
        parseAsLocal(t.date).toLocaleDateString('en-GB'),
        `${t.vehicleName} (${t.plateNumber})`,
        t.driverName,
        `${t.fromLocation} → ${t.toLocation}`,
        t.purpose,
        t.distance != null ? t.distance.toLocaleString() : '—',
        t.serviceType === 'Self-Drive' ? 'Self-Drive' : 'Driver',
      ]),
      styles: { fontSize: 8 },
    });
    doc.save(`fleet_trip_analytics_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const maxMonthlyKm = Math.max(...monthlyTrend.map(m => m.km), 1);
  const healthOk = kpis.missingPct < 15;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 mb-1">
              <RouteIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Fleet Movement Intelligence</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Fleet Trip Analytics Dashboard
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Odometer-backed mileage, destination demand, driver workload, and trip coverage — with booking context when a trip is linked.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <PrinterIcon className="h-4 w-4 mr-1.5 text-slate-600" />
              Print
            </button>
            <button
              onClick={handleExportPDF}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <DocumentDownloadIcon className="h-4 w-4 mr-1.5 text-indigo-600" />
              PDF
            </button>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <DocumentDownloadIcon className="h-4 w-4 mr-1.5 text-emerald-600" />
              Export CSV
            </button>
            {onOpenOdoModal && (
              <button
                onClick={onOpenOdoModal}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition transform hover:-translate-y-0.5 cursor-pointer"
              >
                <PlusIcon className="h-4 w-4 mr-1.5" />
                Record Trip
              </button>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => setFiltersOpen(o => !o)}
            className="sm:hidden w-full flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 mb-3"
          >
            <span>Filters · {dateRangePreset === 'all' ? 'All time' : dateRangePreset}</span>
            <span className="text-slate-400">{filtersOpen ? '▲' : '▼'}</span>
          </button>
          <div className={`${filtersOpen ? 'flex' : 'hidden'} sm:flex flex-wrap items-center justify-between gap-3 text-xs`}>
          <div className="flex items-center flex-wrap gap-2 w-full lg:w-auto">
            <label className="font-bold text-slate-600">Vehicle:</label>
            <select
              value={selectedVehicleId}
              onChange={e => { setSelectedVehicleId(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Fleet Vehicles ({vehicles.length})</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber})
                </option>
              ))}
            </select>

            <label className="font-bold text-slate-600 ml-1">Driver:</label>
            <select
              value={selectedDriverId}
              onChange={e => { setSelectedDriverId(e.target.value); setCurrentPage(1); }}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="all">All Drivers</option>
              <option value="unknown">Unassigned / Staff</option>
              {drivers.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl overflow-x-auto max-w-full">
            {(['all', '30d', '90d', 'year', 'custom'] as const).map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => { setDateRangePreset(preset); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  dateRangePreset === preset
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' && 'All Time'}
                {preset === '30d' && '30 Days'}
                {preset === '90d' && '90 Days'}
                {preset === 'year' && 'This Year'}
                {preset === 'custom' && 'Custom'}
              </button>
            ))}
          </div>

          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-150 w-full sm:w-auto">
              <input
                type="date"
                value={customStartDate}
                onChange={e => { setCustomStartDate(e.target.value); setCurrentPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white flex-1"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => { setCustomEndDate(e.target.value); setCurrentPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white flex-1"
              />
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
            {([
              { id: 'all', label: 'All Types' },
              { id: 'driver', label: 'With Driver' },
              { id: 'self-drive', label: 'Self-Drive' },
            ] as const).map(opt => (
              <button
                key={opt.id}
                type="button"
                onClick={() => { setServiceFilter(opt.id); setCurrentPage(1); }}
                className={`px-2.5 sm:px-3 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer whitespace-nowrap ${
                  serviceFilter === opt.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      {/* SECTION TABS */}
      <div className="bg-white rounded-2xl border border-slate-200 p-1.5 shadow-xs flex gap-1 sticky top-2 z-20">
        {([
          { id: 'overview' as const, label: 'Overview', hint: 'KPIs & trends' },
          { id: 'logs' as const, label: 'Trip Log', hint: `${sortedTableData.length} records` },
        ]).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 rounded-xl px-3 py-2.5 text-center transition cursor-pointer ${
              activeTab === tab.id
                ? 'bg-indigo-50 text-indigo-900 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:bg-slate-50 border border-transparent'
            }`}
          >
            <span className="block text-xs font-extrabold">{tab.label}</span>
            <span className="block text-[10px] font-medium opacity-70 mt-0.5">{tab.hint}</span>
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
      <>
      {healthOk ? (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Trip Mileage Coverage:</span>
            <span className="text-emerald-700 font-medium">
              {kpis.withKmCount} of {kpis.totalTrips} trips in this view have a recorded distance.
              {kpis.missingMileage > 0 ? ` ${kpis.missingMileage} still need odometer close-out.` : ' Capture looks healthy.'}
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 font-semibold hidden md:inline">
            Peak day: {peakDay.fullDay}
          </span>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4.5 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200/70 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <ExclamationIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wide text-amber-900">
                  Mileage Close-Out Gap
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  {kpis.missingMileage} trips without km
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                {kpis.missingPct.toFixed(0)}% of trips in this period have no usable distance. Monthly vehicle km and driver workload will under-count until odometer logs (or booking end readings) are completed.
              </p>
              <button
                type="button"
                onClick={() => { setMileageFilter('missing_km'); setActiveTab('logs'); setCurrentPage(1); }}
                className="mt-2 inline-flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold cursor-pointer"
              >
                Review missing trips →
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Trips</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <RouteIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{kpis.totalTrips.toLocaleString()}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {kpis.selfDriveCount} self-drive · {kpis.longHaulCount} long-haul (≥80 km)
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Distance</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <GaugeIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {kpis.totalDistance.toLocaleString()} <span className="text-sm font-bold text-slate-500">km</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold">
            ~{Math.round(kpis.avgDailyKm).toLocaleString()} km/day in range
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Trip Length</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ChartBarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {kpis.avgKm > 0 ? kpis.avgKm.toFixed(1) : '—'} <span className="text-sm font-bold text-emerald-600">km</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Based on {kpis.withKmCount} trips with recorded km
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Fleet In Use</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <TruckIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {kpis.uniqueVehicles} <span className="text-sm font-bold text-slate-500">vehicles</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            {kpis.uniqueDrivers} drivers / staff on the wheel
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Destinations</span>
            <div className="p-1.5 bg-rose-50 text-rose-600 rounded-lg">
              <LocationMarkerIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{kpis.uniqueDestinations}</div>
          <div className="text-[11px] text-slate-500 font-medium">
            {kpis.passengerTotalCount.toLocaleString()} passengers logged from bookings
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Monthly Mileage & Trip Volume</h3>
              <p className="text-[11px] text-slate-500">
                Bars show total kilometres. Labels show trip count for that month.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-indigo-500"></span>
                <span>Distance (km)</span>
              </div>
            </div>
          </div>

          <div className="mt-5">
            {monthlyTrend.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-6 items-end min-h-[190px]">
                {monthlyTrend.map(item => {
                  const barHeightPct = Math.max(8, Math.round((item.km / maxMonthlyKm) * 100));
                  return (
                    <div key={item.monthKey} className="flex flex-col items-center gap-1.5 group">
                      <div className="text-[10px] font-bold text-slate-700 opacity-80 group-hover:opacity-100 font-mono">
                        {item.km > 0 ? Math.round(item.km).toLocaleString() : '0'}
                      </div>
                      <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl h-36 flex flex-col justify-end p-1 relative overflow-hidden group-hover:bg-slate-200 transition-colors">
                        <div
                          className="w-full bg-gradient-to-t from-indigo-700 to-indigo-400 rounded-t-lg transition-all duration-500"
                          style={{ height: `${barHeightPct}%` }}
                          title={`${item.trips} trips · ${Math.round(item.km).toLocaleString()} km`}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                      <span className="text-[9px] font-mono text-indigo-600 font-bold">{item.trips} trips</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-center py-12 text-slate-400 text-xs font-semibold">No trip mileage in this period.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">Day-of-Week Demand</h3>
            <p className="text-[11px] text-slate-500 mb-4">When the fleet actually moves.</p>
            <div className="space-y-2">
              {dayOfWeekDistribution.map(item => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className="w-8 text-[11px] font-bold text-slate-500">{item.label}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${item.relativeHeight}%` }}
                    />
                  </div>
                  <span className="font-mono text-slate-800 font-bold text-[11px] w-10 text-right">{item.trips}</span>
                  <span className="font-mono text-slate-400 text-[10px] w-14 text-right">
                    {item.km > 0 ? `${Math.round(item.km)} km` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Weekly Operations Trend</span>
            <span className="font-bold text-indigo-700">Peak: {peakDay.fullDay}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">Vehicle Mileage Ranking</h3>
          <p className="text-[11px] text-slate-500 mb-4">Highest kilometres in the selected period.</p>
          <div className="space-y-3">
            {vehicleRanking.length === 0 && (
              <p className="text-xs text-slate-400 font-medium py-6 text-center">No vehicle activity.</p>
            )}
            {vehicleRanking.map((row, idx) => (
              <div key={`${row.name}-${row.plate}`}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-800 truncate pr-2">
                    <span className="text-slate-400 mr-1.5">{idx + 1}.</span>
                    {row.name} <span className="text-slate-500 font-medium">({row.plate})</span>
                  </span>
                  <span className="font-mono font-black text-indigo-700 whitespace-nowrap">{Math.round(row.km).toLocaleString()} km</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${Math.max(6, row.pct)}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{row.trips} trips</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">Driver Workload</h3>
          <p className="text-[11px] text-slate-500 mb-4">Ranked by trip count, with kilometres as backup.</p>
          <div className="space-y-3">
            {driverRanking.length === 0 && (
              <p className="text-xs text-slate-400 font-medium py-6 text-center">No driver activity.</p>
            )}
            {driverRanking.map((row, idx) => (
              <div key={row.name}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-bold text-slate-800 truncate pr-2 flex items-center gap-1.5">
                    <UserCircleIcon className="h-3.5 w-3.5 text-slate-400" />
                    {idx + 1}. {row.name}
                  </span>
                  <span className="font-mono font-black text-slate-800 whitespace-nowrap">{row.trips}</span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-slate-700 rounded-full" style={{ width: `${Math.max(6, row.pct)}%` }} />
                </div>
                <div className="text-[10px] text-slate-400 font-medium mt-0.5">{Math.round(row.km).toLocaleString()} km logged</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mb-1">Top Destinations</h3>
          <p className="text-[11px] text-slate-500 mb-4">Where demand concentrates.</p>
          <div className="space-y-2.5">
            {topDestinations.length === 0 && (
              <p className="text-xs text-slate-400 font-medium py-6 text-center">No destinations recorded.</p>
            )}
            {topDestinations.map((row, idx) => (
              <div key={row.name} className="flex items-start justify-between gap-2 bg-slate-50 rounded-xl px-3 py-2 border border-slate-100">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">
                    {idx + 1}. {row.name}
                  </div>
                  <div className="text-[10px] text-slate-500">{Math.round(row.km).toLocaleString()} km combined</div>
                </div>
                <span className="text-[11px] font-black text-indigo-700 whitespace-nowrap">{row.trips} trips</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      </>
      )}

      {/* ═══ LOGS TAB ═══ */}
      {activeTab === 'logs' && (
      <>
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4" id="trip-analytics-printable">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span>Detailed Trip Log</span>
              <span className="text-xs text-slate-500 font-normal">({sortedTableData.length} records)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Odometer trips first, plus completed bookings that were never closed out with a mileage log.
            </p>
          </div>

          <div className="flex items-center flex-wrap gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                type="text"
                value={tableSearchQuery}
                onChange={e => setTableSearchQuery(e.target.value)}
                placeholder="Search plate, driver, destination..."
                className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              {tableSearchQuery && (
                <button
                  type="button"
                  onClick={() => setTableSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <select
              value={mileageFilter}
              onChange={e => { setMileageFilter(e.target.value as typeof mileageFilter); setCurrentPage(1); }}
              className="border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs bg-slate-50 font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
            >
              <option value="all">All Records</option>
              <option value="with_km">With Distance Only</option>
              <option value="missing_km">Missing Mileage ({kpis.missingMileage})</option>
            </select>
          </div>
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {paginatedTableData.length === 0 ? (
            <div className="text-center py-12 border border-slate-200 rounded-xl bg-slate-50/50">
              <div className="flex flex-col items-center gap-2">
                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                  <RouteIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold text-slate-700">No trips match these filters</p>
                <p className="text-xs text-slate-500">Widen the date range or clear search to see more results.</p>
              </div>
            </div>
          ) : (
            paginatedTableData.map(trip => (
              <div
                key={trip.id}
                className={`rounded-2xl border p-4 space-y-3 shadow-xs ${
                  trip.missingMileage ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-500 flex items-center gap-1.5">
                      {parseAsLocal(trip.date).toLocaleDateString('en-GB')}
                      <span className="text-slate-300">·</span>
                      <span className="font-medium text-slate-400 flex items-center gap-0.5">
                        <ClockIcon className="h-3 w-3" />
                        {trip.source === 'odometer' ? 'Odo log' : 'Booking'}
                      </span>
                    </div>
                    <div className="font-extrabold text-slate-900 text-sm truncate">{trip.vehicleName}</div>
                    <div className="font-mono text-[11px] text-slate-500">{trip.plateNumber}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {trip.missingMileage ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                        No km
                      </span>
                    ) : (
                      <span className={`text-sm font-black ${trip.isLongHaul ? 'text-indigo-800' : 'text-slate-900'}`}>
                        {formatKm(trip.distance, 0)}
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        trip.serviceType === 'Self-Drive'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-indigo-50 text-indigo-800'
                      }`}>
                        {trip.serviceType === 'Self-Drive' ? 'Self-Drive' : trip.serviceType === 'Perlu Driver' ? 'With Driver' : 'Unknown'}
                      </span>
                      {onOpenOdoModal && trip.source === 'odometer' && (
                        <button
                          type="button"
                          onClick={() => {
                            const found = odometerLogs.find(l => l.id === trip.id);
                            if (found) onOpenOdoModal(found);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                          title="Edit Odometer Log"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-xs">
                  <div className="font-semibold text-slate-800">
                    {trip.fromLocation} <span className="text-slate-400">→</span> {trip.toLocation}
                  </div>
                  <div className="text-slate-600 mt-0.5 truncate" title={trip.purpose}>{trip.purpose}</div>
                  {trip.department && (
                    <div className="text-[10px] text-slate-400 mt-0.5">{trip.department}</div>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                  <div className="text-slate-600">
                    <span className="text-slate-400 font-medium">Driver </span>
                    <span className="font-bold text-slate-800">{trip.driverName}</span>
                  </div>
                  <div className="text-slate-600">
                    {trip.passengerCount > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <UsersIcon className="h-3.5 w-3.5 text-slate-400" />
                        {trip.passengerCount} pax
                      </span>
                    ) : (
                      <span className="text-slate-400">— pax</span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th onClick={() => handleSort('date')} className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('vehicleName')} className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Vehicle {sortField === 'vehicleName' && (sortAsc ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('driverName')} className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Driver {sortField === 'driverName' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3.5 py-3 text-left font-bold text-slate-700 whitespace-nowrap">Route</th>
                <th onClick={() => handleSort('purpose')} className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none">
                  Purpose {sortField === 'purpose' && (sortAsc ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('distance')} className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Distance {sortField === 'distance' && (sortAsc ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('serviceType')} className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Type {sortField === 'serviceType' && (sortAsc ? '↑' : '↓')}
                </th>
                <th onClick={() => handleSort('passengerCount')} className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap">
                  Pax {sortField === 'passengerCount' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3.5 py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedTableData.length > 0 ? (
                paginatedTableData.map(trip => (
                  <tr key={trip.id} className={`hover:bg-slate-50 ${trip.missingMileage ? 'bg-amber-50/40' : ''}`}>
                    <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-700">
                      <div>{parseAsLocal(trip.date).toLocaleDateString('en-GB')}</div>
                      <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        {trip.source === 'odometer' ? 'Odometer log' : 'Booking only'}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <div className="font-bold text-slate-900">{trip.vehicleName}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{trip.plateNumber}</div>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700 font-medium">{trip.driverName}</td>
                    <td className="px-3.5 py-2.5 min-w-[160px]">
                      <div className="font-semibold text-slate-800">
                        {trip.fromLocation} <span className="text-slate-400">→</span> {trip.toLocation}
                      </div>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 max-w-[220px]">
                      <div className="truncate" title={trip.purpose}>{trip.purpose}</div>
                      {trip.department && (
                        <div className="text-[10px] text-slate-400">{trip.department}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                      {trip.missingMileage ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold">
                          No km
                        </span>
                      ) : (
                        <span className={`font-extrabold ${trip.isLongHaul ? 'text-indigo-800' : 'text-slate-900'}`}>
                          {formatKm(trip.distance, 0)}
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        trip.serviceType === 'Self-Drive'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-indigo-50 text-indigo-800'
                      }`}>
                        {trip.serviceType === 'Self-Drive' ? 'Self-Drive' : trip.serviceType === 'Perlu Driver' ? 'With Driver' : 'Unknown'}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-right font-semibold text-slate-700">
                      {trip.passengerCount > 0 ? (
                        <span className="inline-flex items-center justify-end gap-1">
                          <UsersIcon className="h-3 w-3 text-slate-400" />
                          {trip.passengerCount}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      {onOpenOdoModal && trip.source === 'odometer' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const found = odometerLogs.find(l => l.id === trip.id);
                            if (found) onOpenOdoModal(found);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer inline-flex items-center justify-center"
                          title="Edit Odometer Log"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-2 py-4">
                      <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
                        <RouteIcon className="h-6 w-6" />
                      </div>
                      <p className="text-sm font-bold text-slate-700">No trips match these filters</p>
                      <p className="text-xs text-slate-500">Widen the date range or clear search to see more results.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {sortedTableData.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">
                Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, sortedTableData.length)} of {sortedTableData.length}
              </span>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                className="border border-slate-300 rounded-lg px-2 py-1 text-xs bg-white font-bold cursor-pointer"
              >
                <option value={10}>10 / page</option>
                <option value={25}>25 / page</option>
                <option value={50}>50 / page</option>
                <option value={100}>100 / page</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(1)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer">First</button>
              <button type="button" disabled={safePage <= 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Prev</button>
              <span className="px-3 py-1.5 text-xs font-extrabold text-slate-800">{safePage} / {totalPages}</span>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Next</button>
              <button type="button" disabled={safePage >= totalPages} onClick={() => setCurrentPage(totalPages)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold border border-slate-200 disabled:opacity-40 hover:bg-slate-50 cursor-pointer">Last</button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

    </div>
  );
};

export default TripAnalyticsDashboard;
