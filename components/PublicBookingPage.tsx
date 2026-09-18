import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storage';
import { googleCalendarService } from '../services/googleCalendar';
import { DEPARTMENTS, PICKUP_POINTS, Tenant, Booking, PassengerCount } from '../types';
import { evaluateBookingAssignment, normalizeDate, normalizeTime, getDriverCalendarColor, type AutoAssignResult } from '../services/bookingEngine';
import { isOtherPickup, getPickupLocationDisplay } from '../utils';
import { ClockIcon, PaperClipIcon, CheckCircleIcon, CalendarIcon } from './icons/Icons';

interface PublicBookingPageProps {
  tenantId: string;
}

const OTHER_PICKUP = 'Lokasi Lain (Sila Nyatakan)';
const FREE_VEHICLE_CHOICE = 'Bebas';

const emptyFormData = {
  requesterName: '',
  requesterEmail: '',
  department: '',
  purpose: '',
  bookingDate: '',
  startTime: '',
  endTime: '',
  destination: '',
  pickupPoint: '',
  address: '',
  staffCount: '',
  kidsCount: '',
  teenagersCount: '',
  serviceType: '' as '' | 'Perlu Driver' | 'Self-Drive',
  vehiclePreference: FREE_VEHICLE_CHOICE,
  shouldWait: false,
  icNumber: '',
  remarks: '',
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = (error) => reject(error);
    reader.readAsDataURL(file);
  });
};

