import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import {
  FuelIcon,
  GaugeIcon,
  TruckIcon,
  CheckCircleIcon,
  ClockIcon,
  UserGroupIcon,
  ExclamationIcon,
  PlusIcon,
  RouteIcon,
  ChartBarIcon,
  WrenchScrewdriverIcon,
  CalendarIcon,
} from './icons/Icons';

const AdminDashboard: React.FC = () => {
  const {
    bookings,
    users,
    vehicles,
    fuelLogs,
    odometerLogs,
    issueLogs,
    maintenanceIntervals,
    activeTenant,
  } = useAppContext();

  const [trendRange, setTrendRange] = useState<'7d' | '30d'>('7d');
  const [topMetric, setTopMetric] = useState<'fuel' | 'trips' | 'mileage'>('fuel');

  const drivers = useMemo(
    () => users.filter((u) => u.role === 'driver' || u.id === 'driver-aziz'),
    [users]
  );

  // ---------- Date helpers ----------
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return d;
  };

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const parseDate = (s?: string) => (s ? new Date(s) : null);

  // ---------- Core stats ----------
  const stats = useMemo(() => {
    const activeStatuses = ['Pending', 'Assigned', 'Confirmed'];
    const active = bookings.filter((b) => activeStatuses.includes(b.status)).length;
    const completed = bookings.filter((b) => b.status === 'Completed').length;
    const conflicts = bookings.filter((b) => b.status === 'Conflict').length;
    // A booking is delayed only after its expected end time plus a 2-hour grace period.
    // Use the recorded finish time when available; otherwise assume a 2-hour booking from its start.
    const delayed = bookings.filter((b) => {
      if (!['Assigned', 'Confirmed', 'Pending'].includes(b.status)) return false;
      const start = parseDate(b.dateTime);
      if (!start) return false;
      const expectedEnd = parseDate(b.finishDateTime) || new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const graceEnd = new Date(expectedEnd.getTime() + 2 * 60 * 60 * 1000);
      return graceEnd < new Date();
    }).length;

    const todayFuel = fuelLogs.filter((f) => {
      const d = parseDate(f.date);
      return d && isSameDay(d, today);
    });
    const fuelTodayL = todayFuel.reduce((s, f) => s + (f.liters || 0), 0);
    const fuelTodayCost = todayFuel.reduce((s, f) => s + (f.cost || 0), 0);

    const yesterday = daysAgo(1);
    const yFuel = fuelLogs.filter((f) => {
      const d = parseDate(f.date);
      return d && isSameDay(d, yesterday);
    });
    const fuelYestL = yFuel.reduce((s, f) => s + (f.liters || 0), 0);

    const fuelTrendPct =
      fuelYestL > 0 ? ((fuelTodayL - fuelYestL) / fuelYestL) * 100 : fuelTodayL > 0 ? 100 : 0;

    const totalMileage = odometerLogs.reduce((s, o) => s + (o.distance || 0), 0);
    const totalFuelCost = fuelLogs.reduce((s, f) => s + (f.cost || 0), 0);

    const activeVehicles = vehicles.filter(
      (v) => !v.vehicleStatus || v.vehicleStatus === 'Active'
    ).length;
    const maintVehicles = vehicles.filter((v) => v.vehicleStatus === 'Under Maintenance').length;
    const inactiveVehicles = vehicles.filter(
      (v) => v.vehicleStatus === 'Inactive' || v.vehicleStatus === 'Sold'
    ).length;

    const openIssues = issueLogs.filter((i) => i.status === 'Open' || i.status === 'In Progress').length;

    // Maintenance due soon (next 14 days or overdue by odometer/date)
    const now = new Date();
    const soon = new Date(now);
    soon.setDate(soon.getDate() + 14);
    const maintDue = maintenanceIntervals.filter((m) => {
      if (m.nextDueDate) {
        const d = new Date(m.nextDueDate);
        return d <= soon;
      }
      return false;
    }).length;

    const needsAttention = conflicts + delayed + openIssues + maintDue + maintVehicles;

    return {
      active,
      completed,
      conflicts,
      delayed,
      fuelTodayL,
      fuelTodayCost,
      fuelTrendPct,
      totalMileage,
      totalFuelCost,
      activeVehicles,
      maintVehicles,
      inactiveVehicles,
      totalVehicles: vehicles.length,
      openIssues,
      maintDue,
      needsAttention,
      utilization:
        vehicles.length > 0
          ? Math.round((activeVehicles / vehicles.length) * 100)
          : 0,
    };
  }, [bookings, fuelLogs, odometerLogs, vehicles, issueLogs, maintenanceIntervals]);

  // ---------- Trend data (last N days) ----------
  const trendData = useMemo(() => {
    const days = trendRange === '7d' ? 7 : 30;
    const points: { label: string; fuelL: number; trips: number; date: Date }[] = [];

    for (let i = days - 1; i >= 0; i--) {
      const d = daysAgo(i);
      const label =
        days <= 7
          ? d.toLocaleDateString('en-MY', { weekday: 'short' })
          : `${d.getDate()}/${d.getMonth() + 1}`;

      const dayFuel = fuelLogs
        .filter((f) => {
          const fd = parseDate(f.date);
          return fd && isSameDay(fd, d);
        })
        .reduce((s, f) => s + (f.liters || 0), 0);

      const dayTrips = bookings.filter((b) => {
        const bd = parseDate(b.dateTime);
        return bd && isSameDay(bd, d) && b.status === 'Completed';
      }).length;

      points.push({ label, fuelL: dayFuel, trips: dayTrips, date: d });
    }
    return points;
  }, [fuelLogs, bookings, trendRange]);

  const maxFuel = Math.max(...trendData.map((p) => p.fuelL), 1);
  const maxTrips = Math.max(...trendData.map((p) => p.trips), 1);

  // ---------- Top vehicles ----------
  const topVehicles = useMemo(() => {
    const map = vehicles.map((v) => {
      const vFuel = fuelLogs.filter((f) => f.vehicleId === v.id);
      const fuelL = vFuel.reduce((s, f) => s + (f.liters || 0), 0);
      const fuelCost = vFuel.reduce((s, f) => s + (f.cost || 0), 0);
      const vOdo = odometerLogs.filter((o) => o.vehicleId === v.id);
      const mileage = vOdo.reduce((s, o) => s + (o.distance || 0), 0);
      const trips = bookings.filter(
        (b) => b.vehicleId === v.id && b.status === 'Completed'
      ).length;
      return {
        id: v.id,
        name: v.name,
        plate: v.plateNumber,
        fuelL,
        fuelCost,
        mileage,
        trips,
        status: v.vehicleStatus || 'Active',
      };
    });

    if (topMetric === 'fuel') map.sort((a, b) => b.fuelL - a.fuelL);
    else if (topMetric === 'trips') map.sort((a, b) => b.trips - a.trips);
    else map.sort((a, b) => b.mileage - a.mileage);

    return map.slice(0, 6);
  }, [vehicles, fuelLogs, odometerLogs, bookings, topMetric]);

  const maxTopValue = Math.max(
    ...topVehicles.map((v) =>
      topMetric === 'fuel' ? v.fuelL : topMetric === 'trips' ? v.trips : v.mileage
    ),
    1
  );

  // ---------- Fleet status for donut ----------
  const fleetStatus = useMemo(() => {
    const active = vehicles.filter((v) => !v.vehicleStatus || v.vehicleStatus === 'Active').length;
    const maint = vehicles.filter((v) => v.vehicleStatus === 'Under Maintenance').length;
    const inactive = vehicles.filter(
      (v) => v.vehicleStatus === 'Inactive' || v.vehicleStatus === 'Sold'
    ).length;
    const total = vehicles.length || 1;
    return [
      { label: 'Active', value: active, color: '#4f46e5', pct: (active / total) * 100 },
      { label: 'Maintenance', value: maint, color: '#f59e0b', pct: (maint / total) * 100 },
      { label: 'Inactive', value: inactive, color: '#94a3b8', pct: (inactive / total) * 100 },
    ];
  }, [vehicles]);

  // Simple donut segments
  const donutSegments = useMemo(() => {
    let cumulative = 0;
    const r = 40;
    const c = 2 * Math.PI * r;
    return fleetStatus.map((s) => {
      const dash = (s.pct / 100) * c;
      const offset = -cumulative;
      cumulative += dash;
      return { ...s, dash, offset, circumference: c };
    });
  }, [fleetStatus]);

  // ---------- Alerts ----------
  const alerts = useMemo(() => {
    const list: { id: string; severity: 'high' | 'medium' | 'low'; title: string; sub: string }[] = [];

    bookings
      .filter((b) => b.status === 'Conflict')
      .slice(0, 3)
      .forEach((b) => {
        list.push({
          id: `conflict-${b.id}`,
          severity: 'high',
          title: `Booking conflict — ${b.destination || b.purpose}`,
          sub: b.requesterName || 'Unknown requester',
        });
      });

    // Self-drive bookings must be completed through the QR odometer flow.
    // Flag only after the expected finish time plus the same 2-hour grace period.
    bookings
      .filter((b) => {
        if (b.serviceType !== 'Self-Drive' || !['Pending', 'Assigned', 'Confirmed'].includes(b.status)) return false;
        const start = parseDate(b.dateTime);
        if (!start) return false;
        const expectedEnd = parseDate(b.finishDateTime) || new Date(start.getTime() + 2 * 60 * 60 * 1000);
        const graceEnd = new Date(expectedEnd.getTime() + 2 * 60 * 60 * 1000);
        return graceEnd < new Date();
      })
      .slice(0, 4)
      .forEach((b) => {
        const bookingDate = parseDate(b.dateTime);
        const dateLabel = bookingDate
          ? bookingDate.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
          : 'Past booking';
        list.push({
          id: `self-drive-overdue-${b.id}`,
          severity: 'high',
          title: `Self-Drive not completed — ${b.destination || b.purpose || 'Booking'}`,
          sub: `${dateLabel} · ${b.requesterName || 'Staff'} · Odometer submission pending`,
        });
      });

    issueLogs
      .filter((i) => i.status === 'Open' || i.status === 'In Progress')
      .slice(0, 4)
      .forEach((i) => {
        const v = vehicles.find((x) => x.id === i.vehicleId);
        list.push({
          id: `issue-${i.id}`,
          severity: i.priority === 'High' ? 'high' : i.priority === 'Medium' ? 'medium' : 'low',
          title: i.issueTitle,
          sub: `${v?.plateNumber || 'Vehicle'} · ${i.priority}`,
        });
      });

    const soon = new Date();
    soon.setDate(soon.getDate() + 14);
    maintenanceIntervals
      .filter((m) => m.nextDueDate && new Date(m.nextDueDate) <= soon)
      .slice(0, 4)
      .forEach((m) => {
        const v = vehicles.find((x) => x.id === m.vehicleId);
        const overdue = new Date(m.nextDueDate!) < new Date();
        list.push({
          id: `maint-${m.id}`,
          severity: overdue ? 'high' : 'medium',
          title: `${m.serviceName}${overdue ? ' (Overdue)' : ''}`,
          sub: `${v?.plateNumber || 'Vehicle'} · due ${m.nextDueDate}`,
        });
      });

    return list.slice(0, 8);
  }, [bookings, issueLogs, maintenanceIntervals, vehicles]);

  // ---------- Recent activity ----------
  const recentActivity = useMemo(() => {
    const items: { id: string; type: string; title: string; sub: string; time: string; icon: 'trip' | 'fuel' | 'issue' }[] = [];

    odometerLogs.slice(0, 6).forEach((log) => {
      const driver = users.find((u) => u.id === log.driverId)?.name || 'Driver';
      const vehicle = vehicles.find((v) => v.id === log.vehicleId)?.name || 'Vehicle';
      items.push({
        id: `odo-${log.id}`,
        type: 'Trip log',
        title: `${driver} · ${vehicle}`,
        sub: `${log.fromLocation || '?'} → ${log.toLocation || '?'} · +${log.distance || 0} km`,
        time: log.date,
        icon: 'trip',
      });
    });

    fuelLogs.slice(0, 4).forEach((log) => {
      const driver = users.find((u) => u.id === log.driverId)?.name || 'Driver';
      const vehicle = vehicles.find((v) => v.id === log.vehicleId)?.name || 'Vehicle';
      items.push({
        id: `fuel-${log.id}`,
        type: 'Fuel',
        title: `${driver} · ${vehicle}`,
        sub: `${log.liters} L · RM ${log.cost.toFixed(2)}`,
        time: log.date,
        icon: 'fuel',
      });
    });

    // Sort by date desc roughly
    items.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
    return items.slice(0, 8);
  }, [odometerLogs, fuelLogs, users, vehicles]);

  const handleCreateBooking = () => {
    const tid = activeTenant?.id || 'yck';
    window.open(
      `${window.location.origin}/?action=book&tenant_id=${encodeURIComponent(tid)}`,
      '_blank'
    );
  };

  const severityStyles = {
    high: 'bg-rose-50 border-rose-100 text-rose-800',
    medium: 'bg-amber-50 border-amber-100 text-amber-800',
    low: 'bg-slate-50 border-slate-100 text-slate-700',
  };

  return (
    <div className="w-full space-y-5 pb-8">
      {/* ========== HEADER ========== */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">
            Fleet overview · Fuel · Trips · Alerts
          </p>
        </div>
        <button
          onClick={handleCreateBooking}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition duration-200 cursor-pointer text-sm"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Booking
        </button>
      </div>

      {/* ========== CONFLICT BANNER ========== */}
      {stats.conflicts > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center space-x-3">
            <ExclamationIcon className="h-6 w-6 text-rose-600 flex-shrink-0" />
            <div>
              <p className="font-extrabold text-rose-900">
                {stats.conflicts} booking(s) with CONFLICT status
              </p>
              <p className="text-xs text-rose-700 font-medium">
                Check Calendar view to resolve driver/vehicle clashes.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========== KPI CARDS ========== */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
        {/* Active Vehicles */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <TruckIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Active Vehicles</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">
            {stats.activeVehicles}
            <span className="text-xs font-medium text-gray-400 ml-1">/ {stats.totalVehicles}</span>
          </h4>
          <p className="text-[11px] text-gray-500 mt-1 font-medium">{stats.utilization}% utilisation</p>
        </div>

        {/* Ongoing Trips */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <ClockIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Ongoing Trips</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.active}</h4>
          {stats.delayed > 0 ? (
            <p className="text-[11px] text-rose-600 mt-1 font-semibold">{stats.delayed} delayed</p>
          ) : (
            <p className="text-[11px] text-gray-500 mt-1 font-medium">On track</p>
          )}
        </div>

        {/* Fuel Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <FuelIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Fuel Today</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">
            {stats.fuelTodayL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            <span className="text-xs font-medium text-gray-400 ml-1">L</span>
          </h4>
          <p
            className={`text-[11px] mt-1 font-semibold ${
              stats.fuelTrendPct > 0 ? 'text-rose-600' : stats.fuelTrendPct < 0 ? 'text-emerald-600' : 'text-gray-500'
            }`}
          >
            {stats.fuelTrendPct > 0 ? '↑' : stats.fuelTrendPct < 0 ? '↓' : '–'}{' '}
            {Math.abs(stats.fuelTrendPct).toFixed(0)}% vs yesterday
          </p>
        </div>

        {/* Fuel Cost Today */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <GaugeIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Fuel Cost Today</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">
            RM {stats.fuelTodayCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </h4>
          <p className="text-[11px] text-gray-500 mt-1 font-medium">
            Total: RM {stats.totalFuelCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
        </div>

        {/* Needs Attention */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <ExclamationIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Needs Attention</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.needsAttention}</h4>
          <p className="text-[11px] text-gray-500 mt-1 font-medium">
            {stats.maintDue} maint · {stats.openIssues} issues
          </p>
        </div>

        {/* Completed Trips */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-slate-100 text-slate-600 rounded-xl">
              <CheckCircleIcon className="h-5 w-5" />
            </div>
          </div>
          <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Completed Trips</p>
          <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.completed}</h4>
          <p className="text-[11px] text-gray-500 mt-1 font-medium">
            {stats.totalMileage.toLocaleString()} km total
          </p>
        </div>
      </div>

      {/* ========== MAIN CHARTS ROW ========== */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5">
        {/* Trend Chart - 60% */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/40">
            <div className="flex items-center">
              <ChartBarIcon className="h-5 w-5 mr-2 text-indigo-600" />
              <h3 className="font-extrabold text-gray-800 text-sm sm:text-base">
                Fuel & Trip Trend
              </h3>
            </div>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-bold">
              <button
                onClick={() => setTrendRange('7d')}
                className={`px-3 py-1.5 ${
                  trendRange === '7d' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                7 Days
              </button>
              <button
                onClick={() => setTrendRange('30d')}
                className={`px-3 py-1.5 ${
                  trendRange === '30d' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                30 Days
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            {/* Simple dual bar chart */}
            <div className="flex items-end gap-1 sm:gap-1.5 h-44 sm:h-52">
              {trendData.map((p, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-0.5 h-[85%]">
                    <div
                      className="w-[45%] bg-emerald-400/90 rounded-t-sm transition-all group-hover:bg-emerald-500"
                      style={{ height: `${(p.fuelL / maxFuel) * 100}%`, minHeight: p.fuelL > 0 ? 4 : 0 }}
                      title={`${p.fuelL.toFixed(0)} L`}
                    />
                    <div
                      className="w-[45%] bg-indigo-400/90 rounded-t-sm transition-all group-hover:bg-indigo-500"
                      style={{ height: `${(p.trips / maxTrips) * 100}%`, minHeight: p.trips > 0 ? 4 : 0 }}
                      title={`${p.trips} trips`}
                    />
                  </div>
                  <span className="text-[9px] sm:text-[10px] text-gray-400 font-semibold truncate w-full text-center">
                    {p.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-5 mt-3 text-[11px] font-semibold text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400" /> Fuel (L)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-400" /> Completed Trips
              </span>
            </div>
          </div>
        </div>

        {/* Top Vehicles - 40% */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-gray-50/40">
            <div className="flex items-center">
              <TruckIcon className="h-5 w-5 mr-2 text-indigo-600" />
              <h3 className="font-extrabold text-gray-800 text-sm">Top Vehicles</h3>
            </div>
            <select
              value={topMetric}
              onChange={(e) => setTopMetric(e.target.value as any)}
              className="text-xs font-bold border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="fuel">By Fuel (L)</option>
              <option value="trips">By Trips</option>
              <option value="mileage">By Mileage</option>
            </select>
          </div>

          <div className="p-4 sm:p-5 space-y-3">
            {topVehicles.length === 0 ? (
              <p className="text-center text-gray-400 text-xs font-semibold py-8">No vehicle data yet</p>
            ) : (
              topVehicles.map((v, i) => {
                const val =
                  topMetric === 'fuel' ? v.fuelL : topMetric === 'trips' ? v.trips : v.mileage;
                const unit = topMetric === 'fuel' ? 'L' : topMetric === 'trips' ? '' : 'km';
                return (
                  <div key={v.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-gray-800 truncate max-w-[60%]">
                        <span className="text-gray-400 mr-1.5">{i + 1}.</span>
                        {v.plate}
                      </span>
                      <span className="font-extrabold text-indigo-600">
                        {val.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        {unit && <span className="text-gray-400 font-medium ml-0.5">{unit}</span>}
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full transition-all"
                        style={{ width: `${(val / maxTopValue) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========== BOTTOM SECTION ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {/* Fleet Status Donut */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/40">
            <TruckIcon className="h-5 w-5 mr-2 text-indigo-600" />
            <h3 className="font-extrabold text-gray-800 text-sm">Fleet Status</h3>
          </div>
          <div className="p-5 flex flex-col items-center">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                {donutSegments.map((seg, i) => (
                  <circle
                    key={i}
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="12"
                    strokeDasharray={`${seg.dash} ${seg.circumference}`}
                    strokeDashoffset={seg.offset}
                    strokeLinecap="butt"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-extrabold text-gray-900">{stats.totalVehicles}</span>
                <span className="text-[10px] font-bold text-gray-400 uppercase">Vehicles</span>
              </div>
            </div>
            <div className="mt-4 w-full space-y-2">
              {fleetStatus.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 font-semibold text-gray-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.label}
                  </span>
                  <span className="font-extrabold text-gray-800">{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
            <div className="flex items-center">
              <ExclamationIcon className="h-5 w-5 mr-2 text-rose-500" />
              <h3 className="font-extrabold text-gray-800 text-sm">Needs Attention</h3>
            </div>
            {alerts.length > 0 && (
              <span className="text-[10px] font-extrabold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">
                {alerts.length}
              </span>
            )}
          </div>
          <div className="p-3 flex-grow overflow-y-auto max-h-[320px] space-y-2">
            {alerts.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs font-semibold">
                <CheckCircleIcon className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
                All clear — no urgent items
              </div>
            ) : (
              alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-xl border text-xs ${severityStyles[a.severity]}`}
                >
                  <p className="font-bold leading-snug">{a.title}</p>
                  <p className="mt-0.5 opacity-80 font-medium">{a.sub}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/40">
            <RouteIcon className="h-5 w-5 mr-2 text-indigo-600" />
            <h3 className="font-extrabold text-gray-800 text-sm">Recent Activity</h3>
          </div>
          <div className="p-3 flex-grow overflow-y-auto max-h-[320px] space-y-2">
            {recentActivity.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-xs font-semibold">
                No recent activity yet
              </div>
            ) : (
              recentActivity.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl border border-gray-100 bg-gray-50/50 flex items-start gap-3 text-xs"
                >
                  <div
                    className={`p-1.5 rounded-lg flex-shrink-0 ${
                      item.icon === 'fuel'
                        ? 'bg-amber-100 text-amber-600'
                        : item.icon === 'issue'
                        ? 'bg-rose-100 text-rose-600'
                        : 'bg-indigo-100 text-indigo-600'
                    }`}
                  >
                    {item.icon === 'fuel' ? (
                      <FuelIcon className="h-3.5 w-3.5" />
                    ) : (
                      <RouteIcon className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-800 truncate">{item.title}</p>
                    <p className="text-gray-500 font-medium mt-0.5 truncate">{item.sub}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-medium">{item.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
