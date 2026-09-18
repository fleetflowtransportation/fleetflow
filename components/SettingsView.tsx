import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { 
  googleCalendarService, 
  getDiagnosticLogs, 
  clearDiagnosticLogs, 
  CalendarDiagnosticLog,
  cleanGoogleScriptUrl,
  isGoogleScriptUrl 
} from '../services/googleCalendar';

export const SettingsView: React.FC = () => {
  const { activeTenant, updateTenantGoogleIntegrations } = useAppContext();
  
  // Real values in state
  const [calendarId, setCalendarId] = useState('');
  const [driveId, setDriveId] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');

  // Temp values when editing in modal
  const [tempCalendarId, setTempCalendarId] = useState('');
  const [tempDriveId, setTempDriveId] = useState('');
  const [tempAppsScriptUrl, setTempAppsScriptUrl] = useState('');

  // Modal & Lock State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Copy helpers
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);

  // Diagnostic Logs & Testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<CalendarDiagnosticLog[]>([]);

  useEffect(() => {
    if (activeTenant) {
      const cal = activeTenant.googleCalendarId || '';
      const drv = activeTenant.googleDriveId || '';
      const script = activeTenant.googleAppsScriptUrl || localStorage.getItem('fleetflow_google_script_url') || import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || '';
      setCalendarId(cal);
      setDriveId(drv);
      setAppsScriptUrl(script);
      setTempCalendarId(cal);
      setTempDriveId(drv);
      setTempAppsScriptUrl(script);
    } else {
      const savedScriptUrl = localStorage.getItem('fleetflow_google_script_url') || import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || '';
      setAppsScriptUrl(savedScriptUrl);
      setTempAppsScriptUrl(savedScriptUrl);
    }
    setDiagnosticLogs(getDiagnosticLogs());
  }, [activeTenant]);

  const refreshLogs = () => {
    setDiagnosticLogs(getDiagnosticLogs());
  };

  const handleClearLogs = () => {
    clearDiagnosticLogs();
    setDiagnosticLogs([]);
  };

  const openModal = () => {
    setTempCalendarId(calendarId);
    setTempDriveId(driveId);
    setTempAppsScriptUrl(appsScriptUrl);
    setIsLocked(true); // Default to locked mode for safety
    setTestResult(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setIsLocked(true);
  };

  const handleSaveAllIntegrations = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const cleanCal = tempCalendarId.trim();
      const cleanDrv = tempDriveId.trim();
      const cleanUrl = cleanGoogleScriptUrl(tempAppsScriptUrl);

      // Save all 3 to Supabase database for the active tenant
      const success = await updateTenantGoogleIntegrations({
        googleAppsScriptUrl: cleanUrl,
        googleCalendarId: cleanCal,
        googleDriveId: cleanDrv,
      });

      if (success) {
        setCalendarId(cleanCal);
        setDriveId(cleanDrv);
        setAppsScriptUrl(cleanUrl);
        setTempAppsScriptUrl(cleanUrl);
        setSaveSuccess(true);
        setSaveError(null);
        setIsLocked(true); // Auto-lock after saving
        setTimeout(() => setSaveSuccess(false), 4000);
      } else {
        setSaveError('Gagal menyimpan ke pangkalan data Supabase. Sila pastikan anda telah menjalankan "ALTER TABLE tenants DISABLE ROW LEVEL SECURITY;" di Supabase SQL Editor.');
      }
      refreshLogs();
    } catch (err: any) {
      console.error('Error saving integrations:', err);
      setSaveError(err.message || 'Ralat semasa menyimpan tetapan ke Supabase.');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeTenant) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const targetUrl = isLocked ? appsScriptUrl : tempAppsScriptUrl;
      const res = await googleCalendarService.testConnection(activeTenant, targetUrl.trim());
      setTestResult(res);
      refreshLogs();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Ralat sambungan'
      });
      refreshLogs();
    } finally {
      setTestingConnection(false);
    }
  };

  const publicBookingUrl = `${window.location.origin}/?action=book&tenant_id=${activeTenant?.id || 'yayasan-chow-kit'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fullCodeGs = `// =========================================================================
