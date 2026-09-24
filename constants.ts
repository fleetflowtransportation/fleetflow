import type { User, Vehicle, Booking, DriverSchedule } from './types';

export const USERS: User[] = [
  { 
    id: 'admin-ain', 
    name: 'Ain', 
    email: 'ain@yck.org.my',
    phone: '012-3456789',
    joiningDate: '2023-01-01',
    address: 'HQ Yayasan Chow Kit, KL',
    role: 'admin',
    status: 'active',
    password: 'admin' 
  },
  { 
    id: 'driver-syafiq', 
    name: 'Syafiq', 
    email: 'syafiq@yck.org.my',
    phone: '011-2345678',
    joiningDate: '2023-03-01',
    address: 'Kuala Lumpur',
    role: 'driver',
    status: 'active',
    password: 'password123' 
  },
  { 
    id: 'driver-saiful', 
    name: 'Saiful', 
    email: 'saiful@yck.org.my',
    phone: '012-8765432',
    joiningDate: '2023-04-15',
    address: 'Petaling Jaya',
    role: 'driver',
    status: 'active',
    password: 'password123' 
  },
  { 
    id: 'driver-aziz', 
    name: 'Aziz', 
    email: 'aziz@yck.org.my',
    phone: '017-3131604',
    joiningDate: '2023-05-10',
    address: 'Selangor',
    role: 'admin',
    status: 'active',
    password: 'password123' 
  },
  { 
    id: 'driver-1', 
    name: 'John Doe', 
    email: 'john.doe@email.com',
    phone: '011-1234567',
    joiningDate: '2023-05-15',
    address: '456 Driver Avenue, PJ',
    role: 'driver',
    status: 'active',
    password: 'password123' 
  },
];

export const VEHICLES: Vehicle[] = [
  { id: 'alza-1', name: 'Perodua Alza', plateNumber: 'VAA 8821', specifications: '7-Seater MPV (Self-Drive)' },
  { id: 'van-1', name: 'Toyota Hiace', plateNumber: 'WXY 1234', specifications: '11-Seater Van' },
  { id: 'van-2', name: 'Nissan Urvan', plateNumber: 'BCA 5678', specifications: '14-Seater Van' },
  { id: 'van-3', name: 'Ford Transit', plateNumber: 'QDR 9012', specifications: '12-Seater Van' },
];

// Helper to generate schedules around the current month/week
const generateSchedules = (): DriverSchedule[] => {
  const scheds: DriverSchedule[] = [];
  const base = new Date();
  for (let offset = -7; offset <= 30; offset++) {
    const d = new Date(base);
    d.setDate(base.getDate() + offset);
    const day = d.getDay();
    // Monday to Friday
    if (day >= 1 && day <= 5) {
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      scheds.push({
        id: `sched-syafiq-${dateStr}`,
        Date: dateStr,
        DriverId: 'driver-syafiq',
        Mula: '08:00',
        Tamat: '17:00'
      });
      scheds.push({
        id: `sched-saiful-${dateStr}`,
        Date: dateStr,
        DriverId: 'driver-saiful',
        Mula: '09:00',
        Tamat: '18:00'
      });
    }
  }
  return scheds;
};

export const INITIAL_DRIVER_SCHEDULES: DriverSchedule[] = generateSchedules();

const now = new Date();
const twoDaysFromNow = new Date(now);
twoDaysFromNow.setDate(now.getDate() + 2);
twoDaysFromNow.setHours(10, 0, 0, 0);

const twoDaysFromNowEnd = new Date(twoDaysFromNow);
twoDaysFromNowEnd.setHours(12, 0, 0, 0);

const fiveDaysFromNow = new Date(now);
fiveDaysFromNow.setDate(now.getDate() + 5);
fiveDaysFromNow.setHours(14, 0, 0, 0);


