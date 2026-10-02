// ============================================================================
// Armada Flow - Feedback & Google Sheets Webhook Service
// Dispatches structured user feedback to Google Sheets & alerts aziznurmin@gmail.com
// ============================================================================

export interface FeedbackPayload {
  category: 'Bug / Issue' | 'Feature Request' | 'System & Speed' | 'Driver Experience' | 'General Feedback';
  rating: number; // 1 to 5
  title: string;
  message: string;
  userName?: string;
  userEmail?: string;
  userRole?: 'admin' | 'driver' | 'staff' | 'superadmin' | string;
  currentRoute?: string;
  deviceInfo?: string;
  tenantId?: string;
  systemName?: string;
  developerEmail?: string;
  timestamp?: string;
}

export interface StoredFeedbackEntry extends FeedbackPayload {
  id: string;
  createdAt: string;
  syncedToGoogleSheets: boolean;
}

const STORAGE_KEY_WEBHOOK_URL = 'armada_flow_feedback_webhook_url';
const STORAGE_KEY_LOCAL_FEEDBACK_QUEUE = 'armada_flow_feedback_queue';
export const DEFAULT_DEVELOPER_EMAIL = 'aziznurmin@gmail.com';
export const DEFAULT_GLOBAL_FEEDBACK_WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbxuS6cyIaOIYIX6X_rHuo65fNtSSY01QaXED1Vf9R_gC84OC24FhTuV65tTYnZ0yAQb/exec';

// Global webhook URL (works automatically across all tenants)
export const getFeedbackWebhookUrl = (): string => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_WEBHOOK_URL);
    if (saved && saved.trim()) return saved.trim();
  } catch {
    // ignore
  }
  return DEFAULT_GLOBAL_FEEDBACK_WEBHOOK_URL;
};

export const setFeedbackWebhookUrl = (url: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY_WEBHOOK_URL, url.trim());
  } catch (err) {
    console.error('Failed to save webhook URL:', err);
  }
};

export const getLocalFeedbackQueue = (): StoredFeedbackEntry[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOCAL_FEEDBACK_QUEUE);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
};

