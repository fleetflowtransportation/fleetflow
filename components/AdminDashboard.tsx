import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { parseAsLocal } from '../utils';
import { 
  FuelIcon, 
  GaugeIcon, 
  TruckIcon, 
  CheckCircleIcon, 
  ClockIcon, 
  UserGroupIcon, 
  ExclamationIcon, 
  PlusIcon,
  RouteIcon
} from './icons/Icons';
import BookingForm from './BookingForm';

const AdminDashboard: React.FC = () => {
  const { bookings, users, vehicles, fuelLogs, odometerLogs } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Filter out drivers
  const drivers = useMemo(() => users.filter(u => u.role === 'driver' || u.id === 'driver-aziz'), [users]);

  // Statistics calculation
  const stats = useMemo(() => {
    const active = bookings.filter(b => b.status === 'Pending' || b.status === 'Assigned' || b.status === 'Confirmed').length;
    const completed = bookings.filter(b => b.status === 'Completed').length;
    const conflicts = bookings.filter(b => b.status === 'Conflict').length;
    const totalMileage = odometerLogs.reduce((sum, o) => sum + (o.distance || 0), 0);
    const totalFuelCost = fuelLogs.reduce((sum, f) => sum + f.cost, 0);
    const totalFuelLiters = fuelLogs.reduce((sum, f) => sum + f.liters, 0);

    return { active, completed, conflicts, totalMileage, totalFuelCost, totalFuelLiters };
  }, [bookings, fuelLogs, odometerLogs]);

  // Vehicle Statistics Mapper
  const vehicleStats = useMemo(() => {
    return vehicles.map(v => {
      // Find latest odometer log for this vehicle
      const vOdoLogs = odometerLogs.filter(log => log.vehicleId === v.id);
      const latestOdo = vOdoLogs.length > 0 ? Math.max(...vOdoLogs.map(log => log.odometer)) : 0;
      
      // Calculate total mileage from logs
      const mileage = vOdoLogs.reduce((sum, log) => sum + (log.distance || 0), 0);

      // Calculate fuel cost and liters
      const vFuelLogs = fuelLogs.filter(log => log.vehicleId === v.id);
      const fuelCost = vFuelLogs.reduce((sum, log) => sum + log.cost, 0);
      const fuelLiters = vFuelLogs.reduce((sum, log) => sum + log.liters, 0);

      // Fuel economy: KM / L
      const economy = fuelLiters > 0 && mileage > 0 ? (mileage / fuelLiters).toFixed(1) : null;
      // Cost per KM: RM / KM
      const costPerKm = mileage > 0 && fuelCost > 0 ? (fuelCost / mileage).toFixed(2) : null;

      return {
        ...v,
        latestOdo,
        mileage,
        fuelCost,
        fuelLiters,
        economy,
        costPerKm
      };
    });
  }, [vehicles, odometerLogs, fuelLogs]);

  // Driver workload statistics
  const driverStats = useMemo(() => {
    return drivers.map(d => {
      const dBookings = bookings.filter(b => b.driverId === d.id);
      const completed = dBookings.filter(b => b.status === 'Completed').length;
      const assigned = dBookings.filter(b => b.status === 'Assigned' || b.status === 'Confirmed').length;
      
      const dOdoLogs = odometerLogs.filter(log => log.driverId === d.id);
      const mileage = dOdoLogs.reduce((sum, log) => sum + (log.distance || 0), 0);

      return {
        ...d,
        completed,
        assigned,
        mileage
      };
    });
  }, [drivers, bookings, odometerLogs]);

  const recentOdoLogs = useMemo(() => {
    return odometerLogs.slice(0, 5);
  }, [odometerLogs]);

  const recentFuelLogs = useMemo(() => {
    return fuelLogs.slice(0, 5);
  }, [fuelLogs]);

  const handleCreateBooking = () => {
    setIsFormOpen(true);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Fleet Flow Analytics</h2>
          <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">Performance Monitoring, Fuel Consumption & Fleet Odometer Tracking</p>
        </div>
        <button
          onClick={handleCreateBooking}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition duration-200 cursor-pointer"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Booking
        </button>
      </div>

      {/* CONFLICT WARNING BANNER */}
      {stats.conflicts > 0 && (
        <div className="p-4 bg-rose-50 border-2 border-rose-100 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center space-x-3">
            <span className="text-2xl flex-shrink-0">⚠️</span>
            <div>
              <p className="font-extrabold text-rose-900">Attention: {stats.conflicts} Bookings with CONFLICT status</p>
              <p className="text-xs text-rose-700 font-medium">Driver schedule or rest period conflicts require manual resolution.</p>
            </div>
          </div>
          <p className="text-xs font-bold text-rose-800 bg-rose-100/60 px-3 py-1.5 rounded-xl border border-rose-200">
            Check via "Calendar" view
          </p>
        </div>
      )}

      {/* HERO STATS KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <ClockIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Active Trips</p>
            <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.active} <span className="text-xs font-medium text-gray-400">trips</span></h4>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <CheckCircleIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Completed Trips</p>
            <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.completed} <span className="text-xs font-medium text-gray-400">trips</span></h4>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <GaugeIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Total Mileage</p>
            <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">{stats.totalMileage.toLocaleString()} <span className="text-xs font-medium text-gray-400">km</span></h4>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center space-x-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <FuelIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Fuel Expense</p>
            <h4 className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-0.5">RM {stats.totalFuelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h4>
          </div>
        </div>

      </div>

      {/* VEHICLE FLEET ANALYTICS TABLE */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h3 className="font-extrabold text-gray-800 text-sm sm:text-base flex items-center">
            <TruckIcon className="h-5 w-5 mr-2 text-indigo-600" />
            Vehicle Performance & Utilization
          </h3>
          <span className="text-xs font-semibold text-gray-400">Odometer & Fuel Analysis</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-400 uppercase font-bold tracking-wider">
              <tr>
                <th className="py-3 px-5">Vehicle Name</th>
                <th className="py-3 px-4">Plate Number</th>
                <th className="py-3 px-4 text-right">Current Odometer</th>
                <th className="py-3 px-4 text-right">Total Distance (KM)</th>
                <th className="py-3 px-4 text-right">Fuel (L)</th>
                <th className="py-3 px-4 text-right">Total Cost</th>
                <th className="py-3 px-4 text-right text-indigo-600 font-bold">Efficiency (KM/L)</th>
                <th className="py-3 px-4 text-right text-indigo-600 font-bold">Cost / KM (RM)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-150 text-gray-700">
              {vehicleStats.map(v => (
                <tr key={v.id} className="hover:bg-gray-50/60 transition">
                  <td className="py-3.5 px-5 font-bold text-gray-900">{v.name}</td>
                  <td className="py-3.5 px-4"><span className="bg-gray-100 text-gray-800 font-mono text-xs font-bold px-2.5 py-1 rounded-md border">{v.plateNumber}</span></td>
                  <td className="py-3.5 px-4 text-right font-semibold">{v.latestOdo > 0 ? `${v.latestOdo.toLocaleString()} km` : 'No Record'}</td>
                  <td className="py-3.5 px-4 text-right font-medium text-blue-600">{v.mileage.toLocaleString()} km</td>
                  <td className="py-3.5 px-4 text-right">{v.fuelLiters > 0 ? `${v.fuelLiters.toLocaleString()} L` : '0 L'}</td>
                  <td className="py-3.5 px-4 text-right font-semibold">RM {v.fuelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-emerald-600">
                    {v.economy ? `${v.economy} km/L` : <span className="text-gray-300 font-medium text-xs">Insufficient Data</span>}
                  </td>
                  <td className="py-3.5 px-4 text-right font-bold text-indigo-600">
                    {v.costPerKm ? `RM ${v.costPerKm}/km` : <span className="text-gray-300 font-medium text-xs">Insufficient Data</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* DRIVER ACTIVITY & WORKLOAD METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* DRIVERS SUMMARY */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/50">
            <UserGroupIcon className="h-5 w-5 mr-2 text-indigo-600" />
            <h3 className="font-extrabold text-gray-800 text-sm">Driver Performance & Tasks</h3>
          </div>
          <div className="p-4 flex-grow divide-y divide-gray-100">
            {driverStats.map(d => (
              <div key={d.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900">{d.name}</p>
                  <p className="text-xs text-gray-400 font-semibold uppercase">{d.phone || 'No Phone Number'}</p>
                </div>
                <div className="text-right space-y-1">
                  <div className="flex items-center space-x-1 justify-end">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full">{d.completed} Completed</span>
                    {d.assigned > 0 && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">{d.assigned} Active</span>
                    )}
                  </div>
                  <p className="text-xs font-bold text-gray-500">Total Distance: <strong className="text-gray-800">{d.mileage.toLocaleString()} km</strong></p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RECENT ACTIVITY FEEDS (ODOMETER + FUEL LOGS) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-gray-100 flex items-center bg-gray-50/50 justify-between">
            <span className="flex items-center font-extrabold text-gray-800 text-sm">
              <RouteIcon className="h-5 w-5 mr-2 text-indigo-600" />
              Recent Driver Logs (Live Feed)
            </span>
          </div>
          <div className="p-4 flex-grow overflow-y-auto max-h-[320px] space-y-3.5">
            
            {/* ODOMETER RECENT FEED */}
            {recentOdoLogs.length > 0 ? (
              recentOdoLogs.map((log) => {
                const driverName = users.find(u => u.id === log.driverId)?.name || 'Driver';
                const vehicleName = vehicles.find(v => v.id === log.vehicleId)?.name || 'Van';

                return (
                  <div key={log.id} className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-50 flex items-start justify-between text-xs">
                    <div className="space-y-1">
                      <p className="font-bold text-indigo-950 flex items-center">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 mr-2"></span>
                        {driverName} ({vehicleName})
                      </p>
                      <p className="text-gray-600 font-medium">Route: <strong className="text-gray-800">{log.fromLocation} → {log.toLocation}</strong></p>
                      <p className="text-gray-500 font-semibold">Purpose: {log.purpose}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className="block font-extrabold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-lg text-[11px]">+{log.distance} KM</span>
                      <span className="block text-[10px] text-gray-400 mt-1 font-medium">Odo: {log.odometer.toLocaleString()} km</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-400 text-xs font-semibold">No trip records submitted yet.</div>
            )}

            {/* FUEL LOG RECENT FEED */}
            {recentFuelLogs.length > 0 && (
              <div className="pt-2 border-t border-dashed">
                <span className="block text-[10px] uppercase font-extrabold text-gray-400 tracking-wider mb-2">Recent Fuel Receipts</span>
                <div className="space-y-2">
                  {recentFuelLogs.map(log => {
                    const driverName = users.find(u => u.id === log.driverId)?.name || 'Driver';
                    const vehicleName = vehicles.find(v => v.id === log.vehicleId)?.name || 'Van';

                    return (
                      <div key={log.id} className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-50 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-amber-950">{driverName} ({vehicleName})</p>
                          <p className="text-gray-500 font-semibold">{log.liters} Liters @ RM {log.pricePerLiter}/L</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg text-[11px]">RM {log.cost.toFixed(2)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>

      <BookingForm 
        isOpen={isFormOpen} 
        onClose={() => setIsFormOpen(false)} 
      />

    </div>
  );
};

export default AdminDashboard;
