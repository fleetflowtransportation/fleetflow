import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import type { User } from '../types';
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
    setFormData(prev => ({ ...prev, status: prev.status === 'active' ? 'inactive' : 'active' }));
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

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

    if (userToEdit) {
      const updatedData: Partial<Omit<User, 'id'>> = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        joiningDate: formData.joiningDate,
        address: formData.address.trim(),
        comments: formData.comments.trim() || null,
        role: formData.role,
        status: formData.status,
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
                  👑 Primary Organization Owner
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">System Role</label>
                {userToEdit?.isOwner || isSelf ? (
                  <div className="mt-1">
                    <input 
                      type="text" 
                      disabled 
                      value={userToEdit?.isOwner ? "Admin (Organization Owner)" : "Admin (Your Current Account)"} 
                      className="block w-full border border-slate-200 rounded-xl shadow-xs bg-slate-50 text-slate-500 cursor-not-allowed p-3 text-sm outline-none" 
                    />
                    <p className="mt-1.5 text-[10px] text-indigo-600 font-semibold">
                      {userToEdit?.isOwner ? 'Owner accounts must remain Administrators.' : 'You cannot change your own administrative role.'}
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
                  {userToEdit?.isOwner || isSelf ? (
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        Active (Protected Account)
                      </span>
                      <p className="text-[10px] text-indigo-600 font-semibold">
                        {userToEdit?.isOwner ? 'Owners cannot be deactivated.' : 'You cannot deactivate your own account.'}
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
