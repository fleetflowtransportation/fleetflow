import { Tenant } from '../types';

export interface GoogleDriveUploadResult {
  success: boolean;
  url: string;
  fileId?: string;
  directUrl?: string;
  thumbnailUrl?: string;
  webViewLink?: string;
  name: string;
  folderName: string;
  folderPath?: string;
  isLocalFallback?: boolean;
  error?: string;
}

/**
 * Extracts Google Drive Folder ID from standard Google Drive URLs or returns raw ID.
 * Examples:
 * - https://drive.google.com/drive/folders/1wXyZ... -> 1wXyZ...
 * - https://drive.google.com/drive/u/0/folders/1wXyZ... -> 1wXyZ...
 * - https://drive.google.com/open?id=1wXyZ... -> 1wXyZ...
 * - 1wXyZ... -> 1wXyZ...
 */
export const extractDriveFolderId = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check for /folders/<ID>
  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch && folderMatch[1]) {
    return folderMatch[1];
  }

  // Check for id=<ID>
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Check for /d/<ID>
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }

  // If input doesn't look like a URL and is alphanumeric with typical Drive ID length
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && trimmed.length >= 15) {
    return trimmed;
  }

  return trimmed;
};

/**
 * Converts a standard Google Drive view link into a direct embed image URL.
 */
export const getDriveDirectImageUrl = (url?: string | null): string => {
  if (!url) return '';
  if (url.startsWith('data:') || url.startsWith('blob:') || (url.startsWith('http://') === false && url.startsWith('https://') === false)) {
    return url;
  }

  // If already a direct lh3 or uc export link
  if (url.includes('googleusercontent.com') || url.includes('uc?export=view')) {
    return url;
  }

  // Extract ID
  const idMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/) || url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    const fileId = idMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return url;
};

/**
 * Extracts Google Drive File ID from standard Drive URLs or returns raw ID.
 */
export const extractDriveFileId = (input?: string | null): string | null => {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return null;
  }

  // Check for /file/d/<ID>
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch && fileMatch[1]) {
    return fileMatch[1];
  }

  // Check for /d/<ID> (e.g. lh3.googleusercontent.com/d/<ID>)
  const dMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (dMatch && dMatch[1]) {
    return dMatch[1];
  }

  // Check for id=<ID>
  const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }

  // Raw file ID (alphanumeric, at least 15 chars, no slashes or protocols)
  if (!trimmed.includes('/') && !trimmed.includes(':') && trimmed.length >= 15) {
    return trimmed;
  }

  return null;
};

export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwsKTRbN2EAxSO1DtKXFCmaaH3ElzM2cPkQm5qJRcwZOK_zLi_WSKKQXgWsaCcVUn7d/exec';
export const DEFAULT_DRIVE_FOLDER_ID = '1JR8y0J3B1S9RHJaeR_JtgRSkMOx6gqwC';

/**
 * Deletes a file from Google Drive via the organization's Google Apps Script webhook.
 */
export const deleteFromGoogleDrive = async (
  fileIdOrUrl: string,
  tenant?: Tenant | null
): Promise<{ success: boolean; message?: string }> => {
  const fileId = extractDriveFileId(fileIdOrUrl);
  if (!fileId) {
    return { success: false, message: 'Invalid or non-Google Drive file ID/URL' };
  }

  const appsScriptUrl = 
    tenant?.googleAppsScriptUrl || 
    localStorage.getItem('fleetflow_google_script_url') || 
    (import.meta as any).env?.VITE_GOOGLE_SCRIPT_UPLOAD_URL ||
    DEFAULT_APPS_SCRIPT_URL;

  if (!appsScriptUrl || !appsScriptUrl.includes('script.google.com')) {
    console.warn('[Google Drive] Cannot delete file: Google Apps Script Webhook not configured');
    return { success: false, message: 'Google Apps Script not configured' };
  }

  try {
    const payload = {
      action: 'deleteFile',
      actionType: 'deleteFile',
      fileId: fileId,
      id: fileId,
    };

    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      // ignore
    }

    if (resJson && (resJson.success === true || resJson.status === 'success')) {
      return { success: true };
    }
    return { success: true, message: resJson?.message || 'Deleted' };
  } catch (err: any) {
    console.warn('[Google Drive] Delete file exception:', err.message);
    return { success: false, message: err.message };
  }
};

/**
 * Format fuel receipt file name to DD-MM-YYYY_Noplat.ext (e.g. 01-10-2026_VAA8821.jpg)
 */