// FleetFlow Google Apps Script (Code.gs)
// Menyokong: Google Calendar (Create, Update, Delete), Drive & Ujian Sambungan
// =========================================================================

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    success: true,
    message: "Google Apps Script Web App FleetFlow sedang aktif dan sedia menerima arahan.",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var contents = e && e.postData ? e.postData.contents : "";
    var data = {};
    if (contents) {
      try {
        data = JSON.parse(contents);
      } catch (err) {
        data = {};
      }
    }
    
    // -----------------------------------------------------------------------
    // 0. ACTION: ping / testConnection (Ujian Sambungan Google - Tanpa Cipta Acara)
    // -----------------------------------------------------------------------
    if (data.action === "ping" || data.actionType === "ping" || data.type === "ping" || data.action === "testConnection" || !data.action) {
      var calName = "Default Calendar";
      var calendarOk = false;
      try {
        var cal = CalendarApp.getDefaultCalendar();
        if (cal) {
          calendarOk = true;
          calName = cal.getName();
        }
      } catch (errCal) {
        calName = "CalendarApp: " + errCal.toString();
      }

      var driveOk = false;
      try {
        var root = DriveApp.getRootFolder();
        if (root) driveOk = true;
      } catch (errDrive) {
        driveOk = false;
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Sambungan ke Google Apps Script berjaya! Perkhidmatan sedia menerima tempahan.",
        calendar: calName,
        calendarReady: calendarOk,
        driveReady: driveOk,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 1. ACTION: updateCalendarEvent (Kemaskini Acara Kalendar)
    // -----------------------------------------------------------------------
    if (data.action === "updateCalendarEvent" || data.actionType === "updateCalendarEvent") {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var eventId = data.eventId || data.id;
      var event = null;
      if (eventId) {
        try {
          event = cal.getEventById(eventId);
        } catch (err) {}
      }

      var title = data.title || data.summary || "Tempahan Kenderaan FleetFlow";
      var description = data.description || "";
      var location = data.location || "";
      
      var startStr = data.startTime || data.startIso || (data.start && data.start.dateTime);
      var endStr = data.endTime || data.endIso || (data.end && data.end.dateTime);
      var startTime = startStr ? new Date(startStr) : new Date();
      var endTime = endStr ? new Date(endStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
      if (isNaN(startTime.getTime())) startTime = new Date();
      if (isNaN(endTime.getTime())) endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // Jika ID tidak dijumpai terus, cuba cari acara dalam julat tarikh mengikut ID tempahan / tajuk
      if (!event && startStr) {
        var searchStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
        var searchEnd = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        var list = cal.getEvents(searchStart, searchEnd);
        for (var i = 0; i < list.length; i++) {
          var desc = list[i].getDescription() || "";
          if ((data.bookingId && desc.indexOf(data.bookingId) !== -1) || list[i].getTitle() === title) {
            event = list[i];
            break;
          }
        }
      }

      if (event) {
        event.setTitle(title);
        event.setTime(startTime, endTime);
        event.setDescription(description);
        event.setLocation(location);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "update",
          eventId: event.getId(),
          title: title
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        // Jika belum wujud, cipta baru (fallback)
        var newEvt = cal.createEvent(title, startTime, endTime, {
          description: description,
          location: location
        });
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "create_fallback",
          eventId: newEvt.getId(),
          title: title
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // -----------------------------------------------------------------------
    // 2. ACTION: deleteCalendarEvent (Padam Acara Kalendar)
    // -----------------------------------------------------------------------
    if (data.action === "deleteCalendarEvent" || data.actionType === "deleteCalendarEvent" || (data.action === "delete" && data.calendarEventId)) {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var eventId = data.eventId || data.id || data.calendarEventId;
      var event = null;
      if (eventId) {
        try {
          event = cal.getEventById(eventId);
        } catch (err) {}
      }

      if (!event && (data.startTime || data.startIso)) {
        var st = new Date(data.startTime || data.startIso);
        var et = data.endTime || data.endIso ? new Date(data.endTime || data.endIso) : new Date(st.getTime() + 2 * 60 * 60 * 1000);
        var searchStart = new Date(st.getTime() - 24 * 60 * 60 * 1000);
        var searchEnd = new Date(et.getTime() + 24 * 60 * 60 * 1000);
        var list = cal.getEvents(searchStart, searchEnd);
        for (var j = 0; j < list.length; j++) {
          var curTitle = list[j].getTitle() || "";
          var curDesc = list[j].getDescription() || "";
          if ((data.bookingId && curDesc.indexOf(data.bookingId) !== -1) || (data.title && (curTitle.indexOf(data.title) !== -1 || data.title.indexOf(curTitle) !== -1))) {
            event = list[j];
            break;
          }
        }
      }

      if (event) {
        event.deleteEvent();
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "delete",
          deletedEventId: eventId
        })).setMimeType(ContentService.MimeType.JSON);
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        action: "delete_already_removed",
        eventId: eventId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 3. ACTION: createCalendarEvent (Cipta Acara Kalendar Baharu)
    // -----------------------------------------------------------------------
    if (data.action === "createCalendarEvent" || data.actionType === "createCalendarEvent" || data.type === "createCalendarEvent" || data.title || data.summary) {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();
      
      var title = data.title || data.summary || (data.event && data.event.summary) || "Tempahan Kenderaan FleetFlow";
      var description = data.description || (data.event && data.event.description) || "";
      var location = data.location || (data.event && data.event.location) || "";
      
      var startStr = data.startTime || data.startIso || (data.start && data.start.dateTime);
      var endStr = data.endTime || data.endIso || (data.end && data.end.dateTime);
      var startTime = startStr ? new Date(startStr) : new Date();
      var endTime = endStr ? new Date(endStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
      if (isNaN(startTime.getTime())) startTime = new Date();
      if (isNaN(endTime.getTime())) endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
      
      var event = cal.createEvent(title, startTime, endTime, {
        description: description,
        location: location
      });
      
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        action: "create",
        eventId: event.getId(),
        id: event.getId(),
        title: title,
        calendar: cal.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // -----------------------------------------------------------------------
    // 4. ACTION: uploadFile (Muat Naik Lampiran ke Google Drive)
    // -----------------------------------------------------------------------
    if (data.action === "uploadFile" || data.base64) {
      var folderId = data.folderId;
      var folder = folderId ? DriveApp.getFolderById(folderId) : DriveApp.getRootFolder();
      var decoded = Utilities.base64Decode(data.base64);
      var blob = Utilities.newBlob(decoded, data.mimeType || "application/octet-stream", data.filename || "file");
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        url: file.getUrl(),
        downloadUrl: file.getDownloadUrl(),
        fileId: file.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 5. ACTION: delete (Padam Fail Google Drive)
    // -----------------------------------------------------------------------
    if (data.action === "delete" && data.fileId) {
      try {
        var fileToDel = DriveApp.getFileById(data.fileId);
        fileToDel.setTrashed(true);
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          message: "Fail dipadamkan"
        })).setMimeType(ContentService.MimeType.JSON);
      } catch (e) {
        return ContentService.createTextOutput(JSON.stringify({
          status: "error",
          error: e.toString()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      message: "Permohonan diterima oleh Google Apps Script",
      received: data
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

// Fungsi Ujian Kebenaran (Authorize Permission)
function testPermission() {
  var cal = CalendarApp.getDefaultCalendar();
  var drive = DriveApp.getRootFolder();
  Logger.log("Kebenaran Calendar & Drive Berjaya Disahkan: " + cal.getName());
}`;

  const handleCopyCodeGs = () => {
    navigator.clipboard.writeText(fullCodeGs);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const isConfigured = Boolean(appsScriptUrl || calendarId || driveId);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tetapan Organisasi</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">
          Urus pautan tempahan staf, integrasi selamat Google Calendar & Drive, serta semak rekod diagnostik untuk {activeTenant?.name || 'Organisasi'}.
        </p>
      </div>

      {/* Main Single Integration Hub Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-gray-100">
          <div className="flex items-start space-x-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-700 rounded-xl text-2xl flex-shrink-0">
              🔒
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold text-gray-950">Integrasi Google Workspace & Apps Script</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Terkunci & Dilindungi
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">
                Tetapan sensitif untuk penyelarasan Google Calendar (Auto-Sync) dan storan dokumen Google Drive. Semua konfigurasi dilindungi dan dikunci untuk mengelakkan perubahan tidak sengaja.
              </p>
            </div>
          </div>

          <button
            onClick={openModal}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center justify-center space-x-2 flex-shrink-0 cursor-pointer"
          >
            <span>⚙️</span>
            <span>Urus 3 Pautan Integrasi</span>
          </button>
        </div>

        {/* Overview Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-5">
          {/* 1. Apps Script URL */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">1. Web App URL (Code.gs)</span>
              <span className={`h-2 w-2 rounded-full ${appsScriptUrl ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            </div>
            <div className="text-xs font-mono text-gray-800 truncate font-semibold">
              {appsScriptUrl ? `${appsScriptUrl.substring(0, 32)}...` : 'Belum Ditetapkan'}
            </div>
            <p className="text-[11px] text-gray-400">Jambatan auto-sync kalendar & fail</p>
          </div>

          {/* 2. Calendar ID */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">2. Calendar ID</span>
              <span className={`h-2 w-2 rounded-full ${calendarId ? 'bg-emerald-500' : 'bg-blue-400'}`} />
            </div>
            <div className="text-xs font-mono text-gray-800 truncate font-semibold">
              {calendarId || 'primary (Kalendar Utama)'}
            </div>
            <p className="text-[11px] text-gray-400">Sasaran acara kalendar tempahan</p>
          </div>

          {/* 3. Drive Folder ID */}
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-200/70 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">3. Drive Folder ID</span>
              <span className={`h-2 w-2 rounded-full ${driveId ? 'bg-emerald-500' : 'bg-gray-400'}`} />
            </div>
            <div className="text-xs font-mono text-gray-800 truncate font-semibold">
              {driveId || 'Root Folder (Folder Utama)'}
            </div>
            <p className="text-[11px] text-gray-400">Folder muat naik dokumen/resit</p>
          </div>
        </div>

        {/* Quick Test Bar inside settings */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-gray-500 flex items-center space-x-2">
            <span>💡</span>
            <span>Uji komunikasi sistem dengan Google Apps Script pada bila-bila masa:</span>
          </div>
          <button
            onClick={handleTestConnection}
            disabled={testingConnection || !isConfigured}
            className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer disabled:opacity-50 flex items-center space-x-2"
          >
            {testingConnection ? (
              <>
                <div className="animate-spin h-3.5 w-3.5 border-2 border-indigo-700 border-t-transparent rounded-full" />
                <span>Menguji...</span>
              </>
            ) : (
              <>
                <span>🧪</span>
                <span>Uji Sambungan Google</span>
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className={`mt-4 p-3.5 rounded-xl border text-xs font-medium ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
            <div className="flex items-start space-x-2">
              <span className="text-base flex-shrink-0">{testResult.success ? '✅' : '❌'}</span>
              <span className="leading-relaxed">{testResult.message}</span>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: SENSITIVE INTEGRATION LINKS */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/10 rounded-xl text-xl">
                  {isLocked ? '🔒' : '✏️'}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-bold">Tetapan Integrasi Google Workspace</h3>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      isLocked ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}>
                      {isLocked ? 'Terkunci (Read-Only)' : 'Mod Suntingan (Edit)'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    {isLocked 
                      ? 'Pautan dilindungi dari sebarang perubahan. Tekan butang Edit untuk mengemas kini.' 
                      : 'Sila masukkan maklumat integrasi dengan teliti.'}
                  </p>
                </div>
              </div>
              <button
                onClick={closeModal}
                className="text-slate-400 hover:text-white p-2 rounded-xl transition cursor-pointer text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              
              {saveSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl font-bold flex items-center space-x-2">
                  <span>✓</span>
                  <span>Semua tetapan integrasi berjaya disimpan ke Supabase dan dikunci semula!</span>
                </div>
              )}

              {saveError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl font-medium flex items-start space-x-2">
                  <span className="text-base flex-shrink-0">⚠️</span>
                  <div>
                    <p className="font-bold">Gagal Menyimpan ke Supabase</p>
                    <p className="text-[11px] leading-relaxed mt-0.5">{saveError}</p>
                  </div>
                </div>
              )}

              {/* Security Banner when locked */}
              {isLocked ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">🛡️</span>
                    <div>
                      <p className="font-bold text-slate-900">Tetapan Sedang Dikunci</p>
                      <p className="text-slate-500 text-[11px]">Bagi memastikan penyelarasan kalendar kekal stabil dan tidak terjejas.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsLocked(false)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition flex items-center space-x-1.5 cursor-pointer flex-shrink-0"
                  >
                    <span>✏️</span>
                    <span>Buka Kunci untuk Edit</span>
                  </button>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl flex items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">⚠️</span>
                    <div>
                      <p className="font-bold">Mod Suntingan Aktif</p>
                      <p className="text-[11px] text-amber-800">Pastikan URL dan ID yang dimasukkan adalah tepat sebelum menekan simpan.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setTempCalendarId(calendarId);
                      setTempDriveId(driveId);
                      setTempAppsScriptUrl(appsScriptUrl);
                      setIsLocked(true);
                    }}
                    className="px-3.5 py-1.5 bg-amber-200 hover:bg-amber-300 text-amber-950 font-bold rounded-xl text-xs transition cursor-pointer flex-shrink-0"
                  >
                    Batal Edit
                  </button>
                </div>
              )}

              {/* Form Fields */}
              <form onSubmit={handleSaveAllIntegrations} className="space-y-4">
                
                {/* 1. Google Apps Script Web App URL */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <span>1. Google Apps Script Web App URL</span>
                      <span className="text-rose-500">*</span>
                    </label>
                    {isLocked && <span className="text-[11px] text-gray-400 font-mono">🔒 Read-Only</span>}
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={tempAppsScriptUrl}
                    onChange={(e) => setTempAppsScriptUrl(e.target.value)}
                    placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                    className={`w-full rounded-xl p-3 text-xs font-mono border transition outline-none ${
                      isLocked 
                        ? 'bg-gray-100/80 border-gray-200 text-gray-600 cursor-not-allowed select-all' 
                        : 'bg-white border-indigo-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 shadow-sm'
                    }`}
                  />
                  {!isLocked && tempAppsScriptUrl.includes('drive.google.com') && (
                    <p className="text-[11px] text-rose-600 font-semibold">
                      ⚠️ Ini adalah pautan Google Drive, bukan Google Apps Script Web App. Sila masukkan pautan Web App dari script.google.com.
                    </p>
                  )}
                  {!isLocked && tempAppsScriptUrl.trim().endsWith('/dev') && (
                    <p className="text-[11px] text-amber-600 font-semibold">
                      💡 Sistem akan menukar akhiran <code>/dev</code> kepada <code>/exec</code> secara automatik semasa disimpan.
                    </p>
                  )}
                  <p className="text-[11px] text-gray-500 leading-normal">
                    URL Web App dari Google Apps Script (mesti berakhir dengan <code>/exec</code>) untuk auto-sync kalendar & muat naik fail.
                  </p>
                </div>

                {/* 2. Google Calendar ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <span>2. Google Calendar ID / E-mel Kalendar</span>
                    </label>
                    {isLocked && <span className="text-[11px] text-gray-400 font-mono">🔒 Read-Only</span>}
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={tempCalendarId}
                    onChange={(e) => setTempCalendarId(e.target.value)}
                    placeholder="primary atau cth: organization@group.calendar.google.com"
                    className={`w-full rounded-xl p-3 text-xs font-mono border transition outline-none ${
                      isLocked 
                        ? 'bg-gray-100/80 border-gray-200 text-gray-600 cursor-not-allowed select-all' 
                        : 'bg-white border-indigo-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 shadow-sm'
                    }`}
                  />
                  <p className="text-[11px] text-gray-500 leading-normal">
                    Masukkan <code>primary</code> untuk kalendar utama pemilik skrip, atau e-mel kalendar organisasi.
                  </p>
                </div>

                {/* 3. Google Drive Folder ID */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-gray-700 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                      <span>3. Google Drive Folder ID</span>
                    </label>
                    {isLocked && <span className="text-[11px] text-gray-400 font-mono">🔒 Read-Only</span>}
                  </div>
                  <input
                    type="text"
                    disabled={isLocked}
                    value={tempDriveId}
                    onChange={(e) => setTempDriveId(e.target.value)}
                    placeholder="cth: 1aBcDeFgHiJkLmNoPqRsTuVwXyZ (Folder ID dari URL Google Drive)"
                    className={`w-full rounded-xl p-3 text-xs font-mono border transition outline-none ${
                      isLocked 
                        ? 'bg-gray-100/80 border-gray-200 text-gray-600 cursor-not-allowed select-all' 
                        : 'bg-white border-indigo-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 shadow-sm'
                    }`}
                  />
                  <p className="text-[11px] text-gray-500 leading-normal">
                    ID Folder Google Drive untuk menyimpan lampiran borang program, resit, dan dokumen.
                  </p>
                </div>

                {/* Save Button when in edit mode */}
                {!isLocked && (
                  <div className="pt-3 flex items-center justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => {
                        setTempCalendarId(calendarId);
                        setTempDriveId(driveId);
                        setTempAppsScriptUrl(appsScriptUrl);
                        setIsLocked(true);
                      }}
                      className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={saveLoading}
                      className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer disabled:bg-slate-300"
                    >
                      {saveLoading ? (
                        <>
                          <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                          <span>Menyimpan...</span>
                        </>
                      ) : (
                        <>
                          <span>💾</span>
                          <span>Simpan Semua & Kunci Semula</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </form>

              {/* Code.gs Script Helper Accordion */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCodeGuide(!showCodeGuide)}
                  className="w-full flex items-center justify-between p-3.5 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition cursor-pointer"
                >
                  <div className="flex items-center space-x-2 font-bold">
                    <span>📄</span>
                    <span>Lihat & Salin Kod Google Apps Script (Code.gs)</span>
                  </div>
                  <span className="text-xs text-slate-300">{showCodeGuide ? '▲ Tutup' : '▼ Buka'}</span>
                </button>

                {showCodeGuide && (
                  <div className="mt-3 p-4 bg-slate-950 text-white rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-300 text-[11px]">Skrip Lengkap Google Apps Script:</span>
                      <button
                        onClick={handleCopyCodeGs}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition cursor-pointer"
                      >
                        {codeCopied ? '✓ Berjaya Disalin!' : '📋 Salin Kod Code.gs'}
                      </button>
                    </div>
                    <div className="text-[11px] text-slate-400 space-y-1 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
                      <p><strong>Langkah Pantas Setup:</strong></p>
                      <p>1. Buka <code>script.google.com</code> &gt; Cipta projek baru.</p>
                      <p>2. Salin kod di bawah dan tampal ke dalam <code>Code.gs</code>.</p>
                      <p>3. Klik <strong>Deploy &gt; New deployment &gt; Web app</strong>.</p>
                      <p>4. Tetapkan <em>Execute as:</em> <strong>Me</strong> dan <em>Who has access:</em> <strong>Anyone</strong>.</p>
                      <p>5. Salin Web App URL dan tampal ke dalam ruangan di atas.</p>
                    </div>
                    <pre className="text-[10px] font-mono bg-black/70 p-3 rounded-xl overflow-x-auto max-h-52 text-emerald-400 border border-slate-800">
                      {fullCodeGs}
                    </pre>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1.5"
              >
                {testingConnection ? 'Menguji...' : '🧪 Uji Sambungan Google'}
              </button>

              <button
                type="button"
                onClick={closeModal}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Diagnostic Logs Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-base font-bold text-gray-950">Log Diagnostik Penyelarasan Google (Calendar & Drive)</h3>
              <p className="text-xs text-gray-500">Pantau rekod permohonan, status respon HTTP, dan maklum balas dari Google Apps Script.</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={refreshLogs}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              🔄 Muat Semula
            </button>
            {diagnosticLogs.length > 0 && (
              <button
                onClick={handleClearLogs}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Padam Log
              </button>
            )}
          </div>
        </div>

        {diagnosticLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs bg-gray-50 rounded-xl border border-dashed border-gray-200">
            Tiada log diagnostik direkodkan setakat ini. Klik butang &quot;Uji Sambungan&quot; atau buat tempahan baru untuk menjana log.
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
            {diagnosticLogs.map((log) => (
              <div
                key={log.id}
                className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition ${
                  log.status === 'SUCCESS' ? 'bg-emerald-50/60 border-emerald-200' : 'bg-rose-50/60 border-rose-200'
                }`}
              >
                <div className="flex items-center justify-between font-bold">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase tracking-wider font-extrabold ${
                      log.status === 'SUCCESS' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                    }`}>
                      {log.status} {log.httpStatus ? `(${log.httpStatus})` : ''}
                    </span>
                    <span className="text-gray-900">{log.bookingTitle || 'Ujian Sambungan'}</span>
                  </div>
                  <span className="text-gray-500 font-normal text-[11px]">{log.timestamp}</span>
                </div>

                <div className="text-gray-600 font-mono text-[11px] truncate">
                  <strong>Endpoint:</strong> {log.endpointUrl}
                </div>

                {log.responseBody && (
                  <div className="mt-1 bg-white/80 p-2 rounded border border-gray-200/80 font-mono text-[11px] text-gray-800 break-all">
                    <strong>Respon:</strong> {log.responseBody}
                  </div>
                )}

                {log.errorMessage && (
                  <div className="mt-1 bg-rose-100/80 p-2 rounded text-rose-900 text-[11px] font-semibold">
                    <strong>Ralat:</strong> {log.errorMessage}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Share Link Card */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white p-6 rounded-2xl shadow-sm border border-slate-800">
        <div className="flex items-center space-x-2.5 mb-2">
          <span className="text-xl">🔗</span>
          <h3 className="text-lg font-bold">Pautan Tempahan Kakitangan (Staf)</h3>
        </div>
        <p className="text-xs text-indigo-200 mb-4 leading-relaxed max-w-2xl">
          Kongsikan pautan tempahan rasmi ini kepada mana-mana staf/kakitangan awam organisasi anda. Mereka boleh mengemukakan tempahan van, menyemak status pemandu, dan merujuk kalendar rasmi tanpa memerlukan akaun log masuk.
        </p>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <input
            type="text"
            readOnly
            value={publicBookingUrl}
            className="flex-1 bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-xs font-mono text-indigo-100 select-all outline-none"
          />
          <button
            onClick={handleCopyLink}
            className="bg-white hover:bg-indigo-50 text-slate-900 font-extrabold px-6 py-3 rounded-xl text-xs shadow-sm transition flex-shrink-0 cursor-pointer"
          >
            {copied ? 'Berjaya Disalin!' : 'Salin Pautan'}
          </button>
        </div>
      </div>

    </div>
  );
};
