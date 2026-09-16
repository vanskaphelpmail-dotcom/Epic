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
  const text =
    typeof message === 'string' && message && message !== '[object Object]'
      ? message
      : message && typeof message === 'object' && message !== null && 'message' in (message as object)
        ? String((message as { message?: unknown }).message || 'Something went wrong')
        : String(message || 'Something went wrong');
  ensureHost().toast(text === '[object Object]' ? 'Something went wrong' : text, tone);
}

export function UiFeedbackHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const pushToast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = ++toastId;
    const text =
      typeof message === 'string' && message !== '[object Object]'
        ? message
        : 'Something went wrong';
    setToasts((prev) => [...prev.slice(-4), { id, message: text, tone }]);
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
      <div className="fixed top-4 right-4 z-[1200] flex flex-col gap-2 max-w-sm w-[calc(100%-2rem)] pointer-events-none">
        {toasts.map((t) => {
          const Icon =
            t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? XCircle : Info;
          const toneCls =
            t.tone === 'success'
              ? 'border-zinc-300 bg-white text-zinc-950'
              : t.tone === 'error'
                ? 'border-zinc-900 bg-white text-zinc-950'
                : 'border-zinc-300 bg-white text-zinc-950';
          const iconCls =
            t.tone === 'success'
              ? 'text-zinc-950'
              : t.tone === 'error'
                ? 'text-zinc-950'
                : 'text-zinc-700';
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-lg px-4 py-3 ${toneCls}`}
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${iconCls}`} strokeWidth={2.25} />
              <p className="text-[13px] font-semibold leading-relaxed flex-1 whitespace-pre-line text-zinc-950">
                {t.message}
              </p>
              <button
                type="button"
                className="text-zinc-700 hover:text-zinc-950 cursor-pointer shrink-0"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                aria-label="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Confirm modal — above product/editor portals (z-200+) */}
      {confirm && (
        <div
          className="fixed inset-0 z-[1100] bg-zinc-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => closeConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl border border-zinc-200 shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 pt-6 pb-4 flex gap-4">
              <div
                className={`shrink-0 h-11 w-11 rounded-xl flex items-center justify-center ${
                  confirm.danger ? 'bg-zinc-100 text-zinc-950 border border-zinc-300' : 'bg-zinc-100 text-zinc-950 border border-zinc-300'
                }`}
              >
                <AlertTriangle size={22} />
              </div>
              <div className="min-w-0 space-y-1.5">
                <h3 className="text-base font-black text-zinc-950 uppercase tracking-tight">
                  {confirm.title || (confirm.danger ? 'Confirm delete' : 'Please confirm')}
                </h3>
                <p className="text-sm text-zinc-700 font-medium leading-relaxed whitespace-pre-line">
                  {confirm.message}
                </p>
              </div>
            </div>
            <div className="px-6 py-4 bg-zinc-50 border-t border-zinc-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase text-zinc-800 hover:bg-zinc-100 border border-zinc-300 cursor-pointer transition-colors"
              >
                {confirm.cancelText || 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className="px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-white bg-zinc-950 hover:bg-zinc-800 cursor-pointer transition-colors"
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
