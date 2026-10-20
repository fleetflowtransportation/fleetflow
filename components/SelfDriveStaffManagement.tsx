import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { storageService } from '../services/storage';
import { SelfDriveStaff, DEPARTMENTS } from '../types';
import { uploadToGoogleDrive } from '../services/googleDrive';
import { 
  UsersIcon, 
  PlusIcon, 
  TrashIcon, 
  PencilIcon, 
  PaperClipIcon, 
  CheckCircleIcon,
  SearchIcon,
  XIcon,
  ExternalLinkIcon,
  QrCodeIcon,
  DocumentTextIcon
} from './icons/Icons';

export const SelfDriveStaffManagement: React.FC = () => {
  const { selfDriveStaff, addSelfDriveStaff, updateSelfDriveStaff, deleteSelfDriveStaff, activeTenant } = useAppContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDept, setFilterDept] = useState('ALL');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<SelfDriveStaff | null>(null);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  
  // Form fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState(DEPARTMENTS[0] || 'Program');
  const [icNumber, setIcNumber] = useState('');
  const [licenseExpiry, setLicenseExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  
  // Attachment state
  const [icFile, setIcFile] = useState<File | null>(null);
  const [existingIcName, setExistingIcName] = useState<string | undefined>();
  const [existingIcUrl, setExistingIcUrl] = useState<string | undefined>();
  
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [existingLicenseName, setExistingLicenseName] = useState<string | undefined>();
  const [existingLicenseUrl, setExistingLicenseUrl] = useState<string | undefined>();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rawTenantId = activeTenant?.id || storageService.getTenantId();
  const tenantId = (!rawTenantId || rawTenantId === 'yayasan-chow-kit-demo' || rawTenantId === 'yayasan-chow-kit')
    ? 'yck'
    : rawTenantId;
  const publicOdometerUrl = `${window.location.origin}/?action=odometer&tenant_id=${encodeURIComponent(tenantId)}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicOdometerUrl)}`;

  const staffList = useMemo(() => {
    return (selfDriveStaff || []).filter(staff => {
      const matchesSearch =
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.icNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (staff.department || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDept = filterDept === 'ALL' || staff.department === filterDept;
      return matchesSearch && matchesDept;
    });
  }, [selfDriveStaff, searchQuery, filterDept]);

  // License expiry alerts
  const { expiredLicenses, expiringSoonLicenses } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);

    const expired: SelfDriveStaff[] = [];
    const soon: SelfDriveStaff[] = [];

    (selfDriveStaff || []).forEach((s) => {
      if (!s.licenseExpiry || s.status !== 'active') return;
      const exp = new Date(s.licenseExpiry);
      if (Number.isNaN(exp.getTime())) return;
      if (exp < today) expired.push(s);
      else if (exp <= in30) soon.push(s);
    });

    return { expiredLicenses: expired, expiringSoonLicenses: soon };
  }, [selfDriveStaff]);

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setName('');
    setPhone('');
    setDepartment(DEPARTMENTS[0] || 'Program');
    setIcNumber('');
    setLicenseExpiry('');
    setNotes('');
    setStatus('active');
    setIcFile(null);
    setExistingIcName(undefined);
    setExistingIcUrl(undefined);
    setLicenseFile(null);
    setExistingLicenseName(undefined);
    setExistingLicenseUrl(undefined);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (staff: SelfDriveStaff) => {
    setEditingStaff(staff);
    setName(staff.name);
    setPhone(staff.phone);
    setDepartment(staff.department || DEPARTMENTS[0] || 'Program');
    setIcNumber(staff.icNumber);
    setLicenseExpiry(staff.licenseExpiry || '');
    setNotes(staff.notes || '');
    setStatus(staff.status);
    setIcFile(null);
    setExistingIcName(staff.icAttachmentName);
    setExistingIcUrl(staff.icAttachmentUrl);
    setLicenseFile(null);
    setExistingLicenseName(staff.licenseAttachmentName);
    setExistingLicenseUrl(staff.licenseAttachmentUrl);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCopyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicOdometerUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    } catch {
      const el = document.createElement('textarea');
      el.value = publicOdometerUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 3000);
    }
  };

  // Upload IC / License to Google Drive (Supabase stores URL only)
  const processUpload = async (
    file: File,
    kind: 'ic' | 'license',
    staffName: string
  ): Promise<{ url: string; name: string }> => {
    const safeName = (staffName || 'staff').replace(/[^\w\-]+/g, '_').slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const customFileName = `${dateStr}_${safeName}_${kind}_${file.name}`;

    const res = await uploadToGoogleDrive(file, {
      folderName: 'self_drive_staff',
      folderPath: ['Self-Drive Staff', safeName],
      fileName: customFileName,
      tenant: activeTenant,
    });

    if (!res.success || !res.url) {
      throw new Error(
        res.error ||
          `Failed to upload ${kind === 'ic' ? 'IC' : 'Driving License'} to Google Drive. Check Settings > Integrations (Google Apps Script URL & Drive Folder).`
      );
    }

    return {
      url: res.webViewLink || res.url,
      name: res.name || customFileName,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name.trim() || !phone.trim() || !icNumber.trim() || !department.trim()) {
      setFormError('Please fill in all required fields (Name, Phone, Department, and IC Number).');
      return;
    }

    setIsSaving(true);
    setIsUploading(true);

    try {
      let finalIcUrl = existingIcUrl;
      let finalIcName = existingIcName;
      if (icFile) {
        const res = await processUpload(icFile, 'ic', name.trim());
        finalIcUrl = res.url;
        finalIcName = res.name;
      }

      let finalLicenseUrl = existingLicenseUrl;
      let finalLicenseName = existingLicenseName;
      if (licenseFile) {
        const res = await processUpload(licenseFile, 'license', name.trim());
        finalLicenseUrl = res.url;
        finalLicenseName = res.name;
      }

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        department: department.trim(),
        icNumber: icNumber.trim(),
        licenseExpiry: licenseExpiry || undefined,
        notes: notes.trim() || undefined,
        status,
        icAttachmentName: finalIcName,
        icAttachmentUrl: finalIcUrl,
        licenseAttachmentName: finalLicenseName,
        licenseAttachmentUrl: finalLicenseUrl,
      };

      if (editingStaff) {
        await updateSelfDriveStaff(editingStaff.id, payload);
      } else {
        await addSelfDriveStaff(payload);
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving staff details.');
    } finally {
      setIsSaving(false);
      setIsUploading(false);
    }
  };

  const handleDelete = async (staff: SelfDriveStaff) => {
    if (window.confirm(`Are you sure you want to remove authorized self-drive staff "${staff.name}"?`)) {
      await deleteSelfDriveStaff(staff.id);
    }
  };

  const formatExpiryBadge = (expiry?: string) => {
    if (!expiry) return <span className="text-xs text-slate-400">No expiry set</span>;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiry);
    if (Number.isNaN(exp.getTime())) return <span className="text-xs text-slate-400">{expiry}</span>;
    if (exp < today) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Expired {expiry}</span>;
    }
    const in30 = new Date(today);
    in30.setDate(in30.getDate() + 30);
    if (exp <= in30) {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Expiring {expiry}</span>;
    }
    return <span className="text-xs text-slate-600 font-medium">{expiry}</span>;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Public Odometer Link & QR Code Access */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-800">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <span>🚗</span>
              <span>Self-Drive Odometer Portal</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Authorized Self-Drive Documentation & QR Odometer
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Maintain official staff documentation (IC and driving license records) without registering staff as regular drivers. Staff can easily record trip odometers by scanning the vehicle&apos;s QR code.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleCopyPublicLink}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition flex items-center gap-2 border border-white/20 cursor-pointer shadow-xs active:scale-95"
            >
              {copiedLink ? (
                <>
                  <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300 font-extrabold">Link Copied!</span>
                </>
              ) : (
                <>
                  <ExternalLinkIcon className="w-4 h-4 text-indigo-300" />
                  <span>Copy Odometer Link</span>
                </>
              )}
            </button>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm cursor-pointer active:scale-95"
            >
              <QrCodeIcon className="w-4 h-4" />
              <span>View & Print QR Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* License Expiry Alerts */}
      {(expiredLicenses.length > 0 || expiringSoonLicenses.length > 0) && (
        <div className="space-y-2">
          {expiredLicenses.length > 0 && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              <div className="font-bold mb-1">⚠️ Driving License Expired — Request New License</div>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                {expiredLicenses.map((s) => (
                  <li key={s.id}>
                    <strong>{s.name}</strong>
                    {s.department ? ` (${s.department})` : ''} — expired on <strong>{s.licenseExpiry}</strong>. Please request an updated driving license.
                  </li>
                ))}
              </ul>
            </div>
          )}
          {expiringSoonLicenses.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <div className="font-bold mb-1">⏰ Driving License Expiring Within 30 Days</div>
              <ul className="list-disc pl-5 space-y-0.5 text-xs">
                {expiringSoonLicenses.map((s) => (
                  <li key={s.id}>
                    <strong>{s.name}</strong>
                    {s.department ? ` (${s.department})` : ''} — expires on <strong>{s.licenseExpiry}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Main Content Card: Staff Table & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Authorized Self-Drive Staff</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {selfDriveStaff.length} staff registered · Documents stored on Google Drive
            </p>
          </div>
          <button
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer self-start sm:self-auto"
          >
            <PlusIcon className="w-4 h-4" />
            <span>Add Authorized Staff</span>
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, IC, department..."
              className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
          >
            <option value="ALL">All Departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">IC / Phone</th>
                <th className="px-4 py-3">Documents</th>
                <th className="px-4 py-3">License Expiry</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staffList.length > 0 ? (
                staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-4 py-3.5 font-semibold text-gray-900">{staff.name}</td>
                    <td className="px-4 py-3.5 text-gray-600">{staff.department || '—'}</td>
                    <td className="px-4 py-3.5 text-gray-600">
                      <div className="text-xs font-mono">{staff.icNumber}</div>
                      <div className="text-xs text-gray-500">{staff.phone}</div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1">
                        {staff.icAttachmentUrl ? (
                          <a
                            href={staff.icAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <PaperClipIcon className="w-3.5 h-3.5" />
                            IC
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No IC file</span>
                        )}
                        {staff.licenseAttachmentUrl ? (
                          <a
                            href={staff.licenseAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
                          >
                            <DocumentTextIcon className="w-3.5 h-3.5" />
                            License
                          </a>
                        ) : (
                          <span className="text-xs text-gray-400">No license file</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">{formatExpiryBadge(staff.licenseExpiry)}</td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        staff.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-gray-100 text-gray-600'
                      }`}>
                        {staff.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-2">
                      <button
                        onClick={() => handleOpenEditModal(staff)}
                        className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition cursor-pointer"
                        title="Edit Staff Details"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(staff)}
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                        title="Delete Record"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-gray-600">No Authorized Staff Found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Click &quot;Add Authorized Staff&quot; above to register new self-drive documentation.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: ADD / EDIT STAFF */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden max-h-[92vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 sticky top-0 z-10">
              <h3 className="font-bold text-gray-900 text-base">
                {editingStaff ? 'Edit Authorized Staff' : 'Add Authorized Self-Drive Staff'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs sm:text-sm">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold border border-rose-200">
                  ⚠️ {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ahmad bin Ali"
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Phone Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+6012-3456789"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Department <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                  >
                    {DEPARTMENTS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    IC Number <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="e.g. 900101-14-5678"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Driving License Expiry Date
                  </label>
                  <input
                    type="date"
                    value={licenseExpiry}
                    onChange={(e) => setLicenseExpiry(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-500">
                    Admin akan dapat alert bila lesen hampir / sudah tamat tempoh.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* IC Attachment */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Attachment IC
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setIcFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:cursor-pointer"
                />
                {(icFile || existingIcName) && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {icFile ? `Selected: ${icFile.name}` : `Current: ${existingIcName}`}
                    {existingIcUrl && !icFile && (
                      <> · <a href={existingIcUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View on Drive</a></>
                    )}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">Files will be securely uploaded to Google Drive. The database stores the document link only.</p>
              </div>

              {/* License Attachment */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Attachment Driving License
                </label>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setLicenseFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-gray-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:cursor-pointer"
                />
                {(licenseFile || existingLicenseName) && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    {licenseFile ? `Selected: ${licenseFile.name}` : `Current: ${existingLicenseName}`}
                    {existingLicenseUrl && !licenseFile && (
                      <> · <a href={existingLicenseUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">View on Drive</a></>
                    )}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">Files will be securely uploaded to Google Drive. The database stores the document link only.</p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Internal Notes / Remarks (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Authorized to drive Perodua Alza for official community programs."
                  className="w-full px-3.5 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-sm transition disabled:bg-indigo-300 cursor-pointer flex items-center gap-2"
                >
                  {isSaving ? 'Saving & Uploading to Drive...' : (editingStaff ? 'Save Changes' : 'Register Staff')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE PREVIEW & PRINT */}
      {isQrModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden text-center p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm">
                <QrCodeIcon className="w-5 h-5" />
                <span>Self-Drive Odometer QR Code</span>
              </div>
              <button 
                onClick={() => setIsQrModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <XIcon className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-gray-600 leading-relaxed">
              Place this QR Code inside the vehicle (e.g. on the Alza dashboard or key fob tag). Staff can scan this code using their phone camera to immediately log Start and End trip odometers without logging in.
            </p>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl inline-block mx-auto">
              <img 
                src={qrCodeApiUrl} 
                alt="Self Drive Odometer QR Code"
                className="w-52 h-52 mx-auto rounded-lg shadow-2xs"
              />
            </div>

            <div className="p-3 bg-slate-100 rounded-xl text-[11px] font-mono text-slate-700 break-all select-all text-left">
              {publicOdometerUrl}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={handleCopyPublicLink}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                {copiedLink ? 'Link Copied!' : 'Copy Portal URL'}
              </button>
              <a
                href={qrCodeApiUrl}
                download="self-drive-odometer-qr.png"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                Download QR Code
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SelfDriveStaffManagement;