export const formatFuelReceiptFileName = (
  dateStr: string,
  plateNumber: string,
  originalFileName: string
): string => {
  let ext = 'jpg';
  if (originalFileName && originalFileName.includes('.')) {
    ext = originalFileName.split('.').pop() || 'jpg';
  }
  
  let day = '01';
  let month = '01';
  let year = '2026';
  
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      day = String(d.getDate()).padStart(2, '0');
      month = String(d.getMonth() + 1).padStart(2, '0');
      year = String(d.getFullYear());
    } else {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        year = parts[0];
        month = parts[1].padStart(2, '0');
        day = parts[2].padStart(2, '0');
      }
    }
  }

  const cleanPlate = (plateNumber || 'VEHICLE')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  return `${day}-${month}-${year}_${cleanPlate}.${ext}`;
};

/**
 * Convert file to Base64 data string (stripped of data prefix).
 */
export const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

/**
 * Convert file to Data URL with mime type header.
 */
export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });

/**
 * Checks if a stored attachment URL is an embedded Base64 string that bloats database egress.
 */
export const isBase64Attachment = (url?: string | null): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('data:application/')) {
    return true;
  }
  // Check if string is long raw base64 without protocol
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://') && !trimmed.startsWith('blob:') && trimmed.length > 300) {
    return true;
  }
  return false;
};

/**
 * Uploads raw Base64 data or Data URL directly to Google Drive via Apps Script Webhook.
 */
export const uploadBase64StringToGoogleDrive = async (
  base64OrDataUrl: string,
  options: {
    folderName?: string;
    folderPath?: string | string[];
    fileName: string;
    mimeType?: string;
    tenant?: Tenant | null;
  }
): Promise<GoogleDriveUploadResult> => {
  const targetFolder = options.folderName || 'fuel_logs';
  const customFileName = options.fileName || `receipt_${Date.now()}.jpg`;
  const tenant = options.tenant;

  let mimeType = options.mimeType || 'image/jpeg';
  let rawBase64 = base64OrDataUrl;

  if (base64OrDataUrl.startsWith('data:')) {
    const mimeMatch = base64OrDataUrl.match(/^data:([^;]+);base64,/);
    if (mimeMatch && mimeMatch[1]) {
      mimeType = mimeMatch[1];
    }
    rawBase64 = base64OrDataUrl.includes(',') ? base64OrDataUrl.split(',')[1] : base64OrDataUrl;
  }

  // Format folderPath
  let folderPathString = '';
  if (Array.isArray(options.folderPath)) {
    folderPathString = options.folderPath.filter(Boolean).join('/');
  } else if (typeof options.folderPath === 'string' && options.folderPath.trim()) {
    folderPathString = options.folderPath.trim();
  } else {
    folderPathString = targetFolder;
  }

  // Resolve Google Apps Script endpoint
  const appsScriptUrl = 
    tenant?.googleAppsScriptUrl || 
    localStorage.getItem('fleetflow_google_script_url') || 
    (import.meta as any).env?.VITE_GOOGLE_SCRIPT_UPLOAD_URL ||
    DEFAULT_APPS_SCRIPT_URL;

  // Resolve parent Drive folder ID
  const rawDriveId = tenant?.googleDriveId || localStorage.getItem('fleetflow_google_drive_id') || '';
  const rootDriveFolderId = extractDriveFolderId(rawDriveId);

  if (!appsScriptUrl || !appsScriptUrl.includes('script.google.com')) {
    return {
      success: false,
      url: '',
      name: customFileName,
      folderName: targetFolder,
      error: 'Google Apps Script Webhook is not configured in Settings > Integrations.',
    };
  }

  try {
    const payload = {
      action: 'uploadFile',
      actionType: 'uploadFile',
      base64: rawBase64,
      fileName: customFileName,
      mimeType: mimeType,
      folder: folderPathString || targetFolder,
      folderName: folderPathString || targetFolder,
      subFolder: folderPathString || targetFolder,
      folderPath: folderPathString,
      subFolderPath: folderPathString,
      driveId: rootDriveFolderId || undefined,
      folderId: rootDriveFolderId || undefined,
    };

    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      console.warn('[Google Drive] Non-JSON response during base64 upload:', resText.substring(0, 150));
    }

    if (resJson && (resJson.success === true || resJson.status === 'success') && (resJson.url || resJson.fileId)) {
      const fileId = resJson.fileId || resJson.id;
      const directUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : resJson.directUrl || resJson.url;
      const webViewLink = resJson.url || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

      return {
        success: true,
        url: directUrl || webViewLink,
        fileId: fileId,
        directUrl: directUrl,
        thumbnailUrl: fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : undefined,
        webViewLink: webViewLink,
        name: resJson.name || customFileName,
        folderName: targetFolder,
        folderPath: folderPathString,
        isLocalFallback: false,
      };
    } else {
      return {
        success: false,
        url: '',
        name: customFileName,
        folderName: targetFolder,
        error: resJson?.message || 'Google Drive webhook returned an error response.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      url: '',
      name: customFileName,
      folderName: targetFolder,
      error: err.message || 'Failed to upload file to Google Drive.',
    };
  }
};

