export interface UserStatusLog {
  id: string;
  action: 'created' | 'deactivated' | 'reactivated' | 'updated';
  timestamp: string;      // ISO String
  performedBy: string;    // Admin name or email
  effectiveDate?: string; // Date of termination or reactivation
  reason?: string;        // Notes/reason provided by Admin
  previousStatus?: 'active' | 'inactive';
  newStatus: 'active' | 'inactive';
}

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
  isOwner?: boolean;
  employmentType?: 'full_time' | 'part_time'; // Default: 'full_time'
  terminationDate?: string;                   // ISO Date e.g. '2026-10-31'
  terminationReason?: string;                 // Notes / reasons for termination
  reactivationDate?: string;                  // ISO Date e.g. '2026-11-01'
  reactivationReason?: string;                // Notes / reasons for reactivation
  statusHistory?: UserStatusLog[];            // Chronological audit log
}

export type VehicleType = 
  | 'Sedan' 
  | 'SUV' 
  | 'MPV' 
  | 'Van' 
  | 'Lorry 1-Ton' 
  | 'Lorry 3-Ton' 
  | 'Prime Mover' 
  | 'Motorcycle' 
  | 'Pickup Truck';

export const VEHICLE_TYPES: VehicleType[] = [
  'Sedan',
  'SUV',
  'MPV',
  'Van',
  'Lorry 1-Ton',
  'Lorry 3-Ton',
  'Prime Mover',
  'Motorcycle',
  'Pickup Truck'
];

export type VehicleOwnershipType = 'Owned' | 'Leased' | 'Rented';
export const VEHICLE_OWNERSHIP_TYPES: VehicleOwnershipType[] = ['Owned', 'Leased', 'Rented'];

export type VehicleOperationalStatus = 'Active' | 'Under Maintenance' | 'Inactive' | 'Sold';
export const VEHICLE_OPERATIONAL_STATUSES: VehicleOperationalStatus[] = ['Active', 'Under Maintenance', 'Inactive', 'Sold'];

export type FuelType = 'Diesel' | 'Petrol' | 'EV' | 'Hybrid';
export const FUEL_TYPES: FuelType[] = ['Diesel', 'Petrol', 'EV', 'Hybrid'];

export interface Vehicle {
  id: string;
  name: string; // vehicle_name
  plateNumber: string; // plate_number (unique)
  vinChassisNumber?: string; // vin_chassis_number
  engineNumber?: string; // engine_number
  photoUrl?: string; // vehicle_photo URL / blob
  photoName?: string;
  vehicleType?: VehicleType; // vehicle_type
  brandMake?: string; // brand_make
  manufactureYear?: number; // manufacture_year
  ownershipType?: VehicleOwnershipType; // ownership_type
  vehicleStatus?: VehicleOperationalStatus; // vehicle_status
  assignedBranch?: string; // assigned_branch
  assignedDriverId?: string; // assigned_driver_id
  fuelType?: FuelType; // fuel_type
  fuelCardNumber?: string; // fuel_card_number
  currentOdometer?: number; // current_odometer (km)
  maxPayloadCapacityKg?: number; // max_payload_capacity_kg
  engineCapacityCc?: number; // engine_capacity_cc
  roadTaxExpiry?: string; // road_tax_expiry (YYYY-MM-DD)
  insuranceExpiry?: string; // insurance_expiry (YYYY-MM-DD)
  puspakomExpiry?: string; // puspakom_expiry (YYYY-MM-DD)
  permitExpiry?: string; // permit_expiry (YYYY-MM-DD)
  grantAttachmentUrl?: string; // grant_document
  grantAttachmentName?: string;
  seatingCapacity?: number; // seating capacity
  specifications?: string;
  tenantId?: string;
}

export type ComplianceType = 'Insurance' | 'Road Tax' | 'PUSPAKOM' | 'Permit';
export const COMPLIANCE_TYPES: ComplianceType[] = ['Insurance', 'Road Tax', 'PUSPAKOM', 'Permit'];

export interface VehicleRenewal {
  id: string;
  vehicleId: string; // Foreign Key -> vehicles.id
  complianceType: ComplianceType; // Enum: Insurance, Road Tax, PUSPAKOM, Permit
  oldExpiryDate?: string; // Date (YYYY-MM-DD)
  newExpiryDate: string; // Date, Required (YYYY-MM-DD)
  renewalDate: string; // Date, Required - Defaults to Today (YYYY-MM-DD)
  costAmount: number; // Decimal/Currency RM, Required
  providerAgentName?: string; // Text, Optional - e.g., Etiqa, Allianz, MyEG
  receiptPolicyDocumentUrl?: string; // File Upload - PDF/Image, Optional
  receiptPolicyDocumentName?: string;
  remarks?: string; // Textarea, Optional
  createdBy?: string; // User ID / Name of the Admin
  createdAt?: string; // Timestamps
  updatedAt?: string;
  tenantId?: string;
}

export type PassengerCategory = 'Staff' | 'Kids' | 'Teenagers' | 'Parents' | 'Adults' | 'Others';

export const PASSENGER_CATEGORIES: PassengerCategory[] = ['Staff', 'Kids', 'Teenagers', 'Parents', 'Adults', 'Others'];

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
  staffName?: string; // Nama pemandu / staf (e.g. Unknown atau pemandu luar)
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
  isOwner?: boolean;
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
  regNumber?: string;
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
  operatingHours?: string;
  timezone?: string;
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
