import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Booking, FuelLog, User, Vehicle, OdometerLog } from '../types';
import { PaperClipIcon, EditIcon, TrashIcon, XIcon, TruckIcon, RouteIcon, FuelIcon, PrinterIcon, DocumentDownloadIcon } from './icons/Icons';

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

// --- Fuel Log Edit Form Component ---
interface FuelLogEditFormProps {
  isOpen: boolean;
  onClose: () => void;
  logToEdit: FuelLog | null;
}

const emptyFormData = {
  vehicleId: '',
  date: '',
  odometer: 0,
  liters: 0,
  cost: 0,
  pricePerLiter: 0,
};

type FormData = typeof emptyFormData;

const FuelLogEditForm: React.FC<FuelLogEditFormProps> = ({ isOpen, onClose, logToEdit }) => {
  const { vehicles, updateFuelLog } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [existingReceipt, setExistingReceipt] = useState<{ name: string; url: string } | null>(null);
  
  const resetForm = useCallback(() => {
    setFormData(emptyFormData);
    setReceiptFile(null);
    setExistingReceipt(null);
  }, []);

  useEffect(() => {
    if (isOpen && logToEdit) {
      setFormData({
        vehicleId: logToEdit.vehicleId,
        date: logToEdit.date.split('T')[0],
        odometer: logToEdit.odometer,
        liters: logToEdit.liters,
        cost: logToEdit.cost,
        pricePerLiter: logToEdit.pricePerLiter,
      });
      if (logToEdit.receiptAttachmentName && logToEdit.receiptAttachmentUrl) {
        setExistingReceipt({ name: logToEdit.receiptAttachmentName, url: logToEdit.receiptAttachmentUrl });
      } else {
        setExistingReceipt(null);
      }
      setReceiptFile(null);
    } else if (!isOpen) {
      resetForm();
    }
  }, [isOpen, logToEdit, resetForm]);


  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: name === 'vehicleId' ? value : Number(value) || value }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        setReceiptFile(e.target.files[0]);
        setExistingReceipt(null);
    }
  };
  
  const removeReceipt = () => {
    setReceiptFile(null);
    setExistingReceipt(null);
    const fileInput = document.getElementById('receipt-edit-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!logToEdit) return;

    const processedData: Partial<FuelLog> = {
        ...formData,
        odometer: Number(formData.odometer),
        liters: Number(formData.liters),
        cost: Number(formData.cost),
        pricePerLiter: Number(formData.pricePerLiter),
    };

    if (receiptFile) {
        if (logToEdit.receiptAttachmentUrl) URL.revokeObjectURL(logToEdit.receiptAttachmentUrl);
        processedData.receiptAttachmentName = receiptFile.name;
        processedData.receiptAttachmentUrl = URL.createObjectURL(receiptFile);
    } else if (existingReceipt) {
        processedData.receiptAttachmentName = existingReceipt.name;
        processedData.receiptAttachmentUrl = existingReceipt.url;
    } else {
        if (logToEdit.receiptAttachmentUrl) URL.revokeObjectURL(logToEdit.receiptAttachmentUrl);
        processedData.receiptAttachmentName = undefined;
        processedData.receiptAttachmentUrl = undefined;
    }

    updateFuelLog(logToEdit.id, processedData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">Edit Fuel Log</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Vehicle</label>
            <select name="vehicleId" value={formData.vehicleId} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
              <option value="">Select Vehicle</option>
              {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Date</label>
            <input type="date" name="date" value={formData.date} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Odometer (km)</label>
            <input type="number" name="odometer" value={formData.odometer} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 123456" />
          </div>
          <div className="grid grid-cols-2 gap-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700">Price / Liter (RM)</label>
                  <input type="number" step="0.01" name="pricePerLiter" value={formData.pricePerLiter} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 1.50"/>
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700">Liters</label>
                  <input type="number" step="0.01" name="liters" value={formData.liters} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 40.5"/>
              </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-gray-700">Total Cost (RM)</label>
              <input type="number" step="0.01" name="cost" value={formData.cost} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder="e.g. 60.75" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Receipt (Optional)</label>
            {!receiptFile && !existingReceipt ? (
                <div className="mt-1">
                    <input id="receipt-edit-input" type="file" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"/>
                </div>
            ) : (
                <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-md bg-gray-50">
                    <div className="flex items-center space-x-2 truncate">
                        <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                        <span className="text-sm text-gray-700 truncate">{receiptFile?.name || existingReceipt?.name}</span>
                    </div>
                    <button type="button" onClick={removeReceipt} className="text-sm font-medium text-red-600 hover:text-red-800 ml-2">Remove</button>
                </div>
            )}
          </div>
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
};

const dateFilters = [
  { key: 'all', label: 'All Time' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'custom', label: 'Custom Range...' },
];

const Reports: React.FC = () => {
  const { bookings, fuelLogs, users, vehicles, deleteFuelLog, odometerLogs } = useAppContext();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<FuelLog | null>(null);
  const [fuelLogFilters, setFuelLogFilters] = useState({ 
      vehicleId: '', 
      driverId: '', 
      dateFilter: 'all',
      startDate: '',
      endDate: ''
  });
  const [tripFilters, setTripFilters] = useState({ 
      vehicleId: '', 
      driverId: '', 
      dateFilter: 'all',
      startDate: '',
      endDate: ''
  });

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);


  const getDriverName = (driverId: string | null) => users.find(d => d.id === driverId)?.name || 'Unknown';
  
  const handleEditLog = (log: FuelLog) => {
    setEditingLog(log);
    setIsFormOpen(true);
  };

  const handleDeleteLog = (logId: string) => {
    if (window.confirm('Are you sure you want to delete this fuel log? This action cannot be undone.')) {
      deleteFuelLog(logId);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingLog(null);
  };
  
  const handleFilterChange = (setter: React.Dispatch<React.SetStateAction<any>>) => (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setter((prevFilters: any) => {
        const newFilters = { ...prevFilters, [name]: value };
        if (name === 'dateFilter' && value !== 'custom') {
            newFilters.startDate = '';
            newFilters.endDate = '';
        }
        return newFilters;
    });
  };
  
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

  const exportDetailedTripReportPdf = (data: Booking[], vehicles: Vehicle[], users: User[]) => {
    if (data.length === 0) {
      alert("No data to export.");
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
        const bookingData = [
            new Date(booking.dateTime).toLocaleDateString('en-GB'),
            vehicle?.plateNumber || 'N/A',
            driver?.name || 'N/A',
            booking.destination,
            booking.purpose,
        ];
        tableRows.push(bookingData);
    });

    doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
    doc.save(`trip_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportDetailedFuelReportPdf = (data: FuelLogWithMetrics[], vehicles: Vehicle[], users: User[]) => {
      if (data.length === 0) {
        alert("No data to export.");
        return;
      }
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF("landscape");
      doc.text("Detailed Fuel Log & Economy Analysis", 14, 16);

      const tableColumn = ["Vehicle", "Driver", "Date", "Odometer", "Distance", "Liters", "Cost", "Avg KM/L", "Cost/KM"];
      const tableRows: (string | number)[][] = [];

      data.forEach(log => {
          const vehicle = vehicles.find(v => v.id === log.vehicleId);
          const driver = users.find(u => u.id === log.driverId);
          const logData = [
              vehicle?.plateNumber || 'N/A',
              driver?.name || 'Unknown',
              new Date(log.date).toLocaleDateString('en-GB'),
              `${log.odometer.toLocaleString()} km`,
              log.distance ? `${log.distance.toLocaleString()} km` : 'N/A',
              `${log.liters.toFixed(2)} L`,
              `RM${log.cost.toFixed(2)}`,
              log.avgKML ? log.avgKML.toFixed(2) : 'N/A',
              log.costPerKM ? `RM${log.costPerKM.toFixed(2)}` : 'N/A',
          ];
          tableRows.push(logData);
      });

      doc.autoTable({ head: [tableColumn], body: tableRows, startY: 25 });
      doc.save(`fuel_report_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const convertToCSV = (data: any[], headers: {key: string, label: string}[]) => {
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
  
  const applyDateFilter = (items: (FuelLog | Booking)[], filters: { dateFilter: string, startDate: string, endDate: string }) => {
    const now = new Date();
    
    // This Week (Mon-Sun)
    const todayForWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dayOfWeek = todayForWeek.getDay();
    const diff = todayForWeek.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const startOfWeek = new Date(todayForWeek.getFullYear(), todayForWeek.getMonth(), diff);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23,59,59,999);
    
    // This Month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23,59,59,999);

    // Last Month
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    endOfLastMonth.setHours(23,59,59,999);
      
    return items.filter(item => {
        const itemDateStr = 'dateTime' in item ? item.dateTime : item.date;
        const [year, month, day] = itemDateStr.split('T')[0].split('-').map(Number);
        const itemDate = new Date(year, month - 1, day);
        
        switch(filters.dateFilter) {
            case 'week': return itemDate >= startOfWeek && itemDate <= endOfWeek;
            case 'month': return itemDate >= startOfMonth && itemDate <= endOfMonth;
            case 'last_month': return itemDate >= startOfLastMonth && itemDate <= endOfLastMonth;
            case 'custom':
              if (filters.startDate && filters.endDate) {
                  const start = new Date(filters.startDate);
                  const end = new Date(filters.endDate);
                  return itemDate >= start && itemDate <= end;
              }
              return true;
            case 'all': default: return true;
        }
    });
  };

  const fuelReportData = useMemo(() => {
    const baseReport = fuelLogs.filter(log => {
        const vehicleMatch = !fuelLogFilters.vehicleId || log.vehicleId === fuelLogFilters.vehicleId;
        const driverMatch = !fuelLogFilters.driverId || log.driverId === fuelLogFilters.driverId;
        return vehicleMatch && driverMatch;
    });

    const datedReport = applyDateFilter(baseReport, fuelLogFilters) as FuelLog[];

    const logsByVehicle = datedReport.reduce((acc, log) => {
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
          const prevLog = sortedLogs[i-1];
          const distance = currentLog.odometer - prevLog.odometer;
          if (distance > 0) {
            calculatedMetrics.distance = distance;
            if(prevLog.liters > 0) {
              calculatedMetrics.avgKML = distance / prevLog.liters;
            }
            if(distance > 0) {
                calculatedMetrics.costPerKM = prevLog.cost / distance;
            }
          }
        }
        report.push({ ...currentLog, ...calculatedMetrics });
      }
    }
    return report.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.odometer - a.odometer);
  }, [fuelLogs, fuelLogFilters]);

  const monthlyFuelSummary = useMemo(() => {
    const summary: Record<string, Record<string, {
        totalCost: number;
        totalDistance: number;
        totalLiters: number;
    }>> = {};

    const logsByVehicle = fuelLogs.reduce((acc, log) => {
        if (!acc[log.vehicleId]) { acc[log.vehicleId] = []; }
        acc[log.vehicleId].push(log);
        return acc;
    }, {} as Record<string, FuelLog[]>);

    for (const vehicleId in logsByVehicle) {
        const sortedLogs = logsByVehicle[vehicleId].sort((a, b) => a.odometer - b.odometer);
        for (let i = 1; i < sortedLogs.length; i++) {
            const currentLog = sortedLogs[i];
            const prevLog = sortedLogs[i-1];
            const distance = currentLog.odometer - prevLog.odometer;

            if (distance > 0) {
                const month = new Date(currentLog.date).toLocaleString('default', { month: 'long', year: 'numeric' });
                if (!summary[month]) summary[month] = {};
                if (!summary[month][vehicleId]) {
                    summary[month][vehicleId] = { totalCost: 0, totalDistance: 0, totalLiters: 0 };
                }
                summary[month][vehicleId].totalDistance += distance;
                summary[month][vehicleId].totalLiters += prevLog.liters;
            }
        }
    }
    
    fuelLogs.forEach(log => {
        const month = new Date(log.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        const vehicleId = log.vehicleId;
        if (!summary[month]) summary[month] = {};
        if (!summary[month][vehicleId]) {
            summary[month][vehicleId] = { totalCost: 0, totalDistance: 0, totalLiters: 0 };
        }
        summary[month][vehicleId].totalCost += log.cost;
    });

    return Object.entries(summary).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [fuelLogs]);
  
  const monthlyTripReport = useMemo(() => {
    const summary: Record<string, Record<string, { tripCount: number; totalDistance: number }>> = {};

    // 1. Calculate trip counts from all completed bookings
    const completedBookings = bookings.filter(b => b.status === 'Completed');
    for (const booking of completedBookings) {
        const month = new Date(booking.dateTime).toLocaleString('default', { month: 'long', year: 'numeric' });
        const vehicleId = booking.vehicleId;
        if (!vehicleId) continue;
        if (!summary[month]) summary[month] = {};
        if (!summary[month][vehicleId]) summary[month][vehicleId] = { tripCount: 0, totalDistance: 0 };
        summary[month][vehicleId].tripCount += 1;
    }
    
    // 2. Calculate distance from odometer logs by month and vehicle
    const logsByMonthAndVehicle: Record<string, Record<string, number[]>> = {};
    for (const log of odometerLogs) {
        const month = new Date(log.date).toLocaleString('default', { month: 'long', year: 'numeric' });
        const vehicleId = log.vehicleId;
        if (!logsByMonthAndVehicle[month]) logsByMonthAndVehicle[month] = {};
        if (!logsByMonthAndVehicle[month][vehicleId]) logsByMonthAndVehicle[month][vehicleId] = [];
        logsByMonthAndVehicle[month][vehicleId].push(log.odometer);
    }
    
    for (const month in logsByMonthAndVehicle) {
        for (const vehicleId in logsByMonthAndVehicle[month]) {
            const odometers = logsByMonthAndVehicle[month][vehicleId];
            if (odometers.length > 1) { // Need at least two readings to calculate distance
                const minOdo = Math.min(...odometers);
                const maxOdo = Math.max(...odometers);
                const distance = maxOdo - minOdo;

                if (distance >= 0) { // Distance can be 0, that's fine
                     if (!summary[month]) summary[month] = {}; // Should already exist if there are trips
                     if (!summary[month][vehicleId]) summary[month][vehicleId] = { tripCount: 0, totalDistance: 0 };
                     summary[month][vehicleId].totalDistance = distance;
                }
            }
        }
    }

    return Object.entries(summary).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [bookings, odometerLogs]);

  const detailedTripReportData = useMemo(() => {
    const baseReport = bookings.filter(b => {
      if (b.status !== 'Completed') return false;
      const vehicleMatch = !tripFilters.vehicleId || b.vehicleId === tripFilters.vehicleId;
      const driverMatch = !tripFilters.driverId || b.driverId === tripFilters.driverId;
      return vehicleMatch && driverMatch;
    });

    return applyDateFilter(baseReport, tripFilters) as Booking[];
  }, [bookings, tripFilters]);
  
  const handleExportTripSummary = (format: 'pdf' | 'csv') => {
    const dataToExport = monthlyTripReport.flatMap(([month, vehicleData]) => 
        Object.entries(vehicleData).map(([vehicleId, data]) => {
            const vehicle = vehicles.find(v => v.id === vehicleId);
            const tripData = data as { tripCount: number; totalDistance: number };
            return {
                month,
                vehicle: `${vehicle?.name} (${vehicle?.plateNumber})`,
                tripCount: tripData.tripCount,
                totalDistance: tripData.totalDistance,
            };
        })
    );

    if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Monthly Trip & Distance Summary", 14, 16);
        doc.autoTable({
            head: [['Month', 'Vehicle', 'Total Trips', 'Total Distance (km)']],
            body: dataToExport.map(d => [d.month, d.vehicle, d.tripCount, `${d.totalDistance.toLocaleString()} km`]),
            startY: 25,
        });
        doc.save('monthly_trip_summary.pdf');
    } else { // csv
        const headers = [{key: 'month', label: 'Month'}, {key: 'vehicle', label: 'Vehicle'}, {key: 'tripCount', label: 'Total Trips'}, {key: 'totalDistance', label: 'Total Distance (km)'}];
        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, 'monthly_trip_summary.csv');
    }
  };

  const handleExportFuelSummary = (format: 'pdf' | 'csv') => {
    const dataToExport = monthlyFuelSummary.flatMap(([month, vehicleData]) =>
        Object.entries(vehicleData).map(([vehicleId, data]) => {
            const vehicle = vehicles.find(v => v.id === vehicleId);
            const summaryData = data as { totalCost: number; totalDistance: number; totalLiters: number };
            return {
                month,
                vehicle: `${vehicle?.name} (${vehicle?.plateNumber})`,
                totalCost: `RM${summaryData.totalCost.toFixed(2)}`,
                totalDistance: `${summaryData.totalDistance.toLocaleString()} km`,
                avgKML: summaryData.totalLiters > 0 ? (summaryData.totalDistance / summaryData.totalLiters).toFixed(2) : 'N/A',
            };
        })
    );
     if (format === 'pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        doc.text("Monthly Fuel Summary", 14, 16);
        doc.autoTable({
            head: [['Month', 'Vehicle', 'Total Cost', 'Total Distance', 'Avg. KM/L']],
            body: dataToExport.map(d => [d.month, d.vehicle, d.totalCost, d.totalDistance, d.avgKML]),
            startY: 25,
        });
        doc.save('monthly_fuel_summary.pdf');
    } else { // csv
        const headers = [{key: 'month', label: 'Month'}, {key: 'vehicle', label: 'Vehicle'}, {key: 'totalCost', label: 'Total Cost'}, {key: 'totalDistance', label: 'Total Distance'}, {key: 'avgKML', label: 'Avg. KM/L'}];
        const csv = convertToCSV(dataToExport, headers);
        downloadCSV(csv, 'monthly_fuel_summary.csv');
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Reports</h2>
      
      <FuelLogEditForm 
        isOpen={isFormOpen}
        onClose={handleCloseForm}
        logToEdit={editingLog}
      />

      <div className="space-y-12">

        {/* Trip Distance Report */}
        <div className="bg-white p-6 rounded-lg shadow-md space-y-8">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center"><RouteIcon className="h-6 w-6 mr-2 text-indigo-500" />Trip Distance Report</h3>
            
            <div className="bg-white rounded-lg shadow-inner border" id="monthly-trip-summary-printable">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">Monthly Trip & Distance Summary</h4>
                        <div className="flex items-center space-x-2">
                           <button onClick={() => handlePrint('monthly-trip-summary-printable')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><PrinterIcon className="h-4 w-4 mr-1.5"/> Print</button>
                           <button onClick={() => handleExportTripSummary('pdf')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> PDF</button>
                           <button onClick={() => handleExportTripSummary('csv')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> CSV</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {monthlyTripReport.length > 0 ? (
                            monthlyTripReport.map(([month, vehicleData]) => (
                                <div key={month} className="mb-6">
                                    <h5 className="text-md font-medium text-gray-700 bg-gray-50 p-3 rounded-t-md">{month}</h5>
                                    <table className="min-w-full divide-y divide-gray-200 border">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Vehicle</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total Trips</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total Distance (km)</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {Object.entries(vehicleData).map(([vehicleId, data]) => {
                                                const vehicle = vehicles.find(v => v.id === vehicleId);
                                                // FIX: Cast 'data' to the correct type to resolve properties 'tripCount' and 'totalDistance' on type 'unknown'.
                                                const tripData = data as { tripCount: number; totalDistance: number };
                                                return (
                                                <tr key={vehicleId}>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                                        <div className="flex items-center">
                                                            {vehicle?.photoUrl ? (
                                                                <img src={vehicle.photoUrl} alt={vehicle.name} className="h-8 w-8 rounded-full object-cover mr-3" />
                                                            ) : (
                                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                                                    <TruckIcon className="h-5 w-5 text-gray-500" />
                                                                </div>
                                                            )}
                                                            <span>{vehicle?.name} ({vehicle?.plateNumber})</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{tripData.tripCount}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{tripData.totalDistance.toLocaleString()} km</td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-500">No completed trips with distance data to generate a summary.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-inner border">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h4 className="text-lg font-semibold text-gray-800">Detailed Trip Log</h4>
                            <p className="text-sm text-gray-500">A log of all completed trips.</p>
                        </div>
                        <div className="flex items-center space-x-2">
                            <button onClick={() => handlePrint('detailed-trip-log-printable')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><PrinterIcon className="h-4 w-4 mr-1.5"/> Print</button>
                            <button onClick={() => exportDetailedTripReportPdf(detailedTripReportData, vehicles, users)} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> PDF</button>
                        </div>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg mb-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                            <label htmlFor="trip-vehicle-filter" className="block text-sm font-medium text-gray-700">Vehicle</label>
                            <select
                                id="trip-vehicle-filter"
                                name="vehicleId"
                                value={tripFilters.vehicleId}
                                onChange={handleFilterChange(setTripFilters)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">All Vehicles</option>
                                {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                            </select>
                            </div>
                            <div>
                            <label htmlFor="trip-driver-filter" className="block text-sm font-medium text-gray-700">Driver</label>
                            <select
                                id="trip-driver-filter"
                                name="driverId"
                                value={tripFilters.driverId}
                                onChange={handleFilterChange(setTripFilters)}
                                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                            >
                                <option value="">All Drivers</option>
                                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                            </div>
                            <div className="self-end">
                            <button 
                                onClick={() => setTripFilters({ vehicleId: '', driverId: '', dateFilter: 'all', startDate: '', endDate: '' })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                            >
                                Clear Filters
                            </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div>
                                <label htmlFor="trip-date-filter" className="block text-sm font-medium text-gray-700">Date Range</label>
                                <select
                                    id="trip-date-filter"
                                    name="dateFilter"
                                    value={tripFilters.dateFilter}
                                    onChange={handleFilterChange(setTripFilters)}
                                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                >
                                    {dateFilters.map(({ key, label }) => (
                                    <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            {tripFilters.dateFilter === 'custom' && (
                                <>
                                    <div>
                                        <label htmlFor="trip-start-date" className="block text-sm font-medium text-gray-700">Start Date</label>
                                        <input type="date" id="trip-start-date" name="startDate" value={tripFilters.startDate || ''} onChange={handleFilterChange(setTripFilters)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm"/>
                                    </div>
                                    <div>
                                        <label htmlFor="trip-end-date" className="block text-sm font-medium text-gray-700">End Date</label>
                                        <input type="date" id="trip-end-date" name="endDate" value={tripFilters.endDate || ''} onChange={handleFilterChange(setTripFilters)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" />
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div id="detailed-trip-log-printable" className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remarks</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {detailedTripReportData.length > 0 ? detailedTripReportData.map(booking => {
                                const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                                return (
                                    <tr key={booking.id}>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(booking.dateTime).toLocaleDateString('en-GB')}</td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{vehicle?.plateNumber || 'N/A'}</td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{getDriverName(booking.driverId)}</td>
                                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-800">{booking.destination}</td>
                                        <td className="px-3 py-3 text-sm text-gray-500 max-w-xs truncate" title={booking.remarks}>{booking.remarks || '-'}</td>
                                    </tr>
                                )
                            }) : (
                            <tr><td colSpan={5} className="text-center py-4 text-gray-500">No trips match the current filters.</td></tr>
                            )}
                        </tbody>
                        </table>
                    </div>
                </div>
            </div>

        </div>
        
        {/* Fuel Consumption Report */}
        <div className="bg-white p-6 rounded-lg shadow-md space-y-8">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center">
                <FuelIcon className="h-6 w-6 mr-2 text-indigo-500" />
                Fuel Consumption Report
            </h3>

            <div className="bg-white rounded-lg shadow-inner border" id="monthly-fuel-summary-printable">
                <div className="p-6">
                     <div className="flex justify-between items-center mb-4">
                        <h4 className="text-lg font-semibold text-gray-800">Monthly Fuel Summary</h4>
                        <div className="flex items-center space-x-2">
                           <button onClick={() => handlePrint('monthly-fuel-summary-printable')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><PrinterIcon className="h-4 w-4 mr-1.5"/> Print</button>
                           <button onClick={() => handleExportFuelSummary('pdf')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> PDF</button>
                           <button onClick={() => handleExportFuelSummary('csv')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> CSV</button>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {monthlyFuelSummary.length > 0 ? (
                            monthlyFuelSummary.map(([month, vehicleData]) => (
                                <div key={month} className="mb-6">
                                    <h5 className="text-md font-medium text-gray-700 bg-gray-50 p-3 rounded-t-md">{month}</h5>
                                    <table className="min-w-full divide-y divide-gray-200 border">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">Vehicle</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total Cost</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Total Distance</th>
                                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">Avg. KM/L</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {Object.entries(vehicleData).sort((a,b) => {
                                                const vehicleA = vehicles.find(v => v.id === a[0]);
                                                const vehicleB = vehicles.find(v => v.id === b[0]);
                                                return (vehicleA?.name || '').localeCompare(vehicleB?.name || '');
                                            }).map(([vehicleId, data]) => {
                                                const vehicle = vehicles.find(v => v.id === vehicleId);
                                                // FIX: Cast 'data' to the correct type to resolve properties on type 'unknown'.
                                                const summaryData = data as { totalCost: number; totalDistance: number; totalLiters: number };
                                                const avgKML = summaryData.totalLiters > 0 ? (summaryData.totalDistance / summaryData.totalLiters).toFixed(2) : 'N/A';
                                                return (
                                                <tr key={vehicleId}>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-800">
                                                        <div className="flex items-center">
                                                            {vehicle?.photoUrl ? (
                                                                <img src={vehicle.photoUrl} alt={vehicle.name} className="h-8 w-8 rounded-full object-cover mr-3" />
                                                            ) : (
                                                                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                                                    <TruckIcon className="h-5 w-5 text-gray-500" />
                                                                </div>
                                                            )}
                                                            <span>{vehicle?.name} ({vehicle?.plateNumber})</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">RM{summaryData.totalCost.toFixed(2)}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{summaryData.totalDistance > 0 ? `${summaryData.totalDistance.toLocaleString()} km` : 'N/A'}</td>
                                                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 font-semibold text-right">{avgKML}</td>
                                                </tr>
                                            )})}
                                        </tbody>
                                    </table>
                                </div>
                            ))
                        ) : (
                            <p className="text-center py-4 text-gray-500">Not enough fuel log data to generate a summary.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow-inner border">
              <div className="p-6">
                 <div className="flex justify-between items-center mb-4">
                    <div>
                        <h4 className="text-lg font-semibold text-gray-800">Detailed Fuel Log & Economy Analysis</h4>
                        <p className="text-sm text-gray-500">Detailed breakdown of fuel efficiency and costs. Metrics like Avg KM/L are calculated based on the previous refuel.</p>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button onClick={() => handlePrint('detailed-fuel-log-printable')} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><PrinterIcon className="h-4 w-4 mr-1.5"/> Print</button>
                        <button onClick={() => exportDetailedFuelReportPdf(fuelReportData, vehicles, users)} className="flex items-center text-sm bg-white hover:bg-gray-100 text-gray-700 font-semibold py-1.5 px-3 border border-gray-300 rounded-md shadow-sm"><DocumentDownloadIcon className="h-4 w-4 mr-1.5"/> PDF</button>
                    </div>
                </div>

                <div className="p-4 bg-gray-50 rounded-lg mb-4 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                        <label htmlFor="fuel-vehicle-filter" className="block text-sm font-medium text-gray-700">Vehicle</label>
                        <select id="fuel-vehicle-filter" name="vehicleId" value={fuelLogFilters.vehicleId} onChange={handleFilterChange(setFuelLogFilters)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" >
                            <option value="">All Vehicles</option>
                            {vehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.plateNumber})</option>)}
                        </select>
                        </div>
                        <div>
                        <label htmlFor="fuel-driver-filter" className="block text-sm font-medium text-gray-700">Driver</label>
                        <select id="fuel-driver-filter" name="driverId" value={fuelLogFilters.driverId} onChange={handleFilterChange(setFuelLogFilters)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" >
                            <option value="">All Drivers</option>
                            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        </div>
                        <div className="self-end">
                        <button onClick={() => setFuelLogFilters({ vehicleId: '', driverId: '', dateFilter: 'all', startDate: '', endDate: '' })} className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                            Clear Filters
                        </button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <label htmlFor="fuel-date-filter" className="block text-sm font-medium text-gray-700">Date Range</label>
                        <select id="fuel-date-filter" name="dateFilter" value={fuelLogFilters.dateFilter} onChange={handleFilterChange(setFuelLogFilters)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md" >
                            {dateFilters.map(({ key, label }) => (
                            <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                        </div>
                        {fuelLogFilters.dateFilter === 'custom' && (
                            <>
                                <div>
                                    <label htmlFor="fuel-start-date" className="block text-sm font-medium text-gray-700">Start Date</label>
                                    <input type="date" id="fuel-start-date" name="startDate" value={fuelLogFilters.startDate || ''} onChange={handleFilterChange(setFuelLogFilters)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" />
                                </div>
                                <div>
                                    <label htmlFor="fuel-end-date" className="block text-sm font-medium text-gray-700">End Date</label>
                                    <input type="date" id="fuel-end-date" name="endDate" value={fuelLogFilters.endDate || ''} onChange={handleFilterChange(setFuelLogFilters)} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm" />
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div id="detailed-fuel-log-printable" className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50 sticky top-0">
                        <tr>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Driver</th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Odometer</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Distance</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Liters</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Avg KM/L</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Cost/KM</th>
                        <th className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Receipt</th>
                        <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {fuelReportData.length > 0 ? fuelReportData.map(log => {
                            const vehicle = vehicles.find(v => v.id === log.vehicleId);
                            return (
                        <tr key={log.id}>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">
                                <div className="flex items-center">
                                    {vehicle?.photoUrl ? (
                                        <img src={vehicle.photoUrl} alt={vehicle.name} className="h-8 w-8 rounded-full object-cover mr-3" />
                                    ) : (
                                        <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center mr-3 flex-shrink-0">
                                            <TruckIcon className="h-5 w-5 text-gray-500" />
                                        </div>
                                    )}
                                    <span>{vehicle?.plateNumber}</span>
                                </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{getDriverName(log.driverId)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-700">{new Date(log.date).toLocaleDateString('en-GB')}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-800 text-right">{log.odometer.toLocaleString()} km</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-500 text-right">{log.distance ? `${log.distance.toLocaleString()} km` : 'N/A'}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-800 text-right">{log.liters.toFixed(2)} L</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right">RM{log.cost.toFixed(2)}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-green-700 font-semibold text-right">{log.avgKML ? log.avgKML.toFixed(2) : 'N/A'}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-red-700 font-semibold text-right">{log.costPerKM ? `RM${log.costPerKM.toFixed(2)}` : 'N/A'}</td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-center">
                            {log.receiptAttachmentUrl ? (
                                <a href={log.receiptAttachmentUrl} title={log.receiptAttachmentName} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800">
                                <PaperClipIcon className="h-5 w-5 mx-auto"/>
                                </a>
                            ) : '-'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <button onClick={() => handleEditLog(log)} className="text-gray-600 hover:text-indigo-800 p-1.5 rounded-full hover:bg-indigo-100 transition" title="Edit Log"><EditIcon className="h-5 w-5" /></button>
                                <button onClick={() => handleDeleteLog(log.id)} className="text-red-600 hover:text-red-800 ml-1 p-1.5 rounded-full hover:bg-red-100 transition" title="Delete Log"><TrashIcon className="h-5 w-5"/></button>
                            </td>
                        </tr>
                        )
                        }) : (
                        <tr><td colSpan={11} className="text-center py-4 text-gray-500">No fuel logs match the current filters.</td></tr>
                        )}
                    </tbody>
                    </table>
                </div>
              </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default Reports;