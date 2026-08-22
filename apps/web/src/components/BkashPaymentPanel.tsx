import React from 'react';
import { BKASH_PARTIAL_PER_JERSEY_BDT } from '../lib/bkashPayment';

export const BKASH_DEFAULT_NUMBER = '01840990700';
export const BKASH_PARTIAL_DEFAULT_BDT = BKASH_PARTIAL_PER_JERSEY_BDT;

/** Public asset — works on localhost and production (served from /public). */
export const BKASH_PAYMENT_QR_SRC = '/bkash-payment-qr.png';

type BkashPaymentPanelProps = {
  selected: boolean;
  onSelect: () => void;
  personalNumber?: string;
  /** Amount customer must Send Money (BDT) — full order total or partial advance */
  sendMoneyAmountBdt: number;
  /** When true, remainder is collected on delivery */
  isPartialPayment?: boolean;
  /** Optional due-on-delivery amount for partial breakdown */
  dueOnDeliveryBdt?: number;
  /** e.g. "৳300 × 2 jerseys = ৳600" */
  partialBreakdownLabel?: string;
  customerBkashNumber: string;
  transactionId: string;
  onCustomerBkashNumberChange: (v: string) => void;
  onTransactionIdChange: (v: string) => void;
  compact?: boolean;
};

function formatBdtAmount(amount: number): string {
  return `৳${Math.round(amount).toLocaleString('en-BD')}`;
}

/** Manual Send Money / QR payment block — used on every product checkout for all users. */
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
}) => {
  const amountLabel = Math.round(sendMoneyAmountBdt).toLocaleString('en-BD');

  return (
    <div
      className={`rounded-xl border-2 transition-all ${
        selected ? 'border-[#E2136E] bg-[#E2136E]/[0.04]' : 'border-zinc-200 bg-white'
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="w-full flex items-center gap-3 p-3 text-left cursor-pointer"
      >
        <span
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
            selected ? 'border-[#E2136E]' : 'border-zinc-400'
          }`}
        >
          {selected && <span className="w-2 h-2 rounded-full bg-[#E2136E]" />}
        </span>
        <span className="flex items-center gap-2 flex-1 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#E2136E] text-white font-black text-[10px] tracking-tight flex-shrink-0">
            bK
          </span>
          <span className="font-black text-sm text-zinc-950 uppercase tracking-wide">bKash</span>
          <span className="text-[10px] font-mono font-bold text-[#E2136E] ml-auto">
            {formatBdtAmount(sendMoneyAmountBdt)}
            {isPartialPayment ? ' (advance)' : ''}
          </span>
        </span>
      </button>

      {selected && (
        <div className={`px-3 pb-3 space-y-4 ${compact ? 'pt-0' : 'pt-1'}`}>
          {/* QR Code — visible to all shoppers on every order checkout */}
          <div className="rounded-xl border-2 border-[#E2136E]/30 bg-white p-4 space-y-3">
            <div className="text-center space-y-1">
              <p className="text-sm font-black text-zinc-950 leading-snug">
                QR কোড স্ক্যান করে সহজে পেমেন্ট করুন
              </p>
              <p className="text-[11px] text-zinc-700 leading-relaxed">
                সবচেয়ে দ্রুত ও ঝামেলামুক্ত উপায়ে পেমেন্ট করতে নিচের QR Code স্ক্যান করুন।
              </p>
            </div>

            <div className="flex justify-center">
              <div className="w-full max-w-[260px] rounded-2xl overflow-hidden border border-[#E2136E]/20 shadow-sm bg-[#E2136E]">
                <img
                  src={BKASH_PAYMENT_QR_SRC}
                  alt="Payment QR Code — Scan to pay with bKash, Nagad, Rocket or bank apps"
                  width={520}
                  height={520}
                  className="w-full h-auto block"
                  loading="eager"
                  decoding="async"
                />
              </div>
            </div>

            <div className="text-[11px] text-zinc-800 leading-relaxed space-y-2">
              <p className="font-black text-zinc-950">
                ✅ এই QR Code দিয়ে আপনি সহজেই পেমেন্ট করতে পারবেন:
              </p>
              <ul className="list-disc list-inside space-y-0.5 pl-0.5 text-zinc-800">
                <li>বিকাশ (bKash)</li>
                <li>নগদ (Nagad)</li>
                <li>রকেট (Rocket)</li>
                <li>সকল ব্যাংক মোবাইল অ্যাপ</li>
                <li>VISA / Mastercard সমর্থিত ব্যাংকিং অ্যাপ</li>
                <li>যেকোনো QR সমর্থিত ডিজিটাল ওয়ালেট</li>
              </ul>

              <div className="pt-1 space-y-1.5 border-t border-zinc-200">
                <p className="font-black text-zinc-950">কীভাবে পেমেন্ট করবেন?</p>
                <ol className="list-decimal list-inside space-y-1 pl-0.5">
                  <li>আপনার পছন্দের মোবাইল ব্যাংকিং বা ব্যাংক অ্যাপ খুলুন।</li>
                  <li>Scan QR / Scan &amp; Pay অপশন নির্বাচন করুন।</li>
                  <li>উপরের QR Code স্ক্যান করুন।</li>
                  <li>
                    অর্ডারের মোট পরিমাণ প্রদান করুন{' '}
                    <strong className="text-[#E2136E]">({amountLabel} টাকা)</strong>
                    {isPartialPayment ? ' — আংশিক এডভান্স' : ''}।
                  </li>
                  <li>
                    পেমেন্ট সম্পন্ন হলে নিচে আপনার মোবাইল নম্বর এবং Transaction ID (TrxID) লিখে অর্ডার
                    সম্পন্ন করুন।
                  </li>
                </ol>
              </div>
            </div>
          </div>

          <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3 text-[11px] text-zinc-800 leading-relaxed space-y-2">
            <p className="font-black text-zinc-950 text-xs">অথবা Send Money করে পেমেন্ট করুন</p>
            <p>
              অনুগ্রহ করে নিচের বিকাশ পার্সোনাল নম্বরে{' '}
              <strong>অবশ্যই Send Money-এর মাধ্যমে {amountLabel} টাকা</strong> পাঠান।
            </p>
            <p>
              <strong>বিকাশ পার্সোনাল নম্বর:</strong>{' '}
              <span className="font-mono font-black tracking-wide text-[#E2136E]">{personalNumber}</span>
            </p>
            <p>
              <strong>পেমেন্টের পরিমাণ:</strong>{' '}
              <strong>{amountLabel} টাকা</strong>
              {isPartialPayment ? ' (advance / আংশিক)' : ''}
            </p>
            {isPartialPayment && partialBreakdownLabel && (
              <p className="font-mono font-bold text-zinc-900">
                Advance breakdown: {partialBreakdownLabel}
              </p>
            )}
            {isPartialPayment && dueOnDeliveryBdt > 0 && (
              <p>
                <strong>ডেলিভারিতে বাকি:</strong>{' '}
                <strong className="font-mono">{formatBdtAmount(dueOnDeliveryBdt)}</strong>
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-600 mb-1 block">
                মোবাইল নম্বর
              </span>
              <input
                type="tel"
                inputMode="numeric"
                placeholder="017XXXXXXXX"
                value={customerBkashNumber}
                onChange={(e) => onCustomerBkashNumberChange(e.target.value)}
                className="w-full border-2 border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-950 focus:outline-none focus:border-[#E2136E] bg-white"
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
                className="w-full border-2 border-zinc-300 rounded-lg px-3 py-2 text-sm font-mono font-bold text-zinc-950 focus:outline-none focus:border-[#E2136E] bg-white uppercase"
                required={selected}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
