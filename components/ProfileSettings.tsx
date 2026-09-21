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
  SparklesIcon
} from './icons/Icons';

export const ProfileSettings: React.FC = () => {
  const { activeTenant, updateTenantProfile } = useAppContext();

  // Form state
  const [formData, setFormData] = useState<Partial<Tenant>>({
    companyName: '',
    registrationNumber: '',
    description: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    address: '',
    postcode: '',
    city: '',
    state: '',
    picName: '',
    picPhone: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({
    type: null,
    message: '',
  });

  useEffect(() => {
    if (activeTenant) {
      setFormData({
        companyName: activeTenant.companyName || activeTenant.name || '',
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
  }, [activeTenant]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
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
        setSaveStatus({
          type: 'success',
          message: 'Maklumat profil syarikat / organisasi telah berjaya disimpan dan dikemaskini!',
        });
        setTimeout(() => {
          setSaveStatus({ type: null, message: '' });
        }, 5000);
      } else {
        setSaveStatus({
          type: 'error',
          message: 'Gagal mengemaskini profil. Sila cuba sebentar lagi.',
        });
      }
    } catch (err: any) {
      setSaveStatus({
        type: 'error',
        message: err.message || 'Ralat semasa menyimpan profil.',
      });
    } finally {
      setIsSaving(false);
    }
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
              Kemaskini butiran entiti perniagaan, nombor telefon rasmi, alamat ibu pejabat, dan pegawai bertugas untuk rekod sistem pengurusan logistik.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20 text-right">
              <span className="text-xs text-indigo-200 block uppercase font-medium">Tenant ID</span>
              <span className="font-mono text-sm font-bold text-white">{activeTenant?.id || 'yayasan-chow-kit'}</span>
            </div>
          </div>
        </div>
      </div>

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
          <span className="text-sm font-medium">{saveStatus.message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Form (2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Section 1: Maklumat Asas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <BuildingOfficeIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-900">Maklumat Asas Syarikat</h3>
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
                    required
                    placeholder="cth. Yayasan Chow Kit / Syarikat Pengangkutan Sdn Bhd"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Pendaftaran Syarikat / SSM / ROS
                  </label>
                  <input
                    type="text"
                    name="registrationNumber"
                    value={formData.registrationNumber || ''}
                    onChange={handleChange}
                    placeholder="cth. 202301012345 (123456-X) / PPM-012"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Laman Web Rasmi / Portal
                  </label>
                  <input
                    type="url"
                    name="website"
                    value={formData.website || ''}
                    onChange={handleChange}
                    placeholder="https://www.syarikatanda.com"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Penerangan / Slogan Ringkas
                  </label>
                  <textarea
                    name="description"
                    rows={2}
                    value={formData.description || ''}
                    onChange={handleChange}
                    placeholder="Keterangan fungsi organisasi atau perkhidmatan logistik..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Maklumat Perhubungan Rasmi */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <PhoneIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-900">Maklumat Perhubungan</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. Telefon Pejabat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    required
                    placeholder="cth. +603-4045 5550"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    No. WhatsApp Rasmi
                  </label>
                  <input
                    type="tel"
                    name="whatsapp"
                    value={formData.whatsapp || ''}
                    onChange={handleChange}
                    placeholder="cth. +6012-3456789"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Emel Rasmi Organisasi <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email || ''}
                    onChange={handleChange}
                    required
                    placeholder="info@syarikat.com.my"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Section 3: Alamat Pejabat / Premis */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <LocationMarkerIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-900">Alamat Premis / Ibu Pejabat</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-3">
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Alamat Lengkap <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="address"
                    rows={2}
                    value={formData.address || ''}
                    onChange={handleChange}
                    required
                    placeholder="No. Unit, Bangunan, Jalan..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                    Poskod
                  </label>
                  <input
                    type="text"
                    name="postcode"
                    value={formData.postcode || ''}
                    onChange={handleChange}
                    placeholder="50350"
                    maxLength={10}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                    placeholder="Kuala Lumpur"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition bg-white"
                  >
                    <option value="">-- Pilih Negeri --</option>
                    {malaysianStates.map(st => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Pegawai Bertugas (PIC) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                <UserCircleIcon className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-semibold text-gray-900">Pegawai Dihubungi (Person In Charge - PIC)</h3>
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
                    placeholder="cth. En. Syafiq (Pengurus Pengangkutan)"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
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
                    placeholder="cth. +6012-3456789"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
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
                    Simpan Profil Syarikat
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Live Preview / Summary Card (1 Col) */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 sticky top-6 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 flex items-center gap-1.5">
                <SparklesIcon className="w-4 h-4" />
                Kad Pratonton Profil
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                Aktif
              </span>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
                <h4 className="font-bold text-gray-900 text-base leading-snug">
                  {formData.companyName || 'Nama Syarikat Anda'}
                </h4>
                {formData.registrationNumber && (
                  <p className="text-xs text-gray-500 font-mono">
                    No. Daftar: {formData.registrationNumber}
                  </p>
                )}
                {formData.description && (
                  <p className="text-xs text-gray-600 mt-2 leading-relaxed italic">
                    "{formData.description}"
                  </p>
                )}
              </div>

              <div className="space-y-2.5 text-xs text-gray-600">
                <div className="flex items-start gap-2.5">
                  <PhoneIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-gray-800">{formData.phone || 'Tiada No. Telefon'}</span>
                    {formData.whatsapp && (
                      <span className="text-emerald-600 block">WA: {formData.whatsapp}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-2.5">
                  <MailIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-800 break-all">{formData.email || 'Tiada Emel'}</span>
                </div>

                {formData.website && (
                  <div className="flex items-start gap-2.5">
                    <GlobeAltIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <a 
                      href={formData.website} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-indigo-600 hover:underline break-all"
                    >
                      {formData.website}
                    </a>
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <LocationMarkerIcon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 leading-relaxed">
                    {formData.address 
                      ? `${formData.address}${formData.postcode ? ', ' + formData.postcode : ''}${formData.city ? ' ' + formData.city : ''}${formData.state ? ', ' + formData.state : ''}`
                      : 'Tiada alamat diisi'}
                  </span>
                </div>

                {formData.picName && (
                  <div className="pt-3 border-t border-gray-100 flex items-start gap-2.5">
                    <UserCircleIcon className="w-4 h-4 text-indigo-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="text-gray-500 block text-[10px] uppercase font-semibold">Pegawai PIC</span>
                      <span className="font-semibold text-gray-800">{formData.picName}</span>
                      {formData.picPhone && <span className="text-gray-500 block">{formData.picPhone}</span>}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-indigo-50/70 rounded-xl text-[11px] text-indigo-800 leading-relaxed">
              💡 Maklumat profil ini digunakan dalam cetakan laporan logistik, pengesahan jadual pemandu, dan integrasi invois/surat tempahan rasmi.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
