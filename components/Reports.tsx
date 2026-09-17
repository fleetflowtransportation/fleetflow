import React, { useMemo, useState, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal } from '../utils';
import type { Booking, FuelLog, User, Vehicle, OdometerLog } from '../types';
import { 
  PaperClipIcon, 
  EditIcon, 
  TrashIcon, 
  TruckIcon, 
  RouteIcon, 
  FuelIcon, 
  PrinterIcon, 
  DocumentDownloadIcon, 
  GaugeIcon, 
  UserCircleIcon,
  PlusIcon,
  SearchIcon,
  DocumentReportIcon
} from './icons/Icons';
import OdometerLogEditForm from './OdometerLogEditForm';
import FuelLogModal from './FuelLogModal';

declare global {
  interface Window {
    jspdf: any;
  }
}

interface FuelLogWithMetrics extends FuelLog {
  distance?: number;
  avgKML?: number;
  costPerKM?: number;
}

const dateFilters = [
  { key: 'all', label: 'Semua Masa' },
  { key: 'today', label: 'Hari Ini' },
  { key: 'week', label: 'Minggu Ini' },
  { key: 'month', label: 'Bulan Ini' },
  { key: 'last_month', label: 'Bulan Lepas' },
  { key: 'custom', label: 'Julat Tarikh...' },
];

