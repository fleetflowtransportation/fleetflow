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

export const IntegrationsSettings: React.FC = () => {
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
      if (!isModalOpen) {
        setTempCalendarId(cal);
        setTempDriveId(drv);
        setTempAppsScriptUrl(script);
      }
    } else {
      const savedScriptUrl = localStorage.getItem('fleetflow_google_script_url') || import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || '';
      setAppsScriptUrl(savedScriptUrl);
      if (!isModalOpen) {
        setTempAppsScriptUrl(savedScriptUrl);
      }
    }
    setDiagnosticLogs(getDiagnosticLogs());
  }, [activeTenant, isModalOpen]);

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

      // Save all 3 to cloud storage for the active organization
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
        setSaveError('Gagal menyimpan tetapan. Sila pastikan sambungan internet anda aktif.');
      }
      refreshLogs();
    } catch (err: any) {
      console.error('Error saving integrations:', err);
      setSaveError(err.message || 'Ralat semasa menyimpan tetapan integrasi.');
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

      if (!event && startStr) {
        var searchStart = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
        var searchEnd = new Date(endTime.getTime() + 24 * 60 * 60 * 1000);
        var list = cal.getEvents(searchStart, searchEnd);
        for (var i = 0; i < list.length; i++) {
          var desc = list[i].getDescription() || "";
          var curTitle = list[i].getTitle() || "";
          if ((data.bookingId && desc.indexOf(data.bookingId) !== -1) || curTitle === title || (data.requesterName && (curTitle.indexOf(data.requesterName) !== -1 || desc.indexOf(data.requesterName) !== -1))) {
            event = list[i];
            break;
          }
        }
      }

      if (event) {
        event.setTitle(title);
        event.setTime(startTime, endTime);
        if (description) event.setDescription(description);
        if (location) event.setLocation(location);
        
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "updated",
          id: event.getId(),
          title: event.getTitle()
        })).setMimeType(ContentService.MimeType.JSON);
      } else {
        var newEv = cal.createEvent(title, startTime, endTime, {
          description: description,
          location: location
        });
        return ContentService.createTextOutput(JSON.stringify({
          status: "success",
          success: true,
          action: "created_fallback",
          id: newEv.getId(),
          title: newEv.getTitle()
        })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // -----------------------------------------------------------------------
    // 2. ACTION: deleteCalendarEvent (Padam Acara Kalendar)
    // -----------------------------------------------------------------------
    if (data.action === "deleteCalendarEvent" || data.actionType === "deleteCalendarEvent") {
      var calendarId = data.calendarId || "primary";
      var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
        ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
        : CalendarApp.getDefaultCalendar();

      var eventId = data.eventId || data.id;
      if (eventId) {
        try {
          var event = cal.getEventById(eventId);
          if (event) {
            event.deleteEvent();
            return ContentService.createTextOutput(JSON.stringify({
              status: "success",
              success: true,
              action: "deleted",
              id: eventId
            })).setMimeType(ContentService.MimeType.JSON);
          }
        } catch (delErr) {}
      }

      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        success: true,
        message: "Acara tidak ditemui atau telah dipadam"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // -----------------------------------------------------------------------
    // 3. ACTION: createCalendarEvent (Cipta Acara Kalendar Baru)
    // -----------------------------------------------------------------------
    var calendarId = data.calendarId || "primary";
    var cal = (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1)
      ? (CalendarApp.getCalendarById(calendarId) || CalendarApp.getDefaultCalendar())
      : CalendarApp.getDefaultCalendar();

    var title = data.title || data.summary || ("Tempahan Kenderaan - " + (data.requesterName || "Pengguna"));
    var description = data.description || "";
    var location = data.location || "";
    
    var startStr = data.startTime || data.startIso || (data.start && data.start.dateTime);
    var endStr = data.endTime || data.endIso || (data.end && data.end.dateTime);
    var startTime = startStr ? new Date(startStr) : new Date();
    var endTime = endStr ? new Date(endStr) : new Date(startTime.getTime() + 60 * 60 * 1000);
    if (isNaN(startTime.getTime())) startTime = new Date();
    if (isNaN(endTime.getTime())) endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    var createdEvent = cal.createEvent(title, startTime, endTime, {
      description: description,
      location: location
    });

    return ContentService.createTextOutput(JSON.stringify({
      status: "success",
      success: true,
      id: createdEvent.getId(),
      title: createdEvent.getTitle()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(fullCodeGs);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Public Booking Link Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <span>Pautan Tempahan Awam (Public Form)</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 uppercase">
                {activeTenant?.companyName || activeTenant?.name || 'Organisasi Aktif'}
              </span>
            </h3>
            <p className="text-sm text-gray-500">
              Kongsikan pautan ini kepada staf atau pemohon untuk mengisi borang tempahan van secara terus.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
            >
              {copied ? '✓ Disalin!' : 'Salin Pautan'}
            </button>
            <a
              href={publicBookingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium transition"
            >
              Buka Form ↗
            </a>
          </div>
        </div>
        <div className="mt-3 bg-gray-50 rounded-lg p-2.5 border border-gray-100 font-mono text-xs text-gray-600 truncate select-all">
          {publicBookingUrl}
        </div>
      </div>

      {/* Integration Overview Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Konfigurasi Google Workspace & Kalendar</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Sambungkan tempahan FleetFlow dengan Google Calendar dan Google Drive organisasi anda.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleTestConnection}
              disabled={testingConnection}
              className="inline-flex items-center px-3.5 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold transition disabled:opacity-50"
            >
              {testingConnection ? 'Menguji...' : '⚡ Uji Sambungan'}
            </button>
            <button
              onClick={openModal}
              className="inline-flex items-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
            >
              ⚙️ Ubah Tetapan
            </button>
          </div>
        </div>

        {/* Test Result Banner */}
        {testResult && (
          <div className={`p-4 rounded-xl text-sm ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
            <span className="font-semibold">{testResult.success ? '✓ Berjaya: ' : '✗ Gagal: '}</span>
            {testResult.message}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Google Calendar ID</span>
            <span className="font-mono text-xs text-gray-800 break-all select-all font-medium block">
              {calendarId || 'primary (Default)'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Google Drive Folder ID</span>
            <span className="font-mono text-xs text-gray-800 break-all select-all font-medium block">
              {driveId || '(Folder Utama)'}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100 space-y-1">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider block">Google Apps Script Web App URL</span>
            <span className="font-mono text-xs text-gray-800 truncate select-all font-medium block">
              {appsScriptUrl ? `${appsScriptUrl.substring(0, 35)}...` : '(Belum dikonfigurasi)'}
            </span>
          </div>
        </div>

        {/* Google Script Code Helper */}
        <div className="pt-2">
          <button
            onClick={() => setShowCodeGuide(!showCodeGuide)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            {showCodeGuide ? '▼ Sembunyikan Kod Google Apps Script' : '▶ Tunjukkan Kod Google Apps Script (Code.gs)'}
          </button>

          {showCodeGuide && (
            <div className="mt-4 p-4 rounded-xl bg-gray-900 text-gray-100 text-xs font-mono space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Code.gs (Salin dan tampal ke Google Apps Script editor)</span>
                <button
                  onClick={handleCopyCode}
                  className="px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold"
                >
                  {codeCopied ? '✓ Disalin' : 'Salin Semua Kod'}
                </button>
              </div>
              <pre className="max-h-60 overflow-y-auto p-3 bg-black/40 rounded-lg text-[11px] leading-relaxed select-all">
                {fullCodeGs}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Diagnostics Logs Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Log Diagnostik Kalendar</h4>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshLogs}
              className="text-xs text-indigo-600 hover:underline"
            >
              Muat Semula
            </button>
            <span className="text-gray-300">|</span>
            <button
              onClick={handleClearLogs}
              className="text-xs text-red-600 hover:underline"
            >
              Padam Log
            </button>
          </div>
        </div>

        {diagnosticLogs.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-2">Tiada rekod diagnostik buat masa ini.</p>
        ) : (
          <div className="max-h-48 overflow-y-auto space-y-2">
            {diagnosticLogs.slice(-8).reverse().map((log, idx) => (
              <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs flex items-center justify-between">
                <span className="font-mono text-gray-600">{log.action}</span>
                <span className={`font-semibold ${log.status === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                  {log.status.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-6 shadow-2xl border border-gray-100">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Kemaskini Google Integrations</h3>
              <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {saveSuccess && (
              <div className="p-3 bg-emerald-50 text-emerald-800 text-xs rounded-lg font-medium">
                ✓ Tetapan integrasi berjaya disimpan!
              </div>
            )}

            {saveError && (
              <div className="p-3 bg-red-50 text-red-800 text-xs rounded-lg font-medium">
                {saveError}
              </div>
            )}

            <form onSubmit={handleSaveAllIntegrations} className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl text-xs text-amber-800">
                <span>{isLocked ? '🔒 Mod Dikunci (Mencegah perubahan tidak sengaja)' : '🔓 Mod Dibuka (Sedia untuk diedit)'}</span>
                <button
                  type="button"
                  onClick={() => setIsLocked(!isLocked)}
                  className="px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded font-semibold transition"
                >
                  {isLocked ? 'Buka Kunci' : 'Kunci Semula'}
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Google Calendar ID
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={tempCalendarId}
                  onChange={(e) => setTempCalendarId(e.target.value)}
                  placeholder="primary atau alamat emel kalendar cth: yck-van@group.calendar.google.com"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Google Drive Folder ID
                </label>
                <input
                  type="text"
                  disabled={isLocked}
                  value={tempDriveId}
                  onChange={(e) => setTempDriveId(e.target.value)}
                  placeholder="ID folder Google Drive cth: 1A2b3C4d5E6F..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase mb-1">
                  Google Apps Script Web App URL
                </label>
                <input
                  type="url"
                  disabled={isLocked}
                  value={tempAppsScriptUrl}
                  onChange={(e) => setTempAppsScriptUrl(e.target.value)}
                  placeholder="https://script.google.com/macros/s/.../exec"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-xs font-mono focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                >
                  Tutup
                </button>
                <button
                  type="submit"
                  disabled={isLocked || saveLoading}
                  className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition disabled:opacity-50"
                >
                  {saveLoading ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntegrationsSettings;
