import React from 'react';
import type { User, Vehicle, Booking } from '../types';

interface FilterControlsProps {
  filters: {
    status: string;
    driverId: string;
    vehicleId: string;
    dateFilter: string;
    // FIX: Made startDate and endDate required to match parent component state.
    startDate: string;
    endDate: string;
  };
  onFilterChange: (filters: FilterControlsProps['filters']) => void;
  drivers: User[];
  vehicles: Vehicle[];
  statuses: Booking['status'][];
}

const dateFilters = [
  { key: 'all', label: 'All Time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range...' },
];

const FilterControls: React.FC<FilterControlsProps> = ({
  filters,
  onFilterChange,
  drivers,
  vehicles,
  statuses,
}) => {
  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    const newFilters = { ...filters, [name]: value };
    
    // If changing from custom, clear start/end dates.
    if (name === 'dateFilter' && value !== 'custom') {
        newFilters.startDate = '';
        newFilters.endDate = '';
    }

    onFilterChange(newFilters);
  };
  
  const clearFilters = () => {
    onFilterChange({ status: '', driverId: '', vehicleId: '', dateFilter: 'all', startDate: '', endDate: '' });
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700">Status</label>
          <select
            id="status-filter"
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="driver-filter" className="block text-sm font-medium text-gray-700">Driver</label>
          <select
            id="driver-filter"
            name="driverId"
            value={filters.driverId}
            onChange={handleFilterChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">All Drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="vehicle-filter" className="block text-sm font-medium text-gray-700">Vehicle</label>
          <select
            id="vehicle-filter"
            name="vehicleId"
            value={filters.vehicleId}
            onChange={handleFilterChange}
            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
          >
            <option value="">All Vehicles</option>
            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
          </select>
        </div>
        <div className="self-end">
          <button 
            onClick={clearFilters}
            className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Clear Filters
          </button>
        </div>
      </div>
       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div>
              <label htmlFor="date-filter" className="block text-sm font-medium text-gray-700">Date Range</label>
              <select
                id="date-filter"
                name="dateFilter"
                value={filters.dateFilter}
                onChange={handleFilterChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              >
                  {dateFilters.map(({ key, label }) => (
                      <option key={key} value={key}>{label}</option>
                  ))}
              </select>
            </div>
            {filters.dateFilter === 'custom' && (
              <>
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium text-gray-700">Start Date</label>
                  <input
                    type="date"
                    id="start-date"
                    name="startDate"
                    value={filters.startDate || ''}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium text-gray-700">End Date</label>
                  <input
                    type="date"
                    id="end-date"
                    name="endDate"
                    value={filters.endDate || ''}
                    onChange={handleFilterChange}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"
                  />
                </div>
              </>
            )}
        </div>
    </div>
  );
};

export default FilterControls;