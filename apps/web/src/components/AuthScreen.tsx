import React, { useEffect, useState } from 'react';
import { Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';
import { api, clearSession, isApiEnabled, setToken } from '../lib/apiClient';
import { canUseAdminPanel } from '../lib/roles';

interface AuthScreenProps {
  onLoginSuccess: (user: UserType, autoSave: boolean) => void;
  usersList: UserType[];
  onRegisterUser: (newUser: UserType) => void;
  onCancel: () => void;
  isCheckoutRedirect?: boolean;
  isStaffLogin?: boolean;
}

type AuthMode = 'login' | 'forgot' | 'reset';

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onLoginSuccess,
  onCancel: _onCancel,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setMode('login');
  }, []);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!email) {
      setError('Enter your admin email.');
      return;
    }
    if (!isApiEnabled()) {
      setError('Password reset requires the API connection.');
      return;
    }
    setBusy(true);
    try {
      const result = await api.forgotPassword(email.toLowerCase().trim());
      setSuccess(result.message || 'If that email exists, a reset link was prepared.');
      if (result.devResetToken) {
        setResetToken(result.devResetToken);
        setMode('reset');
        setSuccess('Dev reset token ready — enter a new password below.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start password reset');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!resetToken || password.length < 6) {
      setError('Reset token and a password (6+ chars) are required.');
      return;
    }
    setBusy(true);
    try {
      await api.resetPassword(resetToken.trim(), password);
      setSuccess('Password updated. You can sign in now.');
      setMode('login');
      setPassword('');
      setResetToken('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Password reset failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    setBusy(true);
    try {
      if (!isApiEnabled()) {
        setError('Admin sign-in requires the live API. Start with npm run dev:all.');
        return;
      }

      const result = await api.login(email.toLowerCase().trim(), password);
      // Persist JWT immediately so redirect / panel gates see a live session
      setToken(result.token, { persist: true });

      const user: UserType = {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        phone: result.user.phone,
        permissions: result.user.permissions,
        accessFlags: result.user.accessFlags,
      };

      if (!canUseAdminPanel(user.role, true, isApiEnabled())) {
        clearSession();
        setError('Only admin accounts can sign in here. Use Login on the storefront for customer accounts.');
        return;
      }

      setSuccess(`Welcome back, ${user.fullName}!`);
      onLoginSuccess(user, true);
    } catch (apiErr) {
      setError(apiErr instanceof Error ? apiErr.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  const titles: Record<AuthMode, { h: string; p: string }> = {
    login: { h: 'Admin Sign In', p: 'Authorized staff access only' },
    forgot: { h: 'Forgot Password', p: 'We will prepare a reset token for your admin account' },
    reset: { h: 'Choose New Password', p: 'Paste your reset token and set a new password' },
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-[#121212] border border-zinc-700 rounded-3xl p-8 shadow-md relative overflow-hidden animate-fadeIn text-white">
      <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-950/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-zinc-950/5 rounded-full blur-2xl pointer-events-none" />

      <div className="bg-zinc-900 border border-zinc-600 rounded-2xl p-4 mb-6 space-y-1.5 text-center">
        <p className="text-[13px] font-black uppercase text-white tracking-wide">Private admin portal</p>
        <p className="text-[13px] text-zinc-200 font-semibold leading-relaxed">
          This page is for authorized staff only. Customers sign in from the storefront Login / Sign Up buttons.
        </p>
      </div>

      <div className="text-center space-y-2 mb-8">
        <span className="h-1.5 w-8 bg-red-600 rounded-full inline-block" />
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">{titles[mode].h}</h2>
        <p className="text-[14px] text-zinc-200 font-semibold">{titles[mode].p}</p>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-500 text-red-100 text-[13px] p-3.5 rounded-xl mb-6 text-center font-semibold">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-zinc-800 border border-zinc-500 text-zinc-100 text-[13px] p-3.5 rounded-xl mb-6 text-center font-semibold">
          {success}
        </div>
      )}

      {mode === 'forgot' ? (
        <form onSubmit={handleForgot} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-100 font-bold block uppercase tracking-wide">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@email.com"
                className="w-full bg-white border border-zinc-300 rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-colors"
              />
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-[14px] uppercase tracking-widest py-3.5 rounded-xl"
          >
            {busy ? 'Please wait…' : 'Send Reset'}
          </button>
        </form>
      ) : mode === 'reset' ? (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-100 font-bold block uppercase tracking-wide">Reset Token</label>
            <div className="relative">
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-colors"
              />
              <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-100 font-bold block uppercase tracking-wide">New Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-zinc-300 rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-colors"
              />
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-[14px] uppercase tracking-widest py-3.5 rounded-xl"
          >
            {busy ? 'Please wait…' : 'Update Password'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-100 font-bold block uppercase tracking-wide">Admin Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@email.com"
                className="w-full bg-white border border-zinc-300 rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-colors"
              />
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[13px] text-zinc-100 font-bold block uppercase tracking-wide">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full bg-white border border-zinc-300 rounded-xl py-3.5 pl-11 pr-4 text-[15px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 focus:ring-2 focus:ring-red-600/30 transition-colors"
              />
              <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-[15px] uppercase tracking-widest py-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            {busy ? 'Please wait…' : 'Admin Sign In'}
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      )}

      <div className="mt-8 border-t border-zinc-700 pt-5 text-center space-y-2">
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError('');
              setSuccess('');
            }}
            className="block w-full text-[14px] text-zinc-100 hover:text-white font-bold underline underline-offset-4"
          >
            Forgot password?
          </button>
        )}
        {mode !== 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
              setSuccess('');
            }}
            className="text-[14px] text-zinc-100 hover:text-white font-bold underline underline-offset-4 transition-colors"
          >
            Back to Admin Sign In
          </button>
        )}
      </div>
    </div>
  );
};
