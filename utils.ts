/**
 * Parsers and helpers for handling dates and times consistently.
 * Multi-stop route helpers (Phase 1) included at the bottom.
 */

import type { Booking, BookingStop, User, Vehicle } from './types';

export const parseAsLocal = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  try {
    const cleaned = String(dateStr).trim();

    // 1. Standard ISO or database datetime string (e.g. 2026-09-19T10:30:00, 2026-09-19T10:30:00+00:00, 2026-09-19T10:30:00Z)
    // In Armada Flow, the wall-clock time in the date string represents the local Malaysia booking schedule.
    // We extract year, month, day, hour, minute directly so UTC offsets from the DB do not shift the time by +8 hours.
    const isoMatch = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (isoMatch) {
      const y = Number(isoMatch[1]);
      const m = Number(isoMatch[2]);
      const d = Number(isoMatch[3]);
      const hh = Number(isoMatch[4]);
      const mm = Number(isoMatch[5]);
      const ss = Number(isoMatch[6] || 0);
      return new Date(y, m - 1, d, hh, mm, ss);
    }

    // 2. Date-only YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      const [y, m, d] = cleaned.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    // 3. Date format DD/MM/YYYY or D/M/YYYY
    const dmyMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:[T ](\d{2}):(\d{2}))?/);
    if (dmyMatch) {
      const d = Number(dmyMatch[1]);
      const m = Number(dmyMatch[2]);
      const y = Number(dmyMatch[3]);
      const hh = Number(dmyMatch[4] || 0);
      const mm = Number(dmyMatch[5] || 0);
      return new Date(y, m - 1, d, hh, mm, 0);
    }

    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch (e) {
    // Ignore and fallback
  }
  return new Date(dateStr);
};

/**
 * Checks whether a pickup point is an 'other' / custom location option.
 */
export const isOtherPickup = (pickupPoint?: string | null): boolean => {
  if (!pickupPoint) return false;
  const lower = pickupPoint.trim().toLowerCase();
  return lower.includes('lain') || lower.includes('other') || lower.includes('nyatakan');
};

/**
 * Formats the pickup location display with its specific address if it is an 'other' location.
 * Examples:
 * - 'YCK', '' -> 'YCK'
 * - 'PJBA', '' -> 'PJBA'
 * - 'Lokasi Lain (Sila Nyatakan)', 'Tiong Nam' -> 'Lokasi Lain (Tiong Nam)'
 * - 'Lain-lain', '16, Lorong Tiong Nam' -> 'Lokasi Lain (16, Lorong Tiong Nam)'
 */
export const getPickupLocationDisplay = (
  pickupPoint?: string | null,
  address?: string | null
): string => {
  const cleanPickup = (pickupPoint || '').trim();
  const cleanAddress = (address || '').trim();

  if (isOtherPickup(cleanPickup)) {
    if (cleanAddress) {
      // If address already has "Other Location" / "Lokasi Lain" prefix, don't duplicate
      if (/^(other\s+location|lokasi\s+lain|lain-lain)/i.test(cleanAddress)) {
        return cleanAddress;
      }
      return `Other Location (${cleanAddress})`;
    }
    return 'Other Location';
  }

  // If pickupPoint is empty but address is provided and not a known standard pickup
  if (!cleanPickup && cleanAddress) {
    return cleanAddress;
  }

  return cleanPickup || 'Not Specified';
};

// ─── Multi-stop route helpers (Phase 1) ───────────────────────────────────────

