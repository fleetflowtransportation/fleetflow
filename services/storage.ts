import type { Booking, FuelLog, OdometerLog, User, Vehicle, IssueLog, DriverSchedule, Tenant, SelfDriveStaff, MaintenanceInterval, MaintenanceLog, VehicleRenewal, ComplianceType } from '../types';
import { USERS, VEHICLES, INITIAL_BOOKINGS, INITIAL_DRIVER_SCHEDULES, INITIAL_MAINTENANCE_INTERVALS, INITIAL_MAINTENANCE_LOGS } from '../constants';
import { supabase, DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY, createDirectSupabaseClient, getActiveSupabaseUrl, getActiveSupabaseAnonKey } from './supabaseClient';

let currentTenantId = 'yayasan-chow-kit-demo';

export const getTenantId = () => currentTenantId;
export const setTenantId = (id: string) => {
  currentTenantId = id;
};

// Helper: Convert User TS to DB
const toDbUser = (u: Partial<User>) => {
  let comments = u.comments || '';
  if (u.isOwner && !comments.includes('[OWNER]')) {
    comments = comments ? `${comments} [OWNER]` : '[OWNER]';
  } else if (u.isOwner === false && comments.includes('[OWNER]')) {
    comments = comments.replace(/\[OWNER\]/g, '').trim();
  }

  return {
    ...(u.id && { id: u.id }),
    ...(u.name !== undefined && { name: u.name }),
    ...(u.email !== undefined && { email: u.email }),
    ...(u.phone !== undefined && { phone: u.phone }),
    ...(u.joiningDate !== undefined && { joining_date: u.joiningDate }),
    ...(u.address !== undefined && { address: u.address }),
    ...(u.comments !== undefined && { comments: comments || null }),
    ...(u.role !== undefined && { role: u.role }),
    ...(u.status !== undefined && { status: u.status }),
    ...(u.password !== undefined && { password: u.password }),
    ...(u.employmentType !== undefined && { employment_type: u.employmentType }),
    ...(u.terminationDate !== undefined && { termination_date: u.terminationDate || null }),
    ...(u.terminationReason !== undefined && { termination_reason: u.terminationReason || null }),
    ...(u.reactivationDate !== undefined && { reactivation_date: u.reactivationDate || null }),
    ...(u.reactivationReason !== undefined && { reactivation_reason: u.reactivationReason || null }),
    ...(u.statusHistory !== undefined && { status_history: u.statusHistory }),
    tenant_id: u.tenantId || getTenantId(),
  };
};

// Helper: Convert DB User to TS
const fromDbUser = (row: any): User => {
  const isOwnerFromComment = typeof row.comments === 'string' && row.comments.includes('[OWNER]');
  const isDefaultOwner = ((row.tenant_id === 'yayasan-chow-kit-demo' || row.tenant_id === 'yayasan-chow-kit') && (row.email === 'aziz@yck.org.my' || row.id === 'admin-ain')) ||
    (row.tenant_id === 'bukujalananchowkit' && (row.email === 'aziznurmin@gmail.com' || row.email?.includes('aziznurmin'))) ||
    isOwnerFromComment;

  let cleanComments = row.comments;
  if (cleanComments && typeof cleanComments === 'string' && cleanComments.includes('[OWNER]')) {
    cleanComments = cleanComments.replace(/\[OWNER\]/g, '').trim() || undefined;
  }

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    joiningDate: row.joining_date || new Date().toISOString().split('T')[0],
    address: row.address || '',
    comments: cleanComments || undefined,
    role: row.role as 'admin' | 'driver',
    status: row.status as 'active' | 'inactive',
    password: row.password || undefined,
    tenantId: row.tenant_id || getTenantId(),
    isOwner: isDefaultOwner,
    employmentType: row.employment_type || 'full_time',
    terminationDate: row.termination_date || undefined,
    terminationReason: row.termination_reason || undefined,
    reactivationDate: row.reactivation_date || undefined,
    reactivationReason: row.reactivation_reason || undefined,
    statusHistory: Array.isArray(row.status_history) ? row.status_history : [],
  };
};

