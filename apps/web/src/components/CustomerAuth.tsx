import React, { useEffect, useState } from 'react';
import { Mail, Lock, ArrowRight, User as UserIcon, Phone, MapPin } from 'lucide-react';
import { User as UserType } from '../types';
import { api, isApiEnabled, setToken } from '../lib/apiClient';
import { canUseAdminPanel, isStaffRole } from '../lib/roles';

interface CustomerAuthProps {
  onLoginSuccess: (user: UserType, autoSave?: boolean) => void;
  onCancel: () => void;
  isCheckoutRedirect?: boolean;
  initialMode?: 'login' | 'signup';
}

export const CustomerAuth: React.FC<CustomerAuthProps> = ({
  onLoginSuccess,
  onCancel,
  isCheckoutRedirect = false,
  initialMode = 'signup',
}) => {
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [district, setDistrict] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (mode === 'signup') {
      if (!fullName.trim() || !address.trim() || !phone.trim() || !email.trim() || !password) {
        setError('Please fill in name, address, mobile, email, and password.');
        return;
      }
      if (phone.trim().length < 8) {
        setError('Please enter a valid mobile number.');
        return;
      }
    } else if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!isApiEnabled()) {
      setError('Sign-in requires the live API. Start with npm run dev:all.');
      return;
    }

    setBusy(true);
    try {
      const result =
        mode === 'signup'
          ? await api.register({
              email: email.toLowerCase().trim(),
              password,
              fullName: fullName.trim(),
              phone: phone.trim(),
              address: address.trim(),
              city: district.trim() || undefined,
            })
          : await api.login(email.toLowerCase().trim(), password);

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

      if (isStaffRole(user.role) || canUseAdminPanel(user.role, true, isApiEnabled())) {
        onLoginSuccess(user, true);
        return;
      }

      onLoginSuccess(user, true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-10 md:my-14 bg-[#121212] border border-zinc-700 rounded-3xl p-6 sm:p-8 shadow-md animate-fadeIn text-white">
      <div className="text-center space-y-2 mb-6">
        <span className="h-1.5 w-8 bg-red-600 rounded-full inline-block" />
        <h2 className="text-2xl font-black uppercase tracking-tight text-white">
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        <p className="text-[13px] text-zinc-300 font-medium leading-relaxed">
          {isCheckoutRedirect
            ? 'Sign up first to save your address, then place your order. Already have an account? Use Login.'
            : 'Sign up with name, address, mobile, and email. Your address is saved to your profile for checkout.'}
        </p>
      </div>

      <div className="flex rounded-xl border border-zinc-700 overflow-hidden mb-6">
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer ${
            mode === 'signup' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
          }`}
        >
          Sign Up
        </button>
        <button
          type="button"
          onClick={() => setMode('login')}
          className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-wider cursor-pointer ${
            mode === 'login' ? 'bg-red-600 text-white' : 'bg-zinc-900 text-zinc-400'
          }`}
        >
          Login
        </button>
      </div>

      {error && (
        <div className="bg-red-950/80 border border-red-500 text-red-100 text-[13px] p-3 rounded-xl mb-5 text-center font-semibold">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'signup' && (
          <>
            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">Full name *</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="w-full bg-white border border-zinc-300 rounded-xl py-3 pl-11 pr-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600"
                />
                <UserIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">Address *</label>
              <div className="relative">
                <textarea
                  required
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="House, road, area"
                  className="w-full bg-white border border-zinc-300 rounded-xl py-3 pl-11 pr-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600 resize-none"
                />
                <MapPin size={16} className="absolute left-4 top-3.5 text-zinc-600" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">District (optional)</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="e.g. Feni"
                className="w-full bg-white border border-zinc-300 rounded-xl py-3 px-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">Mobile *</label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-white border border-zinc-300 rounded-xl py-3 pl-11 pr-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600"
                />
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
              </div>
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">Email *</label>
          <div className="relative">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="w-full bg-white border border-zinc-300 rounded-xl py-3 pl-11 pr-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600"
            />
            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] text-zinc-300 font-bold uppercase tracking-wide">Password *</label>
          <div className="relative">
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="w-full bg-white border border-zinc-300 rounded-xl py-3 pl-11 pr-4 text-[14px] font-semibold text-zinc-950 placeholder:text-zinc-500 focus:outline-none focus:border-red-600"
            />
            <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-extrabold text-[13px] uppercase tracking-widest py-3.5 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
        >
          {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          {!busy && <ArrowRight size={16} />}
        </button>
      </form>

      <button
        type="button"
        onClick={onCancel}
        className="w-full mt-4 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-900 border border-zinc-700 text-white hover:border-red-600 hover:bg-zinc-800 text-sm font-black uppercase tracking-wide cursor-pointer transition-colors"
      >
        {isCheckoutRedirect ? 'Back to bag' : 'Go to Home'}
      </button>
    </div>
  );
};
