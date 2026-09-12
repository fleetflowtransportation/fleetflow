
import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import VehicleForm from './VehicleForm';
import { PlusIcon, EditIcon, TrashIcon, TruckIcon, GaugeIcon, XIcon, UserCircleIcon, PrinterIcon, DocumentDownloadIcon, RouteIcon, ExclamationIcon, XCircleIcon, SearchIcon } from './icons/Icons';
import type { Vehicle, OdometerLog, Booking } from '../types';
import OdometerLogEditForm from './OdometerLogEditForm';

declare global {
  interface Window {
    jspdf: any;
  }
}

// Odometer History Modal Component (Unchanged)
interface OdometerHistoryModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

const OdometerHistoryModal: React.FC<OdometerHistoryModalProps> = ({ vehicle, onClose }) => {
  const { odometerLogs, users, deleteOdometerLog } = useAppContext();
  const [isEditFormOpen, setIsEditFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<OdometerLog | null>(null);

  const vehicleLogs = useMemo(() => {
    if (!vehicle) return [];
    return odometerLogs
      .filter(log => log.vehicleId === vehicle.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [odometerLogs, vehicle]);

  const getDriverName = (driverId: string) => {
    return users.find(u => u.id === driverId)?.name || 'Unknown';
  };
  
  const handleEdit = (log: OdometerLog) => {
    setEditingLog(log);
    setIsEditFormOpen(true);
  };

  const handleDelete = (logId: string) => {
      if(window.confirm('Are you sure you want to permanently delete this odometer log?')) {
          deleteOdometerLog(logId);
      }
  };

  const handlePrint = () => {
    const node = document.getElementById('odometer-history-printable');
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

  const handleExportPdf = () => {
    if (!vehicle || vehicleLogs.length === 0) {
      alert('No data to export.');
      return;
    };
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.text(`Odometer History for ${vehicle.name} (${vehicle.plateNumber})`, 14, 16);
    
    const tableColumn = ["Date", "Driver", "From", "To", "Start (km)", "End (km)", "Distance (km)", "Purpose"];
    const tableRows: (string | number)[][] = [];

    vehicleLogs.forEach(log => {
        const logData = [
            new Date(log.date).toLocaleDateString('en-GB'),
            getDriverName(log.driverId),
            log.fromLocation || '-',
            log.toLocation || '-',
            log.startOdometer !== undefined ? log.startOdometer.toLocaleString() : '-',
            log.odometer.toLocaleString(),
            log.distance !== undefined ? log.distance.toLocaleString() : '-',
            log.purpose || '-',
        ];
        tableRows.push(logData);
    });

    doc.autoTable({
        head: [tableColumn],
        body: tableRows,
        startY: 25,
    });
    doc.save(`odometer_history_${vehicle.plateNumber}.pdf`);
  };


  if (!vehicle) return null;

  return (
    <>
      <OdometerLogEditForm 
        isOpen={isEditFormOpen}
        onClose={() => setIsEditFormOpen(false)}
        logToEdit={editingLog}
      />
      <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-bold text-gray-800">Odometer History for {vehicle.name}</h2>
            <div className="flex items-center space-x-2">
                <button onClick={handlePrint} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><PrinterIcon className="h-4 w-4 mr-1.5"/> Print</button>
                <button onClick={handleExportPdf} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> Export PDF</button>
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
            </div>
          </div>
          <div className="p-6 overflow-y-auto" id="odometer-history-printable">
            {vehicleLogs.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From → To</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Start (km)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">End (km)</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance (km)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Purpose</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {vehicleLogs.map(log => (
                    <tr key={log.id}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{new Date(log.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">
                          <div className="flex items-center">
                              <UserCircleIcon className="h-5 w-5 mr-2 text-gray-400" />
                              {getDriverName(log.driverId)}
                          </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{log.fromLocation || '-'} → {log.toLocation || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 text-right">{log.startOdometer !== undefined ? log.startOdometer.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{log.odometer.toLocaleString()}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-700 font-semibold text-right">{log.distance !== undefined ? log.distance.toLocaleString() : '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-pre-wrap">{log.purpose || '-'}</td>
                      <td className="px-4 py-3 whitespace-nowrap text-right text-sm">
                          <button onClick={() => handleEdit(log)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit Log"><EditIcon className="h-5 w-5" /></button>
                          <button onClick={() => handleDelete(log.id)} className="text-red-600 hover:text-red-800 ml-1 p-1.5 rounded-full hover:bg-red-100 transition" title="Delete Log"><TrashIcon className="h-5 w-5"/></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500">No odometer readings have been logged for this vehicle.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

// Stat Card component for the dashboard
const StatCard: React.FC<{ icon: React.ReactNode, title: string, value: number, color: string }> = ({ icon, title, value, color }) => (
  <div className="bg-white p-4 rounded-lg shadow-md flex items-center">
    <div className={`p-3 rounded-full ${color}`}>
      {icon}
    </div>
    <div className="ml-4">
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  </div>
);


const VehicleManagement: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [viewingLogsFor, setViewingLogsFor] = useState<Vehicle | null>(null);
  const { vehicles, deleteVehicle, odometerLogs, bookings, issueLogs } = useAppContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const latestOdometerReadings = useMemo(() => {
    const readings = new Map<string, number>();
    vehicles.forEach(vehicle => {
      const vehicleLogs = odometerLogs
        .filter(log => log.vehicleId === vehicle.id)
        .sort((a, b) => b.odometer - a.odometer);
      if (vehicleLogs.length > 0) {
        readings.set(vehicle.id, vehicleLogs[0].odometer);
      }
    });
    return readings;
  }, [vehicles, odometerLogs]);

  const vehicleStatuses = useMemo(() => {
    const statuses = new Map<string, {
        onTrip: Booking | null;
        hasIssues: boolean;
        isOutOfService: boolean;
        statusLabel: 'Available' | 'On Trip' | 'With Issues' | 'Out of Service';
    }>();

    const activeBookings = bookings.filter(b => b.status === 'Assigned');
    const openIssues = issueLogs.filter(i => i.status === 'Open' || i.status === 'In Progress');

    vehicles.forEach(vehicle => {
        const assignedBooking = activeBookings.find(b => b.vehicleId === vehicle.id) || null;
        const vehicleIssues = openIssues.filter(i => i.vehicleId === vehicle.id);
        const isOutOfService = vehicleIssues.some(i => i.isVehicleOutOfService);
        const hasIssues = vehicleIssues.length > 0;

        let statusLabel: 'Available' | 'On Trip' | 'With Issues' | 'Out of Service' = 'Available';
        if (isOutOfService) {
            statusLabel = 'Out of Service';
        } else if (assignedBooking) {
            statusLabel = 'On Trip';
        } else if (hasIssues) {
            statusLabel = 'With Issues';
        }

        statuses.set(vehicle.id, {
            onTrip: assignedBooking,
            hasIssues,
            isOutOfService,
            statusLabel
        });
    });

    return statuses;
  }, [vehicles, bookings, issueLogs]);

  const dashboardStats = useMemo(() => {
    let onTripCount = 0;
    let withIssuesCount = 0;
    let outOfServiceCount = 0;

    for (const status of vehicleStatuses.values()) {
        if (status.onTrip) onTripCount++;
        if (status.hasIssues) withIssuesCount++;
        if (status.isOutOfService) outOfServiceCount++;
    }

    return {
        total: vehicles.length,
        onTrip: onTripCount,
        withIssues: withIssuesCount,
        outOfService: outOfServiceCount
    };
  }, [vehicles.length, vehicleStatuses]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter(vehicle => {
        // Search filter
        const searchLower = searchQuery.toLowerCase();
        const searchMatch = (vehicle.name || '').toLowerCase().includes(searchLower) || (vehicle.plateNumber || '').toLowerCase().includes(searchLower);

        if (!searchMatch) return false;

        // Status filter
        const status = vehicleStatuses.get(vehicle.id);
        if (statusFilter === 'all' || !status) return true;
        
        if (statusFilter === 'available') return status.statusLabel === 'Available';
        if (statusFilter === 'on_trip') return !!status.onTrip;
        if (statusFilter === 'with_issues') return status.hasIssues;
        if (statusFilter === 'out_of_service') return status.isOutOfService;

        return true;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [vehicles, searchQuery, statusFilter, vehicleStatuses]);

  const handleCreateVehicle = () => {
    setEditingVehicle(null);
    setIsFormOpen(true);
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setIsFormOpen(true);
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (window.confirm('Are you sure you want to delete this vehicle? This might affect historical data.')) {
      deleteVehicle(vehicleId);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingVehicle(null);
  };

  const handleViewLogs = (vehicle: Vehicle) => {
    setViewingLogsFor(vehicle);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">Vehicle Fleet</h2>
        <button
          onClick={handleCreateVehicle}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition duration-300 ease-in-out transform hover:scale-105"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add Vehicle
        </button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon={<TruckIcon className="h-6 w-6 text-indigo-800" />} title="Total Vehicles" value={dashboardStats.total} color="bg-indigo-100" />
          <StatCard icon={<RouteIcon className="h-6 w-6 text-blue-800" />} title="On Active Trips" value={dashboardStats.onTrip} color="bg-blue-100" />
          <StatCard icon={<ExclamationIcon className="h-6 w-6 text-yellow-800" />} title="With Open Issues" value={dashboardStats.withIssues} color="bg-yellow-100" />
          <StatCard icon={<XCircleIcon className="h-6 w-6 text-red-800" />} title="Out of Service" value={dashboardStats.outOfService} color="bg-red-100" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                  type="search"
                  placeholder="Search by name or plate number..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
              />
          </div>
          <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
          >
              <option value="all">All Statuses</option>
              <option value="available">Available</option>
              <option value="on_trip">On Trip</option>
              <option value="with_issues">With Issues</option>
              <option value="out_of_service">Out of Service</option>
          </select>
      </div>

      <VehicleForm 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        vehicleToEdit={editingVehicle} 
      />
      <OdometerHistoryModal 
        vehicle={viewingLogsFor}
        onClose={() => setViewingLogsFor(null)}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredVehicles.length > 0 ? (
          filteredVehicles.map((vehicle) => {
            const status = vehicleStatuses.get(vehicle.id);
            const latestOdo = latestOdometerReadings.get(vehicle.id);
            return (
              <div key={vehicle.id} className="bg-white rounded-lg shadow-md overflow-hidden flex flex-col transition-shadow hover:shadow-xl">
                <div className="p-5 flex-grow">
                  <div className="flex items-start gap-4">
                    {vehicle.photoUrl ? (
                      <img src={vehicle.photoUrl} alt={vehicle.name} className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <TruckIcon className="h-8 w-8 text-gray-400"/>
                      </div>
                    )}
                    <div className="flex-grow">
                      <p className="text-lg font-bold text-gray-900">{vehicle.name}</p>
                      <p className="text-sm text-gray-500 font-mono">{vehicle.plateNumber}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {status?.statusLabel === 'On Trip' && <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-1 rounded-full">On Trip</span>}
                        {status?.hasIssues && !status.isOutOfService && <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Has Issue</span>}
                        {status?.isOutOfService && <span className="text-xs font-semibold bg-red-100 text-red-800 px-2 py-1 rounded-full">Out of Service</span>}
                        {status?.statusLabel === 'Available' && <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded-full">Available</span>}
                      </div>
                    </div>
                  </div>
                  {status?.onTrip && (
                      <div className="mt-4 p-3 bg-blue-50 border-l-4 border-blue-400 text-sm">
                          <p className="font-semibold text-blue-800">Current Trip</p>
                          <p className="text-blue-700">To: {status.onTrip.destination}</p>
                      </div>
                  )}
                  <div 
                      onClick={() => handleViewLogs(vehicle)} 
                      className="mt-4 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors"
                  >
                      <div className="flex justify-between items-center">
                          <div>
                              <p className="text-xs text-gray-500">Latest Odometer</p>
                              <p className="text-lg font-semibold text-gray-800">{latestOdo ? `${latestOdo.toLocaleString()} km` : 'N/A'}</p>
                          </div>
                          <GaugeIcon className="h-6 w-6 text-gray-400" />
                      </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-5 py-3 flex justify-end items-center gap-2 border-t">
                  <button onClick={(e) => { e.stopPropagation(); handleEditVehicle(vehicle); }} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit Vehicle"><EditIcon className="h-5 w-5" /></button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteVehicle(vehicle.id); }} className="text-red-600 hover:text-red-800 p-1.5 rounded-full hover:bg-red-100 transition" title="Delete Vehicle"><TrashIcon className="h-5 w-5"/></button>
                </div>
              </div>
            )
          })
        ) : (
          <div className="col-span-1 md:col-span-2 xl:col-span-3 text-center py-12">
            <p className="text-gray-500">{vehicles.length > 0 ? "No vehicles match the current filters." : "No vehicles found."}</p>
            {vehicles.length === 0 && <p className="text-gray-400 text-sm mt-1">Add a new vehicle to get started.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleManagement;
