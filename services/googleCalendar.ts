import { Tenant, Booking } from '../types';
import { parseAsLocal } from '../utils';
import { normalizeDate, normalizeTime } from './bookingEngine';

let cachedToken: string | null = null;

export const formatMalaysiaIso = (dateStr: string | Date | undefined | null): string => {
  if (!dateStr) return '';
  const datePart = normalizeDate(dateStr);
  const timePart = normalizeTime(dateStr);
  if (!datePart) return '';
  return `${datePart}T${timePart}:00+08:00`;
};

export interface CalendarDiagnosticLog {
  id: string;
  timestamp: string;
  bookingTitle?: string;
  endpointUrl: string;
  payload: any;
  status: 'SUCCESS' | 'ERROR' | 'INFO';
  httpStatus?: number;
  responseBody?: string;
  errorMessage?: string;
}

// Load cached token from session storage to persist across soft page refreshes
try {
  const saved = sessionStorage.getItem('fleetflow_google_oauth_token');
  if (saved) {
    cachedToken = saved;
  }
} catch {
  // ignore
}

export const getDiagnosticLogs = (): CalendarDiagnosticLog[] => {
  try {
    const raw = localStorage.getItem('fleetflow_calendar_sync_logs');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Failed to parse diagnostic logs:', e);
  }
  return [];
};

export const addDiagnosticLog = (log: Omit<CalendarDiagnosticLog, 'id' | 'timestamp'>) => {
  try {
    const current = getDiagnosticLogs();
    const newEntry: CalendarDiagnosticLog = {
      ...log,
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toLocaleTimeString('ms-MY', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: 'short' }),
    };
    const updated = [newEntry, ...current].slice(0, 30); // Keep last 30 logs
    localStorage.setItem('fleetflow_calendar_sync_logs', JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save diagnostic log:', e);
  }
};

export const clearDiagnosticLogs = () => {
  try {
    localStorage.removeItem('fleetflow_calendar_sync_logs');
  } catch {
    // ignore
  }
};

export const cleanGoogleScriptUrl = (url?: string | null): string => {
  if (!url) return '';
  let cleaned = url.trim();
  // If user pasted a /dev URL, automatically convert to /exec
  if (cleaned.includes('/macros/s/') && cleaned.endsWith('/dev')) {
    cleaned = cleaned.substring(0, cleaned.length - 4) + '/exec';
  }
  return cleaned;
};

export const isGoogleScriptUrl = (url?: string | null): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return (
    (lower.includes('script.google.com') || lower.includes('script.googleusercontent.com')) &&
    !lower.includes('drive.google.com') &&
    !lower.includes('calendar.google.com')
  );
};

export const getValidGoogleScriptUrls = (tenant?: Tenant | null, overrideUrl?: string | null): string[] => {
  const customLocalUrl = localStorage.getItem('fleetflow_google_script_url');
  const envUrl = import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;

  const candidates = [
    overrideUrl,
    tenant?.googleAppsScriptUrl,
    customLocalUrl,
    envUrl,
    // Only consider tenant fields if they are actually Google Script URLs
    isGoogleScriptUrl(tenant?.googleCalendarId) ? tenant?.googleCalendarId : null,
    isGoogleScriptUrl(tenant?.googleDriveId) ? tenant?.googleDriveId : null,
  ];

  const validUrls: string[] = [];
  for (const c of candidates) {
    if (!c) continue;
    const cleaned = cleanGoogleScriptUrl(c);
    if (cleaned && (isGoogleScriptUrl(cleaned) || cleaned.startsWith('http')) && !cleaned.includes('drive.google.com') && !cleaned.includes('calendar.google.com')) {
      if (!validUrls.includes(cleaned)) {
        validUrls.push(cleaned);
      }
    }
  }

  return validUrls;
};