/**
 * Uploads a file to Google Drive under a dedicated subfolder or nested folder path (e.g. ['Fuel Logs', 'VAA8821']).
 * Automatically uses active tenant's Google Apps Script URL and Google Drive ID.
 * Strict mode: refuses to embed massive Base64 strings to protect Supabase egress bandwidth.
 */
export const uploadToGoogleDrive = async (
  file: File,
  options: {
    folderName?: string; // e.g. 'vehicle', 'fuel_logs', 'bookings'
    folderPath?: string | string[]; // e.g. ['Fuel Logs', 'VAA 8821'] or 'Fuel Logs/VAA 8821'
    fileName?: string; // custom formatted name, e.g. '01-10-2026_VAA8821.jpg'
    tenant?: Tenant | null;
  } = {}
): Promise<GoogleDriveUploadResult> => {
  const targetFolder = options.folderName || 'vehicle';
  const customFileName = options.fileName || file.name;
  const tenant = options.tenant;

  // Format folderPath
  let folderPathString = '';
  if (Array.isArray(options.folderPath)) {
    folderPathString = options.folderPath.filter(Boolean).join('/');
  } else if (typeof options.folderPath === 'string' && options.folderPath.trim()) {
    folderPathString = options.folderPath.trim();
  } else {
    folderPathString = targetFolder;
  }

  // Resolve Google Apps Script endpoint
  const appsScriptUrl = 
    tenant?.googleAppsScriptUrl || 
    localStorage.getItem('fleetflow_google_script_url') || 
    (import.meta as any).env?.VITE_GOOGLE_SCRIPT_UPLOAD_URL ||
    DEFAULT_APPS_SCRIPT_URL;

  // Resolve parent Drive folder ID
  const rawDriveId = tenant?.googleDriveId || localStorage.getItem('fleetflow_google_drive_id') || '';
  const rootDriveFolderId = extractDriveFolderId(rawDriveId);

  if (!appsScriptUrl || !appsScriptUrl.includes('script.google.com')) {
    return {
      success: false,
      url: '',
      name: customFileName,
      folderName: targetFolder,
      folderPath: folderPathString,
      isLocalFallback: false,
      error: 'Google Apps Script Webhook URL is not configured. Please configure it in Settings > Integrations so files can be saved to Google Drive.',
    };
  }

  try {
    const base64Str = await fileToBase64(file);

    const payload = {
      action: 'uploadFile',
      actionType: 'uploadFile',
      base64: base64Str,
      fileName: customFileName,
      mimeType: file.type || 'image/jpeg',
      folder: folderPathString || targetFolder,
      folderName: folderPathString || targetFolder,
      subFolder: folderPathString || targetFolder,
      folderPath: folderPathString,
      subFolderPath: folderPathString,
      driveId: rootDriveFolderId || undefined,
      folderId: rootDriveFolderId || undefined,
    };

    const response = await fetch(appsScriptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const resText = await response.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      console.warn('[Google Drive] Non-JSON response:', resText.substring(0, 150));
    }

    if (resJson && (resJson.success === true || resJson.status === 'success') && (resJson.url || resJson.fileId)) {
      const fileId = resJson.fileId || resJson.id;
      const directUrl = fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : resJson.directUrl || resJson.url;
      const webViewLink = resJson.url || (fileId ? `https://drive.google.com/file/d/${fileId}/view` : '');

      return {
        success: true,
        url: directUrl || webViewLink,
        fileId: fileId,
        directUrl: directUrl,
        thumbnailUrl: fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : undefined,
        webViewLink: webViewLink,
        name: resJson.name || customFileName,
        folderName: targetFolder,
        folderPath: folderPathString,
        isLocalFallback: false,
      };
    } else {
      return {
        success: false,
        url: '',
        name: customFileName,
        folderName: targetFolder,
        folderPath: folderPathString,
        isLocalFallback: false,
        error: resJson?.message || 'Google Drive webhook did not return a valid file link. Please check your Apps Script deployment.',
      };
    }
  } catch (err: any) {
    console.warn(`[Google Drive] Upload to folder "${folderPathString}" failed:`, err.message);
    return {
      success: false,
      url: '',
      name: customFileName,
      folderName: targetFolder,
      folderPath: folderPathString,
      isLocalFallback: false,
      error: `Failed to connect to Google Drive: ${err.message}. Please check your internet connection or Google Apps Script URL.`,
    };
  }
};