export const PublicBookingPage: React.FC<PublicBookingPageProps> = ({ tenantId }) => {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [driverSchedules, setDriverSchedules] = useState<any[]>([]);
  
  const [formData, setFormData] = useState(emptyFormData);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<AutoAssignResult | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [loading, setLoading] = useState(true);

  // Initialize and load tenant specific data
  useEffect(() => {
    setLoading(true);
    storageService.setTenantId(tenantId);
    
    Promise.all([
      storageService.getTenant(tenantId),
      storageService.getVehicles(),
      storageService.getUsers(),
      storageService.getBookings(),
      storageService.getDriverSchedules()
    ]).then(([t, v, u, b, s]) => {
      setTenant(t);
      setVehicles(v);
      setUsers(u);
      setBookings(b);
      setDriverSchedules(s);
      setLoading(false);
    }).catch(err => {
      console.error('[PublicBooking] Gagal memuatkan data tenant:', err);
      setLoading(false);
    });
  }, [tenantId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const removeAttachment = () => {
    setAttachmentFile(null);
    const fileInput = document.getElementById('public-attachment-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || isUploading) return;

    const passengers: PassengerCount[] = [];
    if (Number(formData.staffCount) > 0) passengers.push({ category: 'Staff', count: Number(formData.staffCount) });
    if (Number(formData.kidsCount) > 0) passengers.push({ category: 'Kids', count: Number(formData.kidsCount) });
    if (Number(formData.teenagersCount) > 0) passengers.push({ category: 'Teenagers', count: Number(formData.teenagersCount) });
    
    if (passengers.length === 0) {
      alert('Sila isi bilangan penumpang (Staf, Kanak-kanak, atau Remaja).');
      return;
    }

    if (!formData.serviceType) {
      alert('Sila pilih Jenis Perkhidmatan Diperlukan.');
      return;
    }

    if (isOtherPickup(formData.pickupPoint) && !formData.address.trim()) {
      alert('Sila nyatakan alamat pickup.');
      return;
    }

    if (formData.serviceType === 'Self-Drive' && !formData.icNumber.trim()) {
      alert('Sila isi No. IC untuk rekod lesen memandu.');
      return;
    }

    setIsSubmitting(true);

    const baseInput = {
      requesterName: formData.requesterName,
      requesterEmail: formData.requesterEmail,
      department: formData.department,
      bookingDate: formData.bookingDate,
      startTime: formData.startTime,
      endTime: formData.endTime,
      purpose: formData.purpose,
      destination: formData.destination,
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      staffCount: Number(formData.staffCount) || 0,
      kidsCount: Number(formData.kidsCount) || 0,
      teenagersCount: Number(formData.teenagersCount) || 0,
      serviceType: formData.serviceType,
      vehiclePreference: formData.vehiclePreference,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks,
      icNumber: formData.icNumber,
    };

    // Auto assign engine check
    const result = evaluateBookingAssignment({
      booking: baseInput,
      existingBookings: bookings,
      driverSchedules,
      users,
      vehicles,
      lastDriverAssignedId: null,
    });

    if (result.status === 'Conflict') {
      setSubmitResult(result);
      setIsSubmitting(false);
      return;
    }

    const dateTime = `${formData.bookingDate}T${formData.startTime}:00`;
    const finishDateTime = formData.endTime
      ? `${formData.bookingDate}T${formData.endTime}:00`
      : undefined;

    const newBooking: Booking = {
      id: `booking-${Date.now()}`,
      requesterName: formData.requesterName,
      requesterEmail: formData.requesterEmail,
      department: formData.department,
      purpose: formData.purpose,
      dateTime,
      finishDateTime,
      destination: formData.destination,
      pickupPoint: formData.pickupPoint,
      address: isOtherPickup(formData.pickupPoint) ? formData.address.trim() : '',
      passengers,
      serviceType: formData.serviceType,
      vehiclePreference: formData.serviceType === 'Perlu Driver' ? formData.vehiclePreference : undefined,
      icNumber: formData.serviceType === 'Self-Drive' ? formData.icNumber.trim() : undefined,
      shouldWait: formData.shouldWait,
      remarks: formData.remarks.trim() ? formData.remarks.trim() : undefined,
      status: result.status,
      driverId: result.driverId,
      vehicleId: result.vehicleId,
      calendarEventTitle: result.calendarEventTitle,
      calendarColor: result.calendarColor,
      calendarEventId: result.calendarEventId,
      adminNotes: result.adminNotes,
      conflictReason: result.conflictReason,
      isPreWorkingHour: result.isPreWorkingHour,
      warningNotes: result.warningNotes,
      tenantId: tenantId,
    };

    // Google script attachment upload
    if (attachmentFile) {
      newBooking.attachmentName = attachmentFile.name;
      const driveUrl = import.meta.env.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
      if (driveUrl) {
        try {
          const base64Str = await fileToBase64(attachmentFile);
          const response = await fetch(driveUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              base64: base64Str,
              fileName: attachmentFile.name,
              mimeType: attachmentFile.type
            })
          });
          const resJson = await response.json();
          if (resJson && resJson.success && resJson.url) {
            newBooking.attachmentUrl = resJson.url;
          }
        } catch (error) {
          console.error("Gagal muat naik ke Drive, fallback local URL", error);
          newBooking.attachmentUrl = URL.createObjectURL(attachmentFile);
        }
      } else {
        newBooking.attachmentUrl = URL.createObjectURL(attachmentFile);
      }
    }

    // Google Calendar Sync
    if (tenant) {
      try {
        const calEventId = await googleCalendarService.createEvent(tenant, newBooking);
        if (calEventId) {
          newBooking.calendarEventId = calEventId;
        }
      } catch (err) {
        console.warn('[Google Calendar] Gagal create event:', err);
      }
    }

    // Save to Supabase
    try {
      await storageService.createBooking(newBooking);
      setIsSuccess(true);
      setSubmitResult(result);
    } catch (err: any) {
      alert('Ralat ketika menyimpan tempahan: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-4 border-gray-300 border-t-gray-800 rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Sila tunggu, memuatkan borang tempahan...</p>
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md border">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Organisasi Tidak Ditemui</h2>
          <p className="text-gray-600 text-sm mb-6">Pautan tempahan ini tidak sah atau organisasi tidak berdaftar dalam sistem.</p>
          <a href="/" className="px-5 py-2.5 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition">Ke Halaman Utama</a>
        </div>
      </div>
    );
  }

  const calendarUrl = tenant.googleCalendarId
    ? `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(tenant.googleCalendarId)}&ctz=Asia%2FKuala_Lumpur`
    : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-8 px-4 sm:px-6">
      <div className="w-full max-w-3xl">
        
        {/* Banner/Header */}
        <div className="bg-gradient-to-r from-indigo-700 to-indigo-950 rounded-2xl shadow-xl p-6 sm:p-8 text-white mb-8 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-12 translate-y-12 scale-150">
            <CalendarIcon className="w-48 h-48 text-white" />
          </div>
          <div className="relative z-10">
            <span className="bg-indigo-500/30 text-indigo-200 text-xs uppercase tracking-wider font-semibold px-3 py-1 rounded-full border border-indigo-400/20">
              Sistem Tempahan Van Pintar
            </span>
            <h1 className="text-2xl sm:text-4xl font-extrabold mt-3 tracking-tight">
              Borang Tempahan Kenderaan
            </h1>
            <p className="text-indigo-200 mt-2 text-sm sm:text-base max-w-xl font-medium">
              Sila lengkapkan maklumat di bawah untuk menempah kenderaan bagi pihak organisasi <b>{tenant.name}</b>.
            </p>
            
            {calendarUrl && (
              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  href={calendarUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center bg-white hover:bg-gray-100 text-indigo-900 font-bold px-4 py-2 rounded-lg text-sm shadow-md transition"
                >
                  <CalendarIcon className="w-4 h-4 mr-2 text-indigo-700" />
                  Rujuk Jadual/Kalendar Organisasi
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Success View */}
        {isSuccess ? (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center border border-emerald-100 max-w-2xl mx-auto">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-100">
              <CheckCircleIcon className="w-12 h-12 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-gray-950">Tempahan Berjaya Dihantar!</h2>
            
            <div className="my-6 p-4 bg-slate-50 rounded-xl text-left border border-slate-200 space-y-2">
              <p className="text-sm text-gray-700"><b>Pemohon:</b> {formData.requesterName}</p>
              <p className="text-sm text-gray-700"><b>Tujuan:</b> {formData.purpose}</p>
              <p className="text-sm text-gray-700"><b>Lokasi Pickup:</b> {getPickupLocationDisplay(formData.pickupPoint, formData.address)}</p>
              <p className="text-sm text-gray-700"><b>Destinasi:</b> {formData.destination}</p>
              <p className="text-sm text-gray-700"><b>Tarikh & Masa:</b> {formData.bookingDate} ({formData.startTime} - {formData.endTime || 'Selesai'})</p>
              <p className="text-sm text-gray-700"><b>Status Tempahan:</b> 
                <span className={`ml-1.5 inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
                  submitResult?.status === 'Auto-Assigned' 
                    ? 'bg-emerald-100 text-emerald-800' 
                    : submitResult?.status === 'Conflict'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-amber-100 text-amber-800'
                }`}>
                  {submitResult?.status === 'Auto-Assigned' ? 'Diluluskan (Auto-Assign)' : 'Menunggu Kelulusan Admin'}
                </span>
              </p>
              {submitResult?.adminNotes && (
                <p className="text-xs text-indigo-700 font-semibold bg-indigo-50 p-2.5 rounded-lg border border-indigo-100 mt-2">
                  ℹ️ {submitResult.adminNotes}
                </p>
              )}
            </div>

            <p className="text-gray-600 text-sm leading-relaxed mb-6">
              Sila hubungi pihak pentadbiran {tenant.name} jika anda ingin membatalkan atau mengubah suai tempahan ini.
            </p>

            <button
              onClick={() => {
                setFormData(emptyFormData);
                setAttachmentFile(null);
                setIsSuccess(false);
                setSubmitResult(null);
              }}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-md hover:bg-indigo-700 transition"
            >
              Hantar Tempahan Baharu
            </button>
          </div>
        ) : (
          /* Main Form View */
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8 border">
            
            {/* Conflict Alert in-form */}
            {submitResult && submitResult.status === 'Conflict' && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-950">
                <h3 className="font-extrabold text-base flex items-center gap-1.5 mb-1 text-red-800">
                  ⚠️ Tempahan Bertembung (Conflict)
                </h3>
                <p className="text-sm leading-relaxed">
                  {submitResult.conflictReason || 'Semua pemandu atau kenderaan tidak tersedia pada tarikh dan waktu yang dipilih.'}
                </p>
                <p className="text-xs font-semibold mt-2 text-red-900">
                  Sila pilih tarikh atau masa penggunaan yang lain untuk mengelakkan pertembungan.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* 1 & 2: Nama & Jabatan */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Nama Pemohon</label>
                  <input
                    type="text"
                    name="requesterName"
                    value={formData.requesterName}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                    placeholder="Masukkan nama penuh anda"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Jabatan / Department</label>
                  <select
                    name="department"
                    value={formData.department}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value="" disabled>Pilih Jabatan</option>
                    {DEPARTMENTS.map(dep => <option key={dep} value={dep}>{dep}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800">Alamat E-mel</label>
                <input
                  type="email"
                  name="requesterEmail"
                  value={formData.requesterEmail}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="cth: anda@organisasi.org"
                />
              </div>

              {/* 3, 4, 5: Tarikh & Masa */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Tarikh Penggunaan</label>
                  <input
                    type="date"
                    name="bookingDate"
                    value={formData.bookingDate}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Masa Mula</label>
                  <input
                    type="time"
                    name="startTime"
                    value={formData.startTime}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Masa Tamat (Jangkaan)</label>
                  <input
                    type="time"
                    name="endTime"
                    value={formData.endTime}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  />
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center space-x-2 text-amber-800 font-bold text-sm">
                  <ClockIcon className="h-5 w-5 text-amber-600 flex-shrink-0" />
                  <span>Polisi Rehat & Sekatan Waktu Rehat</span>
                </div>
                <div className="text-xs text-amber-950 leading-relaxed pl-7">
                  <p className="font-semibold">• Isnin – Khamis & Ahad: 12:00 PM – 1:00 PM</p>
                  <p className="font-semibold">• Jumaat: 12:30 PM – 2:30 PM</p>
                  <p className="mt-2 text-amber-900 italic font-medium">
                    Sekiranya waktu mula tempahan berada di dalam slot rehat, sistem akan menolak tempahan tersebut bagi menjaga kebajikan masa pemandu.
                  </p>
                </div>
              </div>

              {/* Tujuan */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Tujuan Perjalanan</label>
                <input
                  type="text"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="cth: Mesyuarat, Ambil barangan, Program belia"
                />
              </div>

              {/* Destinasi */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Destinasi / Alamat Penuh</label>
                <textarea
                  name="destination"
                  value={formData.destination}
                  onChange={handleChange}
                  required
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="Masukkan destinasi atau alamat terperinci"
                ></textarea>
              </div>

              {/* Pickup Point */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Lokasi Pickup</label>
                  <select
                    name="pickupPoint"
                    value={formData.pickupPoint}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value="" disabled>Pilih Lokasi</option>
                    {PICKUP_POINTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                {isOtherPickup(formData.pickupPoint) && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-800">Nyatakan Alamat Pickup</label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      required
                      className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                      placeholder="Masukkan alamat penuh pickup"
                    />
                  </div>
                )}
              </div>

              {/* Penumpang */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Bilangan Penumpang</label>
                <div className="grid grid-cols-3 gap-3 mt-1.5">
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Staf (Staff)</span>
                    <input
                      type="number"
                      min="0"
                      name="staffCount"
                      value={formData.staffCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Kanak-kanak</span>
                    <input
                      type="number"
                      min="0"
                      name="kidsCount"
                      value={formData.kidsCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-gray-500 block mb-1 text-center">Remaja</span>
                    <input
                      type="number"
                      min="0"
                      name="teenagersCount"
                      value={formData.teenagersCount}
                      onChange={handleChange}
                      className="block w-full border border-gray-300 rounded-lg p-2 text-center shadow-sm"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Pemandu Menunggu */}
              <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl">
                <label className="flex items-start space-x-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    name="shouldWait"
                    checked={formData.shouldWait}
                    onChange={(e) => setFormData(prev => ({ ...prev, shouldWait: e.target.checked }))}
                    className="h-5 w-5 rounded text-amber-600 border-gray-300 focus:ring-amber-500 mt-0.5"
                  />
                  <div>
                    <span className="text-sm font-bold text-gray-900">⏳ Pemandu Perlu Menunggu di Lokasi?</span>
                    <p className="text-xs text-gray-600 mt-0.5">
                      Tandakan ini jika tugasan memerlukan pemandu sedia menunggu di lokasi bagi menghantar penumpang kembali ke pejabat semula.
                    </p>
                  </div>
                </label>
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Jenis Perkhidmatan</label>
                <select
                  name="serviceType"
                  value={formData.serviceType}
                  onChange={handleChange}
                  required
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                >
                  <option value="" disabled>Pilih Jenis</option>
                  <option value="Perlu Driver">Perlu Driver (Dipandu oleh Staf Pemandu Organisasi)</option>
                  <option value="Self-Drive">Self-Drive (Memandu sendiri - Kenderaan Alza sahaja)</option>
                </select>
              </div>

              {formData.serviceType === 'Perlu Driver' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800">Kenderaan Pilihan</label>
                  <select
                    name="vehiclePreference"
                    value={formData.vehiclePreference}
                    onChange={handleChange}
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border bg-white"
                  >
                    <option value={FREE_VEHICLE_CHOICE}>Bebas (Tiada keutamaan - Pemandu akan pilih kenderaan semasa tugasan)</option>
                    {vehicles.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
                  </select>
                </div>
              )}

              {formData.serviceType === 'Self-Drive' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-800">No. IC Pemandu (Lesen Memandu)</label>
                  <input
                    type="text"
                    name="icNumber"
                    value={formData.icNumber}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                    placeholder="cth: 900101-14-5566"
                  />
                </div>
              )}

              {/* Remarks */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Nota Tambahan / Remarks (Opsional)</label>
                <textarea
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleChange}
                  rows={2}
                  className="mt-1 block w-full border-gray-300 rounded-lg shadow-sm focus:ring-indigo-500 focus:border-indigo-500 p-2.5 border"
                  placeholder="Masukkan sebarang arahan atau catatan khas"
                ></textarea>
              </div>

              {/* Lampiran */}
              <div>
                <label className="block text-sm font-semibold text-gray-800">Lampiran / Surat Kelulusan (Opsional)</label>
                {!attachmentFile ? (
                  <input
                    id="public-attachment-input"
                    type="file"
                    onChange={handleFileChange}
                    className="mt-2 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-600 hover:file:bg-indigo-100"
                  />
                ) : (
                  <div className="mt-2 flex items-center justify-between p-2 pl-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center space-x-2 truncate">
                      <PaperClipIcon className="h-5 w-5 text-gray-500 flex-shrink-0"/>
                      <span className="text-sm text-gray-700 truncate">{attachmentFile.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={removeAttachment}
                      className="text-sm font-medium text-red-600 hover:text-red-800 ml-2"
                    >
                      Buang
                    </button>
                  </div>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting || isUploading}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-3.5 px-6 rounded-xl shadow-lg transition disabled:bg-indigo-400 flex items-center justify-center space-x-2"
                >
                  {isSubmitting || isUploading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Sedang Menghantar Tempahan...</span>
                    </>
                  ) : (
                    <span>Hantar Tempahan Kenderaan</span>
                  )}
                </button>
              </div>

            </form>
          </div>
        )}

        <div className="text-center mt-8 text-xs text-gray-400 font-medium">
          Powered by FleetFlow Smart SaaS Transportation Platform &copy; 2026
        </div>
      </div>
    </div>
  );
};
