import type { User, Vehicle, Booking } from './types';

export const USERS: User[] = [
  { 
    id: 'admin-1', 
    name: 'Admin User', 
    email: 'admin@fleetflow.com',
    phone: '012-3456789',
    joiningDate: '2023-01-01',
    address: '123 Admin Street, KL',
    role: 'admin',
    status: 'active',
    password: 'adminpass' 
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
  { 
    id: 'driver-2', 
    name: 'Jane Smith', 
    email: 'jane.smith@email.com',
    phone: '012-9876543',
    joiningDate: '2023-08-20',
    address: '789 Driver Road, Shah Alam',
    role: 'driver',
    status: 'active',
    password: 'password123'
  },
  { 
    id: 'driver-3', 
    name: 'Peter Jones',
    email: 'peter.jones@email.com',
    phone: '019-5551234',
    joiningDate: '2024-01-10',
    address: '101 Driver Lane, Subang Jaya',
    role: 'driver',
    status: 'inactive',
    password: 'password123'
  },
];

export const VEHICLES: Vehicle[] = [
  { id: 'van-1', name: 'Toyota Hiace', plateNumber: 'WXY 1234' },
  { id: 'van-2', name: 'Nissan Urvan', plateNumber: 'BCA 5678' },
  { id: 'van-3', name: 'Ford Transit', plateNumber: 'QDR 9012' },
];

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
    }
];
