import React, { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import type { Tenant } from '../types';
import { 
  BuildingOfficeIcon,
  PhoneIcon,
  MailIcon,
  LocationMarkerIcon,
  GlobeAltIcon,
  UserCircleIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  SparklesIcon,
  LockClosedIcon,
  LockOpenIcon,
  EditIcon,
  PrinterIcon,
  ClipboardCheckIcon
} from './icons/Icons';

export const ProfileSettings: React.FC = () => {
  const { activeTenant, updateTenantProfile } = useAppContext();
  const isDirtyRef = React.useRef(false);
  const lastTenantIdRef = React.useRef<string | null>(null);

  // Lock / Edit Mode Toggle (User explicitly requested edit/lock toggle)
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Tenant>>(() => {
    const tenantId = activeTenant?.id || 'yayasan-chow-kit';
    try {
      const draft = localStorage.getItem(`fleetflow_profile_draft_${tenantId}`);
      if (draft) {
        return JSON.parse(draft);
      }
    } catch {
      // ignore
    }
    return {
      companyName: activeTenant?.companyName || activeTenant?.name || 'Yayasan Chow Kit',
      registrationNumber: activeTenant?.registrationNumber || 'PPM-012-14-11012011',
      description: activeTenant?.description || 'Pusat Perlindungan Kanak-kanak & Pengurusan Pengangkutan Kebajikan Chow Kit',
      phone: activeTenant?.phone || '+603-4045 5550',
      whatsapp: activeTenant?.whatsapp || '+6012-3456789',
      email: activeTenant?.email || 'info@yck.org.my',
      website: activeTenant?.website || 'https://www.yck.org.my',
      address: activeTenant?.address || 'No. 22B, Jalan Chow Kit, 50350 Kuala Lumpur',
      postcode: activeTenant?.postcode || '50350',
      city: activeTenant?.city || 'Kuala Lumpur',
      state: activeTenant?.state || 'Wilayah Persekutuan Kuala Lumpur',
      picName: activeTenant?.picName || 'En. Syafiq (Pengurus Pengangkutan)',
      picPhone: activeTenant?.picPhone || '+6012-3456789',
    };
  });

  const [isSaving, setIsSaving] = useState(false);
  const [copyNotice, setCopyNotice] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  // Sync with activeTenant when tenant changes or when updated
  useEffect(() => {
    if (!activeTenant) return;

    const isDifferentTenant = lastTenantIdRef.current !== activeTenant.id;
    if (isDifferentTenant || (!isDirtyRef.current && !isEditing)) {
      lastTenantIdRef.current = activeTenant.id;

      // Check if draft exists
      let draftData: Partial<Tenant> | null = null;
      try {
        const raw = localStorage.getItem(`fleetflow_profile_draft_${activeTenant.id}`);
        if (raw) draftData = JSON.parse(raw);
      } catch {
        // ignore
      }

      setFormData({
        companyName: draftData?.companyName ?? (activeTenant.companyName || activeTenant.name || 'Yayasan Chow Kit'),
        registrationNumber: draftData?.registrationNumber ?? (activeTenant.registrationNumber || ''),
        description: draftData?.description ?? (activeTenant.description || ''),
        phone: draftData?.phone ?? (activeTenant.phone || ''),
        whatsapp: draftData?.whatsapp ?? (activeTenant.whatsapp || ''),
        email: draftData?.email ?? (activeTenant.email || ''),
        website: draftData?.website ?? (activeTenant.website || ''),
        address: draftData?.address ?? (activeTenant.address || ''),
        postcode: draftData?.postcode ?? (activeTenant.postcode || ''),
        city: draftData?.city ?? (activeTenant.city || ''),
        state: draftData?.state ?? (activeTenant.state || ''),
        picName: draftData?.picName ?? (activeTenant.picName || ''),
        picPhone: draftData?.picPhone ?? (activeTenant.picPhone || ''),
      });
    }
  }, [activeTenant, isEditing]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    isDirtyRef.current = true;
    
    setFormData(prev => {
      const updated = {
        ...prev,
        [name]: value,
      };
      
      // Persist draft immediately so no user keystrokes are ever lost
      try {
        const currentId = activeTenant?.id || 'yayasan-chow-kit';
        localStorage.setItem(`fleetflow_profile_draft_${currentId}`, JSON.stringify(updated));
      } catch {
        // ignore
      }

      return updated;
    });
  };

  const handleCancelEdit = () => {
    isDirtyRef.current = false;
    const currentId = activeTenant?.id || 'yayasan-chow-kit';
    try {
      localStorage.removeItem(`fleetflow_profile_draft_${currentId}`);
    } catch {
      // ignore
    }

    if (activeTenant) {
      setFormData({
        companyName: activeTenant.companyName || activeTenant.name || 'Yayasan Chow Kit',
        registrationNumber: activeTenant.registrationNumber || '',
        description: activeTenant.description || '',
        phone: activeTenant.phone || '',
        whatsapp: activeTenant.whatsapp || '',
        email: activeTenant.email || '',
        website: activeTenant.website || '',
        address: activeTenant.address || '',
        postcode: activeTenant.postcode || '',
        city: activeTenant.city || '',
        state: activeTenant.state || '',
        picName: activeTenant.picName || '',
        picPhone: activeTenant.picPhone || '',
      });
    }
    setIsEditing(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const payload: Partial<Tenant> = {
        ...formData,
        name: formData.companyName || activeTenant?.name || 'Yayasan Chow Kit',
      };

      const success = await updateTenantProfile(payload);
      if (success) {
        isDirtyRef.current = false;
        try {
          const currentId = activeTenant?.id || 'yayasan-chow-kit';
          localStorage.removeItem(`fleetflow_profile_draft_${currentId}`);
        } catch {
          // ignore
        }

        // Lock form upon successful save
        setIsEditing(false);

        setSaveStatus({
          type: 'success',
          message: 'Maklumat profil organisasi telah berjaya disimpan dan dikemaskini!',
        });
        setTimeout(() => {
          setSaveStatus({ type: null, message: '' });
        }, 5000);
      } else {
        setSaveStatus({
          type: 'error',
          message: 'Gagal mengemaskini profil. Sila periksa sambungan internet atau cuba sebentar lagi.',
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Ralat semasa menyimpan profil organisasi.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyNotice(`Tersalin: ${label}`);
    setTimeout(() => {
      setCopyNotice(null);
    }, 3000);
  };

  const copyFullSummary = () => {
    const summary = [
      `SYARIKAT: ${formData.companyName || 'Yayasan Chow Kit'}`,
      formData.registrationNumber ? `NO. DAFTAR (SSM/ROS): ${formData.registrationNumber}` : null,
      formData.phone ? `TEL: ${formData.phone}` : null,
      formData.whatsapp ? `WHATSAPP: ${formData.whatsapp}` : null,
      formData.email ? `EMEL: ${formData.email}` : null,
      formData.website ? `LAMAN WEB: ${formData.website}` : null,
      formData.address ? `ALAMAT: ${formData.address}${formData.postcode ? ', ' + formData.postcode : ''}${formData.city ? ' ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}` : null,
      formData.picName ? `PIC: ${formData.picName} (${formData.picPhone || 'Tiada No.'})` : null,
      formData.description ? `CATATAN: ${formData.description}` : null,
    ].filter(Boolean).join('\n');

    copyToClipboard(summary, 'Ringkasan Penuh Profil');
  };

  const handlePrint = () => {
    window.print();
  };

  const malaysianStates = [
    'Wilayah Persekutuan Kuala Lumpur',
    'Wilayah Persekutuan Putrajaya',
    'Wilayah Persekutuan Labuan',
    'Selangor',
    'Johor',
    'Kedah',
    'Kelantan',
    'Melaka',
    'Negeri Sembilan',
    'Pahang',
    'Perak',
    'Perlis',
    'Pulau Pinang',
    'Sabah',
    'Sarawak',
    'Terengganu'
  ];

  // Clean WhatsApp phone number for link (e.g. removes +, -, spaces and prefixes with 60)
  const cleanWhatsAppNumber = (rawPhone?: string) => {
    if (!rawPhone) return '';
    let digits = rawPhone.replace(/\D/g, '');
    if (digits.startsWith('0')) {
      digits = '60' + digits.substring(1);
    } else if (digits.startsWith('60')) {
      // already ok
    } else if (digits.length > 0) {
      digits = '60' + digits;
    }
    return digits;
  };

  const formattedAddressForMaps = encodeURIComponent(
    `${formData.address || ''} ${formData.postcode || ''} ${formData.city || ''} ${formData.state || ''}`.trim()
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-blue-900 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-600/60 text-xs font-semibold uppercase tracking-wider text-indigo-100">
              <BuildingOfficeIcon className="w-4 h-4" />
              <span>Profil Organisasi & Syarikat</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              {formData.companyName || 'Maklumat Profil Organisasi'}
            </h2>
            <p className="text-indigo-200 text-sm max-w-2xl">
              Urus butiran rasmi organisasi, nombor perhubungan, alamat berdaftar, dan pegawai PIC. Maklumat ini disegerakkan secara berpusat dan digunapakai untuk semua dokumen rasmi, surat kebenaran, dan laporan armada.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            {/* Lock Status Pill */}
            <div className={`px-4 py-2.5 rounded-xl border backdrop-blur-md flex items-center gap-2 text-sm font-medium shadow-sm ${
              isEditing 
                ? 'bg-amber-500/20 border-amber-400/40 text-amber-100' 
                : 'bg-emerald-500/20 border-emerald-400/40 text-emerald-100'
            }`}>
              {isEditing ? (
                <>
                  <LockOpenIcon className="w-4 h-4 text-amber-300 animate-pulse" />
                  <span>Mod Suntingan Aktif</span>
                </>
              ) : (
                <>
                  <LockClosedIcon className="w-4 h-4 text-emerald-300" />
                  <span>Mod Terkunci (Disimpan)</span>
                </>
              )}
            </div>

            {/* Quick Action to Toggle Edit Mode */}
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white text-indigo-900 font-semibold text-sm hover:bg-indigo-50 shadow-md hover:shadow-lg transition active:scale-95"
              >
                <EditIcon className="w-4 h-4 mr-2 text-indigo-700" />
                Kemaskini / Edit Profil
              </button>
            ) : (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/20 transition active:scale-95"
              >
                Kunci Semula / Batal
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Copy / Action Notice Toast */}
      {copyNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-bounce">
          <ClipboardCheckIcon className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="text-sm font-medium">{copyNotice}</span>
        </div>
      )}

      {/* Alert Notification */}
      {saveStatus.type && (
        <div 
          className={`p-4 rounded-xl flex items-center gap-3 transition-all ${
            saveStatus.type === 'success' 
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {saveStatus.type === 'success' ? (
            <CheckCircleIcon className="w-6 h-6 text-emerald-600 flex-shrink-0" />
          ) : (
            <DocumentTextIcon className="w-6 h-6 text-red-600 flex-shrink-0" />
          )}
          <div className="flex-1">
            <span className="text-sm font-semibold block">
              {saveStatus.type === 'success' ? 'Berjaya Disimpan' : 'Ralat Penyimpanan'}
            </span>
            <span className="text-xs text-gray-700">{saveStatus.message}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Top Edit State Indicator Bar */}
            <div className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              isEditing 
                ? 'bg-amber-50 border-amber-200 text-amber-900' 
                : 'bg-slate-50 border-slate-200 text-slate-700'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${isEditing ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                  {isEditing ? <LockOpenIcon className="w-5 h-5" /> : <LockClosedIcon className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-sm font-bold">
                    {isEditing ? 'Borang Dibuka Untuk Suntingan' : 'Borang Dalam Keadaan Terkunci'}
                  </h4>
                  <p className="text-xs opacity-80">
                    {isEditing 
                      ? 'Anda boleh mengubah maklumat di bawah. Tekan butang "Simpan Profil Syarikat" untuk mengunci dan menyimpan ke pangkalan data.' 
                      : 'Data telah disimpan dengan selamat. Tekan butang "Kemaskini / Edit" jika anda ingin membuat sebarang perubahan.'}
                  </p>
                </div>
              </div>

              {!isEditing ? (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition active:scale-95 flex-shrink-0"
                >
                  <EditIcon className="w-3.5 h-3.5 mr-1.5" />
                  Buka Kunci Untuk Edit
                </button>
              ) : (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-xs font-medium transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex items-center px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition disabled:opacity-50"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5 mr-1.5" />
                    {isSaving ? 'Menyimpan...' : 'Simpan Sekarang'}
                  </button>
                </div>
              )}
            </div>

            {/* Section 1: Maklumat Asas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-900">Maklumat Asas Syarikat & Organisasi</h3>
                </div>
                {!isEditing && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <LockClosedIcon className="w-3.5 h-3.5" /> Terkunci
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Nama Penuh Syarikat / Pertubuhan <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="companyName"
                    value={formData.companyName || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    required
                    placeholder="cth. Yayasan Chow Kit / Syarikat Pengangkutan Logistik Sdn Bhd"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 font-medium cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Pendaftaran (SSM / ROS / Pertubuhan)
                  </label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. PPM-012-14-11012011 / 202301012345"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 font-mono cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Laman Web Rasmi (Website URL)
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. https://www.yck.org.my"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Penerangan Ringkas / Objektif Operasi
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    value={formData.description || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. Pusat perlindungan & perkhidmatan kebajikan kanak-kanak dan keluarga."
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Maklumat Perhubungan Rasmi */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <PhoneIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-900">Maklumat Perhubungan Rasmi</h3>
                </div>
                {!isEditing && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <LockClosedIcon className="w-3.5 h-3.5" /> Terkunci
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Telefon Pejabat
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. +603-4045 5550"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Hotline / WhatsApp
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. +6012-3456789"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Emel Rasmi Organisasi
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. info@yck.org.my"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Alamat Ibu Pejabat */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <LocationMarkerIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-900">Alamat Ibu Pejabat & Lokasi Operasi</h3>
                </div>
                {!isEditing && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <LockClosedIcon className="w-3.5 h-3.5" /> Terkunci
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Alamat Lengkap (Jalan, Blok, Bangunan)
                  </label>
                  <textarea
                    name="address"
                    rows={2}
                    value={formData.address || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. No. 22B, Jalan Chow Kit"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Poskod
                  </label>
                  <input
                    type="text"
                    name="postcode"
                    maxLength={5}
                    value={formData.postcode || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. 50350"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 font-mono cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Bandar
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. Kuala Lumpur"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Negeri
                  </label>
                  <select
                    name="state"
                    value={formData.state || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  >
                    <option value="">Pilih Negeri</option>
                    {malaysianStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Pegawai Bertugas (PIC) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <div className="flex items-center gap-2">
                  <UserCircleIcon className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-base font-semibold text-gray-900">Pegawai Dihubungi (Person In Charge - PIC)</h3>
                </div>
                {!isEditing && (
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <LockClosedIcon className="w-3.5 h-3.5" /> Terkunci
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Nama Pegawai / PIC
                  </label>
                  <input
                    type="text"
                    name="picName"
                    value={formData.picName || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. En. Syafiq (Pengurus Pengangkutan)"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Telefon Bimbit PIC
                  </label>
                  <input
                    type="tel"
                    name="picPhone"
                    value={formData.picPhone || ''}
                    onChange={handleChange}
                    disabled={!isEditing}
                    placeholder="cth. +6012-3456789"
                    className={`w-full px-3.5 py-2.5 rounded-lg border text-sm transition ${
                      !isEditing 
                        ? 'bg-gray-50/70 border-gray-200 text-gray-800 cursor-not-allowed' 
                        : 'bg-white border-gray-300 text-gray-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <div>
                {!isEditing ? (
                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition active:scale-95"
                  >
                    <EditIcon className="w-4 h-4 mr-2" />
                    Buka Borang & Edit Profil
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    className="inline-flex items-center px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-sm transition active:scale-95"
                  >
                    Batal Perubahan
                  </button>
                )}
              </div>

              {isEditing && (
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Menyimpan Maklumat...
                    </>
                  ) : (
                    <>
                      <CheckCircleIcon className="w-5 h-5 mr-2" />
                      Simpan & Kunci Profil
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Live Preview / Summary Card (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6 space-y-6">
            
            {/* Preview Card Header */}
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4 text-indigo-600" />
                Kad Pratonton Profil Rasmi
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Terkini & Aktif
              </span>
            </div>

            {/* Main Visual Profile Box */}
            <div className="space-y-4">
              <div className="p-5 bg-gradient-to-br from-slate-50 to-indigo-50/40 rounded-xl border border-indigo-100 space-y-2 relative overflow-hidden">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded">
                      Entiti Organisasi
                    </span>
                    <h4 className="font-bold text-gray-900 text-lg leading-snug">
                      {formData.companyName || 'Yayasan Chow Kit'}
                    </h4>
                  </div>
                  <div className="p-2 bg-white rounded-lg shadow-sm border border-indigo-100 text-indigo-600">
                    <BuildingOfficeIcon className="w-5 h-5" />
                  </div>
                </div>

                {formData.registrationNumber && (
                  <div className="flex items-center justify-between bg-white/80 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs">
                    <span className="text-gray-500 font-mono text-[11px]">
                      No. Daftar: {formData.registrationNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(formData.registrationNumber!, 'No. Pendaftaran')}
                      className="text-[10px] font-semibold text-indigo-600 hover:text-indigo-800"
                    >
                      Salin
                    </button>
                  </div>
                )}

                {formData.description && (
                  <p className="text-xs text-gray-600 leading-relaxed italic pt-1">
                    "{formData.description}"
                  </p>
                )}
              </div>

              {/* Detailed Contact List */}
              <div className="space-y-3 text-xs text-gray-600 divide-y divide-gray-100">
                
                {/* Phone & WhatsApp */}
                <div className="pt-2 flex items-start gap-3">
                  <PhoneIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                      Talian Perhubungan
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-gray-900">{formData.phone || 'Tiada No. Telefon'}</span>
                      {formData.phone && (
                        <a 
                          href={`tel:${formData.phone}`} 
                          className="text-[11px] font-semibold text-indigo-600 hover:underline"
                        >
                          Panggil
                        </a>
                      )}
                    </div>
                    {formData.whatsapp && (
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-emerald-700 font-medium flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          WA: {formData.whatsapp}
                        </span>
                        <a 
                          href={`https://wa.me/${cleanWhatsAppNumber(formData.whatsapp)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold hover:bg-emerald-200 transition"
                        >
                          Chat WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                <div className="pt-3 flex items-start gap-3">
                  <MailIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                      Emel Rasmi
                    </span>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-900 font-medium break-all">{formData.email || 'Tiada Emel Diisi'}</span>
                      {formData.email && (
                        <a 
                          href={`mailto:${formData.email}`} 
                          className="text-[11px] font-semibold text-indigo-600 hover:underline ml-2"
                        >
                          Hantar
                        </a>
                      )}
                    </div>
                  </div>
                </div>

                {/* Website */}
                {formData.website && (
                  <div className="pt-3 flex items-start gap-3">
                    <GlobeAltIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                        Laman Web
                      </span>
                      <a 
                        href={formData.website} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline break-all font-medium block"
                      >
                        {formData.website}
                      </a>
                    </div>
                  </div>
                )}

                {/* Address */}
                <div className="pt-3 flex items-start gap-3">
                  <LocationMarkerIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="flex-1 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 block">
                      Alamat Pejabat
                    </span>
                    <p className="text-gray-800 leading-relaxed font-medium">
                      {formData.address 
                        ? `${formData.address}${formData.postcode ? ', ' + formData.postcode : ''}${formData.city ? ' ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}`
                        : 'Tiada alamat diisi'}
                    </p>
                    {formData.address && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${formattedAddressForMaps}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center text-[11px] font-semibold text-indigo-600 hover:underline pt-0.5"
                      >
                        📍 Buka di Google Maps
                      </a>
                    )}
                  </div>
                </div>

                {/* PIC */}
                {formData.picName && (
                  <div className="pt-3 flex items-start gap-3 bg-indigo-50/50 p-3 rounded-xl border border-indigo-100/60">
                    <UserCircleIcon className="w-5 h-5 text-indigo-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <span className="text-[10px] uppercase font-bold text-indigo-700 block">
                        Pegawai Bertugas (PIC)
                      </span>
                      <span className="font-bold text-gray-900 block text-xs">{formData.picName}</span>
                      {formData.picPhone && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-gray-600 font-mono text-xs">{formData.picPhone}</span>
                          <a 
                            href={`tel:${formData.picPhone}`}
                            className="text-[10px] font-semibold text-indigo-600 hover:underline"
                          >
                            Hubungi
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Preview Action Buttons */}
            <div className="pt-2 border-t border-gray-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={copyFullSummary}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs transition active:scale-95"
              >
                <ClipboardCheckIcon className="w-4 h-4 mr-2 text-slate-600" />
                Salin Ringkasan Profil
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs transition active:scale-95"
              >
                <PrinterIcon className="w-4 h-4 mr-2 text-indigo-600" />
                Cetak Kad Profil Syarikat
              </button>
            </div>

            {/* Note */}
            <div className="p-3 bg-indigo-50/70 rounded-xl text-[11px] text-indigo-800 leading-relaxed border border-indigo-100">
              💡 Maklumat profil ini disimpan secara selamat di awan dan digunakan secara automatik dalam cetakan surat, laporan logistik, dan pengesahan tempahan.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
