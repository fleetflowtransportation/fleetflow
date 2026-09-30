import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import DriverScheduleManager from './DriverScheduleManager';
import UserManagement from './UserManagement';
import VehicleManagement from './VehicleManagement';
import BookingArchive from './BookingArchive';
import SelfDriveStaffManagement from './SelfDriveStaffManagement';
import type { Tenant } from '../types';
import { 
  BuildingOfficeIcon,
  ClockIcon,
  UsersIcon,
  TruckIcon,
  ArchiveIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  UserCircleIcon,
  LockClosedIcon
} from './icons/Icons';

export type SettingsSubTab = 
  | 'profile' 
  | 'portals' 
  | 'integrations' 
  | 'users' 
  | 'vehicles' 
  | 'schedule' 
  | 'self-drive' 
  | 'archive' 
  | 'account' 
  | 'danger';

export interface SettingsViewProps {
  initialSubTab?: string;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialSubTab = 'profile' }) => {
  const [activeTab, setActiveTab] = useState<SettingsSubTab>(initialSubTab as SettingsSubTab);
  const { 
    activeTenant, 
    updateTenantProfile, 
    updateTenantGoogleIntegrations, 
    deleteTenantCompletely, 
    currentUser, 
    updateUser, 
    logout,
    users, 
    vehicles, 
    bookings, 
    driverSchedules, 
    selfDriveStaff 
  } = useAppContext();

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab as SettingsSubTab);
    }
  }, [initialSubTab]);

  // Counts for sidebar badges
  const archivedCount = useMemo(() => 
    bookings.filter(b => b.status === 'Completed' || b.status === 'Cancelled' || b.status === 'Rejected').length, 
    [bookings]
  );

  // -------------------------------------------------------------
  // TAB 1: Organization Profile State & Handlers
  // -------------------------------------------------------------
  const [profileForm, setProfileForm] = useState<Partial<Tenant>>({
    companyName: '',
    regNumber: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    postcode: '',
    city: '',
    state: '',
    picName: '',
    picPhone: '',
    operatingHours: '08:00 - 17:00 (Mon - Fri)',
    timezone: 'Asia/Kuala_Lumpur',
  });

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTenant) {
      setProfileForm({
        companyName: activeTenant.companyName || activeTenant.name || '',
        regNumber: activeTenant.regNumber || '',
        email: activeTenant.email || '',
        phone: activeTenant.phone || '',
        website: activeTenant.website || '',
        address: activeTenant.address || '',
        postcode: activeTenant.postcode || '',
        city: activeTenant.city || '',
        state: activeTenant.state || '',
        picName: activeTenant.picName || '',
        picPhone: activeTenant.picPhone || '',
        operatingHours: activeTenant.operatingHours || '08:00 - 17:00 (Mon - Fri)',
        timezone: activeTenant.timezone || 'Asia/Kuala_Lumpur',
      });
    }
  }, [activeTenant]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileError(null);
    setProfileSuccess(false);

    try {
      const payload: Partial<Tenant> = {
        ...profileForm,
        name: profileForm.companyName || activeTenant?.name || 'Organization',
      };
      const ok = await updateTenantProfile(payload);
      if (ok) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 4000);
      } else {
        setProfileError('Failed to save changes. Please try again.');
      }
    } catch (err: any) {
      setProfileError(err.message || 'An error occurred while saving organization profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: Public Portals & Links
  // -------------------------------------------------------------
  const tenantIdParam = activeTenant?.id || '';
  const origin = window.location.origin;
  const bookingPortalUrl = `${origin}/?action=book&tenant_id=${tenantIdParam}`;
  const odometerPortalUrl = `${origin}/?action=odometer&tenant_id=${tenantIdParam}`;
  const calendarPortalUrl = `${origin}/?action=calendar&tenant_id=${tenantIdParam}`;

  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  const copyToClipboard = (url: string, key: string) => {
    navigator.clipboard.writeText(url);
    setCopiedLink(key);
    setTimeout(() => setCopiedLink(null), 2500);
  };

  // -------------------------------------------------------------
  // TAB 3: Integrations & Cloud Sync
  // -------------------------------------------------------------
  const [integrationForm, setIntegrationForm] = useState({
    calendarId: '',
    appsScriptUrl: '',
    driveId: ''
  });
  const [integrationSaving, setIntegrationSaving] = useState(false);
  const [integrationSuccess, setIntegrationSuccess] = useState(false);
  const [integrationError, setIntegrationError] = useState<string | null>(null);

  useEffect(() => {
    if (activeTenant) {
      setIntegrationForm({
        calendarId: activeTenant.googleCalendarId || '',
        appsScriptUrl: activeTenant.googleAppsScriptUrl || '',
        driveId: activeTenant.googleDriveId || ''
      });
    }
  }, [activeTenant]);

  const handleIntegrationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIntegrationSaving(true);
    setIntegrationSuccess(false);
    setIntegrationError(null);

    try {
      const ok = await updateTenantGoogleIntegrations({
        googleCalendarId: integrationForm.calendarId.trim(),
        googleAppsScriptUrl: integrationForm.appsScriptUrl.trim(),
        googleDriveId: integrationForm.driveId.trim()
      });
      if (ok) {
        setIntegrationSuccess(true);
        setTimeout(() => setIntegrationSuccess(false), 4000);
      } else {
        setIntegrationError('Failed to save integration settings.');
      }
    } catch (err: any) {
      setIntegrationError(err.message || 'An error occurred while saving integrations.');
    } finally {
      setIntegrationSaving(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 4: Account & Security (My Profile)
  // -------------------------------------------------------------
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters long.');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Passwords do not match. Please verify and re-enter.');
      return;
    }

    if (!currentUser?.id) {
      setPasswordError('No active user session found.');
      return;
    }

    setPasswordSaving(true);
    try {
      updateUser(currentUser.id, { password: passwordForm.newPassword.trim() });
      setPasswordSuccess(true);
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setTimeout(() => setPasswordSuccess(false), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to update password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 5: Danger Zone (Organization Deletion)
  // -------------------------------------------------------------
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDeleteOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleteError(null);

    const actualId = activeTenant?.id;
    if (!actualId) return;

    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      setDeleteError('Please type the exact confirmation word "DELETE".');
      return;
    }

    setDeleteLoading(true);
    try {
      const ok = await deleteTenantCompletely(actualId);
      if (ok) {
        alert('Your organization and all associated fleet data have been permanently deleted.');
        logout();
      } else {
        setDeleteError('Failed to delete organization. Please check database permissions.');
      }
    } catch (err: any) {
      setDeleteError(err.message || 'An error occurred during deletion.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // -------------------------------------------------------------
  // Sidebar Navigation Structure
  // -------------------------------------------------------------
  const navSections = [
    {
      group: 'Organization',
      items: [
        { id: 'profile', label: 'General Profile', icon: <BuildingOfficeIcon className="w-4 h-4" /> },
        { id: 'portals', label: 'Public Portals & Links', icon: <DocumentTextIcon className="w-4 h-4" /> },
        { id: 'integrations', label: 'Integrations & Sync', icon: <ClockIcon className="w-4 h-4" /> },
      ]
    },
    {
      group: 'Fleet Operations',
      items: [
        { id: 'users', label: 'Users & Drivers', icon: <UsersIcon className="w-4 h-4" />, badge: users.length },
        { id: 'vehicles', label: 'Fleet Vehicles', icon: <TruckIcon className="w-4 h-4" />, badge: vehicles.length },
        { id: 'schedule', label: 'Driver Rosters', icon: <ClockIcon className="w-4 h-4" />, badge: driverSchedules.length || undefined },
        { id: 'self-drive', label: 'Self-Drive Staff', icon: <DocumentTextIcon className="w-4 h-4" />, badge: selfDriveStaff.length || undefined },
        { id: 'archive', label: 'Booking Archive', icon: <ArchiveIcon className="w-4 h-4" />, badge: archivedCount || undefined },
      ]
    },
    {
      group: 'Security & Access',
      items: [
        { id: 'account', label: 'My Account', icon: <UserCircleIcon className="w-4 h-4" /> },
        ...(currentUser?.isOwner ? [
          { id: 'danger', label: 'Danger Zone', icon: <LockClosedIcon className="w-4 h-4 text-rose-500" /> }
        ] : [])
      ]
    }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Settings</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-slate-100 text-slate-700 border border-slate-200">
              {activeTenant?.companyName || activeTenant?.name || 'Organization'}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Configure organization preferences, public booking links, fleet resources, and account security.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Operational
          </span>
        </div>
      </div>

      {/* Main Grid: Left Nav + Right Content Area */}
      <div className="flex flex-col md:flex-row gap-6 items-start">
        
        {/* Left Side Navigation */}
        <aside className="w-full md:w-64 flex-shrink-0 bg-white rounded-2xl p-3 shadow-xs border border-slate-200">
          <nav className="space-y-5">
            {navSections.map((section, sIdx) => (
              <div key={sIdx} className="space-y-1">
                <p className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {section.group}
                </p>
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = activeTab === item.id;
                    const isDanger = item.id === 'danger';
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id as SettingsSubTab)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer text-left ${
                          isActive
                            ? isDanger
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 shadow-xs'
                              : 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-xs'
                            : isDanger
                            ? 'text-rose-600 hover:bg-rose-50/60'
                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 truncate">
                          <span className={isActive ? (isDanger ? 'text-rose-600' : 'text-indigo-600') : 'text-slate-400'}>
                            {item.icon}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        {item.badge !== undefined && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 ${
                            isActive ? 'bg-indigo-200/80 text-indigo-800' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {item.badge}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Right Main Content Pane */}
        <main className="flex-1 w-full min-w-0">
          
          {/* TAB 1: General Organization Profile */}
          {activeTab === 'profile' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Organization Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Official identity, registration numbers, and physical operational office details.
                </p>
              </div>

              {profileSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Organization details updated successfully.
                </div>
              )}

              {profileError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                  ⚠️ {profileError}
                </div>
              )}

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Organization / Company Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={profileForm.companyName || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, companyName: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. Yayasan Chow Kit"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Registration / ROC Number
                    </label>
                    <input
                      type="text"
                      value={profileForm.regNumber || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, regNumber: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. PPM-012-14-12345678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Official Contact Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={profileForm.email || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="e.g. info@organization.org"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Contact Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono"
                      placeholder="e.g. +603-4043 2345"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Operating Address
                  </label>
                  <textarea
                    rows={2}
                    value={profileForm.address || ''}
                    onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="Physical headquarters or dispatch center address"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      City
                    </label>
                    <input
                      type="text"
                      value={profileForm.city || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, city: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Kuala Lumpur"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Postcode
                    </label>
                    <input
                      type="text"
                      value={profileForm.postcode || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, postcode: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono"
                      placeholder="50350"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      State / Region
                    </label>
                    <input
                      type="text"
                      value={profileForm.state || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, state: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Wilayah Persekutuan"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Person-in-Charge (PIC)
                    </label>
                    <input
                      type="text"
                      value={profileForm.picName || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, picName: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="Transport Coordinator Name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Operating Hours
                    </label>
                    <input
                      type="text"
                      value={profileForm.operatingHours || ''}
                      onChange={(e) => setProfileForm({ ...profileForm, operatingHours: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                      placeholder="08:00 - 17:00 (Mon - Fri)"
                    />
                  </div>
                </div>

                <div className="pt-3 flex justify-end">
                  <button
                    type="submit"
                    disabled={profileSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {profileSaving ? 'Saving Changes...' : 'Save Organization Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: Public Portals & Links */}
          {activeTab === 'portals' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Public Links & Shareable Portals</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Share these URLs with your staff members, program officers, and drivers for fast self-service access.
                </p>
              </div>

              <div className="space-y-4">
                {/* Portal 1: Public Booking Form */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">1. Staff Booking Portal</h3>
                      <p className="text-xs text-slate-500">Allow employees and staff to request vehicles without logging in.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100">
                      Public Form
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={bookingPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(bookingPortalUrl, 'book')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'book' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <a
                      href={bookingPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>

                {/* Portal 2: Self-Drive Odometer Portal */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">2. Self-Drive Mileage & Odometer Submission</h3>
                      <p className="text-xs text-slate-500">Fast mobile portal for drivers to submit odometer readings before and after trips.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Driver Tool
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={odometerPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(odometerPortalUrl, 'odo')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'odo' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <a
                      href={odometerPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>

                {/* Portal 3: Live Calendar Schedule */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">3. Live Vehicle Availability Calendar</h3>
                      <p className="text-xs text-slate-500">Read-only overview showing active bookings and upcoming fleet reservations.</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      Read-Only
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={calendarPortalUrl}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono bg-white text-slate-600 outline-none select-all"
                    />
                    <button
                      onClick={() => copyToClipboard(calendarPortalUrl, 'cal')}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
                    >
                      {copiedLink === 'cal' ? '✓ Copied' : 'Copy Link'}
                    </button>
                    <a
                      href={calendarPortalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition whitespace-nowrap"
                    >
                      Open ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Integrations & Cloud Sync */}
          {activeTab === 'integrations' && (
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Google Calendar & Cloud Sync</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Synchronize approved vehicle bookings directly to your organization Google Calendar.
                </p>
              </div>

              {integrationSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  Integration settings saved successfully.
                </div>
              )}

              {integrationError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                  ⚠️ {integrationError}
                </div>
              )}

              <form onSubmit={handleIntegrationSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Google Calendar ID
                  </label>
                  <input
                    type="text"
                    value={integrationForm.calendarId}
                    onChange={(e) => setIntegrationForm({ ...integrationForm, calendarId: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="e.g. c_1234567890@group.calendar.google.com or primary"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Enter your Google Calendar ID or leave as "primary" to write events to your default organization calendar.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Google Apps Script Webhook Endpoint
                  </label>
                  <input
                    type="url"
                    value={integrationForm.appsScriptUrl}
                    onChange={(e) => setIntegrationForm({ ...integrationForm, appsScriptUrl: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Automated webhook that syncs approved booking dispatch notices to your staff Google Calendar.
                  </p>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={integrationSaving}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {integrationSaving ? 'Saving...' : 'Save Integration Settings'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 4: Users & Drivers */}
          {activeTab === 'users' && <UserManagement />}

          {/* TAB 5: Vehicles */}
          {activeTab === 'vehicles' && <VehicleManagement />}

          {/* TAB 6: Driver Rosters / Schedules */}
          {activeTab === 'schedule' && (
            <div className="space-y-4">
              <DriverScheduleManager readOnly={false} />
            </div>
          )}

          {/* TAB 7: Self-Drive Staff */}
          {activeTab === 'self-drive' && <SelfDriveStaffManagement />}

          {/* TAB 8: Booking Archive */}
          {activeTab === 'archive' && <BookingArchive />}

          {/* TAB 9: My Account & Security */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">My Account Profile</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your authenticated personal administrator profile details.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Full Name</p>
                    <p className="text-sm font-bold text-slate-900 mt-0.5">{currentUser?.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Assigned Role</p>
                    <div className="mt-1">
                      {currentUser?.isOwner ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          👑 Super Admin
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          🛡️ Administrator
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Change Password Form */}
              <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Change Password</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Update your account credentials to keep your administrator session secure.
                  </p>
                </div>

                {passwordSuccess && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    Your password has been successfully updated.
                  </div>
                )}

                {passwordError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                    ⚠️ {passwordError}
                  </div>
                )}

                <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-lg">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      placeholder="Minimum 6 characters"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      required
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      placeholder="Re-enter new password"
                      className="w-full border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                      {passwordSaving ? 'Updating...' : 'Update Password'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 10: Danger Zone (Super Admin only) */}
          {activeTab === 'danger' && currentUser?.isOwner && (
            <div className="bg-white rounded-2xl shadow-xs border border-rose-200 p-6 space-y-6">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-rose-50 rounded-xl text-rose-600 border border-rose-100 flex-shrink-0">
                  <LockClosedIcon className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-rose-700">Danger Zone: Delete Organization</h2>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Permanently delete this organization, including all registered vehicles, bookings, odometer logs, 
                    fuel records, and secondary administrator accounts. This action is irreversible.
                  </p>
                </div>
              </div>

              {deleteError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-800">
                  ⚠️ {deleteError}
                </div>
              )}

              <form onSubmit={handleDeleteOrganization} className="space-y-4 max-w-md pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Type <span className="text-rose-600 font-mono">DELETE</span> to confirm:
                  </label>
                  <input
                    type="text"
                    required
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    placeholder="DELETE"
                    className="w-full border border-rose-300 rounded-xl px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
                  />
                </div>

                <button
                  type="submit"
                  disabled={deleteLoading || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-sm transition shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? 'Purging Organization...' : 'Permanently Delete Organization'}
                </button>
              </form>
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

export default SettingsView;
