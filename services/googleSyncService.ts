/**
 * Google Apps Script (GAS) Sync Service
 * 
 * Manages asynchronous synchronization with Google Calendar & Google Drive.
 * Designed to execute only after database transactions succeed, preventing
 * double-execution, retry loops, and connection leaks.
 */

export interface GoogleSyncPayload {
  bookingId: string;
  requesterName: string;
  destination: string;
  pickupLocation: string;
  startTime: string;
  endTime: string;
  driverName?: string;
  purpose?: string;
  passengers?: number;
  requesterEmail?: string;
  department?: string;
  vehicleName?: string;
  notes?: string;
  [key: string]: any;
}

export interface GoogleSyncResult {
  success?: boolean;
  googleEventId?: string;
  calendarEventId?: string;
  driveFolderUrl?: string;
  driveFiles?: Array<{ name: string; url: string }>;
  message?: string;
  [key: string]: any;
}

/**
 * Resolves the active Google Apps Script Web App URL across environment variables,
 * local storage, and tenant settings.
 */
export function getActiveGoogleAppsScriptUrl(): string {
  try {
    // 1. Check Vite env vars
    const viteGasUrl = (import.meta as any).env?.VITE_GAS_URL || (import.meta as any).env?.VITE_GOOGLE_SCRIPT_URL;
    if (viteGasUrl && typeof viteGasUrl === 'string' && viteGasUrl.trim().startsWith('http')) {
      return viteGasUrl.trim();
    }

    // 2. Check Node / Process env vars if available
    if (typeof process !== 'undefined' && process.env) {
      const procGasUrl = process.env.REACT_APP_GAS_URL || process.env.VITE_GAS_URL || process.env.GOOGLE_SCRIPT_URL;
      if (procGasUrl && typeof procGasUrl === 'string' && procGasUrl.trim().startsWith('http')) {
        return procGasUrl.trim();
      }
    }

    // 3. Check browser local storage configuration
    if (typeof localStorage !== 'undefined') {
      const storedGasUrl = localStorage.getItem('fleetflow_gas_url') || localStorage.getItem('fleetflow_google_script_url');
      if (storedGasUrl && storedGasUrl.trim().startsWith('http')) {
        return storedGasUrl.trim();
      }

      // Check active tenant configuration
      const tenantsRaw = localStorage.getItem('fleetflow_tenants');
      const activeTenantId = localStorage.getItem('fleetflow_active_tenant_id') || 'yayasan-chow-kit';
      if (tenantsRaw) {
        const tenants = JSON.parse(tenantsRaw);
        const currentTenant = tenants.find((t: any) => t.id === activeTenantId);
        if (currentTenant?.googleAppsScriptUrl && currentTenant.googleAppsScriptUrl.trim().startsWith('http')) {
          return currentTenant.googleAppsScriptUrl.trim();
        }
      }
    }
  } catch (err) {
    console.warn('[googleSyncService] Error resolving Apps Script URL:', err);
  }

  return '';
}

/**
 * Dispatches an asynchronous booking sync request to Google Apps Script.
 * Returns { driveFolderUrl, googleEventId } or null without blocking or throwing.
 */
export async function syncWithGoogleServices(
  payload: GoogleSyncPayload,
  urlOverride?: string
): Promise<GoogleSyncResult | null> {
  const scriptUrl = urlOverride || getActiveGoogleAppsScriptUrl();

  if (!scriptUrl) {
    console.warn('[googleSyncService] Google Apps Script URL is not configured. Skipping Google sync.');
    return null;
  }

  try {
    const requestBody = JSON.stringify({
      action: 'CREATE_BOOKING_EVENT',
      actionType: 'createCalendarEvent',
      type: 'createCalendarEvent',
      data: payload,
      bookingId: payload.bookingId,
      requesterName: payload.requesterName,
      destination: payload.destination,
      pickupLocation: payload.pickupLocation,
      startTime: payload.startTime,
      endTime: payload.endTime,
      driverName: payload.driverName,
      purpose: payload.purpose,
      passengers: payload.passengers,
      department: payload.department,
      requesterEmail: payload.requesterEmail,
    });

    // We use text/plain to prevent CORS preflight blocking in standard GAS Web Apps
    const response = await fetch(scriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: requestBody,
    });

    if (!response.ok) {
      console.warn(`[googleSyncService] Google Sync returned status: ${response.status}`);
      return null;
    }

    const responseText = await response.text();
    let result: any = null;

    try {
      result = JSON.parse(responseText);
    } catch {
      // If GAS returned HTML login redirect or non-JSON string
      if (responseText.includes('google.com') && responseText.includes('accounts')) {
        console.warn('[googleSyncService] Apps Script requires authorization or permissions.');
        return null;
      }
      return null;
    }

    const normalizedResult: GoogleSyncResult = {
      success: result?.success !== false,
      googleEventId: result?.googleEventId || result?.eventId || result?.id || undefined,
      calendarEventId: result?.calendarEventId || result?.googleEventId || result?.eventId || undefined,
      driveFolderUrl: result?.driveFolderUrl || result?.folderUrl || result?.driveUrl || undefined,
      driveFiles: result?.driveFiles || undefined,
      message: result?.message || undefined,
    };

    return normalizedResult;
  } catch (error) {
    console.error('[googleSyncService] Error during Google Services synchronization:', error);
    // Never interrupt the main app flow if Google Sync encounters a network error
    return null;
  }
}