// Helper: Convert Vehicle TS to DB
const toDbVehicle = (v: Partial<Vehicle>) => {
  const meta = {
    vinChassisNumber: v.vinChassisNumber,
    engineNumber: v.engineNumber,
    photoUrl: v.photoUrl ? v.photoUrl : null,
    photoName: v.photoName ? v.photoName : null,
    vehicleType: v.vehicleType,
    brandMake: v.brandMake,
    manufactureYear: v.manufactureYear,
    ownershipType: v.ownershipType,
    vehicleStatus: v.vehicleStatus,
    assignedBranch: v.assignedBranch,
    assignedDriverId: v.assignedDriverId,
    fuelType: v.fuelType,
    fuelCardNumber: v.fuelCardNumber,
    currentOdometer: v.currentOdometer,
    maxPayloadCapacityKg: v.maxPayloadCapacityKg,
    engineCapacityCc: v.engineCapacityCc,
    roadTaxExpiry: v.roadTaxExpiry,
    insuranceExpiry: v.insuranceExpiry,
    puspakomExpiry: v.puspakomExpiry,
    permitExpiry: v.permitExpiry,
    grantAttachmentUrl: v.grantAttachmentUrl ? v.grantAttachmentUrl : null,
    grantAttachmentName: v.grantAttachmentName ? v.grantAttachmentName : null,
    rawSpecs: v.specifications,
  };

  const packedSpecs = JSON.stringify(meta);

  return {
    ...(v.id && { id: v.id }),
    ...(v.name !== undefined && { name: v.name }),
    ...(v.plateNumber !== undefined && { plate_number: v.plateNumber }),
    ...(v.vinChassisNumber !== undefined && { vin_chassis_number: v.vinChassisNumber }),
    ...(v.engineNumber !== undefined && { engine_number: v.engineNumber }),
    photo_url: v.photoUrl ? v.photoUrl : null,
    photo_name: v.photoName ? v.photoName : null,
    ...(v.vehicleType !== undefined && { vehicle_type: v.vehicleType }),
    ...(v.brandMake !== undefined && { brand_make: v.brandMake }),
    ...(v.manufactureYear !== undefined && { manufacture_year: v.manufactureYear }),
    ...(v.ownershipType !== undefined && { ownership_type: v.ownershipType }),
    ...(v.vehicleStatus !== undefined && { vehicle_status: v.vehicleStatus }),
    ...(v.assignedBranch !== undefined && { assigned_branch: v.assignedBranch }),
    ...(v.assignedDriverId !== undefined && { assigned_driver_id: v.assignedDriverId }),
    ...(v.fuelType !== undefined && { fuel_type: v.fuelType }),
    ...(v.fuelCardNumber !== undefined && { fuel_card_number: v.fuelCardNumber }),
    ...(v.currentOdometer !== undefined && { current_odometer: v.currentOdometer }),
    ...(v.maxPayloadCapacityKg !== undefined && { max_payload_capacity_kg: v.maxPayloadCapacityKg }),
    ...(v.engineCapacityCc !== undefined && { engine_capacity_cc: v.engineCapacityCc }),
    ...(v.roadTaxExpiry !== undefined && { road_tax_expiry: v.roadTaxExpiry }),
    ...(v.insuranceExpiry !== undefined && { insurance_expiry: v.insuranceExpiry }),
    ...(v.puspakomExpiry !== undefined && { puspakom_expiry: v.puspakomExpiry }),
    ...(v.permitExpiry !== undefined && { permit_expiry: v.permitExpiry }),
    grant_attachment_url: v.grantAttachmentUrl ? v.grantAttachmentUrl : null,
    grant_attachment_name: v.grantAttachmentName ? v.grantAttachmentName : null,
    specifications: packedSpecs,
    tenant_id: v.tenantId || getTenantId(),
  };
};

// Helper: Convert DB Vehicle to TS
const fromDbVehicle = (row: any): Vehicle => {
  let meta: any = {};
  if (row.specifications && typeof row.specifications === 'string' && row.specifications.startsWith('{')) {
    try {
      meta = JSON.parse(row.specifications);
    } catch {
      meta = {};
    }
  }

  // If column exists and is explicitly null/empty string, it was cleared
  const resolvedPhotoUrl = row.photo_url !== undefined && row.photo_url !== null
    ? (row.photo_url ? row.photo_url : undefined)
    : (row.photo_url === null ? undefined : (meta.photoUrl || undefined));

  const resolvedPhotoName = row.photo_name !== undefined && row.photo_name !== null
    ? (row.photo_name ? row.photo_name : undefined)
    : (row.photo_name === null ? undefined : (meta.photoName || undefined));

  const resolvedGrantUrl = row.grant_attachment_url !== undefined && row.grant_attachment_url !== null
    ? (row.grant_attachment_url ? row.grant_attachment_url : undefined)
    : (row.grant_attachment_url === null ? undefined : (meta.grantAttachmentUrl || undefined));

  const resolvedGrantName = row.grant_attachment_name !== undefined && row.grant_attachment_name !== null
    ? (row.grant_attachment_name ? row.grant_attachment_name : undefined)
    : (row.grant_attachment_name === null ? undefined : (meta.grantAttachmentName || undefined));

  return {
    id: row.id,
    name: row.name || meta.name || '',
    plateNumber: row.plate_number || meta.plateNumber || '',
    photoUrl: resolvedPhotoUrl,
    photoName: resolvedPhotoName,
    specifications: meta.rawSpecs !== undefined ? meta.rawSpecs : (row.specifications && !row.specifications.startsWith('{') ? row.specifications : undefined),
    vinChassisNumber: row.vin_chassis_number || meta.vinChassisNumber || undefined,
    engineNumber: row.engine_number || meta.engineNumber || undefined,
    vehicleType: row.vehicle_type || meta.vehicleType || 'Van',
    brandMake: row.brand_make || meta.brandMake || '',
    manufactureYear: row.manufacture_year ? Number(row.manufacture_year) : (meta.manufactureYear ? Number(meta.manufactureYear) : undefined),
    ownershipType: row.ownership_type || meta.ownershipType || 'Owned',
    vehicleStatus: row.vehicle_status || meta.vehicleStatus || 'Active',
    assignedBranch: row.assigned_branch || meta.assignedBranch || undefined,
    assignedDriverId: row.assigned_driver_id || meta.assignedDriverId || undefined,
    fuelType: row.fuel_type || meta.fuelType || 'Diesel',
    fuelCardNumber: row.fuel_card_number || meta.fuelCardNumber || undefined,
    currentOdometer: row.current_odometer !== undefined && row.current_odometer !== null ? Number(row.current_odometer) : (meta.currentOdometer !== undefined ? Number(meta.currentOdometer) : 0),
    maxPayloadCapacityKg: row.max_payload_capacity_kg ? Number(row.max_payload_capacity_kg) : (meta.maxPayloadCapacityKg ? Number(meta.maxPayloadCapacityKg) : undefined),
    engineCapacityCc: row.engine_capacity_cc ? Number(row.engine_capacity_cc) : (meta.engineCapacityCc ? Number(meta.engineCapacityCc) : undefined),
    roadTaxExpiry: row.road_tax_expiry || meta.roadTaxExpiry || '',
    insuranceExpiry: row.insurance_expiry || meta.insuranceExpiry || '',
    puspakomExpiry: row.puspakom_expiry || meta.puspakomExpiry || undefined,
    permitExpiry: row.permit_expiry || meta.permitExpiry || undefined,
    grantAttachmentUrl: resolvedGrantUrl,
    grantAttachmentName: resolvedGrantName,
    tenantId: row.tenant_id || getTenantId(),
  };
};