export const generateGoogleCalendarUrl = (booking: Booking): string => {
  const title = encodeURIComponent(booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`);
  const details = encodeURIComponent(`Pemohon: ${booking.requesterName}\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nPickup: ${booking.pickupPoint}`);
  const location = encodeURIComponent(booking.destination || '');

  const startD = normalizeDate(booking.dateTime).replace(/-/g, '');
  const startT = normalizeTime(booking.dateTime).replace(/:/g, '') + '00';
  
  let endD = booking.finishDateTime ? normalizeDate(booking.finishDateTime).replace(/-/g, '') : startD;
  let endT = booking.finishDateTime ? normalizeTime(booking.finishDateTime).replace(/:/g, '') + '00' : '';
  if (!endT) {
    const s = parseAsLocal(booking.dateTime);
    const e = new Date(s.getTime() + 60 * 60 * 1000);
    endD = normalizeDate(e).replace(/-/g, '');
    endT = normalizeTime(e).replace(/:/g, '') + '00';
  }

  const dates = `${startD}T${startT}/${endD}T${endT}&ctz=Asia/Kuala_Lumpur`;

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
};

export const googleCalendarService = {
  setToken: (token: string) => {
    cachedToken = token;
    try {
      sessionStorage.setItem('fleetflow_google_oauth_token', token);
    } catch {
      // ignore
    }
  },
  
  getToken: () => cachedToken,

  clearToken: () => {
    cachedToken = null;
    try {
      sessionStorage.removeItem('fleetflow_google_oauth_token');
    } catch {
      // ignore
    }
  },

  testConnection: async (tenant: Tenant, scriptUrlOverride?: string): Promise<{ success: boolean; message: string; response?: any }> => {
    const urls = getValidGoogleScriptUrls(tenant, scriptUrlOverride);
    const scriptUrl = urls[0];

    if (!scriptUrl) {
      const msg = 'Tiada URL Google Apps Script Web App yang sah dikonfigurasi. Sila masukkan URL Web App (berakhir dengan /exec) dalam Tetapan.';
      addDiagnosticLog({
        bookingTitle: '[UJIAN SAMBUNGAN GOOGLE]',
        endpointUrl: 'N/A',
        payload: { action: 'ping' },
        status: 'ERROR',
        errorMessage: msg
      });
      return { success: false, message: msg };
    }

    const testPayload = {
      action: 'ping',
      actionType: 'ping',
      type: 'ping',
      calendarId: tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http') ? tenant.googleCalendarId : 'primary',
      timestamp: new Date().toISOString(),
    };

    try {
      const res = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(testPayload)
      });

      const resText = await res.text();
      let resJson: any = null;
      try {
        resJson = JSON.parse(resText);
      } catch {
        // text response
      }

      const isHtmlResponse = resText.trim().startsWith('<!DOCTYPE html') || resText.trim().startsWith('<html') || resText.includes('<title>Google Accounts</title>');
      const isExplicitError = Boolean(
        !res.ok ||
        (resJson && (resJson.status === 'error' || resJson.success === false || !!resJson.error))
      );
      const errorMessage = resJson?.error || (resJson?.status === 'error' ? resJson?.message : undefined) || (!res.ok ? `HTTP ${res.status}` : undefined);
      const isScriptError = isHtmlResponse || isExplicitError;
      
      let specificError = errorMessage;
      if (isHtmlResponse) {
        if (scriptUrl.endsWith('/dev')) {
          specificError = "URL Google Apps Script anda menggunakan '/dev'. Sila buka script.google.com > Deploy > Manage deployments dan salin URL Web App rasmi yang berakhir dengan '/exec'.";
        } else {
          specificError = "Google meminta Log Masuk (Google Login Redirect). Sila semak: (1) Di script.google.com > Deploy > Manage deployments > Edit > Pastikan 'Who has access' = 'Anyone' (bukan Anyone with Google Account / Within domain) & 'Execute as' = 'Me' > Deploy (New version). (2) Jika menggunakan e-mel organisasi (Google Workspace), pastikan admin organisasi membenarkan perkongsian Web App luaran.";
        }
      } else if (errorMessage && (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('authorization') || errorMessage.toLowerCase().includes('kebenaran'))) {
        specificError = `Kebenaran Google diperlukan (${errorMessage}). Sila buka script.google.com, pilih fungsi testPermission(), tekan 'Run (Jalankan)' sekali dan klik 'Allow' untuk memberi kebenaran Calendar & Drive.`;
      }

      addDiagnosticLog({
        bookingTitle: '[UJIAN SAMBUNGAN GOOGLE]',
        endpointUrl: scriptUrl,
        payload: testPayload,
        status: isScriptError ? 'ERROR' : 'SUCCESS',
        httpStatus: res.status,
        responseBody: isHtmlResponse ? 'HTML Google Login Page (Akses disekat: Who has access bukan "Anyone")' : resText.substring(0, 300),
        errorMessage: isScriptError ? (specificError || 'Ralat dari Apps Script') : undefined
      });

      if (!isScriptError) {
        return {
          success: true,
          message: resJson?.message || 'Berjaya! Sambungan ke Google Apps Script (Calendar & Drive) beroperasi dengan cemerlang (tanpa mencipta acara dummy).',
          response: resJson || resText
        };
      } else {
        return {
          success: false,
          message: isHtmlResponse
            ? specificError!
            : `Sambungan ke Web App berjaya, tetapi Apps Script mengembalikan ralat: "${errorMessage || 'Sila semak kebenaran skrip di Google Apps Script anda'}".`,
          response: resJson || resText
        };
      }
    } catch (err: any) {
      addDiagnosticLog({
        bookingTitle: '[UJIAN SAMBUNGAN GOOGLE]',
        endpointUrl: scriptUrl,
        payload: testPayload,
        status: 'ERROR',
        errorMessage: err.message || 'Ralat rangkaian'
      });
      return {
        success: false,
        message: `Gagal memanggil Web App Google: ${err.message || 'Sila semak URL atau kebenaran Web App (Anyone)'}`
      };
    }
  },

  createEvent: async (tenant: Tenant, booking: Booking): Promise<string | null> => {
    const startIso = formatMalaysiaIso(booking.dateTime);
    let endIso = booking.finishDateTime ? formatMalaysiaIso(booking.finishDateTime) : '';
    if (!endIso) {
      const startLocal = parseAsLocal(booking.dateTime);
      const endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
      endIso = formatMalaysiaIso(endLocal);
    }

    const title = booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`;
    const description = `Pemohon: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nStatus: ${booking.status}\nCatatan: ${booking.remarks || 'Tiada'}\nID Tempahan: ${booking.id}`;
    const location = booking.destination || '';

    const eventPayload = {
      summary: title,
      title: title,
      description: description,
      location: location,
      start: {
        dateTime: startIso,
        timeZone: 'Asia/Kuala_Lumpur',
      },
      end: {
        dateTime: endIso,
        timeZone: 'Asia/Kuala_Lumpur',
      },
      startTime: startIso,
      endTime: endIso,
    };

    const uniqueScriptUrls = getValidGoogleScriptUrls(tenant);

    if (uniqueScriptUrls.length === 0 && !cachedToken) {
      addDiagnosticLog({
        bookingTitle: title,
        endpointUrl: 'Tiada Web App URL',
        payload: eventPayload,
        status: 'ERROR',
        errorMessage: 'Tiada Google Apps Script Web App URL atau Google Calendar ID dikonfigurasikan.',
      });
    }

    // Attempt via Google Apps Script Endpoints (Automatic Webhook without client OAuth)
    for (const scriptUrl of uniqueScriptUrls) {
      try {
        const scriptBody = JSON.stringify({
          action: 'createCalendarEvent',
          actionType: 'createCalendarEvent',
          type: 'createCalendarEvent',
          calendarId: tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http') ? tenant.googleCalendarId : 'primary',
          title: title,
          summary: title,
          description: description,
          location: location,
          startTime: startIso,
          endTime: endIso,
          start: { dateTime: startIso, timeZone: 'Asia/Kuala_Lumpur' },
          end: { dateTime: endIso, timeZone: 'Asia/Kuala_Lumpur' },
          event: eventPayload,
        });

        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: scriptBody,
        });

        const resText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(resText);
        } catch {
          // ignore non-json response
        }

        const isSuccess = res.ok && (!data.error && data.status !== 'error' && data.success !== false);

        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: scriptUrl,
          payload: { action: 'createCalendarEvent', title, startIso, endIso },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
          errorMessage: !isSuccess ? (data.error || `HTTP ${res.status}`) : undefined
        });

        if (isSuccess) {
          const eventId = data.eventId || data.id || data.event_id || `evt-apps-script-${Date.now()}`;
          console.log('[Google Calendar] Created event via Apps Script URL:', eventId);
          return eventId;
        }
      } catch (err: any) {
        console.warn('[Google Calendar] Apps Script endpoint trigger error:', err);
        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: scriptUrl,
          payload: { action: 'createCalendarEvent', title },
          status: 'ERROR',
          errorMessage: err.message || 'Gagal memanggil endpoint Apps Script'
        });
      }
    }

    // Attempt via REST API if client OAuth token is available
    if (cachedToken && tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http')) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${cachedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        });

        const resText = await res.text();

        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: `REST API: ${tenant.googleCalendarId}`,
          payload: eventPayload,
          status: res.ok ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
        });

        if (res.ok) {
          const data = JSON.parse(resText);
          console.log('[Google Calendar] Event created via REST API:', data.id);
          return data.id;
        }
      } catch (err: any) {
        console.error('[Google Calendar] Error createEvent REST API:', err.message);
        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: `REST API: ${tenant.googleCalendarId}`,
          payload: eventPayload,
          status: 'ERROR',
          errorMessage: err.message
        });
      }
    }

    return null;
  },

  updateEvent: async (tenant: Tenant, booking: Booking): Promise<boolean> => {
    const startIso = formatMalaysiaIso(booking.dateTime);
    let endIso = booking.finishDateTime ? formatMalaysiaIso(booking.finishDateTime) : '';
    if (!endIso) {
      const startLocal = parseAsLocal(booking.dateTime);
      const endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
      endIso = formatMalaysiaIso(endLocal);
    }

    const title = booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`;
    const description = `Pemohon: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nStatus: ${booking.status}\nCatatan: ${booking.remarks || 'Tiada'}\nID Tempahan: ${booking.id}`;
    const location = booking.destination || '';

    const uniqueScriptUrls = getValidGoogleScriptUrls(tenant);

    // Try via Apps Script Web App
    for (const scriptUrl of uniqueScriptUrls) {
      try {
        const payload = {
          action: 'updateCalendarEvent',
          actionType: 'updateCalendarEvent',
          type: 'updateCalendarEvent',
          eventId: booking.calendarEventId,
          bookingId: booking.id,
          requesterName: booking.requesterName,
          calendarId: tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http') ? tenant.googleCalendarId : 'primary',
          title: title,
          summary: title,
          description: description,
          location: location,
          startTime: startIso,
          endTime: endIso,
          start: { dateTime: startIso, timeZone: 'Asia/Kuala_Lumpur' },
          end: { dateTime: endIso, timeZone: 'Asia/Kuala_Lumpur' },
        };

        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        const resText = await res.text();
        let resJson: any = null;
        try { resJson = JSON.parse(resText); } catch {}

        const isSuccess = res.ok && (!resJson || resJson.status === 'success' || resJson.success === true || resText.includes('success'));

        addDiagnosticLog({
          bookingTitle: `[KEMASKINI] ${title}`,
          endpointUrl: scriptUrl,
          payload: { action: 'updateCalendarEvent', eventId: booking.calendarEventId, title },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
        });

        if (isSuccess) {
          console.log('[Google Calendar] Event updated via Apps Script URL:', booking.calendarEventId);
          return true;
        }
      } catch (err: any) {
        console.warn('[Google Calendar] Error updateEvent via Apps Script:', err.message);
      }
    }

    // Fallback: Try REST API if cached OAuth token exists
    if (cachedToken && tenant?.googleCalendarId && booking.calendarEventId && !tenant.googleCalendarId.startsWith('http')) {
      try {
        const eventPayload = {
          summary: title,
          description: description,
          location: location,
          start: { dateTime: startIso, timeZone: 'Asia/Kuala_Lumpur' },
          end: { dateTime: endIso, timeZone: 'Asia/Kuala_Lumpur' },
        };

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${encodeURIComponent(booking.calendarEventId)}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${cachedToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eventPayload),
        });

        if (res.ok) {
          return true;
        }
      } catch (err: any) {
        console.error('[Google Calendar] Error updateEvent REST API:', err.message);
      }
    }

    return false;
  },

  deleteEvent: async (tenant: Tenant, eventId?: string, bookingInfo?: Partial<Booking>): Promise<boolean> => {
    const title = bookingInfo?.calendarEventTitle || (bookingInfo?.requesterName ? `${bookingInfo.requesterName} - ${bookingInfo?.destination || ''}` : '');
    const startIso = bookingInfo?.dateTime ? formatMalaysiaIso(bookingInfo.dateTime) : undefined;
    const endIso = bookingInfo?.finishDateTime ? formatMalaysiaIso(bookingInfo.finishDateTime) : undefined;

    const uniqueScriptUrls = getValidGoogleScriptUrls(tenant);

    // Try via Apps Script Web App
    for (const scriptUrl of uniqueScriptUrls) {
      try {
        const payload = {
          action: 'deleteCalendarEvent',
          actionType: 'deleteCalendarEvent',
          type: 'deleteCalendarEvent',
          eventId: eventId,
          calendarEventId: eventId,
          id: eventId,
          bookingId: bookingInfo?.id,
          title: title,
          summary: title,
          startTime: startIso,
          startIso: startIso,
          endTime: endIso,
          endIso: endIso,
          calendarId: tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http') ? tenant.googleCalendarId : 'primary',
        };

        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload),
        });

        const resText = await res.text();
        let resJson: any = null;
        try { resJson = JSON.parse(resText); } catch {}

        const isSuccess = res.ok && (!resJson || resJson.status === 'success' || resJson.success === true || resText.includes('success'));

        addDiagnosticLog({
          bookingTitle: `[PADAM] ${title || eventId || 'Acara Kalendar'}`,
          endpointUrl: scriptUrl,
          payload: { action: 'deleteCalendarEvent', eventId, title },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
        });

        if (isSuccess) {
          console.log('[Google Calendar] Event deleted via Apps Script URL:', eventId);
          return true;
        }
      } catch (err: any) {
        console.warn('[Google Calendar] Error deleteEvent via Apps Script:', err.message);
      }
    }

    // Fallback: Try REST API if cached OAuth token exists
    if (cachedToken && tenant?.googleCalendarId && eventId && !tenant.googleCalendarId.startsWith('http')) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${cachedToken}`,
          },
        });

        if (res.ok) {
          return true;
        }
      } catch (err: any) {
        console.error('[Google Calendar] Error deleteEvent REST API:', err.message);
      }
    }

    return false;
  },
};
