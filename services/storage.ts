import type { Booking, FuelLog, OdometerLog, User, Vehicle, IssueLog, DriverSchedule, Tenant, SelfDriveStaff, MaintenanceInterval, MaintenanceLog } from '../types';
import { USERS, VEHICLES, INITIAL_BOOKINGS, INITIAL_DRIVER_SCHEDULES, INITIAL_MAINTENANCE_INTERVALS, INITIAL_MAINTENANCE_LOGS } from '../constants';
import { supabase } from './supabaseClient';

let currentTenantId = 'yayasan-chow-kit';

export const getTenantId = () => currentTenantId;
export const setTenantId = (id: string) => {
  currentTenantId = id;
};

// Helper: Convert User TS to DB
const toDbUser = (u: Partial<User>) => ({
  ...(u.id && { id: u.id }),
  ...(u.name !== undefined && { name: u.name }),
  ...(u.email !== undefined && { email: u.email }),
  ...(u.phone !== undefined && { phone: u.phone }),
  ...(u.joiningDate !== undefined && { joining_date: u.joiningDate }),
  ...(u.address !== undefined && { address: u.address }),
  ...(u.comments !== undefined && { comments: u.comments }),
  ...(u.role !== undefined && { role: u.role }),
  ...(u.status !== undefined && { status: u.status }),
  ...(u.password !== undefined && { password: u.password }),
  tenant_id: u.tenantId || getTenantId(),
});

