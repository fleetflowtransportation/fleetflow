import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { User, UserStatusLog } from '../types';
import { XIcon } from './icons/Icons';

interface UserFormProps {
  isOpen: boolean;
  onClose: () => void;
  userToEdit?: User | null;
}

const emptyFormData = {
  name: '',
  email: '',
  phone: '',
  joiningDate: '',
  address: '',
  comments: '',
  role: 'driver' as 'admin' | 'driver',
  status: 'active' as 'active' | 'inactive',
  password: '',
  employmentType: 'full_time' as 'full_time' | 'part_time',
  terminationDate: '',
  terminationReason: '',
  reactivationDate: '',
  reactivationReason: '',
};

type FormData = typeof emptyFormData;

const UserForm: React.FC<UserFormProps> = ({ isOpen, onClose, userToEdit }) => {
  const { addUser, updateUser, currentUser } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const prevIsOpenRef = React.useRef(false);
  const prevUserIdRef = React.useRef<string | null | undefined>(undefined);

  const resetForm = useCallback(() => {
    setFormData({
      ...emptyFormData,
      joiningDate: new Date().toISOString().split('T')[0],
      terminationDate: '',
      terminationReason: '',
      reactivationDate: '',
      reactivationReason: '',
    });
    setFormError(null);
    setShowPassword(false);
  }, []);

  useEffect(() => {
    const justOpened = isOpen && !prevIsOpenRef.current;
    const userChanged = isOpen && (userToEdit ? userToEdit.id : null) !== prevUserIdRef.current;

    prevIsOpenRef.current = isOpen;
    prevUserIdRef.current = userToEdit ? userToEdit.id : null;

    if (!isOpen) return;

    if (justOpened || userChanged) {
      if (userToEdit) {
        setFormData({
          name: userToEdit.name,
          email: userToEdit.email,
          phone: userToEdit.phone || '',
          joiningDate: userToEdit.joiningDate,
          address: userToEdit.address || '',
          comments: userToEdit.comments || '',
          role: userToEdit.role,
          status: userToEdit.status,
          password: '', // Always clear password for editing
          employmentType: userToEdit.employmentType || 'full_time',
          terminationDate: userToEdit.terminationDate || '',
          terminationReason: userToEdit.terminationReason || '',
          reactivationDate: userToEdit.reactivationDate || '',
          reactivationReason: userToEdit.reactivationReason || '',
        });
      } else {
        resetForm();
      }
      setFormError(null);
    }
  }, [isOpen, userToEdit, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setFormError(null);
  };

  // Check if the administrator is editing their own user profile
  const isSelf = useMemo(() => {
    return currentUser && userToEdit && currentUser.id === userToEdit.id;
  }, [currentUser, userToEdit]);

  const handleStatusToggle = () => {
    if (isSelf) return; // Prevent self-deactivation
    const nextStatus = formData.status === 'active' ? 'inactive' : 'active';
    const today = new Date().toISOString().split('T')[0];
    setFormData(prev => ({
      ...prev,
      status: nextStatus,
      ...(nextStatus === 'inactive' && !prev.terminationDate && { terminationDate: today }),
      ...(nextStatus === 'active' && !prev.reactivationDate && { reactivationDate: today }),
    }));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Permission checks
    if (userToEdit?.isOwner && !currentUser?.isOwner) {
      setFormError('Access Denied: Only Super Admin can modify the Super Admin account.');
      return;
    }

    if (userToEdit?.role === 'admin' && !isSelf && !currentUser?.isOwner) {
      setFormError('Access Denied: Additional administrators can only manage Drivers.');
      return;
    }

    if (!currentUser?.isOwner && formData.role === 'admin' && !isSelf) {
      setFormError('Access Denied: Only Super Admin can assign or create Administrator accounts.');
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(formData.email.trim())) {
      setFormError('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    if (!userToEdit && formData.password.length < 6) {
      setFormError('Password must be at least 6 characters long for security purposes.');
      return;
    }

    if (userToEdit && formData.password && formData.password.length < 6) {
      setFormError('New password must be at least 6 characters long.');
      return;
    }

    const nowIso = new Date().toISOString();
    const todayDate = nowIso.split('T')[0];
    const adminName = currentUser?.name || currentUser?.email || 'Administrator';
    let newLog: UserStatusLog | null = null;

    if (userToEdit) {
      if (userToEdit.status === 'active' && formData.status === 'inactive') {
        newLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'deactivated',
          timestamp: nowIso,
          performedBy: adminName,
          effectiveDate: formData.terminationDate || todayDate,
          reason: formData.terminationReason?.trim() || 'Account deactivated by administrator',
          previousStatus: 'active',
          newStatus: 'inactive',
        };
      } else if (userToEdit.status === 'inactive' && formData.status === 'active') {
        newLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'reactivated',
          timestamp: nowIso,
          performedBy: adminName,
          effectiveDate: formData.reactivationDate || todayDate,
          reason: formData.reactivationReason?.trim() || 'Account reactivated by administrator',
          previousStatus: 'inactive',
          newStatus: 'active',
        };
      } else if (formData.terminationReason && formData.status === 'inactive' && formData.terminationReason !== userToEdit.terminationReason) {
        newLog = {
          id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          action: 'updated',
          timestamp: nowIso,
          performedBy: adminName,
          effectiveDate: formData.terminationDate || todayDate,
          reason: formData.terminationReason?.trim(),
          previousStatus: 'inactive',
          newStatus: 'inactive',
        };
      }

      const existingHistory = userToEdit.statusHistory || [];
      const updatedHistory = newLog ? [...existingHistory, newLog] : existingHistory;

      const updatedData: Partial<Omit<User, 'id'>> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        joiningDate: formData.joiningDate,
        address: formData.address.trim(),
        comments: formData.comments.trim() || null,
        role: formData.role,
        status: formData.status,
        employmentType: formData.role === 'driver' ? formData.employmentType : undefined,
        terminationDate: formData.status === 'inactive' ? (formData.terminationDate || todayDate) : undefined,
        terminationReason: formData.status === 'inactive' ? (formData.terminationReason?.trim() || undefined) : undefined,
        reactivationDate: formData.status === 'active' ? (formData.reactivationDate || todayDate) : undefined,
        reactivationReason: formData.status === 'active' ? (formData.reactivationReason?.trim() || undefined) : undefined,
        statusHistory: updatedHistory,
      };

      if (formData.password) {
        updatedData.password = formData.password.trim();
      }

      updateUser(userToEdit.id, updatedData);
    } else {
      if (!formData.password) {
        setFormError('Please enter an initial password for the new user.');
        return;
      }

      const initialLog: UserStatusLog = {
        id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        action: 'created',
        timestamp: nowIso,
        performedBy: adminName,
        effectiveDate: formData.joiningDate,
        reason: 'New user registration',
        newStatus: formData.status,
      };

      addUser({
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        joiningDate: formData.joiningDate,
        address: formData.address.trim(),
        comments: formData.comments.trim() || null,
        role: formData.role,
        status: formData.status,
        password: formData.password.trim(),
        employmentType: formData.role === 'driver' ? formData.employmentType : undefined,
        terminationDate: formData.status === 'inactive' ? (formData.terminationDate || todayDate) : undefined,
        terminationReason: formData.status === 'inactive' ? (formData.terminationReason?.trim() || undefined) : undefined,
        statusHistory: [initialLog],
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex justify-center items-center p-4 transition-all duration-300">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-150 overflow-hidden transform transition-all scale-100 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-lg font-black text-slate-900">
              {userToEdit ? '✏️ Edit User / Driver Profile' : '👤 Register New User / Driver'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {userToEdit ? 'Modify administrative credentials, roles, and on-duty status' : 'Add new team members or dedicated transport drivers'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="text-slate-400 hover:text-slate-600 hover:bg-slate-200 p-1.5 rounded-xl transition cursor-pointer"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-bold leading-relaxed">
              ⚠️ {formError}
            </div>
          )}

          {/* Section 1: User Details */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">General Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Full Name</label>
                <input 
                  type="text" 
                  name="name" 
                  value={formData.name} 
                  onChange={handleChange} 
                  required 
                  className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. Ahmad bin Salim"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Address</label>
                <input 
                  type="email" 
                  name="email" 
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                  className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. ahmad@yck.org.my"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Phone Number</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={formData.phone} 
                  onChange={handleChange} 
                  required 
                  className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition font-mono"
                  placeholder="e.g. +6012-3456789"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Joining Date</label>
                <input 
                  type="date" 
                  name="joiningDate" 
                  value={formData.joiningDate} 
                  onChange={handleChange} 
                  required 
                  className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Home Address</label>
              <textarea 
                name="address" 
                value={formData.address} 
                onChange={handleChange} 
                rows={2} 
                required 
                className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                placeholder="Enter complete permanent or residential address"
              ></textarea>
            </div>
          </div>

          <div className="border-t border-slate-100"></div>
          
          {/* Section 2: Access Control & Credentials */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Access Roles & Credentials</h3>
              {userToEdit?.isOwner && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  👑 Super Admin
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">System Role</label>
                {userToEdit?.isOwner ? (
                  <div className="mt-1">
                    <input 
                      type="text" 
                      disabled 
                      value="Admin (Super Admin)" 
                      className="block w-full border border-slate-200 rounded-xl shadow-xs bg-slate-50 text-slate-500 cursor-not-allowed p-3 text-sm outline-none" 
                    />
                    <p className="mt-1.5 text-[10px] text-indigo-600 font-semibold">
                      Super Admin accounts must remain Administrators.
                    </p>
                  </div>
                ) : isSelf ? (
                  <div className="mt-1">
                    <input 
                      type="text" 
                      disabled 
                      value={currentUser?.isOwner ? "Admin (Super Admin)" : "Admin (Your Current Account)"} 
                      className="block w-full border border-slate-200 rounded-xl shadow-xs bg-slate-50 text-slate-500 cursor-not-allowed p-3 text-sm outline-none" 
                    />
                    <p className="mt-1.5 text-[10px] text-indigo-600 font-semibold">
                      You cannot change your own administrative role.
                    </p>
                  </div>
                ) : !currentUser?.isOwner ? (
                  <div className="mt-1">
                    <input 
                      type="text" 
                      disabled 
                      value="🚙 Transport Driver" 
                      className="block w-full border border-slate-200 rounded-xl shadow-xs bg-slate-50 text-slate-600 cursor-not-allowed p-3 text-sm outline-none" 
                    />
                    <p className="mt-1.5 text-[10px] text-slate-500 font-semibold">
                      Additional administrators can only manage Transport Drivers.
                    </p>
                  </div>
                ) : (
                  <select 
                    name="role" 
                    value={formData.role} 
                    onChange={handleChange} 
                    className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none bg-white transition"
                  >
                    <option value="driver">🚙 Transport Driver</option>
                    <option value="admin">🛡️ Administrator</option>
                  </select>
                )}
              </div>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Account Status</label>
                <div className="mt-2.5 flex items-center">
                  {userToEdit?.isOwner ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        Active (Super Admin Account)
                      </span>
                      <p className="text-[10px] text-indigo-600 font-semibold">
                        Super Admin cannot be deactivated.
                      </p>
                    </div>
                  ) : isSelf ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active (Protected Account)
                      </span>
                      <p className="text-[10px] text-indigo-600 font-semibold">
                        You cannot deactivate your own account.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleStatusToggle}
                        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors cursor-pointer ${
                          formData.status === 'active' ? 'bg-emerald-500' : 'bg-slate-200'
                        }`}
                        aria-label="Toggle user status"
                      >
                        <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                          formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                        }`}/>
                      </button>
                      <span className={`text-xs font-bold uppercase tracking-wider ${formData.status === 'active' ? 'text-emerald-700' : 'text-slate-500'}`}>
                        {formData.status === 'active' ? '🟢 Active' : '🔴 Inactive'}
                      </span>
                    </div>
                  )}
                </div>
                {formData.role === 'driver' && formData.status === 'inactive' && !userToEdit?.isOwner && (
                  <p className="mt-1.5 text-[10px] text-rose-600 font-bold">
                    ⚠️ Warning: Deactivating a driver removes them from upcoming active trip assignments.
                  </p>
                )}
              </div>
            </div>

            {/* Driver Employment Classification (When Role is Driver) */}
            {formData.role === 'driver' && (
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-indigo-950 uppercase tracking-wider">
                    Driver Employment Classification
                  </label>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100/70 px-2 py-0.5 rounded-full">
                    {formData.employmentType === 'part_time' ? 'Part-Time / Temporary' : 'Full-Time Permanent'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, employmentType: 'full_time' }))}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      formData.employmentType === 'full_time'
                        ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-900">Full-Time Driver</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Permanent</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Regular dedicated driver</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.employmentType === 'full_time' ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'}`}>
                      {formData.employmentType === 'full_time' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, employmentType: 'part_time' }))}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      formData.employmentType === 'part_time'
                        ? 'bg-white border-purple-600 ring-2 ring-purple-500/20 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-xs text-slate-900">Part-Time / Temporary</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Contract</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">Relief, seasonal, or temporary contract</p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${formData.employmentType === 'part_time' ? 'border-purple-600 bg-purple-600' : 'border-slate-300'}`}>
                      {formData.employmentType === 'part_time' && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Inactive / Termination Details Card */}
            {formData.status === 'inactive' && !userToEdit?.isOwner && (
              <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600 animate-pulse"></span>
                  <h4 className="text-xs font-black text-rose-950 uppercase tracking-wider">
                    Deactivation & Termination Details
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Termination / End Date
                    </label>
                    <input
                      type="date"
                      name="terminationDate"
                      value={formData.terminationDate}
                      onChange={handleChange}
                      className="block w-full border border-rose-300 rounded-xl shadow-xs p-2.5 text-xs bg-white focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Official last day of contract or service</p>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Reason / Remarks
                    </label>
                    <input
                      type="text"
                      name="terminationReason"
                      value={formData.terminationReason}
                      onChange={handleChange}
                      placeholder="e.g. Completed part-time contract, Resigned..."
                      className="block w-full border border-rose-300 rounded-xl shadow-xs p-2.5 text-xs bg-white focus:ring-2 focus:ring-rose-500 outline-none font-medium"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Saved to user audit history log</p>
                  </div>
                </div>
              </div>
            )}

            {/* Reactivation Details Card (When switching from Inactive to Active) */}
            {userToEdit?.status === 'inactive' && formData.status === 'active' && (
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                  <h4 className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                    Reactivation Audit Details
                  </h4>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Reactivation Effective Date
                    </label>
                    <input
                      type="date"
                      name="reactivationDate"
                      value={formData.reactivationDate}
                      onChange={handleChange}
                      className="block w-full border border-emerald-300 rounded-xl shadow-xs p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Reactivation Reason / Remarks
                    </label>
                    <input
                      type="text"
                      name="reactivationReason"
                      value={formData.reactivationReason}
                      onChange={handleChange}
                      placeholder="e.g. Rehired for holiday season relief, Returned to duty..."
                      className="block w-full border border-emerald-300 rounded-xl shadow-xs p-2.5 text-xs bg-white focus:ring-2 focus:ring-emerald-500 outline-none font-medium"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  name="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required={!userToEdit} 
                  className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 pr-10 text-sm outline-none transition" 
                  placeholder={userToEdit ? "••••••••" : "Create a password (minimum 6 characters)"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none cursor-pointer"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {userToEdit ? "Leave blank to keep current password. Enter a new password to reset it." : "Enter a secure initial password."}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100"></div>
          
          {/* Section 3: Additional Notes */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Administrative Comments</h3>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Internal Notes & Remarks</label>
              <textarea 
                name="comments" 
                value={formData.comments} 
                onChange={handleChange} 
                rows={2} 
                className="block w-full border border-slate-300 rounded-xl shadow-xs focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                placeholder="Enter comments about license verification, shift availability, or employee background notes..."
              ></textarea>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs sm:text-sm font-semibold rounded-xl shadow-xs transition cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="button"
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-extrabold rounded-xl shadow-md transition cursor-pointer"
          >
            {userToEdit ? 'Save Changes' : 'Register User'}
          </button>
        </div>

      </div>
    </div>
  );
};

export default UserForm;
