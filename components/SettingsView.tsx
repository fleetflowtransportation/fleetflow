import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export const SettingsView: React.FC = () => {
  const { activeTenant, updateGoogleCalendarId, updateGoogleDriveId } = useAppContext();
  
  const [calendarId, setCalendarId] = useState('');
  const [driveId, setDriveId] = useState('');
  
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);
  
  const [calendarSuccess, setCalendarSuccess] = useState(false);
  const [driveSuccess, setDriveSuccess] = useState(false);
  
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeTenant) {
      setCalendarId(activeTenant.googleCalendarId || '');
      setDriveId(activeTenant.googleDriveId || '');
    }
  }, [activeTenant]);

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

  const publicBookingUrl = `${window.location.origin}/?action=book&tenant_id=${activeTenant?.id || 'yayasan-chow-kit'}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicBookingUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Tetapan Organisasi</h2>
        <p className="text-sm text-gray-500 font-medium mt-1">Urus integrasi awan, pautan tempahan staf, serta destinasi simpanan media untuk organisasi {activeTenant?.name || ''}.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Google Calendar ID Setting Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2.5 mb-4">
              <span className="text-xl">📅</span>
              <h3 className="text-lg font-bold text-gray-950">Google Calendar ID</h3>
            </div>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              Masukkan ID Google Calendar rasmi organisasi anda. Semua tempahan van yang diluluskan akan diselaraskan secara automatik ke kalendar ini untuk panduan kakitangan.
            </p>
            
            {calendarSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-bold">
                ✓ ID Kalendar berjaya disimpan!
              </div>
            )}

            <form onSubmit={handleSaveCalendar} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Calendar ID</label>
                <input
                  type="text"
                  value={calendarId}
                  onChange={(e) => setCalendarId(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition"
                  placeholder="cth: organization@group.calendar.google.com"
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
              Masukkan ID Folder Google Drive organisasi anda. Semua lampiran dokumen (resit minyak, lampiran borang tempahan, gambar isu kerosakan van) akan dimuat naik ke folder berasingan ini.
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
