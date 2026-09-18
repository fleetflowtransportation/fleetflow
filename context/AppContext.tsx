import React, { createContext, useState, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import type { Booking, FuelLog, OdometerLog, User, Vehicle, BookingHistory, CurrentUser, IssueLog, DriverSchedule, Tenant } from '../types';
import { storageService } from '../services/storage';
import { parseAsLocal } from '../utils';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, getDriverCalendarColor, type AutoAssignResult } from '../services/bookingEngine';
import { googleCalendarService } from '../services/googleCalendar';

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
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  addBooking: (booking: Omit<Booking, 'id'>) => AutoAssignResult;
  updateBooking: (bookingId: string, updatedData: Partial<Omit<Booking, 'id'>>) => void;
  deleteBooking: (bookingId: string) => void;
  restoreBooking: (bookingId: string) => void;
  assignToBooking: (bookingId: string, driverId: string, vehicleId: string) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status'], cancellationReason?: string) => void;
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
  registerOrganization: (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string) => Promise<boolean>;
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
    const savedTenantId = localStorage.getItem('fleetflow_tenant_id') || 'yayasan-chow-kit';
    const savedUserData = localStorage.getItem('fleetflow_user_data');
    
    storageService.setTenantId(savedTenantId);
    
    if (savedUserData) {
      try {
        const parsed = JSON.parse(savedUserData);
        setCurrentUser(parsed);
      } catch {
        // ignore
      }
    }
    
    storageService.getTenant(savedTenantId).then(tenant => {
      setActiveTenant(tenant);
      setTenantInitialized(true);
    });
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
    ])
      .then(([u, v, b, f, o, i, s]) => {
        if (cancelled) return;
        setUsers(u);
        setVehicles(v);
        setBookings(b);
        setFuelLogs(f);
        setOdometerLogs(o);
        setIssueLogs(i);
        setDriverSchedules(s);
      })
      .catch(err => {
        if (cancelled) return;
        setLoadError(err.message || 'Gagal memuatkan data dari server.');
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

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    try {
      const user = await storageService.getUserByEmailGlobal(email);
      if (user && String(user.password).trim() === String(password).trim() && String(user.status).trim().toLowerCase() === 'active') {
        const tenantId = user.tenantId;
        storageService.setTenantId(tenantId);
        localStorage.setItem('fleetflow_tenant_id', tenantId);
        localStorage.setItem('fleetflow_user_data', JSON.stringify({ id: user.id, name: user.name, role: user.role, tenantId }));
        
        setCurrentUser({ id: user.id, name: user.name, role: user.role, tenantId });
        reload();
        return true;
      }
      return false;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  }, [reload]);

  const logout = useCallback(() => {
    localStorage.removeItem('fleetflow_tenant_id');
    localStorage.removeItem('fleetflow_user_data');
    storageService.setTenantId('yayasan-chow-kit');
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

  const registerOrganization = useCallback(async (tenantId: string, tenantName: string, adminName: string, adminEmail: string, adminPassword?: string): Promise<boolean> => {
    const success = await storageService.signUpTenant(tenantId, tenantName, adminName, adminEmail, adminPassword);
    if (success) {
      reload();
    }
    return success;
  }, [reload]);

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
          googleCalendarService.createEvent(activeTenant, b).then(eventId => {
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
        googleCalendarService.createEvent(activeTenant, newBooking).then(eventId => {
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
    let updatedFullBooking: Booking | undefined;
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => {
        if (b.id === bookingId) {
          updatedFullBooking = { ...b, ...updatedData };
          return updatedFullBooking;
        }
        return b;
      });
    });

    if (activeTenant && updatedFullBooking) {
      googleCalendarService.updateEvent(activeTenant, updatedFullBooking).catch(err => {
        console.warn('Gagal sync kemaskini kalendar:', err);
      });
    }

    storageService.updateBooking({ id: bookingId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini booking: ' + err.message);
    });
  }, [setUndoableAction, activeTenant]);

  const deleteBooking = useCallback((bookingId: string) => {
    clearUndoState();
    let bookingToDelete: Booking | undefined;
    setBookings(prev => {
      bookingToDelete = prev.find(b => b.id === bookingId);
      if (bookingToDelete?.attachmentUrl) {
        if (bookingToDelete.attachmentUrl.startsWith('blob:')) {
          URL.revokeObjectURL(bookingToDelete.attachmentUrl);
        } else {
          const driveUrl = import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
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
      return prev.filter(b => b.id !== bookingId);
    });

    if (activeTenant && bookingToDelete) {
      googleCalendarService.deleteEvent(activeTenant, (bookingToDelete as Booking).calendarEventId, bookingToDelete).catch(err => {
        console.warn('Gagal memadam acara kalendar Google:', err);
      });
    }

    storageService.deleteBooking(bookingId).catch(err => {
      alert('Gagal padam booking: ' + err.message);
    });
  }, [clearUndoState, activeTenant]);

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
        const calTitle = `(${driverName}) ${b.requesterName} → ${b.destination}`;
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
      googleCalendarService.updateEvent(activeTenant, assignedBooking).catch(() => {});
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
    setFuelLogs(prev => {
      const logToDelete = prev.find(log => log.id === logId);
      if (logToDelete?.receiptAttachmentUrl) {
        URL.revokeObjectURL(logToDelete.receiptAttachmentUrl);
      }
      return prev.filter(log => log.id !== logId);
    });
    storageService.deleteFuelLog(logId).catch(err => {
      alert('Gagal padam fuel log: ' + err.message);
    });
  }, [clearUndoState]);

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

    if (userToDelete.role === 'driver' && bookings.some(b => b.driverId === userId)) {
      alert("Cannot delete driver. They are assigned to one or more bookings.");
      return;
    }

    if (userToDelete.role === 'admin' && users.filter(u => u.role === 'admin' && u.status === 'active').length <= 1) {
      alert("Cannot delete the last active admin.");
      return;
    }

    clearUndoState();
    setUsers(prev => prev.filter(d => d.id !== userId));
    storageService.deleteUser(userId).catch(err => {
      alert('Gagal padam user: ' + err.message);
    });
  }, [users, bookings, clearUndoState]);

  // ---- Vehicles ----
  const addVehicle = useCallback((vehicleData: Omit<Vehicle, 'id'>) => {
    const newVehicle: Vehicle = { ...vehicleData, id: tempId('vehicle') };
    setVehicles(prev => [newVehicle, ...prev]);
    storageService.createVehicle(newVehicle)
      .then(saved => {
        setVehicles(prev => prev.map(v => (v.id === newVehicle.id ? saved : v)));
      })
      .catch(err => {
        alert('Gagal simpan vehicle: ' + err.message);
        setVehicles(prev => prev.filter(v => v.id !== newVehicle.id));
      });
  }, []);

  const updateVehicle = useCallback((vehicleId: string, updatedData: Partial<Omit<Vehicle, 'id'>>) => {
    setVehicles(prev => prev.map(v => (v.id === vehicleId ? { ...v, ...updatedData } : v)));
    storageService.updateVehicle({ id: vehicleId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini vehicle: ' + err.message);
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
      alert('Gagal padam vehicle: ' + err.message);
    });
  }, [bookings, clearUndoState]);

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
      registerOrganization,
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