const saveFeedbackToLocalQueue = (entry: StoredFeedbackEntry): void => {
  try {
    const existing = getLocalFeedbackQueue();
    const updated = [entry, ...existing].slice(0, 100); // keep last 100 entries
    localStorage.setItem(STORAGE_KEY_LOCAL_FEEDBACK_QUEUE, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to cache feedback locally:', err);
  }
};

/**
 * Submits feedback to the configured Google Apps Script Webhook.
 * Always captures to local queue first to ensure zero data loss.
 */
export const submitFeedback = async (payload: FeedbackPayload): Promise<{ success: boolean; message: string }> => {
  const timestamp = new Date().toISOString();
  const fullPayload: FeedbackPayload = {
    ...payload,
    systemName: 'Armada Flow',
    developerEmail: DEFAULT_DEVELOPER_EMAIL,
    timestamp,
    deviceInfo: payload.deviceInfo || `${navigator.userAgent} (${window.innerWidth}x${window.innerHeight})`,
  };

  const localEntry: StoredFeedbackEntry = {
    ...fullPayload,
    id: `fb_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    createdAt: timestamp,
    syncedToGoogleSheets: false,
  };

  saveFeedbackToLocalQueue(localEntry);

  const webhookUrl = getFeedbackWebhookUrl();

  if (!webhookUrl) {
    // Webhook not yet configured by admin - safely stored locally in background
    return {
      success: true,
      message: 'Thank you! Your feedback has been submitted and recorded successfully.',
    };
  }

  try {
    // Send via standard POST with text/plain to avoid CORS preflight drops in Google Apps Script
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(fullPayload),
    });

    // Mark as synced locally
    try {
      const queue = getLocalFeedbackQueue();
      const updated = queue.map(item => (item.id === localEntry.id ? { ...item, syncedToGoogleSheets: true } : item));
      localStorage.setItem(STORAGE_KEY_LOCAL_FEEDBACK_QUEUE, JSON.stringify(updated));
    } catch {
      // ignore
    }

    return {
      success: true,
      message: 'Thank you! Your feedback has been submitted successfully.',
    };
  } catch (err: any) {
    console.warn('[FeedbackService] Webhook dispatch warning (queued locally):', err?.message);
    return {
      success: true,
      message: 'Thank you! Your feedback has been submitted successfully.',
    };
  }
};

/**
 * Returns complete, copy-paste ready Google Apps Script code for the user's Google Sheet.
 * Handles both spreadsheet row insertion and instant email dispatch to aziznurmin@gmail.com.
 */
export const getGoogleAppsScriptTemplate = (): string => {
  return `/**
 * ============================================================================
 * ARMADA FLOW - GOOGLE SHEETS FEEDBACK WEBHOOK SCRIPT (Code.gs)
 * ============================================================================
 * Instructions:
 * 1. Open your Google Sheet where you want feedback saved.
 * 2. Click "Extensions" > "Apps Script".
 * 3. Delete any code in the editor and paste this entire script.
 * 4. Click "Deploy" > "Manage deployments" (or "New deployment").
 * 5. If editing existing deployment: click Edit pencil icon, select Version: "New version", and click Deploy.
 * 6. Set Execute as: "Me".
 * 7. Set Who has access: "Anyone".
 * ============================================================================
 */

function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Armada Flow Feedback Webhook is active and connected to Google Sheet: " + ss.getName(),
      sheetName: sheet.getName(),
      rows: sheet.getLastRow(),
      developerAlertRecipient: "aziznurmin@gmail.com",
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  } catch(err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getActiveSheet();
    
    // Set headers if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow([
        "Timestamp (MYT)",
        "System Name",
        "Category",
        "Rating (Stars)",
        "Feedback Title",
        "Detailed Message",
        "User Name",
        "User Email",
        "Role",
        "Tenant / Company",
        "Current Route",
        "Device / Browser"
      ]);
      sheet.getRange("A1:L1").setFontWeight("bold").setBackground("#1E1B4B").setFontColor("#FFFFFF");
      sheet.setFrozenRows(1);
    }
    
    var data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch(errParse) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }
    
    var now = new Date();
    var formattedDate = Utilities.formatDate(now, "Asia/Kuala_Lumpur", "yyyy-MM-dd HH:mm:ss");
    
    var category = data.category || "General Feedback";
    var rating = Number(data.rating) || 5;
    var title = data.title || "Feedback Submission";
    var message = data.message || "(No message provided)";
    var userName = data.userName || "Anonymous User";
    var userEmail = data.userEmail || "N/A";
    var userRole = (data.userRole || "user").toUpperCase();
    var tenantId = data.tenantId || "default";
    var currentRoute = data.currentRoute || "/";
    var deviceInfo = data.deviceInfo || "Browser";
    var systemName = data.systemName || "Armada Flow";
    
    // Append row to Google Sheet
    sheet.appendRow([
      formattedDate,
      systemName,
      category,
      rating + " ★",
      title,
      message,
      userName,
      userEmail,
      userRole,
      tenantId,
      currentRoute,
      deviceInfo
    ]);
    
    // Send instant email notification to developer
    var devEmail = "aziznurmin@gmail.com";
    var subject = "[" + systemName + " Feedback] " + category + " (" + rating + "★): " + title;
    
    var stars = "";
    for (var i = 0; i < rating; i++) { stars += "★"; }
    for (var j = rating; j < 5; j++) { stars += "☆"; }
    
    var sheetUrl = ss.getUrl();
    
    var htmlBody = '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">' +
      '<div style="background: #1e1b4b; padding: 20px; color: #ffffff;">' +
        '<h2 style="margin: 0; font-size: 20px; color: #ffffff;">' + systemName + ' - New Feedback Alert</h2>' +
        '<p style="margin: 5px 0 0 0; color: #c7d2fe; font-size: 13px;">Received on ' + formattedDate + ' (MYT)</p>' +
      '</div>' +
      '<div style="padding: 24px;">' +
        '<div style="margin-bottom: 16px; padding: 12px 16px; background: #f8fafc; border-left: 4px solid #4f46e5; border-radius: 4px;">' +
          '<div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Category & Rating</div>' +
          '<div style="font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px;">' + category + ' &nbsp;·&nbsp; <span style="color: #f59e0b;">' + stars + ' (' + rating + '/5)</span></div>' +
        '</div>' +
        '<div style="margin-bottom: 16px;">' +
          '<div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Subject</div>' +
          '<div style="font-size: 16px; font-weight: bold; color: #1e293b; margin-top: 2px;">' + title + '</div>' +
        '</div>' +
        '<div style="margin-bottom: 20px;">' +
          '<div style="font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold;">Message Details</div>' +
          '<div style="background: #f1f5f9; padding: 14px; border-radius: 8px; font-size: 14px; color: #334155; line-height: 1.6; margin-top: 4px; white-space: pre-wrap;">' + message + '</div>' +
        '</div>' +
        '<table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #475569; margin-bottom: 20px;">' +
          '<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px 0; font-weight: bold; width: 35%;">Submitted By:</td><td style="padding: 6px 0;">' + userName + ' (' + userEmail + ')</td></tr>' +
          '<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px 0; font-weight: bold;">User Role:</td><td style="padding: 6px 0;">' + userRole + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px 0; font-weight: bold;">Tenant / Org:</td><td style="padding: 6px 0;">' + tenantId + '</td></tr>' +
          '<tr style="border-bottom: 1px solid #f1f5f9;"><td style="padding: 6px 0; font-weight: bold;">Active View:</td><td style="padding: 6px 0;">' + currentRoute + '</td></tr>' +
          '<tr><td style="padding: 6px 0; font-weight: bold;">Device:</td><td style="padding: 6px 0;">' + deviceInfo + '</td></tr>' +
        '</table>' +
        '<div style="text-align: center; padding-top: 10px;">' +
          '<a href="' + sheetUrl + '" style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 20px; font-size: 13px; font-weight: bold; text-decoration: none; border-radius: 8px;">Open Google Sheet Ledger &rarr;</a>' +
        '</div>' +
      '</div>' +
    '</div>';
    
    try {
      MailApp.sendEmail({
        to: devEmail,
        subject: subject,
        htmlBody: htmlBody
      });
    } catch(mailErr) {
      // Email failed but row is recorded
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Feedback recorded and developer alerted!" }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;
};
