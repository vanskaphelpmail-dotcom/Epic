import React, { useState, useEffect } from 'react';
import { ShieldCheck, ArrowLeft, Truck, ClipboardCheck, Sparkles, AlertCircle, MapPin, Phone, CheckCircle, Info, Home, Briefcase, User, Save, Trash2, ShoppingBag } from 'lucide-react';
import { CartItem, Order, AppConfig } from '../types';
import { BkashPaymentPanel, BKASH_DEFAULT_NUMBER, BKASH_PARTIAL_DEFAULT_BDT } from './BkashPaymentPanel';
import {
  buildBkashPaymentMeta,
  withBkashNote,
  cartRequiresFullBkashPayment,
  cartJerseyCount,
  calcPartialAdvanceBdt,
  formatPartialAdvanceBreakdown,
} from '../lib/bkashPayment';
import { api, isApiEnabled } from '../lib/apiClient';
import { mapApiOrderToSpa } from '../lib/mapOrder';
import { getProductSizes, getSizeStock, isSizeAvailable } from '../lib/productSizes';
import { isRenderableImageSrc } from '../lib/productImage';
import { JerseyRenderer } from './JerseyRenderer';

interface CheckoutProps {
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  onOrderSuccess: (order: Order) => void;
  onBackToCart: () => void;
  onBackToCatalog: () => void;
  formatPrice: (amount: number) => string;
  appConfig: AppConfig;
}