// Helper: Convert Booking TS to DB
const toDbBooking = (b: Partial<Booking>) => {
  const sDate = b.dateTime ? b.dateTime.split('T')[0] : '';
  const sTime = (b.dateTime && b.dateTime.includes('T')) ? b.dateTime.split('T')[1].substring(0, 5) : '';
  const eDate = b.finishDateTime ? b.finishDateTime.split('T')[0] : sDate;
  const eTime = (b.finishDateTime && b.finishDateTime.includes('T')) ? b.finishDateTime.split('T')[1].substring(0, 5) : sTime;

  return {
    ...(b.id && { id: b.id }),
    ...(b.destination !== undefined && { destination: b.destination }),
    ...(b.purpose !== undefined && { purpose: b.purpose }),
    ...(b.dateTime !== undefined && { date_time: b.dateTime }),
    ...(b.finishDateTime !== undefined && { finish_date_time: b.finishDateTime }),
    ...(sDate && { start_date: sDate }),
    ...(sTime && { start_time: sTime }),
    ...(eDate && { end_date: eDate }),
    ...(eTime && { end_time: eTime }),
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
  };
};

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
  ...(s.Date !== undefined && { date: s.Date, shift_date: s.Date, shift_type: 'Custom' }),
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

// Helper: Convert VehicleRenewal TS to DB
const toDbRenewal = (r: Partial<VehicleRenewal>) => ({
  ...(r.id && { id: r.id }),
  ...(r.vehicleId !== undefined && { vehicle_id: r.vehicleId }),
  ...(r.complianceType !== undefined && { compliance_type: r.complianceType }),
  ...(r.oldExpiryDate !== undefined && { old_expiry_date: r.oldExpiryDate }),
  ...(r.newExpiryDate !== undefined && { new_expiry_date: r.newExpiryDate }),
  ...(r.renewalDate !== undefined && { renewal_date: r.renewalDate }),
  ...(r.costAmount !== undefined && { cost_amount: r.costAmount }),
  ...(r.providerAgentName !== undefined && { provider_agent_name: r.providerAgentName }),
  ...(r.receiptPolicyDocumentUrl !== undefined && { receipt_policy_document_url: r.receiptPolicyDocumentUrl }),
  ...(r.receiptPolicyDocumentName !== undefined && { receipt_policy_document_name: r.receiptPolicyDocumentName }),
  ...(r.remarks !== undefined && { remarks: r.remarks }),
  ...(r.createdBy !== undefined && { created_by: r.createdBy }),
  tenant_id: r.tenantId || getTenantId(),
});

