import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { IssueLog, MaintenanceInterval, MaintenanceLog, MaintenanceCategory } from '../types';
import {
  TruckIcon,
  UserCircleIcon,
  XIcon,
  TrashIcon,
  PlusIcon,
  CheckCircleIcon,
  WrenchScrewdriverIcon,
  ExclamationIcon,
  ClockIcon,
  CalendarIcon,
  GaugeIcon,
  ClipboardListIcon,
  DocumentReportIcon,
  SearchIcon,
  EditIcon
} from './icons/Icons';

const priorityStyles = {
  High: { bg: 'bg-rose-100', text: 'text-rose-800', ring: 'ring-rose-500/20' },
  Medium: { bg: 'bg-amber-100', text: 'text-amber-800', ring: 'ring-amber-500/20' },
  Low: { bg: 'bg-slate-100', text: 'text-slate-700', ring: 'ring-slate-500/20' },
};

const statusStyles = {
  Open: { bg: 'bg-blue-100', text: 'text-blue-800', ring: 'ring-blue-500/20' },
  'In Progress': { bg: 'bg-purple-100', text: 'text-purple-800', ring: 'ring-purple-500/20' },
  Resolved: { bg: 'bg-emerald-100', text: 'text-emerald-800', ring: 'ring-emerald-500/20' },
};

const categoryBadgeStyles: Record<MaintenanceCategory, { bg: string; text: string }> = {
  Engine: { bg: 'bg-amber-100', text: 'text-amber-900' },
  Transmission: { bg: 'bg-purple-100', text: 'text-purple-900' },
  Brakes: { bg: 'bg-rose-100', text: 'text-rose-900' },
  Tires: { bg: 'bg-blue-100', text: 'text-blue-900' },
  Electrical: { bg: 'bg-yellow-100', text: 'text-yellow-900' },
  Inspection: { bg: 'bg-emerald-100', text: 'text-emerald-900' },
  General: { bg: 'bg-slate-100', text: 'text-slate-900' },
  Other: { bg: 'bg-indigo-100', text: 'text-indigo-900' },
};

const COMMON_SERVICE_TEMPLATES: { name: string; category: MaintenanceCategory; defaultKm: number; defaultMonths: number; defaultCost: number; defaultNotes: string }[] = [
  { name: 'Engine Oil & Oil Filter', category: 'Engine', defaultKm: 10000, defaultMonths: 6, defaultCost: 190, defaultNotes: 'Fully Synthetic with OEM filter and crush washer' },
  { name: 'Automatic / CVT Gearbox Fluid', category: 'Transmission', defaultKm: 40000, defaultMonths: 24, defaultCost: 320, defaultNotes: 'Manufacturer specific transmission oil' },
  { name: 'Front & Rear Brake Pads', category: 'Brakes', defaultKm: 25000, defaultMonths: 18, defaultCost: 220, defaultNotes: 'Inspect brake rotor thickness & clean calipers' },
  { name: 'Brake Fluid Bleed & Flush (DOT 4)', category: 'Brakes', defaultKm: 40000, defaultMonths: 24, defaultCost: 110, defaultNotes: 'Complete fluid exchange to prevent moisture build-up' },
  { name: 'Tire Rotation, Alignment & Balancing', category: 'Tires', defaultKm: 10000, defaultMonths: 6, defaultCost: 80, defaultNotes: 'Cross rotation with digital camber/toe alignment' },
  { name: 'Engine Air Filter & Cabin AC Filter', category: 'Engine', defaultKm: 20000, defaultMonths: 12, defaultCost: 95, defaultNotes: 'Replace high flow cabin pollen filter & air filter' },
  { name: 'Spark Plugs (Iridium / Platinum)', category: 'Engine', defaultKm: 50000, defaultMonths: 36, defaultCost: 160, defaultNotes: 'Torque to manufacturer specifications' },
  { name: '12V Lead Acid / EFB Battery', category: 'Electrical', defaultKm: 0, defaultMonths: 24, defaultCost: 280, defaultNotes: 'Test cranking voltage and alternator charging output' },
  { name: 'Radiator Engine Coolant Flush', category: 'Engine', defaultKm: 60000, defaultMonths: 36, defaultCost: 140, defaultNotes: 'Pre-diluted long-life coolant mixture' },
  { name: 'Commercial Puspakom Inspection', category: 'Inspection', defaultKm: 0, defaultMonths: 6, defaultCost: 110, defaultNotes: 'Mandatory commercial inspection (Brakes, smoke, alignment)' },
  { name: 'Roadtax & Motor Takaful Renewal', category: 'Inspection', defaultKm: 0, defaultMonths: 12, defaultCost: 150, defaultNotes: 'JPJ road tax physical sticker or digital renewal' },
];

