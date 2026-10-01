import React, { createContext, useState, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import type { Booking, FuelLog, OdometerLog, User, Vehicle, BookingHistory, CurrentUser, IssueLog, DriverSchedule, Tenant, SelfDriveStaff, MaintenanceInterval, MaintenanceLog, VehicleRenewal } from '../types';
import { storageService } from '../services/storage';
import { postVehicleRenew } from '../services/renewalApi';
import { parseAsLocal } from '../utils';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, getDriverCalendarColor, type AutoAssignResult } from '../services/bookingEngine';
import { googleCalendarService } from '../services/googleCalendar';
import { updateSupabaseConfig, resetSupabaseConfig, getSupabase } from '../services/supabaseClient';
import { deleteFromGoogleDrive } from '../services/googleDrive';

interface AppContextType {
  users: User[];
  vehicles: Vehicle[];
  bookings: Booking[];
  fuelLogs: FuelLog[];
  odometerLogs: OdometerLog[];
  issueLogs: IssueLog[];
  driverSchedules: DriverSchedule[];
  currentUser: CurrentUser | null;
  activeTenant: Tenant | null;
  isLoading: boolean;
  loadError: string | null;
  lastDriverAssignedId: string | null;
  reload: () => void;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  addBooking: (booking: Omit<Booking, 'id'>) => AutoAssignResult;
  updateBooking: (bookingId: string, updatedData: Partial<Omit<Booking, 'id'>>) => void;
  deleteBooking: (bookingId: string) => void;
  restoreBooking: (bookingId: string) => void;
  assignToBooking: (bookingId: string, driverId: string, vehicleId: string) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status'], cancellationReason?: string) => void;
  deleteBookingsBulk: (bookingIds: string[]) => Promise<void>;
  updateBookingsStatusBulk: (bookingIds: string[], status: Booking['status']) => Promise<void>;
  assignBookingsBulk: (bookingIds: string[], driverId: string, vehicleId: string) => Promise<void>;
  addFuelLog: (log: Omit<FuelLog, 'id'>) => void;
  updateFuelLog: (logId: string, updatedData: Partial<Omit<FuelLog, 'id'>>) => void;
  deleteFuelLog: (logId: string) => void;
  addOdometerLog: (log: Omit<OdometerLog, 'id'>) => void;
  updateOdometerLog: (logId: string, updatedData: Partial<Omit<OdometerLog, 'id'>>) => void;
  deleteOdometerLog: (logId: string) => void;
  addIssueLog: (log: Omit<IssueLog, 'id'>) => void;
  updateIssueLog: (logId: string, updatedData: Partial<Omit<IssueLog, 'id'>>) => void;
  deleteIssueLog: (logId: string) => void;
  addDriverSchedule: (sched: Omit<DriverSchedule, 'id'>) => void;
  updateDriverSchedule: (schedId: string, updatedData: Partial<Omit<DriverSchedule, 'id'>>) => void;
  deleteDriverSchedule: (schedId: string) => void;
  deleteDriverSchedulesBulk: (schedIds: string[]) => void;
  lastBookingChange: BookingHistory | null;
  undoLastBookingChange: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (userId: string, updatedData: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (userId: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  updateVehicle: (vehicleId: string, updatedData: Partial<Omit<Vehicle, 'id'>>) => void;
  deleteVehicle: (vehicleId: string) => void;
  updateGoogleCalendarId: (calendarId: string) => Promise<boolean>;
  updateGoogleDriveId: (driveId: string) => Promise<boolean>;
  updateGoogleAppsScriptUrl: (url: string) => Promise<boolean>;
  updateTenantGoogleIntegrations: (settings: { googleAppsScriptUrl?: string; googleCalendarId?: string; googleDriveId?: string }) => Promise<boolean>;
  updateTenantProfile: (profileData: Partial<Tenant>) => Promise<boolean>;
  registerOrganization: (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string) => Promise<{ success: boolean; error?: string }>;
  deleteTenantCompletely: (tenantId: string) => Promise<boolean>;
  selfDriveStaff: SelfDriveStaff[];
  addSelfDriveStaff: (staff: Omit<SelfDriveStaff, 'id' | 'createdAt'>) => Promise<SelfDriveStaff>;
  updateSelfDriveStaff: (staffId: string, updatedData: Partial<Omit<SelfDriveStaff, 'id'>>) => Promise<void>;
  deleteSelfDriveStaff: (staffId: string) => Promise<void>;
  maintenanceIntervals: MaintenanceInterval[];
  maintenanceLogs: MaintenanceLog[];
  addMaintenanceInterval: (data: Omit<MaintenanceInterval, 'id'>) => Promise<MaintenanceInterval>;
  updateMaintenanceInterval: (id: string, updatedData: Partial<Omit<MaintenanceInterval, 'id'>>) => Promise<void>;
  deleteMaintenanceInterval: (id: string) => Promise<void>;
  addMaintenanceLog: (data: Omit<MaintenanceLog, 'id'>, intervalIdToUpdate?: string) => Promise<MaintenanceLog>;
  updateMaintenanceLog: (id: string, updatedData: Partial<Omit<MaintenanceLog, 'id'>>) => Promise<void>;
  deleteMaintenanceLog: (id: string) => Promise<void>;
  vehicleRenewals: VehicleRenewal[];
  renewVehicleCompliance: (vehicleId: string, renewalData: Omit<VehicleRenewal, 'id' | 'createdAt' | 'updatedAt'>) => Promise<{ success: boolean; renewal: VehicleRenewal; updatedVehicle: Vehicle }>;
  deleteVehicleRenewal: (id: string) => Promise<boolean>;
  updateSupabaseDatabaseConfig: (url: string, anonKey: string) => boolean;
  resetSupabaseDatabaseConfig: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Local temp id supaya UI boleh update terus (optimistic) sebelum backend bagi id sebenar.
const tempId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [odometerLogs, setOdometerLogs] = useState<OdometerLog[]>([]);
  const [issueLogs, setIssueLogs] = useState<IssueLog[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<DriverSchedule[]>([]);
  const [selfDriveStaff, setSelfDriveStaff] = useState<SelfDriveStaff[]>([]);
  const [maintenanceIntervals, setMaintenanceIntervals] = useState<MaintenanceInterval[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [vehicleRenewals, setVehicleRenewals] = useState<VehicleRenewal[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [activeTenant, setActiveTenant] = useState<Tenant | null>(null);
  const [tenantInitialized, setTenantInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [lastBookingChange, setLastBookingChange] = useState<BookingHistory | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  const [lastDriverAssignedId, setLastDriverAssignedId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('fleetflow_last_driver_assigned');
    } catch {
      return null;
    }
  });

  const hasLoadedOnceRef = useRef(false);

  // ---- Load session and active tenant on startup ----
  useEffect(() => {
    const savedTenantId = localStorage.getItem('fleetflow_tenant_id') || '';
    const savedUserData = localStorage.getItem('fleetflow_user_data');
    
    if (savedTenantId) {
      storageService.setTenantId(savedTenantId);
    }
    
    if (savedUserData) {
      try {
        const parsed = JSON.parse(savedUserData);
        setCurrentUser(parsed);
      } catch {
        // ignore
      }
    }
    
    if (savedTenantId) {
      storageService.getTenant(savedTenantId).then(tenant => {
        setActiveTenant(tenant);
        setTenantInitialized(true);
      });
    } else {
      setTenantInitialized(true);
    }
  }, []);

  // Sync activeTenant when currentUser changes or reloadTick occurs
  useEffect(() => {
    if (!tenantInitialized) return;
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (currentTenantId) {
      storageService.getTenant(currentTenantId).then(tenant => {
        setActiveTenant(tenant);
      });
    }
  }, [currentUser, reloadTick, tenantInitialized]);

  // ---- Initial load (dan reload) dari Supabase ----
  useEffect(() => {
    if (!tenantInitialized) return;

    let cancelled = false;
    if (!hasLoadedOnceRef.current) {
      setIsLoading(true);
    }
    setLoadError(null);

    Promise.all([
      storageService.getUsers(),
      storageService.getVehicles(),
      storageService.getBookings(),
      storageService.getFuelLogs(),
      storageService.getOdometerLogs(),
      storageService.getIssueLogs(),
      storageService.getDriverSchedules(),
      storageService.getSelfDriveStaff(),
      storageService.getMaintenanceIntervals(),
      storageService.getMaintenanceLogs(),
      storageService.getVehicleRenewals(),
    ])
      .then(([u, v, b, f, o, i, s, sds, mi, ml, vr]) => {
        if (cancelled) return;
        setUsers(u);
        setVehicles(v);
        setBookings(b);
        setFuelLogs(f);
        setOdometerLogs(o);
        setIssueLogs(i);
        setDriverSchedules(s);
        setSelfDriveStaff(sds);
        setMaintenanceIntervals(mi);
        setMaintenanceLogs(ml);
        setVehicleRenewals(vr);
      })
      .catch(err => {
        if (cancelled) return;
        setLoadError(err.message || 'Failed to load data from server.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
          hasLoadedOnceRef.current = true;
        }
      });

    return () => { cancelled = true; };
  }, [reloadTick, tenantInitialized]);

  const reload = useCallback(() => setReloadTick(t => t + 1), []);

  // Auto-refresh setiap 15 saat supaya perubahan dari device/pengguna lain turut terpapar.
  useEffect(() => {
    const interval = setInterval(() => reload(), 15000);
    return () => clearInterval(interval);
  }, [reload]);

  // Active session watcher: Instantly detects if the currently logged-in account
  // has been deleted or deactivated in the database and terminates their session immediately.
  useEffect(() => {
    if (!currentUser || isLoading || !hasLoadedOnceRef.current) return;
    if (users.length === 0) return;

    const loggedInUserRecord = users.find(u => u.id === currentUser.id);
    if (!loggedInUserRecord) {
      console.warn('[Session Terminated] User account was deleted. Terminating active session.');
      localStorage.removeItem('fleetflow_tenant_id');
      localStorage.removeItem('fleetflow_user_data');
      storageService.setTenantId('');
      setCurrentUser(null);
      alert('Your account has been deleted by an administrator. You have been logged out.');
      return;
    }

    if (String(loggedInUserRecord.status || 'active').trim().toLowerCase() === 'inactive') {
      console.warn('[Session Terminated] User account has been deactivated. Terminating active session.');
      localStorage.removeItem('fleetflow_tenant_id');
      localStorage.removeItem('fleetflow_user_data');
      storageService.setTenantId('');
      setCurrentUser(null);
      alert('Your account has been deactivated. Please contact your administrator.');
      return;
    }

    // Keep currentUser fields in sync with database (e.g. role or Super Admin status)
    if (
      loggedInUserRecord.isOwner !== currentUser.isOwner ||
      loggedInUserRecord.name !== currentUser.name ||
      loggedInUserRecord.role !== currentUser.role
    ) {
      setCurrentUser(prev => prev ? {
        ...prev,
        name: loggedInUserRecord.name,
        role: loggedInUserRecord.role,
        isOwner: !!loggedInUserRecord.isOwner
      } : null);
    }
  }, [users, currentUser, isLoading]);

  const login = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();

      let user = null;
      let authSuccessful = false;

      // 1. Attempt standard Supabase Auth Sign In first
      try {
        const supabase = getSupabase();
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (!authError && authData.user) {
          // If auth succeeds, retrieve their profile from fleet_users using their Auth UUID
          user = await storageService.getUsers().then(allUsers => 
            allUsers.find(u => u.id === authData.user.id || (u.email || '').trim().toLowerCase() === cleanEmail)
          );
          authSuccessful = !!user;
        } else if (authError) {
          console.log('[Supabase Auth] Attempt failed, trying local fallback:', authError.message);
        }
      } catch (authExc: any) {
        console.warn('[Supabase Auth] Exception during signInWithPassword:', authExc.message);
      }

      // 2. Legacy / Seeding fallback: Check direct table database profile
      if (!authSuccessful) {
        const foundUser = await storageService.getUserByEmailGlobal(cleanEmail);
        if (foundUser) {
          const storedPassword = String(foundUser.password || '').trim();
          if (storedPassword === cleanPassword) {
            user = foundUser;
          } else {
            return { success: false, error: 'Incorrect password. Please verify and try again.' };
          }
        }
      }

      if (!user) {
        console.warn('[Auth] No user account found or credentials invalid for:', cleanEmail);
        return { success: false, error: 'No account found with this email and password. Please check your credentials.' };
      }

      const isActive = String(user.status || 'active').trim().toLowerCase() !== 'inactive';
      if (!isActive) {
        console.warn('[Auth] Inactive user account for:', cleanEmail);
        return { success: false, error: 'This user account has been deactivated. Please contact your administrator.' };
      }

      const tenantId = user.tenantId || '';
      const isOwner = !!user.isOwner;
      storageService.setTenantId(tenantId);
      localStorage.setItem('fleetflow_tenant_id', tenantId);
      localStorage.setItem('fleetflow_user_data', JSON.stringify({ id: user.id, name: user.name, role: user.role, tenantId, isOwner }));
      
      setCurrentUser({ id: user.id, name: user.name, role: user.role, tenantId, isOwner });
      reload();
      return { success: true };
    } catch (err: any) {
      console.error('Login error:', err);
      return { success: false, error: err.message || 'Login failed due to a connection error.' };
    }
  }, [reload]);

  const logout = useCallback(() => {
    localStorage.removeItem('fleetflow_tenant_id');
    localStorage.removeItem('fleetflow_user_data');
    storageService.setTenantId('');
    setCurrentUser(null);
    reload();
  }, [reload]);

  const updateGoogleCalendarId = useCallback(async (calendarId: string): Promise<boolean> => {
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (!currentTenantId) return false;
    const success = await storageService.updateTenant(currentTenantId, { googleCalendarId: calendarId });
    if (success) {
      setActiveTenant(prev => prev ? { ...prev, googleCalendarId: calendarId } : null);
      return true;
    }
    return false;
  }, [currentUser]);

  const updateGoogleDriveId = useCallback(async (driveId: string): Promise<boolean> => {
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (!currentTenantId) return false;
    const success = await storageService.updateTenant(currentTenantId, { googleDriveId: driveId });
    if (success) {
      setActiveTenant(prev => prev ? { ...prev, googleDriveId: driveId } : null);
      return true;
    }
    return false;
  }, [currentUser]);

  const updateGoogleAppsScriptUrl = useCallback(async (url: string): Promise<boolean> => {
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (!currentTenantId) return false;
    const success = await storageService.updateTenant(currentTenantId, { googleAppsScriptUrl: url });
    if (success) {
      setActiveTenant(prev => prev ? { ...prev, googleAppsScriptUrl: url } : null);
      return true;
    }
    return false;
  }, [currentUser]);

  const updateTenantGoogleIntegrations = useCallback(async (settings: { googleAppsScriptUrl?: string; googleCalendarId?: string; googleDriveId?: string }): Promise<boolean> => {
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (!currentTenantId) return false;
    const success = await storageService.updateTenant(currentTenantId, settings);
    if (success) {
      setActiveTenant(prev => prev ? { ...prev, ...settings } : null);
      return true;
    }
    return false;
  }, [currentUser]);

  const updateTenantProfile = useCallback(async (profileData: Partial<Tenant>): Promise<boolean> => {
    const currentTenantId = currentUser?.tenantId || storageService.getTenantId();
    if (!currentTenantId) return false;
    const success = await storageService.updateTenant(currentTenantId, profileData);
    if (success) {
      setActiveTenant(prev => prev ? { ...prev, ...profileData } : null);
      return true;
    }
    return false;
  }, [currentUser]);

  const registerOrganization = useCallback(async (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string): Promise<{ success: boolean; error?: string }> => {
    const result = await storageService.signUpTenant(tenantId, tenantName, adminName, adminEmail, adminPassword);
    if (result.success) {
      reload();
    }
    return result;
  }, [reload]);

  const deleteTenantCompletely = useCallback(async (tenantId: string): Promise<boolean> => {
    return await storageService.deleteTenantCompletely(tenantId);
  }, []);

  const clearUndoState = useCallback(() => {
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
      undoTimeoutRef.current = null;
    }
    setLastBookingChange(null);
  }, []);

