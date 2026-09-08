import React, { useState, useEffect, useCallback } from 'react';
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
  const { addUser, updateUser } = useAppContext();
  const [formData, setFormData] = useState<FormData>(emptyFormData);

  const resetForm = useCallback(() => {
    setFormData({...emptyFormData, joiningDate: new Date().toISOString().split('T')[0]});
  }, []);

  useEffect(() => {
    if (isOpen && userToEdit) {
      setFormData({
        name: userToEdit.name,
        email: userToEdit.email,
        phone: userToEdit.phone,
        joiningDate: userToEdit.joiningDate,
        address: userToEdit.address,
        comments: userToEdit.comments || '',
        role: userToEdit.role,
        status: userToEdit.status,
        password: '', // Always clear password for editing
      });
    } else if (isOpen && !userToEdit) {
      resetForm();
    }
  }, [isOpen, userToEdit, resetForm]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleStatusToggle = () => {
    setFormData(prev => ({ ...prev, status: prev.status === 'active' ? 'inactive' : 'active' }));
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (userToEdit) {
        const updatedData: Partial<Omit<User, 'id'>> = { ...formData };
        if (!formData.password) {
            delete updatedData.password; // Don't update password if it's empty
        }
        updateUser(userToEdit.id, updatedData);
    } else {
        if (!formData.password) {
            alert("Please enter a password for the new user.");
            return;
        }
        addUser(formData);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-xl font-bold text-gray-800">{userToEdit ? 'Edit User' : 'Add New User'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XIcon className="h-6 w-6" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {/* Section 1: User Details */}
          <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900">User Details</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" name="name" value={formData.name} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" name="email" value={formData.email} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700">Phone</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                  </div>
                   <div>
                    <label className="block text-sm font-medium text-gray-700">Joining Date</label>
                    <input type="date" name="joiningDate" value={formData.joiningDate} onChange={handleChange} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" />
                  </div>
              </div>
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <textarea name="address" value={formData.address} onChange={handleChange} rows={3} required className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"></textarea>
              </div>
          </div>

          <div className="border-t border-gray-200"></div>
          
          {/* Section 2: Access Control & Credentials */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Access & Credentials</h3>
             <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select name="role" value={formData.role} onChange={handleChange} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm">
                    <option value="driver">Driver</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <div className="mt-2 flex items-center">
                    <button
                      type="button"
                      onClick={handleStatusToggle}
                      className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors ${
                        formData.status === 'active' ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                      aria-label="Toggle user status"
                    >
                      <span className={`inline-block w-4 h-4 transform bg-white rounded-full transition-transform ${
                        formData.status === 'active' ? 'translate-x-6' : 'translate-x-1'
                      }`}/>
                    </button>
                    <span className="ml-3 text-sm text-gray-600 capitalize">{formData.status}</span>
                  </div>
                </div>
              </div>
             <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input type="password" name="password" value={formData.password} onChange={handleChange} required={!userToEdit} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm" placeholder={userToEdit ? "Leave blank to keep current" : "Enter password"}/>
                  <p className="mt-1 text-xs text-gray-500">{userToEdit ? "Update the user's password. Leave blank to keep it unchanged." : "Set an initial password for the new user."}</p>
              </div>
          </div>
          
          <div className="border-t border-gray-200"></div>
          
          {/* Section 3: Additional Information */}
          <div>
            <h3 className="text-lg font-medium leading-6 text-gray-900">Additional Information</h3>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Comments (Optional)</label>
              <textarea name="comments" value={formData.comments} onChange={handleChange} rows={3} className="mt-1 block w-full border-gray-300 rounded-md shadow-sm"></textarea>
            </div>
          </div>
          
          <div className="pt-4 flex justify-end space-x-3">
            <button type="button" onClick={onClose} className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md">{userToEdit ? 'Save Changes' : 'Add User'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UserForm;
