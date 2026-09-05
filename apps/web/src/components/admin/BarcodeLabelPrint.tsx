'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

export type BarcodeLabelItem = {
  shopName: string;
  barcode: string;
  sellPriceLabel: string;
  productName?: string;
  category?: string;
  /** City / branch under shop name (OUDS-style) */
  location?: string;
};

type Props = {
  open: boolean;
  items: BarcodeLabelItem[];
  onClose: () => void;
  showSetup?: boolean;
};

const MAX_LABELS = 200;
/** Clean sticker proportions (similar to OUDS thermal label) */
const LABEL_W_PX = 210;
const LABEL_H_PX = 130;

/** Classic clean Code-128 bars — no digits inside the graphic */
function renderBarcodePattern(el: SVGSVGElement, value: string) {
  const code = value.trim();
  if (!code) return;
  try {
    JsBarcode(el, code, {
      format: 'CODE128',
      width: 2.15,
      height: 56,
      displayValue: false,
      textMargin: 0,
      fontSize: 0,
      margin: 6,
      marginTop: 0,
      marginBottom: 0,
      marginLeft: 8,
      marginRight: 8,
      background: '#ffffff',
      lineColor: '#000000',
    });
  } catch {
    /* invalid barcode */
  }
}

function LabelFace({
  shopName,
  location,
  barcode,
  svgRef,
}: {
  shopName: string;
  location: string;
  barcode: string;
  svgRef?: (el: SVGSVGElement | null) => void;
}) {
  return (
    <div
      className="barcode-label-card border border-dashed border-zinc-300 bg-white flex flex-col items-center text-center print:break-inside-avoid"
      style={{
        width: LABEL_W_PX,
        height: LABEL_H_PX,
        maxWidth: '100%',
        padding: '12px 14px 10px',
        fontFamily: 'Inter, Arial, Helvetica, sans-serif',
      }}
    >
      <p
        className="text-black uppercase leading-none"
        style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.06em' }}
      >
        {shopName}
      </p>
      <p className="text-black leading-none" style={{ fontSize: 12, fontWeight: 400, marginTop: 5 }}>
        {location}
      </p>

      <div
        className="w-full flex items-center justify-center overflow-hidden"
        style={{ marginTop: 10, marginBottom: 8, minHeight: 56 }}
      >
        {svgRef ? (
          <svg
            ref={svgRef}
            className="block"
            style={{ width: '100%', maxWidth: '100%', height: 56 }}
          />
        ) : (
          <svg
            data-preview-barcode={barcode || ''}
            className="block barcode-setup-preview"
            style={{ width: '100%', maxWidth: '100%', height: 56 }}
          />
        )}
      </div>

      <p className="text-black leading-none tracking-wide" style={{ fontSize: 11, fontWeight: 400 }}>
        {barcode || '0000000000000'}
      </p>
    </div>
  );
}

