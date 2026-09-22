/**
 * Parsers and helpers for handling dates and times consistently.
 */

export const parseAsLocal = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  try {
    const cleaned = String(dateStr).trim();

    // 1. Standard ISO or database datetime string (e.g. 2026-09-19T10:30:00, 2026-09-19T10:30:00+00:00, 2026-09-19T10:30:00Z)
    // In FleetFlow, the wall-clock time in the date string represents the local Malaysia booking schedule.
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
