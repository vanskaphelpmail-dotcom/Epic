import React, { useEffect, useState } from 'react';
import { Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { User as UserType } from '../types';
import { api, isApiEnabled, setToken } from '../lib/apiClient';
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
      const user: UserType = {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        phone: result.user.phone,
        permissions: result.user.permissions,
        accessFlags: result.user.accessFlags,
      };

      if (!canUseAdminPanel(user.role, true, true)) {
        setError('Only admin accounts can sign in here.');
        return;
      }

      setToken(result.token, { persist: true });
      setSuccess(`Welcome back, ${user.fullName}!`);
      setTimeout(() => onLoginSuccess(user, true), 600);
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
    <div className="max-w-md mx-auto my-12 bg-white border border-zinc-100 rounded-3xl p-8 shadow-md relative overflow-hidden animate-fadeIn text-zinc-950">
      <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-500/5 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-zinc-500/5 rounded-full blur-2xl pointer-events-none" />

      <div className="bg-zinc-50 border-2 border-zinc-200 rounded-2xl p-4 mb-6 space-y-1 text-center">
        <p className="text-xs font-black uppercase text-zinc-950 font-mono">Private admin portal</p>
        <p className="text-[10px] text-zinc-800 font-bold leading-normal font-sans">
          This page is not linked from the public store. Customer login is disabled — anyone can order without an account.
        </p>
      </div>

      <div className="text-center space-y-2 mb-8">
        <span className="h-1.5 w-8 bg-black rounded-full inline-block" />
        <h2 className="text-2xl font-black uppercase tracking-tight font-sans text-zinc-950">{titles[mode].h}</h2>
        <p className="text-xs text-zinc-700 font-mono">{titles[mode].p}</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-100 text-red-700 text-xs p-3.5 rounded-xl mb-6 text-center font-semibold font-mono">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-zinc-50 border border-zinc-100 text-zinc-800 text-xs p-3.5 rounded-xl mb-6 text-center font-bold font-mono">
          {success}
        </div>
      )}

      {mode === 'forgot' ? (
        <form onSubmit={handleForgot} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-700 font-mono block uppercase">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-zinc-100 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl"
          >
            {busy ? 'Please wait…' : 'Send Reset'}
          </button>
        </form>
      ) : mode === 'reset' ? (
        <form onSubmit={handleReset} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-700 font-mono block uppercase">Reset Token</label>
            <div className="relative">
              <input
                type="text"
                required
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                className="w-full bg-white border border-zinc-100 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <KeyRound size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-700 font-mono block uppercase">New Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-zinc-100 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
            </div>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl"
          >
            {busy ? 'Please wait…' : 'Update Password'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-700 font-mono block uppercase">Admin Email</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white border border-zinc-100 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <Mail size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-zinc-700 font-mono block uppercase">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white border border-zinc-100 rounded-xl py-3 pl-11 pr-4 text-xs text-zinc-950 focus:outline-none focus:border-zinc-900 transition-colors"
              />
              <Lock size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-black hover:bg-zinc-800 disabled:opacity-60 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            {busy ? 'Please wait…' : 'Admin Sign In'}
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>
      )}

      <div className="mt-8 border-t border-zinc-100 pt-4 text-center space-y-2">
        {mode === 'login' && (
          <button
            type="button"
            onClick={() => {
              setMode('forgot');
              setError('');
              setSuccess('');
            }}
            className="block w-full text-xs text-zinc-700 hover:text-black font-bold underline"
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
            className="text-xs text-zinc-800 hover:text-black font-bold underline transition-colors"
          >
            Back to Admin Sign In
          </button>
        )}
      </div>
    </div>
  );
};
