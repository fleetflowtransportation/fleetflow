import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export const AuthPage: React.FC = () => {
  const { login, registerOrganization } = useAppContext();
  const [isLoginView, setIsLoginView] = useState(true);
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register Form States
  const [regTenantId, setRegTenantId] = useState('');
  const [regTenantName, setRegTenantName] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Please provide your email and password.');
      return;
    }

    setLoginLoading(true);
    const success = await login(
      loginEmail.trim().toLowerCase(),
      loginPassword
    );
    setLoginLoading(false);

    if (!success) {
      setLoginError('Invalid email or password (or account has been deactivated).');
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegSuccess(null);

    const slugPattern = /^[a-z0-9-]+$/;
    if (!slugPattern.test(regTenantId.trim())) {
      setRegError('Organization ID can only contain lowercase letters, numbers, and hyphens (-). No special characters or spaces.');
      return;
    }

    if (!regTenantId.trim() || !regTenantName.trim() || !regAdminName.trim() || !regAdminEmail.trim() || !regAdminPassword.trim()) {
      setRegError('Please complete all required fields.');
      return;
    }

    setRegLoading(true);
    try {
      const success = await registerOrganization(
        regTenantId.trim().toLowerCase(),
        regTenantName.trim(),
        regAdminName.trim(),
        regAdminEmail.trim(),
        regAdminPassword.trim()
      );

      if (success) {
        setRegSuccess(`Organization "${regTenantName}" registered successfully! Please log in using the administrator email "${regAdminEmail}".`);
        setRegTenantId('');
        setRegTenantName('');
        setRegAdminName('');
        setRegAdminEmail('');
        setRegAdminPassword('');
        setTimeout(() => {
          setIsLoginView(true);
        }, 5000);
      } else {
        setRegError('Registration failed. The Organization ID may already be registered by another tenant.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Registration failed due to an unexpected error.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-150 p-8">
        
        {/* Simple & Minimalist Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            Fleet Management
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {isLoginView 
              ? 'Sign in to manage fleet operations' 
              : 'Register a new organization to get started'}
          </p>
        </div>

        {/* Login View */}
        {isLoginView ? (
          <div>
            {loginError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold leading-relaxed">
                ⚠️ {loginError}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. admin@organization.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl shadow-sm transition disabled:bg-slate-400 flex items-center justify-center space-x-2 text-sm mt-6 cursor-pointer"
              >
                {loginLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { setIsLoginView(false); setRegError(null); setRegSuccess(null); }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition"
              >
                Register New Organization
              </button>
            </div>
          </div>
        ) : (
          /* Register View */
          <div>
            {regError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold leading-relaxed">
                ⚠️ {regError}
              </div>
            )}

            {regSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold leading-relaxed">
                ✅ {regSuccess}
              </div>
            )}

            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Organization ID (Slug)
                </label>
                <input
                  type="text"
                  value={regTenantId}
                  onChange={(e) => setRegTenantId(e.target.value.toLowerCase())}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. acme-foundation"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Organization Full Name
                </label>
                <input
                  type="text"
                  value={regTenantName}
                  onChange={(e) => setRegTenantName(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. Acme Community Foundation"
                />
              </div>

              <div className="border-t border-slate-100 pt-3 mt-3">
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Administrator Account Details</p>
                <div className="space-y-3">
                  <div>
                    <input
                      type="text"
                      value={regAdminName}
                      onChange={(e) => setRegAdminName(e.target.value)}
                      required
                      className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-sm outline-none transition"
                      placeholder="Admin Name"
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      value={regAdminEmail}
                      onChange={(e) => setRegAdminEmail(e.target.value)}
                      required
                      className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-sm outline-none transition"
                      placeholder="Admin Email"
                    />
                  </div>

                  <div>
                    <input
                      type="password"
                      value={regAdminPassword}
                      onChange={(e) => setRegAdminPassword(e.target.value)}
                      required
                      className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 text-sm outline-none transition"
                      placeholder="Password"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={regLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl shadow-sm transition disabled:bg-slate-400 flex items-center justify-center space-x-2 text-sm mt-6 cursor-pointer"
              >
                {regLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Registering...</span>
                  </>
                ) : (
                  <span>Register Organization</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { setIsLoginView(true); setRegError(null); setRegSuccess(null); }}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 transition"
              >
                Already Have an Account? Sign In
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