export const INITIAL_BOOKINGS: Booking[] = [
    {
        id: `booking-${Date.now()}-1`,
        destination: "KL Sentral",
        purpose: "Staff Training",
        dateTime: twoDaysFromNow.toISOString(),
        finishDateTime: twoDaysFromNowEnd.toISOString(),
        pickupPoint: "YCK Headquarters",
        address: "Jalan Stesen Sentral, Kuala Lumpur Sentral, 50470 Kuala Lumpur",
        passengers: [{ category: 'Staff', count: 5 }],
        escort: "Mr. Tan",
        shouldWait: false,
        returnTrip: true,
        status: 'Assigned',
        driverId: 'driver-1',
        vehicleId: 'van-1',
        remarks: "Passenger requested a van with better air-conditioning.",
        requesterName: "Admin",
        requesterEmail: "admin@fleetflow.com",
        department: "Management",
        serviceType: "Perlu Driver",
    },
    {
        id: `booking-${Date.now()}-2`,
        destination: "Sunway Pyramid",
        purpose: "Team Outing",
        dateTime: fiveDaysFromNow.toISOString(),
        pickupPoint: "Sunway Office",
        address: "3, Jalan PJS 11/15, Bandar Sunway, 47500 Petaling Jaya, Selangor",
        passengers: [
            { category: 'Staff', count: 8 },
            { category: 'Kids', count: 2 },
            { category: 'Teenagers', count: 3 }
        ],
        escort: "Ms. Lee",
        shouldWait: true,
        returnTrip: true,
        status: 'Pending',
        driverId: null,
        vehicleId: null,
        requesterName: "Alice (Staff)",
        requesterEmail: "alice@fleetflow.com",
        department: "Program",
        serviceType: "Perlu Driver",
    }
];

export const INITIAL_MAINTENANCE_INTERVALS = [
  // Perodua Alza (VAA 8821)
  {
    id: 'm-int-alza-1',
    vehicleId: 'alza-1',
    serviceName: 'Engine Oil & Oil Filter (Fully Synthetic 0W-20)',
    category: 'Engine' as const,
    intervalKm: 10000,
    intervalMonths: 6,
    lastServiceDate: '2026-06-15',
    lastServiceOdometer: 42000,
    nextDueOdometer: 52000,
    nextDueDate: '2026-12-15',
    estimatedCost: 195,
    notes: 'Perodua Genuine 0W-20 SN, OEM Oil Filter 15601-00R01, Drain plug washer',
  },
  {
    id: 'm-int-alza-2',
    vehicleId: 'alza-1',
    serviceName: 'D-CVT Gearbox Transmission Fluid',
    category: 'Transmission' as const,
    intervalKm: 40000,
    intervalMonths: 24,
    lastServiceDate: '2025-08-10',
    lastServiceOdometer: 40000,
    nextDueOdometer: 80000,
    nextDueDate: '2027-08-10',
    estimatedCost: 320,
    notes: 'Perodua D-CVT Fluid only. Do not mix with conventional ATF.',
  },
  {
    id: 'm-int-alza-3',
    vehicleId: 'alza-1',
    serviceName: 'Front Brake Pads & Brake Fluid (DOT 4)',
    category: 'Brakes' as const,
    intervalKm: 20000,
    intervalMonths: 12,
    lastServiceDate: '2026-03-20',
    lastServiceOdometer: 38000,
    nextDueOdometer: 58000,
    nextDueDate: '2027-03-20',
    estimatedCost: 180,
    notes: 'Inspect rotor thickness and bleed brake lines.',
  },
  {
    id: 'm-int-alza-4',
    vehicleId: 'alza-1',
    serviceName: 'Tire Rotation, Wheel Balancing & Alignment',
    category: 'Tires' as const,
    intervalKm: 10000,
    intervalMonths: 6,
    lastServiceDate: '2026-06-15',
    lastServiceOdometer: 42000,
    nextDueOdometer: 52000,
    nextDueDate: '2026-12-15',
    estimatedCost: 85,
    notes: 'Maintain 220 kPa front / 240 kPa rear pressure.',
  },
  {
    id: 'm-int-alza-5',
    vehicleId: 'alza-1',
    serviceName: 'Roadtax & JPJ Inspection Renewal',
    category: 'Inspection' as const,
    intervalKm: 0,
    intervalMonths: 12,
    lastServiceDate: '2026-03-01',
    lastServiceOdometer: 37500,
    nextDueDate: '2027-03-01',
    estimatedCost: 120,
    notes: 'Renew roadtax and comprehensive motor takaful insurance.',
  },

  // Toyota Hiace (WXY 1234)
  {
    id: 'm-int-hiace-1',
    vehicleId: 'van-1',
    serviceName: 'Diesel Engine Oil & Filter (15W-40 CI-4)',
    category: 'Engine' as const,
    intervalKm: 5000,
    intervalMonths: 6,
    lastServiceDate: '2026-07-20',
    lastServiceOdometer: 78500,
    nextDueOdometer: 83500,
    nextDueDate: '2027-01-20',
    estimatedCost: 260,
    notes: 'Heavy-duty diesel 15W-40, 6.5 Liters + OEM diesel filter.',
  },
  {
    id: 'm-int-hiace-2',
    vehicleId: 'van-1',
    serviceName: 'Diesel Primary & Secondary Fuel Filter',
    category: 'Engine' as const,
    intervalKm: 20000,
    intervalMonths: 12,
    lastServiceDate: '2026-01-15',
    lastServiceOdometer: 68000,
    nextDueOdometer: 88000,
    nextDueDate: '2027-01-15',
    estimatedCost: 150,
    notes: 'Drain sediment water trap and replace fuel filter element.',
  },
  {
    id: 'm-int-hiace-3',
    vehicleId: 'van-1',
    serviceName: 'Commercial Vehicle Puspakom Inspection',
    category: 'Inspection' as const,
    intervalKm: 0,
    intervalMonths: 6,
    lastServiceDate: '2026-04-12',
    lastServiceOdometer: 74000,
    nextDueDate: '2026-10-12',
    estimatedCost: 110,
    notes: 'Brake test, smoke emission test, chassis inspection, speed limiter check.',
  },

  // Nissan Urvan (BCA 5678)
  {
    id: 'm-int-urvan-1',
    vehicleId: 'van-2',
    serviceName: 'Diesel Engine Oil & Filter (10W-30 Turbo Diesel)',
    category: 'Engine' as const,
    intervalKm: 5000,
    intervalMonths: 6,
    lastServiceDate: '2026-08-05',
    lastServiceOdometer: 94200,
    nextDueOdometer: 99200,
    nextDueDate: '2027-02-05',
    estimatedCost: 280,
    notes: 'Nissan Turbo Diesel Oil, 7.0 Litres capacity.',
  },
  {
    id: 'm-int-urvan-2',
    vehicleId: 'van-2',
    serviceName: 'Commercial Vehicle Puspakom Inspection',
    category: 'Inspection' as const,
    intervalKm: 0,
    intervalMonths: 6,
    lastServiceDate: '2026-05-18',
    lastServiceOdometer: 90000,
    nextDueDate: '2026-11-18',
    estimatedCost: 110,
    notes: 'Semi-annual commercial puspakom inspection.',
  },

  // Ford Transit (QDR 9012)
  {
    id: 'm-int-transit-1',
    vehicleId: 'van-3',
    serviceName: 'Full Synthetic Engine Oil & Heavy Filter (5W-30)',
    category: 'Engine' as const,
    intervalKm: 10000,
    intervalMonths: 12,
    lastServiceDate: '2026-05-10',
    lastServiceOdometer: 55000,
    nextDueOdometer: 65000,
    nextDueDate: '2027-05-10',
    estimatedCost: 350,
    notes: 'Ford WSS-M2C913-D specification oil.',
  }
];

