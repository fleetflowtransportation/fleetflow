import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { SelfDriveStaff, DEPARTMENTS } from '../types';
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

  const tenantId = activeTenant?.id || 'yayasan-chow-kit';
  const publicOdometerUrl = `${window.location.origin}/?action=odometer&tenant_id=${tenantId}`;
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(publicOdometerUrl)}`;

  const filteredStaff = useMemo(() => {
    return selfDriveStaff.filter(staff => {
      const matchesSearch = 
        staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.phone.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.icNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        staff.department.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesDept = filterDept === 'ALL' || staff.department === filterDept;
      return matchesSearch && matchesDept;
    });
  }, [selfDriveStaff, searchQuery, filterDept]);

  const handleOpenAddModal = () => {
    setEditingStaff(null);
    setName('');
    setPhone('');
    setDepartment(DEPARTMENTS[0] || 'Program');
    setIcNumber('');
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
    setDepartment(staff.department);
    setIcNumber(staff.icNumber);
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
      // fallback
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

  // Helper to upload single file to Google Drive or fallback to Base64
  const processUpload = async (file: File): Promise<{ url: string; name: string }> => {
    const driveUrl = activeTenant?.googleAppsScriptUrl || (import.meta as any).env?.VITE_GOOGLE_SCRIPT_UPLOAD_URL;
    if (driveUrl) {
      try {
        const base64Str = await fileToBase64(file);
        const response = await fetch(driveUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            base64: base64Str,
            fileName: file.name,
            mimeType: file.type
          })
        });
        const resText = await response.text();
        const resJson = JSON.parse(resText);
        if (resJson && resJson.success && resJson.url) {
          return { url: resJson.url, name: file.name };
        }
      } catch (err) {
        console.warn('Google Drive direct upload fallback to local storage:', err);
      }
    }
    
    // Fallback storage
    if (file.size < 800 * 1024) {
      try {
        const base64Str = await fileToBase64(file);
        return { url: `data:${file.type};base64,${base64Str}`, name: file.name };
      } catch {
        return { url: URL.createObjectURL(file), name: file.name };
      }
    }
    return { url: URL.createObjectURL(file), name: file.name };
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
        const res = await processUpload(icFile);
        finalIcUrl = res.url;
        finalIcName = res.name;
      }

      let finalLicenseUrl = existingLicenseUrl;
      let finalLicenseName = existingLicenseName;
      if (licenseFile) {
        const res = await processUpload(licenseFile);
        finalLicenseUrl = res.url;
        finalLicenseName = res.name;
      }

      if (editingStaff) {
        await updateSelfDriveStaff(editingStaff.id, {
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          icNumber: icNumber.trim(),
          notes: notes.trim() || undefined,
          status,
          icAttachmentName: finalIcName,
          icAttachmentUrl: finalIcUrl,
          licenseAttachmentName: finalLicenseName,
          licenseAttachmentUrl: finalLicenseUrl,
        });
      } else {
        await addSelfDriveStaff({
          name: name.trim(),
          phone: phone.trim(),
          department: department.trim(),
          icNumber: icNumber.trim(),
          notes: notes.trim() || undefined,
          status,
          icAttachmentName: finalIcName,
          icAttachmentUrl: finalIcUrl,
          licenseAttachmentName: finalLicenseName,
          licenseAttachmentUrl: finalLicenseUrl,
        });
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
              Maintain official staff documentation (IC and driving license records) without registering staff as regular drivers. Staff can easily record trip odometers by scanning the vehicle's QR code.
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

      {/* Main Content Card: Staff Table & Controls */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 sm:p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Authorized Self-Drive Staff</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {selfDriveStaff.length} staff member{selfDriveStaff.length === 1 ? '' : 's'} registered with valid driving documentation
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

        {/* Filters & Search */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <SearchIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search staff name, phone, IC, or department..."
              className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
          </div>

          <div className="w-full sm:w-auto">
            <select
              value={filterDept}
              onChange={(e) => setFilterDept(e.target.value)}
              className="w-full sm:w-48 px-3 py-2.5 text-xs sm:text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-white font-medium"
            >
              <option value="ALL">All Departments</option>
              {DEPARTMENTS.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="w-full text-left text-xs sm:text-sm text-gray-700">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Staff Name & Contact</th>
                <th className="px-4 py-3">Department</th>
                <th className="px-4 py-3">IC Number</th>
                <th className="px-4 py-3">Documentation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50/80 transition">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-gray-900">{staff.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5">{staff.phone}</div>
                      {staff.notes && (
                        <div className="text-[11px] text-gray-400 mt-1 italic line-clamp-1">{staff.notes}</div>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800">
                        {staff.department}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs font-semibold text-gray-800">
                      {staff.icNumber}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        {/* IC Attachment */}
                        {staff.icAttachmentUrl ? (
                          <a
                            href={staff.icAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                            title={staff.icAttachmentName || 'View IC Attachment'}
                          >
                            <PaperClipIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="truncate max-w-[130px]">IC: {staff.icAttachmentName || 'View File'}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-gray-400">IC: Not uploaded</span>
                        )}

                        {/* License Attachment */}
                        {staff.licenseAttachmentUrl ? (
                          <a
                            href={staff.licenseAttachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-800 font-semibold"
                            title={staff.licenseAttachmentName || 'View Driving License Attachment'}
                          >
                            <DocumentTextIcon className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate max-w-[130px]">License: {staff.licenseAttachmentName || 'View File'}</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-amber-500 font-medium">License: Pending</span>
                        )}
                      </div>
                    </td>
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
                  <td colSpan={6} className="text-center py-10 text-gray-400">
                    <UsersIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                    <p className="font-semibold text-gray-600">No Authorized Staff Found</p>
                    <p className="text-xs text-gray-400 mt-0.5">Click "Add Authorized Staff" above to register new self-drive documentation.</p>
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
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
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
                  placeholder="e.g. Siti Nurhaliza binti Ahmad"
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
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    IC Number (No. IC) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={icNumber}
                    onChange={(e) => setIcNumber(e.target.value)}
                    placeholder="e.g. 920815-10-5432"
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Authorization Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                    className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                  >
                    <option value="active">Active (Authorized)</option>
                    <option value="inactive">Inactive (Suspended)</option>
                  </select>
                </div>
              </div>

              {/* IC Attachment */}
              <div className="border-t border-gray-100 pt-3">
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Attachment IC (Copy / Photo of NRIC)
                </label>
                {existingIcName && !icFile && (
                  <div className="flex items-center justify-between p-2 mb-2 bg-indigo-50 rounded-lg text-xs text-indigo-900 border border-indigo-100">
                    <span className="truncate">Current: <strong>{existingIcName}</strong></span>
                    <button
                      type="button"
                      onClick={() => { setExistingIcName(undefined); setExistingIcUrl(undefined); }}
                      className="text-indigo-600 hover:text-indigo-900 text-xs font-bold ml-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setIcFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                />
              </div>

              {/* Driving License Attachment */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                  Attachment Driving License (Lesen Memandu)
                </label>
                {existingLicenseName && !licenseFile && (
                  <div className="flex items-center justify-between p-2 mb-2 bg-emerald-50 rounded-lg text-xs text-emerald-900 border border-emerald-100">
                    <span className="truncate">Current: <strong>{existingLicenseName}</strong></span>
                    <button
                      type="button"
                      onClick={() => { setExistingLicenseName(undefined); setExistingLicenseUrl(undefined); }}
                      className="text-emerald-600 hover:text-emerald-900 text-xs font-bold ml-2"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setLicenseFile(e.target.files[0]);
                    }
                  }}
                  className="block w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 cursor-pointer"
                />
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
                  {isSaving ? 'Saving & Uploading...' : (editingStaff ? 'Save Changes' : 'Register Staff')}
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
