import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { getSupabase } from '../services/supabaseClient';

export const AuthPage: React.FC = () => {
  const { login, registerOrganization, forgotPassword } = useAppContext();
  const [isLoginView, setIsLoginView] = useState(true);
  const [isForgotPasswordView, setIsForgotPasswordView] = useState(false);
  
  // Login Form States
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Forgot Password States
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);

  // Recovery Password States (when user clicks reset link from email)
  const [isRecoveryView, setIsRecoveryView] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoverySuccess, setRecoverySuccess] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  // Register Form States
  const [regTenantId, setRegTenantId] = useState('');
  const [regTenantName, setRegTenantName] = useState('');
  const [regAdminName, setRegAdminName] = useState('');
  const [regAdminEmail, setRegAdminEmail] = useState('');
  const [regAdminPassword, setRegAdminPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''));
      const errorDescription = params.get('error_description');
      const errorCode = params.get('error_code');
      const type = params.get('type');
      const accessToken = params.get('access_token');

      if (errorCode || errorDescription) {
        setLoginError(`Pautan pemulihan tidak sah atau telah tamat tempoh (${errorDescription || errorCode}). Sila mohon pautan baru.`);
        window.history.replaceState(null, '', window.location.pathname);
      } else if (type === 'recovery' || accessToken) {
        setIsRecoveryView(true);
      }
    }
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setLoginError('Sila masukkan emel dan kata laluan anda.');
      return;
    }

    setLoginLoading(true);
    const result = await login(
      loginEmail.trim().toLowerCase(),
      loginPassword.trim()
    );
    setLoginLoading(false);

    if (!result.success) {
      setLoginError(result.error || 'Email atau password salah.');
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    if (!forgotEmail.trim()) {
      setForgotError('Sila masukkan alamat emel anda.');
      return;
    }

    setForgotLoading(true);
    const res = await forgotPassword(forgotEmail.trim().toLowerCase());
    setForgotLoading(false);

    if (res.success) {
      setForgotSuccess('Pautan tetapan semula kata laluan telah dihantar ke emel anda. Sila semak peti masuk / spam.');
    } else {
      setForgotError(res.error || 'Gagal menghantar pautan pemulihan.');
    }
  };

  const handleUpdatePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setRecoverySuccess(null);

    if (!newPassword || newPassword.length < 6) {
      setRecoveryError('Kata laluan baru mesti mengandungi sekurang-kurangnya 6 aksara.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setRecoveryError('Kata laluan pengesahan tidak sepadan.');
      return;
    }

    setRecoveryLoading(true);
    try {
      const supabase = getSupabase();
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      setRecoveryLoading(false);
      if (error) {
        setRecoveryError(error.message);
      } else {
        setRecoverySuccess('Kata laluan anda telah berjaya dikemas kini! Anda boleh log masuk sekarang.');
        setTimeout(() => {
          setIsRecoveryView(false);
          setIsLoginView(true);
          window.history.replaceState(null, '', window.location.pathname);
        }, 3000);
      }
    } catch (err: any) {
      setRecoveryLoading(false);
      setRecoveryError(err.message || 'Gagal mengemas kini kata laluan.');
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
      setRegError('Sila lengkapkan semua ruangan yang wajib.');
      return;
    }

    setRegLoading(true);
    try {
      const result = await registerOrganization(
        regTenantId.trim().toLowerCase(),
        regTenantName.trim(),
        regAdminName.trim(),
        regAdminEmail.trim(),
        regAdminPassword.trim()
      );

      if (result.success) {
        setRegSuccess(`Organisasi "${regTenantName}" berjaya didaftarkan! Sila log masuk menggunakan emel pentadbir "${regAdminEmail}".`);
        setRegTenantId('');
        setRegTenantName('');
        setRegAdminName('');
        setRegAdminEmail('');
        setRegAdminPassword('');
        setTimeout(() => {
          setIsLoginView(true);
        }, 4000);
      } else {
        setRegError(result.error || 'Pendaftaran gagal. Sila cuba lagi.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Pendaftaran gagal.');
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-150 p-8">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
            Fleet Management
          </h1>
          <p className="text-sm text-slate-500 mt-1.5">
            {isRecoveryView
              ? 'Tetapkan kata laluan baru anda'
              : isForgotPasswordView
                ? 'Pulihkan kata laluan akaun anda'
                : isLoginView 
                  ? 'Log masuk untuk menguruskan operasi armada' 
                  : 'Daftar organisasi baru untuk bermula'}
          </p>
        </div>

        {/* Recovery Password View */}
        {isRecoveryView ? (
          <div>
            {recoveryError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold leading-relaxed">
                ⚠️ {recoveryError}
              </div>
            )}

            {recoverySuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold leading-relaxed">
                ✅ {recoverySuccess}
              </div>
            )}

            <form onSubmit={handleUpdatePasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Kata Laluan Baru
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Sahkan Kata Laluan Baru
                </label>
                <input
                  type="password"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={recoveryLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl shadow-sm transition disabled:bg-slate-400 flex items-center justify-center space-x-2 text-sm mt-6 cursor-pointer"
              >
                {recoveryLoading ? (
                  <span>Menyimpan...</span>
                ) : (
                  <span>Simpan Kata Laluan Baru</span>
                )}
              </button>
            </form>
          </div>
        ) : isForgotPasswordView ? (
          /* Forgot Password View */
          <div>
            {forgotError && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold leading-relaxed">
                ⚠️ {forgotError}
              </div>
            )}

            {forgotSuccess && (
              <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 font-semibold leading-relaxed">
                ✅ {forgotSuccess}
              </div>
            )}

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 text-sm outline-none transition"
                  placeholder="e.g. admin@organization.com"
                />
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-3 rounded-xl shadow-sm transition disabled:bg-slate-400 flex items-center justify-center space-x-2 text-sm mt-6 cursor-pointer"
              >
                {forgotLoading ? (
                  <span>Menghantar pautan...</span>
                ) : (
                  <span>Hantar Pautan Pemulihan</span>
                )}
              </button>
            </form>

            <div className="mt-6 text-center border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => { setIsForgotPasswordView(false); setForgotError(null); setForgotSuccess(null); }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
              >
                Kembali ke Log Masuk
              </button>
            </div>
          </div>
        ) : isLoginView ? (
          /* Login View */
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => { setIsForgotPasswordView(true); setForgotEmail(loginEmail); setLoginError(null); }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                  >
                    Lupa kata laluan?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-3 pr-10 text-sm outline-none transition"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                    aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                  >
                    {showLoginPassword ? (
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
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
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

                  <div className="relative">
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regAdminPassword}
                      onChange={(e) => setRegAdminPassword(e.target.value)}
                      required
                      className="block w-full border border-slate-300 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 p-2.5 pr-10 text-sm outline-none transition"
                      placeholder="Password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                      aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                    >
                      {showRegPassword ? (
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
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 transition cursor-pointer"
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
