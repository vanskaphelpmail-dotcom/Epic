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
  return `৳${Math.round(Number(amount) || 0).toLocaleString('en-BD')}`;
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
  const amountLabel = formatBdtAmount(sendMoneyAmountBdt);
  const merchantNumber = personalNumber || BKASH_DEFAULT_NUMBER;
  const walletName = walletProvider === 'nagad' ? 'Nagad' : 'bKash';

  return (
    <div
      className={`rounded-xl border transition-all bg-white ${
        selected ? 'border-[#0A0A0A]' : 'border-[#E5E5E5]'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <span
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'border-[#0A0A0A]' : 'border-[#E5E5E5]'
          }`}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-[#0A0A0A]" />}
        </span>
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#0A0A0A] text-white font-black text-[9px] tracking-tight flex-shrink-0">
            SM
          </span>
          <span className="font-black text-sm text-[#0A0A0A] uppercase tracking-wide">
            bKash / Nagad
          </span>
          <span className="text-[10px] font-mono font-bold text-[#555555] ml-auto">
            {formatBdtAmount(sendMoneyAmountBdt)}
            {isPartialPayment ? ' (advance)' : ''}
          </span>
        </span>
      </button>

      {selected && (
        <div className={`px-3 pb-3 space-y-4 ${compact ? 'pt-0' : 'pt-1'}`}>
          <div className="rounded-xl border border-[#E5E5E5] bg-[#F8F8F7] p-4 space-y-3">
            <p className="text-sm font-black text-[#0A0A0A] leading-snug">
              Send Money দিয়ে পেমেন্ট করুন
            </p>
            <p className="text-[11px] text-[#555555] leading-relaxed">
              অর্ডার নিশ্চিত করতে নিচের পরিমাণ{' '}
              <strong className="text-[#0A0A0A]">{amountLabel}</strong>
              {isPartialPayment ? ' (আংশিক এডভান্স)' : ''} bKash অথবা Nagad{' '}
              <strong className="text-[#0A0A0A]">Send Money</strong>-এর মাধ্যমে পাঠান।
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onWalletProviderChange?.('bkash')}
                className={`rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer ${
                  walletProvider === 'bkash'
                    ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                    : 'border-[#E5E5E5] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]/40'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider">bKash</span>
                <span
                  className={`block text-[9px] mt-0.5 ${
                    walletProvider === 'bkash' ? 'text-white/70' : 'text-[#555555]'
                  }`}
                >
                  Send Money
                </span>
              </button>
              <button
                type="button"
                onClick={() => onWalletProviderChange?.('nagad')}
                className={`rounded-lg border px-3 py-2.5 text-left transition-all cursor-pointer ${
                  walletProvider === 'nagad'
                    ? 'border-[#0A0A0A] bg-[#0A0A0A] text-white'
                    : 'border-[#E5E5E5] bg-white text-[#0A0A0A] hover:border-[#0A0A0A]/40'
                }`}
              >
                <span className="block text-[10px] font-black uppercase tracking-wider">Nagad</span>
                <span
                  className={`block text-[9px] mt-0.5 ${
                    walletProvider === 'nagad' ? 'text-white/70' : 'text-[#555555]'
                  }`}
                >
                  Send Money
                </span>
              </button>
            </div>

            <div className="rounded-lg border border-[#E5E5E5] bg-white px-3 py-2.5 space-y-1">
              <p className="text-[10px] font-black uppercase tracking-wider text-[#555555]">
                {walletName} Personal Number (Send Money)
              </p>
              <p className="font-mono font-black text-base tracking-wide text-[#0A0A0A]">
                {merchantNumber}
              </p>
              <p className="text-[10px] text-[#555555]">
                Same number for bKash and Nagad Send Money
              </p>
            </div>

            <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#555555] leading-relaxed">
              <li>
                {walletName} অ্যাপ খুলে <strong className="text-[#0A0A0A]">Send Money</strong> নির্বাচন
                করুন।
              </li>
              <li>
                নম্বর <strong className="font-mono text-[#0A0A0A]">{merchantNumber}</strong>-এ{' '}
                <strong className="text-[#0A0A0A]">{amountLabel}</strong> পাঠান
                {isPartialPayment ? ' (এডভান্স)' : ''}।
              </li>
              <li>পেমেন্ট সম্পন্ন হলে নিচে আপনার মোবাইল নম্বর ও Transaction ID (TrxID) লিখুন।</li>
            </ol>

            {isPartialPayment && partialBreakdownLabel && (
              <p className="font-mono font-bold text-[#0A0A0A] text-[11px]">
                Advance breakdown: {partialBreakdownLabel}
              </p>
            )}
            {isPartialPayment && dueOnDeliveryBdt > 0 && (
              <p className="text-[11px] text-[#555555]">
                <strong className="text-[#0A0A0A]">ডেলিভারিতে বাকি:</strong>{' '}
                <strong className="font-mono text-[#0A0A0A]">
                  {formatBdtAmount(dueOnDeliveryBdt)}
                </strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#555555] mb-1 block">
                আপনার {walletName} নম্বর
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="017XXXXXXXX"
                value={customerBkashNumber}
                onChange={(e) => onCustomerBkashNumberChange(e.target.value)}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#0A0A0A] placeholder:text-[#555555]/50 focus:outline-none focus:border-[#0A0A0A] bg-white"
                required={selected}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#555555] mb-1 block">
                ট্রানজ্যাকশন আইডি (TrxID)
              </span>
              <input
                type="text"
                placeholder="8N7A6D5EE7M"
                value={transactionId}
                onChange={(e) => onTransactionIdChange(e.target.value.toUpperCase())}
                className="w-full border border-[#E5E5E5] rounded-lg px-3 py-2 text-sm font-mono font-bold text-[#0A0A0A] placeholder:text-[#555555]/50 focus:outline-none focus:border-[#0A0A0A] bg-white uppercase"
                required={selected}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