/** Build a short unique id for a stop row (client-side). */
export const createStopId = (): string =>
  `stop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Normalize stops from a booking. Legacy bookings without `stops` fall back
 * to a single stop from `destination`.
 */
export const getStops = (booking: Pick<Booking, 'destination' | 'stops'> | null | undefined): BookingStop[] => {
  if (!booking) return [];
  if (booking.stops && booking.stops.length > 0) {
    return [...booking.stops]
      .filter(s => s && (s.address || '').trim())
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((s, i) => ({
        id: s.id || createStopId(),
        sequence: i + 1,
        address: (s.address || '').trim(),
        notes: s.notes?.trim() || undefined,
      }));
  }
  const dest = (booking.destination || '').trim();
  if (dest) {
    return [{ id: 'legacy', sequence: 1, address: dest }];
  }
  return [];
};

/** Human-readable route label: "A" or "A → B → C". */
export const getRouteLabel = (booking: Pick<Booking, 'destination' | 'stops'> | null | undefined): string => {
  const stops = getStops(booking);
  if (stops.length === 0) return (booking?.destination || '').trim() || '—';
  if (stops.length === 1) return stops[0].address;
  return stops.map(s => s.address).join(' → ');
};

/** Derive the legacy `destination` string from structured stops. */
export const deriveDestination = (stops: BookingStop[] | undefined | null, fallback = ''): string => {
  if (!stops || stops.length === 0) return fallback;
  const cleaned = stops
    .map(s => (s.address || '').trim())
    .filter(Boolean);
  if (cleaned.length === 0) return fallback;
  if (cleaned.length === 1) return cleaned[0];
  return cleaned.join(' → ');
};

/**
 * Prepare stops for persistence: trim, renumber sequence, drop empty addresses.
 */
export const normalizeStopsForSave = (
  stops: Array<{ id?: string; address: string; notes?: string }>
): BookingStop[] => {
  return stops
    .map(s => ({
      id: s.id || createStopId(),
      address: (s.address || '').trim(),
      notes: (s.notes || '').trim() || undefined,
    }))
    .filter(s => s.address)
    .map((s, i) => ({
      id: s.id,
      sequence: i + 1,
      address: s.address,
      notes: s.notes,
    }));
};

/**
 * Robust driver resolution helper that matches by ID, email, name, or extracted calendar event title.
 * Resilient against user ID migrations (e.g. Supabase Auth IDs vs legacy IDs).
 */
export const resolveDriver = (
  users: User[] | undefined,
  driverId?: string | null,
  calendarTitle?: string | null
): User | undefined => {
  if (!users || users.length === 0) return undefined;

  if (driverId) {
    const dStr = String(driverId).trim();
    const dLower = dStr.toLowerCase();
    const cleanD = dLower.replace(/^driver-/, '').replace(/^user-/, '').trim();

    // 1. Exact fleet_users.id match (case-insensitive)
    const byId = users.find(u => u.id === dStr || u.id.toLowerCase() === dLower);
    if (byId) return byId;

    // 1b. auth_user_id (Supabase Auth UUID) — tolerate accidental auth UUID in schedules/bookings
    const byAuthId = users.find(u => {
      const authId = (u as any).authUserId || (u as any).auth_user_id;
      return authId && (authId === dStr || String(authId).toLowerCase() === dLower);
    });
    if (byAuthId) return byAuthId;

    // 2. Email match (exact or email handle match e.g. 'syafiq' matches 'syafiq@yck.org.my')
    const byEmail = users.find(u => {
      if (!u.email) return false;
      const uEmail = u.email.trim().toLowerCase();
      const uPrefix = uEmail.split('@')[0];
      return uEmail === dLower || uPrefix === dLower || uPrefix === cleanD;
    });
    if (byEmail) return byEmail;

    // 3. Exact Name match (case-insensitive)
    const byName = users.find(u => u.name && u.name.trim().toLowerCase() === dLower);
    if (byName) return byName;

    // 4. Clean name match (e.g. 'driver-syafiq' -> cleanD is 'syafiq' which matches 'Syafiq' or 'Muhammad Syafiq')
    const byCleanName = users.find(u => {
      if (!u.name) return false;
      const uName = u.name.trim().toLowerCase();
      if (uName === cleanD) return true;
      const uWords = uName.split(/\s+/);
      return uWords.includes(cleanD) || cleanD.includes(uName) || uName.includes(cleanD);
    });
    if (byCleanName) return byCleanName;

    // 5. Special well-known driver matching
    if (cleanD.includes('syafiq')) {
      const syafiq = users.find(u => (u.name || '').toLowerCase().includes('syafiq') || (u.email || '').toLowerCase().includes('syafiq'));
      if (syafiq) return syafiq;
    }
    if (cleanD.includes('saiful')) {
      const saiful = users.find(u => (u.name || '').toLowerCase().includes('saiful') || (u.email || '').toLowerCase().includes('saiful'));
      if (saiful) return saiful;
    }
    if (cleanD.includes('aziz')) {
      const aziz = users.find(u => (u.name || '').toLowerCase().includes('aziz') || (u.email || '').toLowerCase().includes('aziz'));
      if (aziz) return aziz;
    }

    // 6. Partial substring match on name / id
    const byPartial = users.find(u => {
      const uName = (u.name || '').trim().toLowerCase();
      const uId = (u.id || '').trim().toLowerCase();
      return (
        (uName && (dLower.includes(uName) || uName.includes(dLower))) ||
        (uId && (dLower.includes(uId) || uId.includes(dLower)))
      );
    });
    if (byPartial) return byPartial;
  }

  // 7. Fallback: Extract driver name from Google Calendar title e.g. "(Saiful) Ain Muhd → ..."
  if (calendarTitle) {
    const match = calendarTitle.match(/^\(([^)]+)\)/);
    if (match && match[1]) {
      const titleName = match[1].trim().toLowerCase();
      if (!titleName.includes('reject') && !titleName.includes('conflict') && !titleName.includes('alza')) {
        const byTitle = users.find(u => {
          const uName = (u.name || '').trim().toLowerCase();
          return uName && (titleName.includes(uName) || uName.includes(titleName) || uName.split(/\s+/).some(w => w.length >= 3 && titleName.includes(w)));
        });
        if (byTitle) return byTitle;

        if (titleName.includes('syafiq')) {
          const s = users.find(u => (u.name || '').toLowerCase().includes('syafiq'));
          if (s) return s;
        }
        if (titleName.includes('saiful')) {
          const s = users.find(u => (u.name || '').toLowerCase().includes('saiful'));
          if (s) return s;
        }
      }
    }
  }

  return undefined;
};

/**
 * Gets the human-readable display name for a driver, never falling back to blank or raw IDs.
 */
export const getDriverDisplayName = (
  users: User[] | undefined,
  driverId?: string | null,
  calendarTitle?: string | null,
  serviceType?: string
): string => {
  if (serviceType === 'Self-Drive') return 'Self-Drive (Staff)';

  const resolved = resolveDriver(users, driverId, calendarTitle);
  if (resolved) return resolved.name;

  if (calendarTitle) {
    const match = calendarTitle.match(/^\(([^)]+)\)/);
    if (match && match[1]) {
      const t = match[1].trim();
      if (!t.toLowerCase().includes('reject') && !t.toLowerCase().includes('conflict') && !t.toLowerCase().includes('alza')) {
        return t;
      }
    }
  }

  if (driverId) {
    const cleanId = String(driverId).trim().toLowerCase();
    if (cleanId.includes('syafiq')) return 'Syafiq';
    if (cleanId.includes('saiful')) return 'Saiful';
    if (cleanId.includes('aziz')) return 'Aziz';

    const sub = cleanId.replace(/^driver-/, '').replace(/^user-/, '');
    if (sub && !/\d{4,}/.test(sub)) {
      return sub.charAt(0).toUpperCase() + sub.slice(1);
    }
    return String(driverId).trim();
  }

  return 'Unassigned';
};

/**
 * Robust vehicle resolution helper matching by ID, vehicle preference, or fuzzy model name.
 */
export const resolveVehicle = (
  vehicles: Vehicle[] | undefined,
  vehicleId?: string | null,
  vehiclePreference?: string | null
): Vehicle | undefined => {
  if (!vehicles || vehicles.length === 0) return undefined;

  if (vehicleId) {
    const byId = vehicles.find(v => v.id === vehicleId);
    if (byId) return byId;
  }

  if (vehiclePreference && vehiclePreference !== 'Bebas' && vehiclePreference !== 'Any / Free Choice' && vehiclePreference !== 'Any / No Preference') {
    const prefLower = vehiclePreference.toLowerCase().trim();
    const byPref = vehicles.find(v => {
      const vName = (v.name || '').toLowerCase().trim();
      const vPlate = (v.plateNumber || '').toLowerCase().trim();
      return (
        vName === prefLower ||
        vPlate === prefLower ||
        vName.includes(prefLower) ||
        prefLower.includes(vName) ||
        (prefLower.includes('alza') && vName.includes('alza')) ||
        (prefLower.includes('hiace') && vName.includes('hiace')) ||
        (prefLower.includes('foton') && vName.includes('foton')) ||
        (prefLower.includes('urvan') && vName.includes('urvan')) ||
        (prefLower.includes('transit') && vName.includes('transit'))
      );
    });
    if (byPref) return byPref;
  }

  return undefined;
};

