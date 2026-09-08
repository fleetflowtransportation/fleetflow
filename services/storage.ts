import type { Booking, FuelLog, OdometerLog, User, Vehicle, IssueLog, DriverSchedule } from '../types';

// URL Web App Apps Script (FleetFlow backend). Tukar sini kalau deploy versi baru.
const API_URL = "https://script.google.com/macros/s/AKfycbzlPPuFR_i293aJBAJ62iwaqE2t1MTrv2Nh4AE_AjWwcbfwMrifSVtadAp16RDqL4EH/exec";

type CollectionName = 'Users' | 'Vehicles' | 'Bookings' | 'FuelLogs' | 'OdometerLogs' | 'IssueLogs' | 'Jadual Pemandu';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function apiGet<T>(collection: CollectionName): Promise<T[]> {
  const res = await fetch(`${API_URL}?collection=${collection}`);
  const json: ApiResponse<T[]> = await res.json();
  if (!json.ok) throw new Error(json.error || `Gagal baca ${collection}`);
  return json.data || [];
}

async function apiMutate<T>(
  collection: CollectionName,
  action: 'create' | 'update' | 'delete',
  data: any,
  userEmail?: string
): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    // Apps Script Web App tak baca custom headers dengan baik dari browser (CORS preflight
    // issue) — guna text/plain supaya request jadi "simple request", Apps Script tetap boleh
    // JSON.parse(e.postData.contents) macam biasa.
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ collection, action, data, email: userEmail }),
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.ok) throw new Error(json.error || `Gagal ${action} ${collection}`);
  return json.data as T;
}

export const storageService = {
  // ---- READ (semua collection) ----
  getUsers: (): Promise<User[]> => apiGet<User>('Users'),
  getVehicles: (): Promise<Vehicle[]> => apiGet<Vehicle>('Vehicles'),
  getBookings: (): Promise<Booking[]> => apiGet<Booking>('Bookings'),
  getFuelLogs: (): Promise<FuelLog[]> => apiGet<FuelLog>('FuelLogs'),
  getOdometerLogs: (): Promise<OdometerLog[]> => apiGet<OdometerLog>('OdometerLogs'),
  getIssueLogs: (): Promise<IssueLog[]> => apiGet<IssueLog>('IssueLogs'),
  getDriverSchedules: (): Promise<DriverSchedule[]> => apiGet<DriverSchedule>('Jadual Pemandu'),

  // ---- WRITE (per-record — sepadan dengan backend Apps Script) ----
  createBooking: (data: Booking, email?: string) => apiMutate<Booking>('Bookings', 'create', data, email),
  updateBooking: (data: Partial<Booking> & { id: string }, email?: string) => apiMutate<Booking>('Bookings', 'update', data, email),
  deleteBooking: (id: string, email?: string) => apiMutate<{ id: string }>('Bookings', 'delete', { id }, email),

  createFuelLog: (data: FuelLog, email?: string) => apiMutate<FuelLog>('FuelLogs', 'create', data, email),
  updateFuelLog: (data: Partial<FuelLog> & { id: string }, email?: string) => apiMutate<FuelLog>('FuelLogs', 'update', data, email),
  deleteFuelLog: (id: string, email?: string) => apiMutate<{ id: string }>('FuelLogs', 'delete', { id }, email),

  createOdometerLog: (data: OdometerLog, email?: string) => apiMutate<OdometerLog>('OdometerLogs', 'create', data, email),
  updateOdometerLog: (data: Partial<OdometerLog> & { id: string }, email?: string) => apiMutate<OdometerLog>('OdometerLogs', 'update', data, email),
  deleteOdometerLog: (id: string, email?: string) => apiMutate<{ id: string }>('OdometerLogs', 'delete', { id }, email),

  createIssueLog: (data: IssueLog, email?: string) => apiMutate<IssueLog>('IssueLogs', 'create', data, email),
  updateIssueLog: (data: Partial<IssueLog> & { id: string }, email?: string) => apiMutate<IssueLog>('IssueLogs', 'update', data, email),
  deleteIssueLog: (id: string, email?: string) => apiMutate<{ id: string }>('IssueLogs', 'delete', { id }, email),

  createUser: (data: User, email?: string) => apiMutate<User>('Users', 'create', data, email),
  updateUser: (data: Partial<User> & { id: string }, email?: string) => apiMutate<User>('Users', 'update', data, email),
  deleteUser: (id: string, email?: string) => apiMutate<{ id: string }>('Users', 'delete', { id }, email),

  createVehicle: (data: Vehicle, email?: string) => apiMutate<Vehicle>('Vehicles', 'create', data, email),
  updateVehicle: (data: Partial<Vehicle> & { id: string }, email?: string) => apiMutate<Vehicle>('Vehicles', 'update', data, email),
  deleteVehicle: (id: string, email?: string) => apiMutate<{ id: string }>('Vehicles', 'delete', { id }, email),

  createDriverSchedule: (data: DriverSchedule, email?: string) => apiMutate<DriverSchedule>('Jadual Pemandu', 'create', data, email),
  updateDriverSchedule: (data: Partial<DriverSchedule> & { id: string }, email?: string) => apiMutate<DriverSchedule>('Jadual Pemandu', 'update', data, email),
  deleteDriverSchedule: (id: string, email?: string) => apiMutate<{ id: string }>('Jadual Pemandu', 'delete', { id }, email),
};
