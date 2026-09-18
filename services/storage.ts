import type { Booking, FuelLog, OdometerLog, User, Vehicle, IssueLog, DriverSchedule, Tenant } from '../types';
import { USERS, VEHICLES, INITIAL_BOOKINGS, INITIAL_DRIVER_SCHEDULES } from '../constants';
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
  tenant_id: b.tenantId || getTenantId(),
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
      }
    } catch (err: any) {
      console.error('[Supabase] updateBooking exception:', err.message);
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

  // ---- TENANTS & MULTITENANCY ----
  getTenant: async (id: string): Promise<Tenant | null> => {
    try {
      const { data, error } = await supabase.from('tenants').select('*').eq('id', id).maybeSingle();
      if (error) {
        console.warn('[Supabase] getTenant error:', error.message);
        return null;
      }
      if (!data) return null;
      
      let calendarId = data.google_calendar_id || '';
      let driveId = '';
      if (calendarId.includes(':::')) {
        const parts = calendarId.split(':::');
        calendarId = parts[0] || '';
        driveId = parts[1] || '';
      }

      return {
        id: data.id,
        name: data.name,
        status: data.status,
        googleCalendarId: calendarId,
        googleDriveId: driveId,
      };
    } catch (err: any) {
      console.warn('[Supabase] getTenant exception:', err.message);
      return null;
    }
  },

  updateTenant: async (id: string, updatedData: Partial<Omit<Tenant, 'id'>>): Promise<boolean> => {
    try {
      const dbRow: any = {};
      if (updatedData.name !== undefined) dbRow.name = updatedData.name;
      if (updatedData.status !== undefined) dbRow.status = updatedData.status;
      
      if (updatedData.googleCalendarId !== undefined || updatedData.googleDriveId !== undefined) {
        // Fetch current to merge
        const existing = await storageService.getTenant(id);
        const cal = updatedData.googleCalendarId !== undefined ? updatedData.googleCalendarId : (existing?.googleCalendarId || '');
        const drv = updatedData.googleDriveId !== undefined ? updatedData.googleDriveId : (existing?.googleDriveId || '');
        dbRow.google_calendar_id = `${cal}:::${drv}`;
      }

      const { error } = await supabase.from('tenants').update(dbRow).eq('id', id);
      if (error) {
        console.error('[Supabase] updateTenant error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('[Supabase] updateTenant exception:', err.message);
      return false;
    }
  },

  createTenant: async (data: Tenant): Promise<Tenant | null> => {
    try {
      const cal = data.googleCalendarId || '';
      const drv = data.googleDriveId || '';
      const dbRow = {
        id: data.id,
        name: data.name,
        status: data.status,
        google_calendar_id: `${cal}:::${drv}`,
      };
      const { error } = await supabase.from('tenants').insert([dbRow]);
      if (error) {
        console.error('[Supabase] createTenant error:', error.message);
        return null;
      }
      return data;
    } catch (err: any) {
      console.error('[Supabase] createTenant exception:', err.message);
      return null;
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
