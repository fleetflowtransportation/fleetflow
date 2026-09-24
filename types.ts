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
  tenantId?: string;
}

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string;
  photoUrl?: string;
  specifications?: string;
  tenantId?: string;
}

export type PassengerCategory = 'Staff' | 'Kids' | 'Teenagers' | 'Adults' | 'Others';

export const PASSENGER_CATEGORIES: PassengerCategory[] = ['Staff', 'Kids', 'Teenagers', 'Adults', 'Others'];

export interface PassengerCount {
  category: PassengerCategory;
  count: number;
}

export const DEPARTMENTS = ['Management', 'Program', 'ALPD', 'Care Provider', 'Social Worker', 'Warden', 'PJBA'];

export const PICKUP_POINTS = ['YCK', 'PJBA', 'Other Location (Please Specify)'];

export interface Booking {
  id:string;
  destination: string;
  purpose: string;
  dateTime: string;
  finishDateTime?: string;
  pickupPoint: string;
  address: string;
  passengers: PassengerCount[];
  escort?: string;
  shouldWait: boolean;
  returnTrip?: boolean;
  status: 'Pending' | 'Assigned' | 'Confirmed' | 'Conflict' | 'Completed' | 'Cancelled';
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
  calendarEventTitle?: string;
  calendarColor?: string;
  adminNotes?: string;
  conflictReason?: string;
  isPreWorkingHour?: boolean;
  warningNotes?: string;
  tenantId?: string;
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
  tenantId?: string;
}

export interface OdometerLog {
  id: string;
  driverId: string;
  vehicleId: string;
  date: string;
  odometer: number; // Odometer Tamat (bacaan akhir selepas perjalanan)
  purpose?: string; // Tujuan Perjalanan
  fromLocation?: string; // Lokasi Dari
  toLocation?: string; // Lokasi Ke
  startOdometer?: number; // Odometer Mula
  distance?: number; // Auto: odometer (Tamat) - startOdometer
  remarks?: string; // Catatan Tambahan
  bookingId?: string; // ID tempahan yang diselesaikan
  bookingIds?: string[]; // Senarai ID tempahan yang diselesaikan serentak
  tenantId?: string;
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
  tenantId?: string;
}

export type MaintenanceCategory = 'Engine' | 'Transmission' | 'Brakes' | 'Tires' | 'Electrical' | 'Inspection' | 'General' | 'Other';

export interface MaintenanceInterval {
  id: string;
  vehicleId: string;
  serviceName: string; // e.g. "Engine Oil & Oil Filter", "Transmission / Gearbox Fluid"
  category: MaintenanceCategory;
  intervalKm: number; // e.g. 5000 or 10000 km (0 if time-only)
  intervalMonths: number; // e.g. 6 or 12 months (0 if km-only)
  lastServiceDate: string; // 'YYYY-MM-DD'
  lastServiceOdometer: number; // Odometer reading at last service
  nextDueOdometer?: number; // Calculated or custom target km
  nextDueDate?: string; // Calculated or custom target date 'YYYY-MM-DD'
  estimatedCost?: number; // Estimated cost in RM
  notes?: string; // e.g. "Fully Synthetic 5W-30 SN/CF, 4.0L with OEM filter"
  tenantId?: string;
}

export interface MaintenanceLog {
  id: string;
  vehicleId: string;
  serviceDate: string; // 'YYYY-MM-DD'
  odometer: number;
  serviceType: 'Scheduled Maintenance' | 'Unscheduled Repair' | 'Inspection' | 'Tire Service' | 'Emergency Repair';
  serviceItems: string[]; // e.g. ["Engine Oil & Oil Filter", "Air Filter"]
  workshopName: string; // e.g. "Perodua Service Pandan", "Bengkel Maju Jaya"
  invoiceNumber?: string;
  totalCost: number; // in RM
  performedBy?: string;
  remarks?: string;
  receiptUrl?: string;
  tenantId?: string;
}

export interface DriverSchedule {
  id: string;
  Date: string;     // 'yyyy-MM-dd'
  DriverId: string;
  Mula: string;     // 'HH:mm'
  Tamat: string;    // 'HH:mm'
  tenantId?: string;
}

export type CurrentUser = {
  id: string;
  name: string;
  role: 'admin' | 'driver' | 'staff';
  tenantId?: string;
};

export interface Tenant {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  googleAppsScriptUrl?: string;
  googleCalendarId?: string;
  googleDriveId?: string;
  // Profile fields for company/organization
  companyName?: string;
  registrationNumber?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  postcode?: string;
  city?: string;
  state?: string;
  website?: string;
  picName?: string;
  picPhone?: string;
  description?: string;
  logoUrl?: string;
}

export interface BookingHistory {
  bookingId: string;
  previousState: Booking;
}

export interface SelfDriveStaff {
  id: string;
  name: string;
  phone: string;
  department: string;
  icNumber: string;
  icAttachmentName?: string;
  icAttachmentUrl?: string;
  licenseAttachmentName?: string;
  licenseAttachmentUrl?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  tenantId?: string;
}