const Reports: React.FC = () => {
  const { 
    bookings, 
    fuelLogs, 
    users, 
    vehicles, 
    deleteFuelLog, 
    odometerLogs, 
    deleteOdometerLog 
  } = useAppContext();

  // Active Sub-Tab: 'odometer' | 'fuel' | 'reports'
  const [activeSubTab, setActiveSubTab] = useState<'odometer' | 'fuel' | 'reports'>('odometer');

  // --- Odometer Logs State ---
  const [editingOdoLog, setEditingOdoLog] = useState<OdometerLog | null>(null);
  const [isOdoModalOpen, setIsOdoModalOpen] = useState(false);
  const [odoSearch, setOdoSearch] = useState('');
  const [odoVehicleFilter, setOdoVehicleFilter] = useState('');
  const [odoDriverFilter, setOdoDriverFilter] = useState('');
  const [odoDateFilter, setOdoDateFilter] = useState('all');
  const [odoStartDate, setOdoStartDate] = useState('');
  const [odoEndDate, setOdoEndDate] = useState('');

  // --- Fuel Logs State ---
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelSearch, setFuelSearch] = useState('');
  const [fuelLogFilters, setFuelLogFilters] = useState({ 
    vehicleId: '', 
    driverId: '', 
    dateFilter: 'all',
    startDate: '',
    endDate: ''
  });

  // --- General Trip Filters for Reports Tab ---
  const [tripFilters, setTripFilters] = useState({ 
    vehicleId: '', 
    driverId: '', 
    dateFilter: 'all',
    startDate: '',
    endDate: ''
  });

  const drivers = useMemo(() => users.filter(u => u.role === 'driver' || u.role === 'admin'), [users]);

  const getDriverName = useCallback((driverId: string | null | undefined) => {
    if (!driverId) return 'Pemandu Tidak Ditetapkan';
    return users.find(d => d.id === driverId)?.name || 'Pemandu';
  }, [users]);

  const getVehicleInfo = useCallback((vehicleId: string | null | undefined) => {
    if (!vehicleId) return { name: 'Kenderaan Bebas', plateNumber: '-' };
    return vehicles.find(v => v.id === vehicleId) || { name: 'Kenderaan Tidak Dikenali', plateNumber: '-' };
  }, [vehicles]);

  // --- CRUD Handlers for Odometer ---
  const handleCreateOdoLog = () => {
    setEditingOdoLog(null);
    setIsOdoModalOpen(true);
  };

  const handleEditOdoLog = (log: OdometerLog) => {
    setEditingOdoLog(log);
    setIsOdoModalOpen(true);
  };

  const handleDeleteOdoLog = (id: string) => {
    if (window.confirm('Adakah anda pasti mahu memadam log odometer ini? Tindakan ini tidak boleh diundur.')) {
      deleteOdometerLog(id);
    }
  };

  // --- CRUD Handlers for Fuel ---
  const handleCreateFuelLog = () => {
    setEditingFuelLog(null);
    setIsFuelModalOpen(true);
  };

  const handleEditFuelLog = (log: FuelLog) => {
    setEditingFuelLog(log);
    setIsFuelModalOpen(true);
  };

  const handleDeleteFuelLog = (id: string) => {
    if (window.confirm('Adakah anda pasti mahu memadam log bahan api ini? Tindakan ini tidak boleh diundur.')) {
      deleteFuelLog(id);
    }
  };

  // Helper date filtering logic
  const checkDateMatch = useCallback((dateStr: string, filterKey: string, start?: string, end?: string) => {
    if (!dateStr) return false;
    const now = new Date();
    const itemDate = new Date(dateStr);
    if (isNaN(itemDate.getTime())) return false;

    if (filterKey === 'all') return true;

    if (filterKey === 'today') {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const check = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());
      return today.getTime() === check.getTime();
    }

    if (filterKey === 'week') {
      const todayForWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const dayOfWeek = todayForWeek.getDay();
      const diff = todayForWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      const startOfWeek = new Date(todayForWeek.getFullYear(), todayForWeek.getMonth(), diff);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      return itemDate >= startOfWeek && itemDate <= endOfWeek;
    }

    if (filterKey === 'month') {
      return itemDate.getFullYear() === now.getFullYear() && itemDate.getMonth() === now.getMonth();
    }

    if (filterKey === 'last_month') {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return itemDate.getFullYear() === lastMonth.getFullYear() && itemDate.getMonth() === lastMonth.getMonth();
    }

    if (filterKey === 'custom' && start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      return itemDate >= startDate && itemDate <= endDate;
    }

    return true;
  }, []);

  // --- Filtered Odometer Logs ---
  const filteredOdoLogs = useMemo(() => {
    return odometerLogs.filter(log => {
      // Vehicle filter
      if (odoVehicleFilter && log.vehicleId !== odoVehicleFilter) return false;
      // Driver filter
      if (odoDriverFilter && log.driverId !== odoDriverFilter) return false;
      // Date filter
      if (!checkDateMatch(log.date, odoDateFilter, odoStartDate, odoEndDate)) return false;

      // Search keyword
      if (odoSearch.trim()) {
        const q = odoSearch.toLowerCase().trim();
        const v = vehicles.find(veh => veh.id === log.vehicleId);
        const d = users.find(usr => usr.id === log.driverId);

        const matchV = v?.name.toLowerCase().includes(q) || v?.plateNumber.toLowerCase().includes(q);
        const matchD = d?.name.toLowerCase().includes(q);
        const matchFrom = log.fromLocation?.toLowerCase().includes(q);
        const matchTo = log.toLocation?.toLowerCase().includes(q);
        const matchPurpose = log.purpose?.toLowerCase().includes(q);
        const matchRemarks = log.remarks?.toLowerCase().includes(q);

        if (!matchV && !matchD && !matchFrom && !matchTo && !matchPurpose && !matchRemarks) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [odometerLogs, odoVehicleFilter, odoDriverFilter, odoDateFilter, odoStartDate, odoEndDate, odoSearch, vehicles, users, checkDateMatch]);

  // --- Odometer Statistics ---
  const odoStats = useMemo(() => {
    const totalTrips = filteredOdoLogs.length;
    const totalKm = filteredOdoLogs.reduce((sum, log) => sum + (log.distance || 0), 0);
    const avgKm = totalTrips > 0 ? (totalKm / totalTrips).toFixed(1) : '0';
    const distinctVehicles = new Set(filteredOdoLogs.map(l => l.vehicleId)).size;

    return { totalTrips, totalKm, avgKm, distinctVehicles };
  }, [filteredOdoLogs]);

  // Grouped by vehicle for fleet status
  const odometerByVehicle = useMemo(() => {
    const map: Record<string, OdometerLog[]> = {};
    vehicles.forEach(v => {
      map[v.id] = odometerLogs
        .filter(l => l.vehicleId === v.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
    return map;
  }, [vehicles, odometerLogs]);

  // --- Filtered Fuel Logs ---
  const filteredFuelLogs = useMemo(() => {
    return fuelLogs.filter(log => {
      if (fuelLogFilters.vehicleId && log.vehicleId !== fuelLogFilters.vehicleId) return false;
      if (fuelLogFilters.driverId && log.driverId !== fuelLogFilters.driverId) return false;
      if (!checkDateMatch(log.date, fuelLogFilters.dateFilter, fuelLogFilters.startDate, fuelLogFilters.endDate)) return false;

      if (fuelSearch.trim()) {
        const q = fuelSearch.toLowerCase().trim();
        const v = vehicles.find(veh => veh.id === log.vehicleId);
        const d = users.find(usr => usr.id === log.driverId);
        const matchV = v?.name.toLowerCase().includes(q) || v?.plateNumber.toLowerCase().includes(q);
        const matchD = d?.name.toLowerCase().includes(q);
        if (!matchV && !matchD) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [fuelLogs, fuelLogFilters, fuelSearch, vehicles, users, checkDateMatch]);

  // --- Fuel Statistics ---
  const fuelStats = useMemo(() => {
    const totalCount = filteredFuelLogs.length;
    const totalCost = filteredFuelLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
    const totalLiters = filteredFuelLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
    const avgPricePerLiter = totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : '0.00';

    return { totalCount, totalCost, totalLiters, avgPricePerLiter };
  }, [filteredFuelLogs]);

  // --- Reports Tab Calculations ---
  const handlePrint = (elementId: string) => {
    const node = document.getElementById(elementId);
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

  const convertToCSV = (data: any[], headers: { key: string; label: string }[]) => {
    const headerRow = headers.map(h => h.label).join(',');
    const rows = data.map(row => {
      return headers.map(header => {
        const value = header.key.split('.').reduce((o, i) => (o ? o[i] : ''), row);
        const escaped = ('' + (value !== null && value !== undefined ? value : '')).replace(/"/g, '""');
        return `"${escaped}"`;
      }).join(',');
    });
    return [headerRow, ...rows].join('\n');
  };

  const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Detailed Trip Report for Reports tab
  const tripReportData = useMemo(() => {
    const completed = bookings.filter(b => b.status === 'Completed');
    return completed.filter(b => {
      if (tripFilters.vehicleId && b.vehicleId !== tripFilters.vehicleId) return false;
      if (tripFilters.driverId && b.driverId !== tripFilters.driverId) return false;
      return checkDateMatch(b.dateTime, tripFilters.dateFilter, tripFilters.startDate, tripFilters.endDate);
    });
  }, [bookings, tripFilters, checkDateMatch]);

  const monthlyTripReport = useMemo(() => {
    const completedTrips = bookings.filter(b => b.status === 'Completed' && b.vehicleId);
    const summary: Record<string, Record<string, { tripCount: number; totalDistance: number }>> = {};

    completedTrips.forEach(trip => {
      const tripDate = parseAsLocal(trip.dateTime);
      const monthYear = tripDate.toLocaleString('default', { month: 'long', year: 'numeric' });
      const vehicleId = trip.vehicleId!;

      if (!summary[monthYear]) {
        summary[monthYear] = {};
      }
      if (!summary[monthYear][vehicleId]) {
        summary[monthYear][vehicleId] = { tripCount: 0, totalDistance: 0 };
      }

      summary[monthYear][vehicleId].tripCount += 1;
      if (typeof trip.distance === 'number') {
        summary[monthYear][vehicleId].totalDistance += trip.distance;
      }
    });

    return Object.entries(summary).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [bookings]);

  const handleExportTripSummary = (format: 'pdf' | 'csv') => {
    const dataToExport = monthlyTripReport.flatMap(([month, vehicleData]) =>
      Object.entries(vehicleData).map(([vehicleId, data]) => {
        const vehicle = vehicles.find(v => v.id === vehicleId);
        const tripData = data as { tripCount: number; totalDistance: number };
        return {
          month,
          vehicle: `${vehicle?.name || 'Unknown'} (${vehicle?.plateNumber || 'N/A'})`,
          tripCount: tripData.tripCount,
          totalDistance: typeof tripData.totalDistance === 'number' ? `${tripData.totalDistance} km` : 'N/A',
        };
      })
    );

    if (dataToExport.length === 0) {
      alert("Tiada data untuk dieksport.");
      return;
    }

    if (format === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text("Ringkasan Bulanan Perjalanan & Jarak", 14, 16);
      doc.autoTable({
        head: [['Bulan', 'Kenderaan', 'Jumlah Trip', 'Jumlah Jarak']],
        body: dataToExport.map(d => [d.month, d.vehicle, d.tripCount, d.totalDistance]),
        startY: 25,
      });
      doc.save('monthly_trip_summary.pdf');
    } else {
      const headers = [
        { key: 'month', label: 'Bulan' },
        { key: 'vehicle', label: 'Kenderaan' },
        { key: 'tripCount', label: 'Jumlah Trip' },
        { key: 'totalDistance', label: 'Jumlah Jarak' }
      ];
      const csv = convertToCSV(dataToExport, headers);
      downloadCSV(csv, 'monthly_trip_summary.csv');
    }
  };

  const exportDetailedTripReportPdf = (data: Booking[], vehicles: Vehicle[], users: User[]) => {
    if (data.length === 0) {
      alert("Tiada data untuk dieksport.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Laporan Perjalanan Terperinci", 14, 16);

    const tableColumn = ["Tarikh", "Kenderaan", "Pemandu", "Destinasi", "Tujuan"];
    const tableRows: (string | number)[][] = [];

    data.forEach(booking => {
      const vehicle = vehicles.find(v => v.id === booking.vehicleId);
      const driver = users.find(u => u.id === booking.driverId);
      tableRows.push([
        parseAsLocal(booking.dateTime).toLocaleDateString('en-GB'),
        vehicle?.plateNumber || 'Bebas',
        driver?.name || 'N/A',
        booking.destination,
        booking.purpose,
      ]);
    });

    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
    doc.save(`laporan_perjalanan_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  // Detailed fuel report metrics
  const fuelReportData = useMemo(() => {
    const logsByVehicle = filteredFuelLogs
      .filter(log => typeof log.odometer === 'number' && !isNaN(log.odometer))
      .reduce((acc, log) => {
        if (!acc[log.vehicleId]) {
          acc[log.vehicleId] = [];
        }
        acc[log.vehicleId].push(log);
        return acc;
      }, {} as Record<string, FuelLog[]>);

    const report: FuelLogWithMetrics[] = [];

    for (const vehicleId in logsByVehicle) {
      const sortedLogs = logsByVehicle[vehicleId].sort((a, b) => a.odometer - b.odometer);
      for (let i = 0; i < sortedLogs.length; i++) {
        const currentLog = sortedLogs[i];
        let calculatedMetrics: Partial<FuelLogWithMetrics> = {};
        if (i > 0) {
          const prevLog = sortedLogs[i - 1];
          const distance = currentLog.odometer - prevLog.odometer;
          if (distance > 0) {
            calculatedMetrics.distance = distance;
            if (prevLog.liters > 0) {
              calculatedMetrics.avgKML = distance / prevLog.liters;
            }
            if (distance > 0) {
              calculatedMetrics.costPerKM = prevLog.cost / distance;
            }
          }
        }
        report.push({ ...currentLog, ...calculatedMetrics });
      }
    }
    return report.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredFuelLogs]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* PAGE TITLE & ACTION TABS */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 mb-1">
              <DocumentReportIcon className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Pengurusan Rekod & Audit</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Logs & Audit Pemandu</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Pusat kawalan CRUD bagi log odometer perjalanan pemandu, log pembelian bahan api, dan analisis perbatuan.
            </p>
          </div>

          {/* QUICK CREATE BUTTONS */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleCreateOdoLog}
              className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition transform hover:-translate-y-0.5"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              + Log Odometer
            </button>
            <button
              onClick={handleCreateFuelLog}
              className="inline-flex items-center px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition transform hover:-translate-y-0.5"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              + Log Bahan Api
            </button>
          </div>
        </div>

        {/* SUB-TABS NAVIGATION */}
        <div className="mt-6 flex border-b border-slate-200 space-x-4 sm:space-x-8">
          <button
            onClick={() => setActiveSubTab('odometer')}
            className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
              activeSubTab === 'odometer'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <GaugeIcon className="h-4 w-4 mr-2" />
            Log Odometer
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold ${
              activeSubTab === 'odometer' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {odometerLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('fuel')}
            className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
              activeSubTab === 'fuel'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FuelIcon className="h-4 w-4 mr-2" />
            Log Bahan Api
            <span className={`ml-2 px-2 py-0.5 text-xs rounded-full font-bold ${
              activeSubTab === 'fuel' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {fuelLogs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('reports')}
            className={`pb-3 text-sm font-bold flex items-center border-b-2 transition ${
              activeSubTab === 'reports'
                ? 'border-slate-800 text-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <DocumentReportIcon className="h-4 w-4 mr-2" />
            Laporan & Eksport
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: ODOMETER LOGS (FULL CRUD)                                          */}
      {/* ========================================================================= */}
      {activeSubTab === 'odometer' && (
        <div className="space-y-6">
          {/* STATS OVERVIEW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Rekod Log</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{odoStats.totalTrips}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Penyerahan odometer</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <GaugeIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Jarak Direkod</p>
                <p className="text-2xl font-black text-indigo-700 mt-1">
                  {odoStats.totalKm.toLocaleString()} <span className="text-xs font-bold text-slate-500">KM</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Perjalanan selesai</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <RouteIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Purata Jarak / Trip</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {odoStats.avgKm} <span className="text-xs font-bold text-slate-500">KM</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Efisiensi laluan</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                <RouteIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Kenderaan Terlibat</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{odoStats.distinctVehicles}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Armada aktif</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <TruckIcon className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* CONTROLS & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari lokasi, tujuan, plat kenderaan, pemandu..."
                  value={odoSearch}
                  onChange={e => setOdoSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Vehicle Filter */}
              <div>
                <select
                  value={odoVehicleFilter}
                  onChange={e => setOdoVehicleFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">Semua Kenderaan</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                  ))}
                </select>
              </div>

              {/* Driver Filter */}
              <div>
                <select
                  value={odoDriverFilter}
                  onChange={e => setOdoDriverFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  <option value="">Semua Pemandu</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={odoDateFilter}
                  onChange={e => setOdoDateFilter(e.target.value)}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 font-medium"
                >
                  {dateFilters.map(df => (
                    <option key={df.key} value={df.key}>{df.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {odoDateFilter === 'custom' && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-600">Dari:</span>
                <input
                  type="date"
                  value={odoStartDate}
                  onChange={e => setOdoStartDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
                <span className="text-xs font-semibold text-slate-600">Hingga:</span>
                <input
                  type="date"
                  value={odoEndDate}
                  onChange={e => setOdoEndDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
              </div>
            )}
          </div>

          {/* ODOMETER TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Senarai Log Odometer ({filteredOdoLogs.length} rekod dijumpai)
              </span>
              {(odoSearch || odoVehicleFilter || odoDriverFilter || odoDateFilter !== 'all') && (
                <button
                  onClick={() => {
                    setOdoSearch('');
                    setOdoVehicleFilter('');
                    setOdoDriverFilter('');
                    setOdoDateFilter('all');
                    setOdoStartDate('');
                    setOdoEndDate('');
                  }}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Reset Penapis
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Tarikh</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Kenderaan</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Pemandu</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Laluan (Dari → Ke)</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Tujuan & Catatan</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Meter Mula</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Meter Tamat</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Jarak (KM)</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredOdoLogs.length > 0 ? (
                    filteredOdoLogs.map(log => {
                      const veh = getVehicleInfo(log.vehicleId);
                      const driverName = getDriverName(log.driverId);
                      const displayDate = log.date ? new Date(log.date).toLocaleDateString('ms-MY', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '-';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            {displayDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{veh.name}</div>
                            <span className="font-mono text-[11px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                              {veh.plateNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                            <div className="flex items-center">
                              <UserCircleIcon className="h-3.5 w-3.5 mr-1 text-slate-400" />
                              {driverName}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {log.fromLocation || '-'} <span className="text-indigo-500 font-bold">→</span> {log.toLocation || '-'}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            <p className="truncate font-medium text-slate-700" title={log.purpose}>
                              {log.purpose || '-'}
                            </p>
                            {log.remarks && (
                              <p className="truncate text-[10px] text-slate-400 italic" title={log.remarks}>
                                {log.remarks}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-slate-600 font-medium">
                            {log.startOdometer !== undefined ? log.startOdometer.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">
                            {log.odometer !== undefined ? log.odometer.toLocaleString() : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {log.distance !== undefined ? (
                              <span className="font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg">
                                +{log.distance.toLocaleString()} KM
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleEditOdoLog(log)}
                                className="p-1.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition"
                                title="Kemaskini Log"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteOdoLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Padam Log"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <GaugeIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">Tiada rekod odometer dijumpai</p>
                        <p className="text-xs text-slate-400 mt-0.5">Sila ubah kata carian atau penapis, atau tambah log baru.</p>
                        <button
                          onClick={handleCreateOdoLog}
                          className="mt-3 inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                        >
                          <PlusIcon className="h-3.5 w-3.5 mr-1" />
                          Tambah Log Odometer
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* QUICK VEHICLE CARDS */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
              <TruckIcon className="h-4 w-4 mr-2 text-indigo-600" />
              Status Odometer Semasa Mengikut Kenderaan Armada
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {vehicles.map(v => {
                const logs = odometerByVehicle[v.id] || [];
                const latest = logs[0];
                const totalKm = logs.reduce((acc, curr) => acc + (curr.distance || 0), 0);

                return (
                  <div key={v.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">
                          {v.plateNumber}
                        </span>
                        <h4 className="font-bold text-slate-900 text-sm mt-1">{v.name}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{logs.length} rekod perjalanan direkod</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Meter Semasa</span>
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {latest ? `${latest.odometer.toLocaleString()} km` : `${v.initialOdometer || 0} km`}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Jumlah Jarak Log:</span>
                      <span className="font-bold text-indigo-700">{totalKm.toLocaleString()} KM</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FUEL LOGS (FULL CRUD)                                              */}
      {/* ========================================================================= */}
      {activeSubTab === 'fuel' && (
        <div className="space-y-6">
          {/* FUEL STATS OVERVIEW */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Isian Minyak</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{fuelStats.totalCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Resit & log berdaftar</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Perbelanjaan</p>
                <p className="text-2xl font-black text-amber-700 mt-1">
                  RM {fuelStats.totalCost.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Kos belian bahan api</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Jumlah Liter Bahan Api</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {fuelStats.totalLiters.toFixed(1)} <span className="text-xs font-bold text-slate-500">L</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Isipadu keseluruhan</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Purata Harga / Liter</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">
                  RM {fuelStats.avgPricePerLiter}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Kadar purata per liter</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* CONTROLS & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search */}
              <div className="relative lg:col-span-2">
                <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari kenderaan, plat nombor, pemandu..."
                  value={fuelSearch}
                  onChange={e => setFuelSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Vehicle Filter */}
              <div>
                <select
                  value={fuelLogFilters.vehicleId}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, vehicleId: e.target.value }))}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">Semua Kenderaan</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>
                  ))}
                </select>
              </div>

              {/* Driver Filter */}
              <div>
                <select
                  value={fuelLogFilters.driverId}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, driverId: e.target.value }))}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">Semua Pemandu</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div>
                <select
                  value={fuelLogFilters.dateFilter}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, dateFilter: e.target.value }))}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  {dateFilters.map(df => (
                    <option key={df.key} value={df.key}>{df.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {fuelLogFilters.dateFilter === 'custom' && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-600">Dari:</span>
                <input
                  type="date"
                  value={fuelLogFilters.startDate}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
                <span className="text-xs font-semibold text-slate-600">Hingga:</span>
                <input
                  type="date"
                  value={fuelLogFilters.endDate}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
              </div>
            )}
          </div>

          {/* FUEL LOGS TABLE */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Senarai Log Bahan Api ({filteredFuelLogs.length} rekod dijumpai)
              </span>
              {(fuelSearch || fuelLogFilters.vehicleId || fuelLogFilters.driverId || fuelLogFilters.dateFilter !== 'all') && (
                <button
                  onClick={() => {
                    setFuelSearch('');
                    setFuelLogFilters({ vehicleId: '', driverId: '', dateFilter: 'all', startDate: '', endDate: '' });
                  }}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-800"
                >
                  Reset Penapis
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Tarikh</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Kenderaan</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Pemandu</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Odometer (KM)</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Kuantiti (L)</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Harga/L (RM)</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Jumlah Kos (RM)</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600">Resit</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredFuelLogs.length > 0 ? (
                    filteredFuelLogs.map(log => {
                      const veh = getVehicleInfo(log.vehicleId);
                      const driverName = getDriverName(log.driverId);
                      const displayDate = log.date ? new Date(log.date).toLocaleDateString('ms-MY', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      }) : '-';

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/70 transition">
                          <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                            {displayDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="font-bold text-slate-900">{veh.name}</div>
                            <span className="font-mono text-[11px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                              {veh.plateNumber}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                            <div className="flex items-center">
                              <UserCircleIcon className="h-3.5 w-3.5 mr-1 text-slate-400" />
                              {driverName}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-800">
                            {log.odometer ? `${log.odometer.toLocaleString()} km` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {log.liters.toFixed(2)} L
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-slate-600">
                            RM {log.pricePerLiter ? log.pricePerLiter.toFixed(2) : '-'}
                          </td>
                          <td className="px-4 py-3 text-right font-extrabold text-amber-800">
                            RM {log.cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {log.receiptAttachmentUrl ? (
                              <a
                                href={log.receiptAttachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
                              >
                                <PaperClipIcon className="h-3.5 w-3.5 mr-1" />
                                Resit
                              </a>
                            ) : (
                              <span className="text-slate-400 text-[11px] italic">Tiada</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center space-x-1">
                              <button
                                onClick={() => handleEditFuelLog(log)}
                                className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition"
                                title="Kemaskini Log Bahan Api"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteFuelLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Padam Log Bahan Api"
                              >
                                <TrashIcon className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-400">
                        <FuelIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                        <p className="font-semibold text-slate-600">Tiada log bahan api dijumpai</p>
                        <p className="text-xs text-slate-400 mt-0.5">Sila ubah kata carian atau penapis, atau daftar resit minyak baru.</p>
                        <button
                          onClick={handleCreateFuelLog}
                          className="mt-3 inline-flex items-center px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                        >
                          <PlusIcon className="h-3.5 w-3.5 mr-1" />
                          Tambah Log Bahan Api
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REPORTS & ANALYTICS (SUMMARY & EXPORTS)                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'reports' && (
        <div className="space-y-8">
          {/* 1. Monthly Trip & Distance Summary */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <RouteIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Ringkasan Bulanan Perjalanan & Jarak Kenderaan
                </h3>
                <p className="text-xs text-slate-500">Agregat perjalanan selesai dan perbatuan mengikut bulan & kenderaan</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('monthly-trip-summary-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Cetak
                </button>
                <button
                  onClick={() => handleExportTripSummary('pdf')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <DocumentDownloadIcon className="h-3.5 w-3.5 mr-1.5 text-indigo-600" /> PDF
                </button>
                <button
                  onClick={() => handleExportTripSummary('csv')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <DocumentDownloadIcon className="h-3.5 w-3.5 mr-1.5 text-emerald-600" /> CSV
                </button>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200" id="monthly-trip-summary-printable">
              {monthlyTripReport.length > 0 ? (
                monthlyTripReport.map(([month, vehicleData]) => (
                  <div key={month} className="mb-6 last:mb-0">
                    <h5 className="text-xs font-bold text-slate-800 bg-slate-200/80 px-3 py-2 rounded-t-lg uppercase tracking-wider">
                      {month}
                    </h5>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 border border-slate-200 text-xs bg-white">
                        <thead className="bg-slate-100/70">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-bold text-slate-700 uppercase">Kenderaan</th>
                            <th className="px-4 py-2.5 text-right font-bold text-slate-700 uppercase">Jumlah Trip</th>
                            <th className="px-4 py-2.5 text-right font-bold text-slate-700 uppercase">Jumlah Jarak (KM)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {Object.entries(vehicleData).map(([vehicleId, data]) => {
                            const veh = vehicles.find(v => v.id === vehicleId);
                            const tripData = data as { tripCount: number; totalDistance: number };
                            return (
                              <tr key={vehicleId} className="hover:bg-slate-50">
                                <td className="px-4 py-2.5 whitespace-nowrap text-slate-800 font-semibold">
                                  {veh?.name} ({veh?.plateNumber})
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-right font-bold text-slate-900">
                                  {tripData.tripCount}
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-right font-extrabold text-indigo-700">
                                  {typeof tripData.totalDistance === 'number' ? tripData.totalDistance.toLocaleString() : 'N/A'} km
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-slate-400 text-xs font-semibold">
                  Tiada rekod perjalanan selesai yang mempunyai data jarak.
                </p>
              )}
            </div>
          </div>

          {/* 2. Detailed Trip Log with Filters */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <RouteIcon className="h-5 w-5 mr-2 text-indigo-600" />
                  Log Perjalanan Terperinci
                </h3>
                <p className="text-xs text-slate-500">Senarai rekod tempahan yang telah berjaya diselesaikan oleh pemandu</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('detailed-trip-log-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Cetak
                </button>
                <button
                  onClick={() => exportDetailedTripReportPdf(tripReportData, vehicles, users)}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <DocumentDownloadIcon className="h-3.5 w-3.5 mr-1.5 text-indigo-600" /> Eksport PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto" id="detailed-trip-log-printable">
              <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Tarikh</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Kenderaan</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Pemandu</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Destinasi</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Tujuan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tripReportData.length > 0 ? (
                    tripReportData.map(b => {
                      const veh = vehicles.find(v => v.id === b.vehicleId);
                      const driver = users.find(u => u.id === b.driverId);
                      return (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-700">
                            {parseAsLocal(b.dateTime).toLocaleDateString('ms-MY')}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-900">
                            {veh ? `${veh.name} (${veh.plateNumber})` : 'Bebas (Belum Tetap)'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-medium">
                            {driver?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-slate-800">
                            {b.destination}
                          </td>
                          <td className="px-4 py-2.5 text-slate-600">
                            {b.purpose}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-slate-400 font-medium">
                        Tiada log perjalanan selesai bagi tapisan ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3. Detailed Fuel Log & Economy Analysis */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center">
                  <FuelIcon className="h-5 w-5 mr-2 text-amber-600" />
                  Analisis Efisiensi & Kecekapan Bahan Api
                </h3>
                <p className="text-xs text-slate-500">Perbandingan bacaan odometer berturut-turut bagi mengira KM/Liter dan Kos/KM</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('detailed-fuel-log-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Cetak
                </button>
              </div>
            </div>

            <div className="overflow-x-auto" id="detailed-fuel-log-printable">
              <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Kenderaan</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Pemandu</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Tarikh</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Odometer</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Jarak (KM)</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Liter</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Kos (RM)</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Purata KM/L</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Kos/KM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {fuelReportData.length > 0 ? (
                    fuelReportData.map(log => {
                      const veh = vehicles.find(v => v.id === log.vehicleId);
                      const driver = users.find(u => u.id === log.driverId);
                      return (
                        <tr key={log.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-900">
                            {veh ? `${veh.name} (${veh.plateNumber})` : 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-slate-700 font-medium">
                            {driver?.name || 'N/A'}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 font-medium">
                            {new Date(log.date).toLocaleDateString('ms-MY')}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono font-bold text-slate-800">
                            {log.odometer ? `${log.odometer.toLocaleString()} km` : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                            {log.distance ? `${log.distance.toLocaleString()} km` : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                            {log.liters.toFixed(2)} L
                          </td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-amber-800">
                            RM {log.cost.toFixed(2)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-extrabold text-indigo-700">
                            {log.avgKML ? `${log.avgKML.toFixed(2)} km/L` : '-'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-slate-700">
                            {log.costPerKM ? `RM ${log.costPerKM.toFixed(2)}` : '-'}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-slate-400 font-medium">
                        Tiada data bahan api untuk dijana analisis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ODOMETER MODAL (CREATE / EDIT) */}
      <OdometerLogEditForm
        isOpen={isOdoModalOpen}
        onClose={() => {
          setIsOdoModalOpen(false);
          setEditingOdoLog(null);
        }}
        logToEdit={editingOdoLog}
      />

      {/* FUEL LOG MODAL (CREATE / EDIT) */}
      <FuelLogModal
        isOpen={isFuelModalOpen}
        onClose={() => {
          setIsFuelModalOpen(false);
          setEditingFuelLog(null);
        }}
        logToEdit={editingFuelLog}
      />
    </div>
  );
};

export default Reports;
