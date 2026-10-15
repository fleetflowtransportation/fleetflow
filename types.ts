export interface UserStatusLog {
  id: string;
  action: 'created' | 'deactivated' | 'reactivated' | 'updated';
  timestamp: string;
  performedBy: string;
  effectiveDate?: string;
  reason?: string;
  previousStatus?: 'active' | 'inactive';
  newStatus: 'active' | 'inactive';
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  joiningDate: string;
  address: string;
  comments?: string;
  role: 'admin' | 'driver';
  status: 'active' | 'inactive';
  password?: string;
  tenantId?: string;
  isOwner?: boolean;
  employmentType?: 'full_time' | 'part_time';
  terminationDate?: string;
  terminationReason?: string;
  reactivationDate?: string;
  reactivationReason?: string;
  statusHistory?: UserStatusLog[];
  /** Supabase Auth UUID — for login only. driver_schedules / bookings use `id`, not this. */
  authUserId?: string;
}
