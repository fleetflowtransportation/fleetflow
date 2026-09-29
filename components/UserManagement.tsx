import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import UserForm from './UserForm';
import { PlusIcon, EditIcon, TrashIcon, SearchIcon, UsersIcon, UserCircleIcon, CheckCircleIcon, XCircleIcon } from './icons/Icons';
import type { User } from '../types';

const StatCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  colorBg: string;
  colorText: string;
}> = ({ title, value, icon, colorBg, colorText }) => (
  <div className="bg-white rounded-2xl p-4 sm:p-5 border border-gray-200 shadow-xs flex items-center justify-between">
    <div>
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</p>
      <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
    </div>
    <div className={`p-3 rounded-xl ${colorBg} ${colorText}`}>
      {icon}
    </div>
  </div>
);

const UserManagement: React.FC = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'driver'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  
  const { users, deleteUser } = useAppContext();

  const handleCreateUser = () => {
    setEditingUser(null);
    setIsFormOpen(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setIsFormOpen(true);
  };

  const handleDeleteUser = (userId: string) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      deleteUser(userId);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingUser(null);
  };

  // Stats calculation
  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(u => u.role === 'admin').length;
    const drivers = users.filter(u => u.role === 'driver').length;
    const active = users.filter(u => u.status === 'active').length;
    return { total, admins, drivers, active };
  }, [users]);

  // Filtered & Sorted list
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        (user.name || '').toLowerCase().includes(q) || 
        (user.email || '').toLowerCase().includes(q) ||
        (user.phone || '').toLowerCase().includes(q);

      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus = statusFilter === 'all' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [users, searchQuery, roleFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white rounded-2xl p-5 sm:p-6 shadow-xs border border-gray-200">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Users & Drivers</h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-1">
            Manage administrative credentials, system access roles, and dedicated drivers.
          </p>
        </div>
        <button
          onClick={handleCreateUser}
          className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-md transition duration-200 transform hover:scale-105 text-sm cursor-pointer whitespace-nowrap"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          Add User / Driver
        </button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard 
          title="Total Users" 
          value={stats.total} 
          icon={<UsersIcon className="w-6 h-6" />} 
          colorBg="bg-slate-100" 
          colorText="text-slate-700" 
        />
        <StatCard 
          title="Administrators" 
          value={stats.admins} 
          icon={<UserCircleIcon className="w-6 h-6" />} 
          colorBg="bg-indigo-100" 
          colorText="text-indigo-700" 
        />
        <StatCard 
          title="Transport Drivers" 
          value={stats.drivers} 
          icon={<UsersIcon className="w-6 h-6" />} 
          colorBg="bg-blue-100" 
          colorText="text-blue-700" 
        />
        <StatCard 
          title="Active Accounts" 
          value={stats.active} 
          icon={<CheckCircleIcon className="w-6 h-6" />} 
          colorBg="bg-emerald-100" 
          colorText="text-emerald-700" 
        />
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-white p-4 rounded-2xl shadow-xs border border-gray-200">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
            <SearchIcon className="w-4 h-4" />
          </div>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, email, or phone number..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
          />
        </div>

        <div className="flex gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="all">All Roles</option>
            <option value="admin">Administrators</option>
            <option value="driver">Drivers</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-medium text-slate-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">User Details</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Contact</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Role & Permissions</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                <th scope="col" className="px-6 py-3.5 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Joining Date</th>
                <th scope="col" className="px-6 py-3.5 text-right text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filteredUsers.length > 0 ? (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/80 transition">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm border border-indigo-100 flex-shrink-0">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{user.name}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {user.phone ? (
                        <span className="font-mono text-xs">{user.phone}</span>
                      ) : (
                        <span className="text-gray-400 text-xs italic">No phone recorded</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
                          user.role === 'admin' 
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {user.role === 'admin' ? '🛡️ Administrator' : '🚙 Driver'}
                        </span>
                        {user.isOwner && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300" title="Primary Organization Owner">
                            👑 Owner
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${
                        user.status === 'active' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {user.status === 'active' ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-medium">
                      {user.joiningDate ? new Date(user.joiningDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={() => handleEditUser(user)} 
                          className="text-slate-600 hover:text-indigo-600 p-2 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 transition" 
                          title="Edit User Profile"
                        >
                          <EditIcon className="h-4 w-4" />
                        </button>
                        {user.isOwner ? (
                          <button 
                            disabled
                            className="text-slate-300 cursor-not-allowed p-2 rounded-xl" 
                            title="Organization Owner cannot be deleted"
                            aria-label="Cannot delete organization owner"
                          >
                            <TrashIcon className="h-4 w-4"/>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleDeleteUser(user.id)} 
                            className="text-slate-400 hover:text-rose-600 p-2 rounded-xl hover:bg-rose-50 border border-transparent hover:border-rose-100 transition" 
                            title="Delete User"
                          >
                            <TrashIcon className="h-4 w-4"/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
                        <UsersIcon className="w-6 h-6" />
                      </div>
                      <p className="text-sm font-bold text-gray-700">No users match your criteria</p>
                      <p className="text-xs text-gray-500">Try adjusting your search filters or add a new account.</p>
                      {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
                        <button
                          onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); }}
                          className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-800"
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <UserForm 
        isOpen={isFormOpen} 
        onClose={handleCloseForm} 
        userToEdit={editingUser} 
      />
    </div>
  );
};

export default UserManagement;
