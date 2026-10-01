import React, { useState, useMemo, useCallback } from 'react';
import { useAppContext } from '../context/AppContext';
import type { FuelLog } from '../types';
import { 
  FuelIcon, 
  GaugeIcon, 
  CalendarIcon, 
  ChartBarIcon,
  CalculatorIcon, 
  TrendingUpIcon, 
  TrendingDownIcon, 
  ShieldExclamationIcon, 
  CheckCircleIcon, 
  ExclamationIcon, 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  DocumentDownloadIcon, 
  SearchIcon, 
  XIcon, 
  InformationCircleIcon 
} from './icons/Icons';

export interface DerivedFuelMetric extends FuelLog {
  tripDistance: number | null; // delta D
  efficiencyKmL: number | null; // km / L
  consumptionL100km: number | null; // L / 100km
  costPerKm: number | null; // RM / km
  daysInterval: number | null; // days since prev fill
  dailyDistanceKm: number | null; // delta D / days
  effectiveUnitPrice: number; // unit price RM/L
  isAnomaly: boolean; // drop > 15% from baseline
  efficiencyStatus: 'above' | 'normal' | 'anomaly' | 'baseline';
  vehicleName: string;
  plateNumber: string;
  driverName: string;
}

interface FuelAnalyticsDashboardProps {
  onOpenFuelModal?: (log?: FuelLog | null) => void;
}

