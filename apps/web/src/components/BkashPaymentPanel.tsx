import React from 'react';
import { BKASH_PARTIAL_PER_JERSEY_BDT } from '../lib/bkashPayment';

export const BKASH_DEFAULT_NUMBER = '01865962232';
export const BKASH_PARTIAL_DEFAULT_BDT = BKASH_PARTIAL_PER_JERSEY_BDT;

export type MobileWalletProvider = 'bkash' | 'nagad';

type BkashPaymentPanelProps = {
  selected: boolean;
  onSelect: () => void;
  /** Merchant personal number for bKash / Nagad Send Money */
  personalNumber?: string;
  sendMoneyAmountBdt: number;
  isPartialPayment?: boolean;
  dueOnDeliveryBdt?: number;
  partialBreakdownLabel?: string;
  customerBkashNumber: string;
  transactionId: string;
  onCustomerBkashNumberChange: (v: string) => void;
  onTransactionIdChange: (v: string) => void;
  compact?: boolean;
  /** Which wallet the customer used for Send Money */
  walletProvider?: MobileWalletProvider;
  onWalletProviderChange?: (provider: MobileWalletProvider) => void;
};

function formatBdtAmount(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-BD')}`;
}

/** Manual bKash / Nagad Send Money (same personal number for both). */
export const BkashPaymentPanel: React.FC<BkashPaymentPanelProps> = ({
  selected,
  onSelect,
  personalNumber = BKASH_DEFAULT_NUMBER,
  sendMoneyAmountBdt,
  isPartialPayment = false,
  dueOnDeliveryBdt = 0,
  partialBreakdownLabel,
  customerBkashNumber,
  transactionId,
  onCustomerBkashNumberChange,
  onTransactionIdChange,
  compact = false,
  walletProvider = 'bkash',
  onWalletProviderChange,
}) => {
  const amountLabel = Math.round(sendMoneyAmountBdt).toLocaleString('en-BD');
  const merchantNumber = personalNumber || BKASH_DEFAULT_NUMBER;
  const walletName = walletProvider === 'nagad' ? 'Nagad' : 'bKash';

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        selected ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <span
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'border-zinc-900' : 'border-zinc-400'
          }`}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-zinc-900" />}
        </span>
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-black text-white font-black text-[9px] tracking-tight flex-shrink-0">
            SM
          </span>
          <span className="font-black text-sm text-zinc-950 uppercase tracking-wide">
            bKash / Nagad
          </span>
          <span className="text-[10px] font-mono font-bold text-zinc-700 ml-auto">
            {formatBdtAmount(sendMoneyAmountBdt)}
            {isPartialPayment ? ' (advance)' : ''}
          </span>
        </span>
      </button>

      {selected && (
        <div className={`px-3 pb-3 space-y-4 ${compact ? 'pt-0' : 'pt-1'}`}>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-3">
            <p className="text-sm font-black text-zinc-950 leading-snug">
              Send Money দিয়ে পেমেন্ট করুন
            </p>
            <p className="text-[11px] text-zinc-700 leading-relaxed">
              অর্ডার নিশ্চিত করতে নিচের পরিমাণ{' '}
              <strong className="text-zinc-950">{amountLabel} টাকা</strong>
              {isPartialPayment ? ' (আংশিক এডভান্স)' : ''} bKash অথবা Nagad{' '}
              <strong>Send Money</strong>-এর মাধ্যমে পাঠান।
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onWalletProviderChange?.('bkash')}
                className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all cursor-pointer ${
                  walletProvider === 'bkash'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider">bKash</span>
                <span className={`block text-[9px] mt-0.5 ${walletProvider === 'bkash' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  Send Money
                </span>
              </button>
              <button
                type="button"
                onClick={() => onWalletProviderChange?.('nagad')}
                className={`rounded-lg border-2 px-3 py-2.5 text-left transition-all cursor-pointer ${
                  walletProvider === 'nagad'
                    ? 'border-zinc-900 bg-zinc-900 text-white'
                    : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-400'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider">Nagad</span>
                <span className={`block text-[9px] mt-0.5 ${walletProvider === 'nagad' ? 'text-zinc-300' : 'text-zinc-500'}`}>
                  Send Money
                </span>
              </button>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-zinc-600">
                {walletName} Personal Number (Send Money)
              </p>
              <p className="font-mono font-black text-base tracking-wide text-zinc-950">
                {merchantNumber}
              </p>
              <p className="text-[10px] text-zinc-600">
                Same number for bKash and Nagad Send Money
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-800 leading-relaxed">
              <li>
                {walletName} অ্যাপ খুলে <strong>Send Money</strong> নির্বাচন করুন।
              </li>
              <li>
                নম্বর <strong className="font-mono">{merchantNumber}</strong>-এ{' '}
                <strong>{amountLabel} টাকা</strong> পাঠান
                {isPartialPayment ? ' (এডভান্স)' : ''}।
              </li>
              <li>পেমেন্ট সম্পন্ন হলে নিচে আপনার মোবাইল নম্বর ও Transaction ID (TrxID) লিখুন।</li>
            </ol>

            {isPartialPayment && partialBreakdownLabel && (
              <p className="font-mono font-bold text-zinc-900 text-[11px]">
                Advance breakdown: {partialBreakdownLabel}
              </p>
            )}
            {isPartialPayment && dueOnDeliveryBdt > 0 && (
              <p className="text-[11px] text-zinc-800">
                <strong>ডেলিভারিতে বাকি:</strong>{' '}
                <strong className="font-mono">{formatBdtAmount(dueOnDeliveryBdt)}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-1 block">
                আপনার {walletName} নম্বর
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="017XXXXXXXX"
                value={customerBkashNumber}
                onChange={(e) => onCustomerBkashNumberChange(e.target.value)}
                className="w-full border-2 border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-900 bg-white"
                required={selected}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-1 block">
                ট্রানজ্যাকশন আইডি (TrxID)
              </span>
              <input
                type="text"
                placeholder="8N7A6D5EE7M"
                value={transactionId}
                onChange={(e) => onTransactionIdChange(e.target.value.toUpperCase())}
                className="w-full border-2 border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-950 focus:outline-none focus:border-zinc-900 bg-white uppercase"
                required={selected}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
