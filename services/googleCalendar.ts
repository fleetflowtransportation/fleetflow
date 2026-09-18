import { Tenant, Booking } from '../types';

let cachedToken: string | null = null;

// Load cached token from session storage to persist across soft page refreshes
try {
  const saved = sessionStorage.getItem('fleetflow_google_oauth_token');
  if (saved) {
    cachedToken = saved;
  }
} catch {
  // ignore
}

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

  createEvent: async (tenant: Tenant, booking: Booking): Promise<string | null> => {
    if (!tenant.googleCalendarId) {
      console.log('[Google Calendar] No Calendar ID configured for tenant:', tenant.name);
      return null;
    }
    if (!cachedToken) {
      console.log('[Google Calendar] No OAuth token available. Event creation on Google Calendar skipped.');
      return null;
    }

    try {
      const event = {
        summary: booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`,
        description: `Requester: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nPenumpang: ${booking.passengers?.map(p => `${p.category}: ${p.count}`).join(', ')}\nCatatan: ${booking.remarks || 'Tiada'}`,
        start: {
          dateTime: booking.dateTime,
          timeZone: 'Asia/Kuala_Lumpur',
        },
        end: {
          dateTime: booking.finishDateTime || booking.dateTime,
          timeZone: 'Asia/Kuala_Lumpur',
        },
      };

      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${cachedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error('[Google Calendar] Failed to create event:', errorText);
        return null;
      }

      const data = await res.json();
      console.log('[Google Calendar] Event successfully created in Google Calendar:', data.id);
      return data.id;
    } catch (err: any) {
      console.error('[Google Calendar] Error createEvent:', err.message);
      return null;
    }
  },

  updateEvent: async (tenant: Tenant, booking: Booking): Promise<boolean> => {
    if (!tenant.googleCalendarId || !booking.calendarEventId) return false;
    if (!cachedToken) return false;

    try {
      const event = {
        summary: booking.calendarEventTitle || `${booking.requesterName} - ${booking.destination}`,
        description: `Requester: ${booking.requesterName} (${booking.requesterEmail || 'Tiada E-mel'})\nDestinasi: ${booking.destination}\nTujuan: ${booking.purpose}\nPenumpang: ${booking.passengers?.map(p => `${p.category}: ${p.count}`).join(', ')}\nCatatan: ${booking.remarks || 'Tiada'}`,
        start: {
          dateTime: booking.dateTime,
          timeZone: 'Asia/Kuala_Lumpur',
        },
        end: {
          dateTime: booking.finishDateTime || booking.dateTime,
          timeZone: 'Asia/Kuala_Lumpur',
        },
      };

      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${booking.calendarEventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${cachedToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Google Calendar] Gagal mengemaskini acara di Google Calendar:', errText);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('[Google Calendar] Error updateEvent:', err.message);
      return false;
    }
  },

  deleteEvent: async (tenant: Tenant, eventId: string): Promise<boolean> => {
    if (!tenant.googleCalendarId || !eventId) return false;
    if (!cachedToken) return false;

    try {
      const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${cachedToken}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn('[Google Calendar] Gagal memadam acara di Google Calendar:', errText);
        return false;
      }

      return true;
    } catch (err: any) {
      console.error('[Google Calendar] Error deleteEvent:', err.message);
      return false;
    }
  }
};
