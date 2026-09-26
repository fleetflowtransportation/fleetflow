import { Tenant, Booking, Vehicle, User } from '../types';
import { parseAsLocal, getPickupLocationDisplay } from '../utils';
import { normalizeDate, normalizeTime } from './bookingEngine';

let cachedToken: string | null = null;

export const formatMalaysiaIso = (dateStr: string | Date | undefined | null): string => {
  if (!dateStr) return '';
  const datePart = normalizeDate(dateStr);
  const timePart = normalizeTime(dateStr);
  if (!datePart) return '';
  return `${datePart}T${timePart}:00+08:00`;
};

export const buildCalendarEventTitle = (booking: Booking): string => {
  let baseTitle = booking.calendarEventTitle || '';
  const deptStr = booking.department ? ` (${booking.department})` : '';

  if (baseTitle) {
    if (booking.department && !baseTitle.includes(`(${booking.department})`)) {
      if (baseTitle.includes('→')) {
        const parts = baseTitle.split('→');
        const left = parts[0].trim();
        const right = parts.slice(1).join('→').trim();
        return `${left}${deptStr} → ${right}`;
      }
    }
    return baseTitle;
  }

  return `${booking.requesterName}${deptStr} → ${booking.destination}`;
};

export const buildCalendarDescription = (booking: Booking, vehicles?: Vehicle[]): string => {
  const totalPassengers = (booking.passengers || []).reduce((sum, p) => sum + (p.count || 0), 0);
  const staffCount = booking.passengers?.find(p => p.category === 'Staff')?.count ?? 0;
  const kidsCount = booking.passengers?.find(p => p.category === 'Kids')?.count ?? 0;
  const teenagersCount = booking.passengers?.find(p => p.category === 'Teenagers')?.count ?? 0;
  const passengerBreakdown = [
    staffCount > 0 ? `Staff: ${staffCount}` : '',
    kidsCount > 0 ? `Kids: ${kidsCount}` : '',
    teenagersCount > 0 ? `Teenagers: ${teenagersCount}` : ''
  ].filter(Boolean).join(', ') || 'No breakdown';

  const waitStatus = booking.shouldWait
    ? 'Yes (Driver required to wait on-site until event completion)'
    : 'No (Drop-off only / No standby required)';

  const matchedV = vehicles?.find(v => v.id === booking.vehicleId) ||
    vehicles?.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  const vehicleText = matchedV
    ? `${matchedV.name} (${matchedV.plateNumber})`
    : (booking.serviceType === 'Self-Drive'
        ? 'Perodua Alza (Self-Drive)'
        : (booking.vehiclePreference && booking.vehiclePreference !== 'Bebas' && booking.vehiclePreference !== 'Any / No Preference' && booking.vehiclePreference !== 'Any / Free Choice'
            ? booking.vehiclePreference
            : 'Any / Unassigned (Driver selects vehicle upon trip start)'));

  const pickupText = getPickupLocationDisplay(booking.pickupPoint, booking.address);

  return [
    `Requester: ${booking.requesterName} (${booking.requesterEmail || 'No Email'})`,
    `Department: ${booking.department || 'N/A'}`,
    `Destination: ${booking.destination}`,
    `Pickup Location: ${pickupText}`,
    `Purpose: ${booking.purpose}`,
    `Passengers: ${totalPassengers} (${passengerBreakdown})`,
    `Driver Standby Required: ${waitStatus}`,
    `Vehicle: ${vehicleText}`,
    `Status: ${booking.status}`,
    `Remarks: ${booking.remarks || 'None'}`,
    `Booking ID: ${booking.id}`,
  ].join('\n');
};