  const setUndoableAction = useCallback((bookingId: string, currentBookings: Booking[]) => {
    clearUndoState();
    const originalBooking = currentBookings.find(b => b.id === bookingId);
    if (originalBooking) {
      setLastBookingChange({ bookingId, previousState: originalBooking });
      undoTimeoutRef.current = window.setTimeout(() => {
        setLastBookingChange(null);
      }, 7000); // 7 seconds to undo
    }
  }, [clearUndoState]);

  // ---- Bookings ----
  const addBooking = useCallback((bookingData: Omit<Booking, 'id'>): AutoAssignResult => {
    const staffCount = bookingData.passengers?.find(p => p.category === 'Staff')?.count || 0;
    const kidsCount = bookingData.passengers?.find(p => p.category === 'Kids')?.count || 0;
    const teenagersCount = bookingData.passengers?.find(p => p.category === 'Teenagers')?.count || 0;

    const baseInput = {
      requesterName: bookingData.requesterName,
      requesterEmail: bookingData.requesterEmail,
      department: bookingData.department,
      bookingDate: normalizeDate(bookingData.dateTime),
      startTime: normalizeTime(bookingData.dateTime),
      endTime: normalizeTime(bookingData.finishDateTime || bookingData.dateTime),
      purpose: bookingData.purpose,
      destination: bookingData.destination,
      pickupPoint: bookingData.pickupPoint,
      address: bookingData.address,
      staffCount,
      kidsCount,
      teenagersCount,
      serviceType: bookingData.serviceType,
      vehiclePreference: bookingData.vehiclePreference,
      shouldWait: bookingData.shouldWait,
      remarks: bookingData.remarks,
      icNumber: bookingData.icNumber,
    };

    if (bookingData.recurrence) {
      const { frequency, endDate: recurrenceEndDateStr } = bookingData.recurrence;

      const parts = recurrenceEndDateStr.split('-');
      const recurrenceEndDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      recurrenceEndDate.setHours(23, 59, 59, 999);

      const startDate = parseAsLocal(bookingData.dateTime);
      const newBookings: Booking[] = [];
      const recurrenceId = `recur-${Date.now()}`;
      let currentDate = new Date(startDate);
      let runningLastDriver = lastDriverAssignedId;
      let primaryResult: AutoAssignResult | null = null;

      while (currentDate <= recurrenceEndDate) {
        const finishDateTime = bookingData.finishDateTime ? parseAsLocal(bookingData.finishDateTime) : null;
        let currentFinishDateTime: Date | undefined;
        if (finishDateTime) {
          const duration = finishDateTime.getTime() - startDate.getTime();
          currentFinishDateTime = new Date(currentDate.getTime() + duration);
        }

        const dateStr = normalizeDate(currentDate);
        const startTimeStr = normalizeTime(currentDate);
        const endTimeStr = normalizeTime(currentFinishDateTime || currentDate);

        const currentInput = {
          ...baseInput,
          bookingDate: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
        };

        const result = evaluateBookingAssignment({
          booking: currentInput,
          existingBookings: [...newBookings, ...bookings],
          driverSchedules,
          users,
          vehicles,
          lastDriverAssignedId: runningLastDriver,
        });

        if (!primaryResult) {
          primaryResult = result;
        }

        if (result.newLastDriverAssignedId) {
          runningLastDriver = result.newLastDriverAssignedId;
        }

        if (result.status === 'Conflict') {
          // Skip saving this occurrence due to conflict / rejection
          switch (frequency) {
            case 'weekly':
              currentDate.setDate(currentDate.getDate() + 7);
              break;
            case 'bi-weekly':
              currentDate.setDate(currentDate.getDate() + 14);
              break;
            case 'monthly': {
              const originalDay = startDate.getDate();
              const hours = currentDate.getHours();
              const minutes = currentDate.getMinutes();
              const seconds = currentDate.getSeconds();

              let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
              const lastDayOfNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
              const newDay = Math.min(originalDay, lastDayOfNextMonth);

              currentDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), newDay, hours, minutes, seconds);
              break;
            }
          }
          continue;
        }

        const newBooking: Booking = {
          ...bookingData,
          id: tempId('booking'),
          dateTime: currentDate.toISOString(),
          finishDateTime: currentFinishDateTime ? currentFinishDateTime.toISOString() : undefined,
          recurrenceId,
          recurrence: newBookings.length === 0 ? bookingData.recurrence : undefined,
          status: result.status,
          driverId: result.driverId,
          vehicleId: result.vehicleId,
          calendarEventTitle: result.calendarEventTitle,
          calendarColor: result.calendarColor,
          calendarEventId: result.calendarEventId,
          adminNotes: result.adminNotes,
          conflictReason: result.conflictReason,
          isPreWorkingHour: result.isPreWorkingHour,
          warningNotes: result.warningNotes,
        };
        newBookings.push(newBooking);

        switch (frequency) {
          case 'weekly':
            currentDate.setDate(currentDate.getDate() + 7);
            break;
          case 'bi-weekly':
            currentDate.setDate(currentDate.getDate() + 14);
            break;
          case 'monthly': {
            const originalDay = startDate.getDate();
            const hours = currentDate.getHours();
            const minutes = currentDate.getMinutes();
            const seconds = currentDate.getSeconds();

            let nextDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
            const lastDayOfNextMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
            const newDay = Math.min(originalDay, lastDayOfNextMonth);

            currentDate = new Date(nextDate.getFullYear(), nextDate.getMonth(), newDay, hours, minutes, seconds);
            break;
          }
        }
      }

      if (runningLastDriver && runningLastDriver !== lastDriverAssignedId) {
        setLastDriverAssignedId(runningLastDriver);
        try {
          localStorage.setItem('fleetflow_last_driver_assigned', runningLastDriver);
        } catch {
          // ignore
        }
      }

      setBookings(prev => [...newBookings, ...prev]);
      if (activeTenant) {
        newBookings.forEach(b => {
          googleCalendarService.createEvent(activeTenant, b, vehicles, users).then(eventId => {
            if (eventId) {
              setBookings(prev => prev.map(x => (x.id === b.id ? { ...x, calendarEventId: eventId } : x)));
              storageService.updateBooking({ id: b.id, calendarEventId: eventId }).catch(() => {});
            }
          }).catch(() => {});
        });
      }
      newBookings.forEach(b => {
        storageService.createBooking(b)
          .then(saved => {
            setBookings(prev => prev.map(x => (x.id === b.id ? { ...b, ...saved } : x)));
          })
          .catch(err => {
            console.warn('Gagal simpan booking berulang:', err.message);
          });
      });

      return primaryResult || evaluateBookingAssignment({
        booking: baseInput,
        existingBookings: bookings,
        driverSchedules,
        users,
        vehicles,
        lastDriverAssignedId,
      });
    } else {
      const result = evaluateBookingAssignment({
        booking: baseInput,
        existingBookings: bookings,
        driverSchedules,
        users,
        vehicles,
        lastDriverAssignedId,
      });

      if (result.status === 'Conflict') {
        return result;
      }

      if (result.newLastDriverAssignedId) {
        setLastDriverAssignedId(result.newLastDriverAssignedId);
        try {
          localStorage.setItem('fleetflow_last_driver_assigned', result.newLastDriverAssignedId);
        } catch {
          // ignore
        }
      }

      const newBooking: Booking = {
        ...bookingData,
        id: tempId('booking'),
        status: result.status,
        driverId: result.driverId,
        vehicleId: result.vehicleId,
        calendarEventTitle: result.calendarEventTitle,
        calendarColor: result.calendarColor,
        calendarEventId: result.calendarEventId,
        adminNotes: result.adminNotes,
        conflictReason: result.conflictReason,
        isPreWorkingHour: result.isPreWorkingHour,
        warningNotes: result.warningNotes,
      };

      setBookings(prev => [newBooking, ...prev]);
      if (activeTenant) {
        googleCalendarService.createEvent(activeTenant, newBooking, vehicles, users).then(eventId => {
          if (eventId) {
            newBooking.calendarEventId = eventId;
            setBookings(prev => prev.map(b => (b.id === newBooking.id ? { ...b, calendarEventId: eventId } : b)));
            storageService.updateBooking({ id: newBooking.id, calendarEventId: eventId }).catch(() => {});
          }
        }).catch(() => {});
      }
      storageService.createBooking(newBooking)
        .then(saved => {
          setBookings(prev => prev.map(b => (b.id === newBooking.id ? { ...newBooking, ...saved } : b)));
        })
        .catch(err => {
          console.warn('Gagal simpan booking ke server, rekod kekal dalam state:', err.message);
        });

      return result;
    }
  }, [bookings, driverSchedules, users, vehicles, lastDriverAssignedId, activeTenant]);

  const updateBooking = useCallback((bookingId: string, updatedData: Partial<Omit<Booking, 'id'>>) => {
    const existingBooking = bookings.find(b => b.id === bookingId);
    if (!existingBooking) {
      console.warn('Booking tidak dijumpai untuk dikemaskini:', bookingId);
      return;
    }

    const updatedFullBooking: Booking = { ...existingBooking, ...updatedData };

    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => (b.id === bookingId ? updatedFullBooking : b));
    });

    if (activeTenant) {
      googleCalendarService.updateEvent(activeTenant, updatedFullBooking, vehicles, users).catch(err => {
        console.warn('Gagal sync kemaskini kalendar:', err);
      });
    }

    storageService.updateBooking({ id: bookingId, ...updatedData }).catch(err => {
      console.error('Gagal kemaskini booking di pangkalan data:', err);
      alert('Gagal kemaskini booking: ' + err.message);
    });
  }, [bookings, vehicles, users, setUndoableAction, activeTenant]);

  const deleteBooking = useCallback((bookingId: string) => {
    clearUndoState();
    const bookingToDelete = bookings.find(b => b.id === bookingId);

    // 1. Delete attachment from Google Drive if exists
    if (bookingToDelete?.attachmentUrl) {
      if (bookingToDelete.attachmentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(bookingToDelete.attachmentUrl);
      } else {
        const driveUrl = activeTenant?.googleAppsScriptUrl || localStorage.getItem('fleetflow_google_script_url') || import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
        if (driveUrl) {
          const url = bookingToDelete.attachmentUrl;
          let fileId: string | null = null;
          const dMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
          if (dMatch && dMatch[1]) fileId = dMatch[1];
          const idMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          if (idMatch && idMatch[1]) fileId = idMatch[1];

          if (fileId) {
            console.log("Memadam lampiran Google Drive:", fileId);
            fetch(driveUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'text/plain;charset=utf-8'
              },
              body: JSON.stringify({
                action: 'delete',
                fileId: fileId
              })
            }).then(res => res.json())
              .then(resJson => {
                if (resJson.success) {
                  console.log("Lampiran Google Drive berjaya dipadamkan.");
                } else {
                  console.warn("Gagal memadam fail dari Google Drive:", resJson.error);
                }
              }).catch(err => {
                console.error("Ralat komunikasi Google Drive:", err);
              });
          }
        }
      }
    }

    // 2. Delete event from Google Calendar
    if (activeTenant && bookingToDelete) {
      googleCalendarService.deleteEvent(activeTenant, bookingToDelete.calendarEventId, bookingToDelete).catch(err => {
        console.warn('Gagal memadam acara kalendar Google:', err);
      });
    }

    // 3. Update React local state
    setBookings(prev => prev.filter(b => b.id !== bookingId));

    // 4. Delete from Supabase persistence
    storageService.deleteBooking(bookingId).catch(err => {
      alert('Gagal padam booking: ' + err.message);
    });
  }, [clearUndoState, activeTenant, bookings]);

  const restoreBooking = useCallback((bookingId: string) => {
    let restoredBooking: Booking | undefined;
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => {
        if (b.id === bookingId) {
          restoredBooking = { ...b, status: 'Pending' as Booking['status'] };
          return restoredBooking;
        }
        return b;
      });
    });

    if (activeTenant && restoredBooking) {
      googleCalendarService.updateEvent(activeTenant, restoredBooking).catch(() => {});
    }

    storageService.updateBooking({ id: bookingId, status: 'Pending' }).catch(err => {
      alert('Gagal restore booking: ' + err.message);
    });
  }, [setUndoableAction, activeTenant]);

  const assignToBooking = useCallback((bookingId: string, driverId: string, vehicleId: string) => {
    const driver = users.find(u => u.id === driverId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const driverName = driver?.name || 'Driver';
    let assignedBooking: Booking | undefined;

    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => {
        if (b.id !== bookingId) return b;
        const deptStr = b.department ? ` (${b.department})` : '';
        const calTitle = `(${driverName}) ${b.requesterName}${deptStr} → ${b.destination}`;
        const calColor = getDriverCalendarColor(driverName, b.serviceType);
        assignedBooking = {
          ...b,
          driverId,
          vehicleId,
          status: 'Confirmed' as Booking['status'],
          calendarEventTitle: calTitle,
          calendarColor: calColor,
          adminNotes: `Pengendalian Manual: Disahkan oleh Admin Ain. Pemandu: ${driverName}, Kenderaan: ${vehicle?.name || vehicleId} (${vehicle?.plateNumber || ''}).`,
          conflictReason: undefined,
        };
        return assignedBooking;
      });
    });

    if (activeTenant && assignedBooking) {
      googleCalendarService.updateEvent(activeTenant, assignedBooking, vehicles).catch(() => {});
    }

    storageService.updateBooking({
      id: bookingId,
      driverId,
      vehicleId,
      status: 'Confirmed',
    }).catch(err => {
      alert('Gagal assign booking: ' + err.message);
    });
  }, [setUndoableAction, users, vehicles, activeTenant]);

  const updateBookingStatus = useCallback((bookingId: string, status: Booking['status'], cancellationReason?: string) => {
    let mergedRemarks: string | undefined;
    let updatedBooking: Booking | undefined;
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => {
        if (b.id !== bookingId) return b;
        if (status === 'Cancelled' && cancellationReason) {
          mergedRemarks = (b.remarks ? b.remarks + ' | ' : '') + 'Dibatalkan: ' + cancellationReason;
          updatedBooking = { ...b, status, remarks: mergedRemarks };
          return updatedBooking;
        }
        updatedBooking = { ...b, status };
        return updatedBooking;
      });
    });

    if (activeTenant && updatedBooking) {
      if (status === 'Cancelled') {
        googleCalendarService.deleteEvent(activeTenant, (updatedBooking as Booking).calendarEventId, updatedBooking).catch(() => {});
      } else {
        googleCalendarService.updateEvent(activeTenant, updatedBooking).catch(() => {});
      }
    }

    const payload: Partial<Booking> & { id: string } = { id: bookingId, status };
    if (mergedRemarks !== undefined) payload.remarks = mergedRemarks;
    storageService.updateBooking(payload).catch(err => {
      alert('Gagal kemaskini status booking: ' + err.message);
    });
  }, [setUndoableAction, activeTenant]);

  const deleteBookingsBulk = useCallback(async (bookingIds: string[]) => {
    if (!bookingIds || bookingIds.length === 0) return;
    clearUndoState();

    // 1. Revoke any blob attachments
    bookings.filter(b => bookingIds.includes(b.id)).forEach(b => {
      if (b.attachmentUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(b.attachmentUrl);
      }
    });

    // 2. Remove from local state
    setBookings(prev => prev.filter(b => !bookingIds.includes(b.id)));

    // 3. Delete Google Calendar events
    if (activeTenant) {
      const toDelete = bookings.filter(b => bookingIds.includes(b.id) && b.calendarEventId);
      toDelete.forEach(b => {
        googleCalendarService.deleteEvent(activeTenant, b.calendarEventId, b).catch(() => {});
      });
    }

    // 4. Delete from Supabase
    try {
      await storageService.deleteBookingsBulk(bookingIds);
    } catch (err: any) {
      console.error('Gagal memadam tempahan secara pukal:', err);
    }
  }, [bookings, clearUndoState, activeTenant]);

  const updateBookingsStatusBulk = useCallback(async (bookingIds: string[], status: Booking['status']) => {
    if (!bookingIds || bookingIds.length === 0) return;

    setBookings(prev => prev.map(b => {
      if (!bookingIds.includes(b.id)) return b;
      return { ...b, status };
    }));

    if (activeTenant) {
      const affected = bookings.filter(b => bookingIds.includes(b.id));
      affected.forEach(b => {
        const updated = { ...b, status };
        if (status === 'Cancelled' && b.calendarEventId) {
          googleCalendarService.deleteEvent(activeTenant, b.calendarEventId, updated).catch(() => {});
        } else {
          googleCalendarService.updateEvent(activeTenant, updated).catch(() => {});
        }
      });
    }

    try {
      await storageService.updateBookingsBulk(bookingIds, { status });
    } catch (err: any) {
      console.error('Gagal kemaskini status pukal:', err);
    }
  }, [bookings, activeTenant]);

  const assignBookingsBulk = useCallback(async (bookingIds: string[], driverId: string, vehicleId: string) => {
    if (!bookingIds || bookingIds.length === 0) return;
    const driver = users.find(u => u.id === driverId);
    const vehicle = vehicles.find(v => v.id === vehicleId);
    const driverName = driver?.name || 'Driver';

    const updatedList: Booking[] = [];

    setBookings(prev => prev.map(b => {
      if (!bookingIds.includes(b.id)) return b;
      const deptStr = b.department ? ` (${b.department})` : '';
      const calTitle = `(${driverName}) ${b.requesterName}${deptStr} → ${b.destination}`;
      const calColor = getDriverCalendarColor(driverName, b.serviceType);
      const updated: Booking = {
        ...b,
        driverId,
        vehicleId,
        status: 'Confirmed',
        calendarEventTitle: calTitle,
        calendarColor: calColor,
        adminNotes: `Pengendalian Manual: Disahkan pukal oleh Admin. Pemandu: ${driverName}, Kenderaan: ${vehicle?.name || vehicleId} (${vehicle?.plateNumber || ''}).`,
        conflictReason: undefined,
      };
      updatedList.push(updated);
      return updated;
    }));

    if (activeTenant) {
      updatedList.forEach(b => {
        googleCalendarService.updateEvent(activeTenant, b, vehicles).catch(() => {});
      });
    }

    try {
      await storageService.updateBookingsBulk(bookingIds, {
        driverId,
        vehicleId,
        status: 'Confirmed',
      });
    } catch (err: any) {
      console.error('Gagal tugasan pukal:', err);
    }
  }, [users, vehicles, activeTenant]);

  const undoLastBookingChange = useCallback(() => {
    if (lastBookingChange) {
      setBookings(prev => prev.map(b => (b.id === lastBookingChange.bookingId ? lastBookingChange.previousState : b)));
      storageService.updateBooking(lastBookingChange.previousState as Booking).catch(err => {
        alert('Gagal undo: ' + err.message);
      });
      clearUndoState();
    }
  }, [lastBookingChange, clearUndoState]);

  // ---- Fuel logs ----
  const addFuelLog = useCallback((logData: Omit<FuelLog, 'id'>) => {
    const newLog: FuelLog = { ...logData, id: tempId('fuel') };
    setFuelLogs(prev => [...prev, newLog].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    storageService.createFuelLog(newLog)
      .then(saved => {
        setFuelLogs(prev => prev.map(l => (l.id === newLog.id ? saved : l)));
      })
      .catch(err => {
        alert('Gagal simpan fuel log: ' + err.message);
        setFuelLogs(prev => prev.filter(l => l.id !== newLog.id));
      });
  }, []);

  const updateFuelLog = useCallback((logId: string, updatedData: Partial<Omit<FuelLog, 'id'>>) => {
    setFuelLogs(prev => prev.map(log => (log.id === logId ? { ...log, ...updatedData } : log))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    storageService.updateFuelLog({ id: logId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini fuel log: ' + err.message);
    });
  }, []);

  const deleteFuelLog = useCallback((logId: string) => {
    clearUndoState();
    const logToDelete = fuelLogs.find(log => log.id === logId);
    if (logToDelete?.receiptAttachmentUrl) {
      if (logToDelete.receiptAttachmentUrl.startsWith('blob:')) {
        URL.revokeObjectURL(logToDelete.receiptAttachmentUrl);
      } else {
        deleteFromGoogleDrive(logToDelete.receiptAttachmentUrl, activeTenant).catch(err => {
          console.warn('[Google Drive] Delete receipt attachment error:', err);
        });
      }
    }
    setFuelLogs(prev => prev.filter(log => log.id !== logId));
    storageService.deleteFuelLog(logId).catch(err => {
      alert('Gagal padam fuel log: ' + err.message);
    });
  }, [clearUndoState, fuelLogs, activeTenant]);

  // ---- Odometer logs ----
  const addOdometerLog = useCallback((logData: Omit<OdometerLog, 'id'>) => {
    const newLog: OdometerLog = { ...logData, id: tempId('odo') };
    setOdometerLogs(prev => [newLog, ...prev]);
    storageService.createOdometerLog(newLog)
      .then(saved => {
        setOdometerLogs(prev => prev.map(l => (l.id === newLog.id ? saved : l)));
      })
      .catch(err => {
        alert('Gagal simpan odometer log: ' + err.message);
        setOdometerLogs(prev => prev.filter(l => l.id !== newLog.id));
      });

    // Sekiranya ada tempahan yang dipautkan, kemaskini maklumat odometer, kenderaan & status tempahan tersebut kepada Completed
    if (logData.bookingId) {
      updateBooking(logData.bookingId, {
        vehicleId: logData.vehicleId,
        startOdometer: logData.startOdometer,
        endOdometer: logData.odometer,
        distance: logData.distance,
        status: 'Completed'
      });
    }

    if (logData.bookingIds && logData.bookingIds.length > 0) {
      logData.bookingIds.forEach(id => {
        updateBooking(id, {
          vehicleId: logData.vehicleId,
          startOdometer: logData.startOdometer,
          endOdometer: logData.odometer,
          distance: logData.distance,
          status: 'Completed'
        });
      });
    }
  }, [updateBooking]);

  const updateOdometerLog = useCallback((logId: string, updatedData: Partial<Omit<OdometerLog, 'id'>>) => {
    setOdometerLogs(prev => prev.map(log => (log.id === logId ? { ...log, ...updatedData } : log))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    storageService.updateOdometerLog({ id: logId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini odometer log: ' + err.message);
    });
  }, []);

  const deleteOdometerLog = useCallback((logId: string) => {
    setOdometerLogs(prev => prev.filter(log => log.id !== logId));
    storageService.deleteOdometerLog(logId).catch(err => {
      alert('Gagal padam odometer log: ' + err.message);
    });
  }, []);

  // ---- Issue logs ----
  const addIssueLog = useCallback((logData: Omit<IssueLog, 'id'>) => {
    const newLog: IssueLog = { ...logData, id: tempId('issue') };
    setIssueLogs(prev => [newLog, ...prev].sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()));
    storageService.createIssueLog(newLog)
      .then(saved => {
        setIssueLogs(prev => prev.map(l => (l.id === newLog.id ? saved : l)));
      })
      .catch(err => {
        alert('Gagal simpan issue log: ' + err.message);
        setIssueLogs(prev => prev.filter(l => l.id !== newLog.id));
      });
  }, []);

  const updateIssueLog = useCallback((logId: string, updatedData: Partial<Omit<IssueLog, 'id'>>) => {
    setIssueLogs(prev => prev.map(log => (log.id === logId ? { ...log, ...updatedData } : log))
      .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime()));
    storageService.updateIssueLog({ id: logId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini issue log: ' + err.message);
    });
  }, []);

  const deleteIssueLog = useCallback((logId: string) => {
    setIssueLogs(prev => {
      const logToDelete = prev.find(log => log.id === logId);
      if (logToDelete?.photoUrl) {
        URL.revokeObjectURL(logToDelete.photoUrl);
      }
      return prev.filter(log => log.id !== logId);
    });
    storageService.deleteIssueLog(logId).catch(err => {
      alert('Gagal padam issue log: ' + err.message);
    });
  }, []);

  // ---- Jadual Pemandu ----
  const addDriverSchedule = useCallback((schedData: Omit<DriverSchedule, 'id'>) => {
    const newSched: DriverSchedule = { ...schedData, id: tempId('sched') };
    setDriverSchedules(prev => [...prev, newSched]);
    storageService.createDriverSchedule(newSched)
      .then(saved => {
        setDriverSchedules(prev => prev.map(s => (s.id === newSched.id ? saved : s)));
      })
      .catch(err => {
        alert('Gagal simpan jadual: ' + err.message);
        setDriverSchedules(prev => prev.filter(s => s.id !== newSched.id));
      });
  }, []);

  const updateDriverSchedule = useCallback((schedId: string, updatedData: Partial<Omit<DriverSchedule, 'id'>>) => {
    setDriverSchedules(prev => prev.map(s => (s.id === schedId ? { ...s, ...updatedData } : s)));
    storageService.updateDriverSchedule({ id: schedId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini jadual: ' + err.message);
    });
  }, []);

  const deleteDriverSchedule = useCallback((schedId: string) => {
    setDriverSchedules(prev => prev.filter(s => s.id !== schedId));
    storageService.deleteDriverSchedule(schedId).catch(err => {
      alert('Gagal padam jadual: ' + err.message);
    });
  }, []);

  const deleteDriverSchedulesBulk = useCallback((schedIds: string[]) => {
    setDriverSchedules(prev => prev.filter(s => !schedIds.includes(s.id)));
    storageService.deleteDriverSchedulesBulk(schedIds).catch(err => {
      alert('Gagal padam jadual secara pukal: ' + err.message);
    });
  }, []);

  // ---- Users ----
  const addUser = useCallback((userData: Omit<User, 'id'>) => {
    const newUser: User = { ...userData, id: tempId(userData.role) };
    setUsers(prev => [newUser, ...prev]);
    storageService.createUser(newUser)
      .then(saved => {
        setUsers(prev => prev.map(u => (u.id === newUser.id ? saved : u)));
      })
      .catch(err => {
        alert('Gagal simpan user: ' + err.message);
        setUsers(prev => prev.filter(u => u.id !== newUser.id));
      });
  }, []);

  const updateUser = useCallback((userId: string, updatedData: Partial<Omit<User, 'id'>>) => {
    setUsers(prev => prev.map(u => (u.id === userId ? { ...u, ...updatedData } : u)));
    storageService.updateUser({ id: userId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini user: ' + err.message);
    });
  }, []);

  const deleteUser = useCallback((userId: string) => {
    const userToDelete = users.find(u => u.id === userId);
    if (!userToDelete) return;

    if (userToDelete.isOwner) {
      alert("Super Admin account cannot be deleted.");
      return;
    }

    if (currentUser?.id === userId) {
      alert("You cannot delete your own account.");
      return;
    }

    if (!currentUser?.isOwner && userToDelete.role === 'admin') {
      alert("Access Denied: Only Super Admin can delete administrator accounts.");
      return;
    }

    if (userToDelete.role === 'driver' && bookings.some(b => b.driverId === userId)) {
      alert("Cannot delete driver. They are assigned to one or more bookings.");
      return;
    }

    if (userToDelete.role === 'admin' && users.filter(u => u.role === 'admin' && u.status === 'active').length <= 1) {
      alert("Cannot delete the last active administrator.");
      return;
    }

    clearUndoState();
    setUsers(prev => prev.filter(d => d.id !== userId));
    storageService.deleteUser(userId)
      .then(() => {
        reload();
      })
      .catch(err => {
        alert('Failed to delete user: ' + err.message);
        reload();
      });
  }, [users, bookings, currentUser, clearUndoState, reload]);

  // ---- Vehicles ----
  const addVehicle = useCallback((vehicleData: Omit<Vehicle, 'id'>) => {
    const newVehicle: Vehicle = { ...vehicleData, id: tempId('vehicle') };
    setVehicles(prev => [newVehicle, ...prev]);
    storageService.createVehicle(newVehicle)
      .then(saved => {
        setVehicles(prev => prev.map(v => (v.id === newVehicle.id ? saved : v)));
        if (newVehicle.currentOdometer && Number(newVehicle.currentOdometer) > 0) {
          const initialOdo: OdometerLog = {
            id: tempId('odo'),
            vehicleId: newVehicle.id,
            driverId: newVehicle.assignedDriverId || '',
            date: new Date().toISOString().split('T')[0],
            odometer: Number(newVehicle.currentOdometer),
            startOdometer: Number(newVehicle.currentOdometer),
            distance: 0,
            purpose: 'Initial Vehicle Registration Odometer',
            tenantId: newVehicle.tenantId || storageService.getTenantId()
          };
          setOdometerLogs(prev => [initialOdo, ...prev]);
          storageService.createOdometerLog(initialOdo).catch(console.warn);
        }
      })
      .catch(err => {
        alert('Failed to save vehicle: ' + err.message);
        setVehicles(prev => prev.filter(v => v.id !== newVehicle.id));
      });
  }, []);

  const updateVehicle = useCallback((vehicleId: string, updatedData: Partial<Omit<Vehicle, 'id'>>) => {
    setVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...updatedData } : v)));
    storageService.updateVehicle({ id: vehicleId, ...updatedData }).catch(err => {
      alert('Failed to update vehicle: ' + err.message);
    });
  }, []);

  const deleteVehicle = useCallback((vehicleId: string) => {
    if (bookings.some(b => b.vehicleId === vehicleId)) {
      alert("Cannot delete vehicle. It is assigned to one or more bookings.");
      return;
    }
    clearUndoState();
    setVehicles(prev => {
      const vehicleToDelete = prev.find(v => v.id === vehicleId);
      if (vehicleToDelete?.photoUrl) {
        URL.revokeObjectURL(vehicleToDelete.photoUrl);
      }
      return prev.filter(v => v.id !== vehicleId);
    });
    storageService.deleteVehicle(vehicleId).catch(err => {
      alert('Failed to delete vehicle: ' + err.message);
    });
  }, [bookings, clearUndoState]);

  const addSelfDriveStaff = useCallback(async (staffData: Omit<SelfDriveStaff, 'id' | 'createdAt'>): Promise<SelfDriveStaff> => {
    const id = tempId('staff-sds');
    const newStaff: SelfDriveStaff = {
      ...staffData,
      id,
      createdAt: new Date().toISOString(),
      tenantId: storageService.getTenantId()
    };
    setSelfDriveStaff(prev => [newStaff, ...prev]);
    await storageService.createSelfDriveStaff(newStaff);
    return newStaff;
  }, []);

  const updateSelfDriveStaff = useCallback(async (staffId: string, updatedData: Partial<Omit<SelfDriveStaff, 'id'>>): Promise<void> => {
    setSelfDriveStaff(prev => prev.map(s => s.id === staffId ? { ...s, ...updatedData } : s));
    await storageService.updateSelfDriveStaff({ id: staffId, ...updatedData });
  }, []);

  const deleteSelfDriveStaff = useCallback(async (staffId: string): Promise<void> => {
    setSelfDriveStaff(prev => prev.filter(s => s.id !== staffId));
    await storageService.deleteSelfDriveStaff(staffId);
  }, []);

  // ---- Maintenance Intervals & Logs ----
  const addMaintenanceInterval = useCallback(async (data: Omit<MaintenanceInterval, 'id'>): Promise<MaintenanceInterval> => {
    const id = tempId('m-int');
    const newInterval: MaintenanceInterval = {
      ...data,
      id,
      tenantId: storageService.getTenantId(),
    };
    setMaintenanceIntervals(prev => [newInterval, ...prev]);
    await storageService.createMaintenanceInterval(newInterval);
    return newInterval;
  }, []);

  const updateMaintenanceInterval = useCallback(async (id: string, updatedData: Partial<Omit<MaintenanceInterval, 'id'>>): Promise<void> => {
    setMaintenanceIntervals(prev => prev.map(item => item.id === id ? { ...item, ...updatedData } : item));
    await storageService.updateMaintenanceInterval({ id, ...updatedData });
  }, []);

  const deleteMaintenanceInterval = useCallback(async (id: string): Promise<void> => {
    setMaintenanceIntervals(prev => prev.filter(item => item.id !== id));
    await storageService.deleteMaintenanceInterval(id);
  }, []);

  const addMaintenanceLog = useCallback(async (data: Omit<MaintenanceLog, 'id'>, intervalIdToUpdate?: string): Promise<MaintenanceLog> => {
    const id = tempId('m-log');
    const newLog: MaintenanceLog = {
      ...data,
      id,
      tenantId: storageService.getTenantId(),
    };
    setMaintenanceLogs(prev => [newLog, ...prev]);
    await storageService.createMaintenanceLog(newLog);

    // Auto-advance corresponding maintenance interval(s)
    setMaintenanceIntervals(prev => {
      return prev.map(interval => {
        const isTarget = intervalIdToUpdate === interval.id || (
          interval.vehicleId === data.vehicleId && 
          data.serviceItems.some(item => 
            item.toLowerCase().includes(interval.serviceName.toLowerCase()) || 
            interval.serviceName.toLowerCase().includes(item.toLowerCase())
          )
        );

        if (isTarget) {
          const nextKm = interval.intervalKm > 0 ? data.odometer + interval.intervalKm : interval.nextDueOdometer;
          let nextDate = interval.nextDueDate;
          if (interval.intervalMonths > 0) {
            const d = new Date(data.serviceDate || new Date().toISOString().split('T')[0]);
            d.setMonth(d.getMonth() + interval.intervalMonths);
            nextDate = d.toISOString().split('T')[0];
          }
          const updated = {
            ...interval,
            lastServiceDate: data.serviceDate,
            lastServiceOdometer: data.odometer,
            nextDueOdometer: nextKm,
            nextDueDate: nextDate,
          };
          storageService.updateMaintenanceInterval({
            id: interval.id,
            lastServiceDate: updated.lastServiceDate,
            lastServiceOdometer: updated.lastServiceOdometer,
            nextDueOdometer: updated.nextDueOdometer,
            nextDueDate: updated.nextDueDate,
          }).catch(console.warn);
          return updated;
        }
        return interval;
      });
    });

    return newLog;
  }, []);

  const updateMaintenanceLog = useCallback(async (id: string, updatedData: Partial<Omit<MaintenanceLog, 'id'>>): Promise<void> => {
    setMaintenanceLogs(prev => prev.map(l => l.id === id ? { ...l, ...updatedData } : l));
    await storageService.updateMaintenanceLog({ id, ...updatedData });
  }, []);

  const deleteMaintenanceLog = useCallback(async (id: string): Promise<void> => {
    setMaintenanceLogs(prev => prev.filter(l => l.id !== id));
    await storageService.deleteMaintenanceLog(id);
  }, []);

  const renewVehicleCompliance = useCallback(async (
    vehicleId: string,
    renewalData: Omit<VehicleRenewal, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<{ success: boolean; renewal: VehicleRenewal; updatedVehicle: Vehicle }> => {
    const result = await postVehicleRenew(vehicleId, renewalData);

    if (result.success && result.data) {
      // 1. Immediately prepend renewal record to log history & cost
      setVehicleRenewals(prev => [result.data.renewal, ...prev.filter(r => r.id !== result.data.renewal.id)]);

      // 2. Immediately update vehicles in React state so badges switch immediately from Expired to Active
      setVehicles(prev => prev.map(v => {
        if (v.id !== vehicleId) return v;
        const updated: Vehicle = { ...v };
        if (renewalData.complianceType === 'Insurance') updated.insuranceExpiry = renewalData.newExpiryDate;
        if (renewalData.complianceType === 'Road Tax') updated.roadTaxExpiry = renewalData.newExpiryDate;
        if (renewalData.complianceType === 'PUSPAKOM') updated.puspakomExpiry = renewalData.newExpiryDate;
        if (renewalData.complianceType === 'Permit') updated.permitExpiry = renewalData.newExpiryDate;
        return updated;
      }));
    }

    return {
      success: result.success,
      renewal: result.data.renewal,
      updatedVehicle: result.data.vehicle,
    };
  }, []);

  const deleteVehicleRenewal = useCallback(async (id: string): Promise<boolean> => {
    setVehicleRenewals(prev => prev.filter(r => r.id !== id));
    await storageService.deleteVehicleRenewal(id);
    return true;
  }, []);

  const updateSupabaseDatabaseConfig = useCallback((url: string, anonKey: string): boolean => {
    const res = updateSupabaseConfig(url, anonKey);
    if (res.success) {
      reload();
      return true;
    }
    return false;
  }, [reload]);

  const resetSupabaseDatabaseConfig = useCallback((): void => {
    resetSupabaseConfig();
    reload();
  }, [reload]);

  return (
    <AppContext.Provider value={{
      users,
      vehicles,
      bookings,
      fuelLogs,
      odometerLogs,
      issueLogs,
      driverSchedules,
      currentUser,
      activeTenant,
      isLoading,
      loadError,
      lastDriverAssignedId,
      reload,
      login,
      logout,
      addBooking,
      updateBooking,
      deleteBooking,
      restoreBooking,
      assignToBooking,
      updateBookingStatus,
      deleteBookingsBulk,
      updateBookingsStatusBulk,
      assignBookingsBulk,
      addFuelLog,
      updateFuelLog,
      deleteFuelLog,
      addOdometerLog,
      updateOdometerLog,
      deleteOdometerLog,
      addIssueLog,
      updateIssueLog,
      deleteIssueLog,
      addDriverSchedule,
      updateDriverSchedule,
      deleteDriverSchedule,
      deleteDriverSchedulesBulk,
      lastBookingChange,
      undoLastBookingChange,
      addUser,
      updateUser,
      deleteUser,
      addVehicle,
      updateVehicle,
      deleteVehicle,
      updateGoogleCalendarId,
      updateGoogleDriveId,
      updateGoogleAppsScriptUrl,
      updateTenantGoogleIntegrations,
      updateTenantProfile,
      registerOrganization,
      deleteTenantCompletely,
      selfDriveStaff,
      addSelfDriveStaff,
      updateSelfDriveStaff,
      deleteSelfDriveStaff,
      maintenanceIntervals,
      maintenanceLogs,
      addMaintenanceInterval,
      updateMaintenanceInterval,
      deleteMaintenanceInterval,
      addMaintenanceLog,
      updateMaintenanceLog,
      deleteMaintenanceLog,
      vehicleRenewals,
      renewVehicleCompliance,
      deleteVehicleRenewal,
      updateSupabaseDatabaseConfig,
      resetSupabaseDatabaseConfig,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