// Helper: Convert DB VehicleRenewal to TS
const fromDbRenewal = (row: any): VehicleRenewal => ({
  id: row.id,
  vehicleId: row.vehicle_id,
  complianceType: row.compliance_type as ComplianceType,
  oldExpiryDate: row.old_expiry_date || undefined,
  newExpiryDate: row.new_expiry_date,
  renewalDate: row.renewal_date,
  costAmount: Number(row.cost_amount || 0),
  providerAgentName: row.provider_agent_name || undefined,
  receiptPolicyDocumentUrl: row.receipt_policy_document_url || undefined,
  receiptPolicyDocumentName: row.receipt_policy_document_name || undefined,
  remarks: row.remarks || undefined,
  createdBy: row.created_by || undefined,
  createdAt: row.created_at || undefined,
  updatedAt: row.updated_at || undefined,
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
    tenantId: 'yayasan-chow-kit-demo'
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
    tenantId: 'yayasan-chow-kit-demo'
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
    const cleanEmail = email.trim().toLowerCase();
    try {
      // 1. Case-insensitive query via Supabase SDK
      const { data, error } = await supabase
        .from('fleet_users')
        .select('*')
        .ilike('email', cleanEmail);

      if (!error && data && data.length > 0) {
        const exact = data.find(u => (u.email || '').trim().toLowerCase() === cleanEmail) || data[0];
        return fromDbUser(exact);
      }

      // 2. Direct equality fallback via Supabase SDK
      const { data: eqData } = await supabase
        .from('fleet_users')
        .select('*')
        .eq('email', cleanEmail);

      if (eqData && eqData.length > 0) {
        return fromDbUser(eqData[0]);
      }

      // 3. Direct HTTPS REST fetch to bypass any SDK/token caching in iframe sandbox
      try {
        const restRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fleet_users?select=*`, {
          headers: {
            'apikey': DEFAULT_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          },
        });
        if (restRes.ok) {
          const restUsers = await restRes.json();
          if (Array.isArray(restUsers) && restUsers.length > 0) {
            const found = restUsers.find((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);
            if (found) {
              return fromDbUser(found);
            }
          }
        }
      } catch (restErr: any) {
        console.warn('[Supabase REST Fallback] fetch error:', restErr.message);
      }

      // 4. Fallback scan of recent fleet users
      const { data: allUsers } = await supabase
        .from('fleet_users')
        .select('*')
        .limit(100);

      if (allUsers && allUsers.length > 0) {
        const found = allUsers.find(u => (u.email || '').trim().toLowerCase() === cleanEmail);
        if (found) {
          return fromDbUser(found);
        }
      }

      return null;
    } catch (err: any) {
      console.warn('[Supabase] getUserByEmailGlobal exception:', err.message);
      // Last chance direct REST call
      try {
        const restRes = await fetch(`${DEFAULT_SUPABASE_URL}/rest/v1/fleet_users?select=*`, {
          headers: {
            'apikey': DEFAULT_SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${DEFAULT_SUPABASE_ANON_KEY}`,
          },
        });
        if (restRes.ok) {
          const restUsers = await restRes.json();
          if (Array.isArray(restUsers)) {
            const found = restUsers.find((u: any) => (u.email || '').trim().toLowerCase() === cleanEmail);
            if (found) return fromDbUser(found);
          }
        }
      } catch {
        // ignore
      }
      return null;
    }
  },
  // ---- READ ----
  getUsers: async (): Promise<User[]> => {
    try {
      const tid = getTenantId();
      const { data, error } = await supabase
        .from('fleet_users')
        .select('*')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[Supabase] getUsers error:', error.message);
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }
      const users = data.map(fromDbUser);
      // Ensure the tenant has an identified owner
      const hasOwner = users.some(u => u.isOwner);
      if (!hasOwner && users.length > 0) {
        const primaryAdmin = users.find(u => u.role === 'admin') || users[0];
        if (primaryAdmin) primaryAdmin.isOwner = true;
      }
      return users;
    } catch (err: any) {
      console.warn('[Supabase] getUsers network exception:', err.message);
      return [];
    }
  },

  getVehicles: async (): Promise<Vehicle[]> => {
    try {
      const tid = getTenantId();
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('tenant_id', tid)
        .order('created_at', { ascending: true });

      if (error) {
        console.warn('[Supabase] getVehicles query error:', error.message);
        return [];
      }

      if (!data || data.length === 0) {
        return [];
      }

      return data.map(fromDbVehicle);
    } catch (err: any) {
      console.warn('[Supabase] getVehicles network exception:', err.message);
      return [];
    }
  },

  getBookings: async (): Promise<Booking[]> => {
    try {
      const tid = getTenantId();
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('tenant_id', tid)
        .order('date_time', { ascending: true });

      if (error) {
        console.warn('[Supabase] getBookings error:', error.message);
        return [];
      }
      if (!data || data.length === 0) {
        return [];
      }
      return data.map(fromDbBooking);
    } catch (err: any) {
      console.warn('[Supabase] getBookings network exception:', err.message);
      return [];
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

  createFuelLogsBulk: async (dataList: FuelLog[]): Promise<FuelLog[]> => {
    try {
      const dbRows = dataList.map(toDbFuelLog);
      const { error } = await supabase.from('fuel_logs').insert(dbRows);
      if (error) {
        console.error('[Supabase] createFuelLogsBulk error:', error.message);
        throw error;
      }
    } catch (err: any) {
      console.error('[Supabase] createFuelLogsBulk exception:', err.message);
      throw err;
    }
    return dataList;
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

  deleteFuelLogsBulk: async (ids: string[]): Promise<string[]> => {
    if (!ids || ids.length === 0) return [];
    try {
      const { error } = await supabase.from('fuel_logs').delete().in('id', ids);
      if (error) console.error('[Supabase] deleteFuelLogsBulk error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteFuelLogsBulk exception:', err.message);
    }
    return ids;
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
      const cleanEmail = data.email.trim().toLowerCase();
      const cleanPassword = (data.password || '123456').trim();

      // If it is a new user with a client-generated temporary ID, register in Supabase Auth first
      if (data.id.startsWith('user-')) {
        try {
          const transientClient = createDirectSupabaseClient(getActiveSupabaseUrl(), getActiveSupabaseAnonKey());
          const { data: authData, error: authError } = await transientClient.auth.signUp({
            email: cleanEmail,
            password: cleanPassword,
          });

          if (!authError && authData.user) {
            data.id = authData.user.id; // Assign actual Supabase Auth UUID to profile ID
          } else if (authError) {
            console.warn('[Supabase Auth Sync] Could not create auth user, using fallback ID:', authError.message);
          }
        } catch (authExc: any) {
          console.warn('[Supabase Auth Sync] Exception during transient signup:', authExc.message);
        }
      }

      const dbRow: any = toDbUser(data);
      const { error } = await supabase.from('fleet_users').insert([dbRow]);
      if (error) {
        console.warn('[Supabase] createUser full column error:', error.message);
        if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
          // Fallback to core columns if Supabase SQL migration has not run yet
          const coreRow = {
            id: dbRow.id,
            name: dbRow.name,
            email: dbRow.email,
            phone: dbRow.phone,
            joining_date: dbRow.joining_date,
            address: dbRow.address,
            comments: dbRow.comments,
            role: dbRow.role,
            status: dbRow.status,
            password: dbRow.password,
            tenant_id: dbRow.tenant_id,
          };
          const { error: coreErr } = await supabase.from('fleet_users').insert([coreRow]);
          if (coreErr) {
            console.error('[Supabase] createUser fallback error:', coreErr.message);
            throw new Error(coreErr.message);
          }
        } else {
          throw new Error(error.message);
        }
      }
    } catch (err: any) {
      console.error('[Supabase] createUser exception:', err.message);
      throw err;
    }
    return data;
  },

  updateUser: async (data: Partial<User> & { id: string }): Promise<any> => {
    try {
      const dbRow: any = toDbUser(data);
      const { error } = await supabase.from('fleet_users').update(dbRow).eq('id', data.id);
      if (error) {
        console.warn('[Supabase] updateUser full column error:', error.message);
        if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
          // Fallback to core columns
          const coreRow: any = {
            ...(dbRow.name !== undefined && { name: dbRow.name }),
            ...(dbRow.email !== undefined && { email: dbRow.email }),
            ...(dbRow.phone !== undefined && { phone: dbRow.phone }),
            ...(dbRow.joining_date !== undefined && { joining_date: dbRow.joining_date }),
            ...(dbRow.address !== undefined && { address: dbRow.address }),
            ...(dbRow.comments !== undefined && { comments: dbRow.comments }),
            ...(dbRow.role !== undefined && { role: dbRow.role }),
            ...(dbRow.status !== undefined && { status: dbRow.status }),
            ...(dbRow.password !== undefined && { password: dbRow.password }),
          };
          const { error: coreErr } = await supabase.from('fleet_users').update(coreRow).eq('id', data.id);
          if (coreErr) console.error('[Supabase] updateUser core fallback error:', coreErr.message);
        }
      }
    } catch (err: any) {
      console.error('[Supabase] updateUser exception:', err.message);
    }
    return data;
  },

  deleteUser: async (id: string): Promise<{ id: string }> => {
    try {
      const { data: targetUser } = await supabase.from('fleet_users').select('*').eq('id', id).maybeSingle();
      if (targetUser) {
        const u = fromDbUser(targetUser);
        if (u.isOwner) {
          throw new Error('Organization owner account cannot be deleted.');
        }
      }
      const { error } = await supabase.from('fleet_users').delete().eq('id', id);
      if (error) console.error('[Supabase] deleteUser error:', error.message);
    } catch (err: any) {
      console.error('[Supabase] deleteUser exception:', err.message);
      throw err;
    }
    return { id };
  },

  // ---- WRITE (VEHICLES) ----
  createVehicle: async (data: Vehicle): Promise<Vehicle> => {
    try {
      const dbRow: any = toDbVehicle(data);
      const { error } = await supabase.from('vehicles').insert([dbRow]);
      if (error) {
        console.warn('[Supabase] createVehicle full column insert error:', error.message);
        // Fallback to legacy minimal columns if SQL migration has not run yet
        if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
          const fallbackRow = {
            id: dbRow.id,
            name: dbRow.name,
            plate_number: dbRow.plate_number,
            photo_url: dbRow.photo_url,
            specifications: dbRow.specifications,
            tenant_id: dbRow.tenant_id,
          };
          const { error: fallbackErr } = await supabase.from('vehicles').insert([fallbackRow]);
          if (fallbackErr) console.error('[Supabase] createVehicle fallback error:', fallbackErr.message);
        }
      }
    } catch (err: any) {
      console.error('[Supabase] createVehicle exception:', err.message);
    }
    return data;
  },

  updateVehicle: async (data: Partial<Vehicle> & { id: string }): Promise<any> => {
    try {
      const dbRow: any = toDbVehicle(data);
      const { error } = await supabase.from('vehicles').update(dbRow).eq('id', data.id);
      if (error) {
        console.warn('[Supabase] updateVehicle full column update error:', error.message);
        // Fallback to legacy minimal columns if SQL migration has not run yet
        if (error.message && (error.message.includes('column') || error.message.includes('schema'))) {
          const fallbackRow: any = {
            name: dbRow.name,
            plate_number: dbRow.plate_number,
            photo_url: dbRow.photo_url,
            specifications: dbRow.specifications,
            tenant_id: dbRow.tenant_id,
          };
          const { error: fallbackErr } = await supabase.from('vehicles').update(fallbackRow).eq('id', data.id);
          if (fallbackErr) console.error('[Supabase] updateVehicle fallback error:', fallbackErr.message);
        }
      }
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

  getMaintenanceIntervals: async (): Promise<MaintenanceInterval[]> => {
    const tenantId = getTenantId();
    let localList: MaintenanceInterval[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_intervals_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      } else if (tenantId === 'yayasan-chow-kit') {
        localList = INITIAL_MAINTENANCE_INTERVALS.map(m => ({ ...m, tenantId }));
        localStorage.setItem(`fleetflow_maintenance_intervals_${tenantId}`, JSON.stringify(localList));
      }
    } catch {
      if (tenantId === 'yayasan-chow-kit') {
        localList = INITIAL_MAINTENANCE_INTERVALS.map(m => ({ ...m, tenantId }));
      }
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

  getMaintenanceLogs: async (): Promise<MaintenanceLog[]> => {
    const tenantId = getTenantId();
    let localList: MaintenanceLog[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_maintenance_logs_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      } else if (tenantId === 'yayasan-chow-kit') {
        localList = INITIAL_MAINTENANCE_LOGS.map(l => ({ ...l, tenantId }));
        localStorage.setItem(`fleetflow_maintenance_logs_${tenantId}`, JSON.stringify(localList));
      }
    } catch {
      if (tenantId === 'yayasan-chow-kit') {
        localList = INITIAL_MAINTENANCE_LOGS.map(l => ({ ...l, tenantId }));
      }
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

  // ---- VEHICLE COMPLIANCE RENEWALS ----
  getVehicleRenewals: async (vehicleId?: string): Promise<VehicleRenewal[]> => {
    const tenantId = getTenantId();
    let localList: VehicleRenewal[] = [];
    try {
      const raw = localStorage.getItem(`fleetflow_vehicle_renewals_${tenantId}`);
      if (raw) {
        localList = JSON.parse(raw);
      }
    } catch {}

    try {
      let query = supabase
        .from('vehicle_renewals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('renewal_date', { ascending: false });

      if (vehicleId) {
        query = query.eq('vehicle_id', vehicleId);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const dbItems = data.map(fromDbRenewal);
        try {
          if (!vehicleId) {
            localStorage.setItem(`fleetflow_vehicle_renewals_${tenantId}`, JSON.stringify(dbItems));
          }
        } catch {}
        return dbItems;
      }
    } catch (err: any) {
      console.warn('[Supabase] getVehicleRenewals query error:', err.message);
    }

    if (vehicleId) {
      return localList.filter(item => item.vehicleId === vehicleId);
    }
    return localList;
  },

  createVehicleRenewal: async (data: VehicleRenewal): Promise<VehicleRenewal> => {
    const tenantId = getTenantId();
    const itemWithTenant: VehicleRenewal = {
      ...data,
      tenantId: data.tenantId || tenantId,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };

    try {
      const raw = localStorage.getItem(`fleetflow_vehicle_renewals_${tenantId}`);
      const list: VehicleRenewal[] = raw ? JSON.parse(raw) : [];
      list.unshift(itemWithTenant);
      localStorage.setItem(`fleetflow_vehicle_renewals_${tenantId}`, JSON.stringify(list));
    } catch {}

    try {
      const dbRow = toDbRenewal(itemWithTenant);
      const { error } = await supabase.from('vehicle_renewals').insert([dbRow]);
      if (error) console.warn('[Supabase] createVehicleRenewal note:', error.message);
    } catch (err: any) {
      console.warn('[Supabase] createVehicleRenewal exception:', err.message);
    }

    return itemWithTenant;
  },

  deleteVehicleRenewal: async (id: string): Promise<{ id: string }> => {
    const tenantId = getTenantId();
    try {
      const raw = localStorage.getItem(`fleetflow_vehicle_renewals_${tenantId}`);
      if (raw) {
        const list: VehicleRenewal[] = JSON.parse(raw);
        const updated = list.filter(item => item.id !== id);
        localStorage.setItem(`fleetflow_vehicle_renewals_${tenantId}`, JSON.stringify(updated));
      }
    } catch {}

    try {
      const { error } = await supabase.from('vehicle_renewals').delete().eq('id', id);
      if (error) console.warn('[Supabase] deleteVehicleRenewal note:', error.message);
    } catch {}

    return { id };
  },

  renewVehicle: async (
    vehicleId: string,
    data: Omit<VehicleRenewal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; renewal: VehicleRenewal; updatedVehicle: Vehicle }> => {
    const tenantId = getTenantId();
    const newRenewalId = `renew-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const nowIso = new Date().toISOString();

    const newRenewal: VehicleRenewal = {
      ...data,
      id: newRenewalId,
      vehicleId,
      createdAt: nowIso,
      updatedAt: nowIso,
      tenantId: data.tenantId || tenantId,
    };

    // 1. Create renewal record in vehicle_renewals table to log history and cost
    const savedRenewal = await storageService.createVehicleRenewal(newRenewal);

    // 2. Map compliance_type to the corresponding vehicle expiry date field
    const vehicleUpdate: Partial<Vehicle> = {};
    if (data.complianceType === 'Insurance') {
      vehicleUpdate.insuranceExpiry = data.newExpiryDate;
    } else if (data.complianceType === 'Road Tax') {
      vehicleUpdate.roadTaxExpiry = data.newExpiryDate;
    } else if (data.complianceType === 'PUSPAKOM') {
      vehicleUpdate.puspakomExpiry = data.newExpiryDate;
    } else if (data.complianceType === 'Permit') {
      vehicleUpdate.permitExpiry = data.newExpiryDate;
    }

    // 3. Update main vehicles table with the new expiry date
    let updatedVehicle: Vehicle = { id: vehicleId, ...vehicleUpdate } as any;
    try {
      await storageService.updateVehicle({ id: vehicleId, ...vehicleUpdate });
      const currentList = await storageService.getVehicles();
      const found = currentList.find(v => v.id === vehicleId);
      if (found) {
        updatedVehicle = found;
      }
    } catch (err: any) {
      console.warn('[Storage] renewVehicle vehicle update note:', err.message);
    }

    return {
      success: true,
      renewal: savedRenewal,
      updatedVehicle,
    };
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

      if (!data && id !== 'yayasan-chow-kit-demo' && id !== 'yayasan-chow-kit') {
        return null;
      }

      const isYCK = id === 'yayasan-chow-kit-demo' || id === 'yayasan-chow-kit';
      let scriptUrl = data?.google_apps_script_url !== undefined && data.google_apps_script_url !== null
        ? data.google_apps_script_url
        : (localProfile.googleAppsScriptUrl !== undefined ? localProfile.googleAppsScriptUrl : (isYCK ? (import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || '') : ''));

      let calendarId = data?.google_calendar_id !== undefined && data.google_calendar_id !== null
        ? data.google_calendar_id
        : (localProfile.googleCalendarId || '');

      let driveId = data?.google_drive_id !== undefined && data.google_drive_id !== null
        ? data.google_drive_id
        : (localProfile.googleDriveId || '');
      
      if (typeof driveId === 'string' && driveId.includes(':::FF_META:::')) {
        driveId = driveId.split(':::FF_META:::')[0] || '';
      }

      if (typeof calendarId === 'string' && calendarId.includes(':::')) {
        const parts = calendarId.split(':::');
        calendarId = parts[0] || '';
        driveId = parts[1] || driveId;
      }

      const merged: Tenant = {
        id,
        name: data?.company_name || data?.name || localProfile.companyName || localProfile.name || (isYCK ? 'Yayasan Chow Kit - Demo' : id),
        status: data?.status || 'active',
        googleAppsScriptUrl: scriptUrl,
        googleCalendarId: calendarId,
        googleDriveId: driveId.trim(),
        companyName: data?.company_name || data?.name || localProfile.companyName || (isYCK ? 'Yayasan Chow Kit - Demo' : id),
        registrationNumber: data?.registration_number || data?.reg_number || localProfile.registrationNumber || localProfile.regNumber || (isYCK ? 'PPM-012-14-11012011' : ''),
        regNumber: data?.registration_number || data?.reg_number || localProfile.registrationNumber || localProfile.regNumber || (isYCK ? 'PPM-012-14-11012011' : ''),
        phone: data?.phone || localProfile.phone || (isYCK ? '+603-4045 5550' : ''),
        whatsapp: data?.whatsapp || localProfile.whatsapp || (isYCK ? '+6012-3456789' : ''),
        email: data?.email || localProfile.email || (isYCK ? 'info@yck.org.my' : ''),
        address: data?.address || localProfile.address || (isYCK ? 'No. 22B, Jalan Chow Kit, 50350 Kuala Lumpur' : ''),
        postcode: data?.postcode || localProfile.postcode || (isYCK ? '50350' : ''),
        city: data?.city || localProfile.city || (isYCK ? 'Kuala Lumpur' : ''),
        state: data?.state || localProfile.state || (isYCK ? 'Wilayah Persekutuan Kuala Lumpur' : ''),
        website: data?.website || localProfile.website || (isYCK ? 'https://www.yck.org.my' : ''),
        picName: data?.pic_name || localProfile.picName || (isYCK ? 'En. Syafiq (Pengurus Pengangkutan)' : ''),
        picPhone: data?.pic_phone || localProfile.picPhone || (isYCK ? '+6012-3456789' : ''),
        description: data?.description || localProfile.description || (isYCK ? 'Pusat Perlindungan Kanak-kanak & Pengurusan Pengangkutan Kebajikan Chow Kit' : ''),
        operatingHours: data?.operating_hours || localProfile.operatingHours || '08:00 - 17:00 (Mon - Fri)',
        timezone: data?.timezone || localProfile.timezone || 'Asia/Kuala_Lumpur',
        logoUrl: data?.logo_url || localProfile.logoUrl || '',
      };

      return merged;
    } catch (err: any) {
      console.warn('[Supabase] getTenant exception:', err.message);
      return null;
    }
  },

  updateTenant: async (id: string, updatedData: Partial<Omit<Tenant, 'id'>>): Promise<boolean> => {
    try {
      // Clear global legacy key
      try {
        localStorage.removeItem('fleetflow_google_script_url');
      } catch {
        // ignore
      }

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

      if (updatedData.googleAppsScriptUrl !== undefined) {
        mergedProfile.googleAppsScriptUrl = updatedData.googleAppsScriptUrl;
      }
      if (updatedData.googleCalendarId !== undefined) {
        mergedProfile.googleCalendarId = updatedData.googleCalendarId;
      }
      if (updatedData.googleDriveId !== undefined) {
        mergedProfile.googleDriveId = updatedData.googleDriveId;
      }

      // Strictly isolate google_drive_id from other profile fields
      const cleanDriveId = (mergedProfile.googleDriveId || '').split(':::FF_META:::')[0]?.trim() || '';
      mergedProfile.googleDriveId = cleanDriveId;

      // 2. Save to localStorage immediately for instant local retrieval
      try {
        localStorage.setItem(`fleetflow_tenant_config_${id}`, JSON.stringify(mergedProfile));
      } catch {
        // ignore
      }

      // 3. Upsert to Supabase with each field in its own dedicated column
      const isYCK = id === 'yayasan-chow-kit-demo' || id === 'yayasan-chow-kit';
      const companyTitle = mergedProfile.companyName || mergedProfile.name || (isYCK ? 'Yayasan Chow Kit - Demo' : id);

      const fullDbRow: any = {
        id,
        name: companyTitle,
        company_name: companyTitle,
        status: mergedProfile.status || 'active',
        registration_number: mergedProfile.registrationNumber || mergedProfile.regNumber || '',
        phone: mergedProfile.phone || '',
        whatsapp: mergedProfile.whatsapp || '',
        email: mergedProfile.email || '',
        address: mergedProfile.address || '',
        postcode: mergedProfile.postcode || '',
        city: mergedProfile.city || '',
        state: mergedProfile.state || '',
        website: mergedProfile.website || '',
        pic_name: mergedProfile.picName || '',
        pic_phone: mergedProfile.picPhone || '',
        description: mergedProfile.description || '',
        operating_hours: mergedProfile.operatingHours || '',
        timezone: mergedProfile.timezone || 'Asia/Kuala_Lumpur',
        logo_url: mergedProfile.logoUrl || null,
        google_drive_id: cleanDriveId || null,
        google_apps_script_url: mergedProfile.googleAppsScriptUrl ?? null,
        google_calendar_id: mergedProfile.googleCalendarId ?? null,
      };

      try {
        const { error: upsertErr } = await supabase
          .from('tenants')
          .upsert(fullDbRow, { onConflict: 'id' });

        if (upsertErr) {
          console.warn('[Supabase] Full columns tenant upsert fallback attempt:', upsertErr.message);
          await supabase
            .from('tenants')
            .upsert({
              id,
              name: companyTitle,
              status: mergedProfile.status || 'active',
              google_drive_id: cleanDriveId || null,
              google_apps_script_url: mergedProfile.googleAppsScriptUrl ?? null,
              google_calendar_id: mergedProfile.googleCalendarId ?? null,
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
      const cleanDriveId = (data.googleDriveId || '').split(':::FF_META:::')[0]?.trim() || '';
      try {
        localStorage.setItem(`fleetflow_tenant_config_${data.id}`, JSON.stringify({
          ...data,
          googleDriveId: cleanDriveId,
        }));
      } catch {
        // ignore
      }

      const fullDbRow: any = {
        id: data.id,
        name: data.companyName || data.name,
        company_name: data.companyName || data.name,
        status: data.status || 'active',
        registration_number: data.registrationNumber || data.regNumber || '',
        phone: data.phone || '',
        whatsapp: data.whatsapp || '',
        email: data.email || '',
        address: data.address || '',
        postcode: data.postcode || '',
        city: data.city || '',
        state: data.state || '',
        website: data.website || '',
        pic_name: data.picName || '',
        pic_phone: data.picPhone || '',
        description: data.description || '',
        operating_hours: data.operatingHours || '',
        timezone: data.timezone || 'Asia/Kuala_Lumpur',
        logo_url: data.logoUrl || null,
        google_calendar_id: data.googleCalendarId || null,
        google_drive_id: cleanDriveId || null,
        google_apps_script_url: data.googleAppsScriptUrl || null,
      };

      const { error } = await supabase.from('tenants').insert([fullDbRow]);
      if (error) {
        console.warn('[Supabase] createTenant base insert fallback:', error.message);
        await supabase.from('tenants').insert([{
          id: data.id,
          name: data.companyName || data.name,
          status: data.status || 'active',
          google_drive_id: cleanDriveId || null,
          google_apps_script_url: data.googleAppsScriptUrl || null,
          google_calendar_id: data.googleCalendarId || null,
        }]);
      }
      return data;
    } catch (err: any) {
      console.error('[Supabase] createTenant exception:', err.message);
      return null;
    }
  },

  signUpTenant: async (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string): Promise<{ success: boolean; error?: string }> => {
    const cleanTenantId = tenantId.trim().toLowerCase();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanPassword = (adminPassword || '123456').trim();

    try {
      // 1. Check if tenant ID is currently active in Supabase
      const { data: existingTenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('id', cleanTenantId)
        .maybeSingle();

      if (existingTenant) {
        return { success: false, error: `Organization ID "${cleanTenantId}" is already registered.` };
      }

      // 2. Check if admin email already exists in Supabase
      const { data: existingUser } = await supabase
        .from('fleet_users')
        .select('id, email, tenant_id')
        .ilike('email', cleanEmail)
        .maybeSingle();

      if (existingUser) {
        // Check if the tenant for this user still exists
        const { data: userTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('id', existingUser.tenant_id)
          .maybeSingle();

        if (!userTenant || existingUser.tenant_id === cleanTenantId) {
          // The previous tenant was deleted in Supabase. Delete the orphaned user row so they can re-register!
          await supabase.from('fleet_users').delete().eq('id', existingUser.id);
        } else {
          return { success: false, error: `Email "${cleanEmail}" is already registered under organization "${existingUser.tenant_id}".` };
        }
      }

      // 3. Register user in Supabase Auth (auth.users) using a transient client
      // We do not require or block on email confirmation so users can sign in immediately
      let authUserId = `user-${Date.now()}`;
      try {
        const transientClient = createDirectSupabaseClient(getActiveSupabaseUrl(), getActiveSupabaseAnonKey());
        const { data: authData, error: authError } = await transientClient.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
        });

        if (!authError && authData?.user) {
          authUserId = authData.user.id; // Assign the real Supabase Auth UUID
        } else if (authError) {
          console.warn('[Supabase Auth Note]: Proceeding with instant database registration:', authError.message);
        }
      } catch (authExc: any) {
        console.warn('[Supabase Auth Sign Up Exception]:', authExc.message);
      }

      // Clean local drafts & global overrides
      try {
        localStorage.removeItem(`fleetflow_tenant_config_${cleanTenantId}`);
        localStorage.removeItem(`fleetflow_profile_draft_${cleanTenantId}`);
        localStorage.removeItem('fleetflow_google_script_url');
      } catch {
        // ignore
      }

      // 4. Create the tenant
      const tenant = await storageService.createTenant({
        id: cleanTenantId,
        name: tenantName.trim(),
        companyName: tenantName.trim(),
        status: 'active'
      });
      if (!tenant) {
        return { success: false, error: 'Database failed to create organization. Please verify database connection.' };
      }

      // Initialize organization profile & clear integrations
      await storageService.updateTenant(cleanTenantId, {
        companyName: tenantName.trim(),
        email: cleanEmail,
        googleAppsScriptUrl: '',
        googleCalendarId: '',
        googleDriveId: '',
      });

      // 5. Create the admin user profile for the tenant using the Supabase Auth UUID
      const adminUser: User = {
        id: authUserId,
        name: adminName.trim(),
        email: cleanEmail,
        phone: '',
        joiningDate: new Date().toISOString().split('T')[0],
        address: '',
        comments: '[OWNER]',
        role: 'admin',
        status: 'active',
        password: cleanPassword,
        tenantId: cleanTenantId,
        isOwner: true,
      };
      
      const savedUser = await storageService.createUser(adminUser);
      if (!savedUser) {
        return { success: false, error: 'Failed to create administrator account in database.' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('[Supabase] signUpTenant exception:', err.message);
      return { success: false, error: err.message || 'Registration failed due to an unexpected server error.' };
    }
  },

  deleteTenantCompletely: async (tenantId: string): Promise<boolean> => {
    try {
      if (!tenantId) {
        throw new Error('Tenant ID is required.');
      }

      const tables = [
        'bookings',
        'fuel_logs',
        'odometer_logs',
        'issue_logs',
        'driver_schedules',
        'self_drive_staff',
        'maintenance_intervals',
        'maintenance_logs',
        'vehicle_renewals',
        'vehicles',
        'fleet_users'
      ];

      for (const table of tables) {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('tenant_id', tenantId);
        if (error) {
          console.error(`[Supabase] Failed to delete from ${table}:`, error.message);
        }
      }

      const { error: tenantError } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (tenantError) {
        console.error('[Supabase] Failed to delete tenant record:', tenantError.message);
        throw new Error(tenantError.message);
      }

      try {
        localStorage.removeItem(`fleetflow_tenant_config_${tenantId}`);
        localStorage.removeItem(`fleetflow_profile_draft_${tenantId}`);
        localStorage.removeItem(`fleetflow_self_drive_staff_${tenantId}`);
        localStorage.removeItem(`fleetflow_maintenance_intervals_${tenantId}`);
        localStorage.removeItem(`fleetflow_maintenance_logs_${tenantId}`);
        localStorage.removeItem(`fleetflow_vehicle_renewals_${tenantId}`);
      } catch {
        // ignore
      }

      return true;
    } catch (err: any) {
      console.error('[Supabase] deleteTenantCompletely exception:', err);
      throw err;
    }
  },
};
