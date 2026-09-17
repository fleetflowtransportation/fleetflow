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
