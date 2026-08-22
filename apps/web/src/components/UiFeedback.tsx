'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type ToastItem = {
  id: number;
  message: string;
  tone: ToastTone;
};

type ConfirmState = ConfirmOptions & {
  resolve: (ok: boolean) => void;
};

type HostApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  toast: (message: string, tone?: ToastTone) => void;
};

let hostApi: HostApi | null = null;
let toastId = 0;

function ensureHost(): HostApi {
  if (!hostApi) {
    // Fallback before React mounts (or offline scripts)
    return {
      confirm: (opts) => Promise.resolve(window.confirm(opts.message)),
      toast: (message) => window.alert(message),
    };
  }
  return hostApi;
}

/** Branded confirm — replaces window.confirm */
export function confirmAsync(messageOrOpts: string | ConfirmOptions): Promise<boolean> {
  const opts: ConfirmOptions =
    typeof messageOrOpts === 'string' ? { message: messageOrOpts } : messageOrOpts;
  return ensureHost().confirm(opts);
}

/** Branded toast — replaces window.alert for feedback */
export function toast(message: string, tone: ToastTone = 'info') {
  ensureHost().toast(message, tone);
}

export function UiFeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const askConfirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirm({ ...opts, resolve });
    });
  }, []);

  useEffect(() => {
    hostApi = { confirm: askConfirm, toast: pushToast };
    return () => {
      hostApi = null;
    };
  }, [askConfirm, pushToast]);

  const closeConfirm = (ok: boolean) => {
    confirm?.resolve(ok);
    setConfirm(null);
  };

  return (
    <>
      {/* Toasts */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {toasts.map((t) => {
          const Icon =
            t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
          const toneCls =
            t.tone === 'success'
              ? 'border-emerald-200 bg-white text-emerald-950'
              : t.tone === 'error'
                ? 'border-red-200 bg-white text-red-950'
                : 'border-emerald-100 bg-white text-emerald-950';
          const iconCls =
            t.tone === 'success'
              ? 'text-emerald-700'
              : t.tone === 'error'
                ? 'text-red-600'
                : 'text-emerald-700';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border shadow-lg px-4 py-3 ${toneCls}`}
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${iconCls}`} />
              <p className="text-xs font-semibold leading-relaxed flex-1 whitespace-pre-line">{t.message}</p>
              <button
                type="button"
                className="text-emerald-700/60 hover:text-emerald-950 cursor-pointer shrink-0"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div
          className="fixed inset-0 z-[110] bg-emerald-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl border border-emerald-100 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 flex gap-4">
              <div
                className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${
                  confirm.danger ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-800'
                }`}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h3 className="text-base font-black text-emerald-950 uppercase tracking-tight">
                  {confirm.title || (confirm.danger ? 'Confirm delete' : 'Please confirm')}
                </h3>
                <p className="text-sm text-emerald-800/90 leading-relaxed whitespace-pre-line">
                  {confirm.message}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-emerald-50/40 border-t border-emerald-100 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase text-emerald-800 hover:bg-white cursor-pointer transition-colors"
              >
                {confirm.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-white cursor-pointer transition-colors ${
                  confirm.danger
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-emerald-800 hover:bg-emerald-900'
                }`}
              >
                {confirm.confirmText || (confirm.danger ? 'Delete' : 'OK')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
