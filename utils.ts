/**
 * Parsers and helpers for handling dates and times consistently.
 */

export const parseAsLocal = (dateStr: string | Date | undefined | null): Date => {
  if (!dateStr) return new Date();
  if (dateStr instanceof Date) return dateStr;
  
  try {
    let cleaned = String(dateStr).trim();
    // Strip trailing timezone offsets like +00, +00:00, +0800, +08:00, -05:00, or Z
    cleaned = cleaned.replace(/(Z|(?:\+|-)\d{2}(?::?\d{2})?)$/i, '');
    // Standardize space to T for ISO format
    cleaned = cleaned.replace(' ', 'T');
    
    const d = new Date(cleaned);
    if (!isNaN(d.getTime())) {
      return d;
    }
  } catch (e) {
    // Ignore and fallback
  }
  return new Date(dateStr);
};