/** Thermal labels — clean OUDS look: shop · city · barcode · digits */
export function BarcodeLabelPrint({ open, items, onClose, showSetup = true }: Props) {
  const base = items[0];
  const [step, setStep] = useState<'setup' | 'preview'>('setup');
  const [qtyInput, setQtyInput] = useState('1');
  const [barcode, setBarcode] = useState(base?.barcode || '');
  const [priceLabel, setPriceLabel] = useState(base?.sellPriceLabel || '');
  const [productName, setProductName] = useState(base?.productName || '');
  const [category, setCategory] = useState(base?.category || '');
  const [shopName, setShopName] = useState(base?.shopName || 'Epic Vanskap');
  const [location, setLocation] = useState(base?.location || 'Dhaka');
  const svgRefs = useRef<(SVGSVGElement | null)[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(showSetup ? 'setup' : 'preview');
    setQtyInput('1');
    setBarcode(base?.barcode || '');
    setPriceLabel(base?.sellPriceLabel || '');
    setProductName(base?.productName || '');
    setCategory(base?.category || '');
    setShopName(base?.shopName || 'Epic Vanskap');
    setLocation(base?.location || 'Dhaka');
  }, [
    open,
    base?.barcode,
    base?.sellPriceLabel,
    base?.productName,
    base?.category,
    base?.shopName,
    base?.location,
    showSetup,
  ]);

  useEffect(() => {
    const clear = () => document.body.classList.remove('print-barcode-labels');
    window.addEventListener('afterprint', clear);
    return () => {
      window.removeEventListener('afterprint', clear);
      clear();
    };
  }, []);

  const resolvedQty = useMemo(() => {
    const n = Math.floor(Number(qtyInput));
    if (!Number.isFinite(n) || n < 1) return 1;
    return Math.min(MAX_LABELS, n);
  }, [qtyInput]);

  const copies = useMemo(() => {
    return Array.from({ length: resolvedQty }, () => ({
      shopName: shopName.trim() || 'Epic Vanskap',
      location: location.trim() || 'Dhaka',
      barcode: barcode.trim(),
      sellPriceLabel: priceLabel,
      productName,
    }));
  }, [resolvedQty, barcode, priceLabel, productName, shopName, location]);

  useEffect(() => {
    if (!open || step !== 'preview') return;
    copies.forEach((item, i) => {
      const el = svgRefs.current[i];
      if (!el || !item.barcode) return;
      renderBarcodePattern(el, item.barcode);
    });
  }, [open, step, copies]);

  // Setup-step live barcode pattern preview
  useEffect(() => {
    if (!open || step !== 'setup') return;
    const el = document.querySelector('svg.barcode-setup-preview') as SVGSVGElement | null;
    if (!el) return;
    if (!barcode.trim()) {
      el.innerHTML = '';
      return;
    }
    renderBarcodePattern(el, barcode);
  }, [open, step, barcode]);

  if (!open || !base) return null;

  const handlePrint = () => {
    document.body.classList.add('print-barcode-labels');
    window.setTimeout(() => {
      window.print();
      window.setTimeout(() => document.body.classList.remove('print-barcode-labels'), 1200);
    }, 50);
  };

  const handleDownloadPdf = async () => {
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const labelW = 50;
      const labelH = 30;
      const gap = 3;
      const cols = 3;
      const marginX = 12;
      const marginY = 12;
      let col = 0;
      let row = 0;
      for (let i = 0; i < copies.length; i++) {
        const x = marginX + col * (labelW + gap);
        const y = marginY + row * (labelH + gap);
        doc.setDrawColor(200);
        doc.setLineDashPattern([0.7, 0.7], 0);
        doc.rect(x, y, labelW, labelH);

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.text(copies[i].shopName.toUpperCase(), x + labelW / 2, y + 6, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(copies[i].location, x + labelW / 2, y + 10.5, { align: 'center' });

        doc.setFontSize(8);
        doc.text(copies[i].barcode, x + labelW / 2, y + 26.5, { align: 'center' });

        col += 1;
        if (col >= cols) {
          col = 0;
          row += 1;
          if (marginY + (row + 1) * (labelH + gap) > 285) {
            doc.addPage();
            row = 0;
          }
        }
      }
      doc.save(`barcode-labels-${copies[0].barcode || 'labels'}.pdf`);
    } catch {
      handlePrint();
    }
  };

  const goPreview = () => {
    if (!barcode.trim()) return;
    if (!qtyInput.trim() || Number(qtyInput) < 1) setQtyInput('1');
    setStep('preview');
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-2 sm:p-4 print:static print:bg-transparent print:p-0">
      <div
        className={`bg-white rounded-xl border border-zinc-200 shadow-xl w-full overflow-auto print:shadow-none print:border-0 print:max-w-none print:rounded-none print:max-h-none print:overflow-visible ${
          step === 'preview' ? 'max-w-5xl max-h-[96vh]' : 'max-w-lg max-h-[92vh]'
        }`}
      >
        {step === 'setup' ? (
          <div className="p-5 space-y-4 print:hidden">
            <div>
              <h3 className="text-lg font-bold text-zinc-950">Print barcodes</h3>
              <p className="text-[12px] text-zinc-600 mt-0.5 font-medium">
                Clean thermal labels · shop · city · barcode · 50×30mm
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-semibold text-zinc-800">
                Shop name
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-950 font-bold uppercase"
                />
              </label>
              <label className="block text-[12px] font-semibold text-zinc-800">
                Location / city
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Dhaka"
                  className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-950"
                />
              </label>
            </div>

            <label className="block text-[12px] font-semibold text-zinc-800">
              Product
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-950"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-[12px] font-semibold text-zinc-800">
                Category
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-950"
                />
              </label>
              <label className="block text-[12px] font-semibold text-zinc-800">
                Sell price
                <input
                  type="text"
                  value={priceLabel}
                  onChange={(e) => setPriceLabel(e.target.value)}
                  className="mt-1 w-full text-[13px] px-3 py-2 border border-zinc-300 rounded-lg bg-white text-zinc-950"
                />
              </label>
            </div>

            <label className="block text-[12px] font-semibold text-zinc-800">
              Barcode <span className="font-normal text-zinc-600">(manual entry)</span>
              <input
                ref={barcodeInputRef}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                value={barcode}
                placeholder="Type barcode number here…"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setBarcode(e.target.value.replace(/\s/g, ''))}
                className="mt-1 w-full text-[15px] px-3 py-2.5 border-2 border-zinc-950 rounded-lg bg-white text-zinc-950 font-mono font-semibold tracking-wide"
              />
            </label>

            <label className="block text-[12px] font-semibold text-zinc-800">
              How many barcodes to print?
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={qtyInput}
                placeholder="e.g. 50"
                onFocus={(e) => e.target.select()}
                onChange={(e) => setQtyInput(e.target.value.replace(/[^\d]/g, ''))}
                onBlur={() => {
                  if (!qtyInput.trim() || Number(qtyInput) < 1) setQtyInput('1');
                  else if (Number(qtyInput) > MAX_LABELS) setQtyInput(String(MAX_LABELS));
                }}
                className="mt-1 w-full text-[15px] px-3 py-2.5 border-2 border-zinc-950 rounded-lg bg-white text-zinc-950 font-semibold tabular-nums"
              />
              <p className="mt-1 text-[11px] text-zinc-600 font-medium">
                Clear the box, then type quantity (1–{MAX_LABELS}).
              </p>
            </label>

            {/* Live mini preview — clean OUDS style */}
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <p className="text-[11px] font-semibold text-zinc-600 mb-2">Label preview</p>
              <div className="mx-auto">
                <LabelFace
                  shopName={shopName || 'Epic Vanskap'}
                  location={location || 'Dhaka'}
                  barcode={barcode}
                />
              </div>
              <p className="mt-2 text-[11px] text-zinc-500 text-center">
                Sell price ({priceLabel || '—'}) is kept for your records — not printed on the sticker.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-zinc-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={!barcode.trim()}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg border border-zinc-300 cursor-pointer disabled:opacity-40"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={goPreview}
                disabled={!barcode.trim()}
                className="text-[13px] font-semibold px-4 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer disabled:opacity-40"
              >
                Print preview
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 print:hidden sticky top-0 bg-white z-10">
              <div>
                <p className="text-[15px] font-semibold text-zinc-950">
                  Full page labels · {copies.length} {copies.length === 1 ? 'copy' : 'copies'}
                </p>
                <p className="text-[12px] text-zinc-600 font-medium">
                  {shopName} · {location} · {barcode}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => (showSetup ? setStep('setup') : onClose())}
                  className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="text-[12px] font-semibold px-3 py-2 rounded-lg border border-zinc-300 cursor-pointer"
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-zinc-950 text-white cursor-pointer"
                >
                  Print labels
                </button>
              </div>
            </div>

            {/* Full-page A4-style sheet */}
            <div className="bg-zinc-100 p-4 print:bg-white print:p-0">
              <div
                id="barcode-labels-print"
                className="mx-auto bg-white shadow-sm border border-zinc-200 p-4 print:shadow-none print:border-0 print:p-0 print:w-full"
                style={{ maxWidth: 794 }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 justify-items-center print:gap-3">
                  {copies.map((item, i) => (
                    <LabelFace
                      key={`${item.barcode}-${i}`}
                      shopName={item.shopName}
                      location={item.location}
                      barcode={item.barcode}
                      svgRef={(el) => {
                        svgRefs.current[i] = el;
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