export const FuelAnalyticsDashboard: React.FC<FuelAnalyticsDashboardProps> = ({ onOpenFuelModal }) => {
  const { fuelLogs, vehicles, users, addFuelLog, updateFuelLog, deleteFuelLog } = useAppContext();

  // Filters State
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('all');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | '30d' | '90d' | 'year' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [tableSearchQuery, setTableSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<keyof DerivedFuelMetric>('date');
  const [sortAsc, setSortAsc] = useState<boolean>(false);

  // Quick CRUD Form State (inline modal)
  const [isQuickFormOpen, setIsQuickFormOpen] = useState(false);
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [formVehicleId, setFormVehicleId] = useState<string>('');
  const [formDriverId, setFormDriverId] = useState<string>('');
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [formOdometer, setFormOdometer] = useState<string>('');
  const [formLiters, setFormLiters] = useState<string>('');
  const [formCost, setFormCost] = useState<string>('');
  const [formUnitPrice, setFormUnitPrice] = useState<string>('2.05');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Trip Cost Estimator State
  const [calcDistance, setCalcDistance] = useState<number>(100);
  const [calcVehicleId, setCalcVehicleId] = useState<string>('all');
  const [calcCustomFuelPrice, setCalcCustomFuelPrice] = useState<number>(2.05);
  const [chartVehicleFilter, setChartVehicleFilter] = useState<string>('all');

  // Hover state for charts
  const [hoveredPoint, setHoveredPoint] = useState<{
    date: string;
    vehicle: string;
    kmL: number;
    consumption: number;
    distance: number;
    isAnomaly: boolean;
    x: number;
    y: number;
  } | null>(null);

  // Vehicle lookup helper
  const getVehicle = useCallback((vId: string) => {
    return vehicles.find(v => v.id === vId) || { name: 'Unknown Vehicle', plateNumber: '-' };
  }, [vehicles]);

  const getDriver = useCallback((dId: string) => {
    return users.find(u => u.id === dId) || { name: 'Unassigned Driver' };
  }, [users]);

  // ---------------------------------------------------------------------------
  // 1 & 2. CHRONOLOGICAL DERIVED METRICS ENGINE
  // ---------------------------------------------------------------------------
  const { allDerivedMetrics, vehicleBaselines, fleetBaselineKmL } = useMemo(() => {
    // 1. Group by vehicle
    const grouped = new Map<string, FuelLog[]>();
    fuelLogs.forEach(log => {
      const vId = log.vehicleId || 'unknown';
      if (!grouped.has(vId)) grouped.set(vId, []);
      grouped.get(vId)!.push(log);
    });

    const metricsList: DerivedFuelMetric[] = [];
    const baselines = new Map<string, number>();

    grouped.forEach((vLogs, vId) => {
      // Sort chronologically ascending by odometer and date
      const sorted = [...vLogs].sort((a, b) => {
        if (a.odometer !== b.odometer) return a.odometer - b.odometer;
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      });

      // Pass 1: compute distances & efficiencies
      const tempMetrics: Omit<DerivedFuelMetric, 'isAnomaly' | 'efficiencyStatus'>[] = [];
      let totalValidDistance = 0;
      let totalValidLiters = 0;

      for (let i = 0; i < sorted.length; i++) {
        const cur = sorted[i];
        const v = getVehicle(cur.vehicleId);
        const d = getDriver(cur.driverId);
        const unitPrice = cur.pricePerLiter > 0 
          ? cur.pricePerLiter 
          : (cur.liters > 0 ? cur.cost / cur.liters : 2.05);

        if (i === 0) {
          // Baseline / first recorded fill for this vehicle
          tempMetrics.push({
            ...cur,
            effectiveUnitPrice: unitPrice,
            tripDistance: null,
            efficiencyKmL: null,
            consumptionL100km: null,
            costPerKm: null,
            daysInterval: null,
            dailyDistanceKm: null,
            vehicleName: v.name,
            plateNumber: v.plateNumber,
            driverName: d.name,
          });
        } else {
          const prev = sorted[i - 1];
          const deltaD = cur.odometer - prev.odometer;

          if (deltaD > 0 && cur.liters > 0) {
            const kmL = deltaD / cur.liters;
            const l100 = (cur.liters / deltaD) * 100;
            const costKm = cur.cost / deltaD;
            
            const prevTime = new Date(prev.date).getTime();
            const curTime = new Date(cur.date).getTime();
            const daysDiff = Math.max(1, Math.round(Math.abs(curTime - prevTime) / (1000 * 60 * 60 * 24)));
            const dailyKm = deltaD / daysDiff;

            totalValidDistance += deltaD;
            totalValidLiters += cur.liters;

            tempMetrics.push({
              ...cur,
              effectiveUnitPrice: unitPrice,
              tripDistance: deltaD,
              efficiencyKmL: kmL,
              consumptionL100km: l100,
              costPerKm: costKm,
              daysInterval: daysDiff,
              dailyDistanceKm: dailyKm,
              vehicleName: v.name,
              plateNumber: v.plateNumber,
              driverName: d.name,
            });
          } else {
            // Non-advancing odometer entry
            tempMetrics.push({
              ...cur,
              effectiveUnitPrice: unitPrice,
              tripDistance: deltaD > 0 ? deltaD : null,
              efficiencyKmL: null,
              consumptionL100km: null,
              costPerKm: null,
              daysInterval: null,
              dailyDistanceKm: null,
              vehicleName: v.name,
              plateNumber: v.plateNumber,
              driverName: d.name,
            });
          }
        }
      }

      // Calculate vehicle average baseline km/L
      const vehAvgKmL = totalValidLiters > 0 && totalValidDistance > 0 
        ? totalValidDistance / totalValidLiters 
        : 12.0;
      baselines.set(vId, vehAvgKmL);

      // Pass 2: Anomaly Detection (>15% degradation from vehicle baseline)
      tempMetrics.forEach(item => {
        if (item.efficiencyKmL === null) {
          metricsList.push({
            ...item,
            isAnomaly: false,
            efficiencyStatus: 'baseline'
          });
        } else {
          const isAnomaly = item.efficiencyKmL < (vehAvgKmL * 0.85);
          const isAbove = item.efficiencyKmL >= vehAvgKmL;
          metricsList.push({
            ...item,
            isAnomaly,
            efficiencyStatus: isAnomaly ? 'anomaly' : (isAbove ? 'above' : 'normal')
          });
        }
      });
    });

    // Compute fleet-wide baseline
    const allDistances = metricsList.reduce((acc, m) => acc + (m.tripDistance || 0), 0);
    const allValidLiters = metricsList.reduce((acc, m) => acc + (m.tripDistance ? m.liters : 0), 0);
    const fleetAvg = allValidLiters > 0 ? allDistances / allValidLiters : 11.8;

    return {
      allDerivedMetrics: metricsList,
      vehicleBaselines: baselines,
      fleetBaselineKmL: fleetAvg
    };
  }, [fuelLogs, getVehicle, getDriver]);

  // ---------------------------------------------------------------------------
  // FILTERING LOGS
  // ---------------------------------------------------------------------------
  const filteredMetrics = useMemo(() => {
    return allDerivedMetrics.filter(item => {
      // Vehicle filter
      if (selectedVehicleId !== 'all' && item.vehicleId !== selectedVehicleId) {
        return false;
      }

      // Date preset filter
      const itemDate = new Date(item.date);
      const now = new Date();
      if (dateRangePreset === '30d') {
        const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (itemDate < past30) return false;
      } else if (dateRangePreset === '90d') {
        const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        if (itemDate < past90) return false;
      } else if (dateRangePreset === 'year') {
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        if (itemDate < startOfYear) return false;
      } else if (dateRangePreset === 'custom') {
        if (customStartDate && new Date(customStartDate) > itemDate) return false;
        if (customEndDate) {
          const end = new Date(customEndDate);
          end.setHours(23, 59, 59, 999);
          if (end < itemDate) return false;
        }
      }

      // Search query (plate, vehicle, driver)
      if (tableSearchQuery.trim()) {
        const q = tableSearchQuery.toLowerCase();
        const matchPlate = item.plateNumber.toLowerCase().includes(q);
        const matchVeh = item.vehicleName.toLowerCase().includes(q);
        const matchDriver = item.driverName.toLowerCase().includes(q);
        const matchOdo = String(item.odometer).includes(q);
        if (!matchPlate && !matchVeh && !matchDriver && !matchOdo) return false;
      }

      return true;
    });
  }, [allDerivedMetrics, selectedVehicleId, dateRangePreset, customStartDate, customEndDate, tableSearchQuery]);

  // ---------------------------------------------------------------------------
  // 3. TOP KPI CARDS (Summary Calculations)
  // ---------------------------------------------------------------------------
  const summaryKPIs = useMemo(() => {
    const totalSpend = filteredMetrics.reduce((sum, m) => sum + m.cost, 0);
    const totalLiters = filteredMetrics.reduce((sum, m) => sum + m.liters, 0);
    const totalDistance = filteredMetrics.reduce((sum, m) => sum + (m.tripDistance || 0), 0);
    
    // Efficiency: based on logs with valid distance and liters
    const validIntervalLiters = filteredMetrics.reduce((sum, m) => sum + (m.tripDistance ? m.liters : 0), 0);
    const avgEfficiencyKmL = validIntervalLiters > 0 && totalDistance > 0 
      ? totalDistance / validIntervalLiters 
      : 0;
    const avgConsumptionL100km = avgEfficiencyKmL > 0 ? (100 / avgEfficiencyKmL) : 0;

    // Running Cost: RM / km
    const avgCostPerKm = totalDistance > 0 ? totalSpend / totalDistance : 0;

    // Daily & Monthly Distance
    const validDailyValues = filteredMetrics
      .map(m => m.dailyDistanceKm)
      .filter((v): v is number => v !== null && v > 0);
    const avgDailyDistance = validDailyValues.length > 0 
      ? validDailyValues.reduce((a, b) => a + b, 0) / validDailyValues.length 
      : (totalDistance > 0 ? totalDistance / 30 : 0);
    const monthlyDistanceProjection = avgDailyDistance * 30;

    const anomalyCount = filteredMetrics.filter(m => m.isAnomaly).length;

    return {
      totalSpend,
      totalLiters,
      totalDistance,
      avgEfficiencyKmL,
      avgConsumptionL100km,
      avgCostPerKm,
      avgDailyDistance,
      monthlyDistanceProjection,
      anomalyCount
    };
  }, [filteredMetrics]);

  // ---------------------------------------------------------------------------
  // 4. CHART 1: FUEL EFFICIENCY TREND DATA & ANOMALIES
  // ---------------------------------------------------------------------------
  // Determine effective vehicle for chart: if scope is specific vehicle, use that; else check chart sub-filter
  const effectiveChartVehicleId = selectedVehicleId !== 'all' ? selectedVehicleId : chartVehicleFilter;

  // Group by vehicle for individual clean polylines
  const chartVehicleSeries = useMemo(() => {
    const validLogs = filteredMetrics.filter(m => m.efficiencyKmL !== null && m.efficiencyKmL > 0);
    const seriesMap = new Map<string, {
      vehicleId: string;
      vehicleName: string;
      plateNumber: string;
      baseline: number;
      points: {
        id: string;
        date: string;
        fullDate: string;
        timestamp: number;
        kmL: number;
        consumption: number;
        distance: number;
        odometer: number;
        vehicle: string;
        isAnomaly: boolean;
      }[];
    }>();

    validLogs.forEach(m => {
      const vId = m.vehicleId || 'unknown';
      // If chart is filtered to a specific vehicle, only include that vehicle
      if (effectiveChartVehicleId !== 'all' && vId !== effectiveChartVehicleId) {
        return;
      }

      if (!seriesMap.has(vId)) {
        seriesMap.set(vId, {
          vehicleId: vId,
          vehicleName: m.vehicleName,
          plateNumber: m.plateNumber,
          baseline: Number((vehicleBaselines.get(vId) || fleetBaselineKmL).toFixed(2)),
          points: []
        });
      }

      seriesMap.get(vId)!.points.push({
        id: m.id,
        date: new Date(m.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
        fullDate: new Date(m.date).toISOString().split('T')[0],
        timestamp: new Date(m.date).getTime(),
        kmL: Number(m.efficiencyKmL!.toFixed(2)),
        consumption: Number(m.consumptionL100km!.toFixed(2)),
        distance: m.tripDistance || 0,
        odometer: m.odometer,
        vehicle: `${m.vehicleName} (${m.plateNumber})`,
        isAnomaly: m.isAnomaly,
      });
    });

    // Sort points in each series chronologically
    seriesMap.forEach(s => {
      s.points.sort((a, b) => a.timestamp - b.timestamp);
    });

    return Array.from(seriesMap.values());
  }, [filteredMetrics, effectiveChartVehicleId, vehicleBaselines, fleetBaselineKmL]);

  // Flattened points for chart scale calculation
  const allChartPoints = useMemo(() => {
    return chartVehicleSeries.flatMap(s => s.points).sort((a, b) => a.timestamp - b.timestamp);
  }, [chartVehicleSeries]);

  // Baseline line to display in Chart 1
  const activeBaseline = useMemo(() => {
    if (effectiveChartVehicleId !== 'all') {
      return Number((vehicleBaselines.get(effectiveChartVehicleId) || fleetBaselineKmL).toFixed(2));
    }
    return Number(fleetBaselineKmL.toFixed(2));
  }, [effectiveChartVehicleId, vehicleBaselines, fleetBaselineKmL]);

  // ---------------------------------------------------------------------------
  // 5. CHART 2: MONTHLY SPEND VS FUEL UNIT PRICE (Combo Chart)
  // ---------------------------------------------------------------------------
  const monthlySpendData = useMemo(() => {
    const monthlyMap = new Map<string, { totalSpend: number; totalLiters: number; count: number }>();

    filteredMetrics.forEach(m => {
      const d = new Date(m.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap.has(key)) {
        monthlyMap.set(key, { totalSpend: 0, totalLiters: 0, count: 0 });
      }
      const cur = monthlyMap.get(key)!;
      cur.totalSpend += m.cost;
      cur.totalLiters += m.liters;
      cur.count += 1;
    });

    // Sort chronologically
    return Array.from(monthlyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([monthKey, val]) => {
        const [y, m] = monthKey.split('-');
        const dateObj = new Date(Number(y), Number(m) - 1, 1);
        const label = dateObj.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
        const avgUnitPrice = val.totalLiters > 0 ? val.totalSpend / val.totalLiters : 2.05;

        return {
          monthKey,
          label,
          totalSpend: Math.round(val.totalSpend),
          totalLiters: Math.round(val.totalLiters),
          avgUnitPrice: Number(avgUnitPrice.toFixed(2)),
          count: val.count
        };
      });
  }, [filteredMetrics]);

  // ---------------------------------------------------------------------------
  // 6. CHART 3: DAY OF WEEK DISTRIBUTION & FREQUENCY
  // ---------------------------------------------------------------------------
  const dayOfWeekDistribution = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    const volumes = [0, 0, 0, 0, 0, 0, 0];

    filteredMetrics.forEach(m => {
      const dayIdx = new Date(m.date).getDay();
      counts[dayIdx] += 1;
      volumes[dayIdx] += m.liters;
    });

    const maxCount = Math.max(...counts, 1);

    // Reorder from Monday to Sunday for business calendar standard
    const orderedIndices = [1, 2, 3, 4, 5, 6, 0];
    return orderedIndices.map(idx => ({
      day: dayNames[idx],
      fullDay: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][idx],
      count: counts[idx],
      volume: Math.round(volumes[idx]),
      percentage: Math.round((counts[idx] / Math.max(1, filteredMetrics.length)) * 100),
      relativeHeight: Math.max(12, Math.round((counts[idx] / maxCount) * 100))
    }));
  }, [filteredMetrics]);

  // ---------------------------------------------------------------------------
  // 7. HEALTH ALERT WIDGET (Engine / Maintenance Early Warnings)
  // ---------------------------------------------------------------------------
  const healthAlerts = useMemo(() => {
    const alerts: {
      vehicleId: string;
      vehicleName: string;
      plateNumber: string;
      consecutiveDrops: number;
      values: number[];
      dropPercentage: number;
    }[] = [];

    // Group all historical logs by vehicle
    const byVeh = new Map<string, DerivedFuelMetric[]>();
    allDerivedMetrics.forEach(m => {
      if (m.efficiencyKmL !== null && m.efficiencyKmL > 0) {
        if (!byVeh.has(m.vehicleId)) byVeh.set(m.vehicleId, []);
        byVeh.get(m.vehicleId)!.push(m);
      }
    });

    byVeh.forEach((vMetrics, vId) => {
      // Sort chronologically ascending
      const sorted = [...vMetrics].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sorted.length < 3) return;

      // Look at the latest 3 fillups
      const last3 = sorted.slice(-3);
      const e0 = last3[0].efficiencyKmL!;
      const e1 = last3[1].efficiencyKmL!;
      const e2 = last3[2].efficiencyKmL!;

      // Check if strictly decreasing: e0 > e1 > e2
      if (e0 > e1 && e1 > e2) {
        const overallDrop = ((e0 - e2) / e0) * 100;
        if (overallDrop >= 10) {
          const v = getVehicle(vId);
          alerts.push({
            vehicleId: vId,
            vehicleName: v.name,
            plateNumber: v.plateNumber,
            consecutiveDrops: 3,
            values: [Number(e0.toFixed(1)), Number(e1.toFixed(1)), Number(e2.toFixed(1))],
            dropPercentage: Math.round(overallDrop)
          });
        }
      }
    });

    return alerts;
  }, [allDerivedMetrics, getVehicle]);

  // ---------------------------------------------------------------------------
  // 8. TRIP COST ESTIMATOR
  // ---------------------------------------------------------------------------
  const tripEstimate = useMemo(() => {
    let eff = summaryKPIs.avgEfficiencyKmL > 0 ? summaryKPIs.avgEfficiencyKmL : 12.0;

    if (calcVehicleId !== 'all') {
      const vehEff = vehicleBaselines.get(calcVehicleId);
      if (vehEff && vehEff > 0) eff = vehEff;
    }

    const litersNeeded = calcDistance > 0 ? calcDistance / eff : 0;
    const estimatedCost = litersNeeded * calcCustomFuelPrice;
    const costPerKm = calcDistance > 0 ? estimatedCost / calcDistance : 0;

    return {
      efficiency: Number(eff.toFixed(2)),
      litersNeeded: Number(litersNeeded.toFixed(2)),
      estimatedCost: Number(estimatedCost.toFixed(2)),
      costPerKm: Number(costPerKm.toFixed(3))
    };
  }, [calcDistance, calcVehicleId, calcCustomFuelPrice, summaryKPIs.avgEfficiencyKmL, vehicleBaselines]);

  // ---------------------------------------------------------------------------
  // 9. SORTED TABLE DATA
  // ---------------------------------------------------------------------------
  const sortedTableData = useMemo(() => {
    return [...filteredMetrics].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === null || aVal === undefined) return sortAsc ? 1 : -1;
      if (bVal === null || bVal === undefined) return sortAsc ? -1 : 1;

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }, [filteredMetrics, sortField, sortAsc]);

  const handleSort = (field: keyof DerivedFuelMetric) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 10. CRUD FORM HELPERS (Validation, 2-way Price Calculation, Prev Odo check)
  // ---------------------------------------------------------------------------
  const latestVehicleOdometer = useMemo(() => {
    if (!formVehicleId) return 0;
    const vLogs = fuelLogs.filter(l => l.vehicleId === formVehicleId);
    if (vLogs.length === 0) return 0;
    return Math.max(...vLogs.map(l => l.odometer));
  }, [formVehicleId, fuelLogs]);

  const handleOpenAddForm = (initialVehicleId?: string) => {
    setEditingLogId(null);
    setFormVehicleId(initialVehicleId || (vehicles[0]?.id || ''));
    setFormDriverId(users.find(u => u.role === 'driver')?.id || users[0]?.id || '');
    setFormDate(new Date().toISOString().split('T')[0]);
    setFormOdometer('');
    setFormLiters('');
    setFormCost('');
    setFormUnitPrice('2.05');
    setFormError(null);
    setIsQuickFormOpen(true);
  };

  const handleOpenEditForm = (item: DerivedFuelMetric) => {
    setEditingLogId(item.id);
    setFormVehicleId(item.vehicleId);
    setFormDriverId(item.driverId);
    setFormDate(new Date(item.date).toISOString().split('T')[0]);
    setFormOdometer(String(item.odometer));
    setFormLiters(String(item.liters));
    setFormCost(String(item.cost));
    setFormUnitPrice(String(item.effectiveUnitPrice || '2.05'));
    setFormError(null);
    setIsQuickFormOpen(true);
  };

  const handleLitersChange = (val: string) => {
    setFormLiters(val);
    const l = parseFloat(val);
    const p = parseFloat(formUnitPrice);
    if (!isNaN(l) && l > 0 && !isNaN(p) && p > 0) {
      setFormCost((l * p).toFixed(2));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setFormUnitPrice(val);
    const p = parseFloat(val);
    const l = parseFloat(formLiters);
    if (!isNaN(p) && p > 0 && !isNaN(l) && l > 0) {
      setFormCost((l * p).toFixed(2));
    }
  };

  const handleCostChange = (val: string) => {
    setFormCost(val);
    const c = parseFloat(val);
    const l = parseFloat(formLiters);
    if (!isNaN(c) && c > 0 && !isNaN(l) && l > 0) {
      setFormUnitPrice((c / l).toFixed(2));
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const odo = parseInt(formOdometer, 10);
    const liters = parseFloat(formLiters);
    const cost = parseFloat(formCost);
    const unitPrice = parseFloat(formUnitPrice) || (liters > 0 ? cost / liters : 2.05);

    if (!formVehicleId) {
      setFormError('Please select a vehicle.');
      return;
    }
    if (!formDate) {
      setFormError('Please choose a valid purchase date.');
      return;
    }
    if (isNaN(odo) || odo <= 0) {
      setFormError('Please enter a valid positive odometer reading.');
      return;
    }
    if (isNaN(liters) || liters <= 0) {
      setFormError('Please enter fuel volume in liters.');
      return;
    }
    if (isNaN(cost) || cost <= 0) {
      setFormError('Please enter total fuel purchase cost.');
      return;
    }

    // Validation: prevent odometer lower than latest vehicle reading (if adding new)
    if (!editingLogId && latestVehicleOdometer > 0 && odo < latestVehicleOdometer) {
      const confirmLow = window.confirm(
        `Warning: The entered odometer (${odo.toLocaleString()} km) is lower than the vehicle's latest recorded odometer (${latestVehicleOdometer.toLocaleString()} km). Do you still want to record this backdated entry?`
      );
      if (!confirmLow) return;
    }

    setIsSaving(true);
    try {
      if (editingLogId) {
        const existing = fuelLogs.find(l => l.id === editingLogId);
        if (existing) {
          await updateFuelLog({
            ...existing,
            vehicleId: formVehicleId,
            driverId: formDriverId,
            date: new Date(formDate).toISOString(),
            odometer: odo,
            liters,
            cost,
            pricePerLiter: unitPrice,
          });
        }
      } else {
        await addFuelLog({
          vehicleId: formVehicleId,
          driverId: formDriverId,
          date: new Date(formDate).toISOString(),
          odometer: odo,
          liters,
          cost,
          pricePerLiter: unitPrice,
        });
      }
      setIsQuickFormOpen(false);
    } catch (err: any) {
      setFormError('Failed to save fuel purchase log: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async (id: string) => {
    if (window.confirm('Are you sure you want to permanently delete this fuel record?')) {
      await deleteFuelLog(id);
    }
  };

  // ---------------------------------------------------------------------------
  // 11. EXPORT TO CSV
  // ---------------------------------------------------------------------------
  const handleExportCSV = () => {
    if (sortedTableData.length === 0) {
      alert('No fuel data available to export.');
      return;
    }

    const headers = [
      'Record ID',
      'Date',
      'Vehicle Name',
      'Plate Number',
      'Driver Name',
      'Odometer Reading (km)',
      'Trip Distance (km)',
      'Volume (Liters)',
      'Unit Price (RM/L)',
      'Total Cost (RM)',
      'Fuel Economy (km/L)',
      'Consumption (L/100km)',
      'Running Cost (RM/km)',
      'Days Interval',
      'Daily Distance (km/day)',
      'Status / Anomaly'
    ];

    const rows = sortedTableData.map(m => [
      `"${m.id}"`,
      `"${new Date(m.date).toISOString().split('T')[0]}"`,
      `"${m.vehicleName}"`,
      `"${m.plateNumber}"`,
      `"${m.driverName}"`,
      `"${m.odometer}"`,
      `"${m.tripDistance ?? ''}"`,
      `"${m.liters.toFixed(2)}"`,
      `"${m.effectiveUnitPrice.toFixed(2)}"`,
      `"${m.cost.toFixed(2)}"`,
      `"${m.efficiencyKmL ? m.efficiencyKmL.toFixed(2) : ''}"`,
      `"${m.consumptionL100km ? m.consumptionL100km.toFixed(2) : ''}"`,
      `"${m.costPerKm ? m.costPerKm.toFixed(3) : ''}"`,
      `"${m.daysInterval ?? ''}"`,
      `"${m.dailyDistanceKm ? m.dailyDistanceKm.toFixed(1) : ''}"`,
      `"${m.isAnomaly ? 'Anomaly (>15% Drop)' : (m.efficiencyStatus === 'above' ? 'Above Baseline' : 'Normal')}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Fuel_Analytics_Export_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // ---------------------------------------------------------------------------
  // RENDER UI
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">

      {/* DASHBOARD HEADER & FILTER BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 text-amber-600 mb-1">
              <FuelIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Fleet Fuel Telematics</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Fuel Analytics & Economy Dashboard
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Automated chronological mileage tracking, anomaly detection, consumption modeling, and expense analytics.
            </p>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center flex-wrap gap-2.5">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
              title="Export complete analytics table as CSV"
            >
              <DocumentDownloadIcon className="h-4 w-4 mr-1.5 text-slate-600" />
              Export CSV
            </button>
            <button
              onClick={() => handleOpenAddForm(selectedVehicleId !== 'all' ? selectedVehicleId : undefined)}
              className="inline-flex items-center px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition transform hover:-translate-y-0.5 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4 mr-1.5" />
              Record Fuel Purchase
            </button>
          </div>
        </div>

        {/* CONTROLS & DATE PRESETS */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Vehicle Selector */}
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-600">Vehicle Scope:</label>
            <select
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 font-bold text-slate-800 text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            >
              <option value="all">All Fleet Vehicles ({vehicles.length})</option>
              {vehicles.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name} ({v.plateNumber})
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Segmented Controls */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
            {(['all', '30d', '90d', 'year', 'custom'] as const).map(preset => (
              <button
                key={preset}
                onClick={() => setDateRangePreset(preset)}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  dateRangePreset === preset
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {preset === 'all' && 'All Time'}
                {preset === '30d' && 'Last 30 Days'}
                {preset === '90d' && 'Last 90 Days'}
                {preset === 'year' && 'This Year'}
                {preset === 'custom' && 'Custom Date'}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers */}
          {dateRangePreset === 'custom' && (
            <div className="flex items-center gap-2 animate-in fade-in duration-150">
              <input
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white"
              />
              <span className="text-slate-400 font-bold">to</span>
              <input
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-1 text-xs text-slate-700 bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* HEALTH ALERT BANNER (If degradation detected) */}
      {healthAlerts.length > 0 ? (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4.5 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-200/70 text-amber-800 rounded-xl shrink-0 mt-0.5">
              <ShieldExclamationIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm uppercase tracking-wide text-amber-900">
                  Maintenance Early Warning: Fuel Efficiency Degradation
                </span>
                <span className="px-2 py-0.5 text-[10px] font-black rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                  {healthAlerts.length} Vehicle{healthAlerts.length > 1 ? 's' : ''} Flagged
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed">
                The telematics engine detected 3 consecutive refueling intervals with declining fuel efficiency (km/L). This pattern is a primary indicator of mechanical drag, clogged air filters, fouled spark plugs, or suboptimal tire pressure.
              </p>
              <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {healthAlerts.map(a => (
                  <div key={a.vehicleId} className="bg-white/90 border border-amber-200 rounded-xl p-2.5 text-xs space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-slate-900">{a.vehicleName}</span>
                      <span className="font-mono font-bold text-slate-600">{a.plateNumber}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-100">
                      <span className="text-slate-500">Economy Sequence:</span>
                      <span className="font-mono font-extrabold text-amber-700">
                        {a.values.join(' → ')} km/L
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-rose-600 font-bold">
                      <span>Total Drop:</span>
                      <span>-{a.dropPercentage}% degradation</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircleIcon className="h-4 w-4 text-emerald-600 shrink-0" />
            <span className="font-bold">Fleet Engine Health Status:</span>
            <span className="text-emerald-700 font-medium">
              No continuous efficiency degradation detected across 3-fill sequences. Powertrains operating within expected baseline margins.
            </span>
          </div>
          <span className="text-[11px] font-mono text-emerald-600 font-semibold hidden md:inline">
            Active Baseline: {activeBaseline} km/L
          </span>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* SECTION A: TOP KPI METRIC CARDS                                       */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        
        {/* KPI 1: Total Fuel Spend */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Fuel Spend</span>
            <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
              <FuelIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            RM {summaryKPIs.totalSpend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <span>{summaryKPIs.totalLiters.toFixed(1)} Liters pumped</span>
            <span aria-hidden="true">·</span>
            <span>{filteredMetrics.length} fills</span>
          </div>
        </div>

        {/* KPI 2: Total Distance Traveled */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Distance</span>
            <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
              <GaugeIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {summaryKPIs.totalDistance.toLocaleString()} <span className="text-sm font-bold text-slate-500">km</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-semibold">
            Chronological odometer delta (ΔD)
          </div>
        </div>

        {/* KPI 3: Average Fuel Efficiency */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Avg Fuel Economy</span>
            <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <TrendingUpIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {summaryKPIs.avgEfficiencyKmL > 0 ? summaryKPIs.avgEfficiencyKmL.toFixed(2) : '-'} <span className="text-sm font-bold text-emerald-600">km/L</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Equivalent to <b className="text-slate-700">{summaryKPIs.avgConsumptionL100km > 0 ? summaryKPIs.avgConsumptionL100km.toFixed(1) : '-'} L/100km</b>
          </div>
        </div>

        {/* KPI 4: Average Running Cost */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Running Cost</span>
            <div className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
              <ChartBarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            RM {summaryKPIs.avgCostPerKm > 0 ? summaryKPIs.avgCostPerKm.toFixed(2) : '0.00'}<span className="text-xs font-semibold text-slate-500">/km</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Fleet average cost per kilometer
          </div>
        </div>

        {/* KPI 5: Average Daily / Monthly Distance */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Daily Mileage</span>
            <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
              <CalendarIcon className="h-4 w-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">
            {Math.round(summaryKPIs.avgDailyDistance)} <span className="text-sm font-bold text-slate-500">km/day</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium">
            Est. ~{Math.round(summaryKPIs.monthlyDistanceProjection).toLocaleString()} km/month
          </div>
        </div>

      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION B: CHARTS & VISUALIZATIONS                                    */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* CHART 1: FUEL EFFICIENCY TREND (LINE CHART WITH ANOMALY MARKERS) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <span>Fuel Efficiency Trend (km/L)</span>
                  {summaryKPIs.anomalyCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-700 border border-rose-200">
                      {summaryKPIs.anomalyCount} Anomaly{summaryKPIs.anomalyCount > 1 ? 's' : ''} Detected
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Chronological fuel efficiency per vehicle with baseline reference and static red anomaly indicators (&gt;15% degradation).
                </p>
              </div>

              {/* Sub-selector / Legend */}
              <div className="flex items-center flex-wrap gap-3 text-[11px] text-slate-600">
                {selectedVehicleId === 'all' && vehicles.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setChartVehicleFilter('all')}
                      className={`px-2 py-0.5 rounded transition ${
                        chartVehicleFilter === 'all' 
                          ? 'bg-white text-slate-900 shadow-xs' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      All
                    </button>
                    {vehicles.slice(0, 3).map(v => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setChartVehicleFilter(v.id)}
                        className={`px-2 py-0.5 rounded transition ${
                          chartVehicleFilter === v.id 
                            ? 'bg-white text-slate-900 shadow-xs' 
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {v.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                    <span>Normal</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-600"></span>
                    <span>Anomaly</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-3 border-b-2 border-dashed border-slate-400"></span>
                    <span>Baseline ({activeBaseline} km/L)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* SVG Responsive Line Chart */}
            <div className="mt-4 relative min-h-[220px]">
              {allChartPoints.length > 1 ? (
                (() => {
                  const width = 640;
                  const height = 200;
                  const padding = { top: 20, right: 30, bottom: 35, left: 40 };

                  const minVal = Math.max(0, Math.min(...allChartPoints.map(d => d.kmL), activeBaseline * 0.7) - 2);
                  const maxVal = Math.max(...allChartPoints.map(d => d.kmL), activeBaseline * 1.3) + 2;
                  const valRange = maxVal - minVal || 1;

                  const chartW = width - padding.left - padding.right;
                  const chartH = height - padding.top - padding.bottom;

                  const minTime = Math.min(...allChartPoints.map(d => d.timestamp));
                  const maxTime = Math.max(...allChartPoints.map(d => d.timestamp));
                  const timeRange = maxTime - minTime || 1;

                  const getXByTime = (ts: number, idx: number, total: number) => {
                    if (timeRange > 0 && maxTime !== minTime) {
                      return padding.left + ((ts - minTime) / timeRange) * chartW;
                    }
                    return padding.left + (idx / Math.max(1, total - 1)) * chartW;
                  };

                  const getY = (val: number) => height - padding.bottom - ((val - minVal) / valRange) * chartH;
                  const baselineY = getY(activeBaseline);

                  const palette = ['#059669', '#2563eb', '#7c3aed', '#d97706', '#db2777'];

                  return (
                    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible select-none">
                      <defs>
                        <linearGradient id="efficiencyAreaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#059669" stopOpacity="0.15" />
                          <stop offset="100%" stopColor="#059669" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Gridlines */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                        const yVal = minVal + pct * valRange;
                        const yPos = getY(yVal);
                        return (
                          <g key={i}>
                            <line 
                              x1={padding.left} 
                              y1={yPos} 
                              x2={width - padding.right} 
                              y2={yPos} 
                              stroke="#f1f5f9" 
                              strokeWidth="1" 
                            />
                            <text 
                              x={padding.left - 6} 
                              y={yPos + 3} 
                              fontSize="9" 
                              fill="#94a3b8" 
                              textAnchor="end"
                              fontFamily="monospace"
                            >
                              {yVal.toFixed(0)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Baseline Dashed Line */}
                      <line
                        x1={padding.left}
                        y1={baselineY}
                        x2={width - padding.right}
                        y2={baselineY}
                        stroke="#94a3b8"
                        strokeWidth="1.5"
                        strokeDasharray="4 4"
                      />
                      <text
                        x={width - padding.right}
                        y={baselineY - 5}
                        fontSize="9"
                        fill="#64748b"
                        textAnchor="end"
                        fontWeight="bold"
                      >
                        Baseline: {activeBaseline} km/L
                      </text>

                      {/* Render Each Vehicle Series Line */}
                      {chartVehicleSeries.map((series, sIdx) => {
                        if (series.points.length === 0) return null;
                        const color = palette[sIdx % palette.length];

                        const pointsPath = series.points
                          .map((d, i) => `${getXByTime(d.timestamp, i, series.points.length)},${getY(d.kmL)}`)
                          .join(' ');

                        return (
                          <g key={series.vehicleId}>
                            {/* Line connecting points for this vehicle */}
                            {series.points.length > 1 && (
                              <polyline
                                fill="none"
                                stroke={color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points={pointsPath}
                              />
                            )}

                            {/* Data Points */}
                            {series.points.map((d, pIdx) => {
                              const cx = getXByTime(d.timestamp, pIdx, series.points.length);
                              const cy = getY(d.kmL);

                              return (
                                <g 
                                  key={d.id} 
                                  className="cursor-pointer"
                                  onMouseEnter={() => setHoveredPoint({
                                    date: d.fullDate,
                                    vehicle: d.vehicle,
                                    kmL: d.kmL,
                                    consumption: d.consumption,
                                    distance: d.distance,
                                    isAnomaly: d.isAnomaly,
                                    x: cx,
                                    y: cy
                                  })}
                                  onMouseLeave={() => setHoveredPoint(null)}
                                >
                                  {/* Static Anomaly Warning Ring (No animation glitches) */}
                                  {d.isAnomaly && (
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r="7.5"
                                      fill="none"
                                      stroke="#f43f5e"
                                      strokeWidth="1.5"
                                    />
                                  )}

                                  <circle
                                    cx={cx}
                                    cy={cy}
                                    r={d.isAnomaly ? '4.5' : '3.5'}
                                    fill={d.isAnomaly ? '#e11d48' : color}
                                    stroke="#ffffff"
                                    strokeWidth="1.5"
                                  />

                                  {/* X-axis date labels */}
                                  {(pIdx === 0 || pIdx === series.points.length - 1 || pIdx % Math.max(1, Math.floor(series.points.length / 5)) === 0) && (
                                    <text
                                      x={cx}
                                      y={height - 12}
                                      fontSize="9"
                                      fill="#64748b"
                                      textAnchor="middle"
                                      fontWeight="500"
                                    >
                                      {d.date}
                                    </text>
                                  )}
                                </g>
                              );
                            })}
                          </g>
                        );
                      })}
                    </svg>
                  );
                })()
              ) : (
                <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-xs">
                  <InformationCircleIcon className="h-6 w-6 mb-1 text-slate-300" />
                  <span>At least 2 consecutive fuel entries are required to plot fuel economy trends.</span>
                </div>
              )}

              {/* Floating Tooltip */}
              {hoveredPoint && (
                <div 
                  className="absolute pointer-events-none z-20 bg-slate-900 text-white rounded-xl px-3 py-2 text-xs shadow-xl border border-slate-700 animate-in fade-in zoom-in-95 duration-100"
                  style={{
                    left: Math.min(Math.max(10, hoveredPoint.x - 70), 500),
                    top: Math.max(0, hoveredPoint.y - 85)
                  }}
                >
                  <div className="flex items-center justify-between gap-2 font-bold text-[10px] text-slate-400 border-b border-slate-800 pb-1 mb-1">
                    <span>{hoveredPoint.date}</span>
                    <span className="truncate max-w-[120px]">{hoveredPoint.vehicle}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Fuel Economy:</span>
                    <span className={`font-mono font-black ${hoveredPoint.isAnomaly ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {hoveredPoint.kmL} km/L
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                    <span>Consumption:</span>
                    <span className="font-mono">{hoveredPoint.consumption} L/100km</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300">
                    <span>Trip Interval:</span>
                    <span className="font-mono">+{hoveredPoint.distance} km</span>
                  </div>
                  {hoveredPoint.isAnomaly && (
                    <div className="mt-1 pt-1 border-t border-rose-900/50 text-[10px] font-bold text-rose-400 flex items-center gap-1">
                      <ExclamationIcon className="h-3 w-3" />
                      <span>Anomaly: &gt;15% below baseline</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* CHART 3: REFUELING FREQUENCY BY DAY OF WEEK */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                <span>Refueling Day Distribution</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Frequency and volume breakdown across days of the week.
              </p>
            </div>

            <div className="mt-4 space-y-2.5">
              {dayOfWeekDistribution.map(item => (
                <div key={item.day} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 w-8">{item.day}</span>
                    <div className="flex-1 mx-3">
                      <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
                        <div 
                          className="bg-amber-500 h-full rounded-full transition-all duration-500"
                          style={{ width: `${item.relativeHeight}%` }}
                        ></div>
                      </div>
                    </div>
                    <span className="font-mono text-slate-800 font-bold text-[11px] w-14 text-right">
                      {item.count} fills
                    </span>
                    <span className="font-mono text-slate-400 text-[10px] w-12 text-right">
                      {item.volume} L
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span>Weekly Operations Trend</span>
            <span className="font-bold text-amber-700">
              Peak: {dayOfWeekDistribution.reduce((prev, curr) => curr.count > prev.count ? curr : prev, dayOfWeekDistribution[0]).fullDay}
            </span>
          </div>
        </div>

      </div>

      {/* CHART 2: COMBO CHART (MONTHLY SPEND VS FUEL UNIT PRICE) */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span>Monthly Fuel Spend vs Unit Price</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Bar chart represents total monthly fuel expenditure (RM), with unit price overlay (RM/Liter).
            </p>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-xs bg-amber-500"></span>
              <span>Total Spend (RM)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 border-b-2 border-indigo-600"></span>
              <span>Unit Price (RM/L)</span>
            </div>
          </div>
        </div>

        {/* Combo Chart Visualization */}
        <div className="mt-5">
          {monthlySpendData.length > 0 ? (
            (() => {
              const maxSpend = Math.max(...monthlySpendData.map(d => d.totalSpend), 500);

              return (
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2 pt-6 items-end min-h-[190px]">
                  {monthlySpendData.map(item => {
                    const barHeightPct = Math.max(10, Math.round((item.totalSpend / maxSpend) * 100));

                    return (
                      <div key={item.monthKey} className="flex flex-col items-center gap-1.5 group">
                        {/* Spend Tooltip Value on Hover */}
                        <div className="text-[10px] font-bold text-slate-700 opacity-80 group-hover:opacity-100 font-mono transition-opacity">
                          RM {item.totalSpend}
                        </div>

                        {/* Bar Container */}
                        <div className="w-full max-w-[42px] bg-slate-100 rounded-t-xl h-36 flex flex-col justify-end p-1 relative overflow-hidden group-hover:bg-slate-200 transition-colors">
                          <div 
                            className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all duration-500 relative"
                            style={{ height: `${barHeightPct}%` }}
                          >
                            {/* Dot overlay representing unit price */}
                            <div 
                              className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-indigo-600 border-2 border-white shadow-xs flex items-center justify-center"
                              title={`Unit Price: RM ${item.avgUnitPrice} / Liter`}
                            >
                              <span className="text-[8px] text-white font-mono font-bold leading-none">
                                •
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Month Label */}
                        <span className="text-[11px] font-bold text-slate-600">
                          {item.label}
                        </span>
                        <span className="text-[9px] font-mono text-indigo-700 font-bold">
                          RM {item.avgUnitPrice}/L
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()
          ) : (
            <div className="py-12 text-center text-xs text-slate-400">
              No monthly fuel transactions recorded in the selected period.
            </div>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION C: TRIP COST ESTIMATOR WIDGET                                 */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 lg:max-w-md">
            <div className="flex items-center space-x-2 text-indigo-300">
              <CalculatorIcon className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-wider">Trip Cost & Fuel Estimator</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              Pre-Trip Route Expense Calculator
            </h3>
            <p className="text-xs text-indigo-200/80 leading-relaxed">
              Plan route budgets in advance. Enter estimated journey distance to project required fuel volume and expected cost based on real vehicle efficiency.
            </p>

            {/* Quick Presets */}
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-indigo-300 font-medium">Quick Presets:</span>
              {[50, 100, 250, 500].map(km => (
                <button
                  key={km}
                  onClick={() => setCalcDistance(km)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                    calcDistance === km 
                      ? 'bg-indigo-500 text-white shadow-xs' 
                      : 'bg-white/10 hover:bg-white/20 text-indigo-200'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Calculator Inputs & Live Output */}
          <div className="bg-white/10 backdrop-blur-md border border-white/15 p-5 rounded-2xl flex-1 max-w-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              {/* Distance Input */}
              <div className="space-y-1">
                <label className="font-bold text-indigo-200 block">Planned Distance (km)</label>
                <input
                  type="number"
                  min="1"
                  max="5000"
                  value={calcDistance}
                  onChange={e => setCalcDistance(Math.max(1, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>

              {/* Target Vehicle */}
              <div className="space-y-1">
                <label className="font-bold text-indigo-200 block">Vehicle Profile</label>
                <select
                  value={calcVehicleId}
                  onChange={e => setCalcVehicleId(e.target.value)}
                  className="w-full bg-slate-800 border border-white/20 rounded-xl px-2.5 py-2 text-white font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <option value="all">Fleet Average ({summaryKPIs.avgEfficiencyKmL > 0 ? summaryKPIs.avgEfficiencyKmL.toFixed(1) : 12} km/L)</option>
                  {vehicles.map(v => {
                    const b = vehicleBaselines.get(v.id);
                    return (
                      <option key={v.id} value={v.id}>
                        {v.name} ({b ? b.toFixed(1) : '-'} km/L)
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Unit Price */}
              <div className="space-y-1">
                <label className="font-bold text-indigo-200 block">Fuel Price (RM/L)</label>
                <input
                  type="number"
                  step="0.01"
                  value={calcCustomFuelPrice}
                  onChange={e => setCalcCustomFuelPrice(parseFloat(e.target.value) || 2.05)}
                  className="w-full bg-white/15 border border-white/20 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
            </div>

            {/* Live Result Cards */}
            <div className="pt-2 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] text-indigo-200 font-bold uppercase block">Fuel Needed</span>
                <span className="text-base sm:text-lg font-black text-amber-300 font-mono">
                  {tripEstimate.litersNeeded} L
                </span>
              </div>
              <div className="bg-white/15 p-2.5 rounded-xl border border-white/20">
                <span className="text-[10px] text-indigo-200 font-bold uppercase block">Estimated Cost</span>
                <span className="text-base sm:text-lg font-black text-emerald-300 font-mono">
                  RM {tripEstimate.estimatedCost}
                </span>
              </div>
              <div className="bg-white/10 p-2.5 rounded-xl">
                <span className="text-[10px] text-indigo-200 font-bold uppercase block">Cost Per KM</span>
                <span className="text-base sm:text-lg font-black text-indigo-100 font-mono">
                  RM {tripEstimate.costPerKm}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION D: DATA TABLE & CRUD (WITH ANOMALY INDICATORS)                */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
              <span>Chronological Fuel Records & Telematics Log</span>
              <span className="text-xs text-slate-500 font-normal">({sortedTableData.length} records)</span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Sorted historical record log with derived distance (ΔD), fuel efficiency (km/L & L/100km), running cost, and anomaly flags.
            </p>
          </div>

          {/* Search Table */}
          <div className="relative w-full sm:w-64">
            <SearchIcon className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={tableSearchQuery}
              onChange={e => setTableSearchQuery(e.target.value)}
              placeholder="Search plate, vehicle, driver..."
              className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 outline-none"
            />
            {tableSearchQuery && (
              <button 
                onClick={() => setTableSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="min-w-full divide-y divide-slate-200 text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th 
                  onClick={() => handleSort('date')}
                  className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Date {sortField === 'date' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('vehicleName')}
                  className="px-3.5 py-3 text-left font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Vehicle {sortField === 'vehicleName' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3.5 py-3 text-left font-bold text-slate-700 whitespace-nowrap">
                  Driver
                </th>
                <th 
                  onClick={() => handleSort('odometer')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Odometer {sortField === 'odometer' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('tripDistance')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Trip ΔD {sortField === 'tripDistance' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('liters')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Volume (L) {sortField === 'liters' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('cost')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Total Cost {sortField === 'cost' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3.5 py-3 text-right font-bold text-slate-700 whitespace-nowrap">
                  Unit Price
                </th>
                <th 
                  onClick={() => handleSort('efficiencyKmL')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Economy (km/L) {sortField === 'efficiencyKmL' && (sortAsc ? '↑' : '↓')}
                </th>
                <th 
                  onClick={() => handleSort('costPerKm')}
                  className="px-3.5 py-3 text-right font-bold text-slate-700 cursor-pointer hover:bg-slate-100 select-none whitespace-nowrap"
                >
                  Cost/km {sortField === 'costPerKm' && (sortAsc ? '↑' : '↓')}
                </th>
                <th className="px-3.5 py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                  Status
                </th>
                <th className="px-3.5 py-3 text-center font-bold text-slate-700 whitespace-nowrap">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {sortedTableData.length > 0 ? (
                sortedTableData.map(log => {
                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3.5 py-2.5 whitespace-nowrap font-medium text-slate-700">
                        {new Date(log.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap">
                        <span className="font-extrabold text-slate-900 block">{log.vehicleName}</span>
                        <span className="font-mono text-[10px] text-slate-500 font-semibold">{log.plateNumber}</span>
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-slate-700">
                        {log.driverName}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono font-bold text-slate-900">
                        {log.odometer.toLocaleString()} km
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono font-extrabold text-indigo-700">
                        {log.tripDistance ? `+${log.tripDistance.toLocaleString()} km` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono text-slate-800">
                        {log.liters.toFixed(2)} L
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono font-bold text-amber-900">
                        RM {log.cost.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono text-slate-500">
                        RM {log.effectiveUnitPrice.toFixed(2)}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono">
                        {log.efficiencyKmL ? (
                          <div className="inline-flex flex-col items-end">
                            <span className="font-extrabold text-slate-900">{log.efficiencyKmL.toFixed(2)} km/L</span>
                            <span className="text-[10px] text-slate-400">({log.consumptionL100km?.toFixed(1)} L/100km)</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Baseline</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-right font-mono text-slate-700">
                        {log.costPerKm ? `RM ${log.costPerKm.toFixed(2)}` : '-'}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        {log.isAnomaly ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200">
                            <ExclamationIcon className="h-3 w-3" />
                            Anomaly
                          </span>
                        ) : log.efficiencyStatus === 'above' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Optimal
                          </span>
                        ) : log.efficiencyStatus === 'normal' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                            Normal
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                            Initial Fill
                          </span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 whitespace-nowrap text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenEditForm(log)}
                            className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            title="Edit fuel log"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteRecord(log.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition cursor-pointer"
                            title="Delete fuel log"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={12} className="text-center py-8 text-slate-400 font-medium">
                    No fuel purchase logs found matching the filter criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* QUICK MODAL / FORM FOR NEW OR EDIT FUEL LOG                           */}
      {/* --------------------------------------------------------------------- */}
      {isQuickFormOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <FuelIcon className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    {editingLogId ? 'Edit Fuel Purchase Record' : 'Record Fuel Purchase'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Live calculation of total price, price per liter, and odometer advance validation.
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsQuickFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
                  <ExclamationIcon className="h-4 w-4 text-rose-500 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Vehicle Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Vehicle <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formVehicleId}
                    onChange={e => setFormVehicleId(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                  >
                    {vehicles.map(v => (
                      <option key={v.id} value={v.id}>
                        {v.name} ({v.plateNumber})
                      </option>
                    ))}
                  </select>
                  {latestVehicleOdometer > 0 && (
                    <span className="text-[10px] text-slate-500 mt-1 block">
                      Latest recorded: <b className="font-mono text-slate-800">{latestVehicleOdometer.toLocaleString()} km</b>
                    </span>
                  )}
                </div>

                {/* Driver */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Driver <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formDriverId}
                    onChange={e => setFormDriverId(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white font-semibold text-slate-800 focus:ring-2 focus:ring-amber-500"
                  >
                    {users.map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    required
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {/* Odometer Reading */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Odometer (km) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formOdometer}
                    onChange={e => setFormOdometer(e.target.value)}
                    required
                    placeholder={latestVehicleOdometer > 0 ? `> ${latestVehicleOdometer}` : 'e.g. 152000'}
                    className="w-full border border-slate-300 rounded-xl p-2.5 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Volume & Cost with Two-way Auto Calculation */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Liters <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formLiters}
                    onChange={e => handleLitersChange(e.target.value)}
                    required
                    placeholder="e.g. 45.2"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Unit Price (RM/L)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formUnitPrice}
                    onChange={e => handleUnitPriceChange(e.target.value)}
                    placeholder="2.05"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-bold bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Total Cost (RM) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formCost}
                    onChange={e => handleCostChange(e.target.value)}
                    required
                    placeholder="e.g. 92.66"
                    className="w-full border border-slate-300 rounded-xl p-2 text-xs font-mono font-extrabold text-amber-900 bg-white focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              {/* Footer Buttons */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsQuickFormOpen(false)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition cursor-pointer disabled:bg-amber-400"
                >
                  {isSaving ? 'Saving...' : (editingLogId ? 'Update Fuel Record' : 'Save Fuel Record')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default FuelAnalyticsDashboard;