// Helper: Convert DB User to TS
const fromDbUser = (row: any): User => ({
  id: row.id,
  name: row.name,
  email: row.email,
  phone: row.phone || '',
  joiningDate: row.joining_date || new Date().toISOString().split('T')[0],
  address: row.address || '',
  comments: row.comments || undefined,
  role: row.role as 'admin' | 'driver',
  status: row.status as 'active' | 'inactive',
  password: row.password || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert Vehicle TS to DB
const toDbVehicle = (v: Partial<Vehicle>) => ({
  ...(v.id && { id: v.id }),
  ...(v.name !== undefined && { name: v.name }),
  ...(v.plateNumber !== undefined && { plate_number: v.plateNumber }),
  ...(v.photoUrl !== undefined && { photo_url: v.photoUrl }),
  ...(v.specifications !== undefined && { specifications: v.specifications }),
  tenant_id: v.tenantId || getTenantId(),
});

// Helper: Convert DB Vehicle to TS
const fromDbVehicle = (row: any): Vehicle => ({
  id: row.id,
  name: row.name,
  plateNumber: row.plate_number,
  photoUrl: row.photo_url || undefined,
  specifications: row.specifications || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert Booking TS to DB
const toDbBooking = (b: Partial<Booking>) => ({
  ...(b.id && { id: b.id }),
  ...(b.destination !== undefined && { destination: b.destination }),
  ...(b.purpose !== undefined && { purpose: b.purpose }),
  ...(b.dateTime !== undefined && { date_time: b.dateTime }),
  ...(b.finishDateTime !== undefined && { finish_date_time: b.finishDateTime }),
  ...(b.pickupPoint !== undefined && { pickup_point: b.pickupPoint }),
  ...(b.address !== undefined && { address: b.address }),
  ...(b.passengers !== undefined && { passengers: b.passengers }),
  ...(b.escort !== undefined && { escort: b.escort }),
  ...(b.shouldWait !== undefined && { should_wait: b.shouldWait }),
  ...(b.returnTrip !== undefined && { return_trip: b.returnTrip }),
  ...(b.status !== undefined && { status: b.status }),
  ...(b.driverId !== undefined && { driver_id: b.driverId }),
  ...(b.vehicleId !== undefined && { vehicle_id: b.vehicleId }),
  ...(b.attachmentName !== undefined && { attachment_name: b.attachmentName }),
  ...(b.attachmentUrl !== undefined && { attachment_url: b.attachmentUrl }),
  ...(b.remarks !== undefined && { remarks: b.remarks }),
  ...(b.requesterName !== undefined && { requester_name: b.requesterName }),
  ...(b.requesterEmail !== undefined && { requester_email: b.requesterEmail }),
  ...(b.department !== undefined && { department: b.department }),
  ...(b.serviceType !== undefined && { service_type: b.serviceType }),
  ...(b.vehiclePreference !== undefined && { vehicle_preference: b.vehiclePreference }),
  ...(b.icNumber !== undefined && { ic_number: b.icNumber }),
  ...(b.recurrenceId !== undefined && { recurrence_id: b.recurrenceId }),
  ...(b.recurrence !== undefined && { recurrence: b.recurrence }),
  ...(b.startOdometer !== undefined && { start_odometer: b.startOdometer }),
  ...(b.endOdometer !== undefined && { end_odometer: b.endOdometer }),
  ...(b.distance !== undefined && { distance: b.distance }),
  ...(b.calendarEventId !== undefined && { calendar_event_id: b.calendarEventId }),
  ...(b.calendarEventTitle !== undefined && { calendar_event_title: b.calendarEventTitle }),
  ...(b.calendarColor !== undefined && { calendar_color: b.calendarColor }),
  ...(b.adminNotes !== undefined && { admin_notes: b.adminNotes }),
  ...(b.conflictReason !== undefined && { conflict_reason: b.conflictReason }),
  ...(b.isPreWorkingHour !== undefined && { is_pre_working_hour: b.isPreWorkingHour }),
  ...(b.warningNotes !== undefined && { warning_notes: b.warningNotes }),
  ...(b.tenantId !== undefined ? { tenant_id: b.tenantId } : (b.id ? {} : { tenant_id: getTenantId() })),
});

// Helper: Convert DB Booking to TS
const fromDbBooking = (row: any): Booking => ({
  id: row.id,
  destination: row.destination,
  purpose: row.purpose,
  dateTime: row.date_time,
  finishDateTime: row.finish_date_time || undefined,
  pickupPoint: row.pickup_point,
  address: row.address,
  passengers: row.passengers || [],
  escort: row.escort || undefined,
  shouldWait: Boolean(row.should_wait),
  returnTrip: row.return_trip !== undefined ? Boolean(row.return_trip) : undefined,
  status: row.status as Booking['status'],
  driverId: row.driver_id || null,
  vehicleId: row.vehicle_id || null,
  attachmentName: row.attachment_name || undefined,
  attachmentUrl: row.attachment_url || undefined,
  remarks: row.remarks || undefined,
  requesterName: row.requester_name || '',
  requesterEmail: row.requester_email || '',
  department: row.department || '',
  serviceType: (row.service_type || 'Perlu Driver') as Booking['serviceType'],
  vehiclePreference: row.vehicle_preference || undefined,
  icNumber: row.ic_number || undefined,
  recurrenceId: row.recurrence_id || undefined,
  recurrence: row.recurrence || undefined,
  startOdometer: row.start_odometer ? Number(row.start_odometer) : undefined,
  endOdometer: row.end_odometer ? Number(row.end_odometer) : undefined,
  distance: row.distance ? Number(row.distance) : undefined,
  calendarEventId: row.calendar_event_id || undefined,
  calendarEventTitle: row.calendar_event_title || undefined,
  calendarColor: row.calendar_color || undefined,
  adminNotes: row.admin_notes || undefined,
  conflictReason: row.conflict_reason || undefined,
  isPreWorkingHour: Boolean(row.is_pre_working_hour),
  warningNotes: row.warning_notes || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert FuelLog TS to DB
const toDbFuelLog = (f: Partial<FuelLog>) => ({
  ...(f.id && { id: f.id }),
  ...(f.driverId !== undefined && { driver_id: f.driverId }),
  ...(f.vehicleId !== undefined && { vehicle_id: f.vehicleId }),
  ...(f.date !== undefined && { date: f.date }),
  ...(f.odometer !== undefined && { odometer: f.odometer }),
  ...(f.liters !== undefined && { liters: f.liters }),
  ...(f.cost !== undefined && { cost: f.cost }),
  ...(f.pricePerLiter !== undefined && { price_per_liter: f.pricePerLiter }),
  ...(f.receiptAttachmentName !== undefined && { receipt_attachment_name: f.receiptAttachmentName }),
  ...(f.receiptAttachmentUrl !== undefined && { receipt_attachment_url: f.receiptAttachmentUrl }),
  tenant_id: f.tenantId || getTenantId(),
});

const fromDbFuelLog = (row: any): FuelLog => ({
  id: row.id,
  driverId: row.driver_id,
  vehicleId: row.vehicle_id,
  date: row.date,
  odometer: Number(row.odometer),
  liters: Number(row.liters),
  cost: Number(row.cost),
  pricePerLiter: Number(row.price_per_liter),
  receiptAttachmentName: row.receipt_attachment_name || undefined,
  receiptAttachmentUrl: row.receipt_attachment_url || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert OdometerLog TS to DB
const toDbOdometerLog = (o: Partial<OdometerLog>) => ({
  ...(o.id && { id: o.id }),
  ...(o.driverId !== undefined && { driver_id: o.driverId }),
  ...(o.vehicleId !== undefined && { vehicle_id: o.vehicleId }),
  ...(o.date !== undefined && { date: o.date }),
  ...(o.odometer !== undefined && { odometer: o.odometer }),
  ...(o.purpose !== undefined && { purpose: o.purpose }),
  ...(o.fromLocation !== undefined && { from_location: o.fromLocation }),
  ...(o.toLocation !== undefined && { to_location: o.toLocation }),
  ...(o.startOdometer !== undefined && { start_odometer: o.startOdometer }),
  ...(o.distance !== undefined && { distance: o.distance }),
  ...(o.remarks !== undefined && { remarks: o.remarks }),
  ...(o.bookingId !== undefined && { booking_id: o.bookingId }),
  ...(o.bookingIds !== undefined && { booking_ids: o.bookingIds }),
  tenant_id: o.tenantId || getTenantId(),
});

const fromDbOdometerLog = (row: any): OdometerLog => ({
  id: row.id,
  driverId: row.driver_id,
  vehicleId: row.vehicle_id,
  date: row.date,
  odometer: Number(row.odometer),
  purpose: row.purpose || undefined,
  fromLocation: row.from_location || undefined,
  toLocation: row.to_location || undefined,
  startOdometer: row.start_odometer ? Number(row.start_odometer) : undefined,
  distance: row.distance ? Number(row.distance) : undefined,
  remarks: row.remarks || undefined,
  bookingId: row.booking_id || undefined,
  bookingIds: row.booking_ids || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert IssueLog TS to DB
const toDbIssueLog = (i: Partial<IssueLog>) => ({
  ...(i.id && { id: i.id }),
  ...(i.vehicleId !== undefined && { vehicle_id: i.vehicleId }),
  ...(i.odometer !== undefined && { odometer: i.odometer }),
  ...(i.issueTitle !== undefined && { issue_title: i.issueTitle }),
  ...(i.issueDescription !== undefined && { issue_description: i.issueDescription }),
  ...(i.reportedDate !== undefined && { reported_date: i.reportedDate }),
  ...(i.reportedById !== undefined && { reported_by_id: i.reportedById }),
  ...(i.comments !== undefined && { comments: i.comments }),
  ...(i.photoUrl !== undefined && { photo_url: i.photoUrl }),
  ...(i.photoName !== undefined && { photo_name: i.photoName }),
  ...(i.priority !== undefined && { priority: i.priority }),
  ...(i.isVehicleOutOfService !== undefined && { is_vehicle_out_of_service: i.isVehicleOutOfService }),
  ...(i.status !== undefined && { status: i.status }),
  tenant_id: i.tenantId || getTenantId(),
});

const fromDbIssueLog = (row: any): IssueLog => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  odometer: Number(row.odometer),
  issueTitle: row.issue_title,
  issueDescription: row.issue_description,
  reportedDate: row.reported_date,
  reportedById: row.reported_by_id,
  comments: row.comments || undefined,
  photoUrl: row.photo_url || undefined,
  photoName: row.photo_name || undefined,
  priority: row.priority as IssueLog['priority'],
  isVehicleOutOfService: Boolean(row.is_vehicle_out_of_service),
  status: row.status as IssueLog['status'],
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert DriverSchedule TS to DB
const toDbDriverSchedule = (s: Partial<DriverSchedule>) => ({
  ...(s.id && { id: s.id }),
  ...(s.Date !== undefined && { date: s.Date }),
  ...(s.DriverId !== undefined && { driver_id: s.DriverId }),
  ...(s.Mula !== undefined && { mula: s.Mula }),
  ...(s.Tamat !== undefined && { tamat: s.Tamat }),
  tenant_id: s.tenantId || getTenantId(),
});

const fromDbDriverSchedule = (row: any): DriverSchedule => ({
  id: row.id,
  Date: row.date,
  DriverId: row.driver_id,
  Mula: row.mula,
  Tamat: row.tamat,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert SelfDriveStaff TS to DB
const toDbSelfDriveStaff = (s: Partial<SelfDriveStaff>) => ({
  ...(s.id && { id: s.id }),
  ...(s.name !== undefined && { name: s.name }),
  ...(s.phone !== undefined && { phone: s.phone }),
  ...(s.department !== undefined && { department: s.department }),
  ...(s.icNumber !== undefined && { ic_number: s.icNumber }),
  ...(s.icAttachmentName !== undefined && { ic_attachment_name: s.icAttachmentName }),
  ...(s.icAttachmentUrl !== undefined && { ic_attachment_url: s.icAttachmentUrl }),
  ...(s.licenseAttachmentName !== undefined && { license_attachment_name: s.licenseAttachmentName }),
  ...(s.licenseAttachmentUrl !== undefined && { license_attachment_url: s.licenseAttachmentUrl }),
  ...(s.notes !== undefined && { notes: s.notes }),
  ...(s.status !== undefined && { status: s.status }),
  ...(s.createdAt !== undefined && { created_at: s.createdAt }),
  tenant_id: s.tenantId || getTenantId(),
});

const fromDbSelfDriveStaff = (row: any): SelfDriveStaff => ({
  id: row.id,
  name: row.name,
  phone: row.phone || '',
  department: row.department || '',
  icNumber: row.ic_number || '',
  icAttachmentName: row.ic_attachment_name || undefined,
  icAttachmentUrl: row.ic_attachment_url || undefined,
  licenseAttachmentName: row.license_attachment_name || undefined,
  licenseAttachmentUrl: row.license_attachment_url || undefined,
  notes: row.notes || undefined,
  status: (row.status as 'active' | 'inactive') || 'active',
  createdAt: row.created_at || new Date().toISOString(),
  tenantId: row.tenant_id || getTenantId(),
});

const INITIAL_SELF_DRIVE_STAFF: SelfDriveStaff[] = [
  {
    id: 'staff-sds-01',
    name: 'Siti Nurhaliza binti Ahmad',
    phone: '+6013-4567890',
    department: 'Program',
    icNumber: '920815-10-5432',
    icAttachmentName: 'ic_siti_nurhaliza.pdf',
    licenseAttachmentName: 'driving_license_siti.pdf',
    status: 'active',
    notes: 'Authorized self-drive staff for community outreach and errand trips.',
    createdAt: '2026-01-10T08:00:00.000Z',
    tenantId: 'yayasan-chow-kit'
  },
  {
    id: 'staff-sds-02',
    name: 'Mohd Farhan bin Razali',
    phone: '+6017-8899001',
    department: 'ALPD',
    icNumber: '880324-14-6789',
    icAttachmentName: 'ic_farhan_razali.jpg',
    licenseAttachmentName: 'driving_license_farhan.jpg',
    status: 'active',
    notes: 'Approved for Alza usage during official youth development activities.',
    createdAt: '2026-02-15T09:30:00.000Z',
    tenantId: 'yayasan-chow-kit'
  }
];

// Helper: Convert MaintenanceInterval TS to DB
const toDbMaintenanceInterval = (m: Partial<MaintenanceInterval>) => ({
  ...(m.id && { id: m.id }),
  ...(m.vehicleId !== undefined && { vehicle_id: m.vehicleId }),
  ...(m.serviceName !== undefined && { service_name: m.serviceName }),
  ...(m.category !== undefined && { category: m.category }),
  ...(m.intervalKm !== undefined && { interval_km: m.intervalKm }),
  ...(m.intervalMonths !== undefined && { interval_months: m.intervalMonths }),
  ...(m.lastServiceDate !== undefined && { last_service_date: m.lastServiceDate }),
  ...(m.lastServiceOdometer !== undefined && { last_service_odometer: m.lastServiceOdometer }),
  ...(m.nextDueOdometer !== undefined && { next_due_odometer: m.nextDueOdometer }),
  ...(m.nextDueDate !== undefined && { next_due_date: m.nextDueDate }),
  ...(m.estimatedCost !== undefined && { estimated_cost: m.estimatedCost }),
  ...(m.notes !== undefined && { notes: m.notes }),
  tenant_id: m.tenantId || getTenantId(),
});

const fromDbMaintenanceInterval = (row: any): MaintenanceInterval => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  serviceName: row.service_name,
  category: row.category || 'General',
  intervalKm: Number(row.interval_km || 0),
  intervalMonths: Number(row.interval_months || 0),
  lastServiceDate: row.last_service_date || '',
  lastServiceOdometer: Number(row.last_service_odometer || 0),
  nextDueOdometer: row.next_due_odometer ? Number(row.next_due_odometer) : undefined,
  nextDueDate: row.next_due_date || undefined,
  estimatedCost: row.estimated_cost ? Number(row.estimated_cost) : undefined,
  notes: row.notes || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

// Helper: Convert MaintenanceLog TS to DB
const toDbMaintenanceLog = (l: Partial<MaintenanceLog>) => ({
  ...(l.id && { id: l.id }),
  ...(l.vehicleId !== undefined && { vehicle_id: l.vehicleId }),
  ...(l.serviceDate !== undefined && { service_date: l.serviceDate }),
  ...(l.odometer !== undefined && { odometer: l.odometer }),
  ...(l.serviceType !== undefined && { service_type: l.serviceType }),
  ...(l.serviceItems !== undefined && { service_items: l.serviceItems }),
  ...(l.workshopName !== undefined && { workshop_name: l.workshopName }),
  ...(l.invoiceNumber !== undefined && { invoice_number: l.invoiceNumber }),
  ...(l.totalCost !== undefined && { total_cost: l.totalCost }),
  ...(l.performedBy !== undefined && { performed_by: l.performedBy }),
  ...(l.remarks !== undefined && { remarks: l.remarks }),
  ...(l.receiptUrl !== undefined && { receipt_url: l.receiptUrl }),
  tenant_id: l.tenantId || getTenantId(),
});

const fromDbMaintenanceLog = (row: any): MaintenanceLog => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  serviceDate: row.service_date,
  odometer: Number(row.odometer || 0),
  serviceType: row.service_type || 'Scheduled Maintenance',
  serviceItems: Array.isArray(row.service_items) ? row.service_items : (row.service_items ? JSON.parse(row.service_items) : []),
  workshopName: row.workshop_name || '',
  invoiceNumber: row.invoice_number || undefined,
  totalCost: Number(row.total_cost || 0),
  performedBy: row.performed_by || undefined,
  remarks: row.remarks || undefined,
  receiptUrl: row.receipt_url || undefined,
  tenantId: row.tenant_id || getTenantId(),
});

export const storageService = {
  getTenantId,
  setTenantId,
  getUserByEmailGlobal: async (email: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('fleet_users')
        .select('*')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle();
      if (error) {
        console.warn('[Supabase] getUserByEmailGlobal query error:', error.message);
        return null;
      }
      if (!data) return null;
      return fromDbUser(data);
    } catch (err: any) {
      console.warn('[Supabase] getUserByEmailGlobal exception:', err.message);
      return null;
    }
  },
  // ---- READ ----
  getUsers: async (): Promise<User[]> => {
    try {
      const { data, error } = await supabase.from('fleet_users').select('*').eq('tenant_id', getTenantId()).order('created_at', { ascending: true });
      if (error) {
        console.warn('[Supabase] getUsers query error, falling back to defaults:', error.message);
        return USERS;
      }
      if (!data || data.length === 0) {
        console.log('[Supabase] Seeding initial users into fleet_users table...');
        const dbRows = USERS.map(toDbUser);
        const { error: insertError } = await supabase.from('fleet_users').insert(dbRows);
        if (insertError) {
          console.error('[Supabase] Failed to seed initial users:', insertError.message);
        }
        return USERS;
      }
      return data.map(fromDbUser);
    } catch (err: any) {
      console.warn('[Supabase] getUsers network exception:', err.message);
      return USERS;
    }
  },

  getVehicles: async (): Promise<Vehicle[]> => {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').eq('tenant_id', getTenantId()).order('created_at', { ascending: true });
      if (error) {
        console.warn('[Supabase] getVehicles query error, falling back to defaults:', error.message);
        return VEHICLES;
      }
      if (!data || data.length === 0) {
        console.log('[Supabase] Seeding initial vehicles into vehicles table...');
        const dbRows = VEHICLES.map(toDbVehicle);
        const { error: insertError } = await supabase.from('vehicles').insert(dbRows);
        if (insertError) {
          console.error('[Supabase] Failed to seed initial vehicles:', insertError.message);
        }
        return VEHICLES;
      }
      return data.map(fromDbVehicle);
    } catch (err: any) {
      console.warn('[Supabase] getVehicles network exception:', err.message);
      return VEHICLES;
    }
  },

  getBookings: async (): Promise<Booking[]> => {
    try {
      const { data, error } = await supabase.from('bookings').select('*').eq('tenant_id', getTenantId()).order('date_time', { ascending: true });
      if (error) {
        console.warn('[Supabase] getBookings fallback:', error.message);
        return INITIAL_BOOKINGS;
      }
      if (!data || data.length === 0) {
        return [];
      }
      return data.map(fromDbBooking);
    } catch (err: any) {
      console.warn('[Supabase] getBookings network exception:', err.message);
      return INITIAL_BOOKINGS;
    }
  },

  getFuelLogs: async (): Promise<FuelLog[]> => {
    try {
      const { data, error } = await supabase.from('fuel_logs').select('*').eq('tenant_id', getTenantId()).order('date', { ascending: false });
      if (error) {
        console.warn('[Supabase] getFuelLogs error:', error.message);
        return [];
      }
      return (data || []).map(fromDbFuelLog);
    } catch (err: any) {
      console.warn('[Supabase] getFuelLogs network exception:', err.message);
      return [];
    }
  },

  getOdometerLogs: async (): Promise<OdometerLog[]> => {
    try {
      const { data, error } = await supabase.from('odometer_logs').select('*').eq('tenant_id', getTenantId()).order('date', { ascending: false });
      if (error) {
        console.warn('[Supabase] getOdometerLogs error:', error.message);
        return [];
      }
      return (data || []).map(fromDbOdometerLog);
    } catch (err: any) {
      console.warn('[Supabase] getOdometerLogs network exception:', err.message);
      return [];
    }
  },

  getIssueLogs: async (): Promise<IssueLog[]> => {
    try {
      const { data, error } = await supabase.from('issue_logs').select('*').eq('tenant_id', getTenantId()).order('reported_date', { ascending: false });
      if (error) {
        console.warn('[Supabase] getIssueLogs error:', error.message);
        return [];
      }
      return (data || []).map(fromDbIssueLog);
    } catch (err: any) {
      console.warn('[Supabase] getIssueLogs network exception:', err.message);
      return [];
    }
  },

  getDriverSchedules: async (): Promise<DriverSchedule[]> => {
    try {
      const { data, error } = await supabase.from('driver_schedules').select('*').eq('tenant_id', getTenantId()).order('date', { ascending: true });
      if (error) {
        console.warn('[Supabase] getDriverSchedules query error:', error.message);
        return [];
      }
      return (data || []).map(fromDbDriverSchedule);
    } catch (err: any) {
      console.warn('[Supabase] getDriverSchedules exception:', err.message);
      return [];
    }
  },

  getSelfDriveStaff: async (): Promise<SelfDriveStaff[]> => {
    const tenantId = getTenantId();
    // 1. Check local storage cache
    let localList: SelfDriveStaff[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_self_drive_staff_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      } else if (tenantId === 'yayasan-chow-kit') {
        localList = INITIAL_SELF_DRIVE_STAFF;
        localStorage.setItem(`fleetflow_self_drive_staff_${tenantId}`, JSON.stringify(localList));
      }
    } catch {
      // ignore
    }

    try {
      const { data, error } = await supabase
        .from('self_drive_staff')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (!error && data && data.length > 0) {
        const dbItems = data.map(fromDbSelfDriveStaff);
        try {
          localStorage.setItem(`fleetflow_self_drive_staff_${tenantId}`, JSON.stringify(dbItems));
        } catch {
          // ignore
        }
        return dbItems;
      }
    } catch (err: any) {
      // ignore supabase table missing or network error
    }

    return localList;
  },

  // ---- WRITE (BOOKINGS) ----
  createBooking: async (data: Booking): Promise<Booking> => {
    try {
      const dbRow = toDbBooking(data);
      const { error } = await supabase.from('bookings').insert([dbRow]);
      if (error) {
        console.error('[Supabase] createBooking error:', error.message);
      }
    } catch (err: any) {
      console.error('[Supabase] createBooking exception:', err.message);
    }
    return data;
  },

  updateBooking: async (data: Partial<Booking> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbBooking(data);
      const { error } = await supabase.from('bookings').update(dbRow).eq('id', data.id);
      if (error) {
        console.error('[Supabase] updateBooking error:', error.message);
        throw new Error(error.message);
      }
    } catch (err: any) {
      console.error('[Supabase] updateBooking exception:', err.message);
      throw err;
    }
    return data;
  },

  deleteBooking: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('bookings').delete().eq('id', id);
      if (error) {
        console.error('[Supabase] deleteBooking error:', error.message);
      }
    } catch (err: any) {
      console.error('[Supabase] deleteBooking exception:', err.message);
    }
    return { id };
  },

  deleteBookingsBulk: async (ids: string[]): Promise<string[]> => {
    if (!ids || ids.length === 0) return [];
    try {
      const { error } = await supabase.from('bookings').delete().in('id', ids);
      if (error) {
        console.error('[Supabase] deleteBookingsBulk error:', error.message);
      }
    } catch (err: any) {
      console.error('[Supabase] deleteBookingsBulk exception:', err.message);
    }
    return ids;
  },

  updateBookingsBulk: async (ids: string[], data: Partial<Booking>): Promise<void> => {
    if (!ids || ids.length === 0) return;
    try {
      const dbRow: any = toDbBooking(data as any);
      delete dbRow.id;
      delete dbRow.created_at;
      const { error } = await supabase.from('bookings').update(dbRow).in('id', ids);
      if (error) {
        console.error('[Supabase] updateBookingsBulk error:', error.message);
      }
    } catch (err: any) {
      console.error('[Supabase] updateBookingsBulk exception:', err.message);
    }
  },

  // ---- WRITE (FUEL LOGS) ----
  createFuelLog: async (data: FuelLog): Promise<FuelLog> => {
    try {
      const dbRow = toDbFuelLog(data);
      const { error } = await supabase.from('fuel_logs').insert([dbRow]);
      if (error) console.error('[Supabase] createFuelLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createFuelLog exception:', err.message);
    }
    return data;
  },

  updateFuelLog: async (data: Partial<FuelLog> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbFuelLog(data);
      const { error } = await supabase.from('fuel_logs').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateFuelLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateFuelLog exception:', err.message);
    }
    return data;
  },

  deleteFuelLog: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('fuel_logs').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteFuelLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteFuelLog exception:', err.message);
    }
    return { id };
  },

  // ---- WRITE (ODOMETER LOGS) ----
  createOdometerLog: async (data: OdometerLog): Promise<OdometerLog> => {
    try {
      const dbRow = toDbOdometerLog(data);
      const { error } = await supabase.from('odometer_logs').insert([dbRow]);
      if (error) console.error('[Supabase] createOdometerLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createOdometerLog exception:', err.message);
    }
    return data;
  },

  updateOdometerLog: async (data: Partial<OdometerLog> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbOdometerLog(data);
      const { error } = await supabase.from('odometer_logs').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateOdometerLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateOdometerLog exception:', err.message);
    }
    return data;
  },

  deleteOdometerLog: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('odometer_logs').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteOdometerLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteOdometerLog exception:', err.message);
    }
    return { id };
  },

  // ---- WRITE (ISSUE LOGS) ----
  createIssueLog: async (data: IssueLog): Promise<IssueLog> => {
    try {
      const dbRow = toDbIssueLog(data);
      const { error } = await supabase.from('issue_logs').insert([dbRow]);
      if (error) console.error('[Supabase] createIssueLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createIssueLog exception:', err.message);
    }
    return data;
  },

  updateIssueLog: async (data: Partial<IssueLog> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbIssueLog(data);
      const { error } = await supabase.from('issue_logs').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateIssueLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateIssueLog exception:', err.message);
    }
    return data;
  },

  deleteIssueLog: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('issue_logs').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteIssueLog error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteIssueLog exception:', err.message);
    }
    return { id };
  },

  // ---- WRITE (USERS) ----
  createUser: async (data: User): Promise<User> => {
    try {
      const dbRow = toDbUser(data);
      const { error } = await supabase.from('fleet_users').insert([dbRow]);
      if (error) console.error('[Supabase] createUser error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createUser exception:', err.message);
    }
    return data;
  },

  updateUser: async (data: Partial<User> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbUser(data);
      const { error } = await supabase.from('fleet_users').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateUser error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateUser exception:', err.message);
    }
    return data;
  },

  deleteUser: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('fleet_users').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteUser error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteUser exception:', err.message);
    }
    return { id };
  },

  // ---- WRITE (VEHICLES) ----
  createVehicle: async (data: Vehicle): Promise<Vehicle> => {
    try {
      const dbRow = toDbVehicle(data);
      const { error } = await supabase.from('vehicles').insert([dbRow]);
      if (error) console.error('[Supabase] createVehicle error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createVehicle exception:', err.message);
    }
    return data;
  },

  updateVehicle: async (data: Partial<Vehicle> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbVehicle(data);
      const { error } = await supabase.from('vehicles').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateVehicle error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateVehicle exception:', err.message);
    }
    return data;
  },

  deleteVehicle: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('vehicles').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteVehicle error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteVehicle exception:', err.message);
    }
    return { id };
  },

  // ---- WRITE (DRIVER SCHEDULES) ----
  createDriverSchedule: async (data: DriverSchedule): Promise<DriverSchedule> => {
    try {
      const dbRow = toDbDriverSchedule(data);
      const { error } = await supabase.from('driver_schedules').insert([dbRow]);
      if (error) console.error('[Supabase] createDriverSchedule error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] createDriverSchedule exception:', err.message);
    }
    return data;
  },

  updateDriverSchedule: async (data: Partial<DriverSchedule> & { id: string }): Promise<any> => {
    try {
      const dbRow = toDbDriverSchedule(data);
      const { error } = await supabase.from('driver_schedules').update(dbRow).eq('id', data.id);
      if (error) console.error('[Supabase] updateDriverSchedule error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] updateDriverSchedule exception:', err.message);
    }
    return data;
  },

  deleteDriverSchedule: async (id: string): Promise<{ id: string }> => {
    try {
      const { error } = await supabase.from('driver_schedules').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteDriverSchedule error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteDriverSchedule exception:', err.message);
    }
    return { id };
  },

  deleteDriverSchedulesBulk: async (ids: string[]): Promise<void> => {
    try {
      const { error } = await supabase.from('driver_schedules').delete().in('id', ids);
      if (error) console.error('[Supabase] deleteDriverSchedulesBulk error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteDriverSchedulesBulk exception:', err.message);
    }
  },

  // ---- WRITE (SELF-DRIVE STAFF) ----
  createSelfDriveStaff: async (data: SelfDriveStaff): Promise<SelfDriveStaff> => {
    const tenantId = data.tenantId || getTenantId();
    // 1. Update localStorage cache
    try {
      const raw = localStorage.getItem(`fleetflow_self_drive_staff_${tenantId}`);
      const list: SelfDriveStaff[] = raw ? JSON.parse(raw) : [];
      const updated = [data, ...list.filter(item => item.id !== data.id)];
      localStorage.setItem(`fleetflow_self_drive_staff_${tenantId}`, JSON.stringify(updated));
    } catch {
      // ignore
    }

    // 2. Try Supabase
    try {
      const dbRow = toDbSelfDriveStaff(data);
      const { error } = await supabase.from('self_drive_staff').insert([dbRow]);
      if (error) console.warn('[Supabase] createSelfDriveStaff note:', error.message);
    } catch (err: any) {
      // ignore
    }

    return data;
  },

  updateSelfDriveStaff: async (data: Partial<SelfDriveStaff> & { id: string }): Promise<any> => {
    const tenantId = data.tenantId || getTenantId();
    // 1. Update localStorage cache
    try {
      const raw = localStorage.getItem(`fleetflow_self_drive_staff_${tenantId}`);
      if (raw) {
        const list: SelfDriveStaff[] = JSON.parse(raw);
        const updated = list.map(item => item.id === data.id ? { ...item, ...data } : item);
        localStorage.setItem(`fleetflow_self_drive_staff_${tenantId}`, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    // 2. Try Supabase
    try {
      const dbRow = toDbSelfDriveStaff(data);
      const { error } = await supabase.from('self_drive_staff').update(dbRow).eq('id', data.id);
      if (error) console.warn('[Supabase] updateSelfDriveStaff note:', error.message);
    } catch (err: any) {
      // ignore
    }

    return data;
  },

  deleteSelfDriveStaff: async (id: string): Promise<{ id: string }> => {
    const tenantId = getTenantId();
    // 1. Update localStorage cache
    try {
      const raw = localStorage.getItem(`fleetflow_self_drive_staff_${tenantId}`);
      if (raw) {
        const list: SelfDriveStaff[] = JSON.parse(raw);
        const updated = list.filter(item => item.id !== id);
        localStorage.setItem(`fleetflow_self_drive_staff_${tenantId}`, JSON.stringify(updated));
      }
    } catch {
      // ignore
    }

    // 2. Try Supabase
    try {
      const { error } = await supabase.from('self_drive_staff').delete().eq('id', id);
      if (error) console.warn('[Supabase] deleteSelfDriveStaff note:', error.message);
    } catch (err: any) {
      // ignore
    }

    return { id };
  },

  // ---- MAINTENANCE INTERVALS ----
  getMaintenanceIntervals: async (): Promise<MaintenanceInterval[]> => {
    const tenantId = getTenantId();
    let localList: MaintenanceInterval[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_intervals_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      } else {
        localList = INITIAL_MAINTENANCE_INTERVALS.map(m => ({ ...m, tenantId }));
        localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(localList));
      }
    } catch {
      localList = INITIAL_MAINTENANCE_INTERVALS.map(m => ({ ...m, tenantId }));
    }

    try {
      const { data, error } = await supabase
        .from('maintenance_intervals')
        .select('*')
        .eq('tenant_id', tenantId);

      if (!error && data && data.length > 0) {
        const dbItems = data.map(fromDbMaintenanceInterval);
        try {
          localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(dbItems));
        } catch {}
        return dbItems;
      }
    } catch (err: any) {
      // ignore
    }

    return localList;
  },

  createMaintenanceInterval: async (data: MaintenanceInterval): Promise<MaintenanceInterval> => {
    const tenantId = getTenantId();
    const itemWithTenant = { ...data, tenantId: data.tenantId || tenantId };
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_intervals_${tenantId}`);
      const list: MaintenanceInterval[] = raw ? JSON.parse(raw) : [];
      list.unshift(itemWithTenant);
      localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(list));
    } catch {}

    try {
      const dbRow = toDbMaintenanceInterval(itemWithTenant);
      const { error } = await supabase.from('maintenance_intervals').insert([dbRow]);
      if (error) console.warn('[Supabase] createMaintenanceInterval note:', error.message);
    } catch {}

    return itemWithTenant;
  },

  updateMaintenanceInterval: async (data: Partial<MaintenanceInterval> & { id: string }): Promise<any> => {
    const tenantId = getTenantId();
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_intervals_${tenantId}`);
      if (raw) {
        const list: MaintenanceInterval[] = JSON.parse(raw);
        const updated = list.map(item => item.id === data.id ? { ...item, ...data } : item);
        localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const dbRow = toDbMaintenanceInterval(data);
      const { error } = await supabase.from('maintenance_intervals').update(dbRow).eq('id', data.id);
      if (error) console.warn('[Supabase] updateMaintenanceInterval note:', error.message);
    } catch {}

    return data;
  },

  deleteMaintenanceInterval: async (id: string): Promise<{ id: string }> => {
    const tenantId = getTenantId();
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_intervals_${tenantId}`);
      if (raw) {
        const list: MaintenanceInterval[] = JSON.parse(raw);
        const updated = list.filter(item => item.id !== id);
        localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const { error } = await supabase.from('maintenance_intervals').delete().eq('id', id);
      if (error) console.warn('[Supabase] deleteMaintenanceInterval note:', error.message);
    } catch {}

    return { id };
  },

  // ---- MAINTENANCE LOGS ----
  getMaintenanceLogs: async (): Promise<MaintenanceLog[]> => {
    const tenantId = getTenantId();
    let localList: MaintenanceLog[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_logs_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      } else {
        localList = INITIAL_MAINTENANCE_LOGS.map(l => ({ ...l, tenantId }));
        localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(localList));
      }
    } catch {
      localList = INITIAL_MAINTENANCE_LOGS.map(l => ({ ...l, tenantId }));
    }

    try {
      const { data, error } = await supabase
        .from('maintenance_logs')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('service_date', { ascending: false });

      if (!error && data && data.length > 0) {
        const dbItems = data.map(fromDbMaintenanceLog);
        try {
          localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(dbItems));
        } catch {}
        return dbItems;
      }
    } catch (err: any) {
      // ignore
    }

    return localList;
  },

  createMaintenanceLog: async (data: MaintenanceLog): Promise<MaintenanceLog> => {
    const tenantId = getTenantId();
    const itemWithTenant = { ...data, tenantId: data.tenantId || tenantId };
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_logs_${tenantId}`);
      const list: MaintenanceLog[] = raw ? JSON.parse(raw) : [];
      list.unshift(itemWithTenant);
      localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(list));
    } catch {}

    try {
      const dbRow = toDbMaintenanceLog(itemWithTenant);
      const { error } = await supabase.from('maintenance_logs').insert([dbRow]);
      if (error) console.warn('[Supabase] createMaintenanceLog note:', error.message);
    } catch {}

    return itemWithTenant;
  },

  updateMaintenanceLog: async (data: Partial<MaintenanceLog> & { id: string }): Promise<any> => {
    const tenantId = getTenantId();
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_logs_${tenantId}`);
      if (raw) {
        const list: MaintenanceLog[] = JSON.parse(raw);
        const updated = list.map(item => item.id === data.id ? { ...item, ...data } : item);
        localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const dbRow = toDbMaintenanceLog(data);
      const { error } = await supabase.from('maintenance_logs').update(dbRow).eq('id', data.id);
      if (error) console.warn('[Supabase] updateMaintenanceLog note:', error.message);
    } catch {}

    return data;
  },

  deleteMaintenanceLog: async (id: string): Promise<{ id: string }> => {
    const tenantId = getTenantId();
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_logs_${tenantId}`);
      if (raw) {
        const list: MaintenanceLog[] = JSON.parse(raw);
        const updated = list.filter(item => item.id !== id);
        localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const { error } = await supabase.from('maintenance_logs').delete().eq('id', id);
      if (error) console.warn('[Supabase] deleteMaintenanceLog note:', error.message);
    } catch {}

    return { id };
  },

  // ---- TENANTS & MULTITENANCY ----
  getTenant: async (id: string): Promise<Tenant | null> => {
    try {
      let localProfile: Partial<Tenant> = {};
      try {
        const rawLocal = localStorage.getItem(`fleetflow_tenant_config_${id}`);
        if (rawLocal) {
          localProfile = JSON.parse(rawLocal);
        }
      } catch {
        // ignore
      }

      const { data, error } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle();
      
      if (error) {
        console.warn('[Supabase] getTenant warning:', error.message);
      }

      let scriptUrl = data?.google_apps_script_url || localProfile.googleAppsScriptUrl || '';
      let calendarId = data?.google_calendar_id || localProfile.googleCalendarId || '';
      let driveId = data?.google_drive_id || localProfile.googleDriveId || '';
      
      let dbMetaProfile: Partial<Tenant> = {};
      if (typeof driveId === 'string' && driveId.includes(':::FF_META:::')) {
        const parts = driveId.split(':::FF_META:::');
        driveId = parts[0] || '';
        try {
          dbMetaProfile = JSON.parse(parts[1]);
        } catch {
          // ignore
        }
      }

      if (typeof calendarId === 'string' && calendarId.includes(':::')) {
        const parts = calendarId.split(':::');
        calendarId = parts[0] || '';
        driveId = parts[1] || driveId;
      }

      const merged: Tenant = {
        id,
        name: dbMetaProfile.companyName || data?.name || localProfile.companyName || localProfile.name || (id === 'yayasan-chow-kit' ? 'Yayasan Chow Kit' : id),
        status: data?.status || 'active',
        googleAppsScriptUrl: scriptUrl,
        googleCalendarId: calendarId,
        googleDriveId: driveId,
        companyName: dbMetaProfile.companyName || data?.company_name || localProfile.companyName || data?.name || (id === 'yayasan-chow-kit' ? 'Yayasan Chow Kit' : id),
        registrationNumber: dbMetaProfile.registrationNumber || data?.registration_number || localProfile.registrationNumber || (id === 'yayasan-chow-kit' ? 'PPM-012-14-11012011' : ''),
        phone: dbMetaProfile.phone || data?.phone || localProfile.phone || (id === 'yayasan-chow-kit' ? '+603-4045 5550' : ''),
        whatsapp: dbMetaProfile.whatsapp || data?.whatsapp || localProfile.whatsapp || (id === 'yayasan-chow-kit' ? '+6012-3456789' : ''),
        email: dbMetaProfile.email || data?.email || localProfile.email || (id === 'yayasan-chow-kit' ? 'info@yck.org.my' : ''),
        address: dbMetaProfile.address || data?.address || localProfile.address || (id === 'yayasan-chow-kit' ? 'No. 22B, Jalan Chow Kit, 50350 Kuala Lumpur' : ''),
        postcode: dbMetaProfile.postcode || data?.postcode || localProfile.postcode || (id === 'yayasan-chow-kit' ? '50350' : ''),
        city: dbMetaProfile.city || data?.city || localProfile.city || (id === 'yayasan-chow-kit' ? 'Kuala Lumpur' : ''),
        state: dbMetaProfile.state || data?.state || localProfile.state || (id === 'yayasan-chow-kit' ? 'Wilayah Persekutuan Kuala Lumpur' : ''),
        website: dbMetaProfile.website || data?.website || localProfile.website || (id === 'yayasan-chow-kit' ? 'https://www.yck.org.my' : ''),
        picName: dbMetaProfile.picName || data?.pic_name || localProfile.picName || (id === 'yayasan-chow-kit' ? 'En. Syafiq (Pengurus Pengangkutan)' : ''),
        picPhone: dbMetaProfile.picPhone || data?.pic_phone || localProfile.picPhone || (id === 'yayasan-chow-kit' ? '+6012-3456789' : ''),
        description: dbMetaProfile.description || data?.description || localProfile.description || (id === 'yayasan-chow-kit' ? 'Pusat Perlindungan Kanak-kanak & Pengurusan Pengangkutan Kebajikan Chow Kit' : ''),
      };

      return merged;
    } catch (err: any) {
      console.warn('[Supabase] getTenant exception:', err.message);
      return null;
    }
  },

  updateTenant: async (id: string, updatedData: Partial<Omit<Tenant, 'id'>>): Promise<boolean> => {
    try {
      // 1. Retrieve current cached local profile to merge cleanly
      let existingLocal: Partial<Tenant> = {};
      try {
        const rawLocal = localStorage.getItem(`fleetflow_tenant_config_${id}`);
        if (rawLocal) existingLocal = JSON.parse(rawLocal);
      } catch {
        // ignore
      }

      const mergedProfile: Partial<Tenant> = {
        ...existingLocal,
        ...updatedData,
      };

      // 2. Prepare metadata JSON payload for database cloud persistence
      const metaPayload = {
        companyName: mergedProfile.companyName || mergedProfile.name || '',
        registrationNumber: mergedProfile.registrationNumber || '',
        phone: mergedProfile.phone || '',
        whatsapp: mergedProfile.whatsapp || '',
        email: mergedProfile.email || '',
        address: mergedProfile.address || '',
        postcode: mergedProfile.postcode || '',
        city: mergedProfile.city || '',
        state: mergedProfile.state || '',
        website: mergedProfile.website || '',
        picName: mergedProfile.picName || '',
        picPhone: mergedProfile.picPhone || '',
        description: mergedProfile.description || '',
      };

      const rawDriveId = (mergedProfile.googleDriveId || '').split(':::FF_META:::')[0] || '';
      const packedDriveId = rawDriveId + ':::FF_META:::' + JSON.stringify(metaPayload);

      // 3. Save to localStorage immediately for instant local retrieval
      try {
        localStorage.setItem(`fleetflow_tenant_config_${id}`, JSON.stringify(mergedProfile));
        if (updatedData.googleAppsScriptUrl) {
          localStorage.setItem('fleetflow_google_script_url', updatedData.googleAppsScriptUrl);
        }
      } catch {
        // ignore
      }

      // 4. Upsert to Supabase
      try {
        const primaryRow: any = {
          id,
          name: mergedProfile.companyName || mergedProfile.name || 'Yayasan Chow Kit',
          status: mergedProfile.status || 'active',
          google_drive_id: packedDriveId,
          ...(mergedProfile.googleAppsScriptUrl !== undefined && { google_apps_script_url: mergedProfile.googleAppsScriptUrl }),
          ...(mergedProfile.googleCalendarId !== undefined && { google_calendar_id: mergedProfile.googleCalendarId }),
        };

        const { error: upsertErr } = await supabase
          .from('tenants')
          .upsert(primaryRow, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('[Supabase] Primary tenant upsert fallback attempt:', upsertErr.message);
          await supabase
            .from('tenants')
            .upsert({
              id,
              name: mergedProfile.companyName || mergedProfile.name || id,
              google_drive_id: packedDriveId,
            }, { onConflict: 'id' });
        }
      } catch (dbEx: any) {
        console.warn('[Supabase] DB upsert exception caught:', dbEx.message);
      }

      return true;
    } catch (err: any) {
      console.error('[Supabase] updateTenant exception:', err.message);
      return false;
    }
  },

  createTenant: async (data: Tenant): Promise<Tenant | null> => {
    try {
      // Save local config
      try {
        localStorage.setItem(`fleetflow_tenant_config_${data.id}`, JSON.stringify({
          googleCalendarId: data.googleCalendarId || '',
          googleDriveId: data.googleDriveId || '',
        }));
      } catch {
        // ignore
      }

      const dbRow = {
        id: data.id,
        name: data.name,
        status: data.status,
      };
      const { error } = await supabase.from('tenants').insert([dbRow]);
      if (error) {
        console.error('[Supabase] createTenant error:', error.message);
      }
      return data;
    } catch (err: any) {
      console.error('[Supabase] createTenant exception:', err.message);
      return data;
    }
  },

  signUpTenant: async (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string): Promise<boolean> => {
    try {
      // Check if tenant ID is already taken
      const existingTenant = await storageService.getTenant(tenantId);
      if (existingTenant) {
        console.warn('[Supabase] Tenant ID already exists:', tenantId);
        return false;
      }

      // Check if user email is already taken
      const existingUser = await storageService.getUserByEmailGlobal(adminEmail);
      if (existingUser) {
        console.warn('[Supabase] Admin email already exists globally:', adminEmail);
        return false;
      }

      // 1. Create the tenant
      const tenant = await storageService.createTenant({
        id: tenantId,
        name: tenantName,
        status: 'active'
      });
      if (!tenant) return false;

      // 2. Create the admin user for the tenant
      const adminUser: User = {
        id: `user-${Date.now()}`,
        name: adminName,
        email: adminEmail,
        phone: '',
        joiningDate: new Date().toISOString().split('T')[0],
        address: '',
        role: 'admin',
        status: 'active',
        password: adminPassword || '123456',
        tenantId: tenantId
      };
      
      const savedUser = await storageService.createUser(adminUser);
      return !!savedUser;
    } catch (err: any) {
      console.error('[Supabase] signUpTenant exception:', err.message);
      return false;
    }
  },
};
