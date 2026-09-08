import React, { createContext, useState, useContext, ReactNode, useCallback, useRef, useEffect } from 'react';
import type { Booking, FuelLog, OdometerLog, User, Vehicle, BookingHistory, CurrentUser, IssueLog, DriverSchedule } from '../types';
import { storageService } from '../services/storage';

interface AppContextType {
  users: User[];
  vehicles: Vehicle[];
  bookings: Booking[];
  fuelLogs: FuelLog[];
  odometerLogs: OdometerLog[];
  issueLogs: IssueLog[];
  driverSchedules: DriverSchedule[];
  currentUser: CurrentUser | null;
  isLoading: boolean;
  loadError: string | null;
  reload: () => void;
  login: (name: string, password: string) => boolean;
  logout: () => void;
  addBooking: (booking: Omit<Booking, 'id'>) => void;
  updateBooking: (bookingId: string, updatedData: Partial<Omit<Booking, 'id'>>) => void;
  deleteBooking: (bookingId: string) => void;
  restoreBooking: (bookingId: string) => void;
  assignToBooking: (bookingId: string, driverId: string, vehicleId: string) => void;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
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
  lastBookingChange: BookingHistory | null;
  undoLastBookingChange: () => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (userId: string, updatedData: Partial<Omit<User, 'id'>>) => void;
  deleteUser: (userId: string) => void;
  addVehicle: (vehicle: Omit<Vehicle, 'id'>) => void;
  updateVehicle: (vehicleId: string, updatedData: Partial<Omit<Vehicle, 'id'>>) => void;
  deleteVehicle: (vehicleId: string) => void;
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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const [lastBookingChange, setLastBookingChange] = useState<BookingHistory | null>(null);
  const undoTimeoutRef = useRef<number | null>(null);

  // ---- Initial load (dan reload) dari Google Sheet API ----
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
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
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [reloadTick]);

  const reload = useCallback(() => setReloadTick(t => t + 1), []);

  const login = useCallback((name: string, password: string): boolean => {
    const user = users.find(u =>
        u.name.trim().toLowerCase() === name.trim().toLowerCase() &&
        String(u.password).trim() === String(password).trim() &&
        String(u.status).trim().toLowerCase() === 'active'
    );

    if (user) {
      setCurrentUser({ id: user.id, name: user.name, role: user.role });
      return true;
    }

    return false;
  }, [users]);

  const logout = useCallback(() => {
    setCurrentUser(null);
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
  const addBooking = useCallback((bookingData: Omit<Booking, 'id'>) => {
    if (bookingData.recurrence) {
      const { frequency, endDate: recurrenceEndDateStr } = bookingData.recurrence;

      const parts = recurrenceEndDateStr.split('-');
      const recurrenceEndDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
      recurrenceEndDate.setHours(23, 59, 59, 999);

      const startDate = new Date(bookingData.dateTime);
      const newBookings: Booking[] = [];
      const recurrenceId = `recur-${Date.now()}`;
      let currentDate = new Date(startDate);

      while (currentDate <= recurrenceEndDate) {
        const finishDateTime = bookingData.finishDateTime ? new Date(bookingData.finishDateTime) : null;
        let currentFinishDateTime: Date | undefined;
        if (finishDateTime) {
          const duration = finishDateTime.getTime() - startDate.getTime();
          currentFinishDateTime = new Date(currentDate.getTime() + duration);
        }

        const newBooking: Booking = {
          ...bookingData,
          id: tempId('booking'),
          dateTime: currentDate.toISOString(),
          finishDateTime: currentFinishDateTime ? currentFinishDateTime.toISOString() : undefined,
          recurrenceId,
          recurrence: newBookings.length === 0 ? bookingData.recurrence : undefined,
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

      setBookings(prev => [...newBookings, ...prev]);
      newBookings.forEach(b => {
        storageService.createBooking(b).catch(err => {
          alert('Gagal simpan booking berulang: ' + err.message);
        });
      });
    } else {
      const newBooking: Booking = { ...bookingData, id: tempId('booking') };
      setBookings(prev => [newBooking, ...prev]);
      storageService.createBooking(newBooking).catch(err => {
        alert('Gagal simpan booking: ' + err.message);
        setBookings(prev => prev.filter(b => b.id !== newBooking.id));
      });
    }
  }, []);

  const updateBooking = useCallback((bookingId: string, updatedData: Partial<Omit<Booking, 'id'>>) => {
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => (b.id === bookingId ? { ...b, ...updatedData } : b));
    });
    storageService.updateBooking({ id: bookingId, ...updatedData }).catch(err => {
      alert('Gagal kemaskini booking: ' + err.message);
    });
  }, [setUndoableAction]);

  const deleteBooking = useCallback((bookingId: string) => {
    clearUndoState();
    setBookings(prev => {
      const bookingToDelete = prev.find(b => b.id === bookingId);
      if (bookingToDelete?.attachmentUrl) {
        URL.revokeObjectURL(bookingToDelete.attachmentUrl);
      }
      return prev.filter(b => b.id !== bookingId);
    });
    storageService.deleteBooking(bookingId).catch(err => {
      alert('Gagal padam booking: ' + err.message);
    });
  }, [clearUndoState]);

  const restoreBooking = useCallback((bookingId: string) => {
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => (b.id === bookingId ? { ...b, status: 'Pending' as Booking['status'] } : b));
    });
    storageService.updateBooking({ id: bookingId, status: 'Pending' }).catch(err => {
      alert('Gagal restore booking: ' + err.message);
    });
  }, [setUndoableAction]);

  const assignToBooking = useCallback((bookingId: string, driverId: string, vehicleId: string) => {
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => (b.id === bookingId ? { ...b, driverId, vehicleId, status: 'Assigned' as Booking['status'] } : b));
    });
    storageService.updateBooking({ id: bookingId, driverId, vehicleId, status: 'Assigned' }).catch(err => {
      alert('Gagal assign booking: ' + err.message);
    });
  }, [setUndoableAction]);

  const updateBookingStatus = useCallback((bookingId: string, status: Booking['status']) => {
    setBookings(prev => {
      setUndoableAction(bookingId, prev);
      return prev.map(b => (b.id === bookingId ? { ...b, status } : b));
    });
    storageService.updateBooking({ id: bookingId, status }).catch(err => {
      alert('Gagal kemaskini status booking: ' + err.message);
    });
  }, [setUndoableAction]);

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
    storageService.createFuelLog(newLog).catch(err => {
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
    storageService.createOdometerLog(newLog).catch(err => {
      alert('Gagal simpan odometer log: ' + err.message);
      setOdometerLogs(prev => prev.filter(l => l.id !== newLog.id));
    });
  }, []);

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
    storageService.createIssueLog(newLog).catch(err => {
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
    storageService.createDriverSchedule(newSched).catch(err => {
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

  // ---- Users ----
  const addUser = useCallback((userData: Omit<User, 'id'>) => {
    const newUser: User = { ...userData, id: tempId(userData.role) };
    setUsers(prev => [newUser, ...prev]);
    storageService.createUser(newUser).catch(err => {
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
    storageService.createVehicle(newVehicle).catch(err => {
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
      isLoading,
      loadError,
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
      lastBookingChange,
      undoLastBookingChange,
      addUser,
      updateUser,
      deleteUser,
      addVehicle,
      updateVehicle,
      deleteVehicle,
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