export const buildEmailHtml = (
  booking: Booking,
  type: 'CONFIRMATION' | 'UPDATED' | 'CANCELLED',
  vehicles?: Vehicle[],
  users?: User[]
): { subject: string; html: string; text: string } => {
  const dateStr = normalizeDate(booking.dateTime);
  const timeStr = normalizeTime(booking.dateTime);
  const finishTimeStr = booking.finishDateTime ? normalizeTime(booking.finishDateTime) : '';
  const totalPassengers = (booking.passengers || []).reduce((sum, p) => sum + (p.count || 0), 0);
  const matchedV = vehicles?.find(v => v.id === booking.vehicleId) ||
    vehicles?.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  const vehicleText = matchedV ? `${matchedV.name} (${matchedV.plateNumber})` : (booking.serviceType === 'Self-Drive' ? 'Perodua Alza (Self-Drive)' : (booking.vehiclePreference || 'Any available'));
  const pickupText = getPickupLocationDisplay(booking.pickupPoint, booking.address);

  const matchedDriver = users?.find(u => u.id === booking.driverId);
  const driverDisplay = booking.serviceType === 'Self-Drive'
    ? 'Self-Drive (Staff)'
    : (matchedDriver ? `${matchedDriver.name}${matchedDriver.phone ? ' (' + matchedDriver.phone + ')' : ''}` : (booking.driverId || 'Scheduled'));

  let typeBadge = '<span style="background-color: #10b981; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px;">CONFIRMED</span>';
  let subjectPrefix = '✅ Booking Confirmed';
  let headerTitle = 'Vehicle Reservation Confirmed';
  let introMessage = 'Your vehicle reservation has been received and confirmed. Details of your scheduled trip are provided below:';

  if (type === 'UPDATED') {
    typeBadge = '<span style="background-color: #3b82f6; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px;">UPDATED</span>';
    subjectPrefix = '📝 Booking Updated';
    headerTitle = 'Vehicle Reservation Updated';
    introMessage = 'Your vehicle reservation has been modified. Please review the updated schedule and assignment details below:';
  } else if (type === 'CANCELLED') {
    typeBadge = '<span style="background-color: #ef4444; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px;">CANCELLED</span>';
    subjectPrefix = '❌ Booking Cancelled';
    headerTitle = 'Vehicle Reservation Cancelled';
    introMessage = 'Your vehicle reservation has been cancelled. The vehicle slot and driver schedule have been released:';
  }

  const subject = `${subjectPrefix}: ${booking.destination} - ${dateStr} (${timeStr})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #3730a3, #1e1b4b); padding: 28px 24px; color: #ffffff; text-align: left;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #c7d2fe; font-weight: bold; margin-bottom: 8px;">FleetFlow Fleet Management</div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3;">${headerTitle}</h1>
          <div style="margin-top: 12px;">${typeBadge}</div>
        </div>

        <!-- Body -->
        <div style="padding: 24px;">
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 0;">
            Hello <strong>${booking.requesterName}</strong>,<br>
            ${introMessage}
          </p>

          <!-- Key Details Card -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; background-color: #f1f5f9; border-radius: 12px; overflow: hidden;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b; width: 35%;">Destination</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: 800; color: #0f172a;">${booking.destination}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Date & Time</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #0f172a;">${dateStr} (${timeStr}${finishTimeStr ? ' – ' + finishTimeStr : ''})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Pickup Point</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">${pickupText}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Trip Purpose</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">${booking.purpose}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Service Type</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #334155;">${booking.serviceType === 'Self-Drive' ? '🚗 Self-Drive' : '👤 Driver Service'}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Assigned Driver</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #3730a3;">${driverDisplay}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Allocated Vehicle</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">${vehicleText}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #64748b;">Passengers</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; color: #334155;">${totalPassengers} Pax</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: bold; color: #64748b;">Driver Standby</td>
              <td style="padding: 12px 16px; color: #334155;">${booking.shouldWait ? 'Yes (Standby on-site)' : 'No (Drop-off only)'}</td>
            </tr>
          </table>

          ${booking.remarks ? `
            <div style="margin-top: 16px; padding: 12px 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 13px; color: #92400e;">
              <strong>Remarks:</strong> ${booking.remarks}
            </div>
          ` : ''}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            This is an automated notification from FleetFlow. For any inquiries or modifications, please contact your transport coordinator.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `${headerTitle}\n\nRequester: ${booking.requesterName}\nDestination: ${booking.destination}\nDate & Time: ${dateStr} ${timeStr}\nPickup: ${pickupText}\nDriver: ${driverDisplay}\nPurpose: ${booking.purpose}\nStatus: ${booking.status}\n\nFleetFlow Fleet Management`;

  return { subject, html, text };
};

export const buildDriverEmailHtml = (
  booking: Booking,
  driver?: User | null,
  vehicles?: Vehicle[]
): { subject: string; html: string; text: string } => {
  const dateStr = normalizeDate(booking.dateTime);
  const timeStr = normalizeTime(booking.dateTime);
  const finishTimeStr = booking.finishDateTime ? normalizeTime(booking.finishDateTime) : '';
  const totalPassengers = (booking.passengers || []).reduce((sum, p) => sum + (p.count || 0), 0);
  const passengerBreakdown = (booking.passengers || []).map(p => `${p.category}: ${p.count}`).join(', ') || 'None';
  const matchedV = vehicles?.find(v => v.id === booking.vehicleId) ||
    vehicles?.find(v => v.name.toLowerCase() === (booking.vehiclePreference || '').toLowerCase());
  const vehicleText = matchedV ? `${matchedV.name} (${matchedV.plateNumber})` : (booking.vehiclePreference || 'Any available (select upon odometer start)');
  const pickupText = getPickupLocationDisplay(booking.pickupPoint, booking.address);

  const subject = `🚐 New Trip Assignment: ${booking.destination} - ${dateStr} (${timeStr})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${subject}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
        
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f766e, #134e4a); padding: 28px 24px; color: #ffffff; text-align: left;">
          <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: #99f6e4; font-weight: bold; margin-bottom: 8px;">FleetFlow Fleet Management</div>
          <h1 style="margin: 0; font-size: 22px; font-weight: 800; line-height: 1.3;">New Trip Assignment</h1>
          <div style="margin-top: 12px;"><span style="background-color: #14b8a6; color: #ffffff; padding: 4px 12px; border-radius: 9999px; font-weight: bold; font-size: 12px;">DRIVER DUTY</span></div>
        </div>

        <!-- Body -->
        <div style="padding: 24px;">
          <p style="font-size: 14px; line-height: 1.6; color: #475569; margin-top: 0;">
            Hello <strong>${driver?.name || 'Driver'}</strong>,<br>
            You have been assigned as the driver for the following scheduled transportation task. Please review the details below:
          </p>

          <!-- Key Details Card -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; background-color: #f0fdfa; border-radius: 12px; overflow: hidden; border: 1px solid #ccfbf1;">
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e; width: 35%;">Destination</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: 800; color: #0f172a;">${booking.destination}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Date & Time</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f172a;">${dateStr} (${timeStr}${finishTimeStr ? ' – ' + finishTimeStr : ''})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Pickup Location</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #334155;">${pickupText}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Requester (PIC)</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; color: #334155;">${booking.requesterName} ${booking.department ? '(' + booking.department + ')' : ''} ${booking.requesterEmail ? '&bull; ' + booking.requesterEmail : ''}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Trip Purpose</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; color: #334155;">${booking.purpose}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Assigned Vehicle</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">${vehicleText}</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; font-weight: bold; color: #0f766e;">Passengers</td>
              <td style="padding: 12px 16px; border-bottom: 1px solid #ccfbf1; color: #334155;">${totalPassengers} Pax (${passengerBreakdown})</td>
            </tr>
            <tr>
              <td style="padding: 12px 16px; font-weight: bold; color: #0f766e;">Driver Standby Required</td>
              <td style="padding: 12px 16px; font-weight: bold; color: ${booking.shouldWait ? '#b45309' : '#334155'};">${booking.shouldWait ? '⏳ YES (Please wait for passengers at location)' : 'Drop-off only'}</td>
            </tr>
          </table>

          ${booking.remarks ? `
            <div style="margin-top: 16px; padding: 12px 16px; background-color: #fffbeb; border-left: 4px solid #f59e0b; border-radius: 6px; font-size: 13px; color: #92400e;">
              <strong>Remarks:</strong> ${booking.remarks}
            </div>
          ` : ''}

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center;">
            Please remember to log start odometer reading when taking the vehicle key and end odometer upon return.
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `NEW TRIP ASSIGNMENT\n\nDriver: ${driver?.name || 'Driver'}\nDestination: ${booking.destination}\nDate & Time: ${dateStr} ${timeStr}\nPickup: ${pickupText}\nRequester: ${booking.requesterName} (${booking.requesterEmail})\nVehicle: ${vehicleText}\nStandby: ${booking.shouldWait ? 'YES' : 'NO'}\n\nFleetFlow Fleet Management`;

  return { subject, html, text };
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
      const msg = 'No valid Google Apps Script Web App URL configured. Please enter a Web App URL (ending with /exec) in Settings.';
      addDiagnosticLog({
        bookingTitle: '[GOOGLE CONNECTION TEST]',
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
          specificError = "Your Google Apps Script URL ends with '/dev'. Please open script.google.com > Deploy > Manage deployments and copy the official Web App URL ending with '/exec'.";
        } else {
          specificError = "Google requested Login redirect. Please check: (1) In script.google.com > Deploy > Manage deployments > Edit > Ensure 'Who has access' = 'Anyone' & 'Execute as' = 'Me' > Deploy (New version). (2) If using an organization email (Google Workspace), verify external Web App sharing permissions.";
        }
      } else if (errorMessage && (errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('authorization') || errorMessage.toLowerCase().includes('kebenaran'))) {
        specificError = `Google permissions required (${errorMessage}). Please open script.google.com, run the testPermission() function once and click 'Allow' to grant Calendar & Drive access.`;
      }

      addDiagnosticLog({
        bookingTitle: '[GOOGLE CONNECTION TEST]',
        endpointUrl: scriptUrl,
        payload: testPayload,
        status: isScriptError ? 'ERROR' : 'SUCCESS',
        httpStatus: res.status,
        responseBody: isHtmlResponse ? 'HTML Google Login Page (Access blocked: Who has access is not "Anyone")' : resText.substring(0, 300),
        errorMessage: isScriptError ? (specificError || 'Apps Script error') : undefined
      });

      if (!isScriptError) {
        return {
          success: true,
          message: resJson?.message || 'Success! Connection to Google Apps Script (Calendar & Drive) is operating properly.',
          response: resJson || resText
        };
      } else {
        return {
          success: false,
          message: isHtmlResponse
            ? specificError!
            : `Connection to Web App succeeded, but Apps Script returned an error: "${errorMessage || 'Please check script authorization in Google Apps Script'}".`,
          response: resJson || resText
        };
      }
    } catch (err: any) {
      addDiagnosticLog({
        bookingTitle: '[GOOGLE CONNECTION TEST]',
        endpointUrl: scriptUrl,
        payload: testPayload,
        status: 'ERROR',
        errorMessage: err.message || 'Network error'
      });
      return {
        success: false,
        message: `Failed to call Google Web App: ${err.message || 'Please check Web App URL and permissions (Anyone)'}`
      };
    }
  },

  sendNotificationEmail: async (
    tenant: Tenant,
    to: string,
    subject: string,
    html: string,
    recipientName?: string
  ): Promise<boolean> => {
    if (!to || !to.includes('@')) return false;
    const uniqueScriptUrls = getValidGoogleScriptUrls(tenant);
    if (uniqueScriptUrls.length === 0) return false;

    for (const scriptUrl of uniqueScriptUrls) {
      try {
        const payload = {
          action: 'sendEmail',
          actionType: 'sendEmail',
          type: 'sendEmail',
          to,
          recipientEmail: to,
          recipientName: recipientName || '',
          subject,
          html,
          htmlBody: html,
          name: 'FleetFlow Transportation'
        };

        const res = await fetch(scriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          return true;
        }
      } catch (err) {
        console.warn('[Google Apps Script] Direct sendNotificationEmail error:', err);
      }
    }
    return false;
  },

  createEvent: async (
    tenant: Tenant,
    booking: Booking,
    vehicles?: Vehicle[],
    users?: User[]
  ): Promise<string | null> => {
    const startIso = formatMalaysiaIso(booking.dateTime);
    let endIso = booking.finishDateTime ? formatMalaysiaIso(booking.finishDateTime) : '';
    if (!endIso) {
      const startLocal = parseAsLocal(booking.dateTime);
      const endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
      endIso = formatMalaysiaIso(endLocal);
    }

    const title = buildCalendarEventTitle(booking);
    const description = buildCalendarDescription(booking, vehicles);
    const location = booking.destination || '';
    const emailData = buildEmailHtml(booking, 'CONFIRMATION', vehicles, users);

    // Resolve assigned driver info
    const assignedDriver = users?.find(u => u.id === booking.driverId);
    const driverEmail = assignedDriver?.email;
    const driverName = assignedDriver?.name;
    const driverEmailData = assignedDriver ? buildDriverEmailHtml(booking, assignedDriver, vehicles) : null;

    // Build attendees for both Requester and Driver
    const attendees: Array<{ email: string; displayName: string }> = [];
    if (booking.requesterEmail) {
      attendees.push({ email: booking.requesterEmail, displayName: booking.requesterName || 'Requester' });
    }
    if (driverEmail && driverEmail.includes('@')) {
      attendees.push({ email: driverEmail, displayName: `${driverName || 'Driver'} (FleetFlow Driver)` });
    }

    // Comma-separated list of guests for Google Calendar
    const guestEmails = [booking.requesterEmail, driverEmail]
      .filter((e): e is string => Boolean(e && e.includes('@')))
      .join(', ');

    const eventPayload = {
      summary: title,
      title: title,
      description: description,
      location: location,
      attendees: attendees,
      guests: guestEmails,
      guestEmail: booking.requesterEmail || '',
      sendInvites: true,
      sendUpdates: 'all',
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
        endpointUrl: 'No Web App URL',
        payload: eventPayload,
        status: 'ERROR',
        errorMessage: 'No Google Apps Script Web App URL or Google Calendar ID configured.',
      });
    }

    // Attempt via Google Apps Script Endpoints (Automatic Webhook with Guest Invites + Auto Email)
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
          requesterEmail: booking.requesterEmail || '',
          requesterName: booking.requesterName || '',
          driverEmail: driverEmail || '',
          driverName: driverName || '',
          guests: guestEmails,
          attendees: attendees,
          sendInvites: true,
          sendUpdates: 'all',
          sendEmail: Boolean(booking.requesterEmail),
          emailSubject: emailData.subject,
          emailHtml: emailData.html,
          emailText: emailData.text,
          driverEmailSubject: driverEmailData?.subject || '',
          driverEmailHtml: driverEmailData?.html || '',
          driverEmailText: driverEmailData?.text || '',
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
          payload: { action: 'createCalendarEvent', title, requesterEmail: booking.requesterEmail, driverEmail, startIso, endIso },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
          errorMessage: !isSuccess ? (data.error || `HTTP ${res.status}`) : undefined
        });

        // Trigger direct individual email dispatches as an additional guarantee
        if (booking.requesterEmail && booking.requesterEmail.includes('@')) {
          googleCalendarService.sendNotificationEmail(tenant, booking.requesterEmail, emailData.subject, emailData.html, booking.requesterName).catch(() => {});
        }
        if (driverEmail && driverEmail.includes('@') && driverEmailData) {
          googleCalendarService.sendNotificationEmail(tenant, driverEmail, driverEmailData.subject, driverEmailData.html, driverName).catch(() => {});
        }

        if (isSuccess) {
          const eventId = data.eventId || data.id || data.event_id || `evt-apps-script-${Date.now()}`;
          console.log('[Google Calendar] Created event with guest invite via Apps Script:', eventId);
          return eventId;
        }
      } catch (err: any) {
        console.warn('[Google Calendar] Apps Script endpoint trigger error:', err);
        addDiagnosticLog({
          bookingTitle: title,
          endpointUrl: scriptUrl,
          payload: { action: 'createCalendarEvent', title },
          status: 'ERROR',
          errorMessage: err.message || 'Failed to call Apps Script endpoint'
        });
      }
    }

    // Attempt via REST API if client OAuth token is available
    if (cachedToken && tenant?.googleCalendarId && !tenant.googleCalendarId.startsWith('http')) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events?sendUpdates=all`, {
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
          console.log('[Google Calendar] Event created via REST API with guests:', data.id);
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

  updateEvent: async (
    tenant: Tenant,
    booking: Booking,
    vehicles?: Vehicle[],
    users?: User[]
  ): Promise<boolean> => {
    const startIso = formatMalaysiaIso(booking.dateTime);
    let endIso = booking.finishDateTime ? formatMalaysiaIso(booking.finishDateTime) : '';
    if (!endIso) {
      const startLocal = parseAsLocal(booking.dateTime);
      const endLocal = new Date(startLocal.getTime() + 60 * 60 * 1000);
      endIso = formatMalaysiaIso(endLocal);
    }

    const title = buildCalendarEventTitle(booking);
    const description = buildCalendarDescription(booking, vehicles);
    const location = booking.destination || '';
    const emailData = buildEmailHtml(booking, 'UPDATED', vehicles, users);

    // Resolve assigned driver info
    const assignedDriver = users?.find(u => u.id === booking.driverId);
    const driverEmail = assignedDriver?.email;
    const driverName = assignedDriver?.name;
    const driverEmailData = assignedDriver ? buildDriverEmailHtml(booking, assignedDriver, vehicles) : null;

    const attendees: Array<{ email: string; displayName: string }> = [];
    if (booking.requesterEmail) {
      attendees.push({ email: booking.requesterEmail, displayName: booking.requesterName || 'Requester' });
    }
    if (driverEmail && driverEmail.includes('@')) {
      attendees.push({ email: driverEmail, displayName: `${driverName || 'Driver'} (FleetFlow Driver)` });
    }

    const guestEmails = [booking.requesterEmail, driverEmail]
      .filter((e): e is string => Boolean(e && e.includes('@')))
      .join(', ');

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
          requesterEmail: booking.requesterEmail || '',
          driverEmail: driverEmail || '',
          driverName: driverName || '',
          guests: guestEmails,
          attendees: attendees,
          sendInvites: true,
          sendUpdates: 'all',
          sendEmail: Boolean(booking.requesterEmail),
          emailSubject: emailData.subject,
          emailHtml: emailData.html,
          emailText: emailData.text,
          driverEmailSubject: driverEmailData?.subject || '',
          driverEmailHtml: driverEmailData?.html || '',
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
          bookingTitle: `[UPDATE] ${title}`,
          endpointUrl: scriptUrl,
          payload: { action: 'updateCalendarEvent', eventId: booking.calendarEventId, title, requesterEmail: booking.requesterEmail },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
        });

        if (isSuccess) {
          console.log('[Google Calendar] Event updated with email dispatch via Apps Script URL:', booking.calendarEventId);
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
          attendees: attendees,
          start: { dateTime: startIso, timeZone: 'Asia/Kuala_Lumpur' },
          end: { dateTime: endIso, timeZone: 'Asia/Kuala_Lumpur' },
        };

        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${encodeURIComponent(booking.calendarEventId)}?sendUpdates=all`, {
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

    let emailData: { subject: string; html: string; text: string } | null = null;
    if (bookingInfo && bookingInfo.destination && bookingInfo.dateTime) {
      emailData = buildEmailHtml(bookingInfo as Booking, 'CANCELLED');
    }

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
          requesterName: bookingInfo?.requesterName,
          requesterEmail: bookingInfo?.requesterEmail || '',
          sendEmail: Boolean(bookingInfo?.requesterEmail),
          emailSubject: emailData?.subject,
          emailHtml: emailData?.html,
          emailText: emailData?.text,
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
          bookingTitle: `[DELETE] ${title || eventId || 'Calendar Event'}`,
          endpointUrl: scriptUrl,
          payload: { action: 'deleteCalendarEvent', eventId, title, requesterEmail: bookingInfo?.requesterEmail },
          status: isSuccess ? 'SUCCESS' : 'ERROR',
          httpStatus: res.status,
          responseBody: resText.substring(0, 300),
        });

        if (isSuccess) {
          console.log('[Google Calendar] Event deleted and cancellation email dispatched via Apps Script:', eventId);
          return true;
        }
      } catch (err: any) {
        console.warn('[Google Calendar] Error deleteEvent via Apps Script:', err.message);
      }
    }

    // Fallback: Try REST API if cached OAuth token exists
    if (cachedToken && tenant?.googleCalendarId && eventId && !tenant.googleCalendarId.startsWith('http')) {
      try {
        const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(tenant.googleCalendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
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
