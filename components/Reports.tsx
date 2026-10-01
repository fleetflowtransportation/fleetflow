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
  DocumentReportIcon,
  ChevronDownIcon,
  ChevronUpIcon
} from './icons/Icons';
import OdometerLogEditForm from './OdometerLogEditForm';
import FuelLogModal from './FuelLogModal';
import FuelAnalyticsDashboard from './FuelAnalyticsDashboard';

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
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom Date Range...' },
];

const Reports: React.FC = () => {
  const { 
    bookings, 
    fuelLogs, 
    users, 
    vehicles, 
    deleteFuelLog, 
    deleteFuelLogsBulk,
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

  // --- Fuel Logs State & Bulk Selection ---
  const [editingFuelLog, setEditingFuelLog] = useState<FuelLog | null>(null);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelSearch, setFuelSearch] = useState('');
  const [fuelViewMode, setFuelViewMode] = useState<'grouped' | 'table'>('grouped');
  const [collapsedVehicles, setCollapsedVehicles] = useState<Set<string>>(new Set());
  const [selectedFuelLogIds, setSelectedFuelLogIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [fuelLogFilters, setFuelLogFilters] = useState({ 
    vehicleId: '', 
    driverId: '', 
    dateFilter: 'all',
    startDate: '',
    endDate: ''
  });

  // --- General Trip Filters for Reports Tab ---
  const [reportsView, setReportsView] = useState<'fuel_analytics' | 'trip_reports'>('fuel_analytics');
  const [tripFilters, setTripFilters] = useState({ 
    vehicleId: '', 
    driverId: '', 
    dateFilter: 'all',
    startDate: '',
    endDate: ''
  });

  const drivers = useMemo(() => users.filter(u => u.role === 'driver' || u.role === 'admin'), [users]);

  const getDriverName = useCallback((driverId: string | null | undefined) => {
    if (!driverId) return 'Unassigned Driver';
    return users.find(d => d.id === driverId)?.name || 'Driver';
  }, [users]);

  const getVehicleInfo = useCallback((vehicleId: string | null | undefined) => {
    if (!vehicleId) return { name: 'Any Vehicle', plateNumber: '-' };
    return vehicles.find(v => v.id === vehicleId) || { name: 'Unknown Vehicle', plateNumber: '-' };
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
    if (window.confirm('Are you sure you want to delete this odometer log entry? This action cannot be undone.')) {
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
    if (window.confirm('Are you sure you want to delete this fuel purchase record? The attached receipt file in Google Drive will also be removed. This action cannot be undone.')) {
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

  // --- Vehicle Fuel Summaries (For Top Horizontal Switcher Chips) ---
  const vehicleFuelSummaries = useMemo(() => {
    return vehicles.map(v => {
      const vLogs = fuelLogs.filter(l => l.vehicleId === v.id);
      const totalCost = vLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const totalLiters = vLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
      return {
        vehicle: v,
        count: vLogs.length,
        totalCost,
        totalLiters,
        avgPrice: totalLiters > 0 ? (totalCost / totalLiters).toFixed(2) : '0.00',
        latestOdo: vLogs.reduce((max, l) => (l.odometer && l.odometer > max ? l.odometer : max), v.odometer || 0),
      };
    }).sort((a, b) => b.count - a.count);
  }, [vehicles, fuelLogs]);

  // --- Fuel Logs Grouped by Vehicle ---
  const fuelLogsGroupedByVehicle = useMemo(() => {
    const map = new Map<string, FuelLog[]>();
    for (const log of filteredFuelLogs) {
      const vId = log.vehicleId || 'unknown';
      if (!map.has(vId)) map.set(vId, []);
      map.get(vId)!.push(log);
    }

    const groups: {
      vehicle: Vehicle;
      logs: FuelLog[];
      totalCost: number;
      totalLiters: number;
      avgPrice: number;
      latestOdometer: number;
    }[] = [];

    // Prioritize vehicles in the system
    for (const v of vehicles) {
      const vLogs = map.get(v.id);
      if (vLogs && vLogs.length > 0) {
        const totalCost = vLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
        const totalLiters = vLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
        const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;
        const latestOdo = vLogs.reduce((max, l) => (l.odometer && l.odometer > max ? l.odometer : max), v.odometer || 0);

        groups.push({
          vehicle: v,
          logs: vLogs,
          totalCost,
          totalLiters,
          avgPrice,
          latestOdometer: latestOdo,
        });
      }
    }

    // Check unknown/deleted vehicle
    const unknownLogs = map.get('unknown');
    if (unknownLogs && unknownLogs.length > 0) {
      const totalCost = unknownLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const totalLiters = unknownLogs.reduce((sum, l) => sum + (l.liters || 0), 0);
      groups.push({
        vehicle: {
          id: 'unknown',
          name: 'Unassigned / Other',
          plateNumber: 'N/A',
          brandMake: 'Other',
          vehicleStatus: 'Active',
          fuelType: 'Petrol'
        },
        logs: unknownLogs,
        totalCost,
        totalLiters,
        avgPrice: totalLiters > 0 ? totalCost / totalLiters : 0,
        latestOdometer: 0,
      });
    }

    return groups;
  }, [filteredFuelLogs, vehicles]);

  // Selected totals for bulk drawer
  const selectedFuelMetrics = useMemo(() => {
    const selected = filteredFuelLogs.filter(l => selectedFuelLogIds.has(l.id));
    const cost = selected.reduce((sum, l) => sum + (l.cost || 0), 0);
    const liters = selected.reduce((sum, l) => sum + (l.liters || 0), 0);
    return { count: selected.length, cost, liters };
  }, [filteredFuelLogs, selectedFuelLogIds]);

  // Toggle selection for a single fuel log
  const toggleSelectFuelLog = (id: string) => {
    setSelectedFuelLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Toggle selection for all visible fuel logs
  const toggleSelectAllVisibleFuelLogs = () => {
    if (selectedFuelLogIds.size === filteredFuelLogs.length && filteredFuelLogs.length > 0) {
      setSelectedFuelLogIds(new Set());
    } else {
      setSelectedFuelLogIds(new Set(filteredFuelLogs.map(l => l.id)));
    }
  };

  // Toggle selection for a specific vehicle's logs
  const toggleSelectVehicleLogs = (vLogs: FuelLog[]) => {
    const vIds = vLogs.map(l => l.id);
    const allSelected = vIds.every(id => selectedFuelLogIds.has(id));
    setSelectedFuelLogIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        vIds.forEach(id => next.delete(id));
      } else {
        vIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Toggle collapse state for a vehicle group
  const toggleCollapseVehicle = (vehicleId: string) => {
    setCollapsedVehicles(prev => {
      const next = new Set(prev);
      if (next.has(vehicleId)) next.delete(vehicleId);
      else next.add(vehicleId);
      return next;
    });
  };

  // Bulk Delete
  const handleBulkDeleteFuelLogs = async () => {
    if (selectedFuelLogIds.size === 0) return;
    const count = selectedFuelLogIds.size;
    const confirmMsg = `Are you sure you want to delete ${count} selected fuel purchase records? This action cannot be undone and any attached receipt files in Google Drive will also be removed.`;
    if (!window.confirm(confirmMsg)) return;

    setIsBulkDeleting(true);
    try {
      await deleteFuelLogsBulk(Array.from(selectedFuelLogIds));
      setSelectedFuelLogIds(new Set());
    } catch (err: any) {
      alert('Failed to delete selected fuel records: ' + err.message);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Export Selected Fuel Logs as CSV
  const handleExportSelectedFuelLogs = () => {
    if (selectedFuelLogIds.size === 0) return;
    const selectedLogs = filteredFuelLogs.filter(l => selectedFuelLogIds.has(l.id));
    const csvContent = [
      'ID,Date,Vehicle,Plate,Driver,Odometer,Volume (L),Price/L (RM),Total Cost (RM),Receipt URL',
      ...selectedLogs.map(l => {
        const v = getVehicleInfo(l.vehicleId);
        const d = getDriverName(l.driverId);
        const dt = l.date ? new Date(l.date).toLocaleDateString('en-GB') : '';
        return `"${l.id}","${dt}","${v.name}","${v.plateNumber}","${d}","${l.odometer || ''}","${l.liters}","${l.pricePerLiter || ''}","${l.cost}","${l.receiptAttachmentUrl || ''}"`;
      })
    ].join('\n');
    downloadCSV(csvContent, `Fuel_Logs_Selected_${new Date().toISOString().slice(0, 10)}.csv`);
  };

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
      alert("No data available to export.");
      return;
    }

    if (format === 'pdf') {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      doc.text("Monthly Trip & Distance Summary", 14, 16);
      doc.autoTable({
        head: [['Month', 'Vehicle', 'Total Trips', 'Total Distance']],
        body: dataToExport.map(d => [d.month, d.vehicle, d.tripCount, d.totalDistance]),
        startY: 25,
      });
      doc.save('monthly_trip_summary.pdf');
    } else {
      const headers = [
        { key: 'month', label: 'Month' },
        { key: 'vehicle', label: 'Vehicle' },
        { key: 'tripCount', label: 'Total Trips' },
        { key: 'totalDistance', label: 'Total Distance' }
      ];
      const csv = convertToCSV(dataToExport, headers);
      downloadCSV(csv, 'monthly_trip_summary.csv');
    }
  };

  const exportDetailedTripReportPdf = (data: Booking[], vehicles: Vehicle[], users: User[]) => {
    if (data.length === 0) {
      alert("No data available to export.");
      return;
    }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Detailed Trip Report", 14, 16);

    const tableColumn = ["Date", "Vehicle", "Driver", "Destination", "Purpose"];
    const tableRows: (string | number)[][] = [];

    data.forEach(booking => {
      const vehicle = vehicles.find(v => v.id === booking.vehicleId);
      const driver = users.find(u => u.id === booking.driverId);
      tableRows.push([
        parseAsLocal(booking.dateTime).toLocaleDateString('en-GB'),
        vehicle?.plateNumber || 'Any',
        driver?.name || 'N/A',
        booking.destination,
        booking.purpose,
      ]);
    });

    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
    doc.save(`trip_report_${new Date().toISOString().split('T')[0]}.pdf`);
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
    <div className="w-full space-y-6 pb-12">
      {/* PAGE TITLE & ACTION TABS */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-indigo-600 mb-1">
              <DocumentReportIcon className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Audit & Operations Records</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Driver Logs & Auditing</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Unified management portal for trip odometer logs, fuel purchase receipts, and fleet mileage analytics.
            </p>
          </div>

          {/* QUICK CREATE BUTTONS */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleCreateOdoLog}
              className="inline-flex items-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition transform hover:-translate-y-0.5"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              + Record Odometer Log
            </button>
            <button
              onClick={handleCreateFuelLog}
              className="inline-flex items-center px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              + Record Fuel Log
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
            Odometer Logs
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
            Fuel Purchase Logs
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
            Reports & Export
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
                <p className="text-xs font-semibold text-slate-500">Total Log Entries</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{odoStats.totalTrips}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Odometer submissions</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <GaugeIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Distance Logged</p>
                <p className="text-2xl font-black text-indigo-700 mt-1">
                  {odoStats.totalKm.toLocaleString()} <span className="text-xs font-bold text-slate-500">KM</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Completed journeys</p>
              </div>
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                <RouteIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Average Distance / Trip</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {odoStats.avgKm} <span className="text-xs font-bold text-slate-500">KM</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Route efficiency</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                <RouteIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Vehicles Utilized</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">{odoStats.distinctVehicles}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Active fleet</p>
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
                  placeholder="Search location, purpose, vehicle plate, driver..."
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
                  <option value="">All Vehicles</option>
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
                  <option value="">All Drivers</option>
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
                <span className="text-xs font-semibold text-slate-600">From:</span>
                <input
                  type="date"
                  value={odoStartDate}
                  onChange={e => setOdoStartDate(e.target.value)}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
                <span className="text-xs font-semibold text-slate-600">To:</span>
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
                Odometer Logs List ({filteredOdoLogs.length} records found)
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
                  Reset Filters
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Vehicle</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Driver</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Route (From → To)</th>
                    <th className="px-4 py-3 text-left font-bold text-slate-600">Purpose & Remarks</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Start (KM)</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">End (KM)</th>
                    <th className="px-4 py-3 text-right font-bold text-slate-600">Distance</th>
                    <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredOdoLogs.length > 0 ? (
                    filteredOdoLogs.map(log => {
                      const veh = getVehicleInfo(log.vehicleId);
                      const driverName = getDriverName(log.driverId);
                      const displayDate = log.date ? new Date(log.date).toLocaleDateString('en-GB', {
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
                                title="Edit Log"
                              >
                                <EditIcon className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteOdoLog(log.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete Log"
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
                        <p className="font-semibold text-slate-600">No odometer records found</p>
                        <p className="text-xs text-slate-400 mt-0.5">Try changing your filters or add a new odometer log entry.</p>
                        <button
                          onClick={handleCreateOdoLog}
                          className="mt-3 inline-flex items-center px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold"
                        >
                          <PlusIcon className="h-3.5 w-3.5 mr-1" />
                          Record Odometer Log
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
              Current Fleet Odometer Status
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
                        <p className="text-[11px] text-slate-500 font-medium">{logs.length} logged trip records</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Odo</span>
                        <span className="font-mono font-extrabold text-slate-900 text-sm">
                          {latest ? `${latest.odometer.toLocaleString()} km` : `${v.initialOdometer || 0} km`}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 pt-2.5 border-t border-slate-200/70 flex justify-between items-center text-xs">
                      <span className="text-slate-500 font-medium">Logged Mileage:</span>
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
      {/* TAB 2: FUEL LOGS (SEGMENTED BY VEHICLE & BULK ACTIONS)                   */}
      {/* ========================================================================= */}
      {activeSubTab === 'fuel' && (
        <div className="space-y-6">
          {/* VEHICLE QUICK SELECTOR PILLS */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Select Vehicle (Quick Filter)
                </h3>
                <p className="text-[11px] text-slate-400">
                  Click any vehicle to view and filter fuel purchase logs for that vehicle
                </p>
              </div>
              {fuelLogFilters.vehicleId && (
                <button
                  onClick={() => setFuelLogFilters(prev => ({ ...prev, vehicleId: '' }))}
                  className="text-xs font-semibold text-amber-600 hover:text-amber-800 transition cursor-pointer"
                >
                  Show All Vehicles
                </button>
              )}
            </div>

            {/* Scrollable Horizontal Vehicle Cards */}
            <div className="flex items-center space-x-2.5 overflow-x-auto pb-1.5 scrollbar-thin">
              {/* All Vehicles Pill */}
              <button
                onClick={() => setFuelLogFilters(prev => ({ ...prev, vehicleId: '' }))}
                className={`shrink-0 flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl border text-left transition cursor-pointer ${
                  !fuelLogFilters.vehicleId
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className={`p-1.5 rounded-lg ${!fuelLogFilters.vehicleId ? 'bg-amber-600 text-white' : 'bg-white text-slate-600'}`}>
                  <TruckIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-black">All Vehicles</div>
                  <div className={`text-[10px] font-medium ${!fuelLogFilters.vehicleId ? 'text-amber-100' : 'text-slate-400'}`}>
                    {fuelLogs.length} fuel logs
                  </div>
                </div>
              </button>

              {/* Individual Vehicle Pills */}
              {vehicleFuelSummaries.map(({ vehicle, count, totalCost, totalLiters }) => {
                const isSelected = fuelLogFilters.vehicleId === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    onClick={() => setFuelLogFilters(prev => ({
                      ...prev,
                      vehicleId: isSelected ? '' : vehicle.id
                    }))}
                    className={`shrink-0 flex items-center space-x-2.5 px-3.5 py-2 rounded-xl border text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-400/40 text-amber-950 shadow-xs'
                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex flex-col">
                      <div className="flex items-center space-x-1.5">
                        <span className={`font-mono text-[11px] font-extrabold px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {vehicle.plateNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
                          {vehicle.name || vehicle.brandMake}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px] mt-1 text-slate-500 font-medium">
                        <span className="font-semibold text-slate-700">{count} logs</span>
                        <span>•</span>
                        <span className="font-bold text-amber-700">RM {totalCost.toFixed(0)}</span>
                        <span>•</span>
                        <span>{totalLiters.toFixed(0)} L</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* FUEL STATS OVERVIEW CARDS */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Refueling Entries</p>
                <p className="text-2xl font-black text-slate-800 mt-1">{fuelStats.totalCount}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {fuelLogFilters.vehicleId ? 'Selected vehicle' : 'All fleet vehicles'}
                </p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Expenditure</p>
                <p className="text-2xl font-black text-amber-700 mt-1">
                  RM {fuelStats.totalCost.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Fleet fuel expenditure</p>
              </div>
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Total Fuel Volume</p>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  {fuelStats.totalLiters.toFixed(1)} <span className="text-xs font-bold text-slate-500">L</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Total volume dispensed</p>
              </div>
              <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Avg Price / Liter</p>
                <p className="text-2xl font-black text-emerald-700 mt-1">
                  RM {fuelStats.avgPricePerLiter}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Effective average rate</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <FuelIcon className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* CONTROLS & FILTERS BAR */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-center">
              {/* Search */}
              <div className="relative lg:col-span-4">
                <SearchIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search vehicle, plate number, driver..."
                  value={fuelSearch}
                  onChange={e => setFuelSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              {/* Driver Filter */}
              <div className="lg:col-span-3">
                <select
                  value={fuelLogFilters.driverId}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, driverId: e.target.value }))}
                  className="w-full p-2 text-xs border border-slate-300 rounded-xl bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 font-medium"
                >
                  <option value="">All Drivers</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Date Filter */}
              <div className="lg:col-span-2">
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

              {/* View Mode Toggle */}
              <div className="lg:col-span-3 flex items-center justify-end space-x-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setFuelViewMode('grouped')}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition text-center cursor-pointer ${
                    fuelViewMode === 'grouped'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Group fuel records by vehicle"
                >
                  Group by Vehicle
                </button>
                <button
                  onClick={() => setFuelViewMode('table')}
                  className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition text-center cursor-pointer ${
                    fuelViewMode === 'table'
                      ? 'bg-white text-slate-800 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                  title="Display all records in a single table"
                >
                  Unified Table
                </button>
              </div>
            </div>

            {/* Custom Date Range Picker */}
            {fuelLogFilters.dateFilter === 'custom' && (
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100">
                <span className="text-xs font-semibold text-slate-600">From:</span>
                <input
                  type="date"
                  value={fuelLogFilters.startDate}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, startDate: e.target.value }))}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
                <span className="text-xs font-semibold text-slate-600">To:</span>
                <input
                  type="date"
                  value={fuelLogFilters.endDate}
                  onChange={e => setFuelLogFilters(prev => ({ ...prev, endDate: e.target.value }))}
                  className="text-xs border border-slate-300 rounded-lg p-1.5"
                />
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* VIEW MODE 1: GROUPED BY VEHICLE                                           */}
          {/* ========================================================================= */}
          {fuelViewMode === 'grouped' ? (
            <div className="space-y-6">
              {fuelLogsGroupedByVehicle.length > 0 ? (
                fuelLogsGroupedByVehicle.map(group => {
                  const isCollapsed = collapsedVehicles.has(group.vehicle.id);
                  const groupLogIds = group.logs.map(l => l.id);
                  const isGroupAllSelected = groupLogIds.length > 0 && groupLogIds.every(id => selectedFuelLogIds.has(id));
                  const isGroupPartiallySelected = groupLogIds.some(id => selectedFuelLogIds.has(id)) && !isGroupAllSelected;

                  return (
                    <div
                      key={group.vehicle.id}
                      className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden transition"
                    >
                      {/* Section Header */}
                      <div className="p-4 bg-linear-to-r from-slate-50 via-white to-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center space-x-3">
                          {/* Bulk Checkbox for Vehicle */}
                          <input
                            type="checkbox"
                            checked={isGroupAllSelected}
                            ref={el => {
                              if (el) el.indeterminate = isGroupPartiallySelected;
                            }}
                            onChange={() => toggleSelectVehicleLogs(group.logs)}
                            className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                            title="Select all logs for this vehicle"
                          />

                          {/* Plate Badge */}
                          <span className="font-mono text-xs font-black text-amber-900 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
                            {group.vehicle.plateNumber}
                          </span>

                          <div>
                            <h4 className="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                              <span>{group.vehicle.name}</span>
                              {group.vehicle.fuelType && (
                                <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                                  {group.vehicle.fuelType}
                                </span>
                              )}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium">
                              {group.logs.length} refueling logs
                            </p>
                          </div>
                        </div>

                        {/* Right Vehicle Summary Badges */}
                        <div className="flex items-center space-x-3">
                          <div className="hidden sm:flex items-center space-x-3 text-xs">
                            <div className="px-2.5 py-1 bg-amber-50 rounded-lg border border-amber-200/60 text-amber-900">
                              <span className="text-[10px] text-amber-600 uppercase font-bold block">Total Cost</span>
                              <span className="font-extrabold">RM {group.totalCost.toFixed(2)}</span>
                            </div>

                            <div className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-800">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Volume</span>
                              <span className="font-bold">{group.totalLiters.toFixed(1)} L</span>
                            </div>

                            <div className="px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200 text-slate-800">
                              <span className="text-[10px] text-slate-400 uppercase font-bold block">Latest Odometer</span>
                              <span className="font-mono font-bold">
                                {group.latestOdometer ? `${group.latestOdometer.toLocaleString()} km` : '-'}
                              </span>
                            </div>
                          </div>

                          {/* Collapse / Expand Button */}
                          <button
                            onClick={() => toggleCollapseVehicle(group.vehicle.id)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title={isCollapsed ? 'Expand list' : 'Collapse list'}
                          >
                            {isCollapsed ? (
                              <ChevronDownIcon className="h-5 w-5" />
                            ) : (
                              <ChevronUpIcon className="h-5 w-5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Section Table (if not collapsed) */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="min-w-full divide-y divide-slate-200 text-xs">
                            <thead className="bg-slate-50/70 text-[11px] font-bold text-slate-600">
                              <tr>
                                <th className="px-3.5 py-2.5 w-10 text-center">
                                  <span className="sr-only">Select</span>
                                </th>
                                <th className="px-4 py-2.5 text-left">Date</th>
                                <th className="px-4 py-2.5 text-left">Driver</th>
                                <th className="px-4 py-2.5 text-right">Odometer</th>
                                <th className="px-4 py-2.5 text-right">Volume (L)</th>
                                <th className="px-4 py-2.5 text-right">Price / L (RM)</th>
                                <th className="px-4 py-2.5 text-right">Total Cost (RM)</th>
                                <th className="px-4 py-2.5 text-center">Receipt</th>
                                <th className="px-4 py-2.5 text-center w-24">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 bg-white">
                              {group.logs.map(log => {
                                const driverName = getDriverName(log.driverId);
                                const isSelected = selectedFuelLogIds.has(log.id);
                                const displayDate = log.date ? new Date(log.date).toLocaleDateString('en-GB', {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric'
                                }) : '-';

                                return (
                                  <tr
                                    key={log.id}
                                    className={`transition ${
                                      isSelected
                                        ? 'bg-amber-50/60 font-semibold'
                                        : 'hover:bg-slate-50/80'
                                    }`}
                                  >
                                    <td className="px-3.5 py-3 text-center">
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => toggleSelectFuelLog(log.id)}
                                        className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                                      />
                                    </td>
                                    <td className="px-4 py-3 font-semibold text-slate-800 whitespace-nowrap">
                                      {displayDate}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                                      <div className="flex items-center">
                                        <UserCircleIcon className="h-3.5 w-3.5 mr-1.5 text-slate-400" />
                                        {driverName}
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                                      {log.odometer ? `${log.odometer.toLocaleString()} km` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                                      {log.liters.toFixed(2)} L
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                                      RM {log.pricePerLiter ? log.pricePerLiter.toFixed(2) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-black text-amber-800 whitespace-nowrap">
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
                                          Receipt
                                        </a>
                                      ) : (
                                        <span className="text-slate-400 text-[11px] italic">None</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center whitespace-nowrap">
                                      <div className="flex items-center justify-center space-x-1">
                                        <button
                                          onClick={() => handleEditFuelLog(log)}
                                          className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                          title="Edit Fuel Record"
                                        >
                                          <EditIcon className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={() => handleDeleteFuelLog(log.id)}
                                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                          title="Delete Fuel Record"
                                        >
                                          <TrashIcon className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                            {/* Subtotal Footer */}
                            <tfoot className="bg-slate-50 border-t border-slate-200 text-xs font-bold text-slate-700">
                              <tr>
                                <td colSpan={4} className="px-4 py-2.5 text-right uppercase tracking-wider text-[10px] text-slate-500">
                                  Subtotal {group.vehicle.plateNumber}:
                                </td>
                                <td className="px-4 py-2.5 text-right font-extrabold text-slate-900">
                                  {group.totalLiters.toFixed(2)} L
                                </td>
                                <td className="px-4 py-2.5 text-right text-slate-500">
                                  RM {group.avgPrice.toFixed(2)}
                                </td>
                                <td className="px-4 py-2.5 text-right font-black text-amber-800">
                                  RM {group.totalCost.toFixed(2)}
                                </td>
                                <td colSpan={2}></td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <FuelIcon className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="font-bold text-slate-700 text-sm">No fuel records found</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing your search filters or record a new fuel purchase.</p>
                  <button
                    onClick={handleCreateFuelLog}
                    className="mt-4 inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    <PlusIcon className="h-4 w-4 mr-1.5" />
                    + Record Fuel Purchase
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* VIEW MODE 2: UNIFIED MASTER TABLE                                         */
            /* ========================================================================= */
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    All Fuel Purchase Records ({filteredFuelLogs.length} records found)
                  </span>
                </div>
                {(fuelSearch || fuelLogFilters.vehicleId || fuelLogFilters.driverId || fuelLogFilters.dateFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setFuelSearch('');
                      setFuelLogFilters({ vehicleId: '', driverId: '', dateFilter: 'all', startDate: '', endDate: '' });
                    }}
                    className="text-xs font-semibold text-amber-600 hover:text-amber-800 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-3.5 py-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedFuelLogIds.size === filteredFuelLogs.length && filteredFuelLogs.length > 0}
                          ref={el => {
                            if (el) el.indeterminate = selectedFuelLogIds.size > 0 && selectedFuelLogIds.size < filteredFuelLogs.length;
                          }}
                          onChange={toggleSelectAllVisibleFuelLogs}
                          className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                          title="Select all rows"
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600">Date</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600">Vehicle</th>
                      <th className="px-4 py-3 text-left font-bold text-slate-600">Driver</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600">Odometer</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600">Volume (L)</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600">Price/L (RM)</th>
                      <th className="px-4 py-3 text-right font-bold text-slate-600">Total Cost (RM)</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-600">Receipt</th>
                      <th className="px-4 py-3 text-center font-bold text-slate-600 w-24">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredFuelLogs.length > 0 ? (
                      filteredFuelLogs.map(log => {
                        const veh = getVehicleInfo(log.vehicleId);
                        const driverName = getDriverName(log.driverId);
                        const isSelected = selectedFuelLogIds.has(log.id);
                        const displayDate = log.date ? new Date(log.date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '-';

                        return (
                          <tr
                            key={log.id}
                            className={`transition ${
                              isSelected
                                ? 'bg-amber-50/60 font-semibold'
                                : 'hover:bg-slate-50/80'
                            }`}
                          >
                            <td className="px-3.5 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectFuelLog(log.id)}
                                className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300 cursor-pointer"
                              />
                            </td>
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
                            <td className="px-4 py-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                              {log.odometer ? `${log.odometer.toLocaleString()} km` : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                              {log.liters.toFixed(2)} L
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-slate-600 whitespace-nowrap">
                              RM {log.pricePerLiter ? log.pricePerLiter.toFixed(2) : '-'}
                            </td>
                            <td className="px-4 py-3 text-right font-extrabold text-amber-800 whitespace-nowrap">
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
                                  Receipt
                                </a>
                              ) : (
                                <span className="text-slate-400 text-[11px] italic">None</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center space-x-1">
                                <button
                                  onClick={() => handleEditFuelLog(log)}
                                  className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-lg transition cursor-pointer"
                                  title="Edit Fuel Record"
                                >
                                  <EditIcon className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteFuelLog(log.id)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                  title="Delete Fuel Record"
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
                        <td colSpan={10} className="px-4 py-12 text-center text-slate-400">
                          <FuelIcon className="h-8 w-8 mx-auto text-slate-300 mb-2" />
                          <p className="font-semibold text-slate-600">No fuel records found</p>
                          <p className="text-xs text-slate-400 mt-0.5">Try changing your filters or record a new fuel purchase.</p>
                          <button
                            onClick={handleCreateFuelLog}
                            className="mt-3 inline-flex items-center px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                          >
                            <PlusIcon className="h-3.5 w-3.5 mr-1" />
                            Record Fuel Purchase
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FLOATING BULK ACTIONS DRAWER                                              */}
          {/* ========================================================================= */}
          {selectedFuelLogIds.size > 0 && (
            <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center px-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
              <div className="bg-slate-900/95 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-700/80 flex items-center space-x-6 backdrop-blur-md max-w-xl w-full justify-between">
                <div className="flex items-center space-x-3">
                  <span className="flex h-3 w-3 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-100">
                      {selectedFuelLogIds.size} {selectedFuelLogIds.size === 1 ? 'record' : 'records'} selected
                    </p>
                    <p className="text-[11px] text-slate-300">
                      Total: <strong className="text-amber-400">RM {selectedFuelMetrics.cost.toFixed(2)}</strong> ({selectedFuelMetrics.liters.toFixed(1)} L)
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleExportSelectedFuelLogs}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition flex items-center cursor-pointer"
                    title="Export selected records to CSV"
                  >
                    <DocumentDownloadIcon className="h-3.5 w-3.5 mr-1" />
                    CSV
                  </button>

                  <button
                    onClick={handleBulkDeleteFuelLogs}
                    disabled={isBulkDeleting}
                    className="px-3.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold shadow-sm transition flex items-center cursor-pointer disabled:opacity-50"
                    title="Delete selected records (Drive receipts will also be removed)"
                  >
                    <TrashIcon className="h-3.5 w-3.5 mr-1" />
                    {isBulkDeleting ? 'Deleting...' : `Delete (${selectedFuelLogIds.size})`}
                  </button>

                  <button
                    onClick={() => setSelectedFuelLogIds(new Set())}
                    className="px-2 py-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition text-xs font-semibold cursor-pointer"
                  >
                    Deselect
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: REPORTS & ANALYTICS (SUMMARY & EXPORTS)                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'reports' && (
        <div className="space-y-6">
          {/* Sub-view switcher inside Reports & Export */}
          <div className="flex items-center justify-between flex-wrap gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setReportsView('fuel_analytics')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  reportsView === 'fuel_analytics'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FuelIcon className="h-4 w-4" />
                <span>Fuel Analytics Dashboard</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  reportsView === 'fuel_analytics' ? 'bg-amber-700/80 text-white' : 'bg-amber-100 text-amber-800'
                }`}>
                  Live
                </span>
              </button>
              <button
                type="button"
                onClick={() => setReportsView('trip_reports')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 cursor-pointer ${
                  reportsView === 'trip_reports'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <RouteIcon className="h-4 w-4" />
                <span>Fleet Trip Reports & Export</span>
              </button>
            </div>

            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              {reportsView === 'fuel_analytics' 
                ? 'Chronological fuel telematics, anomalies, and consumption modeling' 
                : 'Historical completed trip logs and monthly mileage exports'}
            </span>
          </div>

          {reportsView === 'fuel_analytics' ? (
            <FuelAnalyticsDashboard
              onOpenFuelModal={(log) => {
                setEditingFuelLog(log || null);
                setIsFuelModalOpen(true);
              }}
            />
          ) : (
            <div className="space-y-8">
              {/* 1. Monthly Trip & Distance Summary */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center">
                      <RouteIcon className="h-5 w-5 mr-2 text-indigo-600" />
                      Monthly Vehicle Trips & Distance Summary
                    </h3>
                <p className="text-xs text-slate-500">Aggregated completed trip counts and mileage breakdown by month & vehicle</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('monthly-trip-summary-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Print
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
                            <th className="px-4 py-2.5 text-left font-bold text-slate-700 uppercase">Vehicle</th>
                            <th className="px-4 py-2.5 text-right font-bold text-slate-700 uppercase">Total Trips</th>
                            <th className="px-4 py-2.5 text-right font-bold text-slate-700 uppercase">Total Distance (KM)</th>
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
                  No completed trip records with mileage data found.
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
                  Detailed Trip Logs
                </h3>
                <p className="text-xs text-slate-500">Complete listing of historical vehicle bookings fulfilled by drivers</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('detailed-trip-log-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Print
                </button>
                <button
                  onClick={() => exportDetailedTripReportPdf(tripReportData, vehicles, users)}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <DocumentDownloadIcon className="h-3.5 w-3.5 mr-1.5 text-indigo-600" /> Export PDF
                </button>
              </div>
            </div>

            <div className="overflow-x-auto" id="detailed-trip-log-printable">
              <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Date</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Vehicle</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Driver</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Destination</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Purpose</th>
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
                            {parseAsLocal(b.dateTime).toLocaleDateString('en-GB')}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-bold text-slate-900">
                            {veh ? `${veh.name} (${veh.plateNumber})` : 'Any / Self-Drive'}
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
                        No completed trips match the selected filter criteria.
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
                  Fuel Efficiency & Mileage Economy Analysis
                </h3>
                <p className="text-xs text-slate-500">Continuous odometer comparison to calculate KM/Liter economy and Cost/KM metrics</p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePrint('detailed-fuel-log-printable')}
                  className="flex items-center text-xs bg-white hover:bg-slate-50 text-slate-700 font-bold py-1.5 px-3 border border-slate-300 rounded-xl shadow-xs"
                >
                  <PrinterIcon className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Print
                </button>
              </div>
            </div>

            <div className="overflow-x-auto" id="detailed-fuel-log-printable">
              <table className="min-w-full divide-y divide-slate-200 text-xs border border-slate-200 rounded-xl overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Vehicle</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Driver</th>
                    <th className="px-4 py-2.5 text-left font-bold text-slate-700">Date</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Odometer</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Distance</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Volume</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Cost</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Avg KM/L</th>
                    <th className="px-4 py-2.5 text-right font-bold text-slate-700">Cost/KM</th>
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
                            {new Date(log.date).toLocaleDateString('en-GB')}
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
                        No fuel data available to generate efficiency analysis.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
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
