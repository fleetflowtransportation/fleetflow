import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { googleCalendarService, getDiagnosticLogs, clearDiagnosticLogs, CalendarDiagnosticLog } from '../services/googleCalendar';

export const SettingsView: React.FC = () => {
  const { activeTenant, updateGoogleCalendarId, updateGoogleDriveId } = useAppContext();
  
  const [calendarId, setCalendarId] = useState('');
  const [driveId, setDriveId] = useState('');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  const [scriptLoading, setScriptLoading] = useState(false);
  
  const [calendarSuccess, setCalendarSuccess] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState(false);
  const [scriptSuccess, setScriptSuccess] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [showCodeGuide, setShowCodeGuide] = useState(false);

  // Diagnostic Logs & Testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [diagnosticLogs, setDiagnosticLogs] = useState<CalendarDiagnosticLog[]>([]);

  useEffect(() => {
    if (activeTenant) {
      setCalendarId(activeTenant.googleCalendarId || '');
      setDriveId(activeTenant.googleDriveId || '');
    }
    const savedScriptUrl = localStorage.getItem('fleetflow_google_script_url') || import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL || '';
    setAppsScriptUrl(savedScriptUrl);
    setDiagnosticLogs(getDiagnosticLogs());
  }, [activeTenant]);

  const refreshLogs = () => {
    setDiagnosticLogs(getDiagnosticLogs());
  };

  const handleClearLogs = () => {
    clearDiagnosticLogs();
    setDiagnosticLogs([]);
  };

  const handleSaveCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    setCalendarLoading(true);
    setCalendarSuccess(false);
    const success = await updateGoogleCalendarId(calendarId.trim());
    setCalendarLoading(false);
    if (success) {
      setCalendarSuccess(true);
      setTimeout(() => setCalendarSuccess(false), 3000);
    }
  };

  const handleSaveDrive = async (e: React.FormEvent) => {
    e.preventDefault();
    setDriveLoading(true);
    setDriveSuccess(false);
    const success = await updateGoogleDriveId(driveId.trim());
    setDriveLoading(false);
    if (success) {
      setDriveSuccess(true);
      setTimeout(() => setDriveSuccess(false), 3000);
    }
  };

  const handleSaveAppsScriptUrl = (e: React.FormEvent) => {
    e.preventDefault();
    setScriptLoading(true);
    try {
      localStorage.setItem('fleetflow_google_script_url', appsScriptUrl.trim());
      setScriptSuccess(true);
      setTimeout(() => setScriptSuccess(false), 3000);
    } finally {
      setScriptLoading(false);
    }
  };

  const handleTestConnection = async () => {
    if (!activeTenant) return;
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await googleCalendarService.testConnection(activeTenant, appsScriptUrl.trim());
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

  const fullCodeGs = `// ==========================================
// FleetFlow Google Apps Script (Code.gs)
// Menyokong: Google Calendar Sync & Google Drive Upload
// ==========================================

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
    
    // 1. ACTION: createCalendarEvent (FleetFlow Calendar Sync)
    if (data.action === "createCalendarEvent" || data.actionType === "createCalendarEvent" || data.type === "createCalendarEvent" || data.title || data.summary) {
      var calendarId = data.calendarId || "primary";
      var cal;
      if (calendarId && calendarId !== "primary" && calendarId.indexOf("@") !== -1) {
        cal = CalendarApp.getCalendarById(calendarId);
      }
      if (!cal) {
        cal = CalendarApp.getDefaultCalendar();
      }
      
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
        eventId: event.getId(),
        id: event.getId(),
        title: title,
        calendar: cal.getName()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. ACTION: uploadFile (FleetFlow Google Drive Upload)
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

    return ContentService.createTextOutput(JSON.stringify({
      status: "received",
      message: "Tiada tindakan spesifik dipadankan",
      received: data
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: "error",
      success: false,
      error: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const handleCopyCodeGs = () => {
    navigator.clipboard.writeText(fullCodeGs);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tetapan Organisasi</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">Urus integrasi awan Google Calendar, Google Drive Apps Script, serta log diagnostik untuk organisasi {activeTenant?.name || ''}.</p>
      </div>

      {/* Quick Test Bar */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-gray-950 flex items-center space-x-2">
            <span>⚡</span>
            <span>Ujian Sambungan Google Apps Script & Calendar</span>
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Uji sama ada URL Web App Google Apps Script anda sedia menerima tempahan dan mencipta acara di Google Calendar.
          </p>
        </div>
        <button
          onClick={handleTestConnection}
          disabled={testingConnection}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-sm transition cursor-pointer disabled:bg-indigo-300 flex-shrink-0 flex items-center space-x-2"
        >
          {testingConnection ? (
            <>
              <div className="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              <span>Menguji...</span>
            </>
          ) : (
            <>
              <span>🧪</span>
              <span>Uji Sambungan Sekarang</span>
            </>
          )}
        </button>
      </div>

      {/* Test Result Message */}
      {testResult && (
        <div className={`p-4 rounded-2xl border text-xs font-semibold ${testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
          <div className="flex items-center space-x-2">
            <span className="text-base">{testResult.success ? '✅' : '❌'}</span>
            <span className="font-bold">{testResult.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Apps Script Web App URL Setting Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between md:col-span-2">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl">🚀</span>
                <h3 className="text-lg font-bold text-gray-950">Google Apps Script Web App URL (Code.gs)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCodeGuide(!showCodeGuide)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-bold underline cursor-pointer"
              >
                {showCodeGuide ? 'Tutup Panduan Code.gs' : 'Lihat / Salin Kod Code.gs'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              URL Web App dari skrip Google Apps Script anda (berakhir dengan <code>/exec</code>). Skrip ini membolehkan sistem mencipta acara kalendar secara automatik serta memuat naik dokumen ke Google Drive tanpa meminta kebenaran pop-up daripada pemohon.
            </p>
            
            {scriptSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold">
                ✓ URL Google Apps Script berjaya disimpan!
              </div>
            )}

            <form onSubmit={handleSaveAppsScriptUrl} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Web App Exec URL</label>
                <input
                  type="text"
                  value={appsScriptUrl}
                  onChange={(e) => setAppsScriptUrl(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition font-mono text-xs"
                  placeholder="https://script.google.com/macros/s/AKfycbx.../exec"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={scriptLoading}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition cursor-pointer disabled:bg-slate-300"
                >
                  {scriptLoading ? 'Menyimpan...' : 'Simpan URL Apps Script'}
                </button>
              </div>
            </form>
          </div>

          {/* Collapsible Code.gs Guide */}
          {showCodeGuide && (
            <div className="mt-5 p-4 bg-slate-900 text-white rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300">📄 Skrip Lengkap: Google Apps Script (Code.gs)</span>
                <button
                  onClick={handleCopyCodeGs}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition cursor-pointer"
                >
                  {codeCopied ? 'Berjaya Disalin!' : '📋 Salin Kod Code.gs'}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Buka <strong>script.google.com</strong> &gt; Buka projek anda &gt; Tampal kod ini di dalam <strong>Code.gs</strong> &gt; Klik <strong>Deploy &gt; Manage deployments &gt; New version</strong> (pastikan <em>Who has access</em> ditetapkan kepada <strong>Anyone</strong>).
              </p>
              <pre className="text-[11px] font-mono bg-slate-950 p-3 rounded-lg overflow-x-auto max-h-60 text-slate-200">
                {fullCodeGs}
              </pre>
            </div>
          )}
        </div>
        
        {/* Google Calendar ID Setting Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <span className="text-xl">📅</span>
              <h3 className="text-lg font-bold text-gray-950">Google Calendar ID</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Masukkan ID Google Calendar rasmi organisasi (contohnya e-mel kalendar organisasi atau <code>primary</code>). Semua acara tempahan akan diselaraskan ke kalendar ini.
            </p>
            
            {calendarSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold">
                ✓ ID Kalendar berjaya disimpan!
              </div>
            )}

            <form onSubmit={handleSaveCalendar} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Calendar ID / Email</label>
                <input
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  placeholder="cth: organization@group.calendar.google.com atau primary"
                />
              </div>
              <button
                type="submit"
                disabled={calendarLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer disabled:bg-slate-300"
              >
                {calendarLoading ? 'Menyimpan...' : 'Simpan Kalendar ID'}
              </button>
            </form>
          </div>
        </div>

        {/* Google Drive Folder ID Setting Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <span className="text-xl">📁</span>
              <h3 className="text-lg font-bold text-gray-950">Google Drive Folder ID</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Masukkan ID Folder Google Drive organisasi anda. Semua lampiran dokumen (resit minyak, borang program, gambar isu) akan disimpan ke dalam folder ini.
            </p>
            
            {driveSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold">
                ✓ ID Folder Drive berjaya disimpan!
              </div>
            )}

            <form onSubmit={handleSaveDrive} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Folder ID</label>
                <input
                  type="text"
                  value={driveId}
                  onChange={(e) => setDriveId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  placeholder="cth: 1aBcDeFgHiJkLmNoPqRsTuVwXyZ"
                />
              </div>
              <button
                type="submit"
                disabled={driveLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition cursor-pointer disabled:bg-slate-300"
              >
                {driveLoading ? 'Menyimpan...' : 'Simpan Drive ID'}
              </button>
            </form>
          </div>
        </div>

      </div>

      {/* Diagnostic Logs Panel */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">📋</span>
            <div>
              <h3 className="text-base font-bold text-gray-950">Log Diagnostik Penyelarasan Google Calendar</h3>
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
            Tiada log diagnostik direkodkan setakat ini. Klik butang &quot;Uji Sambungan Sekarang&quot; atau buat tempahan baru untuk menjana log.
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