// Helper: Calculate service status based on mileage and date
export function getServiceHealth(interval: MaintenanceInterval, currentOdometer: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let kmRemaining: number | null = null;
  let isKmOverdue = false;
  let isKmDueSoon = false;

  if (interval.intervalKm > 0) {
    const nextKm = interval.nextDueOdometer ?? (interval.lastServiceOdometer + interval.intervalKm);
    kmRemaining = nextKm - currentOdometer;
    if (kmRemaining < 0) {
      isKmOverdue = true;
    } else if (kmRemaining <= 1500) {
      isKmDueSoon = true;
    }
  }

  let daysRemaining: number | null = null;
  let isDateOverdue = false;
  let isDateDueSoon = false;

  if (interval.nextDueDate) {
    const dueDate = new Date(interval.nextDueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime();
    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (daysRemaining < 0) {
      isDateOverdue = true;
    } else if (daysRemaining <= 14) {
      isDateDueSoon = true;
    }
  }

  const isOverdue = isKmOverdue || isDateOverdue;
  const isDueSoon = !isOverdue && (isKmDueSoon || isDateDueSoon);

  // Calculate percentage elapsed for progress bar
  let percentElapsed = 0;
  if (interval.intervalKm > 0) {
    const kmPassed = Math.max(0, currentOdometer - interval.lastServiceOdometer);
    percentElapsed = Math.min(100, Math.round((kmPassed / interval.intervalKm) * 100));
  } else if (interval.intervalMonths > 0 && interval.lastServiceDate && interval.nextDueDate) {
    const start = new Date(interval.lastServiceDate).getTime();
    const end = new Date(interval.nextDueDate).getTime();
    const now = today.getTime();
    if (end > start) {
      percentElapsed = Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
    }
  }

  return {
    isOverdue,
    isDueSoon,
    isOptimal: !isOverdue && !isDueSoon,
    kmRemaining,
    daysRemaining,
    percentElapsed,
    statusLabel: isOverdue ? 'Overdue' : isDueSoon ? 'Due Soon' : 'Optimal',
  };
}

const MaintenanceManagement: React.FC = () => {
  const {
    vehicles,
    users,
    odometerLogs,
    issueLogs,
    addIssueLog,
    updateIssueLog,
    deleteIssueLog,
    maintenanceIntervals,
    maintenanceLogs,
    addMaintenanceInterval,
    updateMaintenanceInterval,
    deleteMaintenanceInterval,
    addMaintenanceLog,
    deleteMaintenanceLog,
    addOdometerLog,
  } = useAppContext();

  // Navigation tab within Maintenance
  const [activeTab, setActiveTab] = useState<'intervals' | 'issues' | 'history'>('intervals');

  // Vehicle filter
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [selectedIssue, setSelectedIssue] = useState<IssueLog | null>(null);
  const [isReportIssueModalOpen, setIsReportIssueModalOpen] = useState(false);
  const [isRecordServiceModalOpen, setIsRecordServiceModalOpen] = useState(false);
  const [serviceModalPreFill, setServiceModalPreFill] = useState<{
    intervalId?: string;
    vehicleId: string;
    serviceName: string;
    estimatedCost?: number;
  } | null>(null);

  const [isAddIntervalModalOpen, setIsAddIntervalModalOpen] = useState(false);
  const [editingInterval, setEditingInterval] = useState<MaintenanceInterval | null>(null);
  const [isUpdateOdometerModalOpen, setIsUpdateOdometerModalOpen] = useState(false);
  const [odometerTargetVehicleId, setOdometerTargetVehicleId] = useState<string>('');

  // Latest Odometer Map per Vehicle (calculated from odometerLogs & lastServiceOdometer)
  const vehicleOdometerMap = useMemo(() => {
    const map = new Map<string, number>();
    vehicles.forEach(v => {
      const logs = odometerLogs.filter(l => l.vehicleId === v.id).sort((a, b) => b.odometer - a.odometer);
      if (logs.length > 0) {
        map.set(v.id, logs[0].odometer);
      } else {
        // Fallback to highest recorded service mileage or default
        const intervals = maintenanceIntervals.filter(i => i.vehicleId === v.id);
        const maxOdo = intervals.reduce((max, i) => Math.max(max, i.lastServiceOdometer || 0), 45000);
        map.set(v.id, maxOdo);
      }
    });
    return map;
  }, [vehicles, odometerLogs, maintenanceIntervals]);

  // High Level KPIs
  const maintenanceKPIs = useMemo(() => {
    let overdueCount = 0;
    let dueSoonCount = 0;

    maintenanceIntervals.forEach(interval => {
      const curOdo = vehicleOdometerMap.get(interval.vehicleId) || 0;
      const health = getServiceHealth(interval, curOdo);
      if (health.isOverdue) overdueCount++;
      else if (health.isDueSoon) dueSoonCount++;
    });

    const activeIssuesCount = issueLogs.filter(i => i.status === 'Open' || i.status === 'In Progress').length;
    const totalSpent = maintenanceLogs.reduce((sum, log) => sum + (log.totalCost || 0), 0);

    return {
      overdueCount,
      dueSoonCount,
      activeIssuesCount,
      totalSpent,
    };
  }, [maintenanceIntervals, vehicleOdometerMap, issueLogs, maintenanceLogs]);

  // Filtered intervals list
  const filteredIntervals = useMemo(() => {
    return maintenanceIntervals.filter(interval => {
      if (selectedVehicleId !== 'all' && interval.vehicleId !== selectedVehicleId) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const v = vehicles.find(veh => veh.id === interval.vehicleId);
        const matchName = interval.serviceName.toLowerCase().includes(q);
        const matchCategory = interval.category.toLowerCase().includes(q);
        const matchNotes = (interval.notes || '').toLowerCase().includes(q);
        const matchVehicle = v ? (v.name.toLowerCase().includes(q) || v.plateNumber.toLowerCase().includes(q)) : false;
        return matchName || matchCategory || matchNotes || matchVehicle;
      }
      return true;
    });
  }, [maintenanceIntervals, selectedVehicleId, searchQuery, vehicles]);

  // Issue filter states
  const [issueStatusFilter, setIssueStatusFilter] = useState<'All' | 'Open' | 'In Progress' | 'Resolved'>('All');
  const [issuePriorityFilter, setIssuePriorityFilter] = useState<'All' | 'High' | 'Medium' | 'Low'>('All');

  const filteredIssues = useMemo(() => {
    return issueLogs.filter(issue => {
      if (selectedVehicleId !== 'all' && issue.vehicleId !== selectedVehicleId) return false;
      if (issueStatusFilter !== 'All' && issue.status !== issueStatusFilter) return false;
      if (issuePriorityFilter !== 'All' && issue.priority !== issuePriorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const v = vehicles.find(veh => veh.id === issue.vehicleId);
        const matchTitle = issue.issueTitle.toLowerCase().includes(q);
        const matchDesc = issue.issueDescription.toLowerCase().includes(q);
        const matchVehicle = v ? (v.name.toLowerCase().includes(q) || v.plateNumber.toLowerCase().includes(q)) : false;
        return matchTitle || matchDesc || matchVehicle;
      }
      return true;
    });
  }, [issueLogs, selectedVehicleId, issueStatusFilter, issuePriorityFilter, searchQuery, vehicles]);

  // Filtered maintenance history logs
  const filteredLogs = useMemo(() => {
    return maintenanceLogs.filter(log => {
      if (selectedVehicleId !== 'all' && log.vehicleId !== selectedVehicleId) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const v = vehicles.find(veh => veh.id === log.vehicleId);
        const matchWorkshop = log.workshopName.toLowerCase().includes(q);
        const matchItems = log.serviceItems.some(i => i.toLowerCase().includes(q));
        const matchInvoice = (log.invoiceNumber || '').toLowerCase().includes(q);
        const matchRemarks = (log.remarks || '').toLowerCase().includes(q);
        const matchVehicle = v ? (v.name.toLowerCase().includes(q) || v.plateNumber.toLowerCase().includes(q)) : false;
        return matchWorkshop || matchItems || matchInvoice || matchRemarks || matchVehicle;
      }
      return true;
    }).sort((a, b) => new Date(b.serviceDate).getTime() - new Date(a.serviceDate).getTime());
  }, [maintenanceLogs, selectedVehicleId, searchQuery, vehicles]);

  // Handler: Open Service Record Modal
  const handleOpenRecordService = (interval?: MaintenanceInterval) => {
    if (interval) {
      setServiceModalPreFill({
        intervalId: interval.id,
        vehicleId: interval.vehicleId,
        serviceName: interval.serviceName,
        estimatedCost: interval.estimatedCost,
      });
    } else {
      setServiceModalPreFill({
        vehicleId: selectedVehicleId !== 'all' ? selectedVehicleId : (vehicles[0]?.id || ''),
        serviceName: 'Engine Oil & Oil Filter',
      });
    }
    setIsRecordServiceModalOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Top Banner & Header */}
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <WrenchScrewdriverIcon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Fleet Maintenance & Health</h2>
              <p className="text-xs sm:text-sm text-slate-500 font-medium">
                Preventive service intervals, odometer schedules, and driver defect reporting
              </p>
            </div>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'intervals' && (
            <>
              <button
                onClick={() => setIsAddIntervalModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl transition cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add Interval Service</span>
              </button>
              <button
                onClick={() => handleOpenRecordService()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
              >
                <CheckCircleIcon className="h-4 w-4" />
                <span>Record Completed Service</span>
              </button>
            </>
          )}

          {activeTab === 'issues' && (
            <button
              onClick={() => setIsReportIssueModalOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Report Vehicle Defect</span>
            </button>
          )}

          {activeTab === 'history' && (
            <button
              onClick={() => handleOpenRecordService()}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Log Past Service</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Status Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Overdue */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-600">Overdue Services</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <ExclamationIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-rose-700">{maintenanceKPIs.overdueCount}</span>
            <span className="text-xs text-rose-600 font-medium">requires immediate booking</span>
          </div>
        </div>

        {/* Due Soon */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-600">Due Soon (&lt;1,500 km)</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <ClockIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-amber-700">{maintenanceKPIs.dueSoonCount}</span>
            <span className="text-xs text-amber-600 font-medium">schedule with workshop</span>
          </div>
        </div>

        {/* Active Driver Issues */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600">Driver Issues</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ClipboardListIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-blue-700">{maintenanceKPIs.activeIssuesCount}</span>
            <span className="text-xs text-blue-600 font-medium">reported by drivers</span>
          </div>
        </div>

        {/* Total Maintenance Spent */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Spent</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <DocumentReportIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-xs font-bold text-slate-400">RM</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-800">
              {maintenanceKPIs.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('intervals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'intervals'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <GaugeIcon className="h-4 w-4" />
            <span>Service Intervals & Schedules</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'intervals' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {maintenanceIntervals.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('issues')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'issues'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ExclamationIcon className="h-4 w-4" />
            <span>Driver Defect Reports</span>
            {maintenanceKPIs.activeIssuesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500 text-white animate-pulse">
                {maintenanceKPIs.activeIssuesCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Service Records & Invoices</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              activeTab === 'history' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {maintenanceLogs.length}
            </span>
          </button>
        </div>

        {/* Vehicle Filter Selector */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:inline">Vehicle:</label>
          <select
            value={selectedVehicleId}
            onChange={e => setSelectedVehicleId(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-300 text-slate-800 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="all">🚗 All Vehicles ({vehicles.length})</option>
            {vehicles.map(v => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.plateNumber})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search and Secondary Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search service, workshop, specs, or vehicle..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-xs bg-white border border-slate-200 rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-500 focus:outline-none text-slate-800"
          />
        </div>

        {activeTab === 'issues' && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={issueStatusFilter}
              onChange={e => setIssueStatusFilter(e.target.value as any)}
              className="text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700"
            >
              <option value="All">All Statuses</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
            </select>
            <select
              value={issuePriorityFilter}
              onChange={e => setIssuePriorityFilter(e.target.value as any)}
              className="text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-700"
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* SUB-TAB 1: SERVICE INTERVALS & PREVENTIVE MAINTENANCE SCHEDULE */}
      {/* ============================================================== */}
      {activeTab === 'intervals' && (
        <div className="space-y-6">
          
          {/* Quick Vehicle Odometer Health Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {vehicles.map(v => {
              const currentOdo = vehicleOdometerMap.get(v.id) || 0;
              const vIntervals = maintenanceIntervals.filter(i => i.vehicleId === v.id);
              const overdueCount = vIntervals.filter(i => getServiceHealth(i, currentOdo).isOverdue).length;
              const dueSoonCount = vIntervals.filter(i => getServiceHealth(i, currentOdo).isDueSoon).length;

              return (
                <div
                  key={v.id}
                  onClick={() => setSelectedVehicleId(selectedVehicleId === v.id ? 'all' : v.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer ${
                    selectedVehicleId === v.id
                      ? 'bg-indigo-50/80 border-indigo-300 ring-2 ring-indigo-500/20 shadow-sm'
                      : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{v.name}</h4>
                      <p className="text-xs font-semibold text-indigo-700 tracking-wide">{v.plateNumber}</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {vIntervals.length} Services
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Odometer</span>
                      <span className="font-extrabold text-slate-800">{currentOdo.toLocaleString()} km</span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setOdometerTargetVehicleId(v.id);
                        setIsUpdateOdometerModalOpen(true);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-white hover:bg-indigo-50 px-2 py-1 rounded-lg border border-indigo-200 transition cursor-pointer"
                    >
                      Update Odo
                    </button>
                  </div>

                  {/* Warning pills */}
                  {(overdueCount > 0 || dueSoonCount > 0) && (
                    <div className="mt-2 flex items-center gap-1.5">
                      {overdueCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          {overdueCount} Overdue
                        </span>
                      )}
                      {dueSoonCount > 0 && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-800">
                          {dueSoonCount} Due Soon
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Service Intervals Table / Card View */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-extrabold text-base text-slate-900">Configured Service Intervals</h3>
                <p className="text-xs text-slate-500">
                  Track engine oils, gearbox fluids, brake pads, tire rotations, and scheduled inspections per vehicle
                </p>
              </div>
              <button
                onClick={() => setIsAddIntervalModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Add Custom Interval</span>
              </button>
            </div>

            {filteredIntervals.length === 0 ? (
              <div className="p-12 text-center">
                <WrenchScrewdriverIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                <h4 className="text-sm font-bold text-slate-700">No Service Intervals Found</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Add custom service intervals like Engine Oil, Transmission Fluid, or Puspakom Inspections to track preventive maintenance for your fleet.
                </p>
                <button
                  onClick={() => setIsAddIntervalModalOpen(true)}
                  className="mt-4 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>Create First Service Interval</span>
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredIntervals.map(interval => {
                  const vehicle = vehicles.find(v => v.id === interval.vehicleId);
                  const currentOdometer = vehicleOdometerMap.get(interval.vehicleId) || 0;
                  const health = getServiceHealth(interval, currentOdometer);
                  const categoryStyle = categoryBadgeStyles[interval.category] || categoryBadgeStyles.General;

                  return (
                    <div
                      key={interval.id}
                      className={`p-4 sm:p-5 transition hover:bg-slate-50/80 ${
                        health.isOverdue
                          ? 'bg-rose-50/40 border-l-4 border-l-rose-500'
                          : health.isDueSoon
                          ? 'bg-amber-50/30 border-l-4 border-l-amber-500'
                          : 'border-l-4 border-l-transparent'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        
                        {/* Left: Service Info & Vehicle */}
                        <div className="space-y-1.5 flex-1 min-w-[280px]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-sm sm:text-base text-slate-900">
                              {interval.serviceName}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${categoryStyle.bg} ${categoryStyle.text}`}>
                              {interval.category}
                            </span>
                            {/* Health Pill */}
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                              health.isOverdue
                                ? 'bg-rose-100 text-rose-800 ring-1 ring-rose-500/20'
                                : health.isDueSoon
                                ? 'bg-amber-100 text-amber-800 ring-1 ring-amber-500/20'
                                : 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500/20'
                            }`}>
                              {health.statusLabel}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <TruckIcon className="h-3.5 w-3.5 text-slate-400" />
                              {vehicle ? `${vehicle.name} (${vehicle.plateNumber})` : 'Vehicle'}
                            </span>
                            <span>•</span>
                            <span>
                              Interval: <strong className="text-slate-800">
                                {interval.intervalKm > 0 ? `Every ${interval.intervalKm.toLocaleString()} km` : ''}
                                {interval.intervalKm > 0 && interval.intervalMonths > 0 ? ' / ' : ''}
                                {interval.intervalMonths > 0 ? `${interval.intervalMonths} Months` : ''}
                              </strong>
                            </span>
                            {interval.estimatedCost && (
                              <>
                                <span>•</span>
                                <span>Est. Cost: <strong className="text-slate-800">RM {interval.estimatedCost}</strong></span>
                              </>
                            )}
                          </div>

                          {interval.notes && (
                            <p className="text-xs text-slate-500 italic bg-white/80 p-2 rounded-lg border border-slate-100 max-w-2xl">
                              📌 {interval.notes}
                            </p>
                          )}
                        </div>

                        {/* Middle: Progress / Due Status Indicator */}
                        <div className="lg:w-72 shrink-0 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400 font-bold uppercase text-[10px]">Due Countdown</span>
                            <span className={`font-extrabold ${
                              health.isOverdue ? 'text-rose-600' : health.isDueSoon ? 'text-amber-600' : 'text-slate-700'
                            }`}>
                              {health.isOverdue
                                ? `🚨 Overdue by ${health.kmRemaining !== null ? `${Math.abs(health.kmRemaining).toLocaleString()} km` : `${Math.abs(health.daysRemaining || 0)} days`}`
                                : health.kmRemaining !== null
                                ? `In ${health.kmRemaining.toLocaleString()} km`
                                : `${health.daysRemaining} days remaining`}
                            </span>
                          </div>

                          {/* Visual Progress Bar */}
                          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-500 ${
                                health.isOverdue
                                  ? 'bg-rose-500'
                                  : health.isDueSoon
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(8, health.percentElapsed))}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>Last: {interval.lastServiceOdometer ? `${interval.lastServiceOdometer.toLocaleString()} km` : interval.lastServiceDate || 'N/A'}</span>
                            <span className="font-semibold text-slate-700">
                              Target: {interval.nextDueOdometer ? `${interval.nextDueOdometer.toLocaleString()} km` : interval.nextDueDate || 'N/A'}
                            </span>
                          </div>
                        </div>

                        {/* Right: Actions */}
                        <div className="flex items-center gap-2 self-end lg:self-center">
                          <button
                            onClick={() => handleOpenRecordService(interval)}
                            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
                            title="Mark service completed and advance interval"
                          >
                            <CheckCircleIcon className="h-4 w-4" />
                            <span>Record Service</span>
                          </button>

                          <button
                            onClick={() => {
                              setEditingInterval(interval);
                              setIsAddIntervalModalOpen(true);
                            }}
                            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
                            title="Edit Interval"
                          >
                            <EditIcon className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete "${interval.serviceName}" for this vehicle?`)) {
                                deleteMaintenanceInterval(interval.id);
                              }
                            }}
                            className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl border border-rose-200 transition cursor-pointer"
                            title="Delete Interval"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 2: DRIVER DEFECT & ISSUE REPORTS                       */}
      {/* ============================================================== */}
      {activeTab === 'issues' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Driver Defect Reports & Work Orders</h3>
              <p className="text-xs text-slate-500">
                Issues reported by drivers during daily vehicle checks or after trip completions
              </p>
            </div>
            <button
              onClick={() => setIsReportIssueModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              <span>Report New Issue</span>
            </button>
          </div>

          {filteredIssues.length === 0 ? (
            <div className="p-12 text-center">
              <CheckCircleIcon className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">All Fleet Vehicles Healthy</h4>
              <p className="text-xs text-slate-400 mt-1">No open issues or defects reported matching your filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Issue Summary</th>
                    <th className="px-4 py-3 text-left">Reported By</th>
                    <th className="px-4 py-3 text-left">Odometer</th>
                    <th className="px-4 py-3 text-left">Priority</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredIssues.map(issue => {
                    const vehicle = vehicles.find(v => v.id === issue.vehicleId);
                    const reporter = users.find(u => u.id === issue.reportedById);
                    const prio = priorityStyles[issue.priority] || priorityStyles.Low;
                    const stat = statusStyles[issue.status] || statusStyles.Open;

                    return (
                      <tr
                        key={issue.id}
                        onClick={() => setSelectedIssue(issue)}
                        className="hover:bg-indigo-50/30 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 block">{vehicle?.name || 'Unknown'}</span>
                          <span className="text-[11px] text-slate-500">{vehicle?.plateNumber || ''}</span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900 line-clamp-1">{issue.issueTitle}</span>
                            {issue.isVehicleOutOfService && (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-rose-600 text-white shrink-0">
                                GROUNDED
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{issue.issueDescription}</p>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-slate-700 font-medium">
                          {reporter?.name || 'Staff / Driver'}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                          {issue.odometer ? `${issue.odometer.toLocaleString()} km` : '-'}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${prio.bg} ${prio.text}`}>
                            {issue.priority}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${stat.bg} ${stat.text}`}>
                            {issue.status}
                          </span>
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-slate-500">
                          {new Date(issue.reportedDate).toLocaleDateString('en-GB')}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedIssue(issue);
                            }}
                            className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* SUB-TAB 3: SERVICE RECORDS & EXPENSE LOGS                      */}
      {/* ============================================================== */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Maintenance History & Invoices</h3>
              <p className="text-xs text-slate-500">
                Permanent audit log of all completed services, workshop receipts, parts, and labor costs
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Export to CSV
                  const headers = ['Date', 'Vehicle', 'Plate Number', 'Service Items', 'Workshop', 'Odometer (km)', 'Cost (RM)', 'Invoice #', 'Remarks'];
                  const rows = filteredLogs.map(l => {
                    const v = vehicles.find(veh => veh.id === l.vehicleId);
                    return [
                      l.serviceDate,
                      `"${v?.name || ''}"`,
                      `"${v?.plateNumber || ''}"`,
                      `"${l.serviceItems.join(', ')}"`,
                      `"${l.workshopName}"`,
                      l.odometer,
                      l.totalCost,
                      `"${l.invoiceNumber || ''}"`,
                      `"${(l.remarks || '').replace(/"/g, '""')}"`
                    ];
                  });
                  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `fleet_maintenance_history_${new Date().toISOString().split('T')[0]}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl border border-slate-300 transition cursor-pointer"
              >
                Export CSV
              </button>
              <button
                onClick={() => handleOpenRecordService()}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer"
              >
                <PlusIcon className="h-4 w-4" />
                <span>Log Service</span>
              </button>
            </div>
          </div>

          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center">
              <DocumentReportIcon className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-sm font-bold text-slate-700">No Maintenance Records Found</h4>
              <p className="text-xs text-slate-400 mt-1">
                Completed services will be logged here with workshop receipts and expense records.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-bold">
                  <tr>
                    <th className="px-4 py-3 text-left">Service Date</th>
                    <th className="px-4 py-3 text-left">Vehicle</th>
                    <th className="px-4 py-3 text-left">Service Items & Workshop</th>
                    <th className="px-4 py-3 text-left">Odometer</th>
                    <th className="px-4 py-3 text-left">Invoice #</th>
                    <th className="px-4 py-3 text-right">Cost (RM)</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.map(log => {
                    const vehicle = vehicles.find(v => v.id === log.vehicleId);

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-4 py-3 whitespace-nowrap font-bold text-slate-800">
                          {log.serviceDate}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-bold text-slate-900 block">{vehicle?.name || 'Vehicle'}</span>
                          <span className="text-[11px] text-slate-500">{vehicle?.plateNumber}</span>
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1 mb-1">
                            {log.serviceItems.map((item, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-[10px] border border-indigo-100">
                                {item}
                              </span>
                            ))}
                          </div>
                          <span className="text-xs text-slate-700 font-semibold block">🔧 {log.workshopName}</span>
                          {log.remarks && (
                            <p className="text-[11px] text-slate-500 italic mt-0.5">{log.remarks}</p>
                          )}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap font-semibold text-slate-800">
                          {log.odometer.toLocaleString()} km
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                          {log.invoiceNumber || '-'}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right font-black text-slate-900">
                          RM {log.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <button
                            onClick={() => {
                              if (window.confirm('Delete this maintenance history log?')) {
                                deleteMaintenanceLog(log.id);
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition cursor-pointer"
                            title="Delete log"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL 1: RECORD COMPLETED SERVICE                              */}
      {/* ============================================================== */}
      {isRecordServiceModalOpen && (
        <RecordServiceModal
          isOpen={isRecordServiceModalOpen}
          onClose={() => {
            setIsRecordServiceModalOpen(false);
            setServiceModalPreFill(null);
          }}
          preFill={serviceModalPreFill}
          vehicles={vehicles}
          vehicleOdometerMap={vehicleOdometerMap}
          onSubmit={async (logData, intervalId) => {
            await addMaintenanceLog(logData, intervalId);
            setIsRecordServiceModalOpen(false);
            setServiceModalPreFill(null);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 2: ADD / EDIT INTERVAL SERVICE                           */}
      {/* ============================================================== */}
      {isAddIntervalModalOpen && (
        <AddEditIntervalModal
          isOpen={isAddIntervalModalOpen}
          initialData={editingInterval}
          vehicles={vehicles}
          defaultVehicleId={selectedVehicleId !== 'all' ? selectedVehicleId : (vehicles[0]?.id || '')}
          currentOdometer={vehicleOdometerMap.get(editingInterval?.vehicleId || selectedVehicleId) || 50000}
          onClose={() => {
            setIsAddIntervalModalOpen(false);
            setEditingInterval(null);
          }}
          onSubmit={async (data) => {
            if (editingInterval) {
              await updateMaintenanceInterval(editingInterval.id, data);
            } else {
              await addMaintenanceInterval(data);
            }
            setIsAddIntervalModalOpen(false);
            setEditingInterval(null);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 3: REPORT VEHICLE DEFECT / ISSUE                         */}
      {/* ============================================================== */}
      {isReportIssueModalOpen && (
        <ReportIssueModal
          isOpen={isReportIssueModalOpen}
          vehicles={vehicles}
          defaultVehicleId={selectedVehicleId !== 'all' ? selectedVehicleId : (vehicles[0]?.id || '')}
          vehicleOdometerMap={vehicleOdometerMap}
          onClose={() => setIsReportIssueModalOpen(false)}
          onSubmit={async (issueData) => {
            addIssueLog(issueData);
            setIsReportIssueModalOpen(false);
          }}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 4: ISSUE DETAILS & RESOLUTION WORKFLOW                   */}
      {/* ============================================================== */}
      {selectedIssue && (
        <IssueDetailModal
          issue={selectedIssue}
          onClose={() => setSelectedIssue(null)}
        />
      )}

      {/* ============================================================== */}
      {/* MODAL 5: QUICK UPDATE ODOMETER                                 */}
      {/* ============================================================== */}
      {isUpdateOdometerModalOpen && odometerTargetVehicleId && (
        <UpdateOdometerModal
          vehicle={vehicles.find(v => v.id === odometerTargetVehicleId)!}
          currentReading={vehicleOdometerMap.get(odometerTargetVehicleId) || 0}
          onClose={() => {
            setIsUpdateOdometerModalOpen(false);
            setOdometerTargetVehicleId('');
          }}
          onSubmit={async (newOdo, remarks) => {
            const v = vehicles.find(veh => veh.id === odometerTargetVehicleId);
            if (v) {
              addOdometerLog({
                driverId: 'admin',
                vehicleId: v.id,
                date: new Date().toISOString().split('T')[0],
                odometer: newOdo,
                purpose: 'Manual Odometer Calibration / Sync',
                remarks: remarks || 'Adjusted in Maintenance Management',
              });
            }
            setIsUpdateOdometerModalOpen(false);
            setOdometerTargetVehicleId('');
          }}
        />
      )}

    </div>
  );
};

// =====================================================================
// MODAL COMPONENTS
// =====================================================================

// 1. Record Completed Service Modal
interface RecordServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  preFill: {
    intervalId?: string;
    vehicleId: string;
    serviceName: string;
    estimatedCost?: number;
  } | null;
  vehicles: any[];
  vehicleOdometerMap: Map<string, number>;
  onSubmit: (logData: Omit<MaintenanceLog, 'id'>, intervalId?: string) => Promise<void>;
}

const RecordServiceModal: React.FC<RecordServiceModalProps> = ({
  onClose,
  preFill,
  vehicles,
  vehicleOdometerMap,
  onSubmit,
}) => {
  const [vehicleId, setVehicleId] = useState(preFill?.vehicleId || vehicles[0]?.id || '');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [odometer, setOdometer] = useState<number>(vehicleOdometerMap.get(vehicleId) || 50000);
  const [serviceItemsText, setServiceItemsText] = useState(preFill?.serviceName || 'Engine Oil & Oil Filter');
  const [workshopName, setWorkshopName] = useState('Authorized Service Centre');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [totalCost, setTotalCost] = useState<number>(preFill?.estimatedCost || 220);
  const [performedBy, setPerformedBy] = useState('Staff / Driver');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !workshopName.trim()) {
      alert('Please select vehicle and specify workshop name.');
      return;
    }

    setIsSubmitting(true);
    try {
      const items = serviceItemsText
        .split(',')
        .map(i => i.trim())
        .filter(Boolean);

      await onSubmit({
        vehicleId,
        serviceDate,
        odometer: Number(odometer) || 0,
        serviceType: 'Scheduled Maintenance',
        serviceItems: items.length > 0 ? items : [serviceItemsText],
        workshopName: workshopName.trim(),
        invoiceNumber: invoiceNumber.trim() || undefined,
        totalCost: Number(totalCost) || 0,
        performedBy: performedBy.trim() || undefined,
        remarks: remarks.trim() || undefined,
      }, preFill?.intervalId);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Record Completed Service</h3>
              <p className="text-xs text-slate-500">Logs invoice and advances scheduled interval</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Vehicle *</label>
            <select
              value={vehicleId}
              onChange={e => {
                const vid = e.target.value;
                setVehicleId(vid);
                const curOdo = vehicleOdometerMap.get(vid);
                if (curOdo) setOdometer(curOdo);
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Service Date *</label>
              <input
                type="date"
                value={serviceDate}
                onChange={e => setServiceDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Odometer at Service (KM) *</label>
              <input
                type="number"
                value={odometer}
                onChange={e => setOdometer(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Service Items Completed *</label>
            <input
              type="text"
              value={serviceItemsText}
              onChange={e => setServiceItemsText(e.target.value)}
              placeholder="e.g. Engine Oil & Oil Filter, Tire Rotation, Brake Fluid"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            />
            <p className="text-[10px] text-slate-400 mt-1">Separate multiple items with commas</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Workshop / Service Centre *</label>
              <input
                type="text"
                value={workshopName}
                onChange={e => setWorkshopName(e.target.value)}
                placeholder="e.g. Perodua Pandan Indah"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Invoice / Receipt #</label>
              <input
                type="text"
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="e.g. INV-2026-8812"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Total Cost (RM) *</label>
              <input
                type="number"
                step="0.01"
                value={totalCost}
                onChange={e => setTotalCost(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Delivered By</label>
              <input
                type="text"
                value={performedBy}
                onChange={e => setPerformedBy(e.target.value)}
                placeholder="e.g. Driver Syafiq"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Mechanic / Service Remarks</label>
            <textarea
              rows={2}
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              placeholder="e.g. Brake pads at 70%, next service will need aircond gas topup"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Save & Update Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 2. Add / Edit Service Interval Modal
interface AddEditIntervalModalProps {
  isOpen: boolean;
  initialData?: MaintenanceInterval | null;
  vehicles: any[];
  defaultVehicleId: string;
  currentOdometer: number;
  onClose: () => void;
  onSubmit: (data: Omit<MaintenanceInterval, 'id'>) => Promise<void>;
}

const AddEditIntervalModal: React.FC<AddEditIntervalModalProps> = ({
  initialData,
  vehicles,
  defaultVehicleId,
  currentOdometer,
  onClose,
  onSubmit,
}) => {
  const [vehicleId, setVehicleId] = useState(initialData?.vehicleId || defaultVehicleId || vehicles[0]?.id || '');
  const [serviceName, setServiceName] = useState(initialData?.serviceName || '');
  const [category, setCategory] = useState<MaintenanceCategory>(initialData?.category || 'Engine');
  const [intervalKm, setIntervalKm] = useState<number>(initialData?.intervalKm ?? 10000);
  const [intervalMonths, setIntervalMonths] = useState<number>(initialData?.intervalMonths ?? 6);
  const [lastServiceDate, setLastServiceDate] = useState(initialData?.lastServiceDate || new Date().toISOString().split('T')[0]);
  const [lastServiceOdometer, setLastServiceOdometer] = useState<number>(initialData?.lastServiceOdometer ?? currentOdometer);
  const [estimatedCost, setEstimatedCost] = useState<number>(initialData?.estimatedCost ?? 180);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Template Quick Picker
  const handleSelectTemplate = (template: typeof COMMON_SERVICE_TEMPLATES[0]) => {
    setServiceName(template.name);
    setCategory(template.category);
    setIntervalKm(template.defaultKm);
    setIntervalMonths(template.defaultMonths);
    setEstimatedCost(template.defaultCost);
    setNotes(template.defaultNotes);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !serviceName.trim()) {
      alert('Please fill in vehicle and service name');
      return;
    }

    setIsSubmitting(true);
    try {
      const nextKm = intervalKm > 0 ? lastServiceOdometer + intervalKm : undefined;
      let nextDate: string | undefined = undefined;
      if (intervalMonths > 0 && lastServiceDate) {
        const d = new Date(lastServiceDate);
        d.setMonth(d.getMonth() + intervalMonths);
        nextDate = d.toISOString().split('T')[0];
      }

      await onSubmit({
        vehicleId,
        serviceName: serviceName.trim(),
        category,
        intervalKm: Number(intervalKm) || 0,
        intervalMonths: Number(intervalMonths) || 0,
        lastServiceDate,
        lastServiceOdometer: Number(lastServiceOdometer) || 0,
        nextDueOdometer: nextKm,
        nextDueDate: nextDate,
        estimatedCost: Number(estimatedCost) || undefined,
        notes: notes.trim() || undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-extrabold text-base text-slate-900">
              {initialData ? 'Edit Service Interval' : 'Configure Service Interval'}
            </h3>
            <p className="text-xs text-slate-500">Custom preventive maintenance rule for vehicle</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Quick Presets / Templates (only on new) */}
          {!initialData && (
            <div>
              <label className="font-bold text-slate-400 block mb-1 text-[10px] uppercase">
                ⚡ Quick Templates (Click to Auto-fill)
              </label>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-slate-50 rounded-xl border border-slate-200">
                {COMMON_SERVICE_TEMPLATES.map(t => (
                  <button
                    key={t.name}
                    type="button"
                    onClick={() => handleSelectTemplate(t)}
                    className="px-2.5 py-1 text-[11px] font-semibold bg-white hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded-lg text-slate-700 transition cursor-pointer"
                  >
                    + {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="font-bold text-slate-700 block mb-1">Target Vehicle *</label>
            <select
              value={vehicleId}
              onChange={e => setVehicleId(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="font-bold text-slate-700 block mb-1">Service Name *</label>
              <input
                type="text"
                value={serviceName}
                onChange={e => setServiceName(e.target.value)}
                placeholder="e.g. Engine Oil & Oil Filter (Fully Synthetic 0W-20)"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Category *</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as MaintenanceCategory)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Engine">Engine</option>
                <option value="Transmission">Transmission</option>
                <option value="Brakes">Brakes</option>
                <option value="Tires">Tires</option>
                <option value="Electrical">Electrical</option>
                <option value="Inspection">Inspection</option>
                <option value="General">General</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Repeat Every (KM)</label>
              <input
                type="number"
                step="500"
                value={intervalKm}
                onChange={e => setIntervalKm(Number(e.target.value))}
                placeholder="e.g. 10000 (0 for time-only)"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Put 0 if based only on time/months</span>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Repeat Every (Months)</label>
              <input
                type="number"
                value={intervalMonths}
                onChange={e => setIntervalMonths(Number(e.target.value))}
                placeholder="e.g. 6 or 12"
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Put 0 if based only on km</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Last Service Date</label>
              <input
                type="date"
                value={lastServiceDate}
                onChange={e => setLastServiceDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Last Serviced Odometer (KM)</label>
              <input
                type="number"
                value={lastServiceOdometer}
                onChange={e => setLastServiceOdometer(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Estimated Cost (RM)</label>
            <input
              type="number"
              value={estimatedCost}
              onChange={e => setEstimatedCost(Number(e.target.value))}
              placeholder="e.g. 190"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Specifications & Oil / Parts Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Oil viscosity: 0W-20 SN, 4 Litres, OEM oil filter 15601-00R01"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : initialData ? 'Update Interval' : 'Save Interval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 3. Report Vehicle Issue Modal (Admin & Staff)
interface ReportIssueModalProps {
  isOpen: boolean;
  vehicles: any[];
  defaultVehicleId: string;
  vehicleOdometerMap: Map<string, number>;
  onClose: () => void;
  onSubmit: (issueData: Omit<IssueLog, 'id'>) => Promise<void>;
}

const ReportIssueModal: React.FC<ReportIssueModalProps> = ({
  vehicles,
  defaultVehicleId,
  vehicleOdometerMap,
  onClose,
  onSubmit,
}) => {
  const [vehicleId, setVehicleId] = useState(defaultVehicleId || vehicles[0]?.id || '');
  const [odometer, setOdometer] = useState<number>(vehicleOdometerMap.get(vehicleId) || 50000);
  const [issueTitle, setIssueTitle] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [priority, setPriority] = useState<IssueLog['priority']>('Medium');
  const [isVehicleOutOfService, setIsVehicleOutOfService] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleId || !issueTitle.trim() || !issueDescription.trim()) {
      alert('Please fill in vehicle, title, and description.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        vehicleId,
        odometer: Number(odometer) || 0,
        issueTitle: issueTitle.trim(),
        issueDescription: issueDescription.trim(),
        reportedDate: new Date().toISOString(),
        reportedById: 'admin',
        priority,
        isVehicleOutOfService,
        status: 'Open',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ExclamationIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-base text-slate-900">Report Vehicle Issue / Defect</h3>
              <p className="text-xs text-slate-500">Logs a maintenance defect ticket for workshop inspection</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">Select Vehicle *</label>
            <select
              value={vehicleId}
              onChange={e => {
                const vid = e.target.value;
                setVehicleId(vid);
                const curOdo = vehicleOdometerMap.get(vid);
                if (curOdo) setOdometer(curOdo);
              }}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            >
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Current Odometer (KM) *</label>
              <input
                type="number"
                value={odometer}
                onChange={e => setOdometer(Number(e.target.value))}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Priority Level *</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Low">Low (Cosmetic / Non-urgent)</option>
                <option value="Medium">Medium (Attention Needed)</option>
                <option value="High">High (Critical / Safety Risk)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Issue Title *</label>
            <input
              type="text"
              value={issueTitle}
              onChange={e => setIssueTitle(e.target.value)}
              placeholder="e.g. Brake grinding sound, AC blowing warm air, Check engine light"
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Detailed Defect Description *</label>
            <textarea
              rows={3}
              value={issueDescription}
              onChange={e => setIssueDescription(e.target.value)}
              placeholder="Describe symptoms, when it occurs, speed, sounds, vibrations, or error messages..."
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-200 flex items-start gap-2.5">
            <input
              type="checkbox"
              id="groundVehicle"
              checked={isVehicleOutOfService}
              onChange={e => setIsVehicleOutOfService(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded text-rose-600 focus:ring-rose-500 border-slate-300 cursor-pointer"
            />
            <label htmlFor="groundVehicle" className="cursor-pointer text-slate-800 font-semibold">
              <span className="font-bold text-rose-800 block">Ground Vehicle (Mark as Out of Service)</span>
              <span className="text-[11px] text-slate-500 font-normal">
                Prevents drivers and staff from booking or assigning this vehicle until resolved.
              </span>
            </label>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Reporting...' : 'Submit Defect Report'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// 4. Issue Detail Modal (Comment thread & Resolution)
interface IssueDetailModalProps {
  issue: IssueLog;
  onClose: () => void;
}

const IssueDetailModal: React.FC<IssueDetailModalProps> = ({ issue, onClose }) => {
  const { vehicles, users, updateIssueLog, deleteIssueLog } = useAppContext();
  const [newStatus, setNewStatus] = useState<IssueLog['status'] | ''>('');
  const [newComment, setNewComment] = useState('');

  const parsedComments = useMemo(() => {
    if (!issue.comments) return [];
    return issue.comments.split('\n\n').map((entry, index) => {
      const lines = entry.split('\n');
      const headerLine = lines[0] || '';
      const body = lines.slice(1).join('\n');
      const headerMatch = headerLine.match(/--- (.*?) \((.*?)\) ---/);

      if (headerMatch) {
        return {
          id: `${issue.id}-comment-${index}`,
          user: headerMatch[1],
          timestamp: headerMatch[2],
          body,
        };
      }
      return { id: `${issue.id}-comment-${index}`, body: entry };
    });
  }, [issue.comments, issue.id]);

  const vehicle = vehicles.find(v => v.id === issue.vehicleId);
  const reporter = users.find(u => u.id === issue.reportedById);

  const handleUpdate = () => {
    if (!newStatus && !newComment.trim()) return;

    const updatedData: Partial<IssueLog> = {};
    if (newStatus) {
      updatedData.status = newStatus;
      if (newStatus === 'Resolved') {
        updatedData.isVehicleOutOfService = false;
      }
    }
    if (newComment.trim()) {
      const user = 'Admin / Fleet Officer';
      const timestamp = new Date().toLocaleString('en-GB');
      const newCommentEntry = `--- ${user} (${timestamp}) ---\n${newComment.trim()}`;
      updatedData.comments = issue.comments
        ? `${newCommentEntry}\n\n${issue.comments}`
        : newCommentEntry;
    }

    updateIssueLog(issue.id, updatedData);
    setNewStatus('');
    setNewComment('');
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to permanently delete this issue log?')) {
      deleteIssueLog(issue.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="min-w-0 pr-4">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Defect Ticket</span>
            <h3 className="font-extrabold text-base sm:text-lg text-slate-900 truncate">{issue.issueTitle}</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* Key Specs Card */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Vehicle</span>
              <span className="font-bold text-slate-800">{vehicle?.name || 'N/A'}</span>
              <span className="text-[11px] text-indigo-700 block font-semibold">{vehicle?.plateNumber}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Reported By</span>
              <span className="font-bold text-slate-800">{reporter?.name || 'Driver / Staff'}</span>
              <span className="text-[10px] text-slate-500 block">{new Date(issue.reportedDate).toLocaleDateString('en-GB')}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Odometer</span>
              <span className="font-bold text-slate-800">{issue.odometer ? `${issue.odometer.toLocaleString()} km` : '-'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Status & Priority</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${priorityStyles[issue.priority].bg} ${priorityStyles[issue.priority].text}`}>
                  {issue.priority}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${statusStyles[issue.status].bg} ${statusStyles[issue.status].text}`}>
                  {issue.status}
                </span>
              </div>
            </div>
          </div>

          {issue.isVehicleOutOfService && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-800 font-bold">
              <ExclamationIcon className="h-5 w-5 text-rose-600 shrink-0" />
              <span>Vehicle Grounded: This vehicle is currently locked out of service.</span>
            </div>
          )}

          {/* Description */}
          <div>
            <h4 className="font-bold text-slate-700 mb-1">Issue Description</h4>
            <p className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed">
              {issue.issueDescription}
            </p>
          </div>

          {/* Attachment Photo */}
          {issue.photoUrl && (
            <div>
              <h4 className="font-bold text-slate-700 mb-1">Attached Photo Evidence</h4>
              <a href={issue.photoUrl} target="_blank" rel="noopener noreferrer">
                <img src={issue.photoUrl} alt="Defect Attachment" className="rounded-xl border border-slate-200 max-h-48 object-cover shadow-2xs" />
              </a>
            </div>
          )}

          {/* Comments & Audit Thread */}
          <div>
            <h4 className="font-bold text-slate-700 mb-1">Maintenance & Workshop Activity Log</h4>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 max-h-40 overflow-y-auto space-y-2.5">
              {parsedComments.length > 0 ? (
                parsedComments.map(comment => (
                  <div key={comment.id} className="bg-white p-2.5 rounded-lg border border-slate-200 shadow-2xs">
                    {comment.user && comment.timestamp && (
                      <div className="flex items-center justify-between pb-1 mb-1 border-b border-slate-100 text-[11px]">
                        <span className="font-bold text-indigo-700">{comment.user}</span>
                        <span className="text-slate-400">{comment.timestamp}</span>
                      </div>
                    )}
                    <p className="text-slate-700 whitespace-pre-wrap">{comment.body}</p>
                  </div>
                ))
              ) : (
                <p className="text-slate-400 italic text-center py-4">No comments or updates recorded yet.</p>
              )}
            </div>
          </div>

          {/* Update Section */}
          <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3">
            <h4 className="font-extrabold text-slate-900">Add Workshop Update / Change Status</h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-slate-600 block mb-1">Update Status</label>
                <select
                  value={newStatus}
                  onChange={e => setNewStatus(e.target.value as any)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800"
                >
                  <option value="">-- Keep Current ({issue.status}) --</option>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress (Sent to Workshop)</option>
                  <option value="Resolved">Resolved (Repairs Verified)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="font-bold text-slate-600 block mb-1">Add Note / Workshop Findings</label>
                <input
                  type="text"
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="e.g. Sent to Tan Chong Glenmarie, replacement parts ordered"
                  className="w-full p-2 bg-white border border-slate-300 rounded-xl font-medium text-slate-800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 rounded-xl border border-rose-200 transition cursor-pointer"
          >
            <TrashIcon className="h-4 w-4" />
            <span>Delete Ticket</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleUpdate}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// 5. Update Vehicle Odometer Modal
interface UpdateOdometerModalProps {
  vehicle: any;
  currentReading: number;
  onClose: () => void;
  onSubmit: (newOdometer: number, remarks: string) => Promise<void>;
}

const UpdateOdometerModal: React.FC<UpdateOdometerModalProps> = ({
  vehicle,
  currentReading,
  onClose,
  onSubmit,
}) => {
  const [newOdo, setNewOdo] = useState<number>(currentReading);
  const [remarks, setRemarks] = useState('Manual meter sync');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOdo <= 0) return;
    setIsSubmitting(true);
    try {
      await onSubmit(newOdo, remarks);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-2xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4">
        <div>
          <h3 className="font-extrabold text-base text-slate-900">Sync Vehicle Odometer</h3>
          <p className="text-xs text-slate-500 font-medium">{vehicle.name} ({vehicle.plateNumber})</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="font-bold text-slate-700 block mb-1">New Odometer Reading (KM) *</label>
            <input
              type="number"
              value={newOdo}
              onChange={e => setNewOdo(Number(e.target.value))}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-black text-slate-900 text-sm focus:ring-2 focus:ring-indigo-500"
              required
            />
            <span className="text-[10px] text-slate-400 mt-1 block">Previous reading: {currentReading.toLocaleString()} km</span>
          </div>

          <div>
            <label className="font-bold text-slate-700 block mb-1">Calibration Note</label>
            <input
              type="text"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl font-medium text-slate-800"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Syncing...' : 'Sync Odometer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MaintenanceManagement;
