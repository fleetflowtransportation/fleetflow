/**
 * Parsers and helpers for handling dates and times consistently.
 */

export const parseAsLocal = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  try {
    const cleaned = String(dateStr).trim();

    // 1. If ISO string has UTC indicator 'Z' or explicit offset like +08:00 / +0800
    if (cleaned.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(cleaned)) {
      const d = new Date(cleaned);
      if (!isNaN(d.getTime())) {
        return d;
      }
    }

    // 2. If string is a local YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
      const [y, m, d] = cleaned.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    // 3. If string is local YYYY-MM-DDTHH:mm or YYYY-MM-DD HH:mm
    if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(cleaned)) {
      const [datePart, timePart] = cleaned.replace(' ', 'T').split('T');
      const [y, m, d] = datePart.split('-').map(Number);
      const timeClean = timePart.split('.')[0]; // remove milliseconds if any
      const [hh, mm, ss] = timeClean.split(':').map(Number);
      return new Date(y, m - 1, d, hh, mm, ss || 0);
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
