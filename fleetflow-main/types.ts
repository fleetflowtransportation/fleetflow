export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: string; // ISO String
  address: string;
  comments?: string;
  role: 'admin' | 'driver';
  status: 'active' | 'inactive';
  password?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  photoUrl?: string;
  specifications?: string;
}

export type PassengerCategory = 'Staff' | 'Kids' | 'Teenagers' | 'Adults' | 'Others';

export const PASSENGER_CATEGORIES: PassengerCategory[] = ['Staff', 'Kids', 'Teenagers', 'Adults', 'Others'];

export interface PassengerCount {
  category: PassengerCategory;
  count: number;
}

export const DEPARTMENTS = ['Management', 'Program', 'ALPD', 'Care Provider', 'Social Worker', 'Warden', 'PJBA'];

export const PICKUP_POINTS = ['YCK', 'PJBA', 'Lokasi Lain (Sila Nyatakan)'];

export interface Booking {
  id:string;
  destination: string;
  purpose: string;
  dateTime: string;
  finishDateTime?: string;
  pickupPoint: string;
  address: string;
  passengers: PassengerCount[];
  escort: string;
  shouldWait: boolean;
  returnTrip: boolean;
  status: 'Pending' | 'Assigned' | 'Completed' | 'Cancelled';
  driverId: string | null;
  vehicleId: string | null;
  attachmentName?: string;
  attachmentUrl?: string;
  remarks?: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  serviceType: 'Perlu Driver' | 'Self-Drive';
  vehiclePreference?: string; // Nama kenderaan pilihan, atau 'Bebas'. Hanya relevan bila serviceType = 'Perlu Driver'.
  icNumber?: string; // No. IC untuk rekod lesen memandu. Hanya relevan bila serviceType = 'Self-Drive'.
  recurrenceId?: string; // To group recurring bookings
  recurrence?: {
    frequency: 'weekly' | 'bi-weekly' | 'monthly';
    endDate: string;
  };
  startOdometer?: number;
  endOdometer?: number;
  distance?: number;
  calendarEventId?: string;
}

export interface FuelLog {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  liters: number;
  cost: number;
  pricePerLiter: number;
  receiptAttachmentName?: string;
  receiptAttachmentUrl?: string;
}

export interface OdometerLog {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  odometer: number;
  purpose?: string;
}

export interface IssueLog {
  id: string;
  vehicleId: string;
  odometer: number;
  issueTitle: string;
  issueDescription: string;
  reportedDate: string; // ISO string
  reportedById: string;
  comments?: string;
  photoUrl?: string;
  photoName?: string;
  priority: 'Low' | 'Medium' | 'High';
  isVehicleOutOfService: boolean;
  status: 'Open' | 'In Progress' | 'Resolved';
}

export interface DriverSchedule {
  id: string;
  Date: string;     // 'yyyy-MM-dd'
  DriverId: string;
  Mula: string;     // 'HH:mm'
  Tamat: string;    // 'HH:mm'
}

export type CurrentUser = {
  id: string;
  name: string;
  role: 'admin' | 'driver' | 'staff';
};

export interface BookingHistory {
  bookingId: string;
  previousState: Booking;
}
