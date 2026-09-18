import { Tenant, Booking } from '../types';
import { parseAsLocal } from '../utils';

let cachedToken: string | null = null;

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

export const generateGoogleCalendarUrl = (booking: Booking): string => {
  const title = encodeURIComponent(booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`);
  const details = encodeURIComponent(`Pemohon: ${booking.requesterName}\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nPickup: ${booking.pickupPoint}`);
  const location = encodeURIComponent(booking.destination || '');

  const start = parseAsLocal(booking.dateTime);
  const end = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : new Date(start.getTime() + 60 * 60 * 1000);

  const formatIso = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
  const dates = `${formatIso(start)}/${formatIso(end)}`;

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
    const scriptUrl = (scriptUrlOverride || 
      (tenant?.googleDriveId?.startsWith('http') ? tenant.googleDriveId : null) ||
      (tenant?.googleCalendarId?.startsWith('http') ? tenant.googleCalendarId : null) ||
      localStorage.getItem('fleetflow_google_script_url') ||
      import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || 
      '').trim();

    if (!scriptUrl) {
      const msg = 'Tiada URL Google Apps Script Web App dikonfigurasi. Sila masukkan URL Web App dalam ruangan tetapan.';
      addDiagnosticLog({
        endpointUrl: 'N/A',
        payload: { action: 'ping / test' },
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

      const isHtmlResponse = resText.trim().startsWith('<!DOCTYPE html') || resText.trim().startsWith('<html');
      const errorMessage = resJson?.error || resJson?.message || (!res.ok ? `HTTP ${res.status}` : undefined);
      const isScriptError = isHtmlResponse || !res.ok || (resJson && (resJson.status === 'error' || resJson.success === false || !!resJson.error)) || (!resJson && !resText.includes('success') && !resText.includes('received'));
      
      let specificError = errorMessage;
      if (isHtmlResponse) {
        specificError = "Google meminta Log Masuk (Google Login Redirect). Akses Web App disekat. Sila buka script.google.com > Deploy > Manage deployments > Edit > Tetapkan 'Who has access' kepada 'Anyone' (Sesiapa Sahaja) & 'Execute as' kepada 'Me'.";
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
    const startLocal = parseAsLocal(booking.dateTime);
    const endLocal = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : new Date(startLocal.getTime() + 60 * 60 * 1000);

    const title = booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`;
    const description = `Pemohon: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nCatatan: ${booking.remarks || 'Tiada'}`;
    const location = booking.destination || '';
    const startIso = startLocal.toISOString();
    const endIso = endLocal.toISOString();

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

    // Find all possible Apps Script Endpoint URLs
    const customLocalUrl = localStorage.getItem('fleetflow_google_script_url');
    const possibleScriptUrls = [
      customLocalUrl,
      tenant?.googleDriveId?.startsWith('http') ? tenant.googleDriveId : null,
      tenant?.googleCalendarId?.startsWith('http') ? tenant.googleCalendarId : null,
      import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL,
    ].filter(Boolean) as string[];

    // Remove duplicates
    const uniqueScriptUrls = Array.from(new Set(possibleScriptUrls));

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

        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: scriptUrl,
          payload: { action: 'createCalendarEvent', title, startIso, endIso },
          status: res.ok ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
          errorMessage: !res.ok ? `HTTP ${res.status}` : undefined
        });

        if (res.ok) {
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
    const startLocal = parseAsLocal(booking.dateTime);
    const endLocal = booking.finishDateTime ? parseAsLocal(booking.finishDateTime) : new Date(startLocal.getTime() + 60 * 60 * 1000);

    const title = booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`;
    const description = `Pemohon: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nStatus: ${booking.status}\nCatatan: ${booking.remarks || 'Tiada'}\nID Tempahan: ${booking.id}`;
    const location = booking.destination || '';
    const startIso = startLocal.toISOString();
    const endIso = endLocal.toISOString();

    const customLocalUrl = localStorage.getItem('fleetflow_google_script_url');
    const possibleScriptUrls = [
      customLocalUrl,
      tenant?.googleDriveId?.startsWith('http') ? tenant.googleDriveId : null,
      tenant?.googleCalendarId?.startsWith('http') ? tenant.googleCalendarId : null,
      import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL,
    ].filter(Boolean) as string[];

    const uniqueScriptUrls = Array.from(new Set(possibleScriptUrls));

    // Try via Apps Script Web App
    for (const scriptUrl of uniqueScriptUrls) {
      try {
        const payload = {
          action: 'updateCalendarEvent',
          actionType: 'updateCalendarEvent',
          type: 'updateCalendarEvent',
          eventId: booking.calendarEventId,
          bookingId: booking.id,
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
    const startIso = bookingInfo?.dateTime ? parseAsLocal(bookingInfo.dateTime).toISOString() : undefined;
    const endIso = bookingInfo?.finishDateTime ? parseAsLocal(bookingInfo.finishDateTime).toISOString() : undefined;

    const customLocalUrl = localStorage.getItem('fleetflow_google_script_url');
    const possibleScriptUrls = [
      customLocalUrl,
      tenant?.googleDriveId?.startsWith('http') ? tenant.googleDriveId : null,
      tenant?.googleCalendarId?.startsWith('http') ? tenant.googleCalendarId : null,
      import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL,
    ].filter(Boolean) as string[];

    const uniqueScriptUrls = Array.from(new Set(possibleScriptUrls));

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
          title: title,
          startTime: startIso,
          endTime: endIso,
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
  }
};