export const Checkout: React.FC<CheckoutProps> = ({
  cart,
  setCart,
  onOrderSuccess,
  onBackToCart,
  onBackToCatalog,
  formatPrice,
  appConfig,
}) => {
  // Empty Cart Safe Guard
  if (cart.length === 0) {
    return (
      <div className="max-w-md mx-auto my-16 text-center space-y-6 bg-white border-2 border-zinc-200 p-8 rounded-3xl text-zinc-950 shadow-lg animate-fadeIn">
        <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-500 border border-zinc-200">
          <ShoppingBag size={28} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight text-black">Your Order Bag is Empty</h3>
        <p className="text-xs text-zinc-700 font-mono">You do not have any vintage shirts in your checkout session. Return to the catalog to select legendary items.</p>
        <button
          onClick={onBackToCatalog}
          className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs uppercase tracking-widest py-3.5 rounded-xl transition-all cursor-pointer"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  // Form State
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState(appConfig.logoSubtext?.includes('DHAKA') ? 'Dhaka' : '');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  
  // Delivery Region (Inside Dhaka: 70 TK, Outside Dhaka: 130 TK)
  const [deliveryRegion, setDeliveryRegion] = useState<'inside' | 'outside'>('inside');

  // Saved Shipping Coordinates for One-Click suggest
  const [savedAddresses, setSavedAddresses] = useState(() => {
    const stored = localStorage.getItem('vault_shipping_addresses');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        // Fallback
      }
    }
    return [
      // No dummy addresses — user adds shipping addresses at checkout
    ];
  });

  const [saveThisAddress, setSaveThisAddress] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'Home' | 'Office' | 'Visitor'>('Home');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [bkashNumber, setBkashNumber] = useState('');
  const [bkashTransactionId, setBkashTransactionId] = useState('');
  /** Admin setting = advance per jersey (default ৳300). */
  const partialPerJerseyBdt = appConfig.bkashPartialAmountBdt ?? BKASH_PARTIAL_DEFAULT_BDT;
  /** Nameset / jersey name printing forces full bKash only. */
  const requiresFullBkashForNameset = cartRequiresFullBkashPayment(cart);
  /** Always offer Full + Partial for jerseys; hide Partial when nameset is on. */
  const showPayTypeChoice = !requiresFullBkashForNameset;
  const [bkashPayChoice, setBkashPayChoice] = useState<'full' | 'partial'>('partial');
  const merchantBkash = appConfig.bkashPersonalNumber || BKASH_DEFAULT_NUMBER;
  const bkashEnabled = appConfig.bkashEnabled !== false;

  const preOrderItems = cart.filter((item) => item.product.isPreOrder);
  const hasPreOrder = preOrderItems.length > 0;
  const buildPreOrderNotes = () => {
    if (!hasPreOrder) return undefined;
    const lines = preOrderItems.map((item) => {
      const eta = item.product.preOrderEta ? ` (ETA: ${item.product.preOrderEta})` : '';
      return `${item.product.name}${eta}`;
    });
    return `PRE-ORDER: ${lines.join('; ')}`;
  };

  const handleSelectAddress = (addr: any) => {
    setFullName(addr.fullName);
    setAddressLine1(addr.addressLine1);
    setCity(addr.city || 'Dhaka');
    setPostalCode(addr.postalCode || '');
    setPhone(addr.phone);
    if (addr.city && addr.city.toLowerCase().includes('dhaka')) {
      setDeliveryRegion('inside');
    } else {
      setDeliveryRegion('outside');
    }
  };

  const handleSaveCurrentAddress = () => {
    if (!fullName || !addressLine1 || !phone) {
      alert('Please fill out Recipient Full Name, Address, and Phone first before saving.');
      return;
    }
    const newAddr = {
      id: `addr-${Date.now()}`,
      label: saveLabel,
      fullName,
      addressLine1,
      city: city || 'Dhaka',
      postalCode: postalCode || '',
      country: 'Bangladesh',
      phone,
      isDefault: savedAddresses.length === 0,
    };
    const updated = [...savedAddresses, newAddr];
    setSavedAddresses(updated);
    localStorage.setItem('vault_shipping_addresses', JSON.stringify(updated));
    setSaveSuccessMsg(true);
    setTimeout(() => setSaveSuccessMsg(false), 3000);
  };

  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const deliveryChargeBDT = deliveryRegion === 'inside' ? 70 : 130;
  const grandTotal = subtotal + deliveryChargeBDT;
  const jerseyCount = cartJerseyCount(cart);
  const partialAdvanceBdt = calcPartialAdvanceBdt(jerseyCount, partialPerJerseyBdt, grandTotal);
  const partialAdvanceBreakdown = formatPartialAdvanceBreakdown(
    jerseyCount,
    partialPerJerseyBdt,
    partialAdvanceBdt,
  );

  const effectiveBkashPayChoice: 'full' | 'partial' = requiresFullBkashForNameset
    ? 'full'
    : bkashPayChoice;
  const isPartialBkash = effectiveBkashPayChoice === 'partial';
  const bkashSendAmountBdt = isPartialBkash ? partialAdvanceBdt : grandTotal;
  const bkashDueOnDelivery = isPartialBkash
    ? Math.max(0, grandTotal - bkashSendAmountBdt)
    : 0;

  // Nameset / jersey name → full payment only
  useEffect(() => {
    if (requiresFullBkashForNameset && bkashPayChoice !== 'full') {
      setBkashPayChoice('full');
    }
  }, [requiresFullBkashForNameset, bkashPayChoice]);

  const buildBkashPayNote = (extra?: string) => {
    const meta = buildBkashPaymentMeta(
      effectiveBkashPayChoice,
      bkashSendAmountBdt,
      grandTotal,
    );
    const pre = buildPreOrderNotes();
    return withBkashNote(
      [pre, extra].filter(Boolean).join(' | ') || undefined,
      meta,
    );
  };

  const attachBkashFields = (order: Order): Order => ({
    ...order,
    bkashPaymentType: effectiveBkashPayChoice,
    bkashPaidAmount: bkashSendAmountBdt,
    customerNotes: order.customerNotes || buildBkashPayNote(),
    paymentStatus: 'Unpaid',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlacingOrder) return;
    if (!fullName || !addressLine1 || !phone) {
      alert('Please fill out all the required fields for secure delivery.');
      return;
    }

    if (phone.length < 10) {
      alert('Please enter a valid active phone number.');
      return;
    }

    if (!bkashNumber || bkashNumber.replace(/\D/g, '').length < 11) {
      alert('অনুগ্রহ করে যে মোবাইল নম্বর থেকে Send Money করেছেন সেটি লিখুন।');
      return;
    }
    if (!bkashTransactionId || bkashTransactionId.trim().length < 6) {
      alert('অনুগ্রহ করে আপনার bKash ট্রানজ্যাকশন আইডি (TrxID) লিখুন।');
      return;
    }

    setIsPlacingOrder(true);
    try {
    if (saveThisAddress) {
      const isDuplicate = savedAddresses.some(
        (a: any) => a.addressLine1.toLowerCase().trim() === addressLine1.toLowerCase().trim()
      );
      if (!isDuplicate) {
        const newAddr = {
          id: `addr-${Date.now()}`,
          label: saveLabel,
          fullName,
          addressLine1,
          city: city || 'Dhaka',
          postalCode: postalCode || 'N/A',
          country: 'Bangladesh',
          phone,
          isDefault: savedAddresses.length === 0,
        };
        const updated = [...savedAddresses, newAddr];
        localStorage.setItem('vault_shipping_addresses', JSON.stringify(updated));
      }
    }

    if (isApiEnabled()) {
      try {
        const created = await api.createOrder({
          paymentMethod: 'bkash',
          deliveryRegion,
          deliveryCharge: deliveryChargeBDT,
          shipFullName: fullName,
          shipPhone: phone,
          shipEmail: email || undefined,
          shipAddressLine1: addressLine1,
          shipCity: city || (deliveryRegion === 'inside' ? 'Dhaka' : 'Outside Dhaka'),
          shipPostalCode: postalCode || 'N/A',
          bkashNumber,
          bkashTransactionId: bkashTransactionId.trim(),
          bkashPaymentType: effectiveBkashPayChoice,
          customerNotes: buildPreOrderNotes(),
          items: cart.map((item) => ({
            productId: item.product.id,
            selectedSize: item.selectedSize,
            quantity: item.quantity,
            customPrintName: item.customPrint?.name,
            customPrintNum: item.customPrint?.number,
            namesetEnabled: Boolean(item.namesetEnabled || item.customPrint),
            addBadge: item.addBadge,
            selectedBadgeIds: item.selectedBadges?.length ? item.selectedBadges.join(',') : '',
          })),
        });
        let placedOrder: Order;
        try {
          placedOrder = attachBkashFields(mapApiOrderToSpa(created, cart));
        } catch (mapErr) {
          console.error('Failed to map order response', mapErr);
          placedOrder = attachBkashFields({
            id: created?.orderNumber || created?.id || `ORD-${Date.now()}`,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
            createdAt: new Date().toISOString(),
            deliveryRegion,
            deliveryCharge: deliveryChargeBDT,
            items: [...cart],
            subtotal,
            tax: 0,
            shipping: deliveryChargeBDT,
            total: grandTotal,
            status: 'Pending',
            trackingNumber: created?.orderNumber || created?.id,
            shippingAddress: {
              fullName,
              email: email || undefined,
              addressLine1,
              city: city || (deliveryRegion === 'inside' ? 'Dhaka' : 'Outside Dhaka'),
              postalCode: postalCode || 'N/A',
              country: 'Bangladesh',
              phone,
            },
            paymentMethod: 'bKash',
            paymentStatus: 'Unpaid',
            bkashNumber,
            bkashTransactionId: bkashTransactionId.trim(),
          });
        }
        onOrderSuccess(placedOrder);
        try {
          await api.clearCart();
        } catch {
          /* cart clear is best-effort */
        }
        return;
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
        return;
      }
    }

    const trackingID = `CFJ-BK-${Math.floor(100000 + Math.random() * 900000)}`;
    const newOrder: Order = attachBkashFields({
      id: `ORD-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      createdAt: new Date().toISOString(),
      deliveryRegion,
      deliveryCharge: deliveryChargeBDT,
      items: [...cart],
      subtotal,
      tax: 0,
      shipping: deliveryChargeBDT,
      total: grandTotal,
      status: 'Pending',
      trackingNumber: trackingID,
      shippingAddress: {
        fullName,
        email: email || undefined,
        addressLine1,
        city: city || (deliveryRegion === 'inside' ? 'Dhaka' : 'Outside Dhaka'),
        postalCode: postalCode || 'N/A',
        country: 'Bangladesh',
        phone,
      },
      paymentMethod: 'bKash',
      paymentStatus: 'Unpaid',
      bkashNumber,
      bkashTransactionId: bkashTransactionId.trim(),
      customerNotes: buildBkashPayNote(),
    });

    onOrderSuccess(newOrder);
    setCart([]);
    } catch (err) {
      console.error('Checkout submit failed', err);
      alert(err instanceof Error ? err.message : 'Failed to place order. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  return (
    <section className="bg-white text-emerald-950 py-8 px-4 md:px-12 max-w-7xl mx-auto min-h-screen">
      
      {/* Navigation Back Link */}
      <button
        onClick={onBackToCart}
        className="inline-flex items-center gap-2 text-[10px] md:text-xs font-mono font-bold tracking-wider text-emerald-850 hover:text-emerald-950 uppercase mb-6 cursor-pointer transition-all"
        id="checkout-back-to-cart"
      >
        <ArrowLeft size={14} /> Back to Cart
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Form & Options */}
        <form onSubmit={handleSubmit} className="lg:col-span-8 space-y-6">
          
          {/* Header Title */}
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight text-black font-display">
              Complete Your Order
            </h1>
            <p className="text-xs text-zinc-800 font-mono font-medium">
              {isPartialBkash
                ? `Fill in delivery details, then send ৳${bkashSendAmountBdt} advance via bKash Send Money and submit your TrxID. Pay the rest on delivery.`
                : `Fill in delivery details, then send the full order amount (৳${grandTotal.toLocaleString('en-BD')}) via bKash Send Money and submit your TrxID.`}
            </p>
          </div>

          {hasPreOrder && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex gap-3 items-start text-amber-950">
              <AlertCircle size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-wider">Pre-Order Items in Your Bag</p>
                <p className="text-[11px] font-mono leading-relaxed">
                  This order includes pre-order product(s). They will ship when stock arrives
                  {preOrderItems.some((i) => i.product.preOrderEta)
                    ? ` (${preOrderItems
                        .filter((i) => i.product.preOrderEta)
                        .map((i) => i.product.preOrderEta)
                        .join(', ')})`
                    : ''}
                  . Your order will be tagged as Pre-Order for our team.
                </p>
              </div>
            </div>
          )}

          {/* Section 1: Personal Contact Details */}
          <div className="bg-white border-2 border-zinc-300 rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-black">
            <h3 className="text-xs md:text-sm font-mono font-black text-black uppercase tracking-widest border-b-2 border-zinc-200 pb-2.5 flex items-center gap-2">
              <ClipboardCheck size={16} className="text-emerald-700" /> 1. Contact Information
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">RECIPIENT FULL NAME *</label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. Yasin Ahmed"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-black placeholder-zinc-400"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">MOBILE PHONE NUMBER *</label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 01840990700"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs focus:outline-none transition-colors font-mono font-bold text-black placeholder-zinc-400"
                  />
                </div>
                <span className="text-[10px] text-zinc-700 font-mono block font-medium">We will call this number before delivery to verify.</span>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">EMAIL ADDRESS (OPTIONAL)</label>
              <input
                type="email"
                placeholder="e.g. collector@vault.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-black placeholder-zinc-400"
              />
            </div>
          </div>

          {/* Section 2: Delivery Address Details */}
          <div className="bg-white border-2 border-zinc-300 rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-black">
            <h3 className="text-xs md:text-sm font-mono font-black text-black uppercase tracking-widest border-b-2 border-zinc-200 pb-2.5 flex items-center gap-2">
              <MapPin size={16} className="text-emerald-700" /> 2. Delivery Address
            </h3>

            {/* SAVED ADDRESSES QUICK SUGGESTIONS GRID */}
            {savedAddresses.length > 0 && (
              <div className="bg-zinc-50 border-2 border-zinc-200 p-4 rounded-xl space-y-2.5">
                <span className="text-[10px] text-black font-mono font-black uppercase tracking-wider block flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> 
                  ONE-CLICK SUGGESTIONS (SAVED ADDRESSES):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {savedAddresses.map((addr: any) => (
                    <button
                      type="button"
                      key={addr.id}
                      onClick={() => handleSelectAddress(addr)}
                      className="text-left bg-white hover:bg-zinc-100 border-2 border-zinc-200 hover:border-black p-3.5 rounded-xl text-xs transition-all cursor-pointer flex flex-col justify-between shadow-xs"
                    >
                      <div className="flex justify-between items-center gap-2 mb-1.5">
                        <span className="bg-emerald-100 text-emerald-900 text-[9px] font-mono px-2 py-0.5 rounded-md uppercase font-black border border-emerald-300">
                          {addr.label}
                        </span>
                        {addr.isDefault && (
                          <span className="text-emerald-800 font-mono text-[9px] font-black tracking-wide">PRIMARY</span>
                        )}
                      </div>
                      <p className="font-extrabold text-black truncate">{addr.fullName}</p>
                      <p className="text-zinc-800 text-[11px] font-medium truncate leading-tight mt-0.5">{addr.addressLine1}</p>
                      <p className="text-[10px] font-mono text-zinc-900 mt-1 font-bold">Phone: {addr.phone}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">FULL DETAILED ADDRESS (House, Flat, Road, Area) *</label>
              <textarea
                required
                rows={3}
                placeholder="e.g. Flat 4B, House 12, Road 5, Sector 4, Uttara, Dhaka"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors resize-none leading-relaxed text-black placeholder-zinc-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">CITY / DISTRICT</label>
                <input
                  type="text"
                  placeholder="e.g. Dhaka"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs font-bold focus:outline-none transition-colors text-black placeholder-zinc-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-zinc-950 font-mono font-black block tracking-wider">POSTAL CODE (OPTIONAL)</label>
                <input
                  type="text"
                  placeholder="e.g. 1230"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className="w-full bg-zinc-50 border-2 border-zinc-300 focus:border-emerald-600 focus:bg-white rounded-xl py-3 px-4 text-xs focus:outline-none transition-colors font-mono font-bold text-black placeholder-zinc-400"
                />
              </div>
            </div>

            {/* OPTION TO SAVE CURRENT ADDRESS */}
            <div className="bg-zinc-50 border-2 border-zinc-200 p-4 rounded-xl space-y-3 mt-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="checkoutSaveThisAddress"
                  checked={saveThisAddress}
                  onChange={(e) => setSaveThisAddress(e.target.checked)}
                  className="w-3.5 h-3.5 accent-emerald-600 bg-white rounded border-zinc-300 cursor-pointer"
                />
                <label htmlFor="checkoutSaveThisAddress" className="text-[11px] text-zinc-950 font-black cursor-pointer select-none">
                  Save this address for future checkout suggestions
                </label>
              </div>

              <div className="space-y-3 pl-5 sm:pl-6 border-l-2 border-zinc-300 transition-all">
                <div className="space-y-1.5">
                  <span className="text-[10px] text-zinc-900 font-mono font-bold block uppercase">ADDRESS LABEL:</span>
                  <div className="flex gap-2">
                    {['Home', 'Office', 'Visitor'].map((lbl) => {
                      const isSelected = saveLabel === lbl;
                      return (
                        <button
                          type="button"
                          key={lbl}
                          onClick={() => setSaveLabel(lbl as any)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] uppercase font-bold border-2 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-black text-white border-black'
                              : 'bg-white border-zinc-300 text-black hover:border-black'
                          }`}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveCurrentAddress}
                    className="bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-[9px] uppercase tracking-wider px-3.5 py-1.5 rounded-lg transition-all cursor-pointer inline-flex items-center gap-1"
                  >
                    <Save size={10} /> Save Address Now
                  </button>
                  {saveSuccessMsg && (
                    <span className="text-[10px] text-emerald-800 font-mono font-bold animate-fadeIn">✓ Saved successfully</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Localization Shipping Cost Selection */}
          <div className="bg-white border-2 border-zinc-300 rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-black">
            <h3 className="text-xs md:text-sm font-mono font-black text-black uppercase tracking-widest border-b-2 border-zinc-200 pb-2.5 flex items-center gap-2">
              <Truck size={16} className="text-emerald-700" /> 3. Select Delivery Area
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Inside Dhaka Area */}
              <div
                onClick={() => setDeliveryRegion('inside')}
                className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                  deliveryRegion === 'inside'
                    ? 'bg-zinc-50 border-emerald-600 text-black shadow-lg'
                    : 'bg-white border-zinc-300 text-zinc-800 hover:border-black'
                }`}
                id="shipping-inside-dhaka"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${deliveryRegion === 'inside' ? 'border-emerald-600' : 'border-zinc-400'}`}>
                      {deliveryRegion === 'inside' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider text-black">Inside Dhaka</p>
                  </div>
                  <p className="text-[10px] text-zinc-700 font-medium leading-normal">Fast doorstep delivery within 24-48 hours inside capital limits.</p>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-sm font-mono font-black text-black">৳70</span>
                  <p className="text-[9px] text-zinc-600 font-mono font-bold">fee</p>
                </div>
              </div>

              {/* Outside Dhaka Area */}
              <div
                onClick={() => setDeliveryRegion('outside')}
                className={`p-4 rounded-xl border-2 cursor-pointer flex justify-between items-center transition-all ${
                  deliveryRegion === 'outside'
                    ? 'bg-zinc-50 border-emerald-600 text-black shadow-lg'
                    : 'bg-white border-zinc-300 text-zinc-800 hover:border-black'
                }`}
                id="shipping-outside-dhaka"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${deliveryRegion === 'outside' ? 'border-emerald-600' : 'border-zinc-400'}`}>
                      {deliveryRegion === 'outside' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />}
                    </span>
                    <p className="text-xs font-black uppercase tracking-wider text-black">Outside Dhaka</p>
                  </div>
                  <p className="text-[10px] text-zinc-700 font-medium leading-normal">Standard courier service to all districts across Bangladesh (2-4 days).</p>
                </div>
                <div className="text-right flex-shrink-0 pl-2">
                  <span className="text-sm font-mono font-black text-black">৳130</span>
                  <p className="text-[9px] text-zinc-600 font-mono font-bold">fee</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Payment method */}
          <div className="bg-white border-2 border-zinc-300 rounded-2xl p-4 md:p-6 space-y-4 shadow-xl text-black">
            <h3 className="text-xs md:text-sm font-mono font-black text-black uppercase tracking-widest border-b-2 border-zinc-200 pb-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-700" /> 4. Payment Method
            </h3>

            <div className="space-y-3">
              {bkashEnabled && (
                <>
                  {requiresFullBkashForNameset && (
                    <p className="text-[11px] font-mono text-emerald-950 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                      Custom nameset printing selected — <strong>full bKash payment</strong> required.
                      Per-jersey advance (৳{partialPerJerseyBdt} × qty) is not available for this order.
                    </p>
                  )}

                  {showPayTypeChoice && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-mono font-black uppercase tracking-widest text-zinc-700">
                        পেমেন্ট টাইপ নির্বাচন করুন · Choose payment type
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setBkashPayChoice('full')}
                          className={`text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                            effectiveBkashPayChoice === 'full'
                              ? 'border-emerald-600 bg-emerald-50/70 shadow-sm ring-1 ring-emerald-600/30'
                              : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                effectiveBkashPayChoice === 'full' ? 'border-emerald-600' : 'border-zinc-400'
                              }`}
                            >
                              {effectiveBkashPayChoice === 'full' && (
                                <span className="w-2 h-2 rounded-full bg-emerald-600" />
                              )}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                              Full Pay · পূর্ণ পেমেন্ট
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-800 font-medium pl-6">
                            bKash Send Money — full order:{' '}
                            <span className="font-mono font-black">{formatPrice(grandTotal)}</span>
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBkashPayChoice('partial')}
                          className={`text-left rounded-xl border-2 p-4 transition-all cursor-pointer ${
                            effectiveBkashPayChoice === 'partial'
                              ? 'border-amber-500 bg-amber-50/60 shadow-sm ring-1 ring-amber-500/30'
                              : 'border-zinc-200 bg-zinc-50 hover:border-zinc-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1.5">
                            <span
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                effectiveBkashPayChoice === 'partial' ? 'border-amber-500' : 'border-zinc-400'
                              }`}
                            >
                              {effectiveBkashPayChoice === 'partial' && (
                                <span className="w-2 h-2 rounded-full bg-amber-500" />
                              )}
                            </span>
                            <span className="text-xs font-black uppercase tracking-wider text-black">
                              Partial Pay · আংশিক এডভান্স
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-800 font-medium pl-6">
                            Pay <span className="font-mono font-black">৳{partialAdvanceBdt}</span> now
                            <span className="text-zinc-600"> ({partialAdvanceBreakdown})</span>
                            {' — '}rest{' '}
                            <span className="font-mono font-black">{formatPrice(bkashDueOnDelivery)}</span> on delivery
                          </p>
                        </button>
                      </div>
                    </div>
                  )}

                  <BkashPaymentPanel
                    selected
                    onSelect={() => {}}
                    personalNumber={merchantBkash}
                    sendMoneyAmountBdt={bkashSendAmountBdt}
                    isPartialPayment={isPartialBkash}
                    dueOnDeliveryBdt={bkashDueOnDelivery}
                    partialBreakdownLabel={isPartialBkash ? partialAdvanceBreakdown : undefined}
                    customerBkashNumber={bkashNumber}
                    transactionId={bkashTransactionId}
                    onCustomerBkashNumberChange={setBkashNumber}
                    onTransactionIdChange={setBkashTransactionId}
                  />
                </>
              )}
            </div>
          </div>

          {/* Place Order CTA Button */}
          <button
            type="submit"
            disabled={isPlacingOrder}
            className="w-full bg-emerald-800 hover:bg-emerald-900 text-white font-extrabold text-xs md:text-sm uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-wait disabled:active:scale-100"
            id="checkout-submit-btn"
          >
            <ShieldCheck size={16} />{' '}
            {isPlacingOrder
              ? 'Placing order…'
              : isPartialBkash
                ? `Place bKash Order (Advance ৳${bkashSendAmountBdt})`
                : `Place bKash Order (${formatPrice(grandTotal)})`}
          </button>

        </form>

        {/* Right Column: Mini Sticky Order Summary */}
        <div className="lg:col-span-4 bg-white border-2 border-zinc-300 rounded-2xl p-4 md:p-6 space-y-5 sticky top-28 text-black shadow-xl">
          <h4 className="text-xs font-mono font-black text-black uppercase tracking-widest border-b-2 border-zinc-200 pb-2.5 flex items-center justify-between">
            <span>Order Summary</span>
            <span className="bg-black text-white text-[9px] px-2.5 py-0.5 rounded-full font-mono font-black">
              {cart.reduce((sum, item) => sum + item.quantity, 0)} Items
            </span>
          </h4>

          {/* Items Checklist */}
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
            {cart.map((item, idx) => {
              const sizes = getProductSizes(item.product);
              const maxForSize = getSizeStock(item.product, item.selectedSize);

              return (
                <div key={idx} className="bg-zinc-50 border-2 border-zinc-200 rounded-xl p-3 space-y-3 shadow-xs relative group">
                  <div className="flex gap-3 text-xs">
                    {/* Image */}
                    <div className="w-12 h-12 bg-white border border-zinc-300 rounded overflow-hidden flex items-center justify-center flex-shrink-0">
                      <JerseyRenderer
                        productId={item.product.id}
                        uploadedImage={
                          [
                            item.product.uploadedImage,
                            ...(item.product.gallery || []),
                            ...(item.product.images || []),
                            item.product.image,
                          ].find(isRenderableImageSrc)
                        }
                        imageKey={item.product.image}
                      />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="font-extrabold text-black truncate leading-tight" title={item.product.name}>{item.product.name}</p>
                      <p className="text-[10px] font-mono text-zinc-700 mt-1 font-bold">Unit: {formatPrice(item.product.price)}</p>
                    </div>

                    {/* Delete Icon */}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = cart.filter((_, i) => i !== idx);
                        setCart(updated);
                      }}
                      className="absolute top-2.5 right-2.5 p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all cursor-pointer"
                      title="Remove Item"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Size and Qty Controls Row */}
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-200 text-xs">
                    {/* Size Selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[9px] font-mono text-zinc-600 font-black uppercase">Size:</span>
                      <select
                        value={item.selectedSize}
                        onChange={(e) => {
                          const newSize = e.target.value;
                          const max = getSizeStock(item.product, newSize);
                          setCart(prev => prev.map((itemVal, i) => i === idx ? {
                            ...itemVal,
                            selectedSize: newSize,
                            quantity: Math.min(itemVal.quantity, Math.max(1, max || 1)),
                          } : itemVal));
                        }}
                        className="bg-white border-2 border-zinc-300 text-black text-[11px] font-bold rounded-lg px-2 py-0.5 focus:outline-none focus:border-emerald-600 cursor-pointer"
                      >
                        {sizes.map(size => (
                          <option key={size} value={size} disabled={!isSizeAvailable(item.product, size)}>
                            {size}{!isSizeAvailable(item.product, size) ? ' (OOS)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Selector with increment and decrement buttons */}
                    <div className="flex items-center gap-1 bg-zinc-200/60 rounded-lg p-0.5 border border-zinc-300">
                      <button
                        type="button"
                        onClick={() => {
                          if (item.quantity > 1) {
                            setCart(prev => prev.map((itemVal, i) => i === idx ? { ...itemVal, quantity: itemVal.quantity - 1 } : itemVal));
                          } else {
                            // If quantity is 1, decrement deletes the item
                            const updated = cart.filter((_, i) => i !== idx);
                            setCart(updated);
                          }
                        }}
                        className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-black font-black bg-white rounded shadow-xs cursor-pointer text-xs"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-mono font-black text-black text-xs">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const max = maxForSize || 0;
                          setCart(prev => prev.map((itemVal, i) =>
                            i === idx
                              ? { ...itemVal, quantity: Math.min(max, itemVal.quantity + 1) }
                              : itemVal
                          ));
                        }}
                        disabled={item.quantity >= maxForSize}
                        className="w-5 h-5 flex items-center justify-center text-zinc-700 hover:text-black font-black bg-white rounded shadow-xs cursor-pointer text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Subtotal per item */}
                  <div className="flex justify-between items-center text-[10px] font-mono text-zinc-700 pt-1 font-bold">
                    <span>Subtotal:</span>
                    <span className="font-extrabold text-black">{formatPrice(item.product.price * item.quantity)}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals Section — mirrors bKash Full / Partial choice live */}
          <div className="space-y-2.5 text-xs text-zinc-900 border-t-2 border-zinc-200 pt-4 font-medium">
            <div className="flex justify-between items-center">
              <span>Items Subtotal:</span>
              <span className="text-black font-mono font-extrabold">{formatPrice(subtotal)}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span>Delivery Charge ({deliveryRegion === 'inside' ? 'Inside Dhaka' : 'Outside Dhaka'}):</span>
              <span className="text-black font-extrabold font-mono">৳{deliveryChargeBDT}</span>
            </div>

            <div className="border-t-2 border-zinc-200 pt-3 flex justify-between items-baseline">
              <span className="text-zinc-950 font-black uppercase text-[10px] tracking-wider">
                Order Total
              </span>
              <span className="text-black font-black text-lg font-mono">{formatPrice(grandTotal)}</span>
            </div>

            {bkashEnabled && (
              <div
                className={`rounded-xl border-2 p-3 space-y-2 transition-all ${
                  isPartialBkash
                    ? 'border-amber-400 bg-amber-50/70'
                    : 'border-[#E2136E]/40 bg-[#E2136E]/[0.06]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-mono font-black uppercase tracking-widest text-zinc-700">
                    {isPartialBkash ? 'Partial Pay · আংশিক এডভান্স' : 'Full Pay · পূর্ণ পেমেন্ট'}
                  </span>
                  <span
                    className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isPartialBkash
                        ? 'bg-amber-500 text-white'
                        : 'bg-[#E2136E] text-white'
                    }`}
                  >
                    bKash
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-bold text-zinc-800">
                    {isPartialBkash ? 'Pay now (bKash advance):' : 'Pay now (bKash Send Money):'}
                  </span>
                  <span className="text-[#E2136E] font-black font-mono text-base">
                    {formatPrice(bkashSendAmountBdt)}
                  </span>
                </div>

                {isPartialBkash && (
                  <>
                    <div className="flex justify-between items-center text-[10px] text-zinc-600">
                      <span>Advance rate:</span>
                      <span className="font-mono font-bold">{partialAdvanceBreakdown}</span>
                    </div>
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-zinc-700 font-medium">Due on delivery:</span>
                      <span className="text-zinc-950 font-black font-mono">
                        {formatPrice(bkashDueOnDelivery)}
                      </span>
                    </div>
                  </>
                )}

                <p className="text-[10px] text-zinc-600 font-medium leading-snug pt-1 border-t border-zinc-200/80">
                  {isPartialBkash
                    ? `Send ৳${Math.round(bkashSendAmountBdt).toLocaleString('en-BD')} now (${partialAdvanceBreakdown}) — remaining ৳${Math.round(bkashDueOnDelivery).toLocaleString('en-BD')} collected when your order arrives.`
                    : `Send the full ${formatPrice(grandTotal)} via bKash Send Money to complete this order.`}
                </p>
              </div>
            )}

            <div className="border-t-2 border-zinc-200 pt-4 flex justify-between items-baseline">
              <span className="text-zinc-950 font-black uppercase text-[10px] tracking-wider">
                {isPartialBkash ? 'Due via bKash now:' : 'Grand Total to Pay:'}
              </span>
              <span
                className={`font-black text-xl font-mono ${
                  isPartialBkash ? 'text-[#E2136E]' : 'text-black'
                }`}
              >
                {formatPrice(bkashSendAmountBdt)}
              </span>
            </div>
          </div>

          {/* Delivery Note */}
          <div className="bg-zinc-50 border-2 border-zinc-200 p-4 rounded-xl text-[10px] text-zinc-800 flex gap-2.5">
            <Info size={14} className="text-emerald-700 flex-shrink-0 mt-0.5" />
            <p className="leading-relaxed font-semibold">
              Every package is chemically sanitized and sealed inside historical vacuum-sealed cases with certificates of origin. Sourced for real fans.
            </p>
          </div>
        </div>

      </div>

    </section>
  );
};