export const INITIAL_MAINTENANCE_LOGS = [
  {
    id: 'm-log-1',
    vehicleId: 'alza-1',
    serviceDate: '2026-06-15',
    odometer: 42000,
    serviceType: 'Scheduled Maintenance' as const,
    serviceItems: ['Engine Oil & Oil Filter', 'Tire Rotation & Balancing'],
    workshopName: 'Perodua Service Centre Pandan Indah',
    invoiceNumber: 'INV-P2-88319',
    totalCost: 280,
    performedBy: 'Driver Syafiq',
    remarks: 'Regular 40,000km major service completed. All brake pads at 80% life.',
  },
  {
    id: 'm-log-2',
    vehicleId: 'van-1',
    serviceDate: '2026-07-20',
    odometer: 78500,
    serviceType: 'Scheduled Maintenance' as const,
    serviceItems: ['Diesel Engine Oil & Filter'],
    workshopName: 'Toyota 3S Centre Ampang',
    invoiceNumber: 'TY-2026-9041',
    totalCost: 260,
    performedBy: 'Driver Saiful',
    remarks: 'Replaced oil & filter. Air filter cleaned with air compressor.',
  },
  {
    id: 'm-log-3',
    vehicleId: 'van-1',
    serviceDate: '2026-04-12',
    odometer: 74000,
    serviceType: 'Inspection' as const,
    serviceItems: ['Commercial Vehicle Puspakom Inspection'],
    workshopName: 'Puspakom Pandan Mewah',
    invoiceNumber: 'PSK-VR-44120',
    totalCost: 110,
    performedBy: 'Driver Saiful',
    remarks: 'Passed all safety checks and smoke opacity standards.',
  }
];

